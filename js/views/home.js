import * as db from '../db.js';
import { html, icon } from '../ui.js';
import { featureCard, tile, emptyState, waves, onThisDayCard } from '../components.js';
import { daysSince, isIOS, isStandalone, onThisDay } from '../util.js';
import { hydrateThumbs } from '../photos.js';
import { renderMap } from '../map-view.js';
import { parallax } from '../motion.js';

function backupReminder(entries, lastBackupAt) {
  if (!entries.length) return '';
  const lastChange = entries.reduce((max, e) => (e.updatedAt > max ? e.updatedAt : max), '');
  let title;
  if (!lastBackupAt) title = 'Non hai ancora fatto un backup';
  else if (lastChange > lastBackupAt && daysSince(lastBackupAt) >= 14) title = `Ultimo backup: ${daysSince(lastBackupAt)} giorni fa`;
  else return '';
  return html`
    <section class="soft-card soft-card--sand rise" style="--i:3">
      <span class="soft-card__icon">${icon('archive', { size: 20 })}</span>
      <div class="soft-card__text">
        <strong>${title}</strong>
        <span>I ricordi sono salvati solo su questo dispositivo. Esportali ogni tanto per non perderli.</span>
        <a class="link" href="#/backup">Esporta i miei ricordi</a>
      </div>
    </section>`;
}

function installHint(dismissed) {
  if (dismissed || !isIOS() || isStandalone()) return '';
  return html`
    <section class="soft-card rise" style="--i:3" data-install-hint>
      <span class="soft-card__icon">${icon('share', { size: 20 })}</span>
      <div class="soft-card__text">
        <strong>Aggiungi Gaia’s Wake alla schermata Home</strong>
        <span>In Safari tocca <b>Condividi</b> e poi <b>Aggiungi alla schermata Home</b>. Così l’app si apre anche senza connessione e iOS non cancella i ricordi dopo qualche settimana di inattività.</span>
        <span>Poi usa sempre l’icona: i ricordi salvati qui in Safari restano separati da quelli dell’app installata.</span>
        <button type="button" class="link" data-action="dismiss-install">Ho capito</button>
      </div>
    </section>`;
}

