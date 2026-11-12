// La mappa disegnata in Home: punti delle uscite, nomi dei paesi, anteprima e rotta sull'acqua.

import { html, raw, icon } from './ui.js';
import { photo } from './components.js';
import { PLACES, VIEW, toRel, relToKm, entryPoint, findPlace, waterRoute, smoothPath, glintPoints } from './lake-map.js';
import { pauseWhenHidden } from './motion.js';
import { entryTitle, formatDateShort, plural } from './util.js';
import { hydrateThumbs } from './photos.js';

export const MAP_SRC = 'assets/illustrations/lake-map.webp';
const ASPECT = VIEW.h / VIEW.w;
const pct = (n) => `${(n * 100).toFixed(3)}%`;

// Raggruppa le uscite vicine in un solo punto (stesso paese o punti quasi sovrapposti).
export function groupEntries(entries) {
  const groups = [];
  const without = [];
  for (const e of entries) {
    const p = entryPoint(e);
    if (!p) { without.push(e); continue; }
    const near = groups.find((g) => Math.hypot(g.x - p.x, (g.y - p.y) * ASPECT) < 0.045);
    if (near) {
      near.entries.push(e);
      if (!near.place && p.place) near.place = p.place;
    } else {
      groups.push({ x: p.x, y: p.y, place: p.place, entries: [e] });
    }
  }
  return { groups, without };
}

function label(place, cls = '') {
  const r = toRel(place.x, place.y);
  return html`<span class="map-label map-label--${place.side} ${cls}" style="left:${pct(r.x)};top:${pct(r.y)}" aria-hidden="true">${place.name}</span>`;
}

// Vita sulla mappa: stormi di uccellini che passano e soffi di vento sopra le montagne.
// Solo decorazione (aria-hidden), animata in CSS con transform e opacity.
const BIRD = '<path d="M0 4C2 1 4 1 6 4C8 1 10 1 12 4"/>';
const FLOCKS = [
  { top: 21, n: 3, dur: 46, delay: -6 },
  { top: 47, n: 2, dur: 58, delay: -31 },
  { top: 66, n: 3, dur: 52, delay: -44 },
];
const GUSTS = [
  { left: 4, top: 37, dur: 9, delay: 0 },
  { left: 62, top: 31, dur: 11, delay: -4 },
  { left: 2, top: 55, dur: 10, delay: -7 },
  { left: 68, top: 58, dur: 12, delay: -2 },
  { left: 10, top: 76, dur: 9.5, delay: -5 },
];
function mapLife() {
  const flocks = FLOCKS.map((f, i) => {
    const birds = Array.from({ length: f.n }, (_, k) => `<g transform="translate(${k * 15} ${k % 2 ? 7 : 0})"><g class="map-bird" style="--k:${k}">${BIRD}</g></g>`).join('');
    return `<span class="map-flock" style="top:${f.top}%;--dur:${f.dur}s;--delay:${f.delay}s;--i:${i}"><svg viewBox="-2 -2 ${f.n * 15 + 2} 16" width="${f.n * 21}" height="22">${birds}</svg></span>`;
  }).join('');
  const gusts = GUSTS.map((g) => `<span class="map-gust" style="left:${g.left}%;top:${g.top}%;--dur:${g.dur}s;--delay:${g.delay}s"><svg viewBox="0 0 90 14" width="78" height="12"><path d="M2 9C18 9 26 3 40 3S58 8 70 8C78 8 84 6 88 4"/><path d="M20 13C30 13 36 10 46 10" opacity=".7"/></svg></span>`).join('');
  return `<span class="map-life" aria-hidden="true">${flocks}${gusts}</span>`;
}

