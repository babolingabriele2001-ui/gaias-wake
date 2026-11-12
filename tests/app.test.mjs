// Test end-to-end di Gaia's Wake in Chromium con viewport e user agent di iPhone 13.
// NB: è il motore Chromium del computer, non Safari su un iPhone vero.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, cp, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createZip, openZip } from '../js/zip.js';
import { PLACES, toRel } from '../js/lake-map.js';
import { onThisDay, onThisDayLabel } from '../js/util.js';
import {
  ROOT, OUTPUT, IPHONE, startServer, launch, launchPersistent, makeFixtures, openApp, nav,
  createEntry, fillForm, addPhotos, dumpDB, clickButton, screenshot, sha256,
} from './helpers.mjs';

let browser;
let srv;
let fx;
const F = (name) => fx.files[name];

before(async () => {
  browser = await launch();
  srv = await startServer();
  fx = await makeFixtures(browser);
  await mkdir(OUTPUT, { recursive: true });
});

after(async () => {
  await browser?.close();
  srv?.server.close();
});

const newContext = () => browser.newContext({ ...IPHONE, locale: 'it-IT', timezoneId: 'Europe/Rome', acceptDownloads: true });
const modalText = (page) => page.locator('.modal-backdrop.is-in .modal__body').last().textContent();
const byId = (list) => [...list].sort((a, b) => a.id.localeCompare(b.id));

test('avvio: Home vuota, nessun errore, nessuna richiesta verso Internet', async () => {
  const ctx = await newContext();
  const external = [];
  ctx.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(srv.base) && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u);
  });
  const { page, errors } = await openApp(ctx, srv.base);
  assert.equal(await page.textContent('[data-testid="total-count"]'), '0');
  await page.waitForSelector('text=Il diario è ancora vuoto');
  assert.equal((await page.textContent('.brand__slogan')).trim(), 'Every ride leaves a memory.');
  for (const h of ['#/diario', '#/preferiti', '#/stagione', '#/backup', '#/nuova', '#/']) await nav(page, h);
  assert.equal(await page.inputValue('input[name="q"]').catch(() => null), null, 'nessuna ricerca senza uscite');
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

