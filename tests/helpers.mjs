// Strumenti comuni ai test end-to-end (Playwright + Chromium, viewport iPhone).

import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';
import http from 'node:http';
import { createHandler } from '../tools/serve.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUTPUT = path.join(ROOT, 'tests', 'output');
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
export const IPHONE = iphone;

// state.offline = true simula un iPhone senza connessione: ogni richiesta viene interrotta,
// comprese quelle del service worker (che l'emulazione offline del browser non copre).
export async function startServer() {
  const state = { root: ROOT, offline: false };
  const handler = createHandler({ root: () => state.root });
  const server = http.createServer((req, res) => {
    if (state.offline) req.socket.destroy();
    else handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, state, base: `http://localhost:${port}/` };
}

function launchOptions() {
  return process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
}

export async function launch() {
  return chromium.launch(launchOptions());
}

export async function launchPersistent(dir) {
  return chromium.launchPersistentContext(dir, { ...launchOptions(), ...IPHONE, locale: 'it-IT', timezoneId: 'Europe/Rome' });
}

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

// Crea fotografie JPEG/PNG vere (non trasformate) da usare come foto di prova.
export async function makeFixtures(browser) {
  const dir = await mkdtemp(path.join(tmpdir(), 'gaias-wake-foto-'));
  const page = await browser.newPage();
  const specs = [
    { name: 'IMG_0001.jpg', w: 1600, h: 1200, type: 'jpeg', bg: '#3F7EA3', label: 'Lago 1' },
    { name: 'IMG_0002.jpg', w: 1000, h: 1400, type: 'jpeg', bg: '#8FAE8F', label: 'Lago 2' },
    { name: 'IMG_0003.jpg', w: 1200, h: 900, type: 'jpeg', bg: '#C9A77A', label: 'Lago 3' },
    { name: 'Tramonto.png', w: 800, h: 600, type: 'png', bg: '#E6A98A', label: 'PNG' },
  ];
  const out = {};
  for (const s of specs) {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.setContent(`<body style="margin:0;background:linear-gradient(160deg,${s.bg},#143A54);height:100vh;display:flex;align-items:center;justify-content:center;font:bold 120px sans-serif;color:#fff">${s.label}</body>`);
    const buf = await page.screenshot({ type: s.type, quality: s.type === 'jpeg' ? 90 : undefined });
    const file = path.join(dir, s.name);
    await writeFile(file, buf);
    out[s.name] = { path: file, sha: sha256(buf), size: buf.length };
  }
  await page.close();
  return { dir, files: out };
}

export function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}

// Alla prima apertura con il diario vuoto l'app mostra il benvenuto: di norma lo si chiude subito
// («Ho capito» / «Inizia») per arrivare in Home; con { welcome: true } lo si lascia aperto.
export async function openApp(context, base, hash = '', { welcome = false } = {}) {
  const page = await context.newPage();
  const errors = watchErrors(page);
  await page.goto(base + hash);
  await page.waitForSelector('.view__inner');
  if (!welcome && await page.locator('[data-action="welcome-start"]').count()) {
    await page.click('[data-action="welcome-start"]');
    await page.waitForFunction(() => !document.querySelector('.welcome') && document.querySelector('.view__inner'));
  }
  return { page, errors };
}

export async function nav(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForFunction((h) => location.hash === h, hash);
  await page.waitForSelector('.view__inner');
  await page.waitForTimeout(50);
}

// Compila e salva il modulo "Nuova uscita". Restituisce l'id dell'uscita creata.
export async function createEntry(page, data = {}) {
  await nav(page, '#/nuova');
  await page.waitForSelector('form.form');
  await fillForm(page, data);
  await page.click('[data-action="save"]');
  await page.waitForURL(/#\/uscita\//, { timeout: 20000 });
  await page.waitForSelector('.memory-page');
  return decodeURIComponent(new URL(page.url()).hash.split('/')[2]);
}

export async function fillForm(page, data) {
  if (data.date !== undefined) await page.fill('input[name="date"]', data.date);
  for (const k of ['title', 'departure', 'destination', 'boatType', 'crew', 'weather', 'wind']) {
    if (data[k] !== undefined) await page.fill(`input[name="${k}"]`, data[k]);
  }
  if (data.notes !== undefined) await page.fill('textarea[name="notes"]', data.notes);
  if (data.rating) await page.click(`[data-star="${data.rating}"]`);
  if (data.favorite) await page.check('input[name="favorite"]');
  if (data.photos?.length) await addPhotos(page, data.photos);
}

export async function addPhotos(page, paths) {
  const before = await page.locator('.photo-tile').count();
  await page.setInputFiles('input[data-file]', paths);
  await page.waitForFunction((n) => document.querySelectorAll('.photo-tile').length === n && !document.querySelector('.photo-tile.is-loading'), before + paths.length, { timeout: 20000 });
}

// Legge direttamente IndexedDB dalla pagina: uscite, foto (con impronta SHA-256 dei byte salvati) e anteprime.
export async function dumpDB(page) {
  return page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('gaias-wake', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const all = (store) => new Promise((res, rej) => {
      const r = db.transaction(store).objectStore(store).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const hex = async (blob) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const entries = await all('entries');
    const photos = [];
    for (const p of await all('photos')) {
      const blob = p.blob instanceof Blob ? p.blob : new Blob([p.buffer]);
      photos.push({ id: p.id, entryId: p.entryId, name: p.name, type: p.type, size: p.size, storedAs: p.blob instanceof Blob ? 'blob' : 'buffer', bytes: blob.size, sha: await hex(blob) });
    }
    const thumbs = (await all('thumbs')).map((t) => t.id);
    db.close();
    return { entries, photos, thumbs };
  });
}

export async function clickButton(page, name) {
  await page.getByRole('button', { name }).click();
}

export async function screenshot(page, name) {
  await mkdir(path.join(OUTPUT, 'screens'), { recursive: true });
  await page.screenshot({ path: path.join(OUTPUT, 'screens', `${name}.png`), fullPage: false });
}
