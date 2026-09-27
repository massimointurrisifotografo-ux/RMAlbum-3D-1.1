import React, { useState } from 'react';
import { useCurrentSpread, useStore } from '../store/store';

export function BackgroundPanel() {
  const spread = useCurrentSpread();
  const updateSpread = useStore((s) => s.updateSpread);
  const [target, setTarget] = useState<'left' | 'right' | 'both'>('both');
  const [chosen, setChosen] = useState('#FFFFFF');
  if (!spread) return null;
  const mixed = target === 'both' && spread.leftColor !== spread.rightColor;
  const color = target === 'left' ? spread.leftColor : target === 'right' ? spread.rightColor
    : mixed ? chosen : spread.leftColor;
  const apply = (value: string) => {
    setChosen(value);
    updateSpread(spread.id, {
      ...(target !== 'right' ? { leftColor: value } : {}),
      ...(target !== 'left' ? { rightColor: value } : {}),
    });
  };
  return (
    <section data-testid="background-panel">
      <div className="section-title">Sfondo</div>
      <div className="background-targets">
        {([['left', 'Sinistra'], ['right', 'Destra'], ['both', 'Foglio intero']] as const).map(([key, label]) => (
          <button key={key} className={'btn btn-sm' + (target === key ? ' active' : '')}
            aria-pressed={target === key} data-testid={`bg-${key}`} onClick={() => setTarget(key)}>{label}</button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="background-color">Colore</label>
        <div className="row">
          <input id="background-color" type="color" value={color} onChange={(e) => apply(e.target.value)} data-testid="bg-color" />
          <span className="hint">{mixed ? 'Colori diversi sulle due pagine' : color.toUpperCase()}</span>
        </div>
      </div>
      <button className="btn btn-sm" onClick={() => apply(color)} data-testid="bg-apply">Applica colore</button>
      <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => apply('#FFFFFF')} data-testid="bg-white">Ripristina bianco</button>
      <p className="hint">Scegli la destinazione, poi il colore. Seleziona una cella per modificarne le proprietà.</p>
    </section>
  );
}
