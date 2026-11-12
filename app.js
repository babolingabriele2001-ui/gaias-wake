// Gaia's Wake — avvio dell'app, navigazione tra le schermate e service worker.

import * as db from './js/db.js';
import { html, icon, toast, confirmDialog, alertDialog } from './js/ui.js';
import * as home from './js/views/home.js';
import * as diario from './js/views/diario.js';
import * as preferiti from './js/views/preferiti.js';
import * as stagione from './js/views/stagione.js';
import * as ricordo from './js/views/ricordo.js';
import * as form from './js/views/form.js';
import * as backupView from './js/views/backup.js';
import { pageDirection } from './js/motion.js';

const ROUTES = [
  { name: 'home', re: /^\/?$/, view: home, tab: 'home' },
  { name: 'diario', re: /^\/diario$/, view: diario, tab: 'diario' },
  { name: 'preferiti', re: /^\/preferiti$/, view: preferiti, tab: 'preferiti' },
  { name: 'stagione', re: /^\/stagione(?:\/(?<year>\d{4}))?$/, view: stagione, tab: 'stagione' },
  { name: 'ricordo', re: /^\/uscita\/(?<id>[\w-]+)$/, view: ricordo, sub: true },
  { name: 'nuova', re: /^\/nuova$/, view: form, sub: true },
  { name: 'modifica', re: /^\/modifica\/(?<id>[\w-]+)$/, view: form, sub: true },
  { name: 'backup', re: /^\/backup$/, view: backupView, sub: true },
];

const viewEl = document.getElementById('view');
const tabbar = document.getElementById('tabbar');

let current = null; // { route, hash, instance }
let renderToken = 0;
let ignoreNextHash = false;
let hasHistory = false;
const scrollMemory = new Map();

function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  const [path, qs = ''] = raw.split('?');
  for (const route of ROUTES) {
    const m = path.match(route.re);
    if (m) return { route, params: m.groups || {}, query: new URLSearchParams(qs), hash: raw };
  }
  return { route: ROUTES[0], params: {}, query: new URLSearchParams(), hash: '/' };
}

export function go(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (replace) {
    location.replace(target);
  } else if (location.hash === target) {
    render();
  } else {
    location.hash = path;
  }
}

// Torna alla schermata precedente se esiste nella cronologia dell'app, altrimenti a `fallback`.
function back(fallback = '/') {
  if (hasHistory) history.back();
  else go(fallback, { replace: true });
}

async function offlineStatus() {
  if (!('serviceWorker' in navigator)) return { state: 'unsupported' };
  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg?.active) {
      // Prima visita: si aspetta qualche secondo che il service worker finisca l'installazione.
      reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(reg), 8000))]);
    }
    if (!reg) return { state: 'error' };
    const worker = reg.active;
    if (!worker) return { state: 'installing' };
    const reply = await new Promise((resolve) => {
      const ch = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 3000);
      ch.port1.onmessage = (e) => { clearTimeout(timer); resolve(e.data); };
      worker.postMessage({ type: 'GET_STATUS' }, [ch.port2]);
    });
    if (!reply) return { state: 'installing' };
    return { state: reply.cached === reply.total ? 'ready' : 'installing', ...reply };
  } catch {
    return { state: 'error' };
  }
}

