// Disegna la mappa illustrata del Lago di Como della Home: inchiostro blu e acquerello azzurro
// su fondo trasparente (la carta la dipinge l'app). Usa la stessa geometria dell'app (js/lake-map.js),
// così i punti delle uscite cadono esattamente sul disegno. Nessuna scritta: nomi e punti li disegna l'app.
// Scrive tools/illustrations/lake-map.svg e la rasterizza in assets/illustrations/lake-map.webp (1200x1960).
// Uso:  node tools/build-map.mjs   (richiede Playwright: npm install). Il risultato è sempre lo stesso.

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { SHORE, ISLAND, PLACES, VIEW, FRAME, smoothPath, toView, inLake } from '../js/lake-map.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svgFile = path.join(root, 'tools', 'illustrations', 'lake-map.svg');
const webpFile = path.join(root, 'assets', 'illustrations', 'lake-map.webp');

const W = VIEW.w, H = VIEW.h;
const KM = W / FRAME.w; // 40 unità per km
const PX = W / 390; // unità per pixel CSS (sul telefono la mappa è larga 390 px)

// Palette: solo blu, azzurri e bianco.
const INK = '#24467E', INK2 = '#2F4F8C', INK3 = '#3B63A3', INKL = '#7E9CCB';
const WASH1 = '#E3EAF5', WASH2 = '#D3E0F1', WASH3 = '#C2D4EC', WASH4 = '#A9C1E2', WHITE = '#FFFFFF';

// ---------- casualità con seme fisso e rumore ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261023);
const R = (a, b) => a + (b - a) * rnd();
function hash2(ix, iy, s) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const f1 = (n) => { const r = Math.round(n * 10) / 10; return Object.is(r, -0) ? '0' : String(r); };
const P = (p) => `${f1(p[0])} ${f1(p[1])}`;
const polyD = (arr) => arr.map((pl) => `M${pl.map(P).join('L')}`).join('');

// ---------- geometria del lago (identica a quella dell'app) ----------
const SHORE_D = smoothPath(SHORE);
const ISLAND_D = smoothPath(ISLAND);
const LAKE_D = `${SHORE_D}${ISLAND_D}`;

// Campiona il percorso di smoothPath (M + curve cubiche) in una polilinea fitta.
function samplePath(d, step = 1) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  let x0 = nums[0], y0 = nums[1];
  const pts = [[x0, y0]];
  for (let i = 2; i + 5 < nums.length; i += 6) {
    const [ax, ay, bx, by, x, y] = nums.slice(i, i + 6);
    const len = Math.hypot(ax - x0, ay - y0) + Math.hypot(bx - ax, by - ay) + Math.hypot(x - bx, y - by);
    const n = Math.max(3, Math.ceil(len / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n, m = 1 - t;
      pts.push([m * m * m * x0 + 3 * m * m * t * ax + 3 * m * t * t * bx + t * t * t * x, m * m * m * y0 + 3 * m * m * t * ay + 3 * m * t * t * by + t * t * t * y]);
    }
    x0 = x; y0 = y;
  }
  return pts;
}
const shorePts = samplePath(SHORE_D);
const islandPts = samplePath(ISLAND_D);

// Acqua rasterizzata (1 unità) e distanze dalla riva (trasformata di distanza euclidea).
const water = new Uint8Array(W * H);
function fillPoly(poly, val) {
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > yc) !== (yj > yc)) xs.push(xi + ((yc - yi) / (yj - yi)) * (xj - xi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k] - 0.5)), b = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = a; x <= b; x++) water[y * W + x] = val;
    }
  }
}
fillPoly(shorePts, 1);
fillPoly(islandPts, 0);
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
function edt(isFeature) {
  const g = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = isFeature(i) ? 0 : 1e12;
  const mx = Math.max(W, H);
  const f = new Float64Array(mx), d = new Float64Array(mx), v = new Int32Array(mx), z = new Float64Array(mx + 1);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = g[y * W + x];
    edt1d(f, H, d, v, z);
    for (let y = 0; y < H; y++) g[y * W + x] = d[y];
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = g[y * W + x];
    edt1d(f, W, d, v, z);
    for (let x = 0; x < W; x++) g[y * W + x] = Math.sqrt(d[x]);
  }
  return g;
}
const dWater = edt((i) => water[i] === 0); // in acqua: distanza dalla terra
const dLand = edt((i) => water[i] === 1); // a terra: distanza dall'acqua
const at = (g, x, y) => g[clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1)];
const isWater = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  return xi >= 0 && yi >= 0 && xi < W && yi < H && water[yi * W + xi] === 1;
};
// Direzione che si allontana dalla riva più vicina.
function shoreNormal(x, y) {
  const gx = at(dWater, x + 3, y) - at(dWater, x - 3, y), gy = at(dWater, x, y + 3) - at(dWater, x, y - 3);
  const l = Math.hypot(gx, gy) || 1;
  return [gx / l, gy / l];
}
// Mezza larghezza locale del lago: il tratteggio non arriva mai al centro dei rami.
const CELL = 10, CW = Math.ceil(W / CELL), CH = Math.ceil(H / CELL);
const halfW = new Float32Array(CW * CH);
{
  const cellMax = new Float32Array(CW * CH);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = Math.floor(y / CELL) * CW + Math.floor(x / CELL);
    if (dWater[y * W + x] > cellMax[c]) cellMax[c] = dWater[y * W + x];
  }
  const RAD = 7;
  for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
    let m = 0;
    for (let dy = -RAD; dy <= RAD; dy++) for (let dx = -RAD; dx <= RAD; dx++) {
      const xx = cx + dx, yy = cy + dy;
      if (dx * dx + dy * dy <= RAD * RAD && xx >= 0 && yy >= 0 && xx < CW && yy < CH) m = Math.max(m, cellMax[yy * CW + xx]);
    }
    halfW[cy * CW + cx] = m;
  }
}
function localHalf(x, y) {
  const gx = clamp(x / CELL - 0.5, 0, CW - 1.001), gy = clamp(y / CELL - 0.5, 0, CH - 1.001);
  const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
  const a = halfW[iy * CW + ix], b = halfW[iy * CW + ix + 1], c = halfW[(iy + 1) * CW + ix], d = halfW[(iy + 1) * CW + ix + 1];
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

// ---------- spazi liberi: titolo, pulsanti, scritta del lago, nomi e punti di tutti i paesi ----------
const TITLE = [0, 0, 720, 470];
const BUTTON = [980, 0, 1200, 200];
const NAME = { c: toView(14.4, 37.4), rx: 215, ry: 54 }; // «Lago di Como» scritto dall'app
const BOXES = []; // [x0, y0, x1, y1, punto di un paese minore (c'è solo se Gaia ci è andata)]
for (const p of PLACES) {
  const [x, y] = toView(p.x, p.y);
  // Etichetta: 13.5 px in corsivo, ~6.6 px a lettera, alone compreso. Per i monti dei paesi minori basta l'inizio del nome.
  const label = (tw) => (p.side === 'l' ? [x - 14 * PX - tw, y - 12 * PX, x - 10 * PX, y + 8 * PX]
    : p.side === 'r' ? [x + 10 * PX, y - 12 * PX, x + 14 * PX + tw, y + 8 * PX]
      : [x - tw / 2, y + 8 * PX, x + tw / 2, y + 28 * PX]);
  const tw = (p.name.length * 6.6 + 6) * PX;
  BOXES.push([...label(p.main ? tw : Math.min(tw, 230)), false]);
  BOXES.push([x - 48, y - 105, x + 48, y + 14, !p.main]); // il punto (goccia)
}
const DISCS = []; // [x, y, raggio]: rosa dei venti, cipressi, uccelli
const OBJS = []; // [x0, y0, x1, y1, gruppo]: montagne già messe
let cluster = -1; // gruppo che si sta disegnando
const inName = (x, y, pad = 0) => ((x - NAME.c[0]) / (NAME.rx + pad)) ** 2 + ((y - NAME.c[1]) / (NAME.ry + pad)) ** 2 < 1;
function blocked(x, y, pad = 0, minorPins = true) {
  if (x < TITLE[2] + pad && y < TITLE[3] + pad) return true;
  if (x > BUTTON[0] - pad && y < BUTTON[3] + pad) return true;
  if (inName(x, y, pad)) return true;
  for (const b of BOXES) if ((minorPins || !b[4]) && x > b[0] - pad && x < b[2] + pad && y > b[1] - pad && y < b[3] + pad) return true;
  for (const c of DISCS) if (Math.hypot(x - c[0], y - c[1]) < c[2] + pad) return true;
  return false;
}
const warnings = [];

// ---------- ROSA DEI VENTI: nel Triangolo Lariano, sotto il nome di Mandello e sopra la scritta del lago ----------
const ROSE_R = 68;
const ROSE = (() => {
  const [cx, cy] = toView(13.65, 33.85);
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2, x = cx + (ROSE_R + 10) * Math.sin(a), y = cy - (ROSE_R + 10) * Math.cos(a);
    if (isWater(x, y) || at(dLand, x, y) < 24 || inName(x, y, 8)) { warnings.push('rosa dei venti troppo vicina all\'acqua o alla scritta'); break; }
  }
  return { cx, cy };
})();
DISCS.push([ROSE.cx, ROSE.cy, ROSE_R + 16], [ROSE.cx, ROSE.cy - ROSE_R - 16, 18]);

