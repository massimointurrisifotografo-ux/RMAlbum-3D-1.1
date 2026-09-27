# RMAlbum — Configuratore & Anteprima 3D (BETA) — PRD

## Problem statement (originale)
Estendere l'app esistente **RMAlbum v9** (React 18 + TypeScript + Vite + Zustand + IndexedDB, editor locale per impaginare album fotografici, UI in italiano, palette marrone/oro/avorio) con un modulo beta "Configuratore & Anteprima 3D Album":
- anteprima 3D realtime (react-three-fiber) di album (3 orientamenti), Box C (conchiglia) e Box G (plexiglas), proporzioni da misure reali;
- catalogo materiali reale dal PDF "materiali album" (famiglie beta: TELA, CORTECCIA, ECO LISCIO, VELLUTINO) con **codici articolo laboratorio reali** (non negoziabile, nessun dato inventato);
- configurazioni salvate su MongoDB (per futuro modulo FTP), link cliente read-only pubblicato esplicitamente, revocabile.
- Vincoli utente: NON ricostruire l'editor; l'anteprima legge l'impaginato senza modificarlo; modelli beta = "fronte foto + retro/dorso materiale" e "tutta materiale" (Basic esclusa per ora); superfici configurabili: copertina, dorso, Box C esterno, Box C interno, Box G; Box C non disponibile per album verticale; plexiglas nascondibile solo in anteprima; dati mancanti segnalati, mai inventati. Budget: 80 crediti.

## Architettura
- `/app/frontend` = RMAlbum v9 (Vite, porta 3000, `envPrefix REACT_APP_`, HMR clientPort 443). Editor originale intatto. Aggiunte: `lib/api.ts`, `lib/config3d.ts`, `lib/coverPreview.ts`, `components/Preview3D.tsx`, `ConfigPanel.tsx`, `MaterialPicker.tsx`, `AuthDialog.tsx`, `SharePage.tsx`, `components/three/{Scene,AlbumModel,BoxC,BoxG,materials}.tsx`, pulsante `tb-3d` in TopBar, route `/share/:token` in App.tsx. `package.json` con `resolutions` @types/react 18.
- `/app/backend/server.py` FastAPI + Mongo: auth JWT (cookie httpOnly + Bearer, bcrypt, lockout 5 tentativi), `GET /api/catalog`, `GET /api/assets/catalog/*` (swatch e texture estratte dal PDF), `/api/configs` CRUD (auth + proprietario), `/api/configs/{id}/previews/{coverFront|boxInterior}` (Emergent Object Storage, servite da `GET /api/files/{path}`), `/publish` (snapshot + token `secrets.token_urlsafe(32)`, scadenza opzionale), `/revoke`, `GET /api/share/{token}` (pubblico, solo snapshot pubblicato).
- `/app/backend/catalog/extract_from_pdf.py` → `catalog.json` + `assets/` (93 varianti, 4 famiglie; T114 fuori produzione). Seed idempotente allo startup.
- Riferimenti originali dell'utente in `/app/reference` (ZIP progetto, PDF, foto Box C/G).

## Dati derivati / ipotesi dichiarate (mostrate in UI)
- Piatto visibile = regione fronte del file copertina esclusi risvolti/abbondanze; nel file "solo fronte" Artigiano il risvolto è su tre lati (lato dorso senza) quando coincide con la larghezza pagina → Artigiano3030 = quadrato 30.5×30.5.
- Dorso = `cover.spine` (1 mm/foglio). Spessore piatto 0.3 cm indicativo (modificabile).
- Misure box NON nel catalogo: pareti/gioco/plexiglas indicativi e modificabili con avviso.
- Scala texture: campione PDF assunto 10 cm (nessuna misura nel PDF). Resa 3D = simulazione, non prova colore.

## Implementato (2026-09-24)
- [x] Import RMAlbum v9 in /app/frontend (editor, salvataggi IndexedDB, export intatti)
- [x] Estrazione catalogo dal PDF (codici verificati pagina per pagina) + API + seed
- [x] Auth JWT, configs con ownership, previews su object storage, publish/revoke/share
- [x] Album 3D parametrico (fronte foto da spread copertina o materiale; dorso separato), Box C animato con interno foto (ritaglio indipendente) o tessuto, Box G con plexiglas + 4 viti, toggle solo anteprima
- [x] Pannello accordion 2 colonne, badge materiale/codice per superficie, riepilogo, dati mancanti
- [x] Pagina cliente read-only /share/:token
- [x] Correzione (richiesta utente): superfici album = **Fronte copertina** (materiale proprio o fotografia) e **Dorso e retro** (sempre stesso materiale); chiave dati `materials.cover` = fronte, `materials.spine` = dorso+retro.
- Test: `test_reports/iteration_1.json` backend 16/16, frontend ok; fix orientamento Artigiano (risvolto su tre lati) verificato con screenshot.

## Limiti noti
- Import foto via showOpenFilePicker non automatizzabile in Playwright (flusso fronte fotografico verificato solo a livello di rendering spread con sfondo).
- Modello copertina "Basic" (grafica continua fronte-dorso-retro) escluso dalla beta su richiesta.

## Backlog
- P1: modello "Basic" (texture continua da file `full`), scadenza link configurabile in UI, lista configurazioni salvate per progetto.
- P2: misure box reali dal laboratorio (sostituire valori indicativi), textures con misura fisica reale dei campioni, export JSON per modulo FTP, altre famiglie del PDF (27 restanti).
