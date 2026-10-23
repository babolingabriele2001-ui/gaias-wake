import * as db from '../db.js';
import { html, icon } from '../ui.js';
import { photo, emptyState, entryItem } from '../components.js';
import { entryTitle, formatDateShort, plural } from '../util.js';
import { hydrateThumbs } from '../photos.js';

export async function render(root) {
  const favorites = (await db.listEntries()).filter((e) => e.favorite);
  const withPhotos = favorites.filter((e) => e.photoIds?.length);
  const withoutPhotos = favorites.filter((e) => !e.photoIds?.length);
  const photoCount = withPhotos.reduce((n, e) => n + e.photoIds.length, 0);

  root.innerHTML = html`
    <div class="screen">
      <header class="topbar">
        <div>
          <h1 class="topbar__title" tabindex="-1">Preferiti</h1>
          <p class="topbar__subtitle">${favorites.length ? `${plural(favorites.length, 'uscita preferita', 'uscite preferite')} · ${plural(photoCount, 'fotografia', 'fotografie')}` : 'Le uscite che ami di più'}</p>
        </div>
      </header>

      ${!favorites.length
        ? emptyState({ title: 'Nessun preferito, per ora', text: 'Apri un ricordo e tocca il cuore: le sue foto compariranno in questa galleria.', action: html`<a class="btn btn--secondary" href="#/diario">Vai al diario</a>` })
        : html`
          ${withPhotos.map((e, gi) => html`
            <section class="section fav-group rise" style="--i:${Math.min(gi, 6)}">
              <a class="fav-group__head" href="#/uscita/${e.id}">
                <div>
                  <span class="eyebrow">${formatDateShort(e.date)}</span>
                  <h2 class="fav-group__title">${entryTitle(e)}</h2>
                </div>
                <span class="fav-group__open">Apri ${icon('next', { size: 16 })}</span>
              </a>
              <div class="gallery">
                ${e.photoIds.map((pid, i) => html`
                  <a class="gallery__item" href="#/uscita/${e.id}?foto=${i}" aria-label="Apri la foto ${i + 1} di «${entryTitle(e)}»">
                    ${photo(pid, '', 'gallery__photo')}
                  </a>`)}
              </div>
            </section>`)}
          ${withoutPhotos.length ? html`
            <section class="section">
              <h2 class="month__label">Preferite senza foto</h2>
              <div class="stack">${withoutPhotos.map((e, i) => entryItem(e, i))}</div>
            </section>` : ''}`}
    </div>`.toString();

  return { cleanup: hydrateThumbs(root) };
}