// ---------- GOMMONE: al centro del lago davanti a Dervio ----------
const BOAT_C = toView(18.4, 15.2);
const BS = 1.12; // scala: scafo + motore ~85 unità
const boat = { ox: BOAT_C[0] - 31 * BS, oy: BOAT_C[1] + 5 };
const boatKO = { cx: boat.ox + 8 * BS, cy: boat.oy - 6, rx: 66 * BS, ry: 19 * BS }; // niente tratteggio attorno
const inBoat = (x, y, pad = 0) => ((x - boatKO.cx) / (boatKO.rx + pad)) ** 2 + ((y - boatKO.cy) / (boatKO.ry + pad)) ** 2 < 1;
{
  let a = 0, b = W;
  for (let x = BOAT_C[0]; x > 0; x--) if (!isWater(x, boat.oy)) { a = x; break; }
  for (let x = BOAT_C[0]; x < W; x++) if (!isWater(x, boat.oy)) { b = x; break; }
  const bow = boat.ox + 71 * BS, stern = boat.ox - 8 * BS;
  if (bow > b - 6 || stern < a + 6) warnings.push(`gommone stretto: acqua ${f1(a)}..${f1(b)}, barca ${f1(stern)}..${f1(bow)}`);
}

// ---------- CIPRESSI: pochi, sottili, incisi, vicino alla riva ----------
const cypresses = [];
{
  const spots = [
    { at: [20.75, 24.3], hs: [44, 56, 38] }, // sponda est sopra Fiumelatte
    { at: [5.85, 31.0], hs: [50, 40] }, // Brienno
    { at: [20.6, 28.2], hs: [40, 50] }, // Lierna
  ];
  for (const s of spots) {
    const [sx, sy] = toView(...s.at);
    const totalW = s.hs.reduce((t, h) => t + h * 0.3, 0);
    let best = null;
    for (let r = 0; r <= 60 && !best; r += 4) for (let k = 0; k < 16 && !best; k++) {
      const x = sx + r * Math.cos((k / 16) * Math.PI * 2), y = sy + r * Math.sin((k / 16) * Math.PI * 2);
      let ok = true;
      s.hs.forEach((h, i) => {
        const bx = x - totalW / 2 + i * h * 0.3;
        for (const yy of [y, y - h * 0.5, y - h]) {
          const dl = at(dLand, bx, yy);
          if (isWater(bx, yy) || dl < 9 || blocked(bx, yy, 6, false)) ok = false;
        }
        if (at(dLand, bx, y) > 44) ok = false;
      });
      if (ok) best = [x, y];
    }
    if (!best) { warnings.push(`cipressi ${s.at} senza posto`); continue; }
    s.hs.forEach((h, i) => cypresses.push({ x: best[0] - totalW / 2 + i * h * 0.3 + R(-1, 1), y: best[1] + (i % 2) * 2.5, h }));
    DISCS.push([best[0], best[1] - 22, totalW / 2 + 26]);
  }
}

