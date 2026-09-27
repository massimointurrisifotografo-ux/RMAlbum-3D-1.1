# Aggiornamento editor e configuratore — 26 settembre

- Configurazione 3D incorporata nel progetto locale: materiali, box, misure, foto interna e note. Salvataggio automatico dopo le modifiche e prima del ritorno all'editor. Nessun account necessario. Se il salvataggio fallisce le impostazioni restano in memoria e viene segnalato l'errore.
- Salva con nome duplica anche la configurazione e ricollega la foto interna del box alla copia del progetto.
- Catalogo locale mantenuto: 4 famiglie e 93 varianti.
- Box G: pareti 3 cm, gioco 0,2 cm, plexiglas 0,4 cm alla scelta del modello. Valori in Modifica manuale, chiusa inizialmente.
- Fascia laterale 2,5 cm e piatto 0,3 cm restano predefiniti, in Modifica manuale chiusa.
- Artigiano solo fronte: risvolto 1,5 cm e sicurezza 1 cm, senza cambiare formato del file. Migrazione dei vecchi preset Artigiano riconosciuti con risvolto 2,5; le misure personalizzate non vengono sovrascritte. Il centimetro di sicurezza resta visibile nel 3D.
- Esempio Artigiano3030: file 33 × 35,5; area foto visibile 30 × 32,5; fascia 2,5; copertina completa 32,5 × 32,5 cm. Copertine complete conservano le misure file già concordate.
- Contatore interni accanto a Fogli Album, copertine escluse.
- Scambio: clic sulla foto, poi Option/Alt durante il trascinamento. La cella resta ferma; miniatura al cursore; rilascio sulla destinazione senza evidenziarla. Rilascio fuori dalle celle non scambia.
- Guida contestuale aggiornata. Importazione nella sola libreria. Menu File: Nuovo, Apri, Salva, Salva con nome.
- Miniature intere anche verticali; anteprima proprietà con proporzioni corrette.
- Rotazione foto da −45° a +45°, cursore e campo numerico sotto Zoom. Solo la foto ruota; celle e bordi restano fermi. Riempimento automatico senza angoli vuoti. Rotazione conservata nel progetto, nei cambi layout, nell'anteprima 3D e nell'export.

## Verifiche

TypeScript, build di produzione, test regressione e 410 casi geometrici. Prova dei gestori reali dello scambio con Option premuto dopo il clic. Verifica nel browser del recupero di Box G e note dopo ritorno all'editor e ricarica. Confronto pixel export/anteprima di due immagini sintetiche ruotate: nessuna differenza su 2.880.000 canali.

## Salvataggi

Usare lo stesso browser, profilo e indirizzo (localhost:3000). I progetti restano nei dati locali del browser: non usare incognito e non cancellarli. Nessun album esistente eliminato o trasferito. Vecchie configurazioni presenti soltanto su Emergent non vengono importate automaticamente. In questa versione la pubblicazione link è sospesa; integrazione gallery e app Mac restano rimandate.
