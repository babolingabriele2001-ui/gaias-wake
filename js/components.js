// Pezzi di interfaccia riusati da più schermate.

import { html, raw, icon } from './ui.js';
import { entryTitle, placeLine, formatDateShort, formatMonthShort, plural } from './util.js';

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

// Riga dell'elenco: data a sinistra, testo, anteprima della foto a destra.
export function entryItem(e, i = 0) {
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

export function emptyState({ title, text, action = '', level = 2 }) {
  return html`
    <div class="empty rise">
      <span class="empty__icon" aria-hidden="true">${icon('ripple', { size: 28 })}</span>
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
