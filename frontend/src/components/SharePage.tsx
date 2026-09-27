import React, { useEffect, useState } from 'react';
import { api, SharedConfig } from '../lib/api';
import { Scene } from './three/Scene';
import { Summary } from './ConfigPanel';

// Vista cliente: sola lettura, mostra esclusivamente la versione pubblicata.
export function SharePage({ token }: { token: string }) {
  const [data, setData] = useState<SharedConfig | null>(null);
  const [error, setError] = useState('');
  const [boxOpen, setBoxOpen] = useState(true);
  const [showPlexi, setShowPlexi] = useState(true);
  useEffect(() => { api.share(token).then(setData).catch(e => setError(e.message || 'Link non valido')); }, [token]);
  if (error) return <div className="start" data-testid="share-error"><div className="start-mark">RM<b>Album</b></div><p className="start-sub">{error}</p></div>;
  if (!data) return <div className="start"><p className="start-sub">Carico l'anteprima…</p></div>;
  const catalog = { families: data.families, variants: data.variants };
  const a = data.album;
  return (
    <div className="p3d" data-testid="share-page">
      <div className="topbar">
        <div className="wordmark" style={{ fontSize: 18 }}>RM<b>Album</b> · Anteprima</div>
        <div className="proj-name" data-testid="share-name">{data.name}</div>
        <div className="spacer" />
        <span className="hint">Pubblicata il {new Date(data.publishedAt).toLocaleString('it-IT')}</span>
      </div>
      <div className="p3d-body">
        <div className="p3d-viewer">
          <Scene cfg={data} catalog={catalog} coverSrc={data.previews?.coverFront ?? null} interiorSrc={data.previews?.boxInterior ?? null} boxOpen={boxOpen} showPlexi={showPlexi} />
          <div className="p3d-legend">Trascina per ruotare · rotella per zoom · La resa 3D è una simulazione, non una prova colore.</div>
          <div className="p3d-controls">
            {data.box.type === 'C' && <button className="btn btn-outline" data-testid="share-boxc-toggle" onClick={() => setBoxOpen(!boxOpen)}>{boxOpen ? 'Chiudi coperchio' : 'Apri coperchio'}</button>}
            {data.box.type === 'G' && <button className="btn btn-outline" data-testid="share-plexi-toggle" onClick={() => setShowPlexi(!showPlexi)}>{showPlexi ? 'Nascondi plexiglas' : 'Mostra plexiglas'}</button>}
          </div>
        </div>
        <aside className="p3d-side">
          <div className="cfg-panel">
            <section className="acc open"><div className="acc-head">Album</div><div className="acc-body">
              <dl className="specs"><dt>Orientamento</dt><dd>{a.orientation}</dd><dt>Copertina completa</dt><dd>{a.boardWidthCm} × {a.boardHeightCm} cm</dd><dt>Fascia laterale</dt><dd>{a.frontBandCm ?? 0} cm</dd><dt>Dorso (spessore)</dt><dd>{a.spineCm} cm</dd>
                <dt>Copertina</dt><dd>{a.coverModel === 'photo_front' ? 'Fronte fotografico, dorso e retro in materiale' : 'Fronte in materiale, dorso e retro in materiale'}</dd>
                <dt>Box</dt><dd>{data.box.type === 'none' ? 'Nessuno' : data.box.type === 'C' ? `Box C — conchiglia, interno ${data.box.cInterior === 'photo' ? 'fotografico' : 'in tessuto'}` : 'Box G — plexiglas'}</dd></dl>
            </div></section>
            <section className="acc open"><div className="acc-head">Materiali</div><div className="acc-body"><Summary cfg={data} catalog={catalog} />{data.notes && <p className="hint" data-testid="share-notes">{data.notes}</p>}</div></section>
          </div>
        </aside>
      </div>
    </div>
  );
}
