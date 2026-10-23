// Backup completo in un archivio .zip:
//   backup.json   — descrizione di tutte le uscite e delle foto (formato "gaias-wake-backup")
//   LEGGIMI.txt   — spiegazione leggibile da chiunque apra l'archivio
//   foto/…        — le fotografie originali, byte per byte, divise per uscita

import * as db from './db.js';
import { createZip, openZip } from './zip.js';
import { isValidPoint } from './lake-map.js';
import { APP_VERSION, isValidISODate, slugify, todayISO, guessImageType, entryTitle, formatDayMonthYear } from './util.js';

export const BACKUP_FORMAT = 'gaias-wake-backup';
export const BACKUP_VERSION = 1;

const TEXT_FIELDS = ['title', 'departure', 'destination', 'boatType', 'crew', 'weather', 'wind', 'notes'];
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export class BackupError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'BackupError';
    this.cause = cause;
  }
}

const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/tiff': 'tif' };
function extensionFor(rec, blob) {
  const fromName = (String(rec.name || '').match(/\.([a-z0-9]{2,5})$/i) || [])[1];
  return (fromName || EXT_BY_TYPE[rec.type || blob.type] || 'bin').toLowerCase();
}

function readme(manifest) {
  const lines = [
    "Gaia's Wake — backup dei ricordi",
    '',
    `Creato il: ${new Date(manifest.exportedAt).toLocaleString('it-IT')}`,
    `Uscite: ${manifest.entryCount}`,
    `Fotografie: ${manifest.photoCount}`,
    '',
    'Questo archivio contiene tutte le uscite e le fotografie originali.',
    "Per ripristinarlo: apri Gaia's Wake › Backup e dati › Importa un backup, e scegli questo file .zip.",
    '',
    'Le foto sono nella cartella "foto", una sottocartella per ogni uscita.',
    'Il file backup.json descrive le uscite (data, titolo, luoghi, note…).',
    'Non modificare né rinominare i file se vuoi poter ripristinare il backup.',
  ];
  return lines.join('\r\n');
}

// ---- Esportazione --------------------------------------------------------

export async function buildBackup({ onProgress } = {}) {
  const entries = await db.listEntries();
  const now = new Date();
  const manifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: "Gaia's Wake",
    appVersion: APP_VERSION,
    exportedAt: now.toISOString(),
    entryCount: entries.length,
    photoCount: 0,
    entries: [],
  };
  const files = [];
  const missing = [];

  for (const entry of entries) {
    const folder = `foto/${entry.date}_${slugify(entry.title) || 'uscita'}_${entry.id.slice(0, 8)}`;
    const photos = [];
    for (const pid of entry.photoIds || []) {
      const rec = await db.getPhoto(pid);
      const blob = db.recordBlob(rec);
      if (!blob) {
        missing.push({ entry, photoId: pid });
        continue;
      }
      const path = `${folder}/${String(photos.length + 1).padStart(2, '0')}_${pid.slice(0, 8)}.${extensionFor(rec, blob)}`;
      files.push({ name: path, data: blob, date: rec.lastModified ? new Date(rec.lastModified) : now });
      photos.push({
        id: pid,
        file: path,
        name: rec.name || '',
        type: rec.type || blob.type || '',
        size: blob.size,
        lastModified: rec.lastModified ?? null,
        addedAt: rec.addedAt ?? null,
      });
    }
    manifest.photoCount += photos.length;
    const { photoIds, ...fields } = entry;
    manifest.entries.push({ ...fields, photos });
  }
  if (missing.length) manifest.missingPhotos = missing.map((m) => ({ entryId: m.entry.id, photoId: m.photoId }));

  files.unshift({ name: 'LEGGIMI.txt', data: readme(manifest), date: now });
  files.unshift({ name: 'backup.json', data: JSON.stringify(manifest, null, 2), date: now });

  const blob = await createZip(files, { onProgress });
  return {
    blob,
    filename: `gaias-wake-backup-${todayISO(now)}.zip`,
    entryCount: manifest.entryCount,
    photoCount: manifest.photoCount,
    missing,
  };
}

// ---- Importazione --------------------------------------------------------

function str(v, max = 500) {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function sanitizeEntry(raw, zip, problems) {
  if (!raw || typeof raw !== 'object') {
    problems.push('Una voce del backup non è leggibile ed è stata ignorata.');
    return null;
  }
  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) {
    problems.push('Un’uscita senza identificativo valido è stata ignorata.');
    return null;
  }
  if (!isValidISODate(raw.date)) {
    problems.push(`Un’uscita con data non valida («${str(raw.date, 20)}») è stata ignorata.`);
    return null;
  }
  const e = { id: raw.id, date: raw.date };
  for (const f of TEXT_FIELDS) e[f] = str(raw[f], f === 'notes' ? 50000 : 500);
  e.rating = Number.isInteger(raw.rating) && raw.rating >= 0 && raw.rating <= 5 ? raw.rating : 0;
  e.favorite = raw.favorite === true;
  e.mapPoint = isValidPoint(raw.mapPoint) ? { x: raw.mapPoint.x, y: raw.mapPoint.y } : null;
  e.createdAt = typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : new Date().toISOString();
  e.updatedAt = typeof raw.updatedAt === 'string' && !Number.isNaN(Date.parse(raw.updatedAt)) ? raw.updatedAt : e.createdAt;

  const label = `${entryTitle(e)} (${formatDayMonthYear(e.date)})`;
  e.photos = [];
  const seen = new Set();
  for (const p of Array.isArray(raw.photos) ? raw.photos : []) {
    if (!p || typeof p.id !== 'string' || !ID_RE.test(p.id) || typeof p.file !== 'string' || seen.has(p.id)) {
      problems.push(`«${label}»: una foto descritta in modo non valido è stata ignorata.`);
      continue;
    }
    if (!zip.has(p.file)) {
      problems.push(`«${label}»: nell’archivio manca la foto ${p.file}.`);
      continue;
    }
    seen.add(p.id);
    e.photos.push({
      id: p.id,
      file: p.file,
      name: str(p.name, 300),
      type: str(p.type, 100),
      size: Number.isInteger(p.size) && p.size >= 0 ? p.size : null,
      lastModified: Number.isFinite(p.lastModified) ? p.lastModified : null,
    });
  }
  return e;
}

