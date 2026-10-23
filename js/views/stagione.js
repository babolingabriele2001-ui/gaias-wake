import * as db from '../db.js';
import { html, icon } from '../ui.js';
import { tile, emptyState, entryItem, waves } from '../components.js';
import { yearOf, monthIndexOf, MONTH_INITIALS, MONTH_NAMES, normalize, formatNumber, plural } from '../util.js';
import { hydrateThumbs } from '../photos.js';

// Anno appena scelto con i pulsanti: dopo il nuovo disegno il fuoco torna lì.
let focusYear = null;

// Località citate nelle uscite dell'anno (partenza e destinazione), raggruppate ignorando
// maiuscole e accenti. Si contano solo i testi scritti da Gaia: nessuna località dedotta.
function frequentPlaces(entries) {
  const map = new Map();
  for (const e of entries) {
    const seen = new Set();
    for (const value of [e.departure, e.destination]) {
      const label = (value || '').trim();
      const key = normalize(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const cur = map.get(key) || { label, count: 0 };
      cur.count++;
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'it')).slice(0, 5);
}

export async function render(root, { params, go }) {
  const all = await db.listEntries();
  const years = [...new Set(all.map((e) => yearOf(e.date)))].sort((a, b) => b - a);

  if (!years.length) {
    root.innerHTML = html`
      <div class="screen">
        <header class="topbar"><h1 class="topbar__title" tabindex="-1">Stagione</h1></header>
        ${emptyState({ title: 'Nessuna stagione da raccontare', text: 'Quando registrerai le prime uscite, qui troverai il riepilogo di ogni anno.', action: html`<a class="btn btn--primary" href="#/nuova">${icon('plus', { size: 20 })}Aggiungi un’uscita</a>` })}
      </div>`.toString();
    return {};
  }

  const requested = Number(params.year);
  const current = new Date().getFullYear();
  const year = years.includes(requested) ? requested : years.includes(current) ? current : years[0];
  const perYear = new Map(years.map((y) => [y, all.filter((e) => yearOf(e.date) === y).length]));
  const entries = all.filter((e) => yearOf(e.date) === year);
  const photoCount = entries.reduce((n, e) => n + (e.photoIds?.length || 0), 0);
  const favorites = entries.filter((e) => e.favorite);
  const favPhotos = favorites.flatMap((e) => (e.photoIds || []).map((pid, i) => ({ e, pid, i })));
  const rated = entries.filter((e) => e.rating > 0);
  const avg = rated.length ? rated.reduce((n, e) => n + e.rating, 0) / rated.length : 0;

  const months = new Array(12).fill(0);
  for (const e of entries) months[monthIndexOf(e.date)]++;
  const max = Math.max(...months);
  const places = frequentPlaces(entries);
  const placeMax = places[0]?.count || 1;
  const shownFav = favPhotos.slice(0, 10);
  const extraFav = favPhotos.length - shownFav.length;

  root.innerHTML = html`
    <div class="screen">
      <header class="topbar">
        <h1 class="topbar__title" tabindex="-1">Stagione</h1>
      </header>
      <div class="day-chips" role="group" aria-label="Anno">
        ${years.map((y) => html`
          <button type="button" class="day-chip" data-year="${y}" aria-pressed="${y === year}">
            <span class="day-chip__main">${y}</span>
            <span class="day-chip__sub">${plural(perYear.get(y), 'uscita', 'uscite')}</span>
          </button>`)}
      </div>

      <section class="season-card rise" style="--i:1" aria-label="Riepilogo del ${year}">
        <p class="season-card__label">La stagione ${year}</p>
        <div class="season-card__main">
          <span><span class="season-card__value" data-testid="season-count">${entries.length}</span> <span class="season-card__unit">${entries.length === 1 ? 'uscita' : 'uscite'}</span></span>
        </div>
        <dl class="season-card__row">
          <div><dt>Fotografie</dt><dd data-testid="season-photos">${photoCount}</dd></div>
          <div><dt>Preferite</dt><dd data-testid="season-favorites">${favorites.length}</dd></div>
        </dl>
        ${waves()}
        ${rated.length ? html`<p class="season-rating">${icon('star', { size: 16, fill: 'currentColor', cls: 'season-rating__star' })}Valutazione media ${formatNumber(avg)} su 5, su ${plural(rated.length, 'uscita valutata', 'uscite valutate')}</p>` : ''}
      </section>

      <section class="card rise" style="--i:2">
        <h2 class="card__title">Uscite mese per mese</h2>
        <div class="bars" role="img" aria-label="${months.map((n, i) => `${MONTH_NAMES[i]}: ${n}`).join(', ')}">
          ${months.map((n, i) => html`
            <div class="bars__col">
              <span class="bars__value">${n || ''}</span>
              <span class="bars__bar ${n ? 'is-on' : ''}" style="height:${n ? Math.round((n / max) * 64) + 6 : 3}px; animation-delay:${i * 30}ms"></span>
              <span class="bars__label">${MONTH_INITIALS[i]}</span>
            </div>`)}
        </div>
      </section>

      <section class="section">
        <div class="section__head">
          <h2 class="section__title">Fotografie preferite</h2>
          ${favPhotos.length ? html`<a class="link" href="#/preferiti">${extraFav > 0 ? `Altre ${extraFav}` : 'Vedi tutte'}</a>` : ''}
        </div>
        ${favPhotos.length
          ? html`<div class="rail">${shownFav.map(({ e, pid, i }, k) => tile(e, pid, i, k + 3))}</div>`
          : html`<p class="section__empty">${favorites.length ? 'Le uscite preferite di quest’anno non hanno foto.' : 'Nessuna uscita preferita in questo anno.'}</p>`}
      </section>

      ${places.length ? html`
        <section class="card rise" style="--i:4">
          <h2 class="card__title">Località più frequenti</h2>
          <ul class="places">
            ${places.map((p, i) => html`
              <li class="places__item">
                <span class="places__row"><span class="places__name">${p.label}</span><span class="muted">${p.count === 1 ? '1 volta' : `${p.count} volte`}</span></span>
                <span class="places__track"><span class="places__fill" style="width:${Math.round((p.count / placeMax) * 100)}%; animation-delay:${i * 60}ms"></span></span>
              </li>`)}
          </ul>
        </section>` : ''}

      <section class="section">
        <h2 class="section__title">Le uscite del ${year}</h2>
        <div class="stack">${entries.map((e, i) => entryItem(e, i))}</div>
      </section>
    </div>`.toString();

  root.querySelectorAll('.day-chip[data-year]').forEach((chip) => {
    chip.addEventListener('click', () => {
      focusYear = chip.dataset.year;
      go(`/stagione/${chip.dataset.year}`, { replace: true });
    });
  });
  const focus = focusYear ? root.querySelector(`.day-chip[data-year="${focusYear}"]`) : null;
  focusYear = null;
  return { cleanup: hydrateThumbs(root), focus };
}
