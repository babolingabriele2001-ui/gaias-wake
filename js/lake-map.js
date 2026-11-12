// Mappa disegnata del Lago di Como: geometria, paesi e posizione dei punti delle uscite.
//
// Le coordinate sono in chilometri su un piano semplice (x verso est, y verso sud), ricavate
// dalle posizioni reali dei paesi e semplificate come in una carta illustrata: servono a
// disegnare la mappa e a mettere i punti, non a navigare. Nessun GPS, nessuna mappa online.
// La stessa geometria è usata da tools/build-map.mjs per disegnare l'immagine della mappa.

// Riquadro della mappa in km e dimensioni del disegno (viewBox dell'immagine).
export const FRAME = { x0: -1.5, y0: -3.5, w: 30, h: 49 };
export const VIEW = { w: 1200, h: 1960 };

// Contorno del lago, in senso orario a partire da Como.
export const SHORE = [
  [2.7, 43.9], [2.2, 42.4], [1.7, 40.9], [1.9, 39.7], [2.7, 38.7], [3.5, 37.7], [4.6, 36.9], [5.9, 36.0], [6.8, 35.0],
  [6.9, 33.6], [6.6, 32.0], [6.3, 30.3], [6.3, 28.9], [7.1, 27.7], [7.8, 26.8], [8.7, 26.1], [9.6, 25.4], [10.5, 24.9],
  [11.3, 25.5], [11.85, 26.05], [12.2, 25.5], [12.4, 24.6], [13.1, 23.6], [13.9, 22.8], [14.5, 21.9], [14.2, 20.8],
  [14.3, 19.6], [15.0, 18.0], [15.9, 16.3], [16.7, 14.6], [17.3, 13.0], [17.4, 11.6], [17.0, 10.3], [17.5, 8.9],
  [18.4, 7.4], [19.4, 6.0], [20.5, 5.2], [21.7, 4.9], [23.0, 4.1], [24.3, 3.1], [25.4, 2.4], [26.3, 2.6], [26.6, 3.7],
  [26.0, 5.2], [25.2, 6.6], [24.1, 7.3], [23.1, 7.9], [22.7, 8.9], [23.2, 9.6], [22.4, 10.3], [21.3, 11.0], [20.4, 12.3],
  [19.9, 13.8], [19.8, 15.6], [19.7, 17.4], [19.1, 19.0], [18.4, 20.6], [18.6, 22.1], [19.2, 24.2], [19.8, 26.6],
  [20.4, 29.0], [21.0, 31.3], [22.1, 33.2], [23.4, 34.9], [24.8, 36.4], [26.0, 37.6], [26.9, 38.6], [27.2, 39.8],
  [26.5, 40.4], [25.7, 39.6], [24.8, 39.0], [23.7, 37.9], [22.5, 36.6], [21.3, 35.2], [20.1, 33.6], [19.0, 32.0],
  [18.2, 30.6], [17.7, 29.0], [17.6, 27.0], [17.4, 25.3], [17.1, 24.0], [16.7, 23.0], [16.3, 22.6], [15.8, 23.2],
  [15.3, 24.3], [14.4, 25.4], [13.3, 26.3], [12.1, 27.4], [10.8, 28.4], [9.7, 29.5], [8.8, 30.8], [8.4, 32.0],
  [8.3, 33.5], [8.4, 35.0], [7.8, 36.3], [6.6, 37.4], [5.4, 38.3], [4.4, 39.4], [3.8, 40.7], [3.7, 42.2], [3.5, 43.6],
];

// Isola Comacina.
export const ISLAND = [[9.25, 25.85], [9.7, 25.55], [10.15, 25.75], [10.0, 26.15], [9.5, 26.3]];

