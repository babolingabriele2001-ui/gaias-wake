import * as db from '../db.js';
import { html, raw, icon, toast, modal, confirmDialog, progress } from '../ui.js';
import { wakeSuccess } from '../motion.js';
import { notFound } from '../components.js';
import { uuid, todayISO, isValidISODate, isImageFile, guessImageType, entryTitle } from '../util.js';
import { createThumbnail, hydrateThumbs, forgetPhoto } from '../photos.js';
import { mapPicker } from '../map-view.js';
import { findPlace, isValidPoint } from '../lake-map.js';

const BOATS = ['Gommone', 'Motoscafo', 'Barca a vela'];
const FIELDS = ['title', 'departure', 'destination', 'boatType', 'crew', 'weather', 'wind', 'notes'];

function field(name, label, value, placeholder, { type = 'text', attrs = '' } = {}) {
  return html`
    <label class="field">
      <span class="field__label">${label}</span>
      <input class="input" type="${type}" name="${name}" value="${value}" placeholder="${placeholder}" autocomplete="off" ${raw(attrs)}>
    </label>`;
}

export async function render(root, { params, go, back }) {
  const editing = !!params.id;
  const existing = editing ? await db.getEntry(params.id) : null;
  if (editing && !existing) {
    root.innerHTML = notFound().toString();
    return {};
  }

  const v = existing || { date: todayISO(), title: '', departure: '', destination: '', boatType: 'Gommone', crew: '', weather: '', wind: '', notes: '', rating: 0, favorite: false, photoIds: [] };
  const state = {
    id: existing?.id || uuid(),
    rating: v.rating || 0,
    photos: (v.photoIds || []).map((id) => ({ kind: 'saved', id })),
    removed: [],
    mapPoint: isValidPoint(v.mapPoint) ? { x: v.mapPoint.x, y: v.mapPoint.y } : null,
    dirty: false,
    saving: false,
  };
  const previews = new Set();

  root.innerHTML = html`
    <div class="screen screen--sub screen--form">
      <header class="topbar">
        <h1 class="topbar__title" tabindex="-1">${editing ? 'Modifica uscita' : 'Nuova uscita'}</h1>
        <span class="muted topbar__hint">Solo la data è obbligatoria</span>
      </header>

      <form class="form" novalidate>
        <fieldset class="fieldset">
          <legend class="fieldset__legend">Quando e dove</legend>
          <label class="field">
            <span class="field__label">Data <span aria-hidden="true">*</span></span>
            <input class="input" type="date" name="date" value="${v.date}" required aria-required="true" aria-describedby="date-error">
            <span class="field__error" id="date-error" role="alert"></span>
          </label>
          ${field('title', 'Titolo del ricordo', v.title, 'es. Tramonto verso Bellagio', { attrs: 'maxlength="140" enterkeyhint="next"' })}
          ${field('departure', 'Luogo di partenza', v.departure, 'es. Como', { attrs: 'maxlength="140" enterkeyhint="next"' })}
          ${field('destination', 'Destinazione o percorso', v.destination, 'es. Bellagio, giro dell’Isola Comacina', { attrs: 'maxlength="200" enterkeyhint="next"' })}
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset__legend">Punto sulla mappa</legend>
          <div class="field" data-map-picker></div>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset__legend">A bordo</legend>
          <div class="field">
            <span class="field__label" id="boat-label">Tipo di imbarcazione</span>
            <div class="chips chips--wrap" role="group" aria-labelledby="boat-label">
              ${BOATS.map((b) => html`<button type="button" class="chip" data-boat="${b}">${b}</button>`)}
              <button type="button" class="chip" data-boat="">Altro…</button>
            </div>
            <input class="input" type="text" name="boatType" value="${v.boatType}" placeholder="Scrivi il tipo di imbarcazione" maxlength="80" aria-labelledby="boat-label" autocomplete="off">
          </div>
          ${field('crew', 'Persone presenti a bordo', v.crew, 'es. nomi di amici e familiari', { attrs: 'maxlength="300"' })}
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset__legend">La giornata</legend>
          ${field('weather', 'Condizioni meteo', v.weather, 'es. sereno, 24 °C', { attrs: 'maxlength="140"' })}
          ${field('wind', 'Vento', v.wind, 'es. Breva leggera nel pomeriggio', { attrs: 'maxlength="140"' })}
          <div class="field">
            <span class="field__label" id="rating-label">Valutazione della giornata</span>
            <div class="rating" role="group" aria-labelledby="rating-label" data-rating></div>
          </div>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset__legend">Fotografie</legend>
          <div class="photo-grid" data-photos></div>
          <p class="muted field__help">Le foto vengono salvate originali, senza filtri né compressione. La prima è la copertina.</p>
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset__legend">Il ricordo di oggi</legend>
          <label class="sr-only" for="f-notes">Il ricordo di oggi</label>
          <textarea class="input textarea" id="f-notes" name="notes" rows="6" maxlength="20000" placeholder="Cosa vuoi ricordare di questa giornata?">${v.notes}</textarea>
        </fieldset>

        <label class="toggle">
          <span>Aggiungi ai preferiti</span>
          <input type="checkbox" class="switch" role="switch" name="favorite" ${v.favorite ? 'checked' : ''}>
        </label>
      </form>

      <div class="actionbar">
        <button type="button" class="btn btn--secondary" data-action="cancel">Annulla</button>
        <button type="button" class="btn btn--primary btn--grow" data-action="save">Salva uscita</button>
      </div>
    </div>`.toString();

  const form = root.querySelector('form');
  const boatInput = form.elements.boatType;
  const photoGrid = root.querySelector('[data-photos]');
  const ratingBox = root.querySelector('[data-rating]');
  const dateError = root.querySelector('#date-error');
  let stopThumbs = () => {};

  const markDirty = () => { state.dirty = true; };
  form.addEventListener('input', markDirty);
  form.addEventListener('change', markDirty);

  // ---- Tipo di imbarcazione ----
  const paintBoats = () => {
    const val = boatInput.value.trim();
    form.querySelectorAll('[data-boat]').forEach((chip) => {
      const b = chip.dataset.boat;
      const on = b ? b.toLowerCase() === val.toLowerCase() : !!val && !BOATS.some((x) => x.toLowerCase() === val.toLowerCase());
      chip.setAttribute('aria-pressed', String(on));
    });
  };
  form.querySelectorAll('[data-boat]').forEach((chip) => {
    chip.addEventListener('click', () => {
      boatInput.value = chip.dataset.boat;
      if (!chip.dataset.boat) boatInput.focus();
      markDirty();
      paintBoats();
    });
  });
  boatInput.addEventListener('input', paintBoats);
  paintBoats();

  // ---- Valutazione ----
  const paintRating = () => {
    ratingBox.innerHTML = html`${[1, 2, 3, 4, 5].map((i) => html`
      <button type="button" class="rating__star ${i <= state.rating ? 'is-on' : ''}" data-star="${i}" aria-pressed="${i === state.rating}" aria-label="${i} ${i === 1 ? 'stella' : 'stelle'}${i === state.rating ? ' (selezionata, tocca di nuovo per togliere)' : ''}">
        ${icon('star', { size: 26, fill: i <= state.rating ? 'currentColor' : 'none' })}
      </button>`)}`.toString();
  };
  ratingBox.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-star]');
    if (!btn) return;
    const n = Number(btn.dataset.star);
    state.rating = state.rating === n ? 0 : n;
    markDirty();
    paintRating();
    ratingBox.querySelector(`[data-star="${n}"]`)?.focus();
  });
  paintRating();

  // ---- Foto ----
  const paintPhotos = () => {
    stopThumbs();
    photoGrid.innerHTML = html`
      ${state.photos.map((p, i) => html`
        <div class="photo-tile ${p.loading ? 'is-loading' : ''} ${p.fresh ? 'is-new' : ''}" data-index="${i}">
          ${p.kind === 'saved'
            ? html`<span class="photo"><img data-thumb="${p.id}" alt="Foto ${i + 1}"></span>`
            : p.preview
              ? html`<span class="photo"><img src="${p.preview}" alt="Foto ${i + 1}" class="is-loaded"></span>`
              : html`<span class="photo is-pending"><span class="spinner" aria-label="Preparazione anteprima"></span></span>`}
          ${i === 0
            ? html`<span class="tag tag--light photo-tile__badge">Copertina</span>`
            : html`<button type="button" class="photo-tile__btn photo-tile__btn--cover" data-cover="${i}" aria-label="Usa la foto ${i + 1} come copertina">${icon('star', { size: 15 })}</button>`}
          <button type="button" class="photo-tile__btn photo-tile__btn--remove" data-remove="${i}" aria-label="Rimuovi la foto ${i + 1}">${icon('close', { size: 15 })}</button>
        </div>`)}
      <label class="add-photo">
        ${icon('plus', { size: 26 })}
        <span>Aggiungi foto</span>
        <input type="file" accept="image/*" multiple class="add-photo__input" data-file>
      </label>`.toString();
    stopThumbs = hydrateThumbs(photoGrid);
    photoGrid.querySelector('[data-file]').addEventListener('change', onFiles);
    state.photos.forEach((p) => { p.fresh = false; });
  };

  async function onFiles(ev) {
    const files = [...ev.target.files];
    ev.target.value = '';
    const images = files.filter(isImageFile);
    if (images.length < files.length) {
      toast(`${files.length - images.length === 1 ? 'Un file non è un’immagine ed è stato ignorato' : `${files.length - images.length} file non sono immagini e sono stati ignorati`}.`, { type: 'warn' });
    }
    if (!images.length) return;
    const items = images.map((file) => ({ kind: 'new', id: uuid(), file, preview: null, thumb: null, loading: true, fresh: true }));
    state.photos.push(...items);
    markDirty();
    paintPhotos();
    for (const item of items) {
      item.thumb = await createThumbnail(item.file);
      if (!state.photos.includes(item)) continue;
      item.preview = URL.createObjectURL(item.thumb ? item.thumb.blob : item.file);
      previews.add(item.preview);
      item.loading = false;
      paintPhotos();
    }
  }

  photoGrid.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    const cv = e.target.closest('[data-cover]');
    if (rm) {
      const [p] = state.photos.splice(Number(rm.dataset.remove), 1);
      if (p.kind === 'saved') state.removed.push(p.id);
      if (p.preview) { URL.revokeObjectURL(p.preview); previews.delete(p.preview); }
      markDirty();
      paintPhotos();
    } else if (cv) {
      const [p] = state.photos.splice(Number(cv.dataset.cover), 1);
      state.photos.unshift(p);
      markDirty();
      paintPhotos();
      toast('Copertina aggiornata');
    }
  });
  paintPhotos();

  // ---- Punto sulla mappa: automatico dal luogo scritto, spostabile toccando la mappa ----
  const autoPlace = () => findPlace(form.elements.destination.value) || findPlace(form.elements.departure.value);
  const picker = mapPicker(root.querySelector('[data-map-picker]'), {
    initial: state.mapPoint,
    getAutoPlace: autoPlace,
    onChange: (p) => { state.mapPoint = p; markDirty(); },
  });
  let mapTimer = 0;
  for (const name of ['departure', 'destination']) {
    form.elements[name].addEventListener('input', () => {
      clearTimeout(mapTimer);
      mapTimer = setTimeout(() => picker.refresh(), 150);
    });
  }

  // ---- Salvataggio ----
  const saveBtn = root.querySelector('[data-action="save"]');
  const cancelBtn = root.querySelector('[data-action="cancel"]');

  async function save() {
    if (state.saving) return;
    const date = form.elements.date.value;
    if (!isValidISODate(date)) {
      dateError.textContent = 'Inserisci la data dell’uscita.';
      form.elements.date.setAttribute('aria-invalid', 'true');
      form.elements.date.focus();
      form.elements.date.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    dateError.textContent = '';
    form.elements.date.removeAttribute('aria-invalid');
    if (state.photos.some((p) => p.loading)) {
      toast('Attendi un istante: sto preparando le anteprime delle foto.');
      return;
    }

    state.saving = true;
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    const toStore = state.photos.filter((p) => p.kind === 'new');
    const prog = toStore.length ? progress('Salvataggio delle foto') : null;
    try {
      // 1) Ogni foto originale viene scritta in una sua transazione (memoria contenuta su iPhone).
      for (let i = 0; i < toStore.length; i++) {
        const p = toStore[i];
        prog?.update(`Foto ${i + 1} di ${toStore.length}`, i / toStore.length);
        let buffer;
        try {
          buffer = await p.file.arrayBuffer();
        } catch {
          throw new Error(`Non riesco a leggere la foto «${p.file.name || i + 1}». Rimuovila e selezionala di nuovo.`);
        }
        const blob = new Blob([buffer], { type: p.file.type || guessImageType(p.file.name) });
        buffer = null;
        const rec = await db.makePhotoRecord({ id: p.id, entryId: state.id, blob, name: p.file.name, lastModified: p.file.lastModified });
        const thumbRec = p.thumb ? await db.makeThumbRecord(p.id, p.thumb) : null;
        await db.putPhoto(rec, thumbRec);
        p.kind = 'saved';
      }
      prog?.update('Salvataggio del ricordo…', 1);

      // 2) L'uscita viene salvata per ultima: solo ora i ricordi e le foto risultano collegati.
      const now = new Date().toISOString();
      const entry = { id: state.id, date };
      for (const f of FIELDS) entry[f] = (form.elements[f].value || '').trim();
      entry.rating = state.rating;
      entry.favorite = form.elements.favorite.checked;
      entry.photoIds = state.photos.map((p) => p.id);
      entry.mapPoint = state.mapPoint;
      entry.createdAt = existing?.createdAt || now;
      entry.updatedAt = now;
      await db.putEntry(entry, { removePhotoIds: state.removed });

      // 3) Verifica: rileggo dal dispositivo.
      if (!(await db.verifyEntry(entry.id, entry.photoIds))) {
        throw new Error('Il dispositivo non ha confermato il salvataggio. Riprova.');
      }
      state.removed.forEach(forgetPhoto);
      state.removed = [];
      prog?.close();
      state.dirty = false;
      db.requestPersistence();
      saveBtn.innerHTML = html`${icon('check', { size: 20 })}<span>${editing ? 'Aggiornata' : 'Salvata'}</span>`.toString();
      await wakeSuccess(saveBtn, editing ? 'Uscita aggiornata' : 'Uscita salvata');
      toast(editing ? 'Ricordo aggiornato' : `«${entryTitle(entry)}» salvata nel diario`, { type: 'success' });
      go(`/uscita/${entry.id}`, { replace: true });
    } catch (err) {
      prog?.close();
      state.saving = false;
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
      paintPhotos();
      await modal({
        title: 'Salvataggio non riuscito',
        body: html`<p>${err.message}</p><p class="muted">Quello che hai scritto è ancora nel modulo: puoi riprovare.</p>`,
        tone: 'warn',
      });
    }
  }

  saveBtn.addEventListener('click', save);
  form.addEventListener('submit', (e) => { e.preventDefault(); save(); });

  cancelBtn.addEventListener('click', async () => {
    if (state.dirty) {
      const ok = await confirmDialog({ title: 'Uscire senza salvare?', message: 'Le modifiche a questa uscita andranno perse.', confirm: 'Esci senza salvare', cancel: 'Continua a scrivere', danger: true });
      if (!ok) return;
    }
    state.dirty = false;
    back(editing ? `/uscita/${state.id}` : '/');
  });

  return {
    isDirty: () => state.dirty && !state.saving,
    cleanup() {
      clearTimeout(mapTimer);
      stopThumbs();
      for (const url of previews) URL.revokeObjectURL(url);
    },
  };
}
