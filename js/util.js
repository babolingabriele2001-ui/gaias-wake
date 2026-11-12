// Piccole funzioni di supporto: date, testi, identificativi.

export const APP_VERSION = '1.2.0';

export function uuid() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID(); } catch { /* contesto non sicuro: si usa il fallback */ }
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Data locale del dispositivo in formato AAAA-MM-GG (non UTC: alle 00:30 è già "oggi").
export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && y <= 2200 && dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function utc(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const fmtLong = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtShort = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtDayMonth = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtDayMonthYear = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtMonthYear = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtMonthShort = new Intl.DateTimeFormat('it-IT', { month: 'short', timeZone: 'UTC' });
const fmtTimestamp = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export const formatDateLong = (iso) => capitalize(fmtLong.format(utc(iso)));
export const formatDateShort = (iso) => fmtShort.format(utc(iso)).replace(/\./g, '');
export const formatDayMonth = (iso) => fmtDayMonth.format(utc(iso));
export const formatDayMonthYear = (iso) => fmtDayMonthYear.format(utc(iso));
export const formatMonthYear = (iso) => capitalize(fmtMonthYear.format(utc(iso)));
export const formatMonthShort = (iso) => fmtMonthShort.format(utc(iso)).replace(/\./g, '');
export const formatTimestamp = (ts) => fmtTimestamp.format(new Date(ts));
export const yearOf = (iso) => Number(iso.slice(0, 4));
export const monthIndexOf = (iso) => Number(iso.slice(5, 7)) - 1;

export const MONTH_INITIALS = ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'];
export const MONTH_NAMES = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

// Titolo mostrato: quello scritto da Gaia oppure, se manca, uno ricavato solo dalla data.
export function entryTitle(e) {
  const t = (e.title || '').trim();
  return t || `Uscita del ${formatDayMonth(e.date)}`;
}

export function placeLine(e) {
  const a = (e.departure || '').trim();
  const b = (e.destination || '').trim();
  if (a && b) return `${a} → ${b}`;
  return a || b;
}

// Testo senza accenti e in minuscolo, per ricerche "Cernobbio" = "cernobbio", "città" = "citta".
export function normalize(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function slugify(s) {
  return normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

const nf1 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${nf1.format(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${nf1.format(n / 1024 ** 2)} MB`;
  return `${nf1.format(n / 1024 ** 3)} GB`;
}

export function formatNumber(n, digits = 1) {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: digits }).format(n);
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export function daysSince(ts, now = Date.now()) {
  return Math.floor((now - new Date(ts).getTime()) / 86400000);
}

const IMAGE_EXT = /\.(jpe?g|png|heic|heif|webp|gif|avif|tiff?|bmp)$/i;
export function isImageFile(file) {
  return (file.type && file.type.startsWith('image/')) || IMAGE_EXT.test(file.name || '');
}

const TYPE_BY_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', tif: 'image/tiff', tiff: 'image/tiff', bmp: 'image/bmp' };
export function guessImageType(name) {
  const ext = (String(name || '').match(/\.([a-z0-9]+)$/i) || [])[1];
  return TYPE_BY_EXT[(ext || '').toLowerCase()] || '';
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
}