// Paesi e luoghi riconosciuti nei campi «Luogo di partenza» e «Destinazione o percorso».
// side: da che parte scrivere il nome (l = sinistra, r = destra); main: nome sempre visibile.
export const PLACES = [
  { id: 'como', name: 'Como', aliases: ['como città', 'sant agostino', 'villa olmo', 'tempio voltiano'], x: 3.0, y: 43.2, side: 'r', main: true },
  { id: 'cernobbio', name: 'Cernobbio', aliases: ['villa d este', 'villa erba'], x: 2.0, y: 40.2, side: 'l' },
  { id: 'blevio', name: 'Blevio', aliases: [], x: 3.9, y: 40.0, side: 'r' },
  { id: 'moltrasio', name: 'Moltrasio', aliases: [], x: 3.2, y: 37.9, side: 'l' },
  { id: 'torno', name: 'Torno', aliases: ['villa pliniana'], x: 5.5, y: 38.1, side: 'r' },
  { id: 'carate-urio', name: 'Carate Urio', aliases: ['carate', 'urio'], x: 4.9, y: 36.6, side: 'l' },
  { id: 'faggeto', name: 'Faggeto Lario', aliases: ['faggeto', 'molina', 'palanzo'], x: 7.6, y: 36.4, side: 'r' },
  { id: 'laglio', name: 'Laglio', aliases: [], x: 6.7, y: 35.2, side: 'l' },
  { id: 'pognana', name: 'Pognana Lario', aliases: ['pognana', 'quarzano'], x: 8.35, y: 34.6, side: 'r' },
  { id: 'brienno', name: 'Brienno', aliases: [], x: 6.7, y: 32.6, side: 'l' },
  { id: 'nesso', name: 'Nesso', aliases: ['orrido di nesso'], x: 8.35, y: 32.2, side: 'r' },
  { id: 'argegno', name: 'Argegno', aliases: [], x: 6.3, y: 29.4, side: 'l' },
  { id: 'careno', name: 'Careno', aliases: [], x: 9.1, y: 30.2, side: 'r' },
  { id: 'colonno', name: 'Colonno', aliases: [], x: 7.4, y: 27.3, side: 'l' },
  { id: 'lezzeno', name: 'Lezzeno', aliases: ['sossana', 'grotta dell azzurro', 'grotta azzurra'], x: 11.4, y: 28.1, side: 'r' },
  { id: 'sala-comacina', name: 'Sala Comacina', aliases: [], x: 8.6, y: 26.1, side: 'l' },
  { id: 'isola-comacina', name: 'Isola Comacina', aliases: ['comacina', 'isola'], x: 9.7, y: 25.95, side: 'r' },
  { id: 'ossuccio', name: 'Ossuccio', aliases: ['spurano'], x: 9.6, y: 25.3, side: 'l' },
  { id: 'lenno', name: 'Lenno', aliases: [], x: 10.5, y: 24.85, side: 'l' },
  { id: 'balbianello', name: 'Villa del Balbianello', aliases: ['balbianello', 'punta di lavedo', 'lavedo'], x: 11.8, y: 26.0, side: 'r' },
  { id: 'tremezzo', name: 'Tremezzo', aliases: ['tremezzina', 'villa carlotta', 'mezzegra', 'azzano'], x: 13.1, y: 23.6, side: 'l' },
  { id: 'cadenabbia', name: 'Cadenabbia', aliases: ['griante'], x: 14.4, y: 22.1, side: 'l' },
  { id: 'menaggio', name: 'Menaggio', aliases: ['nobiallo'], x: 14.25, y: 20.0, side: 'l', main: true },
  { id: 'san-siro', name: 'San Siro', aliases: ['acquaseria', 'santa maria rezzonico'], x: 15.9, y: 16.3, side: 'l' },
  { id: 'rezzonico', name: 'Rezzonico', aliases: [], x: 16.7, y: 14.6, side: 'l' },
  { id: 'cremia', name: 'Cremia', aliases: [], x: 17.3, y: 12.9, side: 'l' },
  { id: 'pianello', name: 'Pianello del Lario', aliases: ['pianello'], x: 17.4, y: 11.5, side: 'l' },
  { id: 'musso', name: 'Musso', aliases: [], x: 17.0, y: 10.3, side: 'l' },
  { id: 'dongo', name: 'Dongo', aliases: [], x: 17.5, y: 8.9, side: 'l' },
  { id: 'gravedona', name: 'Gravedona', aliases: ['gravedona ed uniti'], x: 19.3, y: 6.1, side: 'r' },
  { id: 'domaso', name: 'Domaso', aliases: [], x: 21.4, y: 4.95, side: 'r' },
  { id: 'gera', name: 'Gera Lario', aliases: ['gera'], x: 23.6, y: 3.6, side: 'l' },
  { id: 'sorico', name: 'Sorico', aliases: [], x: 25.6, y: 2.5, side: 'l' },
  { id: 'colico', name: 'Colico', aliases: [], x: 25.4, y: 6.4, side: 'l' },
  { id: 'piona', name: 'Abbazia di Piona', aliases: ['piona', 'olgiasca'], x: 22.8, y: 9.0, side: 'l' },
  { id: 'dorio', name: 'Dorio', aliases: [], x: 21.2, y: 11.1, side: 'r' },
  { id: 'dervio', name: 'Dervio', aliases: [], x: 19.95, y: 13.6, side: 'r' },
  { id: 'bellano', name: 'Bellano', aliases: ['orrido di bellano'], x: 19.7, y: 17.2, side: 'r' },
  { id: 'varenna', name: 'Varenna', aliases: ['villa monastero', 'perledo', 'castello di vezio', 'vezio'], x: 18.5, y: 20.7, side: 'r', main: true },
  { id: 'fiumelatte', name: 'Fiumelatte', aliases: [], x: 18.7, y: 22.4, side: 'r' },
  { id: 'lierna', name: 'Lierna', aliases: [], x: 19.6, y: 26.0, side: 'r' },
  { id: 'mandello', name: 'Mandello del Lario', aliases: ['mandello'], x: 20.9, y: 31.0, side: 'l' },
  { id: 'abbadia', name: 'Abbadia Lariana', aliases: ['abbadia'], x: 22.3, y: 33.4, side: 'l' },
  { id: 'lecco', name: 'Lecco', aliases: [], x: 26.7, y: 38.9, side: 'l', main: true },
  { id: 'malgrate', name: 'Malgrate', aliases: [], x: 25.0, y: 39.2, side: 'l' },
  { id: 'valmadrera', name: 'Valmadrera', aliases: [], x: 23.6, y: 37.9, side: 'l' },
  { id: 'onno', name: 'Onno', aliases: ['vassena'], x: 18.2, y: 30.4, side: 'l' },
  { id: 'limonta', name: 'Limonta', aliases: ['oliveto lario', 'oliveto'], x: 17.6, y: 27.0, side: 'l' },
  { id: 'bellagio', name: 'Bellagio', aliases: ['punta spartivento', 'spartivento', 'villa melzi', 'villa serbelloni', 'pescallo', 'san giovanni di bellagio'], x: 16.3, y: 23.4, side: 'b', main: true },
];

