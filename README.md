# Gaia’s Wake

*Every ride leaves a memory.*

Gaia’s Wake è un diario personale delle uscite in barca sul Lago di Como: date, luoghi, persone a bordo, meteo, vento, una valutazione, le fotografie vere della giornata e due righe per ricordarla.

- In Home c’è una **mappa disegnata del Lago di Como**, a inchiostro blu su carta: ogni uscita è un punto, e toccandolo si aprono le sue foto e il diario di bordo.
- Funziona come app sull’iPhone (si aggiunge alla schermata Home da Safari).
- Dopo la prima apertura con Internet, funziona anche **senza connessione**.
- Tutti i dati e le foto restano **sul telefono**: niente account, niente server, niente pubblicità o statistiche.
- Le foto vengono salvate **originali**, senza filtri e senza compressione.
- Il backup completo (uscite + foto originali) è un unico file `.zip`.

> Gaia’s Wake è un diario di ricordi: **non** è uno strumento di navigazione né di sicurezza nautica.

---

## 1. Avviare il progetto sul computer (Windows)

Serve solo per provarlo sul PC prima di pubblicarlo. L’app pubblicata non ha bisogno del tuo computer acceso.

1. Installa **Node.js LTS** da <https://nodejs.org> (scegli “LTS”, installazione standard). Basta farlo una volta.
2. Apri la cartella `gaias-wake` in Esplora file.
3. Clicca sulla barra dell’indirizzo della cartella, scrivi `powershell` e premi Invio: si apre una finestra già posizionata nella cartella.
4. Scrivi:

   ```
   node tools\serve.mjs
   ```

5. Apri il browser (Edge o Chrome) all’indirizzo **http://localhost:8080**.
6. Per fermare il server: torna nella finestra di PowerShell e premi `Ctrl + C`.

Non servono `npm install`, Docker o altri programmi: il server di prova usa solo Node.js.
Se hai Python installato, in alternativa funziona anche `py -m http.server 8080`.

> Prova su `http://localhost`: lì l’uso offline funziona come in https.
> Per provarlo sull’iPhone, pubblica l’app (punto 2): sull’iPhone l’uso offline richiede un indirizzo **https**.

---

## 2. Pubblicarla gratis (GitHub Pages)

GitHub Pages ospita gratis siti statici in **https**, sempre accesi, senza abbonamento.

1. Crea un account gratuito su <https://github.com>.
2. In alto a destra: **+** › **New repository**.
   - Nome: `gaias-wake`
   - Visibilità: **Public** (con l’account gratuito, GitHub Pages richiede un repository pubblico).
   - Clicca **Create repository**.
