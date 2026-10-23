// Mattoncini dell'interfaccia: template HTML con escape automatico, icone, avvisi, finestre.

class SafeHTML {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(v) {
  return String(v).replace(/[&<>"']/g, (c) => ESC[c]);
}

export const raw = (s) => new SafeHTML(String(s));

function part(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof SafeHTML) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}

// Tutto ciò che viene interpolato è testo, salvo i valori già marcati con raw() o html``.
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += part(values[i]) + strings[i + 1];
  return new SafeHTML(out);
}

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19"/>',
  heart: '<path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10h14V9M10 13h4"/>',
  pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  wave: '<path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M6 10l3-5 3 4 2-2 4 3"/>',
  ripple: '<path d="M2 12c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
  boat: '<path d="M3 14.5h14.5a3 3 0 0 0 2.8-1.9L21 11H7"/><path d="M4 14.5a3 3 0 0 0 3 3h10"/><path d="M11 11V8h3l1.2 3"/><path d="M5 11v3.5"/>',
  users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16.5 14.2a4.8 4.8 0 0 1 4.5 4.8"/>',
  cloud: '<circle cx="8" cy="8" r="3"/><path d="M8 2.5v1M2.5 8h1M4.1 4.1l.7.7M11.9 4.1l-.7.7"/><path d="M8.5 20h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.5 1.4A2.8 2.8 0 0 0 8.5 20z"/>',
  wind: '<path d="M3 8.5h10.5a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 12.5h15a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 16.5h7"/>',
  notes: '<path d="M6 3.5h9l4 4v13H6z"/><path d="M15 3.5v4h4M9 12h7M9 15.5h7"/>',
};

export function icon(name, { size = 24, cls = '', fill = 'none' } = {}) {
  return raw(`<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`);
}

// ---- Avvisi brevi --------------------------------------------------------

export function toast(message, { type = 'info', duration = 3200 } = {}) {
  const root = document.getElementById('toasts');
  if (!root) return;
  root.querySelectorAll('.toast').forEach((old) => old.remove());
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => {
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 320);
  }, duration);
}

// ---- Finestre di dialogo -------------------------------------------------

let modalDepth = 0;

// actions: [{ label, value, variant: 'primary' | 'secondary' | 'danger' | 'ghost' }]
export function modal({ title, body = '', actions = [{ label: 'Ho capito', value: true, variant: 'primary' }], dismissValue = null, focusIndex = null, tone = '' }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    const titleId = `modal-title-${Date.now()}`;
    wrap.innerHTML = html`
      <div class="modal ${tone ? `modal--${tone}` : ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        <span class="modal__handle" aria-hidden="true"></span>
        <h2 class="modal__title" id="${titleId}">${title}</h2>
        <div class="modal__body">${body}</div>
        <div class="modal__actions">
          ${actions.map((a, i) => html`<button type="button" class="btn btn--${a.variant || 'secondary'}" data-i="${i}">${a.label}</button>`)}
        </div>
      </div>`.toString();
    const previous = document.activeElement;
    modalDepth++;
    document.body.classList.add('has-modal');
    const close = (value) => {
      document.removeEventListener('keydown', onKey, true);
      wrap.classList.remove('is-in');
      // Durante la dissolvenza la finestra non è più cliccabile né letta dagli screen reader.
      wrap.setAttribute('aria-hidden', 'true');
      wrap.inert = true;
      wrap.style.pointerEvents = 'none';
      setTimeout(() => wrap.remove(), 200);
      modalDepth--;
      if (!modalDepth) document.body.classList.remove('has-modal');
      previous?.focus?.({ preventScroll: true });
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(dismissValue); }
      if (e.key === 'Tab') {
        const focusables = [...wrap.querySelectorAll('button, a[href], input, select, textarea')];
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-i]');
      if (btn) close(actions[Number(btn.dataset.i)].value);
      else if (e.target === wrap) close(dismissValue);
    });
    document.addEventListener('keydown', onKey, true);
    root.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('is-in'));
    const buttons = wrap.querySelectorAll('button[data-i]');
    const target = focusIndex !== null ? buttons[focusIndex] : wrap.querySelector('.btn--primary') || buttons[0];
    target?.focus({ preventScroll: true });
  });
}

export function alertDialog(title, message) {
  return modal({ title, body: html`<p>${message}</p>` });
}

export function confirmDialog({ title, message, confirm = 'Conferma', cancel = 'Annulla', danger = false }) {
  return modal({
    title,
    body: typeof message === 'string' ? html`<p>${message}</p>` : message,
    actions: [
      { label: cancel, value: false, variant: 'secondary' },
      { label: confirm, value: true, variant: danger ? 'danger' : 'primary' },
    ],
    dismissValue: false,
    focusIndex: danger ? 0 : 1,
  });
}

// Finestra di avanzamento per operazioni lunghe (salvataggio foto, backup).
export function progress(title) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop is-in';
  wrap.innerHTML = html`
    <div class="modal" role="alertdialog" aria-modal="true" aria-busy="true" aria-labelledby="progress-title" tabindex="-1">
      <span class="modal__handle" aria-hidden="true"></span>
      <h2 class="modal__title" id="progress-title">${title}</h2>
      <p class="progress__text" aria-live="polite"></p>
      <div class="progress" aria-hidden="true"><div class="progress__bar"></div></div>
      <p class="progress__hint">Tieni l’app aperta fino al termine.</p>
    </div>`.toString();
  const previous = document.activeElement;
  const trap = (e) => { if (e.key === 'Tab' || e.key === 'Escape') e.preventDefault(); };
  root.appendChild(wrap);
  document.body.classList.add('has-modal');
  document.addEventListener('keydown', trap, true);
  wrap.querySelector('.modal').focus({ preventScroll: true });
  modalDepth++;
  const text = wrap.querySelector('.progress__text');
  const bar = wrap.querySelector('.progress__bar');
  return {
    update(message, fraction) {
      text.textContent = message;
      if (Number.isFinite(fraction)) bar.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
    },
    close() {
      document.removeEventListener('keydown', trap, true);
      wrap.remove();
      modalDepth--;
      if (!modalDepth) document.body.classList.remove('has-modal');
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    },
  };
}

// Salva un file sul dispositivo tramite il download del browser.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Controllo segmentato con indicatore che scivola (Diario, pagina del ricordo).
// `btns` sono i pulsanti in ordine; `index` quello attivo.
export function paintSegmented(root, index) {
  const btns = [...root.querySelectorAll('.segmented__btn')];
  root.style.setProperty('--count', String(btns.length));
  root.style.setProperty('--index', String(index));
  btns.forEach((b, i) => {
    if (b.getAttribute('role') === 'tab') {
      b.setAttribute('aria-selected', String(i === index));
      b.tabIndex = i === index ? 0 : -1;
    } else {
      b.setAttribute('aria-pressed', String(i === index));
    }
  });
}
