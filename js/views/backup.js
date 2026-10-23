import * as db from '../db.js';
import { html, icon, modal, alertDialog, confirmDialog, progress, downloadBlob, toast } from '../ui.js';
import { buildBackup, inspectBackup, applyBackup } from '../backup.js';
import { formatBytes, formatTimestamp, plural, APP_VERSION, isIOS, isStandalone } from '../util.js';

function list(items, max = 6) {
  const shown = items.slice(0, max);
  return html`<ul class="problems">${shown.map((t) => html`<li>${t}</li>`)}${items.length > max ? html`<li>…e altri ${items.length - max}.</li>` : ''}</ul>`;
}

export async function render(root, { back, rerender, offlineStatus }) {
  const [entries, photoCount, info, lastBackupAt] = await Promise.all([
    db.listEntries(),
    db.countPhotos(),
    db.storageInfo(),
    db.getMeta('lastBackupAt'),
  ]);

  root.innerHTML = html`
    <div class="screen screen--sub">
      <header class="topbar topbar--sub">
        <button type="button" class="round-btn" data-action="back" aria-label="Indietro">${icon('back')}</button>
        <h1 class="topbar__title topbar__title--sm topbar__title--inline" tabindex="-1">Backup e dati</h1>
      </header>

      <section class="soft-card soft-card--sand soft-card--block rise" style="--i:0">
        <span class="soft-card__icon">${icon('info', { size: 20 })}</span>
        <div class="soft-card__text">
          <strong>I ricordi vivono solo su questo dispositivo</strong>
          <span>Uscite e fotografie restano salvate qui e non vengono inviate da nessuna parte. Possono però andare perse se cancelli i dati del sito o di Safari, se rimuovi l’app dalla schermata Home, se reimposti il telefono o se lo perdi. <b>Esporta un backup con regolarità</b> e conservalo in un posto sicuro, per esempio in File › iCloud Drive o su un computer.</span>
        </div>
      </section>

      <div class="mini-stats mini-stats--2 rise" style="--i:1">
        <p class="mini-stat">
          <span class="mini-stat__icon" aria-hidden="true">${icon('book', { size: 19 })}</span>
          <span class="mini-stat__value" data-testid="backup-entries">${entries.length}</span>
          <span class="mini-stat__label">${entries.length === 1 ? 'uscita' : 'uscite'}</span>
        </p>
        <p class="mini-stat">
          <span class="mini-stat__icon" aria-hidden="true">${icon('image', { size: 19 })}</span>
          <span class="mini-stat__value" data-testid="backup-photos">${photoCount}</span>
          <span class="mini-stat__label">${photoCount === 1 ? 'fotografia' : 'fotografie'}</span>
        </p>
        <p class="mini-stat">
          <span class="mini-stat__label">Spazio usato</span>
          <span class="mini-stat__value mini-stat__value--sm">${info.usage !== null ? formatBytes(info.usage) : 'non disponibile'}</span>
        </p>
        <p class="mini-stat">
          <span class="mini-stat__label">Ultimo backup</span>
          <span class="mini-stat__value mini-stat__value--sm" data-testid="backup-last">${lastBackupAt ? formatTimestamp(lastBackupAt) : 'mai'}</span>
        </p>
      </div>

      <section class="card rise" style="--i:2">
        <h2 class="card__title">Esporta i miei ricordi</h2>
        <p class="muted">Un unico file .zip con tutte le uscite e le fotografie originali. Si apre anche dal computer.</p>
        <button type="button" class="btn btn--primary btn--block" data-action="export" ${entries.length ? '' : 'disabled'}>${icon('download', { size: 20 })}Esporta i miei ricordi</button>
        ${entries.length ? '' : html`<p class="muted field__help">Non c’è ancora niente da esportare.</p>`}
      </section>

      <section class="card rise" style="--i:3">
        <h2 class="card__title">Importa un backup</h2>
        <p class="muted">Ripristina un file .zip creato da Gaia’s Wake. Prima di modificare i ricordi già presenti ti chiedo conferma, e le uscite già presenti non vengono duplicate.</p>
        <label class="btn btn--secondary btn--block btn--file">
          ${icon('upload', { size: 20 })}Importa un backup
          <input type="file" accept=".zip,application/zip,application/x-zip-compressed" data-import>
        </label>
      </section>

      <section class="status-list">
        <p class="status" data-offline>${icon('info', { size: 20 })}<span>Controllo dell’uso offline…</span></p>
        <p class="status ${info.persisted ? 'status--ok' : ''}">${icon(info.persisted ? 'check' : 'info', { size: 20 })}<span>${info.persisted
          ? 'Il browser ha reso permanente l’archivio di questa app.'
          : isIOS() && !isStandalone()
            ? 'Per proteggere i dati, aggiungi l’app alla schermata Home e usala da lì.'
            : 'Archivio normale del browser: il backup periodico resta importante.'}</span></p>
      </section>

      <p class="footnote muted">Gaia’s Wake è un diario personale: non è uno strumento di navigazione né di sicurezza nautica. Nessun dato lascia il dispositivo, salvo i backup che esporti tu. Versione ${APP_VERSION}.</p>
    </div>`.toString();

  root.querySelector('[data-action="back"]').addEventListener('click', () => back('/'));

  let statusTimer = 0;
  const showOffline = (s) => {
    const el = root.querySelector('[data-offline]');
    if (!el || !el.isConnected) return;
    if (s.state === 'installing') statusTimer = setTimeout(() => offlineStatus().then(showOffline), 2000);
    const ok = s.state === 'ready';
    el.classList.toggle('status--ok', ok);
    el.innerHTML = html`${icon(ok ? 'check' : 'info', { size: 20 })}<span>${ok
      ? 'Pronta per l’uso offline.'
      : s.state === 'installing' ? 'Preparazione per l’uso offline in corso: lascia l’app aperta qualche secondo con la connessione attiva.'
        : s.state === 'unsupported' ? 'Questo browser non permette l’uso offline. Su iPhone usa Safari con un indirizzo https.'
          : 'Uso offline non ancora pronto: riapri l’app con la connessione attiva.'}</span>`.toString();
  };
  offlineStatus().then(showOffline);

  // ---- Esportazione ----
  root.querySelector('[data-action="export"]').addEventListener('click', async () => {
    const prog = progress('Preparazione del backup');
    let res;
    try {
      res = await buildBackup({ onProgress: (i, n) => prog.update(`File ${i} di ${n}`, i / n) });
    } catch (err) {
      prog.close();
      alertDialog('Backup non riuscito', `${err.message} I ricordi sul dispositivo non sono stati modificati.`);
      return;
    }
    prog.close();

    const file = typeof File === 'function' ? new File([res.blob], res.filename, { type: 'application/zip' }) : null;
    const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    const actions = [];
    if (canShare) actions.push({ label: 'Salva in File…', value: 'share', variant: 'primary' });
    actions.push({ label: 'Scarica il file', value: 'download', variant: canShare ? 'secondary' : 'primary' });
    actions.push({ label: 'Chiudi', value: null, variant: 'ghost' });

    const choice = await modal({
      title: 'Backup pronto',
      body: html`
        <p><strong>${plural(res.entryCount, 'uscita', 'uscite')}</strong> e <strong>${plural(res.photoCount, 'fotografia', 'fotografie')}</strong> · ${formatBytes(res.blob.size)}</p>
        <p class="muted">Nome del file: ${res.filename}</p>
        ${canShare ? html`<p class="muted">Con «Salva in File…» scegli <b>Salva in File</b> e una cartella, per esempio iCloud Drive.</p>` : ''}
        ${res.missing.length ? html`<p class="warn-text">${plural(res.missing.length, 'foto non è stata trovata', 'foto non sono state trovate')} sul dispositivo e non è nel backup.</p>` : ''}`,
      actions,
    });

    let saved = false;
    if (choice === 'share') {
      try {
        await navigator.share({ files: [file], title: res.filename });
        saved = true;
      } catch (err) {
        if (err?.name !== 'AbortError') {
          downloadBlob(res.blob, res.filename);
          saved = true;
        }
      }
    } else if (choice === 'download') {
      downloadBlob(res.blob, res.filename);
      saved = true;
    }
    if (saved) {
      try { await db.setMeta('lastBackupAt', new Date().toISOString()); } catch { /* non essenziale */ }
      toast('Backup esportato. Conservalo in un posto sicuro.', { type: 'success', duration: 4500 });
      rerender();
    }
  });

  // ---- Importazione ----
  root.querySelector('[data-import]').addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;

    const prog = progress('Controllo del backup');
    prog.update(file.name, NaN);
    let inspection;
    try {
      inspection = await inspectBackup(file);
    } catch (err) {
      prog.close();
      alertDialog('Backup non valido', `${err.message} Nessun dato è stato modificato.`);
      return;
    }
    prog.close();

    const { counts, problems } = inspection;
    if (!counts.total) {
      alertDialog('Backup vuoto', `Il backup non contiene uscite da ripristinare.${problems.length ? ` Problemi trovati: ${problems.length}.` : ''} Nessun dato è stato modificato.`);
      return;
    }
    const summary = html`
      <p>Il backup${inspection.exportedAt ? ` del ${formatTimestamp(inspection.exportedAt)}` : ''} contiene <strong>${plural(counts.total, 'uscita', 'uscite')}</strong> e <strong>${plural(counts.photos, 'fotografia', 'fotografie')}</strong>.</p>
      <ul class="summary-list">
        <li><strong>${counts.fresh}</strong> ${counts.fresh === 1 ? 'nuova, da aggiungere' : 'nuove, da aggiungere'}</li>
        <li><strong>${counts.identical}</strong> già ${counts.identical === 1 ? 'presente e identica' : 'presenti e identiche'}: non verranno toccate</li>
        ${counts.different ? html`<li><strong>${counts.different}</strong> già ${counts.different === 1 ? 'presente ma diversa' : 'presenti ma diverse'} da quelle sul dispositivo</li>` : ''}
      </ul>
      ${problems.length ? html`<div class="warn-box"><p><strong>Attenzione:</strong> alcune parti del backup non sono utilizzabili.</p>${list(problems)}</div>` : ''}`;

    if (!counts.fresh && !counts.different) {
      await modal({ title: 'Niente da importare', body: html`${summary}<p>Tutti i ricordi di questo backup sono già sul dispositivo. Nessuna modifica.</p>` });
      return;
    }

    const actions = [{ label: 'Annulla', value: null, variant: 'secondary' }];
    if (counts.fresh) actions.unshift({ label: `Aggiungi ${counts.fresh === 1 ? 'la nuova' : `le ${counts.fresh} nuove`}`, value: 'add', variant: 'primary' });
    if (counts.different) actions.splice(actions.length - 1, 0, { label: counts.fresh ? 'Aggiungi e sostituisci le diverse' : `Sostituisci ${counts.different === 1 ? 'quella diversa' : `le ${counts.different} diverse`}`, value: 'replace', variant: counts.fresh ? 'ghost' : 'primary' });

    const choice = await modal({ title: 'Importare il backup?', body: summary, actions, dismissValue: null });
    if (!choice) return;
    if (choice === 'replace') {
      const ok = await confirmDialog({
        title: 'Sostituire i ricordi diversi?',
        message: `${counts.different === 1 ? 'L’uscita diversa sul dispositivo verrà sostituita' : `Le ${counts.different} uscite diverse sul dispositivo verranno sostituite`} dalla versione del backup, foto comprese. Le modifiche fatte dopo quel backup andranno perse.`,
        confirm: 'Sostituisci',
        danger: true,
      });
      if (!ok) return;
    }

    const run = progress('Ripristino in corso');
    const result = await applyBackup(inspection, {
      replaceDifferent: choice === 'replace',
      onProgress: (i, n) => run.update(`Foto ${i} di ${n}`, i / n),
    });
    run.close();

    const lines = [];
    if (result.added) lines.push(`${plural(result.added, 'uscita aggiunta', 'uscite aggiunte')}`);
    if (result.replaced) lines.push(`${plural(result.replaced, 'uscita sostituita', 'uscite sostituite')}`);
    if (result.skipped) lines.push(`${plural(result.skipped, 'uscita già presente lasciata', 'uscite già presenti lasciate')} com’era`);
    lines.push(`${plural(result.photos, 'fotografia ripristinata', 'fotografie ripristinate')}`);
    const failures = [
      ...result.failedPhotos.map((f) => `«${f.title}»: ${f.file} — ${f.reason}`),
      ...result.failedEntries.map((f) => `«${f.title}»: ${f.reason}`),
    ];
    await modal({
      title: result.fatal ? 'Ripristino interrotto' : failures.length ? 'Ripristino completato con avvisi' : 'Ripristino completato',
      tone: result.fatal || failures.length ? 'warn' : '',
      body: html`
        ${result.fatal ? html`<p class="warn-text">${result.fatal.message}</p>` : ''}
        <ul class="summary-list">${lines.map((l) => html`<li>${l}</li>`)}</ul>
        ${failures.length ? html`<div class="warn-box"><p><strong>Non ripristinate:</strong></p>${list(failures)}</div>` : ''}`,
    });
    rerender();
  });

  return { cleanup: () => clearTimeout(statusTimer) };
}
