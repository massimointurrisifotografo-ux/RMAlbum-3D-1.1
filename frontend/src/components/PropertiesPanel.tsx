import React, { useEffect, useRef, useState } from 'react';
import { useStore, useCurrentSpread } from '../store/store';
import { computeCover, centeredZoom } from '../lib/units';
import { IconCopy, IconTrash, IconReset } from './Icons';
import { BackgroundPanel } from './BackgroundPanel';
import { drawPhoto, photoAngle, rotatedViewport, photoTransform } from '../lib/photoRender';
import { settingsFor } from '../lib/cover';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function PreviewCrop({
  previewUrl,
  cellW,
  cellH,
  borderMm,
  zoom,
  rotation,
  offsetX,
  offsetY,
  widthCm,
  heightCm,
  onOffset,
}: {
  previewUrl: string;
  cellW: number;
  cellH: number;
  borderMm: number;
  zoom: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  widthCm: number;
  heightCm: number;
  onOffset: (x: number, y: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(0);
  const drag = useRef<any>(null);

  const innerWcm = Math.max(0.01, cellW * widthCm - borderMm / 5);
  const innerHcm = Math.max(0.01, cellH * heightCm - borderMm / 5);
  const AR = innerWcm / innerHcm;
  const BOX_W = Math.min(252, 320 * AR);
  const boxH = BOX_W / AR;

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setLoaded((v) => v + 1);
    };
    img.src = previewUrl;
    return () => {
      imgRef.current = null;
    };
  }, [previewUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, BOX_W, boxH);
    const c = computeCover(img.naturalWidth, img.naturalHeight, AR, zoom, offsetX, offsetY);
    drawPhoto(ctx,img,img.naturalWidth,img.naturalHeight,0,0,BOX_W,boxH,zoom,offsetX,offsetY,rotation);
  }, [loaded, AR, boxH, zoom, offsetX, offsetY, rotation]);

  const onDown = (e: React.PointerEvent) => {
    const img = imgRef.current;
    if (!img) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const t=photoTransform(img.naturalWidth,img.naturalHeight,BOX_W,boxH,zoom,offsetX,offsetY,rotation);
    const c=t.crop;
    const drawnW = (BOX_W * img.naturalWidth) / c.sw;
    const drawnH = (boxH * img.naturalHeight) / c.sh;
    drag.current = { x0: e.clientX, y0: e.clientY, ox: offsetX, oy: offsetY, panX: t.w - t.box.w, panY: t.h - t.box.h, ratio: BOX_W / e.currentTarget.getBoundingClientRect().width };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const r=rotation*Math.PI/180, mx=(e.clientX-d.x0)*d.ratio, my=(e.clientY-d.y0)*d.ratio;
    const dx = mx*Math.cos(r)+my*Math.sin(r);
    const dy = -mx*Math.sin(r)+my*Math.cos(r);
    const nx = clamp(d.ox + (d.panX > 0 ? (2 * dx) / d.panX : 0), -1, 1);
    const ny = clamp(d.oy + (d.panY > 0 ? (2 * dy) / d.panY : 0), -1, 1);
    onOffset(nx, ny);
  };
  const onUp = (e: React.PointerEvent) => {
    drag.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <canvas
      ref={canvasRef}
      width={BOX_W}
      height={boxH}
      data-testid="prop-preview"
      style={{ width: BOX_W, maxWidth: '100%', height: 'auto', aspectRatio: String(AR), marginLeft:'auto', marginRight:'auto', display: 'block', borderRadius: 6, border: '1px solid #000', background: 'var(--rm-dark-hover)', cursor: 'grab', touchAction: 'none', marginBottom: 6 }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}

function Slider({ label, value, min, max, step, onChange, testid, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; testid: string; fmt?: (v: number) => string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="row">
        <input type="range" min={min} max={max} step={step} value={value} data-testid={testid} onChange={(e) => onChange(parseFloat(e.target.value))} />
        <span className="val-label">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
    </div>
  );
}

function RotationControl({value,onChange}:{value:number;onChange:(n:number)=>void}) {
  const [draft,setDraft]=useState(String(value));
  useEffect(()=>setDraft(String(value)),[value]);
  return <div className="field"><label htmlFor="photo-rotation">Rotazione foto (°)</label><div className="row">
    <input id="photo-rotation" data-testid="prop-rotation" type="range" min={-45} max={45} step={0.1} value={value} onChange={e=>onChange(photoAngle(Number(e.target.value)))} />
    <input aria-label="Rotazione foto in gradi" className="num-input" data-testid="prop-rotation-num" type="number" min={-45} max={45} step={0.1} value={draft}
      onChange={e=>{setDraft(e.target.value);if(e.target.value!=='' && Number.isFinite(Number(e.target.value)))onChange(photoAngle(Number(e.target.value)));}}
      onBlur={()=>{const n=photoAngle(Number(draft));setDraft(String(n));onChange(n);}} />
  </div></div>;
}

export function PropertiesPanel() {
  const spread = useCurrentSpread();
  const project = useStore((s) => s.project)!;
  const selectedCellId = useStore((s) => s.selectedCellId);
  const selectedCellIds = useStore((s) => s.selectedCellIds);
  const deleteCells = useStore((s) => s.deleteCells);
  const photos = useStore((s) => s.photos);
  const updateCell = useStore((s) => s.updateCell);
  const deleteCell = useStore((s) => s.deleteCell);
  const duplicateCell = useStore((s) => s.duplicateCell);
  const removePhotoFromCell = useStore((s) => s.removePhotoFromCell);

  const cell = spread?.cells.find((c) => c.id === selectedCellId);
  const multiple = selectedCellId && selectedCellIds.includes(selectedCellId) ? selectedCellIds.filter(id => spread?.cells.some(c => c.id === id)) : [];
  if (multiple.length > 1) return <div data-testid="multi-cell-properties">
    <p>{multiple.length} celle selezionate</p>
    <button className="btn btn-sm" onClick={() => deleteCells(multiple)} data-testid="cells-del"><IconTrash size={13} /> Elimina celle selezionate</button>
  </div>;

  if (!cell) {
    return <BackgroundPanel key={spread?.id} />;
  }

  const { widthCm, heightCm } = settingsFor(project,spread);
  const photo = cell.photoId ? photos[cell.photoId] : undefined;

  const numRow = (label: string, valueCm: number, dim: number, key: 'x' | 'y' | 'w' | 'h', testid: string) => (
    <div className="m-field" style={{ marginBottom: 10 }}>
      <label style={{ color: 'var(--rm-text-muted)', textTransform: 'uppercase', fontSize: 11 }}>{label}</label>
      <input
        className="txt-input"
        type="number"
        step={0.1}
        value={Number(valueCm.toFixed(2))}
        data-testid={testid}
        onChange={(e) => {
          const cm = parseFloat(e.target.value) || 0;
          let prop = cm / dim;
          if (key === 'x') prop = clamp(prop, 0, 1 - cell.w);
          if (key === 'y') prop = clamp(prop, 0, 1 - cell.h);
          if (key === 'w') prop = clamp(prop, 0.03, 1 - cell.x);
          if (key === 'h') prop = clamp(prop, 0.03, 1 - cell.y);
          updateCell(cell.id, { [key]: prop } as any);
        }}
      />
    </div>
  );

  return (
    <div data-testid="properties-panel">
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button className="btn btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => duplicateCell(cell.id)} data-testid="cell-dup">
          <IconCopy size={13} /> Duplica cella
        </button>
        <button className="btn btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => deleteCell(cell.id)} data-testid="cell-del">
          <IconTrash size={13} /> Elimina cella
        </button>
      </div>

      {photo ? (
        <>
          <PreviewCrop
            previewUrl={photo.previewUrl}
            cellW={cell.w}
            cellH={cell.h}
            borderMm={cell.borderMm}
            zoom={cell.zoom}
            rotation={photoAngle(cell.rotation)}
            offsetX={cell.offsetX}
            offsetY={cell.offsetY}
            widthCm={widthCm}
            heightCm={heightCm}
            onOffset={(x, y) => updateCell(cell.id, { offsetX: x, offsetY: y })}
          />
          <Slider label="Zoom foto" value={cell.zoom} min={1} max={4} step={0.01} onChange={(v) => {
            const ar = Math.max(0.01, cell.w * widthCm - cell.borderMm / 5) / Math.max(0.01, cell.h * heightCm - cell.borderMm / 5);
            updateCell(cell.id, photo ? centeredZoom(photo.width, photo.height, (()=>{const b=rotatedViewport(ar,1,cell.rotation);return b.w/b.h;})(), cell.zoom, v, cell.offsetX, cell.offsetY) : { zoom: v });
          }} testid="prop-zoom" fmt={(v) => `${v.toFixed(2)}×`} />
          <RotationControl key={cell.id} value={photoAngle(cell.rotation)} onChange={rotation=>updateCell(cell.id,{rotation})} />
          <div className="hint" style={{ marginTop: 0, marginBottom: 10, color: 'var(--rm-text-light)' }} data-testid="prop-filename">
            {photo.name} · trascina l'anteprima per spostare la foto
          </div>
        </>
      ) : (
        <div className="prop-none" style={{ padding: '14px 0' }}>Cella vuota — trascina o clicca una foto.</div>
      )}

      <details key={cell.id} data-testid="manual-properties" style={{ marginBottom: 14 }}>
      <summary className="manual-properties-toggle">Modifica manuale</summary>
      <div className="m-grid" style={{ marginBottom: 4 }}>
        {numRow('X (cm)', cell.x * widthCm, widthCm, 'x', 'prop-x')}
        {numRow('Y (cm)', cell.y * heightCm, heightCm, 'y', 'prop-y')}
      </div>
      <div className="m-grid" style={{ marginBottom: 8 }}>
        {numRow('Larghezza (cm)', cell.w * widthCm, widthCm, 'w', 'prop-w')}
        {numRow('Altezza (cm)', cell.h * heightCm, heightCm, 'h', 'prop-h')}
      </div>
      </details>

      {photo && (
        <>
          <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }} onClick={() => updateCell(cell.id, { zoom: 1, offsetX: 0, offsetY: 0, rotation:0 })} data-testid="prop-reset">
            <IconReset size={13} /> Ripristina zoom, rotazione e centro
          </button>
        </>
      )}

      <div className="field">
        <label>Bordo interno</label>
        <div className="row">
          <input type="range" min={0} max={20} step={0.5} value={cell.borderMm} data-testid="prop-border" onChange={(e) => updateCell(cell.id, { borderMm: parseFloat(e.target.value) })} />
          <input className="num-input" type="number" min={0} step={0.5} value={cell.borderMm} data-testid="prop-border-num" onChange={(e) => updateCell(cell.id, { borderMm: Math.max(0, parseFloat(e.target.value) || 0) })} />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <span className="val-label" style={{ minWidth: 'auto' }}>Colore</span>
          <input type="color" value={cell.borderColor} data-testid="prop-border-color" onChange={(e) => updateCell(cell.id, { borderColor: e.target.value })} />
          <span className="hint" style={{ marginTop: 0 }}>0 = nessun bordo</span>
        </div>
      </div>

      {photo && (
        <button className="btn btn-dark" style={{ width: '100%', justifyContent: 'center', marginTop: 6, background: 'var(--rm-dark-hover)' }} onClick={() => removePhotoFromCell(cell.id)} data-testid="prop-remove-photo">
          Rimuovi dalla pagina
        </button>
      )}
    </div>
  );
}
