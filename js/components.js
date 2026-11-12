// Pezzi di interfaccia riusati da più schermate.

import { html, raw, icon } from './ui.js';
import { entryTitle, placeLine, formatDateShort, formatMonthShort, plural, onThisDayLabel } from './util.js';

const STAR_PATH = 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z';

export function stars(rating, size = 14) {
  if (!rating) return '';
  const label = `${rating} ${rating === 1 ? 'stella' : 'stelle'} su 5`;
  const items = [1, 2, 3, 4, 5].map((i) => raw(
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" class="star ${i <= rating ? 'is-on' : ''}" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`,
  ));
  return html`<span class="stars" role="img" aria-label="${label}">${items}</span>`;
}

export function photo(photoId, alt = '', cls = '') {
  return html`<span class="photo ${cls}"><img data-thumb="${photoId}" alt="${alt}" decoding="async"></span>`;
}

// Copertina: la prima foto dell'uscita, oppure un riquadro decorativo (mai una foto inventata).
export function cover(entry, cls = '') {
  const pid = entry.photoIds?.[0];
  if (pid) return photo(pid, `Foto dell’uscita «${entryTitle(entry)}»`, `cover ${cls}`);
  return html`<span class="cover cover--empty ${cls}" aria-hidden="true">${icon('ripple', { size: 30 })}</span>`;
}

// Card grande con la foto di copertina e il testo sopra (Ultime uscite in Home).
export function featureCard(e, i = 0) {
  const place = placeLine(e);
  const hasPhoto = !!e.photoIds?.length;
  return html`
    <a class="feature-card rise ${hasPhoto ? '' : 'feature-card--empty'}" style="--i:${i}" href="#/uscita/${e.id}">
      ${cover(e, 'feature-card__cover')}
      <span class="feature-card__shade" aria-hidden="true"></span>
      <span class="feature-card__top">
        <span class="feature-card__title">${entryTitle(e)}</span>
        <span class="feature-card__meta">${formatDateShort(e.date)}${place ? ` · ${place}` : ''}</span>
      </span>
      <span class="feature-card__bottom">
        ${e.photoIds?.length ? html`<span class="tag tag--light">${plural(e.photoIds.length, 'foto', 'foto')}</span>` : stars(e.rating) || html`<span></span>`}
        <span class="feature-card__arrow" aria-hidden="true">${icon('next', { size: 18 })}</span>
      </span>
    </a>`;
}

// Riquadro verticale di una foto (Momenti preferiti).
export function tile(e, pid, index, i = 0) {
  return html`
    <a class="tile rise" style="--i:${i}" href="#/uscita/${e.id}?foto=${index}">
      ${photo(pid, `Foto preferita: ${entryTitle(e)}`, 'tile__photo')}
      <span class="tile__shade" aria-hidden="true"></span>
      <span class="tile__badge" aria-hidden="true">${icon('heart', { size: 14, fill: 'currentColor' })}</span>
      <span class="tile__label">${entryTitle(e)}</span>
    </a>`;
}

// «Un anno fa oggi»: un ricordo degli anni passati caduto in questi giorni.
export function onThisDayCard(item, i = 0) {
  const e = item.entry;
  const place = placeLine(e);
  return html`
    <a class="otd-card rise" style="--i:${i}" href="#/uscita/${e.id}">
      ${cover(e, 'otd-card__cover')}
      <span class="otd-card__text">
        <span class="otd-card__when">${onThisDayLabel(item)}</span>
        <span class="otd-card__title">${entryTitle(e)}</span>
        ${place ? html`<span class="otd-card__meta">${icon('pin', { size: 13 })}<span>${place}</span></span>` : ''}
      </span>
      <span class="otd-card__go" aria-hidden="true">${icon('next', { size: 18 })}</span>
      ${raw('<svg class="otd-card__wake" viewBox="0 0 120 24" aria-hidden="true" focusable="false"><path pathLength="1" d="M2 16c10 0 10-5 20-5s10 5 20 5 10-5 20-5 10 5 20 5 10-5 20-5 10 5 16 5"/></svg>')}
    </a>`;
}

// Riga dell'elenco: data a sinistra, testo, anteprima della foto a destra.
export function entryItem(e, i = 0, { snippet = null } = {}) {
  const place = placeLine(e);
  const n = e.photoIds?.length || 0;
  return html`
    <a class="entry-item rise" style="--i:${Math.min(i, 8)}" href="#/uscita/${e.id}">
      <span class="entry-item__date" aria-hidden="true">
        <span class="entry-item__day">${Number(e.date.slice(8, 10))}</span>
        <span class="entry-item__mon">${formatMonthShort(e.date)}</span>
      </span>
      <span class="entry-item__body">
        <span class="sr-only">${formatDateShort(e.date)}</span>
        <span class="entry-item__title">${entryTitle(e)}</span>
        ${place ? html`<span class="entry-item__meta">${icon('pin', { size: 14 })}<span>${place}</span></span>` : ''}
        ${snippet ? html`<span class="entry-item__snippet"><span class="entry-item__snippet-label">${snippet.label}:</span> ${snippet.before}<mark>${snippet.match}</mark>${snippet.after}</span>` : ''}
        ${n || e.rating || e.favorite ? html`
          <span class="entry-item__tags">
            ${n ? html`<span class="tag">${icon('image', { size: 13 })}${n}</span>` : ''}
            ${stars(e.rating, 13)}
            ${e.favorite ? html`<span class="entry-item__fav" role="img" aria-label="Preferito">${icon('heart', { size: 15, fill: 'currentColor' })}</span>` : ''}
          </span>` : ''}
      </span>
      ${n ? photo(e.photoIds[0], '', 'entry-item__thumb') : ''}
    </a>`;
}

