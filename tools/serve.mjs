// Piccolo server statico per provare l'app sul computer (nessuna dipendenza).
// Uso:  node tools/serve.mjs  [porta]      poi apri http://localhost:8080
// Su http://localhost il service worker funziona come su https.

import http from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

// Cartelle dello sviluppo che non fanno parte dell'app pubblicata.
const PRIVATE = ['node_modules', 'tests', 'tools', '.git'];

// `root` può essere una funzione: i test la usano per simulare la pubblicazione di una nuova versione.
export function createHandler({ root: rootOption = ROOT, log = false } = {}) {
  return async (req, res) => {
    try {
      const root = typeof rootOption === 'function' ? rootOption() : rootOption;
      const url = new URL(req.url, 'http://localhost');
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.normalize(path.join(root, rel));
      const first = path.relative(root, file).split(path.sep)[0];
      if (!file.startsWith(root) || PRIVATE.includes(first)) {
        res.writeHead(404).end('Non trovato');
        return;
      }
      const info = await stat(file).catch(() => null);
      if (!info || !info.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Non trovato');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
      if (log) console.log(req.method, url.pathname);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  };
}

export function createServer(options) {
  return http.createServer(createHandler(options));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2]) || 8080;
  createServer({ log: false }).listen(port, () => {
    console.log(`Gaia's Wake è in esecuzione su http://localhost:${port}`);
    console.log('Premi Ctrl+C per fermare il server.');
  });
}