const strip = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[’'`]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

// Elenco di [testo da cercare, luogo], dal più lungo al più corto ("Isola Comacina" prima di "Como").
const NEEDLES = PLACES.flatMap((p) => [p.name, ...p.aliases].map((a) => [strip(a), p]))
  .sort((a, b) => b[0].length - a[0].length);

// Primo luogo del lago citato in un testo, oppure null. "Lago di Como" non conta come Como città.
export function findPlace(text) {
  let hay = ` ${strip(text).replace(/\blago di como\b|\blario\b|\blago\b/g, ' ')} `;
  if (!hay.trim()) return null;
  let best = null;
  for (const [needle, place] of NEEDLES) {
    if (!needle) continue;
    const at = hay.indexOf(` ${needle} `);
    if (at >= 0 && (!best || at < best.at)) best = { at, place };
  }
  return best?.place || null;
}

// Da km a coordinate relative (0–1) sul disegno.
export function toRel(x, y) {
  return { x: (x - FRAME.x0) / FRAME.w, y: (y - FRAME.y0) / FRAME.h };
}

export function toView(x, y) {
  const r = toRel(x, y);
  return [r.x * VIEW.w, r.y * VIEW.h];
}

const clamp01 = (n) => Math.min(1, Math.max(0, n));
export function isValidPoint(p) {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
}

// Punto dell'uscita sulla mappa: quello scelto da Gaia, altrimenti quello ricavato dal luogo scritto.
// Restituisce { x, y } relativi (0–1), con `manual` e il luogo riconosciuto, oppure null.
export function entryPoint(entry) {
  if (isValidPoint(entry.mapPoint)) return { x: clamp01(entry.mapPoint.x), y: clamp01(entry.mapPoint.y), manual: true, place: null };
  const place = findPlace(entry.destination) || findPlace(entry.departure);
  if (!place) return null;
  return { ...toRel(place.x, place.y), manual: false, place };
}

// Rotta da disegnare (partenza → punto dell'uscita) quando entrambi sono sulla mappa e diversi.
export function entryRoute(entry) {
  const to = entryPoint(entry);
  const fromPlace = findPlace(entry.departure);
  if (!to || !fromPlace) return null;
  const from = toRel(fromPlace.x, fromPlace.y);
  if (Math.hypot(from.x - to.x, (from.y - to.y) * (FRAME.h / FRAME.w)) < 0.02) return null;
  return { from, to };
}

// Percorso SVG morbido (Catmull-Rom) che passa per i punti dati, in coordinate del disegno.
export function smoothPath(pointsKm, closed = true, tension = 0.5) {
  const pts = pointsKm.map(([x, y]) => toView(x, y));
  const n = pts.length;
  const at = (i) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1); const p1 = at(i); const p2 = at(i + 1); const p3 = at(i + 2);
    const c1 = [p1[0] + ((p2[0] - p0[0]) * tension) / 3, p1[1] + ((p2[1] - p0[1]) * tension) / 3];
    const c2 = [p2[0] - ((p3[0] - p1[0]) * tension) / 3, p2[1] - ((p3[1] - p1[1]) * tension) / 3];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return closed ? `${d}Z` : d;
}

