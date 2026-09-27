import React, { useState } from 'react';
import { useStore } from '../store/store';
import { exportSingle, exportZip, exportFileName } from '../lib/exporter';
import { useToast } from './Toast';
import { cmToPx } from '../lib/units';
import { settingsFor } from '../lib/cover';

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useStore((s) => s.project)!;
  const photos = useStore((s) => s.photos);
  const selectedSpreadId = useStore((s) => s.selectedSpreadId);
  const show = useToast((s) => s.show);

  const [scope, setScope] = useState<'current' | 'all'>('all');
  const [quality, setQuality] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [missing, setMissing] = useState<{ spreadIndex: number; photoName: string }[]>([]);

  const currentIndex = project.spreads.findIndex((s) => s.id === selectedSpreadId);
  const { widthCm, heightCm, dpi } = settingsFor(project,project.spreads[currentIndex]);
  const wpx = cmToPx(widthCm, dpi);
  const hpx = cmToPx(heightCm, dpi);

  const run = async () => {
    setBusy(true);
    setMissing([]);
    try {
      let res;
      if (scope === 'current') {
        res = await exportSingle(project, photos, currentIndex, quality);
      } else {
        const indices = project.spreads.map((_, i) => i);
        res = await exportZip(project, photos, indices, quality, (d, t) => setProgress(d / t));
      }
      setMissing(res.missing);
      if (res.missing.length === 0) {
        show('Esportazione completata');
        onClose();
      }
    } catch (e: any) {
      console.error(e);
      show(e?.message || 'Errore durante l\'esportazione');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  return (
    <div className="modal-backdrop" data-testid="export-modal">
      <div className="modal">
        <h2>Esporta JPEG per la stampa</h2>
        <div className="sub">
          Foglio attivo: {widthCm.toFixed(2)}×{heightCm.toFixed(2)} cm a {dpi} DPI → {wpx} × {hpx} px. Nel ZIP ogni foglio e copertina mantiene le proprie misure. Vengono usati gli originali ad alta risoluzione.
        </div>

        <div className="m-field">
          <label>Cosa esportare</label>
          <div className="row" style={{ gap: 10 }}>
            <button className={'btn ' + (scope === 'current' ? 'btn-gold' : 'btn-outline')} onClick={() => setScope('current')} data-testid="exp-current">
              Foglio corrente ({exportFileName(project,currentIndex)})
            </button>
            <button className={'btn ' + (scope === 'all' ? 'btn-gold' : 'btn-outline')} onClick={() => setScope('all')} data-testid="exp-all">
              Tutte in ZIP ({project.spreads.length})
            </button>
          </div>
        </div>

        <div className="m-field">
          <label>Qualità JPEG · {Math.round(quality * 100)}%</label>
          <input type="range" min={0.6} max={1} step={0.01} value={quality} data-testid="exp-quality" onChange={(e) => setQuality(parseFloat(e.target.value))} />
        </div>

        {busy && scope === 'all' && (
          <div className="progress-bar">
            <div style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}

        {missing.length > 0 && (
          <div className="warn-box" data-testid="exp-missing">
            <b>Originali mancanti.</b> Alcune foto non hanno l'originale ad alta risoluzione collegato. Chiudi, usa "Ricollega" nella libreria e riesporta:
            <ul style={{ margin: '6px 0 0 16px' }}>
              {missing.slice(0, 8).map((m, i) => (
                <li key={i}>
                  Pagina {String(m.spreadIndex + 1).padStart(3, '0')} — {m.photoName}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose} data-testid="exp-close">Chiudi</button>
          <button className="btn btn-gold" onClick={run} disabled={busy} data-testid="exp-run">
            {busy ? 'Esporto…' : 'Esporta'}
          </button>
        </div>
      </div>
    </div>
  );
}