describe('uscite: creazione, modifica, preferiti, ricerca, stagione, eliminazione', () => {
  let ctx;
  let page;
  let errors;
  let idA;
  let idB;
  let idC;

  before(async () => {
    ctx = await newContext();
    ({ page, errors } = await openApp(ctx, srv.base));
  });
  after(async () => { await ctx.close(); });

  test('crea un’uscita completa con due foto, salvate originali byte per byte', async () => {
    idA = await createEntry(page, {
      date: '2026-09-14',
      title: 'Tramonto verso Bellagio',
      departure: 'Cernobbio',
      destination: 'Bellagio',
      crew: 'Gaia e amici',
      weather: 'Sereno, 24 °C',
      wind: 'Breva leggera',
      rating: 5,
      notes: 'Lago liscio come un foglio.\nRitorno con la Breva.',
      photos: [F('IMG_0001.jpg').path, F('IMG_0002.jpg').path],
    });
    assert.equal(await page.textContent('.memory-page__title'), 'Tramonto verso Bellagio');
    assert.equal(await page.textContent('.memory-page .eyebrow'), 'Lunedì 14 settembre 2026');
    const facts = await page.$$eval('.fact', (els) => els.map((e) => [e.querySelector('.fact__label').textContent, e.querySelector('.fact__value').textContent]));
    assert.deepEqual(facts, [
      ['Partenza', 'Cernobbio'],
      ['Destinazione o percorso', 'Bellagio'],
      ['Imbarcazione', 'Gommone'],
      ['A bordo', 'Gaia e amici'],
      ['Meteo', 'Sereno, 24 °C'],
      ['Vento', 'Breva leggera'],
    ]);
    assert.equal(await page.getAttribute('.memory-page .stars', 'aria-label'), '5 stelle su 5');
    assert.equal(await page.textContent('.memory__text'), 'Lago liscio come un foglio.\nRitorno con la Breva.');
    assert.equal(await page.locator('.carousel__slide').count(), 2);
    await page.waitForFunction(() => {
      const img = document.querySelector('.carousel img');
      return img && img.complete && img.naturalWidth > 0 && img.src.startsWith('blob:');
    });

    const db = await dumpDB(page);
    const entry = db.entries.find((e) => e.id === idA);
    assert.equal(entry.date, '2026-09-14');
    assert.equal(entry.boatType, 'Gommone');
    assert.equal(entry.rating, 5);
    assert.equal(entry.favorite, false);
    assert.equal(entry.photoIds.length, 2);
    const [p1, p2] = entry.photoIds.map((id) => db.photos.find((p) => p.id === id));
    assert.equal(p1.sha, F('IMG_0001.jpg').sha, 'la prima foto è identica all’originale');
    assert.equal(p2.sha, F('IMG_0002.jpg').sha, 'la seconda foto è identica all’originale');
    assert.equal(p1.bytes, F('IMG_0001.jpg').size);
    assert.equal(p1.type, 'image/jpeg');
    assert.equal(p1.name, 'IMG_0001.jpg');
    assert.equal(p1.storedAs, 'blob');
    assert.ok(entry.photoIds.every((id) => db.thumbs.includes(id)), 'anteprime create');
  });

  test('solo la data è obbligatoria; si mostrano solo i dati compilati', async () => {
    await nav(page, '#/nuova');
    assert.equal(await page.inputValue('input[name="boatType"]'), 'Gommone', '«Gommone» è il valore predefinito');
    assert.match(await page.inputValue('input[name="date"]'), /^\d{4}-\d{2}-\d{2}$/, 'data preimpostata a oggi');
    await page.fill('input[name="date"]', '');
    await page.click('[data-action="save"]');
    await page.waitForSelector('#date-error:not(:empty)');
    assert.equal(await page.getAttribute('input[name="date"]', 'aria-invalid'), 'true');
    assert.equal((await dumpDB(page)).entries.length, 1, 'senza data non si salva');

    await page.fill('input[name="date"]', '2025-07-05');
    await page.fill('input[name="boatType"]', '');
    await page.click('[data-action="save"]');
    await page.waitForURL(/#\/uscita\//);
    idB = new URL(page.url()).hash.split('/')[2];
    await page.waitForSelector('.memory-page');
    assert.equal(await page.textContent('.memory-page__title'), 'Sabato 5 luglio 2025');
    for (const sel of ['.facts', '.carousel', '.memory', '.memory-page .stars', '.memory-page .eyebrow']) {
      assert.equal(await page.locator(sel).count(), 0, `${sel} non deve comparire`);
    }
  });

  test('modifica: titolo, foto rimossa, foto aggiunta, nuova copertina', async () => {
    const before = (await dumpDB(page)).entries.find((e) => e.id === idA);
    const [first, second] = before.photoIds;
    await nav(page, `#/modifica/${idA}`);
    await page.locator('.photo-tile').first().scrollIntoViewIfNeeded();
    await page.waitForSelector('.photo-tile img.is-loaded');
    await page.fill('input[name="title"]', 'Tramonto a Bellagio');
    await page.click('[data-remove="0"]');
    await addPhotos(page, [F('Tramonto.png').path]);
    await page.click('[data-cover="1"]');
    await page.click('[data-action="save"]');
    await page.waitForSelector('.memory-page__title:text-is("Tramonto a Bellagio")');

    const db = await dumpDB(page);
    const entry = db.entries.find((e) => e.id === idA);
    assert.equal(entry.title, 'Tramonto a Bellagio');
    assert.equal(entry.photoIds.length, 2);
    assert.equal(entry.photoIds[1], second);
    const png = db.photos.find((p) => p.id === entry.photoIds[0]);
    assert.equal(png.sha, F('Tramonto.png').sha);
    assert.equal(png.type, 'image/png');
    assert.ok(!db.photos.some((p) => p.id === first), 'la foto rimossa è eliminata');
    assert.ok(!db.thumbs.includes(first), 'anche la sua anteprima');
    assert.equal(entry.createdAt, before.createdAt);
    assert.notEqual(entry.updatedAt, before.updatedAt);
  });

  test('«Annulla» con modifiche chiede conferma', async () => {
    await nav(page, `#/modifica/${idA}`);
    await page.fill('input[name="title"]', 'Da non salvare');
    await page.click('[data-action="cancel"]');
    await page.waitForSelector('text=Uscire senza salvare?');
    await clickButton(page, 'Continua a scrivere');
    assert.equal(await page.inputValue('input[name="title"]'), 'Da non salvare');
    await page.click('[data-action="cancel"]');
    await clickButton(page, 'Esci senza salvare');
    await page.waitForSelector('.memory-page');
    assert.equal((await dumpDB(page)).entries.find((e) => e.id === idA).title, 'Tramonto a Bellagio');
  });

  test('preferiti: cuore, galleria, accesso al ricordo, momenti in Home', async () => {
    await nav(page, `#/uscita/${idA}`);
    await page.click('[data-action="fav"]');
    await page.waitForSelector('[data-action="fav"][aria-pressed="true"]');
    assert.equal((await dumpDB(page)).entries.find((e) => e.id === idA).favorite, true);

    await nav(page, '#/preferiti');
    assert.equal(await page.locator('.gallery__item').count(), 2);
    await page.waitForFunction(() => [...document.querySelectorAll('.gallery img')].every((i) => i.complete && i.naturalWidth > 0));
    await page.locator('.gallery__item').nth(1).click();
    await page.waitForURL(new RegExp(`#/uscita/${idA}\\?foto=1`));
    await page.waitForSelector('.memory-page');
    await page.waitForFunction(() => document.querySelector('[data-count]')?.textContent === '2 / 2');

    await nav(page, '#/');
    assert.equal(await page.textContent('[data-testid="total-count"]'), '2');
    assert.equal(await page.locator('.tile').count(), 2);
    assert.equal(await page.locator('.feature-card').count(), 2);
  });

  test('mappa disegnata: punto automatico dal luogo, anteprima, rotta sull’acqua, apertura del ricordo', async () => {
    await nav(page, '#/');
    const pins = await page.$$eval('.map-pin', (els) => els.map((e) => e.getAttribute('aria-label')));
    assert.deepEqual(pins, ['Bellagio: 1 uscita'], 'un solo punto, su Bellagio (destinazione scritta)');
    assert.match(await page.textContent('.map-note'), /1 uscita non ha ancora un punto/);
    const pos = await page.$eval('.map-pin', (el) => [parseFloat(el.style.left), parseFloat(el.style.top)]);
    const bellagio = PLACES.find((p) => p.id === 'bellagio');
    const r = toRel(bellagio.x, bellagio.y);
    assert.ok(Math.abs(pos[0] - r.x * 100) < 0.01 && Math.abs(pos[1] - r.y * 100) < 0.01, 'il punto è esattamente su Bellagio');
    assert.ok(await page.isVisible('.map-label:text-is("Bellagio")'));

    await page.click('.map-pin');
    await page.waitForSelector('.map-sheet:not([hidden])');
    assert.match(await page.textContent('.map-sheet'), /Tramonto a Bellagio/);
    assert.match(await page.textContent('.map-sheet'), /2 foto · diario di bordo/);
    assert.ok((await page.getAttribute('.lake-map__route', 'd')).length > 40, 'rotta Cernobbio → Bellagio disegnata');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.map-sheet', { state: 'hidden' });
    assert.equal(await page.getAttribute('.lake-map__route', 'd'), '');

    await page.click('.map-pin');
    await page.click('.map-card');
    await page.waitForURL(new RegExp(`#/uscita/${idA}`));
    await page.waitForSelector('.memory-page');
  });

  test('pagina del ricordo: tab Foto · Dettagli · Diario', async () => {
    await nav(page, `#/uscita/${idA}`);
    const selected = () => page.$$eval('[role="tab"]', (els) => els.map((e) => [e.dataset.tab, e.getAttribute('aria-selected')]));
    assert.deepEqual(await selected(), [['foto', 'true'], ['dettagli', 'false'], ['diario', 'false']], 'con le foto si apre su Foto');
    assert.equal(await page.isVisible('#panel-foto'), true);
    assert.equal(await page.isVisible('#panel-dettagli'), false);

    await page.click('[role="tab"][data-tab="dettagli"]');
    assert.equal(await page.isVisible('#panel-dettagli'), true);
    assert.equal(await page.isVisible('#panel-foto'), false);
    assert.match(page.url(), /\?tab=dettagli$/);
    assert.equal(await page.locator('#panel-dettagli .fact').count(), 6);

    await page.keyboard.press('ArrowRight');
    assert.equal(await page.isVisible('#panel-diario'), true);
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.tab), 'diario', 'frecce: il fuoco segue la tab');
    assert.match(await page.textContent('#panel-diario .memory__text'), /Lago liscio/);

    // La tab scelta resta dopo aver aperto un'altra schermata ed essere tornati indietro.
    await page.click('[data-action="back"]');
    await page.waitForFunction(() => !location.hash.startsWith('#/uscita/'));
    await page.goForward();
    await page.waitForSelector('#panel-diario:not([hidden])');

    // Uscita senza foto: si apre su Dettagli e la tab Foto spiega che non ce ne sono.
    await nav(page, `#/uscita/${idB}`);
    assert.equal(await page.getAttribute('[role="tab"][data-tab="dettagli"]', 'aria-selected'), 'true');
    await page.click('[role="tab"][data-tab="foto"]');
    await page.waitForSelector('#panel-foto:has-text("Nessuna foto per questa uscita.")');
    await page.click('[role="tab"][data-tab="diario"]');
    await page.waitForSelector('#panel-diario:has-text("non è ancora scritto")');
  });

  test('diario: ordine cronologico, ricerca per titolo, località e testo del diario, filtro preferiti', async () => {
    await nav(page, '#/diario');
    const titles = await page.$$eval('.entry-item__title', (els) => els.map((e) => e.textContent));
    assert.deepEqual(titles, ['Tramonto a Bellagio', 'Uscita del 5 luglio']);
    await page.fill('input[name="q"]', 'CERNÒBBIO');
    await page.waitForFunction(() => document.querySelectorAll('.entry-item').length === 1);
    await page.fill('input[name="q"]', 'tramonto');
    await page.waitForFunction(() => document.querySelectorAll('.entry-item').length === 1);
    // Parole che compaiono solo nel ricordo scritto: l'uscita si trova e si vede l'estratto evidenziato.
    await page.fill('input[name="q"]', 'BRÉVA');
    await page.waitForFunction(() => document.querySelectorAll('.entry-item').length === 1);
    assert.equal(await page.textContent('.entry-item__snippet mark'), 'Breva');
    assert.match(await page.textContent('.entry-item__snippet'), /Dal diario:.*Ritorno con la Breva/);
    await page.fill('input[name="q"]', 'Portofino');
    await page.waitForSelector('text=Nessuna uscita corrisponde alla ricerca.');
    await page.fill('input[name="q"]', '');
    await page.waitForFunction(() => document.querySelectorAll('.entry-item').length === 2);
    await page.click('.segmented__btn[data-fav="1"]');
    await page.waitForFunction(() => document.querySelectorAll('.entry-item').length === 1);
    await page.click('.segmented__btn[data-fav="0"]');
    await page.waitForFunction(() => document.querySelectorAll('.entry-item').length === 2);
  });

  test('stagione: conteggi, mesi, foto preferite, località più frequenti, cambio anno', async () => {
    idC = await createEntry(page, { date: '2026-08-15', title: 'Ferragosto a Varenna', departure: 'Menaggio', destination: 'Varenna', favorite: true, photos: [F('IMG_0003.jpg').path] });
    await createEntry(page, { date: '2026-06-07', departure: 'cernobbio', destination: 'Varenna', rating: 4 });

    await nav(page, '#/stagione');
    assert.equal(await page.getAttribute('.day-chip[data-year="2026"]', 'aria-pressed'), 'true');
    assert.equal(await page.textContent('[data-testid="season-count"]'), '3');
    assert.equal(await page.textContent('[data-testid="season-photos"]'), '3');
    assert.equal(await page.textContent('[data-testid="season-favorites"]'), '2');
    assert.match(await page.textContent('.season-rating'), /Valutazione media 4,5 su 5/);
    const bars = await page.$$eval('.bars__value', (els) => els.map((e) => e.textContent.trim()));
    assert.deepEqual(bars, ['', '', '', '', '', '1', '', '1', '1', '', '', '']);
    assert.equal(await page.locator('.tile').count(), 3);
    const places = await page.$$eval('.places__item', (els) => els.map((e) => [...e.querySelector('.places__row').children].map((c) => c.textContent.trim()).join(' ')));
    assert.deepEqual(places, ['Cernobbio 2 volte', 'Varenna 2 volte', 'Bellagio 1 volta', 'Menaggio 1 volta']);
    assert.equal(await page.locator('.entry-item').count(), 3);

    await page.click('.day-chip[data-year="2025"]');
    await page.waitForFunction(() => location.hash === '#/stagione/2025');
    await page.waitForSelector('.day-chip[data-year="2025"][aria-pressed="true"]');
    assert.equal(await page.textContent('[data-testid="season-count"]'), '1');
    assert.equal(await page.textContent('[data-testid="season-photos"]'), '0');
    assert.equal(await page.locator('.places').count(), 0, 'nessuna località inventata');
    assert.equal(await page.locator('.season-rating').count(), 0);
  });

  test('eliminazione con conferma: annulla non tocca nulla, conferma elimina anche le foto', async () => {
    const photoIds = (await dumpDB(page)).entries.find((e) => e.id === idC).photoIds;
    await nav(page, `#/uscita/${idC}`);
    await page.click('[data-action="delete"]');
    await page.waitForSelector('text=Eliminare questo ricordo?');
    await clickButton(page, 'Annulla');
    assert.ok((await dumpDB(page)).entries.some((e) => e.id === idC));

    await page.click('[data-action="delete"]');
    await page.getByRole('button', { name: 'Elimina', exact: true }).click();
    await page.waitForURL(/#\/diario$/);
    const db = await dumpDB(page);
    assert.ok(!db.entries.some((e) => e.id === idC));
    assert.ok(!db.photos.some((p) => p.entryId === idC));
    assert.ok(photoIds.every((id) => !db.thumbs.includes(id)));
    assert.equal(db.entries.length, 3);
  });

  test('nessun errore JavaScript durante tutto il percorso', () => {
    assert.deepEqual(errors, []);
    assert.ok(idB);
  });
});

