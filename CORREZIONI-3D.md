# Correzioni della beta 3D

## Implementato

- Pubblica link cliente rigenera sempre le anteprime dall'impaginato corrente, attende il caricamento e salva prima di pubblicare, anche se non è stata modificata un'opzione del configuratore.
- Una fotografia mancante o non leggibile blocca la pubblicazione con un messaggio. Le anteprime non più utilizzate vengono cancellate dai riferimenti della configurazione. I file remoti già caricati non vengono eliminati.
- Il fronte 3D esclude i risvolti e le abbondanze impostati nell'editor su tutti e quattro i lati. Rimossa l'ipotesi automatica di assenza del risvolto sul lato dorso. Per i preferiti con risvolto di 2,5 cm il ritaglio esclude effettivamente 2,5 cm per lato. Nessuna modifica all'esportazione per la stampa.
- Box C: materiali del vano e dell'interno coperchio indipendenti, con riepilogo aggiornato anche nel link cliente. Le vecchie configurazioni conservano inizialmente il materiale condiviso; cambiare il vano non cambia il coperchio. Passare alla foto non cancella la scelta del tessuto.

## Attenzione alle dimensioni

Il file solo fronte Artigiano3030 di 33 × 35,5 cm, tolti 2,5 cm per lato, ha area fotografica visibile 28 × 30,5 cm. Ora il 3D aggiunge a sinistra una fascia in materiale di 2,5 cm: la copertina completa misura 30,5 × 30,5 cm ed è quadrata, quindi Box C è disponibile. La foto non viene allargata. La fascia usa il materiale del dorso/retro e non è lo spessore del dorso.

Nel pannello Album la fascia è regolabile da 0 a 10 cm e viene salvata nella configurazione e pubblicata nel link. Le misure dei box seguono la copertina completa. Il valore predefinito di 2,5 cm si applica alle copertine solo fronte; le copertine complete non ricevono un'aggiunta automatica. Le configurazioni precedenti vengono ricalcolate quando si riapre il configuratore; un link già pubblicato non cambia finché non si pubblica di nuovo. Risvolti, file di stampa e impaginato restano invariati.

## Rimandato, come richiesto

Basic continua esclusa; integrazione gallery e protezione dei file dopo revoca; qualità delle texture; verifica completa dell'installazione/deployment. Non sono state inventate compatibilità tra materiali e superfici o misure ufficiali dei box. Le note tecniche precedenti del progetto sono storiche.

## Verifiche

Controllo TypeScript e build di produzione. Test isolati in check-fixes.cjs: geometria risvolti, riepilogo materiali e retrocompatibilità, pubblicazione con configurazione apparentemente non modificata, ordine rigenerazione/upload/salvataggio/pubblicazione, rimozione anteprima obsoleta e blocco in caso di errore. API simulate, nessuna scrittura su MongoDB o storage reale. Il collaudo completo su Emergent resta necessario prima della consegna ai clienti.

Questa è una copia aggiornata del progetto Emergent, non un'app Mac autonoma. Mantieni la configurazione dell'ambiente e i segreti sul server, senza inserirli nello ZIP. Il database e i file remoti non sono inclusi.