// Disegna la mappa. `entries` già ordinate dalla più recente.
export function renderMap(root, entries) {
  const { groups, without } = groupEntries(entries);
  const shown = new Set(groups.map((g) => g.place?.id).filter(Boolean));
  const labels = PLACES.filter((p) => p.main || shown.has(p.id));
  const lakeName = toRel(14.4, 37.4);

  root.innerHTML = html`
    <div class="lake-map" data-map>
      <img class="lake-map__img" src="${MAP_SRC}" alt="Mappa disegnata del Lago di Como con i punti delle uscite" width="${VIEW.w}" height="${VIEW.h}">
      <span class="lake-map__glints" aria-hidden="true">${glintPoints().map((g, i) => html`<span class="glint" style="left:${pct(g.x)};top:${pct(g.y)};--g:${i}"></span>`)}</span>
      <svg class="lake-map__routes" viewBox="0 0 ${VIEW.w} ${VIEW.h}" preserveAspectRatio="none" aria-hidden="true"><path class="lake-map__route" d=""/></svg>
      ${labels.map((p) => label(p, shown.has(p.id) ? 'map-label--strong' : ''))}
      ${raw(mapLife())}
      <span class="map-lake-name" style="left:${pct(lakeName.x)};top:${pct(lakeName.y)}" aria-hidden="true">lago di como</span>
      ${groups.map((g, i) => html`
        <button type="button" class="map-pin" style="left:${pct(g.x)};top:${pct(g.y)};--i:${Math.min(i, 12)}" data-group="${i}"
          aria-label="${g.place ? g.place.name : 'Punto sulla mappa'}: ${plural(g.entries.length, 'uscita', 'uscite')}" aria-expanded="false">
          <span class="map-pin__buoy"><span class="map-pin__head">${g.entries.length > 1 ? html`<span class="map-pin__count">${g.entries.length}</span>` : html`<span class="map-pin__dot"></span>`}</span></span>
          <span class="map-pin__ripple" aria-hidden="true"></span>
        </button>`)}
      ${!entries.length ? html`<p class="map-hint">I punti delle tue uscite compariranno qui</p>` : ''}
      <div class="map-sheet" data-sheet hidden></div>
    </div>
    ${without.length ? html`<p class="map-note">${icon('pin', { size: 15 })}<span>${plural(without.length, 'uscita non ha', 'uscite non hanno')} ancora un punto: scrivi un paese del lago come luogo, oppure toccala sulla mappa nel modulo.</span></p>` : ''}`.toString();

  const map = root.querySelector('[data-map]');
  const sheet = root.querySelector('[data-sheet]');
  const route = root.querySelector('.lake-map__route');
  let stopThumbs = () => {};
  let selected = null;
  const stopPause = pauseWhenHidden(map);

  const drawRoute = (e) => {
    const to = entryPoint(e);
    const from = findPlace(e.departure);
    if (!to || !from) { route.setAttribute('d', ''); return; }
    const a = [from.x, from.y];
    const z = relToKm(to);
    if (Math.hypot(a[0] - z[0], a[1] - z[1]) < 0.6) { route.setAttribute('d', ''); return; }
    route.setAttribute('d', smoothPath(waterRoute(a, z), false));
    route.classList.remove('is-drawn');
    void route.getBoundingClientRect();
    route.classList.add('is-drawn');
  };

  const close = () => {
    if (selected === null) return;
    map.querySelector(`[data-group="${selected}"]`)?.setAttribute('aria-expanded', 'false');
    map.querySelectorAll('.map-pin.is-on').forEach((p) => p.classList.remove('is-on'));
    selected = null;
    sheet.hidden = true;
    route.setAttribute('d', '');
    stopThumbs();
  };

  const open = (index) => {
    close();
    const g = groups[index];
    selected = index;
    const pin = map.querySelector(`[data-group="${index}"]`);
    pin.classList.add('is-on');
    pin.setAttribute('aria-expanded', 'true');
    const title = g.place ? g.place.name : 'Punto sulla mappa';
    sheet.innerHTML = html`
      <div class="map-sheet__head">
        <strong class="map-sheet__title">${title}</strong>
        <span class="muted">${plural(g.entries.length, 'uscita', 'uscite')}</span>
        <button type="button" class="map-sheet__close" data-close aria-label="Chiudi l’anteprima">${icon('close', { size: 16 })}</button>
      </div>
      <div class="map-sheet__list">
        ${g.entries.map((e) => html`
          <a class="map-card" href="#/uscita/${e.id}" data-entry="${e.id}">
            ${e.photoIds?.length ? photo(e.photoIds[0], '', 'map-card__photo') : html`<span class="map-card__photo cover--empty" aria-hidden="true">${icon('ripple', { size: 22 })}</span>`}
            <span class="map-card__text">
              <span class="eyebrow">${formatDateShort(e.date)}</span>
              <span class="map-card__title">${entryTitle(e)}</span>
              <span class="map-card__meta">${e.photoIds?.length ? plural(e.photoIds.length, 'foto', 'foto') : 'Nessuna foto'}${(e.notes || '').trim() ? ' · diario di bordo' : ''}</span>
            </span>
            <span class="map-card__go" aria-hidden="true">${icon('next', { size: 18 })}</span>
          </a>`)}
      </div>`.toString();
    sheet.hidden = false;
    stopThumbs = hydrateThumbs(sheet);
    drawRoute(g.entries[0]);
  };

  map.addEventListener('click', (ev) => {
    const pin = ev.target.closest('.map-pin');
    if (pin) {
      const i = Number(pin.dataset.group);
      if (selected === i) close();
      else open(i);
      return;
    }
    if (ev.target.closest('[data-close]')) { close(); return; }
    if (!ev.target.closest('.map-sheet')) close();
  });
  // Scorrendo le uscite dello stesso punto, la rotta segue quella toccata o a fuoco.
  sheet.addEventListener('focusin', (ev) => {
    const card = ev.target.closest('.map-card');
    const e = card && groups[selected]?.entries.find((x) => x.id === card.dataset.entry);
    if (e) drawRoute(e);
  });
  const onKey = (ev) => { if (ev.key === 'Escape' && selected !== null) close(); };
  document.addEventListener('keydown', onKey);

  return () => {
    stopThumbs();
    stopPause();
    document.removeEventListener('keydown', onKey);
  };
}

