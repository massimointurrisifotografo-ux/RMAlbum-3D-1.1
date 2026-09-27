import React from 'react';
import {useStore,useCurrentSpread} from '../store/store';
export function ContextGuide() {
  const spread=useCurrentSpread();
  const selected=useStore(s=>s.selectedCellId);
  const ids=useStore(s=>s.selectedCellIds);
  const count=selected ? (ids.includes(selected)?ids:[selected]).filter(id=>spread?.cells.some(c=>c.id===id)).length : 0;
  return <section className="context-guide" data-testid="context-guide" aria-label="Guida contestuale">
    <h3>Guida · {count>1?`${count} celle`:count===1?'Una cella':'Foglio'}</h3>
    <ul>
      {count>0 ? <>
        <li>Spostare {count>1?'le celle':'la cella'} — <b>Clicca e trascina</b></li>
        <li>Mantieni proporzioni — <b>Maiusc + punto angolare</b></li>
        <li>Seleziona più celle — <b>Cmd/Ctrl o Maiusc + clic</b></li>
        <li>Scambia foto tra celle — <b>Option/Alt e trascina</b>. Clicca la foto, poi tieni Option e rilasciala sulla destinazione.</li>
        <li><b>Aggancia:</b> allinea alle guide e alle altre celle.</li>
        {count===1 && <li><b>Foto:</b> usa lo zoom e trascina dentro l’anteprima per cambiare l’inquadratura.</li>}
        {count>1 && <li><b>Doppio clic:</b> seleziona una sola cella. Clic sul vuoto: deseleziona.</li>}
        <li><b>Cancella/Backspace:</b> elimina le celle selezionate, non gli originali.</li>
      </> : <>
        <li><b>Selezione a rettangolo:</b> parti dal foglio vuoto e trascina sulle celle.</li>
        <li><b>Foto:</b> clicca una miniatura per inserirla; se è già nel foglio attivo, il clic la rimuove.</li>
        <li><b>Sfondo:</b> scegli il colore e la parte del foglio a cui applicarlo.</li>
      </>}
      <li><b>← →:</b> cambia foglio. <b>↑ ↓:</b> cambia layout, quando non stai scrivendo nei campi.</li>
    </ul>
  </section>;
}
