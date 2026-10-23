// Lettura e scrittura di archivi ZIP senza librerie esterne.
//
// Scrittura: metodo "store" (nessuna compressione) — le foto sono già compresse, così
// gli originali finiscono nell'archivio byte per byte, e il file si apre con qualsiasi
// programma (Esplora file di Windows, File su iPhone, macOS).
// Lettura: "store" e "deflate" (quest'ultimo tramite DecompressionStream del browser),
// con verifica CRC-32 di ogni file. ZIP64 e archivi cifrati non sono supportati.

export class ZipError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ZipError';
    this.code = code;
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes, crc = 0) {
  let c = crc ^ 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();
const LIMIT = 0xffffffff;

function dosDateTime(d) {
  const year = Math.min(Math.max(d.getFullYear(), 1980), 2107);
  return {
    date: (((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff,
    time: ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)) & 0xffff,
  };
}

// files: [{ name: 'cartella/file.jpg', data: Blob | Uint8Array | string, date?: Date }]
export async function createZip(files, { onProgress } = {}) {
  const parts = [];
  const central = [];
  let offset = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const nameBytes = encoder.encode(f.name);
    let blob;
    let bytes;
    if (typeof f.data === 'string') {
      bytes = encoder.encode(f.data);
      blob = new Blob([bytes]);
    } else if (f.data instanceof Uint8Array) {
      bytes = f.data;
      blob = new Blob([bytes]);
    } else {
      blob = f.data;
      bytes = new Uint8Array(await blob.arrayBuffer());
    }
    const crc = crc32(bytes);
    const size = bytes.length;
    bytes = null;

    if (size >= LIMIT || offset + 30 + nameBytes.length + size >= LIMIT) {
      throw new ZipError('too-large', 'I ricordi superano 4 GB: troppo per un unico archivio ZIP.');
    }
    const when = f.date instanceof Date && !Number.isNaN(f.date.getTime()) ? f.date : new Date();
    const { date, time } = dosDateTime(when);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // nomi in UTF-8
    lv.setUint16(8, 0, true); // store
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    parts.push(local, blob);
    central.push({ nameBytes, crc, size, date, time, offset });
    offset += local.length + size;
    onProgress?.(i + 1, files.length);
  }

  if (central.length >= 0xffff) throw new ZipError('too-many', 'Troppi file per un unico archivio ZIP.');

  const dirParts = [];
  let dirSize = 0;
  for (const c of central) {
    const h = new Uint8Array(46 + c.nameBytes.length);
    const v = new DataView(h.buffer);
    v.setUint32(0, 0x02014b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 20, true);
    v.setUint16(8, 0x0800, true);
    v.setUint16(10, 0, true);
    v.setUint16(12, c.time, true);
    v.setUint16(14, c.date, true);
    v.setUint32(16, c.crc, true);
    v.setUint32(20, c.size, true);
    v.setUint32(24, c.size, true);
    v.setUint16(28, c.nameBytes.length, true);
    v.setUint16(30, 0, true);
    v.setUint16(32, 0, true);
    v.setUint16(34, 0, true);
    v.setUint16(36, 0, true);
    v.setUint32(38, 0, true);
    v.setUint32(42, c.offset, true);
    h.set(c.nameBytes, 46);
    dirParts.push(h);
    dirSize += h.length;
  }
  if (offset + dirSize >= LIMIT) throw new ZipError('too-large', 'I ricordi superano 4 GB: troppo per un unico archivio ZIP.');

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, dirSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...parts, ...dirParts, end], { type: 'application/zip' });
}