3. Nella pagina del repository clicca **uploading an existing file** (oppure **Add file › Upload files**).
4. Trascina dentro **tutto il contenuto** della cartella `gaias-wake` (file e cartelle: `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `service-worker.js`, `.nojekyll`, le cartelle `js`, `assets`…).
   Non serve caricare `node_modules` né `tests/output`, se esistono.
5. In basso clicca **Commit changes**.
6. Vai su **Settings** › **Pages**.
   - *Source*: **Deploy from a branch**
   - *Branch*: **main** e cartella **/ (root)** › **Save**.
7. Dopo uno o due minuti, in cima alla stessa pagina compare l’indirizzo, ad esempio:
   **https://il-tuo-nome.github.io/gaias-wake/**

Aprilo per controllare che funzioni.

**Privacy:** nel repository pubblico c’è solo il codice dell’app. I ricordi e le foto di Gaia restano sul suo iPhone e non vengono mai caricati online.

*(Alternative altrettanto gratuite: Netlify o Cloudflare Pages, trascinando la cartella nel loro sito.)*

---

## 3. Inviare il link a Gaia su WhatsApp

Un esempio di messaggio:

> Ciao Gaia! Ti ho preparato un regalo: **Gaia’s Wake**, il diario delle tue uscite in barca sul lago 🌊
> Aprilo con **Safari** (non dentro WhatsApp): https://il-tuo-nome.github.io/gaias-wake/
> Poi tocca **Condividi** › **Aggiungi alla schermata Home**. Le istruzioni sono anche dentro l’app.

Importante: se tocca il link dentro WhatsApp si apre il browser interno di WhatsApp. Meglio tenere premuto il link e scegliere **Apri in Safari**, oppure copiarlo e incollarlo in Safari.

---

## 4. Aprirla sull’iPhone con Safari

Alla prima apertura compare la pagina **«Benvenuta a bordo»**, con la barchetta e i tre passi per aggiungerla alla schermata Home (se è aperta dentro WhatsApp o un’altra app, chiede prima di aprirla in Safari). Nell’app già installata la stessa pagina spiega in tre passi come si usa. Compare una volta sola, e mai a chi ha già dei ricordi; si può rivedere da **Backup e dati**.

1. Apri il link in **Safari**, con la connessione attiva (Wi-Fi o rete mobile).
2. Aspetta qualche secondo nella Home dell’app: compare il messaggio
   **“Gaia’s Wake è pronta: d’ora in poi si apre anche offline.”**

---

## 5. Aggiungerla alla schermata Home

1. In Safari tocca **Condividi** (il quadrato con la freccia verso l’alto). Su iOS 26, se non lo vedi, tocca prima **•••**; se la barra è ridotta, tocca l’indirizzo per farla ricomparire.
2. Tocca **Aggiungi alla schermata Home** (se non c’è, tocca **Visualizza altro** o scorri l’elenco). Lascia attivo **Apri come app web**, se compare, poi tocca **Aggiungi**.
3. Sulla schermata Home compare l’icona di Gaia’s Wake (il gommone sul lago).
4. **Da questo momento usa sempre l’icona.**

Perché è importante:

- Su iPhone l’app installata e Safari hanno **archivi separati**: i ricordi salvati aprendo il sito in Safari non compaiono nell’app installata, e viceversa. (Se è già successo: esporta un backup da Safari e importalo nell’app.)
- Per i siti aperti solo in Safari, iOS può cancellare i dati dopo alcune settimane di inattività. Le app aggiunte alla schermata Home sono più protette.

---

## 6. Usarla offline

Dopo la **prima apertura online** dall’icona, quando il messaggio “pronta anche offline” è comparso, l’app funziona anche senza rete: in barca, in modalità aereo, senza campo. Si possono:

- aprire l’app e consultare tutte le uscite;
- creare nuove uscite e aggiungere foto;
- vedere le foto, modificare ed eliminare i ricordi.

Per controllare: icona dell’archivio in alto a destra nella Home › **Backup e dati** › deve comparire **“Pronta per l’uso offline.”**

---

## 6 bis. La mappa disegnata

- Se come **luogo di partenza** o **destinazione** Gaia scrive un paese del lago (Como, Cernobbio, Bellagio, Varenna, Menaggio, Lenno, Isola Comacina, Dongo, Domaso, Colico, Lecco… anche con nomi come «Villa d’Este», «Balbianello», «Villa Carlotta», e nell’alto lago «Corenno Plinio», «Consiglio di Rumo», «Dascio», «Pian di Spagna», «Forte di Fuentes»), il punto compare da solo. In cima al lago la mappa scrive sempre Dongo e Colico; gli altri paesi compaiono quando Gaia ci va. Conta prima la destinazione, poi la partenza.
- Nel modulo dell’uscita, sezione **Punto sulla mappa**, può toccare la mappa per spostare il punto dove vuole; «Usa il luogo scritto» lo riporta sul paese.
- Le uscite nello stesso posto diventano un solo punto con il numero; toccandolo compare un’anteprima con foto, data e titolo, e una linea tratteggiata segue sull’acqua il percorso dalla partenza.
- Niente GPS e niente mappe online: il disegno è un file locale. È un ricordo, non una carta nautica.
- La mappa è «viva»: i segnaposti galleggiano come boe, sull’acqua si accendono piccoli riflessi e la rotta scorre come una scia. Sono animazioni leggere che si fermano quando la mappa non è sullo schermo.

## 6 ter. In questi giorni, sul lago

Nella Home, quando un’uscita degli anni passati cade oggi o a pochi giorni di distanza (fino a 3), compare la sezione **«In questi giorni, sul lago»**: per esempio «Un anno fa, oggi» oppure «3 anni fa, il 10 novembre». Toccandola si apre il ricordo. Se non ci sono ricordi in quei giorni, la sezione non compare.

## 6 quater. Animazioni

Le schermate scorrono nella direzione giusta (un ricordo entra da destra, tornando indietro da sinistra), le card compaiono una dopo l’altra, le foto si aprono dalla miniatura e salvando un’uscita il pulsante mostra una spunta con una piccola scia.
Se sull’iPhone è attivo **Impostazioni › Accessibilità › Movimento › Riduci movimento**, tutte le animazioni si spengono.
Le regole di colori, caratteri e movimento sono in [`DESIGN.md`](DESIGN.md).

## 7. Backup: esportare e ripristinare

I ricordi esistono solo su quel telefono. **Possono andare persi** se si cancellano i dati di Safari o del sito, se si rimuove l’app dalla schermata Home, se il telefono viene reimpostato, sostituito o perso.
**Il backup periodico è fondamentale**: per esempio una volta al mese e dopo ogni uscita importante. L’app ricorda nella Home quando è passato troppo tempo dall’ultimo backup.

### Esportare

1. Home › icona dell’archivio in alto a destra › **Backup e dati**.
2. **Esporta i miei ricordi**.
3. Scegli **Salva in File…** › **Salva in File** › una cartella (consigliato **iCloud Drive**), oppure **Scarica il file**.
4. Il file si chiama `gaias-wake-backup-AAAA-MM-GG.zip`.

Conviene tenere una copia anche fuori dal telefono (iCloud Drive, computer, chiavetta).
Dentro il file `.zip` ci sono:

- `backup.json` – la descrizione di tutte le uscite;
- `foto/` – le fotografie originali, una cartella per uscita (si aprono anche da Windows);
- `LEGGIMI.txt` – una breve spiegazione.

### Ripristinare

1. **Backup e dati** › **Importa un backup** › scegli il file `.zip` (da File / iCloud Drive).
2. L’app controlla il file e mostra un riepilogo: uscite **nuove**, **già presenti e identiche**, **già presenti ma diverse**.
3. Scegli:
   - **Aggiungi le nuove** – aggiunge solo quelle che mancano, senza toccare le altre;
   - **Sostituisci le diverse** – solo se vuoi riportare quelle uscite alla versione del backup (viene chiesta una seconda conferma).
4. Le uscite già presenti non vengono mai duplicate.

Se il file non è un backup valido, è incompleto o danneggiato, l’app lo dice chiaramente e **non modifica nulla**. Se una singola foto nell’archivio è rovinata, le altre vengono ripristinate e quella viene segnalata.

---

## 8. Pubblicare un aggiornamento dell’app

1. Modifica i file.
2. Aumenta il numero di versione in **due** punti, con lo stesso valore (es. `1.1.1`):
   - `service-worker.js` › `const VERSION = '1.1.1';`
   - `js/util.js` › `export const APP_VERSION = '1.1.1';`
3. Carica i file modificati su GitHub (**Add file › Upload files**, sovrascrivendo).

La volta successiva che Gaia apre l’app online compare **“È disponibile una nuova versione” › Aggiorna**. L’aggiornamento cambia solo i file dell’app: **uscite e foto non vengono toccate**.

---

## 9. Test (per chi sviluppa)

I test automatici usano Playwright con Chromium, in una finestra grande come un iPhone 13.

```
npm install
npm test
```

Per non scaricare un browser in più puoi usare Chrome o Edge già installati:

```
$env:CHROMIUM_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm test
```

(altrimenti, una sola volta: `npx playwright install chromium`).

I test controllano:

- creazione, modifica (titolo, foto aggiunte e tolte, copertina) ed eliminazione con conferma;
- foto salvate **identiche all’originale byte per byte** (impronta SHA-256), anteprime separate;
- solo la data obbligatoria, e nella pagina del ricordo solo i campi compilati;
- persistenza dopo la chiusura e la riapertura del browser;
- benvenuto: solo alla prima apertura, passi giusti in Safari, nell’app installata e dentro un’altra app, Annulla e Indietro che restano nell’app, mai a chi ha già avuto ricordi;
- «un anno fa oggi»: anniversari esatti e vicini, a cavallo di Capodanno, 29 febbraio, apertura del ricordo dalla Home;
- preferiti, galleria, ricerca per titolo, località o parole del diario (senza badare ad accenti e maiuscole, con l’estratto evidenziato), filtro;
- riepilogo stagionale (conteggi, mesi, località più frequenti, cambio anno);
- esportazione e ripristino completo, archivio verificato anche con un programma esterno, nessun doppione, sostituzione solo dopo conferma;
- file non validi, troncati o con foto danneggiate;
- spazio esaurito (simulato): messaggio chiaro e modulo intatto;
- uso offline dopo la prima visita (rete davvero interrotta): apertura, creazione, foto, modifica, eliminazione;
- aggiornamento a una nuova versione senza perdere i dati;
- pagina del ricordo con le tab Foto · Dettagli · Diario (anche da tastiera, e la tab resta scelta tornando indietro);
- mappa disegnata: punto automatico esattamente sul paese scritto, nessun punto per i luoghi sconosciuti, anteprima, rotta, punto spostato a mano e conservato anche dal backup;
- layout su schermi da 375, 390 e 430 punti: nessuno scorrimento orizzontale, pulsanti di almeno 44 punti;
- nessuna risorsa scaricata da Internet.

Gli screenshot delle schermate finiscono in `tests/output/screens/`.

La mappa nasce dal generatore `tools/build-map.mjs`, che usa la stessa geometria dell’app (`js/lake-map.js`: contorno del lago e paesi): per rigenerarla `node tools/build-map.mjs`; per le icone `npm run icons`.

**Cosa non è stato verificato:** i test girano su Chromium nel computer, **non su un iPhone vero né su Safari**. Prima di regalarla conviene una prova sul telefono: installazione dalla schermata Home, scelta delle foto dalla libreria, uso in modalità aereo, esportazione in File e ripristino.

---

## 10. Limiti da conoscere

- Lo spazio disponibile dipende dall’iPhone; se finisce, l’app avvisa e non perde ciò che era già salvato.
- Un singolo file di backup può contenere fino a 4 GB di foto.
- Se il telefono passa una foto in formato HEIC, l’originale viene comunque salvato; l’anteprima dipende dal supporto del browser (su iPhone di norma Safari consegna già un JPEG).
- Niente GPS, mappe, meteo automatico, login, sincronizzazione o condivisione social: per scelta.

---

## Struttura del progetto

```
gaias-wake/
├─ index.html              pagina unica dell’app
├─ styles.css              stile (carta panna, inchiostro blu, azzurro pastello; animazioni leggere)
├─ DESIGN.md               colori, caratteri, componenti e regole del movimento
├─ app.js                  avvio, navigazione tra le schermate, service worker
├─ manifest.webmanifest    nome, icone, installazione
├─ service-worker.js       file in cache per l’uso offline e aggiornamenti
├─ js/
│  ├─ lake-map.js          geometria della mappa del lago, paesi riconosciuti, rotte sull’acqua
│  ├─ map-view.js          mappa in Home (punti, anteprima) e nel modulo (spostare il punto)
│  ├─ motion.js            transizioni, parallasse, apertura foto, scia del salvataggio
│  ├─ db.js                archivio IndexedDB (uscite, foto originali, anteprime)
│  ├─ photos.js            anteprime e caricamento delle immagini
│  ├─ zip.js               lettura/scrittura ZIP senza librerie esterne
│  ├─ backup.js            esportazione e importazione dei backup
│  ├─ ui.js, components.js finestre, avvisi, icone, pezzi di interfaccia
│  ├─ util.js              date in italiano, testi, versione
│  └─ views/               Home, Diario, Preferiti, Stagione, Ricordo, Modulo, Backup
├─ assets/
│  ├─ illustrations/       la mappa disegnata del lago (WebP)
│  ├─ textures/            grana della carta
│  └─ icons/               icone dell’app (PNG per iPhone, SVG)
├─ tools/                  server di prova, generatore della mappa e delle icone (solo sviluppo)
└─ tests/                  test automatici (solo sviluppo)
```

Nessuna dipendenza esterna nell’app: niente framework, niente CDN, niente librerie ZIP, niente font da scaricare: su iPhone si usano i caratteri già presenti nel telefono (Baskerville per i titoli, Snell Roundhand per le scritte in corsivo, Bradley Hand per i nomi sulla mappa, SF Pro per il testo); su Windows compaiono caratteri simili. Playwright serve solo per i test e per rigenerare immagini e icone.