// ---------- RILIEVO: pochi gruppi radi, incisi e velati d'acquerello ----------
const CLUSTERS = [
  // ovest dell'alto lago: Bregagno e Pizzo di Gino (grandi), Galbiga, colline della Val Menaggio
  { at: [5.0, 13.4], n: 3, w: [160, 195], hr: [0.46, 0.56], alp: true },
  { at: [0.8, 18.6], n: 3, w: [125, 150], hr: [0.42, 0.52], alp: true },
  { at: [7.4, 20.9], n: 2, w: [84, 104], hr: [0.38, 0.46] },
  { at: [0.4, 24.2], n: 2, w: [76, 94], hr: [0.36, 0.44] },
  // ovest del ramo di Como: Valle d'Intelvi e Generoso, Bisbino
  { at: [0.3, 31.3], n: 2, w: [112, 138], hr: [0.42, 0.5], alp: true },
  { at: [0.2, 35.7], n: 1, w: [86, 106], hr: [0.38, 0.46] },
  // Triangolo Lariano: Corni di Canzo (il resto è spazio per i nomi, la rosa dei venti e la scritta del lago)
  { at: [17.6, 35.6], n: 2, w: [74, 92], hr: [0.36, 0.44], stack: true },
  // Brianza: colline basse e chiare
  { at: [10.6, 41.6], n: 2, w: [62, 78], hr: [0.28, 0.34], far: true },
  { at: [19.6, 41.4], n: 2, w: [62, 78], hr: [0.28, 0.34], far: true },
  // est: Legnone (grande), Muggio, Grigne (grandi), Moregallo; possono uscire dal bordo destro
  { at: [27.4, 11.0], n: 2, w: [165, 200], hr: [0.5, 0.6], alp: true },
  { at: [26.4, 19.0], n: 2, w: [115, 140], hr: [0.42, 0.52] },
  { at: [25.8, 26.2], n: 1, w: [160, 185], hr: [0.52, 0.6], alp: true },
  { at: [25.8, 30.8], n: 2, w: [150, 180], hr: [0.48, 0.58], alp: true },
  { at: [27.4, 34.8], n: 1, w: [90, 110], hr: [0.42, 0.5] },
];
const MARGIN = 45; // distanza minima dall'acqua (≥ 0.8 km dai picchi)
function footprintOK(cx, by, w, h) {
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 5; j++) {
    const x = cx - w / 2 + (w * i) / 10, y = by - h * 1.2 + ((h * 1.2 + 8) * j) / 5;
    if (x < -w * 0.3 || x > W + w * 0.3 || y < 8 || y > 1812) return false; // può uscire un po' dal bordo
    if (x < 0 || x > W) continue;
    if (isWater(x, y) || at(dLand, x, y) < MARGIN || blocked(x, y, 4, false)) return false;
    if (inLake(x / KM + FRAME.x0, y / KM + FRAME.y0)) return false;
  }
  // niente sovrapposizioni tra gruppi diversi: corridoi di carta tra un massiccio e l'altro
  return !OBJS.some((o) => o[4] !== cluster && !(cx + w / 2 < o[0] || cx - w / 2 > o[2] || by < o[1] || by - h * 1.2 > o[3]));
}
const mountains = [];
CLUSTERS.forEach((cl, ci) => {
  const [cx0, cy0] = toView(...cl.at);
  const order = cl.stack ? [[0, -0.55], [0.14, 0.55]] : [[0, -0.25], [-0.44, 0.3], [0.44, 0.32]];
  cluster = ci;
  for (let k = 0; k < cl.n; k++) {
    const w0 = R(cl.w[0], cl.w[1]) * (k === 0 ? 1 : R(0.64, 0.78));
    const hr = R(cl.hr[0], cl.hr[1]);
    const [ox, oy] = order[k % order.length];
    const cx = cx0 + ox * R(cl.w[0], cl.w[1]) + R(-5, 5);
    const by = cy0 + oy * cl.w[0] * cl.hr[0] * (cl.stack ? 2.2 : 1.1) + R(-3, 3);
    let placed = false;
    for (const sc of [1, 0.88, 0.78, 0.68]) {
      for (const [dx, dy] of [[0, 0], [-24, 0], [24, 0], [0, -16], [-46, 0], [46, 0], [0, 14], [-24, -16], [24, -16]]) {
        const w = w0 * sc, h = w * hr;
        if (w < 48) continue;
        if (footprintOK(cx + dx, by + dy, w, h)) {
          mountains.push({ x: cx + dx, y: by + dy, w, h, seed: Math.floor(rnd() * 1e6), alp: !!cl.alp, far: !!cl.far });
          OBJS.push([cx + dx - w / 2, by + dy - h * 1.2, cx + dx + w / 2, by + dy, ci]);
          placed = true; break;
        }
      }
      if (placed) break;
    }
    if (!placed) warnings.push(`montagna ${ci}.${k} non trova posto`);
  }
});
mountains.sort((a, b) => a.y - b.y); // prima quelle dietro (a nord)

