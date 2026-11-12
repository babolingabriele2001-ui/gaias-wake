// Movimento leggero: direzione delle transizioni, parallasse della mappa, apertura delle foto,
// scia del salvataggio. Si muovono solo transform e opacity (fluidi anche su iPhone) e tutto
// si spegne con «Riduci movimento» del telefono.

const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reducedMotion = () => !!mq?.matches;

const TAB_ORDER = ['home', 'diario', 'preferiti', 'stagione'];

// Da che parte entra la nuova schermata.
// fwd: si apre un dettaglio (da destra) · back: si torna a una sezione (da sinistra)
// left/right: cambio di sezione nella barra in basso · up: da un dettaglio a un altro.
export function pageDirection(prev, next) {
  if (!prev) return 'up';
  if (next.sub && !prev.sub) return 'fwd';
  if (!next.sub && prev.sub) return 'back';
  if (next.sub && prev.sub) return 'up';
  const a = TAB_ORDER.indexOf(prev.tab);
  const b = TAB_ORDER.indexOf(next.tab);
  if (a === b) return 'up';
  return b > a ? 'right' : 'left';
}

// Le animazioni continue (riflessi, boe, rotta) si fermano quando l'elemento non si vede.
export function pauseWhenHidden(el) {
  if (!el || typeof IntersectionObserver !== 'function') return () => {};
  const io = new IntersectionObserver(([en]) => el.classList.toggle('is-paused', !en.isIntersecting), { threshold: 0 });
  io.observe(el);
  return () => io.disconnect();
}

// Parallasse in Home: il titolo scorre più lento della mappa e sfuma.
export function parallax(target, { factor = 0.35, fadeAfter = 220 } = {}) {
  if (!target || reducedMotion()) return () => {};
  let raf = 0;
  let last = -1;
  const paint = () => {
    raf = 0;
    const y = Math.max(0, Math.min(window.scrollY, 600));
    if (y === last) return;
    last = y;
    target.style.transform = y ? `translate3d(0, ${(y * factor).toFixed(1)}px, 0)` : '';
    target.style.opacity = y > 0 ? String(Math.max(0, 1 - y / fadeAfter).toFixed(3)) : '';
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(paint); };
  window.addEventListener('scroll', onScroll, { passive: true });
  paint();
  return () => {
    window.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(raf);
    target.style.transform = '';
    target.style.opacity = '';
  };
}

// La foto a schermo intero nasce dalla miniatura toccata (una sola trasformazione, nessun ritocco).
export function zoomFrom(fromEl, toEl) {
  if (!fromEl || !toEl || reducedMotion() || typeof toEl.animate !== 'function') return;
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const dx = a.left + a.width / 2 - (b.left + b.width / 2);
  const dy = a.top + a.height / 2 - (b.top + b.height / 2);
  const s = Math.max(0.2, Math.min(1, a.width / b.width));
  toEl.animate(
    [{ transform: `translate3d(${dx}px, ${dy}px, 0) scale(${s})`, opacity: 0.4 }, { transform: 'none', opacity: 1 }],
    { duration: 340, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  );
}

// Salvataggio riuscito: spunta e scia che attraversa il pulsante, poi si prosegue.
export function wakeSuccess(btn, label = 'Salvata') {
  if (!btn) return Promise.resolve();
  btn.classList.add('is-saved');
  btn.setAttribute('aria-label', label);
  const ms = reducedMotion() ? 0 : 520;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ripete un'animazione CSS su un elemento (es. il cuore dei preferiti).
export function replay(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
