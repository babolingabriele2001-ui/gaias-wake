// Test del modulo ZIP (eseguiti direttamente in Node, senza browser).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createZip, openZip, crc32 } from '../js/zip.js';

const enc = new TextEncoder();

test('CRC-32 standard', () => {
  assert.equal(crc32(enc.encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new Uint8Array()), 0);
});

test('scrittura e rilettura: contenuti identici byte per byte, nomi UTF-8', async () => {
  const big = new Uint8Array(500_000).map((_, i) => (i * 31) & 255);
  const zip = await createZip([
    { name: 'backup.json', data: '{"città":"Cernobbio"}' },
    { name: 'foto/2026-09-14_città/01_abc.jpg', data: new Blob([big]) },
    { name: 'vuoto.txt', data: '' },
  ]);
  const archive = await openZip(zip);
  assert.deepEqual(archive.names(), ['backup.json', 'foto/2026-09-14_città/01_abc.jpg', 'vuoto.txt']);
  assert.equal(await archive.text('backup.json'), '{"città":"Cernobbio"}');
  const back = await archive.read('foto/2026-09-14_città/01_abc.jpg');
  assert.equal(Buffer.compare(Buffer.from(back), Buffer.from(big)), 0);
  assert.equal((await archive.read('vuoto.txt')).length, 0);
});

test('archivio compatibile con altri programmi (zipfile di Python, se presente)', async (t) => {
  let python = null;
  for (const cmd of ['python3', 'python']) {
    try { execFileSync(cmd, ['--version'], { stdio: 'ignore' }); python = cmd; break; } catch { /* non installato */ }
  }
  if (!python) { t.skip('Python non disponibile'); return; }
  const zip = await createZip([{ name: 'a/è.txt', data: 'ciao' }, { name: 'b.bin', data: new Uint8Array([0, 1, 2, 255]) }]);
  const dir = await mkdtemp(path.join(tmpdir(), 'gw-zip-'));
  const file = path.join(dir, 't.zip');
  await writeFile(file, Buffer.from(await zip.arrayBuffer()));
  const out = execFileSync(python, ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(z.testzip()); print(z.read("a/è.txt").decode())', file]).toString();
  assert.match(out, /^None\s+ciao/);
});

test('lettura di archivi compressi (deflate) creati da altri programmi', async () => {
  const content = enc.encode('Every ride leaves a memory. '.repeat(200));
  const comp = deflateRawSync(content);
  const name = enc.encode('nota.txt');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc32(content), 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc32(content), 16); central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(content.length, 24); central.writeUInt16LE(name.length, 28);
  const cdOffset = 30 + name.length + comp.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + name.length, 12); end.writeUInt32LE(cdOffset, 16);
  const blob = new Blob([local, name, comp, central, name, end]);
  const archive = await openZip(blob);
  assert.equal(await archive.text('nota.txt'), new TextDecoder().decode(content));
});

test('file danneggiati o non validi vengono riconosciuti', async () => {
  await assert.rejects(openZip(new Blob([enc.encode('non sono uno zip, solo testo qualunque.')])), { code: 'not-zip' });
  await assert.rejects(openZip(new Blob([new Uint8Array(5)])), { code: 'not-zip' });

  const payload = new Uint8Array(10_000).map((_, i) => i & 255);
  const good = new Uint8Array(await (await createZip([{ name: 'x.bin', data: payload }])).arrayBuffer());

  // Troncato: manca la parte finale con l'indice.
  await assert.rejects(openZip(new Blob([good.slice(0, 6000)])), { code: 'not-zip' });

  // Un byte alterato nei dati: il controllo CRC lo scopre.
  const bad = good.slice();
  bad[30 + 5 + 4000] ^= 0xff;
  const archive = await openZip(new Blob([bad]));
  await assert.rejects(archive.read('x.bin'), { code: 'crc' });
  await assert.rejects(archive.read('manca.bin'), { code: 'missing' });
});
