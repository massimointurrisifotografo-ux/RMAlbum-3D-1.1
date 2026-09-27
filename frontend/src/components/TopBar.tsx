import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { recordToPhoto } from '../lib/photos';
import { copyProject, getPhotosByProject } from '../db/database';
import { useToast } from './Toast';
import { IconPlus, IconFolder, IconSave, IconImage, IconDownload, IconEye, IconLeft, IconRight } from './Icons';

interface Props {
  onNew: () => void;
  onOpenStart: () => void;
  onExport: () => void;
  onSettings: () => void;
  onCover: () => void;
  on3D: () => void;
}

export function TopBar({ onNew, onOpenStart, onExport, onSettings, onCover, on3D }: Props) {
  const fileMenu = useRef<HTMLDetailsElement>(null);
  const [menuPosition,setMenuPosition] = useState({left:0,top:0});
  useEffect(() => {
    const close = () => fileMenu.current?.removeAttribute('open');
    const outside = (e:PointerEvent) => {if(!fileMenu.current?.contains(e.target as Node))close();};
    const key = (e:KeyboardEvent) => {if(e.key==='Escape' && fileMenu.current?.open){close();fileMenu.current.querySelector('summary')?.focus();}};
    window.addEventListener('resize',close);
    window.addEventListener('scroll',close,true);
    window.addEventListener('pointerdown',outside);
    window.addEventListener('keydown',key);
    return () => {window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',key);};
  },[]);
  const project = useStore((s) => s.project)!;
  const dirty = useStore((s) => s.dirty);
  const save = useStore((s) => s.save);
  const showGuides = useStore((s) => s.showGuides);
  const setShowGuides = useStore((s) => s.setShowGuides);
  const snapToGuides = useStore((s) => s.project?.snapToGuides ?? true);
  const setSnapToGuides = useStore((s) => s.setSnapToGuides);
  const leftOpen = useStore((s) => s.leftOpen);
  const layoutOpen = useStore((s) => s.layoutOpen);
  const setLayoutOpen = useStore((s) => s.setLayoutOpen);
  const setLeftOpen = useStore((s) => s.setLeftOpen);
  const show = useToast((s) => s.show);
  const [saving, setSaving] = useState(false);

  const doSave = async (rename = false) => {
    let name: string | undefined;
    if (!project.nameConfirmed || rename) {
      const answer = window.prompt('Nome del progetto:', project.name);
      if (answer === null) return;
      name = answer.trim();
      if (!name) { show('Inserisci un nome per il progetto'); return; }
    }
    setSaving(true);
    try { await save(name); show('Progetto salvato in locale'); }
    catch { show('Salvataggio non riuscito: il lavoro resta aperto. Riprova.'); }
    finally { setSaving(false); }
  };


  return (
    <div className="topbar" data-testid="topbar">
      <button className="icon-btn" style={{ color: 'var(--rm-text-light)' }} onClick={() => setLeftOpen(!leftOpen)} title="Mostra/nascondi pagine" data-testid="toggle-left">
        {leftOpen ? <IconLeft size={18} /> : <IconRight size={18} />}
      </button>
      <div className="wordmark" style={{ fontSize: 18, marginRight: 6 }}>
        RM<b>Album</b>
      </div>
      <div className="sep" />
      <details ref={fileMenu} className="file-menu" data-testid="file-menu" onToggle={e=>{if(e.currentTarget.open){const r=e.currentTarget.querySelector('summary')!.getBoundingClientRect();setMenuPosition({left:Math.max(8,Math.min(r.left,window.innerWidth-210)),top:r.bottom+4});}}}><summary className="btn btn-ghost">File ▾</summary><div className="file-menu-items" style={menuPosition} onClick={e=>{if((e.target as HTMLElement).closest('button'))e.currentTarget.closest('details')?.removeAttribute('open');}}>
      <button className="btn btn-ghost" data-testid="tb-new" onClick={onNew}>
        <IconPlus size={15} /> Nuovo
      </button>
      <button className="btn btn-ghost" data-testid="tb-open" onClick={onOpenStart}>
        <IconFolder size={15} /> Apri
      </button>
      <button className="btn btn-ghost" data-testid="tb-save" onClick={() => doSave()} disabled={saving}>
        <IconSave size={15} /> {saving ? 'Salvo…' : 'Salva'}
      </button>
      <button className="btn btn-ghost" data-testid="tb-save-as" disabled={saving} onClick={async()=>{
        const name=window.prompt('Salva una copia con nome:',project.name+' — copia')?.trim();
        if(!name)return;
        setSaving(true);
        try {
          const snapshot=useStore.getState().project!;
          const copy=await copyProject({...snapshot,name,nameConfirmed:true});
          const photos=(await getPhotosByProject(copy.id)).map(recordToPhoto);
          if(useStore.getState().project===snapshot)useStore.getState().loadProject(copy,photos);
          show('Copia salvata. Il progetto originale resta invariato.');
        }catch{show('Copia non riuscita: il progetto originale non è stato modificato.');}
        finally{setSaving(false);}
      }}>Salva con nome…</button>
      </div></details>
      <div className="sep" />
      <button className="btn btn-gold" data-testid="tb-export" onClick={onExport}>
        <IconDownload size={15} /> Esporta
      </button>
      <div className="sep" />
      <button className={'btn btn-ghost' + (showGuides ? ' active' : '')} data-testid="tb-guides" onClick={() => setShowGuides(!showGuides)}>
        <IconEye size={15} /> Guide
      </button>
      <button className={'btn btn-ghost' + (layoutOpen ? ' active' : '')} data-testid="tb-layout"
        aria-expanded={layoutOpen} onClick={() => setLayoutOpen(!layoutOpen)}>Layout</button>
      <button className={'btn btn-ghost' + (snapToGuides ? ' active' : '')} data-testid="tb-snap" onClick={() => setSnapToGuides(!snapToGuides)}>
        Aggancia
      </button>
      <div className="spacer" />
      <button className="btn btn-ghost" data-testid="tb-format" onClick={onSettings}>
        Formato
      </button>
      <button className="btn btn-ghost" data-testid="tb-cover" onClick={onCover}>Copertina</button>
      <button className="btn btn-ghost" data-testid="tb-3d" onClick={on3D} title="Configuratore materiali, box e anteprima 3D (beta)">Anteprima 3D</button>
      <div className="proj-name" data-testid="tb-projname">
        {dirty && <span className="dot-dirty">● </span>}
        {project.name}
      </div>
      <button className="btn btn-ghost" data-testid="tb-rename" onClick={() => doSave(true)} disabled={saving} title="Rinomina e salva senza creare una copia">Rinomina</button>
    </div>
  );
}
