// Gestione delle immagini a schermo.
// Gli originali in IndexedDB non vengono mai modificati: qui si creano solo anteprime
// ridotte (per liste e gallerie) e URL temporanei per mostrarle.

import * as db from './db.js';

const THUMB_MAX = 720;
const THUMB_QUALITY = 0.82;

// Al massimo due decodifiche alla volta: su iPhone le foto da 12–48 MP pesano in memoria.
let active = 0;
const queue = [];
function limited(task) {
  return new Promise((resolve, reject) => {
    const start = () => {
      active++;
      task().then(resolve, reject).finally(() => {
        active--;
        queue.shift()?.();
      });
    };
    if (active < 2) start();
    else queue.push(start);
  });
}

async function decode(blob) {
  if ('createImageBitmap' in self) {
    try {
      const bmp = await createImageBitmap(blob);
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close?.() };
    } catch { /* si prova con <img> */ }
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

// Restituisce { blob, width, height } oppure null se il formato non è leggibile qui.
export function createThumbnail(blob) {
  return limited(async () => {
    let decoded = null;
    try {
      decoded = await decode(blob);
      if (!decoded || !decoded.width || !decoded.height) return null;
      const { width, height } = decoded;
      const scale = Math.min(1, THUMB_MAX / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
      const out = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', THUMB_QUALITY));
      canvas.width = 0;
      canvas.height = 0;
      return out ? { blob: out, width, height } : null;
    } catch {
      return null;
    } finally {
      decoded?.release();
    }
  });
}

// ---- Cache degli URL delle anteprime --------------------------------------

const MAX_CACHED = 300;
const thumbURLs = new Map();
const pending = new Map();

function remember(id, url) {
  thumbURLs.set(id, url);
  while (thumbURLs.size > MAX_CACHED) {
    const [oldId, oldUrl] = thumbURLs.entries().next().value;
    thumbURLs.delete(oldId);
    URL.revokeObjectURL(oldUrl);
  }
}

async function loadThumb(id) {
  let blob = db.recordBlob(await db.getThumb(id));
  if (!blob) {
    const original = db.recordBlob(await db.getPhoto(id));
    if (!original) return null;
    const thumb = await createThumbnail(original);
    if (thumb) {
      blob = thumb.blob;
      try { await db.putThumb(await db.makeThumbRecord(id, thumb)); } catch { /* l'anteprima è facoltativa */ }
    } else {
      blob = original;
    }
  }
  const url = URL.createObjectURL(blob);
  remember(id, url);
  return url;
}

export function thumbURL(id) {
  if (thumbURLs.has(id)) {
    const url = thumbURLs.get(id);
    thumbURLs.delete(id);
    thumbURLs.set(id, url);
    return Promise.resolve(url);
  }
  if (!pending.has(id)) pending.set(id, loadThumb(id).finally(() => pending.delete(id)));
  return pending.get(id);
}

export function forgetPhoto(id) {
  const url = thumbURLs.get(id);
  if (url) URL.revokeObjectURL(url);
  thumbURLs.delete(id);
}

// URL dell'originale: chi lo chiede deve poi chiamare URL.revokeObjectURL.
export async function originalURL(id) {
  const blob = db.recordBlob(await db.getPhoto(id));
  return blob ? URL.createObjectURL(blob) : null;
}

// Carica le anteprime delle <img data-thumb="id"> quando stanno per entrare nello schermo.
export function hydrateThumbs(root) {
  const imgs = [...root.querySelectorAll('img[data-thumb]:not([src])')];
  if (!imgs.length) return () => {};
  const load = async (img) => {
    let url = null;
    try { url = await thumbURL(img.dataset.thumb); } catch { url = null; }
    // Se nel frattempo è già arrivata l'originale (carosello), non la si sostituisce con l'anteprima.
    if (!img.isConnected || img.getAttribute('src')) return;
    if (url) {
      img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
      img.addEventListener('error', () => img.parentElement?.classList.add('is-missing'), { once: true });
      img.src = url;
    } else {
      img.parentElement?.classList.add('is-missing');
    }
  };
  if (!('IntersectionObserver' in self)) {
    imgs.forEach(load);
    return () => {};
  }
  const io = new IntersectionObserver((list) => {
    for (const en of list) {
      if (en.isIntersecting) {
        io.unobserve(en.target);
        load(en.target);
      }
    }
  }, { rootMargin: '400px 400px' });
  imgs.forEach((img) => io.observe(img));
  return () => io.disconnect();
}
