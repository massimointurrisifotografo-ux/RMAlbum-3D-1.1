import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { api, Catalog } from '../lib/api';
import { ConfigBody, coverSpreadOf, defaultConfig, deriveAlbum, boxDims } from '../lib/config3d';
import { renderCoverFront, renderPhotoCrop } from '../lib/coverPreview';
import { Scene } from './three/Scene';
import { ConfigPanel } from './ConfigPanel';
import { useToast } from './Toast';

export function Preview3D({ onBack }: { onBack: () => void }) {
  const project = useStore(s => s.project)!;
  const photos = useStore(s => s.photos);
  const show = useToast(s => s.show);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [cfg, setCfg] = useState<ConfigBody>(() => project.productConfig ? {...project.productConfig, projectId:project.id, projectName:project.name, album:deriveAlbum(project, project.productConfig.album)} : defaultConfig(project));
  const [coverSrc, setCoverSrc] = useState<string | null>(null);
  const [interiorSrc, setInteriorSrc] = useState<string | null>(null);
  const [boxOpen, setBoxOpen] = useState(true);
  const [showPlexi, setShowPlexi] = useState(true);
  const [busy, setBusy] = useState('');
  const coverCanvas = useRef<HTMLCanvasElement | null>(null);
  const interiorCanvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let alive = true;
    setCatalogError(false);
    api.catalog().then(value => {
      if (!Array.isArray(value.families) || !Array.isArray(value.variants)) throw new Error('Catalogo non valido');
      if (alive) setCatalog(value);
    }).catch(() => { if (alive) setCatalogError(true); });
    return () => { alive = false; };
  }, [catalogAttempt]);
  const [localStatus, setLocalStatus] = useState(project.productConfig ? 'Salvata in locale' : 'Non ancora salvata');
  const persistLocal = async () => {
    try { await useStore.getState().save(); setLocalStatus('Salvata in locale'); return true; }
    catch { setLocalStatus('Salvataggio non riuscito'); show('Salvataggio locale non riuscito. Le modifiche restano aperte: riprova prima di chiudere.'); return false; }
  };
  useEffect(() => {
    const timer=setTimeout(() => { void persistLocal(); }, 400);
    return () => clearTimeout(timer);
  }, [cfg]);

  // La copertina si legge dall'impaginato corrente senza modificarlo.
  const coverSpread = coverSpreadOf(project);
  useEffect(() => {
    let alive = true;
    if (!coverSpread) { setCoverSrc(null); coverCanvas.current = null; return; }
    renderCoverFront(project, coverSpread, photos, 1400).then(c => { if (!alive) return; coverCanvas.current = c; setCoverSrc(c.toDataURL('image/jpeg', 0.85)); }).catch((e: Error) => { if (alive) { coverCanvas.current = null; setCoverSrc(null); show(e.message); } });
    return () => { alive = false; };
  }, [coverSpread, project.settings.widthCm, project.settings.heightCm, photos]);

  const lidAspect = useMemo(() => { const d = boxDims(cfg.album, cfg.box); const f = 1.6; return (d.outerW - 2 * d.wall - 2 * f) / (d.outerD - 2 * d.wall - 2 * f); }, [cfg.album, cfg.box]);
  useEffect(() => {
    const photo = cfg.box.cInteriorPhotoId ? photos[cfg.box.cInteriorPhotoId] : null;
    if (!photo || cfg.box.type !== 'C' || cfg.box.cInterior !== 'photo') { setInteriorSrc(null); interiorCanvas.current = null; return; }
    let alive = true;
    const t = setTimeout(() => renderPhotoCrop(photo, lidAspect, cfg.box.cInteriorCrop).then(c => { if (!alive) return; interiorCanvas.current = c; setInteriorSrc(c.toDataURL('image/jpeg', 0.85)); }).catch(() => { if (alive) { interiorCanvas.current = null; setInteriorSrc(null); show('Anteprima interna non disponibile: ricollega la foto.'); } }), 120);
    return () => { alive = false; clearTimeout(t); };
  }, [cfg.box.cInteriorPhotoId, cfg.box.cInteriorCrop, cfg.box.type, cfg.box.cInterior, lidAspect, photos]);

  const onChange = (patch: Partial<ConfigBody>) => {
    const next={...cfg,...patch};
    setCfg(next); setLocalStatus('Salvo in locale…');
    const p=useStore.getState().project;
    if(p) useStore.setState({project:{...p,productConfig:next,updatedAt:Date.now()},dirty:true});
  };

  const doSave = async () => {
    const p=useStore.getState().project;
    if(p) useStore.setState({project:{...p,productConfig:{...cfg,album:deriveAlbum(p,cfg.album)},updatedAt:Date.now()},dirty:true});
    setBusy('Salvo…');
    try { return await persistLocal(); } finally {setBusy('');}
  };

  const photoList = useMemo(() => Object.values(photos).sort((a, b) => a.name.localeCompare(b.name)), [photos]);

  return (
    <div className="p3d" data-testid="preview3d-page">
      <div className="topbar">
        <button className="btn btn-ghost" disabled={!!busy} onClick={async () => { if(await doSave()) onBack(); }} data-testid="p3d-back">← Torna all'editor</button>
        <div className="wordmark" style={{ fontSize: 18 }}>RM<b>Album</b> · Anteprima 3D <span className="beta">BETA</span></div>
        <div className="proj-name">{project.name}</div>
        <div className="spacer" />
        <span className="hint" data-testid="p3d-status">{localStatus}</span>
        <button className="btn btn-ghost" disabled={!!busy} onClick={() => doSave()} data-testid="p3d-save">Salva configurazione</button>
        <span className="hint">Salvataggio locale automatico · nessun account</span>
      </div>
      <div className="p3d-body">
        <div className="p3d-viewer">
          <Scene cfg={cfg} catalog={catalog} coverSrc={coverSrc} interiorSrc={interiorSrc} boxOpen={boxOpen} showPlexi={showPlexi} />
          <div className="p3d-legend" data-testid="p3d-legend">Trascina per ruotare · rotella per zoom · La resa 3D è una simulazione, non una prova colore.</div>
        </div>
        <aside className="p3d-side">
          {catalog ? <fieldset disabled={!!busy} style={{border:0,padding:0,margin:0,minWidth:0}}><ConfigPanel cfg={cfg} catalog={catalog} photos={photoList} onChange={onChange} boxOpen={boxOpen} setBoxOpen={setBoxOpen} showPlexi={showPlexi} setShowPlexi={setShowPlexi} /></fieldset>
                   : <div className="hint" style={{ padding: 16 }} role={catalogError ? 'alert' : 'status'}>{catalogError ? <>Catalogo materiali non disponibile. <button className="btn btn-outline" onClick={() => setCatalogAttempt(n => n + 1)}>Riprova</button></> : 'Carico il catalogo materiali…'}</div>}
        </aside>
      </div>
    </div>
  );
}
