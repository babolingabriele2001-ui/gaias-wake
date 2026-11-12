import * as db from '../db.js';
import { html, icon, paintSegmented } from '../ui.js';
import { entryItem, emptyState } from '../components.js';
import { normalize, formatMonthYear, plural, excerpt } from '../util.js';
import { hydrateThumbs } from '../photos.js';

// La ricerca e il filtro restano impostati mentre si apre un ricordo e si torna indietro.
const state = { query: '', favOnly: false };

// Titolo e luoghi, poi anche il ricordo scritto e chi era a bordo.
const MAIN_FIELDS = ['title', 'departure', 'destination'];
const TEXT_FIELDS = ['notes', 'crew'];

function matches(e, q) {
  if (!q) return true;
  return [...MAIN_FIELDS, ...TEXT_FIELDS].some((f) => normalize(e[f]).includes(q));
}

// Se la parola non è nel titolo né nei luoghi, mostra dove compare nel testo.
function snippetFor(e, q) {
  if (!q || MAIN_FIELDS.some((f) => normalize(e[f]).includes(q))) return null;
  for (const f of TEXT_FIELDS) {
    const ex = excerpt(e[f], q);
    if (ex) return { ...ex, label: f === 'crew' ? 'A bordo' : 'Dal diario' };
  }
  return null;
}

export async function render(root, { query }) {
  const entries = await db.listEntries();

  root.innerHTML = html`
    <div class="screen">
      <header class="topbar">
        <div>
          <h1 class="topbar__title" tabindex="-1">Diario</h1>
          <p class="topbar__subtitle">${entries.length ? `${plural(entries.length, 'uscita', 'uscite')}, dalla più recente` : 'Nessuna uscita ancora'}</p>
        </div>
        <a class="round-btn round-btn--accent" href="#/nuova" aria-label="Aggiungi un’uscita">${icon('plus', { size: 22 })}</a>
      </header>

      ${entries.length ? html`
        <label class="search-pill search-pill--field">
          ${icon('search', { size: 20 })}
          <span class="sr-only">Cerca per titolo, luogo o parole del diario</span>
          <input type="search" name="q" placeholder="Cerca titoli, luoghi, ricordi" autocomplete="off" enterkeyhint="search" value="${state.query}">
        </label>
        <div class="segmented" role="group" aria-label="Filtro" data-filter>
          <span class="segmented__thumb" aria-hidden="true"></span>
          <button type="button" class="segmented__btn" data-fav="0">Tutte</button>
          <button type="button" class="segmented__btn" data-fav="1">${icon('heart', { size: 16 })}Preferite</button>
        </div>
        <p class="sr-only" role="status" data-results></p>
        <div class="diary" data-list></div>`
      : emptyState({ title: 'Il diario è vuoto', text: 'Ogni uscita che registri comparirà qui, dalla più recente.', action: html`<a class="btn btn--primary" href="#/nuova">${icon('plus', { size: 20 })}Aggiungi un’uscita</a>` })}
    </div>`.toString();

  if (!entries.length) return {};

  const list = root.querySelector('[data-list]');
  const filter = root.querySelector('[data-filter]');
  const input = root.querySelector('input[name="q"]');
  let stopThumbs = () => {};

  const results = root.querySelector('[data-results]');
  const draw = (announce = false) => {
    stopThumbs();
    const q = normalize(state.query);
    const shown = entries.filter((e) => (!state.favOnly || e.favorite) && matches(e, q));
    if (announce) results.textContent = shown.length ? plural(shown.length, 'uscita trovata', 'uscite trovate') : 'Nessuna uscita trovata';
    if (!shown.length) {
      list.innerHTML = html`<p class="section__empty">${state.favOnly && !q ? 'Nessuna uscita tra le preferite.' : 'Nessuna uscita corrisponde alla ricerca.'}</p>`.toString();
      return;
    }
    const groups = [];
    for (const e of shown) {
      const label = formatMonthYear(e.date);
      if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] });
      groups[groups.length - 1].items.push(e);
    }
    let i = 0;
    list.innerHTML = html`${groups.map((g) => html`
      <section class="month">
        <h2 class="month__label">${g.label}</h2>
        <div class="stack">${g.items.map((e) => entryItem(e, i++, { snippet: snippetFor(e, q) }))}</div>
      </section>`)}`.toString();
    stopThumbs = hydrateThumbs(list);
  };

  let timer = 0;
  input.addEventListener('input', () => {
    state.query = input.value;
    clearTimeout(timer);
    timer = setTimeout(() => draw(true), 120);
  });
  // Il tasto «Cerca» della tastiera di iPhone chiude la tastiera e mostra i risultati.
  input.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    clearTimeout(timer);
    draw(true);
    input.blur();
  });
  filter.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-fav]');
    if (!btn) return;
    state.favOnly = btn.dataset.fav === '1';
    paintSegmented(filter, state.favOnly ? 1 : 0);
    draw(true);
  });
  paintSegmented(filter, state.favOnly ? 1 : 0);
  draw();
  // Arrivando dalla ricerca in Home il campo prende subito il fuoco (su iPhone resta aperta la tastiera).
  return { cleanup: () => { clearTimeout(timer); stopThumbs(); }, focus: query.get('cerca') ? input : null };
}