function sameEntry(current, incoming) {
  for (const f of ['date', ...TEXT_FIELDS]) if ((current[f] || '') !== (incoming[f] || '')) return false;
  if ((current.rating || 0) !== incoming.rating || !!current.favorite !== incoming.favorite) return false;
  const pa = current.mapPoint || null;
  const pb = incoming.mapPoint || null;
  if ((pa?.x ?? null) !== (pb?.x ?? null) || (pa?.y ?? null) !== (pb?.y ?? null)) return false;
  const a = current.photoIds || [];
  const b = incoming.photos.map((p) => p.id);
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

// Legge e controlla il file senza modificare nulla. Restituisce un riepilogo da mostrare.
export async function inspectBackup(file) {
  let zip;
  try {
    zip = await openZip(file);
  } catch (err) {
    throw new BackupError(`Il file scelto non è un backup leggibile: ${err.message}`, err);
  }
  if (!zip.has('backup.json')) {
    throw new BackupError('Questo archivio non è un backup di Gaia’s Wake: manca il file backup.json.');
  }
  let manifest;
  try {
    manifest = JSON.parse(await zip.text('backup.json'));
  } catch (err) {
    throw new BackupError('Il file backup.json è danneggiato e non si può leggere. Prova con un altro backup.', err);
  }
  if (!manifest || manifest.format !== BACKUP_FORMAT) {
    throw new BackupError('Questo archivio non è un backup di Gaia’s Wake.');
  }
  if (!Number.isInteger(manifest.version) || manifest.version < 1) {
    throw new BackupError('Il backup ha un formato non riconosciuto.');
  }
  if (manifest.version > BACKUP_VERSION) {
    throw new BackupError('Questo backup è stato creato da una versione più recente dell’app. Aggiorna l’app e riprova.');
  }
  if (!Array.isArray(manifest.entries)) {
    throw new BackupError('Il backup non contiene l’elenco delle uscite.');
  }

  const problems = [];
  const entries = [];
  const ids = new Set();
  for (const raw of manifest.entries) {
    const e = sanitizeEntry(raw, zip, problems);
    if (!e) continue;
    if (ids.has(e.id)) {
      problems.push(`L’uscita «${entryTitle(e)}» compare due volte nel backup: è stata considerata una sola volta.`);
      continue;
    }
    ids.add(e.id);
    entries.push(e);
  }

  const existing = new Map((await db.listEntries()).map((e) => [e.id, e]));
  const counts = { total: entries.length, fresh: 0, identical: 0, different: 0, photos: 0 };
  for (const e of entries) {
    const current = existing.get(e.id);
    if (!current) { e.status = 'new'; counts.fresh++; }
    else if (sameEntry(current, e)) { e.status = 'same'; counts.identical++; }
    else { e.status = 'different'; counts.different++; }
    counts.photos += e.photos.length;
  }
  return { zip, entries, problems, counts, exportedAt: typeof manifest.exportedAt === 'string' ? manifest.exportedAt : null };
}

// Applica il backup: aggiunge le uscite nuove e, solo se richiesto, sostituisce quelle diverse.
// Le uscite identiche non vengono toccate: nessun doppione.
export async function applyBackup(inspection, { replaceDifferent = false, onProgress } = {}) {
  const { zip, entries } = inspection;
  const todo = entries.filter((e) => e.status === 'new' || (replaceDifferent && e.status === 'different'));
  const totalPhotos = todo.reduce((n, e) => n + e.photos.length, 0);
  const result = { added: 0, replaced: 0, skipped: entries.length - todo.length, photos: 0, failedPhotos: [], failedEntries: [], fatal: null };
  let done = 0;

  for (const e of todo) {
    try {
      const photoIds = [];
      for (const p of e.photos) {
        try {
          const bytes = await zip.read(p.file);
          if (p.size !== null && bytes.length !== p.size) throw new BackupError('dimensione diversa da quella attesa');
          const blob = new Blob([bytes], { type: p.type || guessImageType(p.file) });
          const rec = await db.makePhotoRecord({ id: p.id, entryId: e.id, blob, name: p.name, lastModified: p.lastModified });
          await db.putPhoto(rec);
          photoIds.push(p.id);
          result.photos++;
        } catch (err) {
          if (err instanceof db.StorageError) throw err;
          // Se la foto è già sul dispositivo (stesso identificativo) la si conserva.
          if (await db.hasPhoto(p.id)) photoIds.push(p.id);
          result.failedPhotos.push({ title: entryTitle(e), file: p.file, reason: err.message });
        }
        done++;
        onProgress?.(done, totalPhotos);
      }
      const { photos, status, ...fields } = e;
      await db.putEntryReplacingPhotos({ ...fields, photoIds });
      if (status === 'new') result.added++;
      else result.replaced++;
    } catch (err) {
      if (err instanceof db.StorageError) {
        result.fatal = err;
        break;
      }
      result.failedEntries.push({ title: entryTitle(e), reason: err.message });
    }
  }
  return result;
}
