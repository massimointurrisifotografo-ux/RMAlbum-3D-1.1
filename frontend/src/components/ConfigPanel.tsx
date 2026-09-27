import React, { useState } from 'react';
import { Catalog } from '../lib/api';
import { BoxSpec, ConfigBody, SURFACES, SurfaceKey, boxCAvailable, missingData, withFrontBand } from '../lib/config3d';
import { Photo } from '../types';
import { MaterialPicker } from './MaterialPicker';

interface Props {
  cfg: ConfigBody; catalog: Catalog; photos: Photo[];
  onChange: (patch: Partial<ConfigBody>) => void;
  boxOpen: boolean; setBoxOpen: (v: boolean) => void; showPlexi: boolean; setShowPlexi: (v: boolean) => void;
}

function Section({ id, title, open, onToggle, children }: { id: string; title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className={'acc' + (open ? ' open' : '')} data-testid={`section-${id}`}>
      <button type="button" className="acc-head" aria-expanded={open} onClick={onToggle} data-testid={`section-${id}-toggle`}>{title}<span className="acc-chev">{open ? '−' : '+'}</span></button>
      {open && <div className="acc-body">{children}</div>}
    </section>
  );
}

export function ConfigPanel({ cfg, catalog, photos, onChange, boxOpen, setBoxOpen, showPlexi, setShowPlexi }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({ album: true, cover: true });
  const toggle = (k: string) => setOpen(o => ({ ...o, [k]: !o[k] }));
  const setMaterial = (key: SurfaceKey, ref: ConfigBody['materials'][SurfaceKey]) => onChange({ materials: { ...cfg.materials, [key]: ref } });
  const setBox = (patch: Partial<BoxSpec>) => onChange({ box: { ...cfg.box, ...patch } });
  const a = cfg.album, b = cfg.box;
  const boxCOk = boxCAvailable(a);
  const num = (label: string, key: 'wallCm' | 'clearanceCm' | 'plexiCm', min: number, step = 0.1) => (
    <div className="m-field" key={key}><label htmlFor={`box-${key}`}>{label} (cm)</label><input id={`box-${key}`} className="m-input" type="number" min={min} step={step} value={b[key]} data-testid={`box-${key}`} onChange={e => setBox({ [key]: Math.max(min, Number(e.target.value) || min) } as any)} /></div>
  );
  return (
    <div className="cfg-panel" data-testid="config-panel">
      <Section id="album" title="Album" open={!!open.album} onToggle={() => toggle('album')}>
        <dl className="specs" data-testid="album-specs">
          <dt>Orientamento</dt><dd data-testid="album-orientation">{a.orientation}</dd>
          <dt>Copertina completa (fascia inclusa)</dt><dd>{a.boardWidthCm} × {a.boardHeightCm} cm</dd>
          <dt>Pannello frontale</dt><dd>{Number((a.boardWidthCm - (a.frontBandCm ?? 0)).toFixed(2))} × {a.boardHeightCm} cm</dd>
          <dt>Dorso</dt><dd>{a.spineCm} cm ({a.pages} fogli)</dd>
          <dt>File copertina</dt><dd>{a.hasCoverSpread ? (a.coverMode === 'full' ? 'Retro, dorso e fronte' : 'Solo fronte') : 'Assente nel progetto'}</dd>
          {a.hasCoverSpread && a.coverMode === 'front' && <><dt>Risvolti</dt><dd data-testid="album-wrap-note">{a.spineSideNoWrap ? 'Su tre lati: lato dorso senza risvolto (coerente con la larghezza pagina)' : 'Su tutti i lati'}</dd></>}
        </dl>
        <details data-testid="album-manual"><summary className="manual-properties-toggle">Modifica manuale</summary>
        {a.hasCoverSpread && a.coverMode === 'front' && <div className="m-field"><label htmlFor="front-band">Fascia laterale in materiale (cm)</label><input id="front-band" className="m-input" type="number" min={0} max={10} step={0.1} value={a.frontBandCm ?? 0} data-testid="album-front-band" onChange={e => onChange({album:withFrontBand(a, Number(e.target.value))})} /><p className="hint">A sinistra del pannello fotografico, nello stesso materiale del dorso. Si aggiunge alla larghezza visibile della foto; non modifica risvolti, impaginato o spessore dell'album.</p></div>}
        <div className="m-field"><label htmlFor="board-t">Spessore piatto (cm) — indicativo</label><input id="board-t" className="m-input" type="number" min={0.1} step={0.05} value={a.boardThicknessCm} data-testid="album-board-thickness" onChange={e => onChange({ album: { ...a, boardThicknessCm: Math.max(0.1, Number(e.target.value) || 0.1) } })} /></div>
        </details>
      </Section>

      <Section id="cover" title="Copertina e dorso" open={!!open.cover} onToggle={() => toggle('cover')}>
        <div className="m-field"><label htmlFor="cover-model">Modello copertina</label>
          <select id="cover-model" className="m-input" value={a.coverModel} data-testid="cover-model" onChange={e => onChange({ album: { ...a, coverModel: e.target.value as any } })}>
            <option value="photo_front">Fronte fotografico — dorso e retro in materiale</option>
            <option value="material">Fronte in materiale — dorso e retro in materiale</option>
          </select>
          {a.coverModel === 'photo_front' && !a.hasCoverSpread && <p className="warn-box">Nessuna copertina impaginata nel progetto: il fronte resta in materiale finché non crei la copertina nell'editor.</p>}
          <p className="hint">Il fronte fotografico usa l'impaginato aggiornato dell'editor; scegliere un materiale per il fronte non lo cancella. Dorso e retro hanno sempre lo stesso materiale.</p>
        </div>
        {a.coverModel === 'photo_front' && a.hasCoverSpread
          ? <div className="mp" data-testid="mat-cover-photo"><div className="mp-head"><label>{SURFACES[0].label}</label><span className="hint">Fotografia dall'impaginato della copertina — nessun materiale su questa superficie</span></div></div>
          : <MaterialPicker label={SURFACES[0].label} hint={SURFACES[0].hint} value={cfg.materials.cover} catalog={catalog} onChange={r => setMaterial('cover', r)} testId="mat-cover" />}
        <MaterialPicker label={SURFACES[1].label} hint={SURFACES[1].hint} value={cfg.materials.spine} catalog={catalog} onChange={r => setMaterial('spine', r)} testId="mat-spine" />
      </Section>

      <Section id="box" title="Box" open={!!open.box} onToggle={() => toggle('box')}>
        <div className="box-types" role="radiogroup">
          {([['none', 'Nessun box'], ['C', 'Box C — conchiglia'], ['G', 'Box G — plexiglas']] as [BoxSpec['type'], string][]).map(([t, label]) => {
            const disabled = t === 'C' && !boxCOk;
            return <button key={t} type="button" role="radio" aria-checked={b.type === t} disabled={disabled} className={'btn ' + (b.type === t ? 'btn-gold' : 'btn-outline')} data-testid={`box-type-${t}`} title={disabled ? 'Box C non disponibile per questo orientamento' : ''} onClick={() => setBox(t === b.type ? {} : { type: t, wallCm:t==='G'?3:0.5, clearanceCm:t==='G'?0.2:0.5, plexiCm:0.4 })}>{label}</button>;
          })}
        </div>
        {!boxCOk && <p className="warn-box" data-testid="boxc-unavailable">Box C non disponibile per questo orientamento (album verticale).</p>}
        {b.type === 'C' && !boxCOk && <p className="warn-box" data-testid="boxc-incompatible">La configurazione contiene un Box C ma l'album ora è verticale: scegli un altro box o cambia formato.</p>}
        {b.type !== 'none' && <p className="warn-box">Il catalogo non riporta le misure dei box: i valori seguenti sono indicativi e da confermare con il laboratorio.</p>}
        {b.type !== 'none' && <details key={b.type} data-testid="box-manual"><summary className="manual-properties-toggle">Modifica manuale</summary><div className="m-grid">{num('Spessore pareti', 'wallCm', 0.1)}{num('Gioco interno', 'clearanceCm', 0)}{b.type === 'G' && num('Spessore plexiglas', 'plexiCm', 0.1)}</div></details>}
        {b.type === 'C' && <>
          <div className="row-actions"><button type="button" className="btn btn-outline" data-testid="boxc-toggle-open" onClick={() => setBoxOpen(!boxOpen)}>{boxOpen ? 'Chiudi coperchio' : 'Apri coperchio'}</button></div>
          <div className="m-field"><label htmlFor="boxc-interior">Interno coperchio</label>
            <select id="boxc-interior" className="m-input" value={b.cInterior} data-testid="boxc-interior" onChange={e => setBox({ cInterior: e.target.value as any })}><option value="photo">Fotografia</option><option value="fabric">Tessuto (materiale interno)</option></select></div>
          {b.cInterior === 'photo' && <>
            <div className="m-field"><label htmlFor="boxc-photo">Fotografia (dalla libreria del progetto)</label>
              <select id="boxc-photo" className="m-input" value={b.cInteriorPhotoId ?? ''} data-testid="boxc-photo" onChange={e => setBox({ cInteriorPhotoId: e.target.value || null })}>
                <option value="">Scegli una foto…</option>{photos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="m-grid3">
              <div className="m-field"><label>Zoom {b.cInteriorCrop.zoom.toFixed(2)}</label><input type="range" min={1} max={3} step={0.01} value={b.cInteriorCrop.zoom} data-testid="boxc-crop-zoom" onChange={e => setBox({ cInteriorCrop: { ...b.cInteriorCrop, zoom: Number(e.target.value) } })} /></div>
              <div className="m-field"><label>Orizzontale</label><input type="range" min={-1} max={1} step={0.01} value={b.cInteriorCrop.offsetX} data-testid="boxc-crop-x" onChange={e => setBox({ cInteriorCrop: { ...b.cInteriorCrop, offsetX: Number(e.target.value) } })} /></div>
              <div className="m-field"><label>Verticale</label><input type="range" min={-1} max={1} step={0.01} value={b.cInteriorCrop.offsetY} data-testid="boxc-crop-y" onChange={e => setBox({ cInteriorCrop: { ...b.cInteriorCrop, offsetY: Number(e.target.value) } })} /></div>
            </div>
          </>}
          <MaterialPicker label={SURFACES[2].label} hint={SURFACES[2].hint} value={cfg.materials.boxCExterior} catalog={catalog} onChange={r => setMaterial('boxCExterior', r)} testId="mat-boxCExterior" />
          <MaterialPicker label={SURFACES[3].label} hint={SURFACES[3].hint} value={cfg.materials.boxCInterior} catalog={catalog} onChange={r => onChange({materials:{...cfg.materials,boxCLidInterior:cfg.materials.boxCLidInterior === undefined ? cfg.materials.boxCInterior ?? null : cfg.materials.boxCLidInterior,boxCInterior:r}})} testId="mat-boxCInterior" />
          {b.cInterior === 'fabric' && <MaterialPicker label={SURFACES[5].label} hint={SURFACES[5].hint} value={cfg.materials.boxCLidInterior === undefined ? cfg.materials.boxCInterior : cfg.materials.boxCLidInterior} catalog={catalog} onChange={r => setMaterial('boxCLidInterior', r)} testId="mat-boxCLidInterior" />}
        </>}
        {b.type === 'G' && <>
          <div className="row-actions"><button type="button" className="btn btn-outline" data-testid="boxg-toggle-plexi" onClick={() => setShowPlexi(!showPlexi)}>{showPlexi ? 'Nascondi plexiglas' : 'Mostra plexiglas'}</button><span className="hint">Solo anteprima: il plexiglas fa sempre parte del Box G ordinato.</span></div>
          <MaterialPicker label={SURFACES[4].label} hint={SURFACES[4].hint} value={cfg.materials.boxG} catalog={catalog} onChange={r => setMaterial('boxG', r)} testId="mat-boxG" />
        </>}
      </Section>

      <Section id="summary" title="Riepilogo materiali" open={!!open.summary} onToggle={() => toggle('summary')}>
        <Summary cfg={cfg} catalog={catalog} />
        <div className="m-field"><label htmlFor="cfg-notes">Note del progetto (salvate in locale)</label><textarea id="cfg-notes" className="m-input" rows={3} value={cfg.notes} data-testid="cfg-notes" onChange={e => onChange({ notes: e.target.value })} /></div>
        <ul className="missing" data-testid="missing-data">{missingData(cfg).map((m, i) => <li key={i}>{m}</li>)}</ul>
      </Section>
    </div>
  );
}

export function Summary({ cfg, catalog }: { cfg: ConfigBody; catalog: { families: { id: string; name: string }[]; variants: { code: string; familyId: string; outOfProduction: boolean }[] } }) {
  const relevant = SURFACES.filter(s => s.key === 'cover' || s.key === 'spine' || (cfg.box.type === 'C' && s.key.startsWith('boxC')) || (cfg.box.type === 'G' && s.key === 'boxG'));
  return (
    <table className="summary" data-testid="summary-table">
      <thead><tr><th>Superficie</th><th>Materiale</th><th>Variante</th><th>Codice articolo</th></tr></thead>
      <tbody>
        {relevant.map(s => {
          if (s.key === 'boxCLidInterior' && cfg.box.cInterior === 'photo') return <tr key={s.key}><td>{s.label}</td><td>Fotografia</td><td>—</td><td>—</td></tr>;
          const ref = s.key === 'boxCLidInterior' && cfg.materials.boxCLidInterior === undefined ? cfg.materials.boxCInterior : cfg.materials[s.key]; const v = ref ? catalog.variants.find(x => x.code === ref.code) : null;
          const fam = v ? catalog.families.find(f => f.id === v.familyId)?.name : null;
          const photoFront = s.key === 'cover' && cfg.album.coverModel === 'photo_front' && cfg.album.hasCoverSpread;
          if (photoFront) return <tr key={s.key} data-testid={`summary-${s.key}`}><td>{s.label}</td><td>Fotografia (impaginato copertina)</td><td>—</td><td>—</td></tr>;
          const note = s.key === 'cover' && cfg.album.coverModel === 'photo_front' ? ' (copertina non impaginata: fronte in materiale)' : '';
          return <tr key={s.key} data-testid={`summary-${s.key}`}><td>{s.label}{note}</td><td>{fam ?? <em>non scelto</em>}</td><td>{v ? v.code : '—'}</td><td>{v ? <code>{v.code}</code> : '—'}{v?.outOfProduction ? ' (fuori produzione)' : ''}</td></tr>;
        })}
      </tbody>
    </table>
  );
}
