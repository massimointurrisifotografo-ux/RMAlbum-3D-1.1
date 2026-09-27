import React, { useState } from 'react';
import { CoverSettings } from '../types';
import { coverGeometry, coverFromAlbum, validCover, normalizeCover } from '../lib/cover';
import { ARTIGIANO, artisanCover, spineFor } from '../lib/artigiano';
import { useStore } from '../store/store';
import { useToast } from './Toast';

const key='rmalbum-cover-presets-v1';
type Favorite={id:string;name:string;settings:CoverSettings};
function favorites():Favorite[] {
  try {const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a.filter(p=>p && typeof p.name==='string' && p.settings && validCover(p.settings)).map(p=>({...p,settings:normalizeCover(p.settings)})):[];}
  catch{return [];}
}
export function CoverDialog({onClose}:{onClose:()=>void}) {
  const project=useStore(s=>s.project!);
  const existing=useStore(s=>s.project!.spreads.find(sp=>sp.cover && sp.id===s.selectedSpreadId) ?? s.project!.spreads.find(sp=>sp.cover));
  const [c,setC]=useState<CoverSettings>(normalizeCover((existing?.cover) ?? coverFromAlbum(project)));
  const [items,setItems]=useState(favorites);
  const [favorite,setFavorite]=useState(existing?.cover?.artisanId ?? '');
  const show=useToast(s=>s.show);
  const g=coverGeometry(c);
  const unit=c.unit ?? 'cm', factor=unit==='mm'?10:1;
  const display=(v:number)=>Number((v*factor).toFixed(5));
  const chooseArtisan=(id:string,mode:CoverSettings['mode'])=>{
    const next=artisanCover(id,mode,project,unit);
    if(!next){show('Artigiano2030: misura del solo fronte non disponibile. Inseriscila manualmente oppure scegli la copertina completa.');return false;}
    setC(next);setFavorite(id);return true;
  };
  const valid=validCover(c) && g.width<=200 && g.height<=200;
  const persist=(next:Favorite[])=>{try{localStorage.setItem(key,JSON.stringify(next));setItems(next);return true;}catch{show('Preferito non salvato: spazio locale non disponibile');return false;}};
  const field=(name:'frontWidth'|'height'|'spine'|'hinge'|'wrap'|'bleed'|'safe'|'dpi',label:string,min=0)=> <div className="m-field" key={name}><label htmlFor={`cover-${name}`}>{label} ({name==='dpi'?'DPI':unit})</label><input id={`cover-${name}`} className="m-input" type="number" min={name==='dpi'?min:min*factor} step={name==='dpi'?1:0.01*factor} value={Number.isNaN(c[name])?'':name==='dpi'?c[name]:display(c[name])} onChange={e=>{const value=e.target.value===''?NaN:Number(e.target.value)/(name==='dpi'?1:factor);setC(current=>({...current,[name]:value}));}} data-testid={`cover-${name}`} /></div>;
  return <div className="modal-backdrop" role="dialog" aria-label="Copertina"><div className="modal cover-modal">
    <h2>Copertina</h2><p>Le nuove copertine partono da metà larghezza del foglio album e dalla sua altezza. Usa un preferito o modifica le misure secondo il laboratorio.</p>
    <div className="m-field"><label htmlFor="cover-unit">Unità di misura</label><select className="m-input" id="cover-unit" data-testid="cover-unit" value={unit} onChange={e=>setC({...c,unit:e.target.value as 'cm'|'mm'})}><option value="cm">Centimetri (cm)</option><option value="mm">Millimetri (mm)</option></select></div>
    <div className="m-field"><label htmlFor="cover-favorite">Preferiti copertina</label><select className="m-input" id="cover-favorite" data-testid="cover-favorite" value={favorite} onChange={e=>{
      const id=e.target.value;
      if(ARTIGIANO.some(p=>p.id===id)){chooseArtisan(id,c.mode);return;}
      setFavorite(id);const f=items.find(p=>p.id===id);if(f)setC({...f.settings,artisanId:undefined});
    }}><option value="">Scegli un preferito…</option><optgroup label="Artigiano">{ARTIGIANO.map(p=><option key={p.id} value={p.id} disabled={c.mode==='front' && !p.front}>{p.name}{c.mode==='front' && !p.front?' — solo fronte non disponibile':''}</option>)}</optgroup><optgroup label="Personali">{items.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</optgroup></select></div>
    <div className="m-field"><label htmlFor="cover-mode">Area da impaginare</label><select className="m-input" id="cover-mode" data-testid="cover-mode" value={c.mode} onChange={e=>{
      const mode=e.target.value as CoverSettings['mode'];
      if(c.artisanId){chooseArtisan(c.artisanId,mode);return;}
      setC({...c,mode});
    }}><option value="front">Solo fronte</option><option value="full">Retro, dorso e fronte</option></select></div>
    <div className="m-field"><label htmlFor="cover-sizing">Interpretazione delle misure</label><select id="cover-sizing" className="m-input" value={c.sizing ?? 'finished'} onChange={e=>{setFavorite('');setC({...c,sizing:e.target.value as 'file'|'finished',artisanId:undefined});}}><option value="finished">Misure finite + risvolti e abbondanze esterni</option><option value="file">Misure del file: risvolti e abbondanze già inclusi</option></select></div>
    <div className="m-grid">
    {field('frontWidth',c.mode==='full'?'Larghezza di ciascuna metà (esclusi dorso e cerniere)':c.sizing==='file'?'Larghezza file solo fronte':'Larghezza fronte finito',0.01)}
    {field('height',c.sizing==='file'?'Altezza file':'Altezza finita',0.01)}
    {c.mode==='full' && <>{field('spine','Larghezza dorso',0.01)}{field('hinge','Cerniera aggiuntiva per lato del dorso')}</>}
    {field('wrap',c.sizing==='file'?'Risvolto incluso, per lato':'Risvolto per lato esterno')}{field('bleed',c.sizing==='file'?'Abbondanza inclusa, per lato':'Abbondanza oltre il risvolto, per lato')}{field('safe','Margine di sicurezza interno')}{field('dpi','Risoluzione',72)}
    </div>
    {c.mode==='full' && <p>Dorso iniziale: 1 mm per foglio album, copertine escluse. <button className="btn btn-outline" data-testid="cover-spine-recalculate" onClick={()=>setC({...c,spine:spineFor(project)})}>Ricalcola: {display(spineFor(project))} {unit}</button> Il valore resta modificabile.</p>}
    <p data-testid="cover-total">{valid?`File totale: ${display(g.width)} × ${display(g.height)} ${unit}`:`Inserisci misure valide (file massimo ${200*factor} × ${200*factor} ${unit}).`}<br/>{c.sizing==='file'?'Risvolti e abbondanze sono guide interne: non aumentano il file.':'Risvolti e abbondanze vengono aggiunti alle misure finite.'} Le guide non vengono stampate.</p>
    <button className="btn btn-outline" disabled={!valid} onClick={()=>{const name=window.prompt('Nome del preferito:')?.trim();if(!name)return;const id=crypto.randomUUID();if(persist([...items,{id,name,settings:{...c}}])){setFavorite(id);show('Misure copertina salvate nei preferiti');}}}>Salva misure come preferito</button>
    {items.some(p=>p.id===favorite) && <button className="btn btn-outline" onClick={()=>{if(window.confirm('Eliminare questo preferito? Le copertine già create restano invariate.') && persist(items.filter(p=>p.id!==favorite)))setFavorite('');}}>Elimina preferito</button>}
    <div className="modal-actions"><button className="btn btn-outline" onClick={onClose}>Annulla</button><button className="btn btn-gold" disabled={!valid} data-testid="cover-apply" onClick={()=>{
      if(existing?.cells.length && JSON.stringify(existing.cover)!==JSON.stringify(c) && !window.confirm('Cambiare le misure adatta proporzionalmente le celle. Controlla i ritagli prima di stampare. Continuare?'))return;
      useStore.getState().setCover({...c});onClose();
    }}>{existing?'Applica e apri':'Crea copertina'}</button></div>
  </div></div>;
}