export async function render(root) {
  const [entries, lastBackupAt, installDismissed] = await Promise.all([
    db.listEntries(),
    db.getMeta('lastBackupAt'),
    db.getMeta('installHintDismissed'),
  ]);
  const count = entries.length;
  const photoCount = entries.reduce((n, e) => n + (e.photoIds?.length || 0), 0);
  const favCount = entries.filter((e) => e.favorite).length;
  const latest = entries.slice(0, 5);
  const memories = onThisDay(entries);
  const moments = [];
  for (const e of entries) {
    if (!e.favorite) continue;
    (e.photoIds || []).forEach((pid, index) => { if (moments.length < 10) moments.push({ e, pid, index }); });
  }

  root.innerHTML = html`
    <div class="screen">
      <section class="map-hero">
        <div data-map-root></div>
        <div class="map-hero__overlay">
          <header class="topbar">
            <img class="brand-mark" src="assets/icons/icon.svg" alt="" width="40" height="40">
            <a class="round-btn" href="#/backup" aria-label="Backup e dati">${icon('archive', { size: 21 })}</a>
          </header>
          <div class="headline">
            <h1 class="brand__name" tabindex="-1">Gaia’s Wake</h1>
            <p class="brand__slogan"><span lang="en">Every ride leaves a memory.</span> ${icon('ripple', { size: 18 })}</p>
          </div>
        </div>
      </section>

      <a class="search-pill search-pill--field rise" style="--i:1" href="#/diario?cerca=1">
        ${icon('search', { size: 20 })}
        <span>Cerca un ricordo o un luogo</span>
      </a>

      <div class="mini-stats rise" style="--i:1">
        <p class="mini-stat">
          <span class="mini-stat__icon" aria-hidden="true">${icon('book', { size: 19 })}</span>
          <span class="mini-stat__value" data-testid="total-count">${count}</span>
          <span class="mini-stat__label">${count === 1 ? 'uscita' : 'uscite'}</span>
        </p>
        <p class="mini-stat">
          <span class="mini-stat__icon" aria-hidden="true">${icon('image', { size: 19 })}</span>
          <span class="mini-stat__value">${photoCount}</span>
          <span class="mini-stat__label">${photoCount === 1 ? 'fotografia' : 'fotografie'}</span>
        </p>
        <p class="mini-stat">
          <span class="mini-stat__icon" aria-hidden="true">${icon('heart', { size: 19 })}</span>
          <span class="mini-stat__value">${favCount}</span>
          <span class="mini-stat__label">${favCount === 1 ? 'preferita' : 'preferite'}</span>
        </p>
      </div>

      <a class="cta-card rise" style="--i:2" href="#/nuova">
        <span class="cta-card__text">
          <span class="cta-card__title">Aggiungi un’uscita</span>
          <span class="cta-card__sub">Data, qualche foto e due righe per ricordarla</span>
        </span>
        <span class="cta-card__btn" aria-hidden="true">${icon('plus', { size: 22 })}</span>
        ${waves()}
      </a>

      ${memories.length ? html`
        <section class="section otd" aria-labelledby="otd-title" data-testid="on-this-day">
          <div class="section__head">
            <h2 class="section__title" id="otd-title">In questi giorni, sul lago</h2>
          </div>
          <div class="stack">${memories.map((m, i) => onThisDayCard(m, i + 2))}</div>
        </section>` : ''}

      ${installHint(installDismissed)}
      ${backupReminder(entries, lastBackupAt)}

      ${count === 0
        ? emptyState({ title: 'Il diario è ancora vuoto', text: 'La prima scia comincia qui: una data, qualche foto e due righe per ricordare la giornata.' })
        : html`
          <section class="section">
            <div class="section__head">
              <h2 class="section__title">Ultime uscite</h2>
              <a class="link" href="#/diario">Vedi tutte</a>
            </div>
            <div class="rail">${latest.map((e, i) => featureCard(e, i + 3))}</div>
          </section>

          <section class="section">
            <div class="section__head">
              <h2 class="section__title">Momenti preferiti</h2>
              ${moments.length ? html`<a class="link" href="#/preferiti">Vedi tutti</a>` : ''}
            </div>
            ${moments.length
              ? html`<div class="rail">${moments.map(({ e, pid, index }, i) => tile(e, pid, index, i + 4))}</div>`
              : html`<p class="section__empty">Tocca il cuore in un ricordo con foto: i momenti preferiti compariranno qui.</p>`}
          </section>`}
      <p class="footnote">${count === 1 ? '1 ricordo salvato' : `${count} ricordi salvati`} su questo dispositivo.</p>
    </div>`.toString();

  root.querySelector('.search-pill')?.addEventListener('click', () => {
    let proxy = document.getElementById('kbd-proxy');
    if (!proxy) {
      proxy = document.createElement('input');
      proxy.id = 'kbd-proxy';
      proxy.className = 'kbd-proxy';
      proxy.setAttribute('aria-hidden', 'true');
      proxy.tabIndex = -1;
      document.body.appendChild(proxy);
    }
    proxy.focus({ preventScroll: true });
  });

  root.querySelector('[data-action="dismiss-install"]')?.addEventListener('click', async () => {
    root.querySelector('[data-install-hint]')?.remove();
    try { await db.setMeta('installHintDismissed', true); } catch { /* non essenziale */ }
  });

  const stopMap = renderMap(root.querySelector('[data-map-root]'), entries);
  const stopThumbs = hydrateThumbs(root);
  // Il titolo scorre più lento della mappa e sfuma: un velo di profondità, solo con transform e opacity.
  const stopParallax = parallax(root.querySelector('.headline'));
  return { cleanup: () => { stopMap(); stopThumbs(); stopParallax(); } };
}