// Il punto (in km) è dentro il lago? Serve al disegno per non mettere montagne in acqua.
export function inLake(x, y) {
  let inside = false;
  for (let i = 0, j = SHORE.length - 1; i < SHORE.length; j = i++) {
    const [xi, yi] = SHORE[i];
    const [xj, yj] = SHORE[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Linee di centro del lago (km): tre rami che partono dal centro lago, davanti a Bellagio.
// Le rotte disegnate tra partenza e arrivo seguono l'acqua invece di attraversare le montagne.
const JUNCTION = [16.3, 21.2];
const BRANCHES = [
  // ramo di Como
  [JUNCTION, [15.3, 22.6], [14.2, 24.3], [12.6, 26.5], [10.4, 27.6], [8.2, 29.3], [7.5, 31.6], [7.6, 34.0], [6.4, 36.6], [4.4, 38.4], [2.9, 40.4], [2.8, 42.8], [3.0, 43.5]],
  // ramo di Lecco
  [JUNCTION, [17.8, 23.2], [18.5, 26.0], [19.2, 29.5], [20.6, 32.6], [22.4, 35.0], [24.3, 37.0], [26.0, 38.9]],
  // alto lago
  [JUNCTION, [16.9, 18.6], [17.9, 15.5], [18.6, 12.3], [19.3, 9.6], [20.6, 7.5], [22.6, 5.8], [24.8, 4.0], [25.7, 3.0]],
];

function nearestOnBranches(p) {
  let best = null;
  BRANCHES.forEach((line, b) => {
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, ay] = line[i];
      const [bx, by] = line[i + 1];
      const dx = bx - ax; const dy = by - ay;
      const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)));
      const q = [ax + dx * t, ay + dy * t];
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (!best || d < best.d) best = { b, i, t, q, d };
    }
  });
  return best;
}

export function relToKm(rel) {
  return [rel.x * FRAME.w + FRAME.x0, rel.y * FRAME.h + FRAME.y0];
}

// Percorso sull'acqua tra due punti (km): punti da unire con smoothPath(…, false).
export function waterRoute(fromKm, toKm) {
  const a = nearestOnBranches(fromKm);
  const z = nearestOnBranches(toKm);
  const path = [fromKm, a.q];
  if (a.b === z.b) {
    const line = BRANCHES[a.b];
    if (a.i < z.i) for (let i = a.i + 1; i <= z.i; i++) path.push(line[i]);
    else if (a.i > z.i) for (let i = a.i; i > z.i; i--) path.push(line[i]);
  } else {
    for (let i = a.i; i >= 1; i--) path.push(BRANCHES[a.b][i]);
    path.push(JUNCTION);
    for (let i = 1; i <= z.i; i++) path.push(BRANCHES[z.b][i]);
  }
  path.push(z.q, toKm);
  // Toglie i punti quasi coincidenti, che renderebbero la curva spigolosa.
  return path.filter((p, i) => i === 0 || Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) > 0.25);
}

// Punti per i riflessi animati sull'acqua (solo decorazione): a metà dei tratti dei tre rami,
// spostati appena di lato in modo alternato. Coordinate relative (0–1) sul disegno.
export function glintPoints() {
  const out = [];
  BRANCHES.forEach((line) => {
    for (let i = 1; i < line.length - 1; i++) {
      const [ax, ay] = line[i];
      const [bx, by] = line[i + 1];
      const side = (out.length % 2 ? 1 : -1) * 0.35;
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const x = (ax + bx) / 2 + (-(by - ay) / len) * side;
      const y = (ay + by) / 2 + ((bx - ax) / len) * side;
      if (inLake(x, y)) out.push(toRel(x, y));
    }
  });
  return out;
}

