import * as db from '../db.js';
import { html, icon, toast, confirmDialog, alertDialog, paintSegmented } from '../ui.js';
import { stars, notFound } from '../components.js';
import { entryTitle, formatDateLong, placeLine } from '../util.js';
import { hydrateThumbs, originalURL, forgetPhoto } from '../photos.js';
import { zoomFrom } from '../motion.js';

const FACTS = [
  ['departure', 'Partenza', 'pin'],
  ['destination', 'Destinazione o percorso', 'route'],
  ['boatType', 'Imbarcazione', 'boat'],
  ['crew', 'A bordo', 'users'],
  ['weather', 'Meteo', 'cloud'],
  ['wind', 'Vento', 'wind'],
];
const TABS = ['foto', 'dettagli', 'diario'];

export async function render(root, { params, query, go, back }) {
  let entry = await db.getEntry(params.id);
  if (!entry) {
    root.innerHTML = notFound().toString();
    return {};
  }
  const photos = entry.photoIds || [];
  const n = photos.length;
  const hasTitle = !!(entry.title || '').trim();
  const place = placeLine(entry);
  const facts = FACTS.filter(([k]) => (entry[k] || '').trim());
  const notes = (entry.notes || '').trim();

  let tab = TABS.includes(query.get('tab')) ? query.get('tab') : query.has('foto') || n ? 'foto' : 'dettagli';

  root.innerHTML = html`
    <div class="screen screen--sub">
      <header class="topbar topbar--sub">
        <button type="button" class="round-btn" data-action="back" aria-label="Indietro">${icon('back')}</button>
        <div class="topbar__actions">
          <button type="button" class="round-btn round-btn--fav" data-action="fav"></button>
          <a class="round-btn" href="#/modifica/${entry.id}" aria-label="Modifica il ricordo">${icon('edit', { size: 20 })}</a>
          <button type="button" class="round-btn round-btn--danger" data-action="delete" aria-label="Elimina il ricordo">${icon('trash', { size: 20 })}</button>
        </div>
      </header>

      <article class="memory-page section">
        <div class="memory-head">
          ${hasTitle ? html`<p class="eyebrow">${formatDateLong(entry.date)}</p>` : ''}
          <h1 class="memory-page__title" tabindex="-1">${hasTitle ? entryTitle(entry) : formatDateLong(entry.date)}</h1>
          ${place ? html`<p class="memory-head__place">${icon('pin', { size: 15 })}<span>${place}</span></p>` : ''}
          ${stars(entry.rating, 18)}
        </div>

        <div class="segmented" role="tablist" aria-label="Sezioni del ricordo" data-tabs>
          <span class="segmented__thumb" aria-hidden="true"></span>
          <button type="button" class="segmented__btn" role="tab" id="tab-foto" aria-controls="panel-foto" data-tab="foto">Foto${n ? html` <span class="segmented__count">${n}</span>` : ''}</button>
          <button type="button" class="segmented__btn" role="tab" id="tab-dettagli" aria-controls="panel-dettagli" data-tab="dettagli">Dettagli</button>
          <button type="button" class="segmented__btn" role="tab" id="tab-diario" aria-controls="panel-diario" data-tab="diario">Diario</button>
        </div>

        <section class="tab-panel" role="tabpanel" id="panel-foto" aria-labelledby="tab-foto" tabindex="-1" hidden>
          ${n ? html`
            <div class="carousel" aria-label="Fotografie">
              <div class="carousel__track" data-track>
                ${photos.map((pid, i) => html`
                  <div class="carousel__slide">
                    <button type="button" class="carousel__open" data-open="${i}" aria-label="Apri la foto ${i + 1} di ${n} a schermo intero">
                      <span class="photo carousel__photo"><img data-thumb="${pid}" data-original="${pid}" alt="Foto ${i + 1} di ${n}" decoding="async"></span>
                    </button>
                  </div>`)}
              </div>
              ${n > 1 ? html`
                <div class="carousel__meta">
                  <span class="carousel__count" data-count aria-live="polite">1 / ${n}</span>
                  ${n <= 12 ? html`<span class="carousel__dots" aria-hidden="true">${photos.map((_, i) => html`<span class="dot ${i === 0 ? 'is-on' : ''}"></span>`)}</span>` : ''}
                </div>` : ''}
            </div>`
          : html`<div class="panel-empty">${icon('image', { size: 28 })}<span>Nessuna foto per questa uscita.</span><a class="link link--accent" href="#/modifica/${entry.id}">Aggiungi foto</a></div>`}
        </section>

        <section class="tab-panel" role="tabpanel" id="panel-dettagli" aria-labelledby="tab-dettagli" tabindex="-1" hidden>
          ${facts.length ? html`
            <ul class="facts">
              ${facts.map(([k, label, ic]) => html`
                <li class="fact">
                  <span class="fact__icon" aria-hidden="true">${icon(ic, { size: 20 })}</span>
                  <span class="fact__label">${label}</span>
                  <span class="fact__value">${entry[k]}</span>
                </li>`)}
            </ul>`
          : html`<div class="panel-empty">${icon('notes', { size: 28 })}<span>Nessun dettaglio inserito oltre alla data.</span><a class="link link--accent" href="#/modifica/${entry.id}">Aggiungi dettagli</a></div>`}
        </section>

        <section class="tab-panel" role="tabpanel" id="panel-diario" aria-labelledby="tab-diario" tabindex="-1" hidden>
          ${notes ? html`
            <div class="memory">
              <h2 class="memory__title">${icon('notes', { size: 18 })}Il ricordo di oggi</h2>
              <p class="memory__text">${entry.notes}</p>
            </div>`
          : html`<div class="panel-empty">${icon('notes', { size: 28 })}<span>Il ricordo di questa giornata non è ancora scritto.</span><a class="link link--accent" href="#/modifica/${entry.id}">Scrivi il ricordo</a></div>`}
        </section>
      </article>
    </div>`.toString();

  // ---- Preferito, indietro, eliminazione ----
  const favBtn = root.querySelector('[data-action="fav"]');
  const paintFav = () => {
    favBtn.classList.toggle('is-on', !!entry.favorite);
    favBtn.setAttribute('aria-pressed', String(!!entry.favorite));
    favBtn.setAttribute('aria-label', 'Preferito');
    favBtn.innerHTML = icon('heart', { size: 21, fill: entry.favorite ? 'currentColor' : 'none' }).toString();
  };
  paintFav();

  favBtn.addEventListener('click', async () => {
    const updated = { ...entry, favorite: !entry.favorite, updatedAt: new Date().toISOString() };
    try {
      await db.putEntry(updated);
      entry = updated;
      paintFav();
      favBtn.classList.remove('pop');
      void favBtn.offsetWidth;
      favBtn.classList.add('pop');
      toast(entry.favorite ? 'Aggiunto ai preferiti' : 'Tolto dai preferiti');
    } catch (err) {
      alertDialog('Modifica non salvata', err.message);
    }
  });

  root.querySelector('[data-action="back"]').addEventListener('click', () => back('/diario'));

  root.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Eliminare questo ricordo?',
      message: `${n ? `Verranno eliminate anche ${n === 1 ? 'la foto collegata' : `le ${n} foto collegate`} da questo dispositivo. ` : ''}L’operazione non si può annullare.`,
      confirm: 'Elimina',
      danger: true,
    });
    if (!ok) return;
    try {
      await db.deleteEntry(entry.id);
      photos.forEach(forgetPhoto);
      toast('Ricordo eliminato');
      go('/diario', { replace: true });
    } catch (err) {
      alertDialog('Eliminazione non riuscita', err.message);
    }
  });

  // ---- Tab: Foto · Dettagli · Diario ----
  const tablist = root.querySelector('[data-tabs]');
  const tabBtns = [...tablist.querySelectorAll('[role="tab"]')];
  const panels = Object.fromEntries(TABS.map((t) => [t, root.querySelector(`#panel-${t}`)]));
  let carouselReady = false;

  let shown = null;
  const showTab = (name, { focus = false, remember = true } = {}) => {
    // Il pannello entra dal lato della scheda scelta: da destra se è più avanti, da sinistra se è prima.
    const dir = shown === null ? 'up' : TABS.indexOf(name) > TABS.indexOf(shown) ? 'right' : TABS.indexOf(name) < TABS.indexOf(shown) ? 'left' : 'up';
    shown = name;
    tab = name;
    paintSegmented(tablist, TABS.indexOf(name));
    for (const t of TABS) {
      panels[t].hidden = t !== name;
      if (t === name) panels[t].dataset.enter = dir;
    }
    if (remember) history.replaceState(history.state, '', `#/uscita/${entry.id}?tab=${name}`);
    if (focus) tabBtns[TABS.indexOf(name)].focus();
    if (name === 'foto' && n && !carouselReady) setupCarousel();
  };
  tablist.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[role="tab"]');
    if (btn) showTab(btn.dataset.tab);
  });
  tablist.addEventListener('keydown', (ev) => {
    const i = TABS.indexOf(tab);
    let next = null;
    if (ev.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (ev.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    ev.preventDefault();
    showTab(TABS[next], { focus: true });
  });

  // ---- Foto: anteprime subito, originali quando la foto è sullo schermo ----
  const originals = new Map();
  let disposed = false;
  const getOriginal = async (pid) => {
    if (!originals.has(pid)) originals.set(pid, originalURL(pid).catch(() => null));
    return originals.get(pid);
  };
  const cleanups = [hydrateThumbs(root)];

  function setupCarousel() {
    carouselReady = true;
    const track = root.querySelector('[data-track]');
    const upgrade = async (img) => {
      const url = await getOriginal(img.dataset.original);
      if (!url || disposed) return;
      const probe = new Image();
      probe.src = url;
      try { await probe.decode(); } catch { return; }
      if (!disposed && img.isConnected) {
        img.src = url;
        img.classList.add('is-loaded');
      }
    };
    const io = new IntersectionObserver((list) => {
      for (const en of list) {
        if (en.isIntersecting) {
          io.unobserve(en.target);
          upgrade(en.target);
        }
      }
    }, { root: track, rootMargin: '0px 60%' });
    track.querySelectorAll('img[data-original]').forEach((img) => io.observe(img));
    cleanups.push(() => io.disconnect());

    const count = root.querySelector('[data-count]');
    const dots = [...root.querySelectorAll('.carousel__dots .dot')];
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const slide = track.firstElementChild;
        const idx = Math.max(0, Math.min(n - 1, Math.round(track.scrollLeft / (slide.offsetWidth + 10))));
        if (count) count.textContent = `${idx + 1} / ${n}`;
        dots.forEach((d, j) => d.classList.toggle('is-on', j === idx));
      });
    };
    track.addEventListener('scroll', onScroll, { passive: true });

    const start = Math.max(0, Math.min(n - 1, Number(query.get('foto')) || 0));
    if (start) {
      requestAnimationFrame(() => {
        const slide = track.children[start];
        track.scrollLeft = slide.offsetLeft - track.offsetLeft - 16;
        onScroll();
      });
    }
    track.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-open]');
      if (btn) openLightbox(Number(btn.dataset.open));
    });
  }

  function openLightbox(index) {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Foto a schermo intero');
    box.innerHTML = html`
      <button type="button" class="lightbox__close" aria-label="Chiudi">${icon('close')}</button>
      <div class="lightbox__track">
        ${photos.map((pid, i) => html`<figure class="lightbox__slide"><img data-full="${pid}" alt="Foto ${i + 1} di ${n}"></figure>`)}
      </div>
      ${n > 1 ? html`<span class="lightbox__count" aria-live="polite">${index + 1} / ${n}</span>` : ''}`.toString();
    document.body.appendChild(box);
    document.body.classList.add('has-modal');
    const app = document.querySelector('.app');
    if (app) app.inert = true;
    const track = box.querySelector('.lightbox__track');
    const counter = box.querySelector('.lightbox__count');
    const load = async (img) => {
      const url = await getOriginal(img.dataset.full);
      if (url && img.isConnected) img.src = url;
    };
    const io = new IntersectionObserver((list) => {
      for (const en of list) if (en.isIntersecting) { io.unobserve(en.target); load(en.target); }
    }, { root: track, rootMargin: '0px 100%' });
    track.querySelectorAll('img').forEach((img) => io.observe(img));
    requestAnimationFrame(() => {
      track.scrollLeft = index * track.clientWidth;
      const from = root.querySelector(`[data-open="${index}"] img`);
      const to = track.children[index]?.querySelector('img');
      // Finché l'originale non è pronto si parte dall'anteprima già caricata.
      if (to && !to.getAttribute('src') && from?.currentSrc) to.src = from.currentSrc;
      zoomFrom(from, to);
    });
    track.addEventListener('scroll', () => {
      if (counter) counter.textContent = `${Math.round(track.scrollLeft / track.clientWidth) + 1} / ${n}`;
    }, { passive: true });
    const close = () => {
      // Torna alla foto che si stava guardando, non a quella da cui si era partiti.
      const cur = Math.max(0, Math.min(n - 1, Math.round(track.scrollLeft / (track.clientWidth || 1))));
      io.disconnect();
      document.removeEventListener('keydown', onKey, true);
      box.remove();
      if (app) app.inert = false;
      document.body.classList.remove('has-modal');
      const carousel = root.querySelector('[data-track]');
      const slide = carousel?.children[cur];
      if (slide) carousel.scrollLeft = slide.offsetLeft - carousel.offsetLeft - 16;
      root.querySelector(`[data-open="${cur}"]`)?.focus({ preventScroll: true });
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') { e.preventDefault(); box.querySelector('.lightbox__close').focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    box.querySelector('.lightbox__close').addEventListener('click', close);
    box.querySelector('.lightbox__close').focus({ preventScroll: true });
    cleanups.push(() => { if (box.isConnected) close(); });
  }

  showTab(tab, { remember: false });

  return {
    cleanup() {
      disposed = true;
      cleanups.forEach((fn) => fn());
      for (const p of originals.values()) p.then((url) => url && URL.revokeObjectURL(url));
    },
  };
}
