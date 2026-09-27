import React, { useEffect, useState } from 'react';
import { useStore, useCurrentSpread } from '../store/store';
import { getBuiltinLayouts } from '../lib/layouts';
import { rankLayouts, isFullBleed } from '../lib/layoutFit';
import { useToast } from './Toast';
import { IconTrash } from './Icons';
import { settingsFor } from '../lib/cover';

export function LayoutPanel() {
  const spread = useCurrentSpread();
  const customLayouts = useStore((s) => s.customLayouts);
  const applyLayout = useStore((s) => s.applyLayout);
  const saveCurrentAsLayout = useStore((s) => s.saveCurrentAsLayout);
  const removeCustomLayout = useStore((s) => s.removeCustomLayout);
  const project = useStore((s) => s.project)!;
  const photos = useStore(s => s.photos);
  const [edgeOnly, setEdgeOnly] = useState(false);
  const show = useToast((s) => s.show);
  const placedCount = spread?.cells.filter((c) => c.photoId).length ?? 0;
  const suggested = placedCount || spread?.cells.length || 2;
  const [count, setCount] = useState(suggested);
  useEffect(() => setCount(suggested), [suggested, spread?.id]);
  const settings=settingsFor(project,spread);
  const layouts = [...getBuiltinLayouts(settings), ...customLayouts];
  const counts = [...new Set([...layouts.map((l) => l.photoCount), suggested])].sort((a, b) => a - b);
  const options = rankLayouts(layouts.filter((l) => l.photoCount === count && (!edgeOnly || isFullBleed(l))), spread?.cells.filter(c => c.photoId).map(c => photos[c.photoId!] ?? {width:1,height:1}) ?? [], settings);

  const save = async () => {
    if (!spread?.cells.length) return;
    const name = window.prompt('Nome del layout personale:')?.trim();
    if (!name) return;
    try {
      await saveCurrentAsLayout(name);
      setCount(spread.cells.length);
      show('Layout salvato e disponibile anche nei nuovi progetti');
    } catch { show('Impossibile salvare il layout. Riprova.'); }
  };
  if (!spread) return null;
  return (
    <section className="layout-bar" data-testid="layout-panel" aria-label="Layout">
      <div className="layout-bar-head">
        <span>{placedCount} foto · proporzioni più compatibili per prime · ↑ ↓ cambia layout</span>
        <button className={'btn btn-sm' + (edgeOnly ? ' btn-gold' : '')} aria-pressed={edgeOnly} onClick={() => setEdgeOnly(!edgeOnly)} data-testid="layout-edge-filter">Solo a bordo pagina</button>
        {spread.layoutEdited && <span className="layout-unsaved">Layout modificato, non salvato</span>}
        <button className="btn btn-sm btn-gold" onClick={save} disabled={!spread.cells.length} data-testid="save-layout">Salva layout</button>
      </div>
      <div className="count-tabs">
        {counts.map((n) => <button key={n} className={'count-tab' + (n === count ? ' active' : '')}
          data-testid={`count-${n}`} onClick={() => setCount(n)}>{n}</button>)}
      </div>
      <div className="layout-strip">
        {options.map((tpl) => (
          <div key={tpl.id} className={'layout-card' + (spread.layoutId === tpl.id && !spread.layoutEdited ? ' active' : '')}>
            <button className="lp" aria-label={tpl.name} data-testid={`layout-${tpl.id}`}
              style={{ aspectRatio: `${settings.widthCm} / ${settings.heightCm}` }}
              onClick={() => applyLayout(tpl)}>
              {tpl.cells.map((c, i) => <span key={i} className="cellmini" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` }} />)}
            </button>
            <div className="ln"><span>{tpl.name}{isFullBleed(tpl) ? ' · A BORDO' : ''}{tpl.custom ? ' · personale' : ''}</span>
              {tpl.custom && <button className="icon-btn" aria-label={`Elimina ${tpl.name}`} onClick={async () => {
                if (!window.confirm(`Eliminare il layout personale “${tpl.name}”?`)) return;
                try { await removeCustomLayout(tpl.id); } catch { show('Impossibile eliminare il layout'); }
              }}><IconTrash size={12} /></button>}
            </div>
          </div>
        ))}
        {!options.length && <div className="hint">Nessun layout da {count} foto. Puoi salvare la composizione attuale.</div>}
      </div>
    </section>
  );
}
