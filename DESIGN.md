# Gaia’s Wake · Design

Un diario a inchiostro su carta: panna, blu navy e cobalto, azzurri pastello, tratti a incisione e acquerello.
Le regole qui sotto valgono per ogni schermata. I valori stanno come variabili in `styles.css` (`:root`): nelle regole si usano i nomi, mai i valori scritti a mano.

## Colore

Solo blu, bianco, azzurro e panna. **Mai verde, niente colori caldi.** Il rosso esiste solo per eliminare.

| Token | Valore | Ruolo |
|---|---|---|
| `--bg` | `#FBF8F1` | panna chiara, quasi bianca: sfondo delle pagine (con la grana `paper.webp`) |
| `--surface` | `#FFFFFF` | card, finestre, barre (si staccano dal fondo con il filo di `--shadow-1`) |
| `--surface-2` | `#F4EFE5` | fondo dei campi, chip spenti |
| `--ink` | `#1C2A44` | testo principale, titoli |
| `--ink-2` | `#33415C` | etichette, testo secondario forte |
| `--muted` | `#56657A` | testo di supporto, segnaposto |
| `--accent` | `#24467E` | navy: pulsanti principali, voce attiva, segnaposti |
| `--accent-2` | `#3B63A3` | cobalto: link, focus, stati selezionati |
| `--azure-50 … 300` | `#EEF2F9 … #A9C1E2` | fondi tenui, badge, decorazioni |
| `--azure-500` | `#5B7FBF` | icone decorative e linee d’acqua (non per il testo) |
| `--field-line` | `#6E84AE` | bordo dei campi |
| `--danger` | `#A23E4A` | solo «Elimina» |

Contrasti verificati (WCAG 2.2):

- testo `--ink` 11,9–14,3:1; `--muted` 4,9–5,9:1; `--accent-2` 5,0–6,0:1 su tutti i fondi chiari (panna, bianco, azzurri);
- bianco su `--accent` 9,3:1, su `--accent-2` 6,0:1; `--danger` su card 6,0:1;
- bordo dei campi `--field-line` ≥ 3,3:1 su carta, card e fondo dei campi (WCAG 1.4.11);
- `--azure-500` (3,3–3,8:1) solo per grafica, mai per il testo; `--azure-300` solo decorativo.

Non esiste un tema scuro: l’app è sempre «carta».

## Tipografia

Nessun font scaricato: si usano quelli già presenti nel telefono.

- **Titoli e numeri**: `--font-display` (Baskerville su iPhone). Titoli di schermata in maiuscolo spaziato (27px), titoli del ricordo 29px, titoli delle uscite nel diario 18px.
- **Testo**: `--font` (SF Pro), 16px di base; etichette 13,5px semibold; note 12–13px.
- **Corsivo calligrafico**: `--font-script` solo per «lago di como» e «Il ricordo di oggi».
- **Nomi sulla mappa**: `--font-hand`.

## Spazi e forme

- Margine laterale 16px; spazio tra sezioni 22px; dentro le card 14–20px.
- Raggi: `--r-xl` 26, `--r-lg` 22, `--r-md` 16, `--r-sm` 12; pillole e pulsanti tondi al 50%.
- Ombre: `--shadow-1` (card a riposo, con filo d’inchiostro) e `--shadow-2` (elementi sollevati: anteprime, finestre).
- Area da toccare almeno 44×44 punti (i segnaposti della mappa 46).

## Componenti

- **Pulsanti**: principale navy pieno; secondario carta con bordo; «ghost» cobalto; pericolo rosso. Alla pressione si rimpiccioliscono appena (0,98).
- **Card**: carta `--surface`, `--shadow-1`, raggio `--r-lg`.
- **Data nel diario**: riquadro azzurro con filo `--azure-200`, giorno in serif.
- **Campi**: fondo `--surface-2`, bordo `--field-line`; con il focus il fondo diventa carta e il bordo cobalto.
- **Barra in basso**: carta traslucida; voce attiva navy con lineetta (non solo colore).
- **Un anno fa oggi**: card azzurra con filo `--azure-200`, quando in corsivo calligrafico cobalto, titolo serif, piccola scia d’inchiostro che si disegna.
- **Stati vuoti**: piccola illustrazione a incisione (barchetta, cuore sull’acqua, sole all’orizzonte), titolo serif, una frase, un’azione.

## Immagini

- Le foto di Gaia si mostrano **sempre originali**: niente filtri, ritagli salvati o compressione. Le animazioni muovono solo il riquadro, mai i pixel.
- **Logo «Scia essenziale»** (`assets/icons/icon.svg`): fondo navy pieno, gommone bianco con Gaia al timone, scia a V, montagne del Lario a punta in secondo piano. Nell’app ha gli angoli arrotondati come l’icona dell’iPhone. Gli elementi con `class="dettaglio"` (gabbiani, tratteggio, increspature) spariscono nella favicon; dopo ogni modifica: `node tools/make-icons.mjs`.
- Le illustrazioni sono locali (`assets/illustrations`, SVG inline) e solo in inchiostro blu.
- Icone: set a tratto 1,8px in `js/ui.js`, mai emoji.

## Movimento

Ogni movimento deve aiutare a capire dove si è o cosa è successo; il resto è solo «acqua viva» sulla mappa.

| Token | Valore | Uso |
|---|---|---|
| `--dur-1` | 160ms | pressione, piccoli cambi di colore |
| `--dur-2` | 280ms | dissolvenze, finestre |
| `--dur-3` | 420ms | ingresso di pagine, pannelli e card |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | tutto ciò che entra |
| `--ease-float` | `cubic-bezier(0.45, 0, 0.55, 1)` | galleggiamento, riflessi |

- **Pagine**: un dettaglio entra da destra, tornando indietro si entra da sinistra; tra le sezioni della barra la pagina arriva dal lato della sezione scelta. Il modulo sfuma e la sua barra sale dal basso.
- **Card ed elenchi**: salgono di 10px una dopo l’altra (50ms di distanza, massimo 8 passi).
- **Schede Foto · Dettagli · Diario**: il pannello entra dal lato della scheda scelta; la pillola blu scorre con un piccolo rimbalzo.
- **Foto a schermo intero**: nasce dalla miniatura toccata (340ms).
- **Salvataggio**: spunta e scia chiara che attraversa il pulsante (520ms), poi si apre il ricordo.
- **Sempre in movimento**: un piccolo gommone naviga sulla mappa (Como → alto lago → Lecco → Como, sull'acqua, un giro in circa due minuti, fermo fuori schermo); una piccola onda a inchiostro scorre sotto i titoli delle pagine; una linea d'acqua azzurra scorre sopra la barra in basso.
- **Mappa (acqua viva)**: segnaposti che cadono e galleggiano come boe con un cerchio d’acqua; riflessi chiari che si accendono sull’acqua; la rotta si disegna e poi scorre come una scia. Il titolo scorre più lento della mappa (parallasse).

Regole:

1. Si animano solo `transform` e `opacity` (fluidi anche su iPhone); niente animazioni di larghezze, ombre o filtri.
2. Le animazioni continue sono leggere (mappa, stati vuoti, onde sotto i titoli e sopra la barra); quelle della mappa si fermano quando la mappa esce dallo schermo.
3. Con **Riduci movimento** (iPhone: Impostazioni › Accessibilità › Movimento) tutto si ferma: nessuna transizione, nessun galleggiamento, nessuna parallasse, nessuna attesa dopo il salvataggio.
4. Niente animazioni che rimandano un’azione oltre mezzo secondo.