test('persistenza: i ricordi restano dopo la chiusura e la riapertura del browser', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'gaias-wake-profilo-'));
  let ctx = await launchPersistent(dir);
  let { page } = await openApp(ctx, srv.base);
  const id = await createEntry(page, { date: '2026-05-01', title: 'Prima uscita', photos: [F('IMG_0003.jpg').path] });
  const before = await dumpDB(page);
  await ctx.close();

  ctx = await launchPersistent(dir);
  ({ page } = await openApp(ctx, srv.base));
  assert.equal(await page.textContent('[data-testid="total-count"]'), '1');
  const after = await dumpDB(page);
  assert.deepEqual(after.entries, before.entries);
  assert.deepEqual(after.photos, before.photos);
  assert.equal(after.photos[0].sha, F('IMG_0003.jpg').sha);
  await nav(page, `#/uscita/${id}`);
  await page.waitForFunction(() => {
    const img = document.querySelector('.carousel img');
    return img && img.complete && img.naturalWidth > 0;
  });
  await ctx.close();
});

describe('backup completo', () => {
  let zipPath;
  let original;
  let ids;

  test('esportazione: archivio ZIP valido con backup.json e foto originali', async () => {
    const ctx = await newContext();
    const { page, errors } = await openApp(ctx, srv.base);
    ids = {
      a: await createEntry(page, { date: '2026-09-14', title: 'Tramonto verso Bellagio', departure: 'Cernobbio', destination: 'Bellagio', rating: 5, favorite: true, notes: 'Accenti: è, à, ò — e "virgolette".\nSeconda riga.', photos: [F('IMG_0001.jpg').path, F('IMG_0002.jpg').path] }),
      b: await createEntry(page, { date: '2026-08-15', title: 'Ferragosto', photos: [F('Tramonto.png').path] }),
      c: await createEntry(page, { date: '2025-07-05' }),
    };
    original = await dumpDB(page);

    await nav(page, '#/backup');
    assert.equal(await page.textContent('[data-testid="backup-entries"]'), '3');
    assert.equal(await page.textContent('[data-testid="backup-photos"]'), '3');
    await page.waitForSelector('text=possono però andare perse', { state: 'attached' }).catch(() => {});
    assert.match(await page.textContent('.soft-card--block'), /andare perse/);
    await page.click('[data-action="export"]');
    await page.waitForSelector('text=Backup pronto');
    const [download] = await Promise.all([page.waitForEvent('download'), clickButton(page, 'Scarica il file')]);
    assert.match(download.suggestedFilename(), /^gaias-wake-backup-\d{4}-\d{2}-\d{2}\.zip$/);
    zipPath = path.join(OUTPUT, 'backup-di-prova.zip');
    await download.saveAs(zipPath);
    await page.waitForSelector('[data-testid="backup-last"]:not(:text-is("mai"))');

    const bytes = await readFile(zipPath);
    const archive = await openZip(new Blob([bytes]));
    const manifest = JSON.parse(await archive.text('backup.json'));
    assert.equal(manifest.format, 'gaias-wake-backup');
    assert.equal(manifest.version, 1);
    assert.equal(manifest.entryCount, 3);
    assert.equal(manifest.photoCount, 3);
    assert.ok(archive.has('LEGGIMI.txt'));
    for (const e of manifest.entries) {
      for (const p of e.photos) {
        const data = await archive.read(p.file);
        assert.equal(sha256(data), original.photos.find((x) => x.id === p.id).sha, `foto ${p.file} identica`);
      }
    }
    try {
      const out = execFileSync('python3', ['-c', 'import zipfile,sys; print(zipfile.ZipFile(sys.argv[1]).testzip())', zipPath]).toString().trim();
      assert.equal(out, 'None', 'archivio verificato anche da zipfile di Python');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test('ripristino su un dispositivo vuoto: dati e foto identici', async () => {
    const ctx = await newContext();
    const { page, errors } = await openApp(ctx, srv.base, '#/backup');
    await page.setInputFiles('input[data-import]', zipPath);
    await page.waitForSelector('text=Importare il backup?');
    assert.match(await modalText(page), /3 nuove, da aggiungere/);
    await clickButton(page, 'Aggiungi le 3 nuove');
    await page.waitForSelector('.modal__title:text-is("Ripristino completato")');
    assert.match(await modalText(page), /3 uscite aggiunte.*3 fotografie ripristinate/s);
    await clickButton(page, 'Ho capito');

    const restored = await dumpDB(page);
    assert.deepEqual(byId(restored.entries), byId(original.entries));
    const strip = (list) => byId(list).map(({ id, entryId, name, type, size, sha }) => ({ id, entryId, name, type, size, sha }));
    assert.deepEqual(strip(restored.photos), strip(original.photos));

    await nav(page, `#/uscita/${ids.a}`);
    assert.equal(await page.textContent('.memory__text'), 'Accenti: è, à, ò — e "virgolette".\nSeconda riga.');
    // Dopo il ripristino le anteprime non esistono ancora: il carosello deve comunque mostrare l'originale (1600 px), non l'anteprima (720 px).
    await page.waitForFunction(() => document.querySelector('.carousel img')?.naturalWidth === 1600, null, { timeout: 15000 });
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => document.querySelector('.carousel img').naturalWidth), 1600, 'resta l’originale anche quando arriva l’anteprima');

    // Stesso backup una seconda volta: nessun doppione.
    await nav(page, '#/backup');
    await page.setInputFiles('input[data-import]', zipPath);
    await page.waitForSelector('text=Niente da importare');
    await clickButton(page, 'Ho capito');
    assert.equal((await dumpDB(page)).entries.length, 3);

    // Un'uscita modificata dopo il backup: viene sostituita solo dopo doppia conferma.
    await nav(page, `#/modifica/${ids.a}`);
    await page.fill('input[name="title"]', 'Titolo cambiato dopo il backup');
    await page.click('[data-action="save"]');
    await page.waitForSelector('.memory-page__title:text-is("Titolo cambiato dopo il backup")');
    await nav(page, '#/backup');
    await page.setInputFiles('input[data-import]', zipPath);
    await page.waitForSelector('text=Importare il backup?');
    assert.match(await modalText(page), /1 già presente ma diversa/);
    await clickButton(page, 'Sostituisci quella diversa');
    await page.waitForSelector('text=Sostituire i ricordi diversi?');
    await clickButton(page, 'Annulla');
    assert.equal((await dumpDB(page)).entries.find((e) => e.id === ids.a).title, 'Titolo cambiato dopo il backup', 'annullando non cambia nulla');

    await page.setInputFiles('input[data-import]', zipPath);
    await clickButton(page, 'Sostituisci quella diversa');
    await clickButton(page, 'Sostituisci');
    await page.waitForSelector('.modal__title:text-is("Ripristino completato")');
    await clickButton(page, 'Ho capito');
    const db = await dumpDB(page);
    assert.equal(db.entries.length, 3);
    assert.deepEqual(db.entries.find((e) => e.id === ids.a), original.entries.find((e) => e.id === ids.a));
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test('file non validi o danneggiati: messaggi chiari e nessun dato modificato', async () => {
    const ctx = await newContext();
    const { page } = await openApp(ctx, srv.base);
    await createEntry(page, { date: '2026-04-25', title: 'Uscita già presente' });
    const before = await dumpDB(page);
    const dir = await mkdtemp(path.join(tmpdir(), 'gaias-wake-bad-'));
    const write = async (name, data) => {
      const file = path.join(dir, name);
      await writeFile(file, data instanceof Blob ? Buffer.from(await data.arrayBuffer()) : data);
      return file;
    };
    const valid = await readFile(zipPath);
    const cases = [
      [await write('casuale.zip', Buffer.from(Array.from({ length: 4000 }, (_, i) => (i * 97) & 255))), /non è un backup leggibile/],
      [await write('altro.zip', await createZip([{ name: 'ciao.txt', data: 'ciao' }])), /manca il file backup\.json/],
      [await write('formato.zip', await createZip([{ name: 'backup.json', data: '{"format":"altro"}' }])), /non è un backup di Gaia’s Wake/],
      [await write('json-rotto.zip', await createZip([{ name: 'backup.json', data: '{ questo non è json' }])), /backup\.json è danneggiato/],
      [await write('futuro.zip', await createZip([{ name: 'backup.json', data: '{"format":"gaias-wake-backup","version":99,"entries":[]}' }])), /versione più recente/],
      [await write('troncato.zip', valid.subarray(0, Math.floor(valid.length * 0.6))), /non è un backup leggibile/],
      [await write('immagine.zip', await readFile(F('IMG_0001.jpg').path)), /non è un backup leggibile/],
    ];
    await nav(page, '#/backup');
    for (const [file, expected] of cases) {
      await page.setInputFiles('input[data-import]', file);
      await page.waitForSelector('.modal__title:text-is("Backup non valido")');
      const body = await modalText(page);
      assert.match(body, expected, path.basename(file));
      assert.match(body, /Nessun dato è stato modificato/);
      await clickButton(page, 'Ho capito');
      await page.waitForSelector('.modal-backdrop', { state: 'detached' });
    }
    assert.deepEqual(await dumpDB(page), before);

    // Backup con una foto danneggiata: l'uscita viene ripristinata, la foto rovinata viene segnalata.
    const good = await readFile(F('IMG_0001.jpg').path);
    const bad = await readFile(F('IMG_0002.jpg').path);
    const manifest = {
      format: 'gaias-wake-backup', version: 1, exportedAt: new Date().toISOString(), entryCount: 1, photoCount: 2,
      entries: [{
        id: 'entry-danneggiata-01', date: '2026-07-20', title: 'Con una foto rovinata', departure: '', destination: '', boatType: 'Gommone', crew: '', weather: '', wind: '', notes: '', rating: 3, favorite: false, createdAt: '2026-07-20T10:00:00.000Z', updatedAt: '2026-07-20T10:00:00.000Z',
        photos: [
          { id: 'photo-buona-0001', file: 'foto/a/01.jpg', name: 'buona.jpg', type: 'image/jpeg', size: good.length },
          { id: 'photo-rovinata-01', file: 'foto/a/02.jpg', name: 'rovinata.jpg', type: 'image/jpeg', size: bad.length },
        ],
      }],
    };
    const zip = new Uint8Array(await (await createZip([
      { name: 'backup.json', data: JSON.stringify(manifest) },
      { name: 'foto/a/01.jpg', data: new Uint8Array(good) },
      { name: 'foto/a/02.jpg', data: new Uint8Array(bad) },
    ])).arrayBuffer());
    const entry = (await openZip(new Blob([zip]))).entries.get('foto/a/02.jpg');
    zip[entry.offset + 30 + 'foto/a/02.jpg'.length + 500] ^= 0xff;
    await page.setInputFiles('input[data-import]', await write('foto-rovinata.zip', zip));
    await page.waitForSelector('text=Importare il backup?');
    await clickButton(page, 'Aggiungi la nuova');
    await page.waitForSelector('.modal__title:text-is("Ripristino completato con avvisi")');
    assert.match(await modalText(page), /foto\/a\/02\.jpg.*controllo di integrità/s);
    await clickButton(page, 'Ho capito');
    const db = await dumpDB(page);
    const restored = db.entries.find((e) => e.id === 'entry-danneggiata-01');
    assert.deepEqual(restored.photoIds, ['photo-buona-0001']);
    assert.equal(db.photos.find((p) => p.id === 'photo-buona-0001').sha, F('IMG_0001.jpg').sha);
    assert.ok(!db.photos.some((p) => p.id === 'photo-rovinata-01'));
    await ctx.close();
  });
});

test('mappa nel modulo: punto automatico, spostato a mano, salvato e conservato nel backup', async () => {
  const ctx = await newContext();
  const { page, errors } = await openApp(ctx, srv.base);
  await nav(page, '#/nuova');
  await fillForm(page, { date: '2026-07-12', title: 'Giro senza nome', destination: 'Portofino' });
  await page.locator('[data-picker]').scrollIntoViewIfNeeded();
  assert.match(await page.textContent('[data-status]'), /Scrivi un paese del lago/, 'luogo sconosciuto: nessun punto inventato');
  assert.equal(await page.isVisible('[data-pin]'), false);

  await page.fill('input[name="destination"]', 'Varenna, giro della Villa Monastero');
  await page.waitForFunction(() => /«Varenna»/.test(document.querySelector('[data-status]').textContent));
  assert.equal(await page.isVisible('[data-pin]'), true);

  const box = await page.locator('[data-picker]').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
  await page.waitForFunction(() => /scelto da te/.test(document.querySelector('[data-status]').textContent));
  await page.click('[data-action="save"]');
  await page.waitForSelector('.memory-page');
  let db = await dumpDB(page);
  const id = db.entries[0].id;
  assert.ok(Math.abs(db.entries[0].mapPoint.x - 0.5) < 0.02 && Math.abs(db.entries[0].mapPoint.y - 0.3) < 0.02, 'punto salvato dove è stato toccato');

  await nav(page, '#/');
  assert.deepEqual(await page.$$eval('.map-pin', (els) => els.map((e) => e.getAttribute('aria-label'))), ['Punto sulla mappa: 1 uscita']);
  const pos = await page.$eval('.map-pin', (el) => [parseFloat(el.style.left), parseFloat(el.style.top)]);
  assert.ok(Math.abs(pos[0] - 50) < 2 && Math.abs(pos[1] - 30) < 2);

  // «Usa il luogo scritto» riporta il punto su Varenna.
  await nav(page, `#/modifica/${id}`);
  await page.locator('[data-reset]').scrollIntoViewIfNeeded();
  await page.click('[data-reset]');
  await page.waitForFunction(() => /«Varenna»/.test(document.querySelector('[data-status]').textContent));
  await page.click('[data-action="save"]');
  await page.waitForSelector('.memory-page');
  db = await dumpDB(page);
  assert.equal(db.entries[0].mapPoint, null);

  // Il punto manuale sopravvive a esportazione e ripristino.
  await nav(page, `#/modifica/${id}`);
  const box2 = await page.locator('[data-picker]').boundingBox();
  await page.mouse.click(box2.x + box2.width * 0.25, box2.y + box2.height * 0.6);
  await page.click('[data-action="save"]');
  await page.waitForSelector('.memory-page');
  const saved = (await dumpDB(page)).entries[0].mapPoint;
  await nav(page, '#/backup');
  await page.click('[data-action="export"]');
  const [download] = await Promise.all([page.waitForEvent('download'), clickButton(page, 'Scarica il file')]);
  const file = path.join(OUTPUT, 'backup-mappa.zip');
  await download.saveAs(file);
  const ctx2 = await newContext();
  const { page: p2 } = await openApp(ctx2, srv.base, '#/backup');
  await p2.setInputFiles('input[data-import]', file);
  await clickButton(p2, 'Aggiungi la nuova');
  await p2.waitForSelector('.modal__title:text-is("Ripristino completato")');
  assert.deepEqual((await dumpDB(p2)).entries[0].mapPoint, saved);
  assert.deepEqual(errors, []);
  await ctx2.close();
  await ctx.close();
});

test('spazio esaurito: messaggio chiaro, modulo intatto, nuovo tentativo riuscito', async () => {
  const ctx = await newContext();
  const { page } = await openApp(ctx, srv.base);
  await nav(page, '#/nuova');
  await fillForm(page, { date: '2026-10-02', title: 'Memoria piena', photos: [F('IMG_0001.jpg').path] });
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    window.__restorePut = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = function put(value, key) {
      if (this.name === 'photos') throw new DOMException('Simulated quota', 'QuotaExceededError');
      return original.call(this, value, key);
    };
  });
  await page.click('[data-action="save"]');
  await page.waitForSelector('.modal__title:text-is("Salvataggio non riuscito")');
  assert.match(await modalText(page), /spazio disponibile sul dispositivo è esaurito/);
  await clickButton(page, 'Ho capito');
  assert.equal(await page.inputValue('input[name="title"]'), 'Memoria piena');
  assert.equal(await page.locator('.photo-tile').count(), 1);
  assert.equal((await dumpDB(page)).entries.length, 0);

  await page.evaluate(() => window.__restorePut());
  await page.click('[data-action="save"]');
  await page.waitForURL(/#\/uscita\//);
  const db = await dumpDB(page);
  assert.equal(db.entries.length, 1);
  assert.equal(db.photos[0].sha, F('IMG_0001.jpg').sha);
  await ctx.close();
});

test('uso offline: dopo la prima visita l’app si apre e funziona senza connessione', async (t) => {
  t.after(() => { srv.state.offline = false; });
  const ctx = await newContext();
  const { page, errors } = await openApp(ctx, srv.base);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await nav(page, '#/backup');
  await page.waitForSelector('text=Pronta per l’uso offline', { timeout: 20000 });

  const failed = [];
  page.on('requestfailed', (r) => failed.push(new URL(r.url()).pathname));
  await ctx.setOffline(true);
  srv.state.offline = true;
  const online = await page.evaluate(() => fetch(`./README.md?x=${Math.random()}`).then(() => true, () => false));
  assert.equal(online, false, 'la rete è davvero spenta');

  await page.reload();
  await page.waitForSelector('.topbar__title:text-is("Backup e dati")');
  assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), true);
  await nav(page, '#/');
  await page.waitForSelector('.brand__name');
  await page.waitForFunction(() => document.querySelector('.lake-map__img')?.complete);
  assert.equal(await page.evaluate(() => document.querySelector('.lake-map__img').naturalWidth > 0), true, 'mappa disponibile offline');

  const id = await createEntry(page, { date: '2026-10-01', title: 'Uscita offline', departure: 'Lenno', photos: [F('IMG_0002.jpg').path] });
  await page.waitForFunction(() => {
    const img = document.querySelector('.carousel img');
    return img && img.complete && img.naturalWidth > 0;
  });
  await nav(page, `#/modifica/${id}`);
  await page.fill('input[name="title"]', 'Uscita offline modificata');
  await addPhotos(page, [F('IMG_0003.jpg').path]);
  await page.click('[data-action="save"]');
  await page.waitForSelector('.memory-page__title:text-is("Uscita offline modificata")');
  assert.equal(await page.locator('.carousel__slide').count(), 2);
  for (const h of ['#/', '#/diario', '#/preferiti', '#/stagione']) await nav(page, h);
  await nav(page, `#/uscita/${id}`);
  await page.click('[data-action="delete"]');
  await page.getByRole('button', { name: 'Elimina', exact: true }).click();
  await page.waitForURL(/#\/diario$/);
  assert.equal((await dumpDB(page)).entries.length, 0);
  // L'unica richiesta fallita deve essere quella di controllo fatta apposta qui sopra.
  assert.deepEqual([...new Set(failed)], ['/README.md'], 'offline nessun file dell’app deve mancare');
  assert.ok(errors.every((e) => /Failed to load resource/.test(e)), errors.join('\n'));
  assert.ok(errors.length <= 1);
  srv.state.offline = false;
  await ctx.close();
});

test('aggiornamento dell’app: nuova versione installata senza perdere i ricordi', async () => {
  const ctx = await newContext();
  const { page } = await openApp(ctx, srv.base);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await createEntry(page, { date: '2026-09-01', title: 'Prima dell’aggiornamento', photos: [F('IMG_0001.jpg').path] });
  const before = await dumpDB(page);

  // "Pubblico" una nuova versione: copia dell'app con VERSION diversa nel service worker.
  const copy = await mkdtemp(path.join(tmpdir(), 'gaias-wake-v2-'));
  await cp(ROOT, copy, { recursive: true, filter: (src) => !/node_modules|[\\/]tests[\\/]output/.test(src) });
  const swFile = path.join(copy, 'service-worker.js');
  await writeFile(swFile, (await readFile(swFile, 'utf8')).replace(/const VERSION = '[^']+'/, "const VERSION = '9.9.9-test'"));
  srv.state.root = copy;
  try {
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.waitForSelector('.update-banner', { timeout: 20000 });
    await Promise.all([page.waitForEvent('load'), page.click('.update-banner [data-update]')]);
    await page.waitForSelector('.memory-page__title:text-is("Prima dell’aggiornamento")');
    const caches = await page.evaluate(() => caches.keys());
    assert.deepEqual(caches, ['gaias-wake-shell-9.9.9-test'], 'la cache vecchia è stata rimossa');
    const after = await dumpDB(page);
    assert.deepEqual(after.entries, before.entries);
    assert.deepEqual(after.photos, before.photos);
  } finally {
    srv.state.root = ROOT;
    await ctx.close();
  }
});

test('un anno fa oggi: calcolo degli anniversari', () => {
  const E = (date, id) => ({ id, date });
  const list = [E('2025-11-12', 'esatto'), E('2023-11-10', 'tre-anni'), E('2025-11-15', 'tra-tre'), E('2026-11-12', 'stesso-anno'), E('2025-11-20', 'lontano')];
  const got = onThisDay(list, '2026-11-12');
  assert.deepEqual(got.map((r) => r.entry.id), ['esatto', 'tre-anni', 'tra-tre'], 'prima oggi, poi i giorni vicini; mai l’anno in corso né date lontane');
  assert.deepEqual(got.map(onThisDayLabel), ['Un anno fa, oggi', '3 anni fa, il 10 novembre', 'Un anno fa, il 15 novembre']);
  assert.deepEqual(onThisDay([E('2025-12-31', 'capodanno')], '2027-01-01').map((r) => [r.entry.id, r.yearsAgo, r.days]), [['capodanno', 1, 1]], 'a cavallo dell’anno');
  assert.deepEqual(onThisDay([E('2024-02-29', 'bisestile')], '2025-02-28').map(onThisDayLabel), ['Un anno fa, oggi'], '29 febbraio negli anni non bisestili');
  assert.equal(onThisDayLabel({ entry: E('2025-11-08'), yearsAgo: 1, days: 4 }), 'Un anno fa, l’8 novembre');
  assert.deepEqual(onThisDay([E('non-una-data', 'x')], '2026-11-12'), []);
});

test('un anno fa oggi: il ricordo compare in Home e si apre', async () => {
  const ctx = await newContext();
  const { page } = await openApp(ctx, srv.base);
  // Oggi secondo il telefono (fuso di Roma), e la stessa data di un anno fa.
  const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const y = Number(today.slice(0, 4));
  const md = today.slice(5) === '02-29' ? '02-28' : today.slice(5);
  const far = new Date(Date.UTC(y - 1, Number(md.slice(0, 2)) - 1, Number(md.slice(3)) + 40)).toISOString().slice(0, 10);
  await nav(page, '#/');
  assert.equal(await page.locator('[data-testid="on-this-day"]').count(), 0, 'senza ricordi passati la sezione non c’è');
  const id = await createEntry(page, { date: `${y - 1}-${md}`, title: 'Gita di un anno fa', destination: 'Colico', photos: [F('IMG_0003.jpg').path] });
  await createEntry(page, { date: far, title: 'Troppo lontana' });
  await createEntry(page, { date: today, title: 'Uscita di oggi' });
  await nav(page, '#/');
  const card = page.locator('[data-testid="on-this-day"] .otd-card');
  assert.equal(await card.count(), 1);
  assert.equal(await card.locator('.otd-card__when').textContent(), 'Un anno fa, oggi');
  assert.equal(await card.locator('.otd-card__title').textContent(), 'Gita di un anno fa');
  await card.click();
  await page.waitForSelector('.memory-page__title');
  assert.ok(page.url().endsWith(`#/uscita/${id}`));
  await ctx.close();
});

test('layout mobile: nessuno scorrimento orizzontale, elementi toccabili, screenshot', async () => {
  const ctx = await newContext();
  const { page, errors } = await openApp(ctx, srv.base);
  const id = await createEntry(page, { date: '2026-09-14', title: 'Tramonto verso Bellagio, con un titolo piuttosto lungo per provare gli a capo', departure: 'Cernobbio', destination: 'Bellagio passando per l’Isola Comacina e Villa del Balbianello', crew: 'Gaia', weather: 'Sereno, 24 °C', wind: 'Breva leggera', rating: 4, favorite: true, notes: 'Una giornata limpida.', photos: [F('IMG_0001.jpg').path, F('IMG_0002.jpg').path, F('IMG_0003.jpg').path] });
  await createEntry(page, { date: '2026-08-15', title: 'Ferragosto a Varenna', departure: 'Menaggio', destination: 'Varenna', rating: 5, photos: [F('Tramonto.png').path] });
  await createEntry(page, { date: '2025-07-05' });

  const screens = [['home', '#/'], ['diario', '#/diario'], ['preferiti', '#/preferiti'], ['stagione', '#/stagione'], ['ricordo', `#/uscita/${id}`], ['nuova', '#/nuova'], ['backup', '#/backup']];
  for (const [vw, vh, label] of [[375, 667, 'iphone-se'], [390, 844, 'iphone-13'], [430, 932, 'iphone-pro-max']]) {
    await page.setViewportSize({ width: vw, height: vh });
    for (const [name, hash] of screens) {
      await nav(page, hash);
      await page.waitForTimeout(350);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, `${label} ${name}: scorrimento orizzontale di ${overflow}px`);
      const small = await page.evaluate(() => [...document.querySelectorAll('.tab, .round-btn, .btn, .chip, .rating__star, .segmented__btn, .day-chip, .map-pin')]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ t: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30), h: el.getBoundingClientRect().height, w: el.getBoundingClientRect().width }))
        .filter((r) => r.h < 44 || r.w < 44));
      assert.deepEqual(small, [], `${label} ${name}: elementi troppo piccoli da toccare`);
      await screenshot(page, `${label}-${name}`);
    }
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('progetto: nessuna risorsa esterna, cache offline completa, versioni allineate', async () => {
  const files = [];
  const walk = async (dir) => {
    for (const d of await readdir(dir, { withFileTypes: true })) {
      if (['node_modules', 'tests', 'tools', '.git'].includes(d.name)) continue;
      const full = path.join(dir, d.name);
      if (d.isDirectory()) await walk(full);
      else files.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  };
  await walk(ROOT);

  for (const f of files.filter((x) => /\.(html|js|css|webmanifest|svg|json)$/.test(x))) {
    const text = await readFile(path.join(ROOT, f), 'utf8');
    const urls = (text.match(/https?:\/\/[^\s"'<>)`]+/g) || []).filter((u) => u !== 'http://www.w3.org/2000/svg');
    assert.deepEqual(urls, [], `${f} non deve caricare nulla da Internet`);
  }

  const sw = await readFile(path.join(ROOT, 'service-worker.js'), 'utf8');
  const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  for (const f of shell) assert.ok(files.includes(f), `${f} è in cache ma non esiste`);
  const needed = files.filter((f) => /^(index\.html|styles\.css|app\.js|manifest\.webmanifest|js\/.*\.js|assets\/.*\.(svg|png|webp|woff2))$/.test(f));
  for (const f of needed) assert.ok(shell.includes(f), `${f} manca dalla cache offline del service worker`);

  const swVersion = sw.match(/const VERSION = '([^']+)'/)[1];
  const appVersion = (await readFile(path.join(ROOT, 'js', 'util.js'), 'utf8')).match(/APP_VERSION = '([^']+)'/)[1];
  assert.equal(swVersion, appVersion, 'VERSION del service worker e APP_VERSION devono coincidere');

  const manifest = JSON.parse(await readFile(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) assert.ok(files.includes(icon.src), `icona ${icon.src}`);
  const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  for (const [, ref] of html.matchAll(/(?:href|src)="([^"#:]+)"/g)) assert.ok(files.includes(ref), `index.html cita ${ref}`);
  assert.match(html, /rel="apple-touch-icon"/);
});