export async function openZip(blob) {
  const size = blob.size;
  if (size < 22) throw new ZipError('not-zip', 'Il file è troppo piccolo per essere un archivio ZIP.');
  const tailLen = Math.min(size, 22 + 0xffff);
  const tail = new Uint8Array(await blob.slice(size - tailLen).arrayBuffer());
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) throw new ZipError('not-zip', 'Il file non è un archivio ZIP oppure è incompleto.');

  const ev = new DataView(tail.buffer, tail.byteOffset + eocd, 22);
  const count = ev.getUint16(10, true);
  const dirSize = ev.getUint32(12, true);
  const dirOffset = ev.getUint32(16, true);
  if (count === 0xffff || dirSize === LIMIT || dirOffset === LIMIT) throw new ZipError('zip64', 'Questo formato di archivio (ZIP64) non è supportato.');
  if (dirOffset + dirSize > size) throw new ZipError('truncated', 'L’archivio è incompleto o danneggiato.');

  const dir = new Uint8Array(await blob.slice(dirOffset, dirOffset + dirSize).arrayBuffer());
  const dv = new DataView(dir.buffer);
  const decoder = new TextDecoder();
  const entries = new Map();
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > dir.length || dv.getUint32(p, true) !== 0x02014b50) throw new ZipError('corrupt', 'L’indice dell’archivio è danneggiato.');
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    if (p + 46 + nameLen > dir.length) throw new ZipError('corrupt', 'L’indice dell’archivio è danneggiato.');
    const entry = {
      name: decoder.decode(dir.subarray(p + 46, p + 46 + nameLen)),
      flags: dv.getUint16(p + 8, true),
      method: dv.getUint16(p + 10, true),
      crc: dv.getUint32(p + 16, true),
      compressedSize: dv.getUint32(p + 20, true),
      size: dv.getUint32(p + 24, true),
      offset: dv.getUint32(p + 42, true),
    };
    if (entry.offset + 30 > size) throw new ZipError('truncated', 'L’archivio è incompleto o danneggiato.');
    entries.set(entry.name, entry);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return new ZipArchive(blob, entries);
}

class ZipArchive {
  constructor(blob, entries) {
    this.blob = blob;
    this.entries = entries;
  }

  has(name) {
    return this.entries.has(name);
  }

  names() {
    return [...this.entries.keys()];
  }

  async read(name, { verify = true } = {}) {
    const e = this.entries.get(name);
    if (!e) throw new ZipError('missing', `Nell’archivio manca il file «${name}».`);
    if (e.flags & 1) throw new ZipError('encrypted', 'L’archivio è protetto da password: non è supportato.');
    const head = new DataView(await this.blob.slice(e.offset, e.offset + 30).arrayBuffer());
    if (head.byteLength < 30 || head.getUint32(0, true) !== 0x04034b50) throw new ZipError('corrupt', `Il file «${name}» nell’archivio è danneggiato.`);
    const start = e.offset + 30 + head.getUint16(26, true) + head.getUint16(28, true);
    if (start + e.compressedSize > this.blob.size) throw new ZipError('truncated', `Il file «${name}» è incompleto: l’archivio sembra troncato.`);
    const data = this.blob.slice(start, start + e.compressedSize);
    let bytes;
    if (e.method === 0) bytes = new Uint8Array(await data.arrayBuffer());
    else if (e.method === 8) bytes = await inflateRaw(data, name);
    else throw new ZipError('method', `Il file «${name}» usa una compressione non supportata.`);
    if (bytes.length !== e.size) throw new ZipError('corrupt', `Il file «${name}» è danneggiato (dimensione errata).`);
    if (verify && crc32(bytes) !== e.crc) throw new ZipError('crc', `Il file «${name}» è danneggiato (controllo di integrità non superato).`);
    return bytes;
  }

  async text(name) {
    return new TextDecoder().decode(await this.read(name));
  }
}

async function inflateRaw(blob, name) {
  if (typeof DecompressionStream === 'undefined') {
    throw new ZipError('method', 'Questo browser non sa decomprimere l’archivio. Usa il file .zip creato da Gaia’s Wake senza ricomprimerlo.');
  }
  try {
    const stream = blob.stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new ZipError('corrupt', `Il file «${name}» è danneggiato e non si può decomprimere.`);
  }
}