// Mappa piccola nel modulo: mostra il punto e permette di spostarlo toccando.
export function mapPicker(root, { getAutoPlace, initial, onChange }) {
  let manual = initial || null;
  root.innerHTML = html`
    <div class="map-picker" data-picker tabindex="0" role="group" aria-label="Mappa: tocca per segnare il punto dell’uscita. Con le frecce sposti il punto.">
      <img class="lake-map__img" src="${MAP_SRC}" alt="" width="${VIEW.w}" height="${VIEW.h}">
      <span class="map-pin map-pin--edit" data-pin hidden><span class="map-pin__head"><span class="map-pin__dot"></span></span></span>
      <span class="map-label map-label--strong" data-pin-label hidden></span>
    </div>
    <p class="field__help map-picker__status" data-status aria-live="polite"></p>
    <button type="button" class="link link--accent" data-reset hidden>Usa il luogo scritto</button>`.toString();

  const box = root.querySelector('[data-picker]');
  const pin = root.querySelector('[data-pin]');
  const pinLabel = root.querySelector('[data-pin-label]');
  const status = root.querySelector('[data-status]');
  const reset = root.querySelector('[data-reset]');

  const paint = () => {
    const place = getAutoPlace();
    const point = manual || (place ? toRel(place.x, place.y) : null);
    pin.hidden = !point;
    pinLabel.hidden = !point || !!manual || !place;
    if (point) {
      pin.style.left = pct(point.x);
      pin.style.top = pct(point.y);
      pin.classList.toggle('is-manual', !!manual);
    }
    if (place && !manual) {
      const r = toRel(place.x, place.y);
      pinLabel.textContent = place.name;
      pinLabel.className = `map-label map-label--strong map-label--${place.side}`;
      pinLabel.style.left = pct(r.x);
      pinLabel.style.top = pct(r.y);
    }
    reset.hidden = !manual;
    status.textContent = manual
      ? 'Punto scelto da te. Tocca di nuovo la mappa per spostarlo.'
      : place
        ? `Il punto è su «${place.name}», in base al luogo scritto. Tocca la mappa per spostarlo.`
        : 'Scrivi un paese del lago come partenza o destinazione, oppure tocca la mappa per segnare il punto.';
  };

  const set = (p) => {
    manual = p ? { x: Math.round(p.x * 10000) / 10000, y: Math.round(p.y * 10000) / 10000 } : null;
    onChange(manual);
    paint();
  };

  box.addEventListener('click', (ev) => {
    const r = box.getBoundingClientRect();
    set({ x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)) });
  });
  box.addEventListener('keydown', (ev) => {
    const step = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.006], ArrowDown: [0, 0.006] }[ev.key];
    if (!step) return;
    ev.preventDefault();
    const place = getAutoPlace();
    const cur = manual || (place ? toRel(place.x, place.y) : { x: 0.5, y: 0.5 });
    set({ x: Math.min(1, Math.max(0, cur.x + step[0])), y: Math.min(1, Math.max(0, cur.y + step[1])) });
  });
  reset.addEventListener('click', () => set(null));
  paint();
  return { refresh: paint };
}

