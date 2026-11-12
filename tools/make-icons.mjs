// Genera le icone PNG a partire da assets/icons/icon.svg.
// Serve solo allo sviluppatore (le PNG sono già incluse nel progetto).
// Uso:  node tools/make-icons.mjs   (richiede Playwright: npm install)

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = path.join(root, 'assets', 'icons');
const svg = await readFile(path.join(iconsDir, 'icon.svg'), 'utf8');

const targets = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
];

// Favicon: la stessa icona con gli angoli arrotondati, senza i dettagli fini (class="dettaglio":
// gabbiani, tratteggio dell'acqua, increspature) che a 16-32 px diventerebbero solo rumore.
const favicon = svg
  .replace(/<g class="dettaglio"[\s\S]*?<\/g>\s*/g, '')
  .replace(/<path class="dettaglio"[^>]*\/>\s*/g, '')
  .replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><clipPath id="r"><rect width="512" height="512" rx="112"/></clipPath></defs><g clip-path="url(#r)">')
  .replace('</svg>', '</g></svg>');
await writeFile(path.join(iconsDir, 'favicon.svg'), favicon);

// Con CHROMIUM_PATH si usa un Chrome/Edge già installato (come nei test).
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
for (const [name, size] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(iconsDir, name), clip: { x: 0, y: 0, width: size, height: size } });
  console.log('creata', name);
}
await browser.close();
