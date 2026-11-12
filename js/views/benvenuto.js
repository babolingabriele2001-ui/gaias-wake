// Benvenuto: compare una sola volta, alla prima apertura con il diario vuoto.
// In Safari su iPhone spiega i tre passi per mettere l'app nella schermata Home;
// nell'app già installata (o su un computer) racconta in tre passi come si usa.

import * as db from '../db.js';
import { html, icon } from '../ui.js';
import { inkArt } from '../components.js';
import { isIOS, isStandalone } from '../util.js';

export const WELCOME_KEY = 'welcomeSeen';

const INSTALL_STEPS = [
  ['share', 'Tocca Condividi', 'È il quadrato con la freccia verso l’alto, nella barra di Safari. Se non lo vedi, tocca prima «•••».'],
  ['plus', 'Scegli «Aggiungi alla schermata Home»', 'Scorri l’elenco se serve, poi tocca «Aggiungi».'],
  ['home', 'Apri Gaia’s Wake dall’icona', 'Da lì si apre anche senza connessione e iOS protegge meglio i tuoi ricordi.'],
];

const USE_STEPS = [
  ['plus', 'Aggiungi un’uscita', 'Basta la data; poi, se vuoi, foto, luoghi, chi era a bordo e due righe.'],
  ['pin', 'Ritrovala sulla mappa', 'Scrivi un paese del lago e il punto compare da solo sulla mappa disegnata.'],
  ['archive', 'Fai un backup ogni tanto', 'I ricordi vivono solo su questo telefono: esportali in File o su iCloud Drive.'],
];

export async function render(root, { go, back }) {
  const install = isIOS() && !isStandalone();
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
        <p class="welcome__lead rise" style="--i:3">Il diario delle tue uscite in barca sul Lago di Como: date, luoghi, fotografie originali e due righe per ricordare ogni giornata. Tutto resta su questo telefono.</p>
      </header>

      <section class="card welcome__card rise" style="--i:4" aria-labelledby="welcome-steps">
        <h2 class="card__title" id="welcome-steps">${install ? 'Mettila nella schermata Home' : 'Come funziona'}</h2>
        <ol class="steps">
          ${steps.map(([ic, title, text], i) => html`
            <li class="step rise" style="--i:${5 + i}">
              <span class="step__num" aria-hidden="true">${i + 1}</span>
              <span class="step__body">
                <span class="step__title">${icon(ic, { size: 17 })}<span>${title}</span></span>
                <span class="step__text">${text}</span>
              </span>
            </li>`)}
        </ol>
        ${install ? html`<p class="welcome__note">${icon('info', { size: 18 })}<span>I ricordi salvati qui in Safari restano separati da quelli dell’app installata: da quando l’hai aggiunta, usa sempre l’icona.</span></p>` : ''}
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
    return (await db.countEntries()) === 0;
  } catch {
    return false;
  }
}
