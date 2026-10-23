// Archivio locale su IndexedDB.
//
// Archivi (object store):
//   entries  — le uscite (keyPath "id"); ogni uscita elenca le sue foto in photoIds, in ordine.
//   photos   — le fotografie ORIGINALI, una per record (keyPath "id", indice "entryId").
//              Il file viene salvato come Blob; se il browser non riesce a conservare Blob
//              in IndexedDB si usa un ArrayBuffer con lo stesso contenuto binario.
//   thumbs   — anteprime ridotte (keyPath "id" = id della foto). Sono rigenerabili:
//              se mancano si ricreano dall'originale, che non viene mai modificato.
//   meta     — piccole impostazioni (keyPath "key"), es. data dell'ultimo backup.

const DB_NAME = 'gaias-wake';
const DB_VERSION = 1;

export class StorageError extends Error {
  constructor(kind, message, cause) {
    super(message);
    this.name = 'StorageError';
    this.kind = kind;
    this.cause = cause;
  }
}

export function toStorageError(err) {
  if (err instanceof StorageError) return err;
  const name = err?.name || '';
  const msg = err?.message || '';
  if (name === 'QuotaExceededError' || /quota|exceed|space/i.test(msg)) {
    return new StorageError('quota', 'Lo spazio disponibile sul dispositivo è esaurito. Libera spazio sull’iPhone (o rimuovi qualche foto molto pesante) e riprova. Ciò che era già salvato non è stato toccato.', err);
  }
  if (name === 'InvalidStateError' || /connection|closing|closed/i.test(msg)) {
    return new StorageError('connection', 'La memoria del dispositivo non ha risposto. Chiudi e riapri l’app, poi riprova.', err);
  }
  return new StorageError('generic', `Non è stato possibile completare il salvataggio sul dispositivo${msg ? ` (${msg})` : ''}.`, err);
}

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(new StorageError('unsupported', 'Questo browser non permette di salvare i ricordi sul dispositivo. Apri l’app con Safari e non in navigazione privata.', err));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) {
        const photos = db.createObjectStore('photos', { keyPath: 'id' });
        photos.createIndex('entryId', 'entryId', { unique: false });
      }
      if (!db.objectStoreNames.contains('thumbs')) db.createObjectStore('thumbs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      db.onclose = () => { dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(toStorageError(req.error));
    req.onblocked = () => reject(new StorageError('blocked', 'L’app è aperta in un’altra scheda con una versione diversa. Chiudi le altre schede e riprova.'));
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

// Esegue `body(stores)` in una transazione e risolve solo quando IndexedDB conferma
// il completamento (oncomplete): a quel punto i dati sono davvero scritti.
// Se `body` restituisce una funzione, il risultato è il suo valore a transazione completata.
async function run(storeNames, mode, body, retry = true) {
  const db = await openDB();
  let t;
  try {
    t = db.transaction(storeNames, mode);
  } catch (err) {
    // Safari a volte chiude la connessione quando l'app resta a lungo in background.
    dbPromise = null;
    try { db.close(); } catch { /* già chiusa */ }
    if (retry) return run(storeNames, mode, body, false);
    throw toStorageError(err);
  }
  return new Promise((resolve, reject) => {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const stores = {};
    for (const n of names) stores[n] = t.objectStore(n);
    let result;
    t.oncomplete = () => resolve(typeof result === 'function' ? result() : result);
    t.onabort = () => reject(toStorageError(t.error || new DOMException('Operazione annullata', 'AbortError')));
    try {
      result = body(stores, t);
    } catch (err) {
      try { t.abort(); } catch { /* già terminata */ }
      reject(toStorageError(err));
    }
  });
}

// ---- Supporto Blob -------------------------------------------------------

let blobSupport = null;

export async function canStoreBlobs() {
  if (blobSupport !== null) return blobSupport;
  try {
    await run('meta', 'readwrite', (s) => { s.meta.put({ key: '__blob_test', value: new Blob(['ok'], { type: 'text/plain' }) }); });
    const rec = await run('meta', 'readonly', (s) => {
      let r;
      s.meta.get('__blob_test').onsuccess = (e) => { r = e.target.result; };
      return () => r;
    });
    blobSupport = !!(rec && rec.value instanceof Blob && (await rec.value.text()) === 'ok');
    await run('meta', 'readwrite', (s) => { s.meta.delete('__blob_test'); });
  } catch {
    blobSupport = false;
  }
  return blobSupport;
}

export function recordBlob(rec) {
  if (!rec) return null;
  if (rec.blob instanceof Blob) return rec.blob;
  if (rec.buffer instanceof ArrayBuffer) return new Blob([rec.buffer], { type: rec.type || '' });
  return null;
}

export async function makePhotoRecord({ id, entryId, blob, name, lastModified }) {
  const rec = {
    id,
    entryId,
    name: name || '',
    type: blob.type || '',
    size: blob.size,
    lastModified: Number.isFinite(lastModified) ? lastModified : null,
    addedAt: new Date().toISOString(),
  };
  if (await canStoreBlobs()) rec.blob = blob;
  else rec.buffer = await blob.arrayBuffer();
  return rec;
}

export async function makeThumbRecord(id, thumb) {
  const rec = { id, type: thumb.blob.type, width: thumb.width, height: thumb.height };
  if (await canStoreBlobs()) rec.blob = thumb.blob;
  else rec.buffer = await thumb.blob.arrayBuffer();
  return rec;
}

// ---- Uscite --------------------------------------------------------------

export function sortEntries(list) {
  return list.sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function listEntries() {
  const list = await run('entries', 'readonly', (s) => {
    let r = [];
    s.entries.getAll().onsuccess = (e) => { r = e.target.result; };
    return () => r;
  });
  return sortEntries(list);
}

export async function getEntry(id) {
  return run('entries', 'readonly', (s) => {
    let r = null;
    s.entries.get(id).onsuccess = (e) => { r = e.target.result || null; };
    return () => r;
  });
}

// Salva l'uscita ed elimina, nella stessa transazione, le foto tolte dall'utente.
export async function putEntry(entry, { removePhotoIds = [] } = {}) {
  await run(['entries', 'photos', 'thumbs'], 'readwrite', (s) => {
    s.entries.put(entry);
    for (const id of removePhotoIds) {
      s.photos.delete(id);
      s.thumbs.delete(id);
    }
  });
}

// Salva l'uscita e rimuove le foto collegate a lei che non compaiono in entry.photoIds
// (usato dal ripristino in modalità "sostituisci").
export async function putEntryReplacingPhotos(entry) {
  const keep = new Set(entry.photoIds);
  await run(['entries', 'photos', 'thumbs'], 'readwrite', (s) => {
    s.photos.index('entryId').getAllKeys(IDBKeyRange.only(entry.id)).onsuccess = (e) => {
      for (const key of e.target.result) {
        if (!keep.has(key)) {
          s.photos.delete(key);
          s.thumbs.delete(key);
        }
      }
      s.entries.put(entry);
    };
  });
}

export async function deleteEntry(id) {
  await run(['entries', 'photos', 'thumbs'], 'readwrite', (s) => {
    s.entries.delete(id);
    s.photos.index('entryId').getAllKeys(IDBKeyRange.only(id)).onsuccess = (e) => {
      for (const key of e.target.result) {
        s.photos.delete(key);
        s.thumbs.delete(key);
      }
    };
  });
}

// Controllo dopo il salvataggio: l'uscita esiste e tutte le sue foto sono presenti.
export async function verifyEntry(id, photoIds) {
  return run(['entries', 'photos'], 'readonly', (s) => {
    let entryOk = false;
    let found = 0;
    s.entries.count(id).onsuccess = (e) => { entryOk = e.target.result === 1; };
    for (const pid of photoIds) {
      s.photos.count(pid).onsuccess = (e) => { found += e.target.result; };
    }
    return () => entryOk && found === photoIds.length;
  });
}

// ---- Foto ----------------------------------------------------------------

export async function putPhoto(rec, thumbRec = null) {
  await run(['photos', 'thumbs'], 'readwrite', (s) => {
    s.photos.put(rec);
    if (thumbRec) s.thumbs.put(thumbRec);
  });
}

export async function getPhoto(id) {
  return run('photos', 'readonly', (s) => {
    let r = null;
    s.photos.get(id).onsuccess = (e) => { r = e.target.result || null; };
    return () => r;
  });
}

export async function hasPhoto(id) {
  return run('photos', 'readonly', (s) => {
    let n = 0;
    s.photos.count(id).onsuccess = (e) => { n = e.target.result; };
    return () => n > 0;
  });
}

export async function getThumb(id) {
  return run('thumbs', 'readonly', (s) => {
    let r = null;
    s.thumbs.get(id).onsuccess = (e) => { r = e.target.result || null; };
    return () => r;
  });
}

export async function putThumb(rec) {
  await run('thumbs', 'readwrite', (s) => { s.thumbs.put(rec); });
}

export async function countPhotos() {
  return run('photos', 'readonly', (s) => {
    let n = 0;
    s.photos.count().onsuccess = (e) => { n = e.target.result; };
    return () => n;
  });
}

// Elimina foto rimaste senza uscita (es. app chiusa a metà di un salvataggio) e
// anteprime senza originale. Tocca solo record più vecchi di `olderThanMs`.
export async function cleanupOrphans({ olderThanMs = 60 * 60 * 1000 } = {}) {
  const entries = await listEntries();
  const owned = new Map(entries.map((e) => [e.id, new Set(e.photoIds || [])]));
  const cutoff = Date.now() - olderThanMs;
  return run(['photos', 'thumbs'], 'readwrite', (s) => {
    let removed = 0;
    s.photos.index('entryId').openKeyCursor().onsuccess = (e) => {
      const cur = e.target.result;
      if (!cur) return;
      const entryId = cur.key;
      const photoId = cur.primaryKey;
      if (!owned.get(entryId)?.has(photoId)) {
        s.photos.get(photoId).onsuccess = (ev) => {
          const rec = ev.target.result;
          if (rec && (!rec.addedAt || Date.parse(rec.addedAt) < cutoff)) {
            s.photos.delete(photoId);
            s.thumbs.delete(photoId);
            removed++;
          }
        };
      }
      cur.continue();
    };
    s.photos.getAllKeys().onsuccess = (e) => {
      const photoKeys = new Set(e.target.result);
      s.thumbs.getAllKeys().onsuccess = (ev) => {
        for (const k of ev.target.result) if (!photoKeys.has(k)) s.thumbs.delete(k);
      };
    };
    return () => removed;
  });
}

// ---- Meta ----------------------------------------------------------------

export async function getMeta(key) {
  return run('meta', 'readonly', (s) => {
    let r;
    s.meta.get(key).onsuccess = (e) => { r = e.target.result?.value; };
    return () => r;
  });
}

export async function setMeta(key, value) {
  await run('meta', 'readwrite', (s) => { s.meta.put({ key, value }); });
}

// Chiede al browser di non cancellare automaticamente i dati (dove supportato).
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* non supportato */ }
  return false;
}

export async function storageInfo() {
  const info = { usage: null, quota: null, persisted: null };
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      info.usage = est.usage ?? null;
      info.quota = est.quota ?? null;
    }
    if (navigator.storage?.persisted) info.persisted = await navigator.storage.persisted();
  } catch { /* non supportato */ }
  return info;
}
