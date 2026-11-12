// Benvenuto: compare una sola volta, alla prima apertura con il diario vuoto.
// In Safari su iPhone spiega i tre passi per mettere l'app nella schermata Home;
// nell'app già installata (o su un computer) racconta in tre passi come si usa.

import * as db from '../db.js';
import { html, icon } from '../ui.js';
import { inkArt } from '../components.js';
import { isIOS, isStandalone } from '../util.js';

export const WELCOME_KEY = 'welcomeSeen';

// Diciture di Safari come nel manuale Apple in italiano (iOS 17, 18 e 26).
const INSTALL_STEPS = [
  ['share', 'Tocca Condividi', 'È il quadrato con la freccia verso l’alto. Se la barra di Safari è ridotta, tocca l’indirizzo per farla ricomparire; se vedi «•••», toccalo e poi scegli Condividi.'],
  ['plus', 'Scegli «Aggiungi alla schermata Home»', 'Se non la vedi, tocca «Visualizza altro» o scorri l’elenco. Se c’è «Apri come app web», lascialo attivo, poi tocca «Aggiungi».'],
  ['home', 'Aprila subito una volta dall’icona', 'Con Internet attivo: da lì in poi si apre anche senza connessione e iOS protegge meglio i tuoi ricordi.'],
];

const USE_STEPS = [
  ['plus', 'Aggiungi un’uscita', 'Basta la data; poi, se vuoi, foto, luoghi, chi era a bordo e due righe.'],
  ['pin', 'Ritrovala sulla mappa', 'Scrivi un paese del lago e il punto compare da solo sulla mappa disegnata.'],
  ['archive', 'Fai un backup ogni tanto', 'I ricordi vivono solo su questo dispositivo: esportali da «Backup e dati» e tienine una copia, per esempio su iCloud Drive.'],
];

// Aperta dentro un’altra app (WhatsApp, Instagram…) o in un altro browser per iPhone:
// da lì non si aggiunge alla schermata Home, prima va aperta in Safari.
function outsideSafari(ua = navigator.userAgent) {
  return /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|WhatsApp|GSA\/|Line\//.test(ua) || !/Safari\//.test(ua);
}

export async function render(root, { go, back }) {
  const install = isIOS() && !isStandalone();
  const elsewhere = install && outsideSafari();
  const steps = install ? INSTALL_STEPS : USE_STEPS;

  root.innerHTML = html`
    <div class="screen screen--sub welcome">
      <header class="welcome__hero">
        <p class="welcome__brand rise" style="--i:0">
          <img class="welcome__mark" src="assets/icons/icon.svg" alt="" width="44" height="44">
          <span>Gaia’s Wake</span>
        </p>
        <h1 class="welcome__title rise" style="--i:1" tabindex="-1">Benvenuta a bordo</h1>
        <p class="welcome__slogan rise" style="--i:2" lang="en">Every ride leaves a memory.</p>
        <div class="welcome__art rise" style="--i:2">${inkArt('boat', 'empty__art welcome__svg')}</div>
        <p class="welcome__lead rise" style="--i:3">Il diario delle tue uscite in barca sul Lago di Como: date, luoghi, fotografie originali e due righe per ricordare ogni giornata. Tutto resta su questo dispositivo.</p>
      </header>

      <section class="card welcome__card rise" style="--i:4" aria-labelledby="welcome-steps">
        <h2 class="card__title" id="welcome-steps">${install ? 'Mettila nella schermata Home' : 'Come funziona'}</h2>
        ${elsewhere
          ? html`<p class="welcome__note welcome__note--first" data-testid="open-in-safari">${icon('info', { size: 18 })}<span><b>Prima aprila in Safari.</b> Sembra aperta da un’altra app o da un altro browser: tocca il menu (per esempio «•••» o la bussola) e scegli «Apri in Safari», oppure copia l’indirizzo e incollalo in Safari.</span></p>`
          : install ? html`<p class="welcome__hint">Si fa da Safari: se l’hai aperta da WhatsApp o da un’altra app, prima scegli «Apri in Safari».</p>` : ''}
        <ol class="steps" role="list">
          ${steps.map(([ic, title, text], i) => html`
            <li class="step rise" style="--i:${5 + i}">
              <span class="step__num" aria-hidden="true">${i + 1}</span>
              <span class="step__body">
                <span class="step__title">${icon(ic, { size: 17 })}<span><span class="sr-only">Passo ${i + 1} di ${steps.length}: </span>${title}</span></span>
                <span class="step__text">${text}</span>
              </span>
            </li>`)}
        </ol>
        ${install ? html`<p class="welcome__note">${icon('info', { size: 18 })}<span>I ricordi salvati nel browser restano separati da quelli dell’app installata: da quando l’hai aggiunta, usa sempre l’icona.</span></p>` : ''}
      </section>

      <div class="welcome__actions rise" style="--i:8">
        <button type="button" class="btn btn--primary btn--block" data-action="welcome-start">${install ? 'Ho capito' : 'Inizia'}</button>
        ${install ? '' : html`<button type="button" class="btn btn--secondary btn--block" data-action="welcome-new">${icon('plus', { size: 20 })}Aggiungi la prima uscita</button>`}
      </div>

      <p class="footnote">È un diario di ricordi: non è uno strumento di navigazione né di sicurezza nautica.</p>
    </div>`.toString();

  // Il benvenuto non torna più, anche se il salvataggio della preferenza non riuscisse si prosegue.
  const done = async () => {
    try { await db.setMeta(WELCOME_KEY, true); } catch { /* si prosegue comunque */ }
  };
  root.querySelector('[data-action="welcome-start"]').addEventListener('click', async () => {
    await done();
    back('/');
  });
  root.querySelector('[data-action="welcome-new"]')?.addEventListener('click', async () => {
    await done();
    go('/nuova', { replace: true });
  });
  return {};
}

// Va mostrato? Solo alla prima apertura, se il diario è vuoto (chi ha già ricordi non lo vede mai).
export async function shouldShow() {
  try {
    if (await db.getMeta(WELCOME_KEY)) return false;
    if ((await db.countEntries()) === 0) return true;
    // Ha già dei ricordi (per esempio dopo un aggiornamento): non lo vedrà mai, neanche svuotando il diario.
    db.setMeta(WELCOME_KEY, true).catch(() => {});
    return false;
  } catch {
    return false;
  }
}
