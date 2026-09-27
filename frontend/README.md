# RMAlbum

Web app **locale** per l'impaginazione di album fotografici destinati alla stampa.
Funziona interamente nel browser: nessun account, nessun login, nessun server, nessun
caricamento delle foto online. Dati e foto restano sul tuo computer.

Stack: **React + TypeScript + Vite + IndexedDB + Konva (react-konva)**.

---

## Requisiti

- Node.js 18+ (consigliato 20)
- Browser **Chrome** o **Edge** (necessari per conservare l'accesso agli originali
  tramite la File System Access API)

## Avvio in locale (Mac)

```bash
npm install
npm run dev
```

Apri l'indirizzo indicato nel terminale (di norma `http://localhost:3000`).

## Build di produzione

```bash
npm run build      # genera la cartella dist/
npm run preview    # serve la build su http://localhost:3000
```

---

## Dove vengono salvati progetti e anteprime

Tutto è salvato **localmente in IndexedDB** del browser (database `rmalbum`), negli store:

- `projects` — nome, misure, DPI, margini, doppie pagine, celle, zoom, punto focale,
  bordi, colori, ordine pagine e `schemaVersion` (per aggiornamenti futuri del formato);
- `photos` — per ogni foto: **anteprima di lavoro** (~1100 px lato lungo) e **miniatura**,
  più il riferimento all'originale (handle) quando il browser lo consente;
- `layouts` — i tuoi **layout personali** (coordinate proporzionali 0–1, riutilizzabili
  in tutti i progetti);
- `presets` — i **profili misure preferiti** (max 10).

Gli **originali NON vengono copiati** in IndexedDB: si conserva solo un riferimento
(handle) al file sul disco. Gli originali si usano **solo in fase di esportazione**.

## Ricollegamento degli originali

Il browser può perdere il permesso di accesso agli originali dopo la chiusura, oppure
il progetto può essere aperto su un altro computer. In questi casi:

1. il progetto resta comunque apribile e modificabile usando le **anteprime**;
2. le foto senza originale mostrano un avviso **⚠ Ricollega** nella libreria in basso;
3. prima dell'esportazione ad alta risoluzione clicca **Ricollega** e riseleziona il file.

In fase di esportazione, se manca un originale l'app **non finge** di aver esportato in
alta risoluzione: mostra un avviso con l'elenco dei file da ricollegare.

## Esportazione

- JPEG per la stampa, un file per doppia pagina, con nomi progressivi `001.jpg`, `002.jpg`…
- "Doppia pagina corrente" oppure "Tutte in ZIP".
- Risoluzione calcolata come `pixel = cm / 2,54 × DPI`.
  Esempio: 61 × 30,5 cm a 300 DPI ≈ **7205 × 3602 px**.
- Vengono rispettati: misure fisiche, DPI, posizione/dimensioni celle, ritaglio (aspect
  fill), zoom, punto focale, bordo interno, colori di sfondo e ordine delle pagine.
- La qualità JPEG è selezionabile.

---

## Limiti tecnici del browser

- **File System Access API** (accesso persistente agli originali) è disponibile solo su
  Chrome/Edge desktop. Su altri browser l'import funziona ma gli originali risultano da
  ricollegare prima dell'esportazione.
- I permessi di lettura dei file possono richiedere una nuova conferma dopo il riavvio
  del browser (avviene al primo export).
- L'esportazione ad alta risoluzione carica gli originali in memoria: viene elaborata
  **una doppia pagina alla volta** per limitare l'uso di RAM. File molto grandi o album
  molto lunghi possono comunque richiedere alcuni secondi.
- La dimensione massima del canvas dipende dal browser (in Chrome il limite pratico è
  ampiamente sufficiente per 300 DPI su formati tipo 61×30,5 cm).
- IndexedDB ha una quota di spazio gestita dal browser: le anteprime sono leggere, ma
  molti progetti con centinaia di foto possono richiedere spazio; i dati restano locali.

## Funzioni escluse (per scelta, MVP)

Copertina, dorso, testi/didascalie, selezione multipla, snapping/allineamenti, righelli,
undo/redo avanzati, stelle/metadati/XMP, AI, autoimpaginazione dell'intero album, PDF,
profili ICC/CMYK, cloud e account.