async function render() {
  const token = ++renderToken;
  const next = parseHash();

  if (current) {
    if (!current.route.sub) scrollMemory.set(current.hash, window.scrollY);
    try { current.instance?.cleanup?.(); } catch { /* ignora */ }
  }
  const restoreScroll = current?.route.sub && !next.route.sub ? scrollMemory.get(next.hash) : null;

  document.body.classList.toggle('no-tabbar', !!next.route.sub);
  tabbar.querySelectorAll('[data-tab]').forEach((a) => {
    const on = a.dataset.tab === next.route.tab;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  const container = document.createElement('div');
  container.className = 'view__inner';
  let instance = null;
  try {
    instance = await next.route.view.render(container, {
      params: next.params,
      query: next.query,
      go,
      back,
      rerender: () => render(),
      offlineStatus,
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = html`
      <div class="screen">
        <div class="empty">
          <h1 class="empty__title" tabindex="-1">Qualcosa non ha funzionato</h1>
          <p class="empty__text">${err?.message || 'Errore inatteso.'}</p>
          <a class="btn btn--primary" href="#/">Torna alla Home</a>
        </div>
      </div>`.toString();
  }
  if (token !== renderToken) {
    instance?.cleanup?.();
    return;
  }
  const direction = pageDirection(current?.route, next.route);
  viewEl.replaceChildren(container);
  current = { route: next.route, hash: next.hash, instance };
  // Il modulo ha una barra fissa in basso: lì la pagina sfuma soltanto (una traslazione la sposterebbe).
  container.classList.add('view-enter', `view-enter--${container.querySelector('.actionbar') ? 'fade' : direction}`);
  window.scrollTo(0, restoreScroll ?? 0);
  const heading = container.querySelector('h1') || container.querySelector('h2');
  (instance?.focus || heading)?.focus({ preventScroll: true });
  document.title = next.route.name === 'home' ? 'Gaia’s Wake' : `${heading?.textContent?.trim() || ''} · Gaia’s Wake`;
}

window.addEventListener('hashchange', async (e) => {
  if (ignoreNextHash) {
    ignoreNextHash = false;
    return;
  }
  hasHistory = true;
  if (current?.instance?.isDirty?.()) {
    const ok = await confirmDialog({ title: 'Uscire senza salvare?', message: 'Le modifiche a questa uscita andranno perse.', confirm: 'Esci senza salvare', cancel: 'Continua a scrivere', danger: true });
    if (!ok) {
      ignoreNextHash = true;
      location.replace(new URL(e.oldURL).hash || '#/');
      return;
    }
  }
  render();
});

window.addEventListener('beforeunload', (e) => {
  if (current?.instance?.isDirty?.()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---- Service worker: uso offline e aggiornamenti --------------------------

let reloadingForUpdate = false;

function showUpdateBanner(worker) {
  if (document.querySelector('.update-banner')) return;
  const bar = document.createElement('div');
  bar.className = 'update-banner';
  bar.setAttribute('role', 'status');
  bar.innerHTML = html`<span>È disponibile una nuova versione di Gaia’s Wake.</span><span class="update-banner__actions"><button type="button" class="btn btn--sm btn--ghost" data-later>Più tardi</button><button type="button" class="btn btn--sm btn--primary" data-update>Aggiorna</button></span>`.toString();
  bar.querySelector('[data-later]').addEventListener('click', () => bar.remove());
  bar.querySelector('[data-update]').addEventListener('click', async () => {
    if (current?.instance?.isDirty?.()) {
      await alertDialog('Prima salva l’uscita', 'Salva o annulla l’uscita che stai scrivendo, poi tocca di nuovo «Aggiorna».');
      return;
    }
    reloadingForUpdate = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
  });
  document.body.appendChild(bar);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) location.reload();
  });
  navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' }).then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state !== 'installed') return;
        if (navigator.serviceWorker.controller) showUpdateBanner(worker);
        else toast('Gaia’s Wake è pronta: d’ora in poi si apre anche offline.', { type: 'success', duration: 4500 });
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {});
    });
  }).catch((err) => console.warn('Service worker non registrato:', err));
}

// ---- Avvio ----------------------------------------------------------------

async function start() {
  // Su iPhone serve un ascoltatore touchstart perché gli effetti :active (pressione) si vedano.
  document.addEventListener('touchstart', () => {}, { passive: true });
  tabbar.innerHTML = html`
    <a class="tab" data-tab="home" href="#/">${icon('home')}<span>Home</span></a>
    <a class="tab" data-tab="diario" href="#/diario">${icon('book')}<span>Diario</span></a>
    <a class="tab" data-tab="preferiti" href="#/preferiti">${icon('heart')}<span>Preferiti</span></a>
    <a class="tab" data-tab="stagione" href="#/stagione">${icon('sun')}<span>Stagione</span></a>`.toString();

  try {
    await db.openDB();
  } catch (err) {
    viewEl.innerHTML = html`
      <div class="screen"><div class="empty">
        <h1 class="empty__title">Impossibile aprire i ricordi</h1>
        <p class="empty__text">${err.message}</p>
      </div></div>`.toString();
    return;
  }
  await render();
  registerServiceWorker();
  db.cleanupOrphans().catch(() => {});
}

start();