// Profilo di cresta irregolare con 1–3 cime (incisione).
function ridgeProfile(m) {
  const r = mulberry32(m.seed);
  const nPk = m.w > 130 ? 3 : m.w > 82 ? 2 : (r() < 0.55 ? 1 : 2);
  const peaks = [];
  const main = Math.floor(r() * nPk);
  for (let i = 0; i < nPk; i++) {
    const u = nPk === 1 ? (r() - 0.5) * 0.12 : -0.22 + (0.44 * i) / (nPk - 1) + (r() - 0.5) * 0.08;
    const hh = i === main ? 1 : 0.58 + r() * 0.22;
    const half = (nPk === 1 ? 0.5 : 0.32 + r() * 0.08) * (i === main ? 1.1 : 0.9);
    peaks.push({ u, hh, half, q: m.alp ? 1.35 + r() * 0.3 : 1.15 + r() * 0.25, round: m.alp ? 0.004 : 0.02 });
  }
  const height = (u) => {
    let v = 0;
    for (const pk of peaks) {
      let s = (u - pk.u) / pk.half; s = s > 0 ? s * 1.1 : s * 0.93; // versante est un po' più ripido
      const a = Math.sqrt(s * s + pk.round) - Math.sqrt(pk.round);
      if (a < 1) v = Math.max(v, pk.hh * Math.pow(1 - a, pk.q));
    }
    const e = clamp((0.5 - Math.abs(u)) / 0.17, 0, 1);
    return v * e * e * (3 - 2 * e);
  };
  const pts = [], N = 72;
  for (let i = 0; i <= N; i++) {
    const u = -0.5 + i / N, h0 = height(u);
    const rough = ((vnoise(i / 2.6, m.seed % 997, 13) - 0.5) * 0.06 + (vnoise(i / 0.9, m.seed % 991, 17) - 0.5) * 0.025) * (m.alp ? 1.5 : 1);
    pts.push([m.x + u * m.w, m.y - Math.max(0, h0 > 0.05 ? h0 + rough * Math.min(1, h0 * 3) : h0) * m.h]);
  }
  let a = 0; while (a < pts.length - 2 && m.y - pts[a + 1][1] < 0.6) a++;
  let b = pts.length - 1; while (b > 1 && m.y - pts[b - 1][1] < 0.6) b--;
  return pts.slice(a, b + 1);
}
function ridgeYAt(pts, x) {
  if (x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / Math.max(1e-6, x1 - x0);
  }
  return null;
}
mountains.forEach((m) => { m.ridge = ridgeProfile(m); m.tier = m.far ? 'far' : m.w > 120 ? 'big' : 'mid'; });
// Linee nascoste: una montagna più a sud (davanti) copre quella dietro. Calcolato, non mascherato.
function hiddenBy(i, x, y) {
  const m = mountains[i];
  for (let j = i + 1; j < mountains.length; j++) {
    const f = mountains[j];
    if (f.y <= m.y + 0.5 || x < f.x - f.w / 2 || x > f.x + f.w / 2) continue;
    const ry = ridgeYAt(f.ridge, x);
    if (ry != null && y > ry - 1.6 && y < f.y + 4) return true;
  }
  return false;
}
const strokes = {};
for (const t of ['big', 'mid', 'far']) strokes[t] = { ridge: [], shade: [], lit: [], back: [], foot: [] };
function addStroke(kind, i, poly) {
  let run = [];
  const out = strokes[mountains[i].tier][kind];
  const push = () => { if (run.length > 1) out.push(run); run = []; };
  for (const p of poly) { if (hiddenBy(i, p[0], p[1])) push(); else run.push(p); }
  push();
}
const quadPts = (a, c, b, n = 6) => Array.from({ length: n + 1 }, (_, k) => {
  const t = k / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
});
function densify(poly, step = 2) {
  const out = [poly[0]];
  for (let i = 1; i < poly.length; i++) {
    const [x0, y0] = poly[i - 1], [x1, y1] = poly[i], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}
mountains.forEach((m, i) => {
  const r = mulberry32(m.seed + 7);
  const pts = m.ridge;
  addStroke('ridge', i, densify(pts, 2.5));
  // cresta di fondo più chiara, solo dove spunta sopra la propria
  if (m.w > 92 && !m.far) {
    const bk = pts.map(([x, y]) => [m.x + (x - m.x) * 0.8 - m.w * 0.13, m.y - (m.y - y) * 1.14 - 3]).filter(([x]) => x > m.x - m.w * 0.5);
    let run = [];
    for (const p of densify(bk, 2.5)) {
      const own = ridgeYAt(pts, p[0]);
      if ((own == null || p[1] < own - 2.5) && !hiddenBy(i, p[0], p[1])) run.push(p);
      else { if (run.length > 2) strokes[m.tier].back.push(run); run = []; }
    }
    if (run.length > 2) strokes[m.tier].back.push(run);
  }
  // tratteggio: lunghe linee di caduta sui versanti est (in ombra), pochi tocchi su quelli in luce
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
  const stepH = m.far ? 3.6 : 2.6;
  for (let x = x0 + 1.5; x < x1 - 1; x += stepH * (0.9 + r() * 0.2)) {
    const yr = ridgeYAt(pts, x); if (yr == null) continue;
    const drop = m.y - yr; if (drop < 2.5) continue;
    const ya = ridgeYAt(pts, Math.max(x0, x - 3)), yb = ridgeYAt(pts, Math.min(x1, x + 3));
    const slope = (yb - ya) / 6;
    if (slope > 0.08) {
      const sh = clamp(0.3 + 0.5 * slope, 0, 1);
      const len = drop * (0.3 + 0.6 * sh) * (0.8 + 0.3 * r());
      const lean = len * (0.06 + 0.1 * sh);
      addStroke('shade', i, quadPts([x, yr + 0.8], [x + lean * 0.15, yr + len * 0.5], [x + lean, Math.min(yr + len, m.y - 0.4)]));
    } else if (slope < -0.12 && r() < 0.3) {
      const len = drop * (0.12 + 0.2 * r());
      if (len > 2.5) addStroke('lit', i, [[x, yr + 2.4], [x + len * 0.08, yr + 2.4 + len]]);
    }
  }
  // piccoli tratti di terreno al piede: la montagna appoggia a terra
  for (let k = 0; k < 3; k++) {
    const x = m.x + (r() - 0.5) * m.w * 0.85, len = 6 + r() * 16, y = m.y + 2 + r() * 3.5;
    addStroke('foot', i, [[x - len / 2, y], [x + len / 2, y]]);
  }
  m.sil = `M${P([pts[0][0], m.y])}L${pts.map(P).join('L')}L${P([pts[pts.length - 1][0], m.y])}Z`;
  m.box = [x0, Math.min(...pts.map((p) => p[1])), x1, m.y];
});

// ---------- UCCELLI: un piccolo stormo nel cielo sopra i monti a ovest (come nella stampa di riferimento) ----------
const birds = [];
{
  const spec = [[0, 0, 22], [30, -14, 17], [52, 6, 14], [22, 22, 12]];
  let best = null;
  for (let y = 530; y <= 600 && !best; y += 6) for (let x = 360; x <= 600 && !best; x += 8) {
    const ok = spec.every(([dx, dy, w]) => !blocked(x + dx, y + dy, 10) && !blocked(x + dx + w, y + dy, 10)
      && !mountains.some((m) => x + dx + w > m.box[0] - 12 && x + dx < m.box[2] + 12 && y + dy > m.box[1] - 26 && y + dy < m.box[3]));
    if (ok) best = [x, y];
  }
  if (best) {
    spec.forEach(([dx, dy, w], i) => {
      const x = best[0] + dx, y = best[1] + dy, h = w * 0.4, t = (i % 2 ? 1 : -1) * 0.7;
      birds.push(`M${f1(x - w / 2)} ${f1(y - h * 0.4 + t)}Q${f1(x - w * 0.22)} ${f1(y - h)} ${f1(x)} ${f1(y)}Q${f1(x + w * 0.24)} ${f1(y - h * 1.05)} ${f1(x + w / 2)} ${f1(y - h * 0.5 - t)}`);
    });
  } else warnings.push('uccelli senza posto');
}

// ---------- ACQUA: incisione orizzontale lungo le rive, centro dei rami sempre chiaro ----------
const SP = 6.6; // passo delle righe (~2.1 px sul telefono)
const hatch = { a: [], b: [] };
let nHatch = 0;
{
  const yTop = Math.min(...shorePts.map((p) => p[1])), yBot = Math.min(1915, Math.max(...shorePts.map((p) => p[1])));
  let line = 0;
  for (let y0 = yTop + 2.2; y0 < yBot; y0 += SP, line++) {
    const y = y0 + (hash2(line, 1, 5) - 0.5) * 0.9;
    let run = null, lastCut = 0;
    const flush = (xe) => {
      if (run && xe - run.x0 >= 1.5) { hatch[run.c].push(`M${f1(run.x0)} ${f1(y)}h${f1(xe - run.x0)}`); nHatch++; }
      run = null;
    };
    for (let x = 0.5; x < W; x += 1) {
      let c = null;
      if (isWater(x, y) && !inBoat(x, y)) {
        const d = at(dWater, x, y);
        if (d > 1.7) {
          const [gx] = shoreNormal(x, y);
          const shade = clamp(0.5 + 0.6 * gx, 0, 1); // rive a ovest: lato in ombra, righe più lunghe
          const n = vnoise(x / 70, line * 0.09, 3); // gruppi di righe più lunghe o più corte
          const jit = 0.62 + 0.76 * hash2(line, gx > 0 ? 1 : 2, 6); // ogni riga finisce in un punto diverso
          let reach = (14 + 26 * shade) * (0.42 + 1.4 * n * n) * jit;
          reach = Math.max(4, Math.min(reach, 0.6 * localHalf(x, y), 40));
          const t = d / reach;
          if (t < 0.58) c = t < 0.34 ? 'a' : 'b';
          else if (t < 1.1) { if (vnoise(x / 4.2, line * 1.37, 9) > 0.25 + (0.6 * (t - 0.58)) / 0.52) c = 'b'; }
          else if (t < 1.7 && vnoise(x / 6, line * 0.91, 19) > 0.9) c = 'b'; // qualche trattino isolato
        }
      }
      if (run && run.c !== c) flush(x);
      if (c && !run) run = { x0: x, c };
      // righe lunghe (rive quasi orizzontali): piccole interruzioni, come nel bulino
      if (run && x - run.x0 > 46 && x - lastCut > 46 && hash2(Math.round(x), line, 13) < 0.05) { flush(x); lastCut = x; x += 2 + Math.floor(hash2(line, Math.round(x), 4) * 3); }
    }
    flush(W);
  }
}
// Riflessi bianchi che tagliano il tratteggio, luci e increspature nell'acqua aperta.
const glints = [], lights = [], ripples = [];
{
  const gr = mulberry32(4242);
  for (let k = 0; k < 8000 && glints.length < 16; k++) {
    const x = 80 + gr() * 1080, y = 280 + gr() * 1520, len = 10 + gr() * 14;
    const xs = [x - len / 2, x, x + len / 2];
    if (!xs.every((xx) => isWater(xx, y) && !inBoat(xx, y, 10))) continue;
    const ds = xs.map((xx) => at(dWater, xx, y));
    if (Math.min(...ds) < 5 || Math.max(...ds) > 20) continue;
    if (glints.some((g) => Math.abs(g[1] - y) < 70 && Math.abs(g[0] - x) < 140)) continue;
    glints.push([x, y, len]);
  }
  for (let k = 0; k < 8000 && lights.length < 14; k++) {
    const x = 80 + gr() * 1080, y = 280 + gr() * 1520, d0 = at(dWater, x, y);
    if (!isWater(x, y) || d0 < 24 || inBoat(x, y, 30)) continue;
    if (lights.some(([a, b]) => Math.hypot(a - x, b - y) < 150)) continue;
    const len = Math.min(d0 * 1.3, 18 + gr() * 24);
    lights.push([x, y, `M${f1(x - len / 2)} ${f1(y)}h${f1(len)}${gr() < 0.7 ? `M${f1(x - len * 0.2)} ${f1(y + 5)}h${f1(len * 0.5)}` : ''}`]);
  }
  for (let k = 0; k < 8000 && ripples.length < 18; k++) {
    const x = 80 + gr() * 1080, y = 280 + gr() * 1520, d0 = at(dWater, x, y);
    if (!isWater(x, y) || d0 < 18 || inBoat(x, y, 30)) continue;
    if (ripples.some(([a, b]) => Math.hypot(a - x, (b - y) * 1.6) < 80) || lights.some(([a, b]) => Math.hypot(a - x, b - y) < 40)) continue;
    const len = 9 + gr() * 12, two = gr() < 0.5;
    let d = `M${f1(x)} ${f1(y)}q${f1(len / 4)} -1.5 ${f1(len / 2)} 0t${f1(len / 2)} 0`;
    if (two) d += `M${f1(x + 3)} ${f1(y + 4.5)}q${f1(len / 6)} -1.2 ${f1(len / 3)} 0t${f1(len / 3)} 0`;
    ripples.push([x, y, d]);
  }
}
// Velature morbide in orizzontale: l'acqua sembra dipinta, non piatta.
const streaks = [];
{
  const sr = mulberry32(515);
  for (let k = 0; k < 3000 && streaks.length < 26; k++) {
    const x = 60 + sr() * 1100, y = 250 + sr() * 1620;
    if (!isWater(x, y) || at(dWater, x, y) < 10) continue;
    const len = 40 + sr() * 110;
    streaks.push(`M${f1(x - len / 2)} ${f1(y)}q${f1(len / 2)} ${f1((sr() - 0.5) * 6)} ${f1(len)} ${f1((sr() - 0.5) * 4)}`);
  }
}

// ---------- disegni: rosa dei venti, gommone, cipressi ----------
function windRose(cx, cy, R0) {
  const out = [];
  const pt = (a, r) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r];
  out.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${R0}" fill="none" stroke="${INK}" stroke-width="1.4"/>`);
  out.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${R0 - 7}" fill="none" stroke="${INK}" stroke-width=".8"/>`);
  out.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(R0 * 0.36)}" fill="none" stroke="${INKL}" stroke-width=".8"/>`);
  let ticks = '';
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, long = i % 9 === 0;
    ticks += `M${P(pt(a, R0 - 7))}L${P(pt(a, long ? R0 + 0.5 : R0 - 3))}`;
  }
  out.push(`<path d="${ticks}" stroke="${INK}" stroke-width=".8" fill="none"/>`);
  let rays = '';
  for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2 + Math.PI / 32; rays += `M${P(pt(a, R0 * 0.38))}L${P(pt(a, R0 - 8))}`; }
  out.push(`<path d="${rays}" stroke="${INKL}" stroke-width=".65" fill="none"/>`);
  // punte: metà piena d'inchiostro, metà tratteggiata
  const star = (a, len, half) => {
    const tip = pt(a, len), l = pt(a - Math.PI / 2, half), rr = pt(a + Math.PI / 2, half), c = [cx, cy];
    let h = '';
    const n = Math.max(4, Math.round(len / 4));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      h += `M${P([lerp(c[0], tip[0], t), lerp(c[1], tip[1], t)])}L${P([lerp(l[0], tip[0], t), lerp(l[1], tip[1], t)])}`;
    }
    return `<path d="M${P(c)}L${P(tip)}L${P(rr)}Z" fill="${INK}"/><path d="M${P(c)}L${P(l)}L${P(tip)}Z" fill="${WASH1}"/>`
      + `<path d="${h}" stroke="${INK3}" stroke-width=".65" fill="none"/>`
      + `<path d="M${P(c)}L${P(l)}L${P(tip)}L${P(rr)}Z" fill="none" stroke="${INK}" stroke-width=".9" stroke-linejoin="miter"/>`;
  };
  for (let i = 0; i < 4; i++) out.push(star((i * Math.PI) / 2 + Math.PI / 4, R0 * 0.6, R0 * 0.085));
  for (let i = 0; i < 4; i++) out.push(star((i * Math.PI) / 2, i === 0 ? R0 * 0.98 : R0 * 0.9, R0 * 0.13));
  out.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="3.4" fill="${WHITE}" stroke="${INK}" stroke-width="1"/>`);
  // giglio del nord (un segno, non una lettera)
  out.push(`<g transform="translate(${f1(cx)} ${f1(cy - R0 - 14)}) scale(1.15)" fill="${INK}">`
    + '<path d="M0 -10C3 -6 3.2 -1 0 3C-3.2 -1 -3 -6 0 -10Z"/>'
    + '<path d="M1.2 2.6C2.6 -2.6 8.6 -4.2 8.6 0C8.6 2.2 6.6 3.2 5.2 2.1C6.3 0.4 4.6 -1 2.6 3.2Z"/>'
    + '<path d="M-1.2 2.6C-2.6 -2.6 -8.6 -4.2 -8.6 0C-8.6 2.2 -6.6 3.2 -5.2 2.1C-6.3 0.4 -4.6 -1 -2.6 3.2Z"/>'
    + '<path d="M-4.6 3.1H4.6V4.8H-4.6Z"/><path d="M-1.6 4.8H1.6L0 9.5Z"/></g>');
  return out.join('');
}

// Gommone con fuoribordo e pilota, visto di fianco, prua a destra; scia tratteggiata dietro.
function gommone(ox, oy, s) {
  const g = [`<g transform="translate(${f1(ox)} ${f1(oy)}) scale(${s})" stroke-linejoin="round" stroke-linecap="round">`];
  const wr = mulberry32(77);
  let wd = '';
  for (const [x0, y0, len] of [[-9, 0.6, 44], [-11, 3.2, 38], [-7, 5.8, 30], [-13, -1.6, 22], [-10, 8.4, 20], [-16, 11, 13]]) {
    let x = x0, on = true;
    while (x > x0 - len) { const seg = on ? Math.min(6 + wr() * 8, x - (x0 - len)) : 2 + wr() * 2; if (on) wd += `M${f1(x)} ${f1(y0)}h${f1(-seg)}`; x -= seg; on = !on; }
  }
  g.push(`<path d="${wd}" stroke="${INK2}" stroke-width=".95" fill="none"/>`);
  g.push(`<path d="M2 2.6h52M8 5.2h38M14 7.8h22" stroke="${INK3}" stroke-width=".8" fill="none"/>`);
  g.push(`<path d="M-4 -0.6q-4 -3 -8 -0.4q-3 -2.4 -7 0.2M-3 1.6q-5 -2 -10 0.6" stroke="${WHITE}" stroke-width="1.9" fill="none"/>`);
  g.push(`<path d="M-5 -1.4q-3.5 -2.6 -7 -0.4M66 -2q3 -1 5 1.6M64 0.8q4 -0.6 7 2" stroke="${INK2}" stroke-width=".75" fill="none"/>`);
  g.push(`<path d="M5 -1.2L52 -1.2L44 1.2L8 1.2Z" fill="${INK}"/>`);
  g.push(`<path d="M6 -1C1.5 -1 1.5 -9.6 6 -9.6L44 -9.6C53 -9.6 59 -12.5 63.5 -17C65.6 -19.2 69 -16.5 66.6 -13.4C61.5 -6.5 54 -1 44 -1Z" fill="${WASH3}" stroke="${INK}" stroke-width="1.25"/>`);
  g.push(`<path d="M7 -5.2L44 -5.2C52 -5.2 58 -8.4 62.5 -13" fill="none" stroke="${INK2}" stroke-width=".65"/>`);
  g.push(`<path d="M18 -9.4V-1.2M33 -9.4V-1.2" fill="none" stroke="${INK2}" stroke-width=".55"/>`);
  g.push(`<path d="M28 -9.6V-15.5L35.5 -16.8L38.5 -9.6Z" fill="${WHITE}" stroke="${INK}" stroke-width=".95"/>`);
  g.push(`<path d="M31.5 -16L34 -20.5L37 -20.8" fill="none" stroke="${INK}" stroke-width=".85"/>`);
  g.push(`<path d="M17 -9.6V-12.6H24V-9.6" fill="${WASH4}" stroke="${INK}" stroke-width=".85"/>`);
  g.push(`<path d="M26.6 -9.8L27.2 -17.4" stroke="${INK}" stroke-width="2.1"/><circle cx="27.5" cy="-20" r="2.4" fill="${INK}"/>`);
  g.push(`<path d="M-1.8 -8.6L-1.4 3L0.8 3L1 -8.6Z" fill="${INK}"/>`);
  g.push(`<path d="M-6.8 -10C-7.8 -15.5 -5.6 -17.6 -2 -17.6L2 -17.6C4.4 -17.6 4.6 -14.4 3.4 -11.4L2.4 -9.2L-5.8 -9.2Z" fill="${INK2}" stroke="${INK}" stroke-width=".85"/>`);
  g.push(`<path d="M-5 -15.4L1.6 -15.4" stroke="${WASH3}" stroke-width=".65"/><path d="M2.6 -12.4L9 -11.6" stroke="${INK}" stroke-width=".85"/>`);
  g.push('</g>');
  return g.join('');
}

// Cipresso inciso: contorno affusolato, tratteggio fitto sul lato in ombra (est), velatura leggera.
function cypress({ x, y, h }) {
  const ww = h * 0.22;
  const half = (rel) => ww * 0.5 * Math.pow(Math.sin(Math.PI * clamp(0.08 + 0.92 * (1 - rel), 0, 1) * 0.5), 0.7) * (rel < 0.25 ? 0.86 + rel * 0.56 : 1) * Math.min(1, (1 - rel) * 3.2 + 0.05);
  const L = [], Rr = [];
  for (let k = 0; k <= 14; k++) { const rel = k / 14, yy = y - rel * h, hw = half(rel); L.push([x - hw * (0.95 + 0.08 * Math.sin(k * 1.7)), yy]); Rr.push([x + hw, yy]); }
  const outline = `M${L.map(P).join('L')}L${Rr.reverse().map(P).join('L')}`;
  let hatchD = '';
  for (let yy = y - h * 0.95; yy < y - 0.8; yy += 2) {
    const hw = half((y - yy) / h);
    hatchD += `M${f1(x - hw * 0.2)} ${f1(yy + 0.6)}L${f1(x + hw * 0.92)} ${f1(yy - 0.8)}`;
    if (((yy * 7) | 0) % 3 === 0) hatchD += `M${f1(x - hw * 0.85)} ${f1(yy + 0.4)}L${f1(x - hw * 0.45)} ${f1(yy)}`;
  }
  return { outline, hatch: `${hatchD}M${f1(x)} ${f1(y)}v3.5`, ground: `M${f1(x - ww * 0.7)} ${f1(y + 1.6)}h${f1(ww * 1.8)}` };
}
const cyp = cypresses.map(cypress);
// Tre cipressini sull'Isola Comacina, ritagliati dentro l'isola (il contorno resta pulito).
const islandTrees = [];
{
  const [ix, iy] = toView(9.7, 25.95);
  for (const [dx, dy, hh] of [[-6, 7, 13], [1, 8, 17], [8, 6, 11]]) islandTrees.push(cypress({ x: ix + dx, y: iy + dy, h: hh }));
}

// ---------- SVG ----------
const FR = `filterUnits="userSpaceOnUse" x="-40" y="-40" width="${W + 80}" height="${H + 80}" color-interpolation-filters="sRGB"`;
const wob = (id, f, sc, seed) => `<filter id="${id}" ${FR}><feTurbulence type="fractalNoise" baseFrequency="${f}" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${sc}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
const defs = [];
defs.push(`<clipPath id="lake"><path d="${LAKE_D}" clip-rule="evenodd"/></clipPath>`);
defs.push(`<clipPath id="isle"><path d="${ISLAND_D}"/></clipPath>`);
defs.push(`<clipPath id="sil">${mountains.map((m) => `<path d="${m.sil}"/>`).join('')}</clipPath>`);
defs.push(`<linearGradient id="fadeG" gradientUnits="userSpaceOnUse" x1="0" y1="1840" x2="0" y2="1960"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>`);
defs.push(`<mask id="fade" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#fadeG)"/></mask>`);
// filo chiaro sulla terra, a ~6 unità dalla riva (doppio contorno delle carte)
defs.push(`<mask id="ring" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path d="${SHORE_D}" fill="none" stroke="#fff" stroke-width="13.6" stroke-linejoin="round"/><path d="${SHORE_D}" fill="none" stroke="#000" stroke-width="11.2" stroke-linejoin="round"/><path d="${SHORE_D}" fill="#000"/></mask>`);
defs.push(`<linearGradient id="gBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".5" stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
defs.push(`<linearGradient id="gBodyFar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
// acquerello sui monti: bordo irregolare, fondo che sfuma a macchie, bordo appena più carico
defs.push(`<filter id="wcLand" ${FR}>`
  + '<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="7" result="t1"/>'
  + '<feDisplacementMap in="SourceGraphic" in2="t1" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/>'
  + '<feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="12" result="t2"/>'
  + '<feColorMatrix in="t2" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0" result="n"/>'
  + '<feComposite in="d" in2="n" operator="arithmetic" k1="2.2" k2="0.9" k4="-0.42" result="a"/>'
  + '<feGaussianBlur in="a" stdDeviation="2.4" result="ab"/>'
  + '<feComposite in="a" in2="ab" operator="arithmetic" k2="1.8" k3="-1.8" result="rim"/>'
  + `<feFlood flood-color="${WASH3}"/><feComposite in2="a" operator="in" result="body"/>`
  + `<feFlood flood-color="${WASH4}"/><feComposite in2="rim" operator="in" result="rimc"/>`
  + '<feMerge><feMergeNode in="body"/><feMergeNode in="rimc"/></feMerge></filter>');
defs.push(`<filter id="blur2" ${FR}><feGaussianBlur stdDeviation="2.2"/></filter>`);
defs.push(`<filter id="blur5" ${FR}><feGaussianBlur stdDeviation="5"/></filter>`);
defs.push(`<filter id="soft" ${FR}><feGaussianBlur stdDeviation=".6"/></filter>`);
// marezzatura dell'acqua: macchie chiare e scure, allungate in orizzontale
defs.push(`<filter id="mottleL" ${FR}><feTurbulence type="fractalNoise" baseFrequency="0.0045 0.012" numOctaves="3" seed="8" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 .890 0 0 0 0 .918 0 0 0 0 .961 2.6 0 0 0 -1.05"/><feComposite in2="SourceGraphic" operator="in"/></filter>`);
defs.push(`<filter id="mottleD" ${FR}><feTurbulence type="fractalNoise" baseFrequency="0.006 0.016" numOctaves="2" seed="23" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 .761 0 0 0 0 .831 0 0 0 0 .925 2.4 0 0 0 -1.12"/><feComposite in2="SourceGraphic" operator="in"/></filter>`);
defs.push(wob('inkA', 0.03, 3, 21), wob('inkB', 0.026, 3.6, 22), wob('wobR', 0.022, 4, 19), wob('inkS', 0.06, 2, 3), wob('hatchW', 0.05, 1.5, 31), wob('inkF', 0.02, 1, 25));
// maschere di occlusione per le velature: chi sta davanti copre chi sta dietro
const maskOf = new Map();
mountains.forEach((m, i) => {
  const front = mountains.filter((o, j) => j > i && o.y > m.y + 0.5 && !(o.box[0] > m.box[2] || o.box[2] < m.box[0] || o.box[1] > m.box[3] || o.box[3] < m.box[1]));
  if (!front.length) return;
  const [x0, y0, x1, y1] = m.box;
  const r = `x="${f1(x0 - 10)}" y="${f1(y0 - 10)}" width="${f1(x1 - x0 + 20)}" height="${f1(y1 - y0 + 20)}"`;
  defs.push(`<mask id="mo${i}" maskUnits="userSpaceOnUse" ${r}><rect ${r} fill="#fff"/>${front.map((o) => `<path d="${o.sil}" fill="#000" stroke="#000" stroke-width="3"/>`).join('')}</mask>`);
  maskOf.set(i, `mo${i}`);
});

const out = [];
const top = (arr) => arr.map((pl) => pl.slice(0, Math.max(2, Math.ceil(pl.length * 0.6)))); // parte alta dei tratti
// 1. velature dei monti (acquerello), poi l'ombra sui versanti est, sfumata (nessun taglio netto)
out.push(`<g filter="url(#wcLand)" opacity=".9">${mountains.map((m, i) => `<path d="${m.sil}" fill="url(#${m.far ? 'gBodyFar' : 'gBody'})"${maskOf.has(i) ? ` mask="url(#${maskOf.get(i)})"` : ''}/>`).join('')}</g>`);
out.push(`<g clip-path="url(#sil)"><g filter="url(#blur2)" fill="none" stroke-linecap="round"><path d="${polyD(top(strokes.big.shade))}${polyD(top(strokes.mid.shade))}" stroke="${INKL}" stroke-width="8" opacity=".55"/><path d="${polyD(top(strokes.far.shade))}" stroke="${WASH4}" stroke-width="5" opacity=".6"/></g></g>`);
// 2. inchiostro dei monti
const inkOf = (s, col, w) => `<path d="${polyD(s.back)}" stroke="${INKL}" stroke-width="1.1"/><path d="${polyD(s.foot)}${polyD(s.lit)}" stroke="${INKL}" stroke-width=".9"/><path d="${polyD(s.shade)}" stroke="${col}" stroke-width="${w.h}"/><path d="${polyD(s.ridge)}" stroke="${col}" stroke-width="${w.r}"/>`;
out.push(`<g filter="url(#inkS)" fill="none" stroke-linecap="round" stroke-linejoin="round">${inkOf(strokes.far, INK3, { h: 0.9, r: 1.4 })}${inkOf(strokes.mid, INK2, { h: 1.05, r: 1.75 })}${inkOf(strokes.big, INK, { h: 1.1, r: 1.95 })}</g>`);
// 3. cipressi
out.push(`<g fill="${WASH3}" opacity=".9">${cyp.map((c) => `<path d="${c.outline}Z"/>`).join('')}</g>`);
out.push(`<g filter="url(#inkS)" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${cyp.map((c) => c.hatch).join('')}" stroke="${INK2}" stroke-width=".85"/><path d="${cyp.map((c) => c.outline).join('')}" stroke="${INK}" stroke-width="1.2"/><path d="${cyp.map((c) => c.ground).join('')}" stroke="${INKL}" stroke-width=".9"/></g>`);
// 4. acqua: azzurro pastello, marezzatura, bordo più carico sul lato in ombra
out.push(`<path d="${LAKE_D}" fill="${WASH2}" fill-rule="evenodd"/>`);
out.push(`<g clip-path="url(#lake)">`
  + `<rect width="${W}" height="${H}" fill="#000" filter="url(#mottleL)" opacity=".85"/>`
  + `<rect width="${W}" height="${H}" fill="#000" filter="url(#mottleD)" opacity=".7"/>`
  + `<path d="${streaks.join('')}" fill="none" stroke="${WASH1}" stroke-width="8" stroke-linecap="round" filter="url(#blur2)" opacity=".5"/>`
  + `<path d="${LAKE_D}" fill="none" stroke="${WASH4}" stroke-width="18" filter="url(#blur5)" opacity=".55"/>`
  + `<path d="${LAKE_D}" fill="none" stroke="${WASH4}" stroke-width="22" transform="translate(6 2)" filter="url(#blur5)" opacity=".4"/>`
  + `</g>`);
// 5. incisione lungo le rive
out.push(`<g clip-path="url(#lake)"><g filter="url(#hatchW)" fill="none" stroke-linecap="butt"><path d="${hatch.b.join('')}" stroke="${INKL}" stroke-width="1.1"/><path d="${hatch.a.join('')}" stroke="${INK3}" stroke-width="1.15"/></g>`
  + `<path d="${glints.map(([x, y, len]) => `M${f1(x - len / 2)} ${f1(y)}h${f1(len)}`).join('')}" stroke="${WHITE}" stroke-width="1.8" stroke-linecap="round" fill="none"/></g>`);
out.push(`<path d="${ripples.map((r) => r[2]).join('')}" stroke="${INKL}" stroke-width=".9" fill="none" stroke-linecap="round"/>`);
out.push(`<path d="${lights.map((l) => l[2]).join('')}" stroke="${WHITE}" stroke-width="2.3" stroke-linecap="round" fill="none" opacity=".9" filter="url(#soft)"/>`);
// 6. cipressini sull'isola
out.push(`<g clip-path="url(#isle)"><g fill="${WASH4}">${islandTrees.map((c) => `<path d="${c.outline}Z"/>`).join('')}</g><path d="${islandTrees.map((c) => c.outline + c.hatch).join('')}" fill="none" stroke="${INK2}" stroke-width=".7"/></g>`);
// 7. riva: filo chiaro esterno + doppia linea a penna blu notte
out.push(`<g filter="url(#wobR)"><rect width="${W}" height="${H}" fill="${INKL}" mask="url(#ring)"/></g>`);
out.push(`<path d="${LAKE_D}" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round" filter="url(#inkA)"/>`);
out.push(`<path d="${LAKE_D}" fill="none" stroke="${INK2}" stroke-width=".95" stroke-linejoin="round" filter="url(#inkB)" opacity=".75"/>`);
// 8. rosa dei venti, gommone, uccelli
out.push(`<g filter="url(#inkF)">${windRose(ROSE.cx, ROSE.cy, ROSE_R)}</g>`);
out.push(gommone(boat.ox, boat.oy, BS));
out.push(`<path d="${birds.join('')}" fill="none" stroke="${INK3}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
${defs.join('\n')}
</defs>
<g mask="url(#fade)">
${out.join('\n')}
</g>
</svg>
`;
await mkdir(path.dirname(svgFile), { recursive: true });
await writeFile(svgFile, svg);
console.log(`lake-map.svg ${(svg.length / 1024).toFixed(0)} KB · montagne ${mountains.length} · cipressi ${cypresses.length} · righe d'acqua ${nHatch} · rosa ${f1(ROSE.cx)},${f1(ROSE.cy)}`);
if (warnings.length) console.log(`attenzione:\n  ${warnings.join('\n  ')}`);

// ---------- WebP con trasparenza ----------
// Con CHROMIUM_PATH si usa un Chrome/Edge già installato (come nei test).
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const page = await browser.newPage();
  const dataUrl = await page.evaluate(async ({ src, w, h }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/webp', 0.86);
  }, { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, w: W, h: H });
  if (!dataUrl.startsWith('data:image/webp')) throw new Error('il browser non sa creare WebP');
  await mkdir(path.dirname(webpFile), { recursive: true });
  await writeFile(webpFile, Buffer.from(dataUrl.split(',')[1], 'base64'));
  const { size } = await stat(webpFile);
  console.log(`creata assets/illustrations/lake-map.webp ${(size / 1024).toFixed(1)} KB${size > 280 * 1024 ? ' — OLTRE i 280 KB!' : ''}`);
} finally {
  await browser.close();
}