// Piccole illustrazioni a incisione per gli stati vuoti (SVG locale, solo inchiostro blu).
// Le linee con pathLength="1" si disegnano una volta, come un tratto di penna.
const WATER = '<g class="ink-water">'
  + '<path d="M18 92c10 0 10-3 20-3s10 3 20 3"/><path d="M176 96c9 0 9-3 18-3s9 3 18 3"/>'
  + '<path d="M70 104c8 0 8-2.5 16-2.5s8 2.5 16 2.5"/><path d="M140 108c7 0 7-2 14-2s7 2 14 2"/>'
  + '</g>';
const ART = {
  boat: WATER
    + '<path class="ink-draw ink-faint" pathLength="1" d="M112 67c-12-1-24-3.5-38-7.5"/>'
    + '<path class="ink-draw ink-draw--2 ink-faint" pathLength="1" d="M112 76c-14 2.5-28 6.5-44 12"/>'
    + '<path class="ink-faint ink-dash" d="M66 57c-9-2-18-3-28-3M62 90c-9 3-18 5-28 6"/>'
    + '<g class="ink-float"><path class="ink-fill" d="M112 64h82c-2 9-8 14-17 14h-55c-5 0-9-3-10-9z"/>'
    + '<path d="M112 64h82c-2 9-8 14-17 14h-55c-5 0-9-3-10-9z"/><path d="M146 64v-11h17l5 11"/><path d="M128 64v-6"/>'
    + '<path class="ink-faint" d="M194 70c4 2 6.5 5 8 9"/></g>',
  heart: WATER
    + '<ellipse class="ink-draw ink-faint" pathLength="1" cx="120" cy="84" rx="34" ry="7"/>'
    + '<ellipse class="ink-draw ink-draw--2 ink-faint" pathLength="1" cx="120" cy="86" rx="62" ry="12"/>'
    + '<g class="ink-float"><path class="ink-fill" d="M120 82s-20-12-20-27a11 11 0 0 1 20-6.5A11 11 0 0 1 140 55c0 15-20 27-20 27z"/>'
    + '<path d="M120 82s-20-12-20-27a11 11 0 0 1 20-6.5A11 11 0 0 1 140 55c0 15-20 27-20 27z"/>'
    + '<path class="ink-faint" d="M108 56c0-4 3-7 7-7"/></g>',
  sun: WATER
    + '<path d="M40 80h160" class="ink-faint"/>'
    + '<g class="ink-float"><path class="ink-fill" d="M96 80a24 24 0 0 1 48 0z"/><path d="M96 80a24 24 0 0 1 48 0"/></g>'
    + '<path class="ink-draw" pathLength="1" d="M120 48v-12M98 57l-8-8M142 57l8-8M88 72l-11-3M152 72l11-3"/>'
    + '<path class="ink-draw ink-draw--2" pathLength="1" d="M104 88h32M110 95h20M115 102h10"/>',
};

// Illustrazione a incisione (decorativa): 'boat', 'heart' o 'sun'.
export function inkArt(name = 'boat', cls = 'empty__art') {
  return raw(`<svg class="${cls}" viewBox="0 0 240 120" aria-hidden="true" focusable="false">${ART[name] || ART.boat}</svg>`);
}

export function emptyState({ title, text, action = '', level = 2, art = 'boat' }) {
  return html`
    <div class="empty rise">
      ${inkArt(art)}
      ${level === 1 ? html`<h1 class="empty__title" tabindex="-1">${title}</h1>` : html`<h2 class="empty__title">${title}</h2>`}
      <p class="empty__text">${text}</p>
      ${action}
    </div>`;
}

// Onde stratificate per le card blu (decorazione).
export function waves() {
  return raw('<span class="waves" aria-hidden="true"><svg viewBox="0 0 400 120" preserveAspectRatio="none">'
    + '<path d="M-20 52C50 30 120 72 200 52S330 32 420 50V130H-20Z" fill="rgba(255,255,255,0.07)"/>'
    + '<path d="M-20 74C60 56 130 94 210 74S340 58 420 72V130H-20Z" fill="rgba(169,193,226,0.16)"/>'
    + '<path d="M-20 96C70 80 140 110 220 96S350 84 420 94V130H-20Z" fill="rgba(59,99,163,0.5)"/>'
    + '</svg></span>');
}

export function notFound(message = 'Questo ricordo non esiste più sul dispositivo.') {
  return html`
    <div class="screen screen--sub">
      <header class="topbar topbar--sub">
        <a class="round-btn" href="#/diario" aria-label="Torna al diario">${icon('back')}</a>
      </header>
      ${emptyState({ title: 'Ricordo non trovato', text: message, level: 1, action: html`<a class="btn btn--primary" href="#/diario">Vai al diario</a>` })}
    </div>`;
}
