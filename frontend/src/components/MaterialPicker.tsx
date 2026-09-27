import React, { useState } from 'react';
import { apiUrl, Catalog } from '../lib/api';
import { MaterialRef } from '../lib/config3d';

interface Props { label: string; hint?: string; value: MaterialRef | null | undefined; catalog: Catalog; onChange: (ref: MaterialRef | null) => void; testId: string }

// Famiglia e variante scelte separatamente; le varianti non disponibili restano visibili ma disabilitate con motivo.
export function MaterialPicker({ label, hint, value, catalog, onChange, testId }: Props) {
  const [familyId, setFamilyId] = useState(value?.familyId ?? catalog.families[0]?.id ?? '');
  const variants = catalog.variants.filter(v => v.familyId === familyId);
  const family = catalog.families.find(f => f.id === familyId);
  const current = value ? catalog.variants.find(v => v.code === value.code) : null;
  return (
    <div className="mp" data-testid={testId}>
      <div className="mp-head">
        <label>{label}</label>
        {hint && <span className="hint">{hint}</span>}
      </div>
      <div className="mp-row">
        <select className="m-input" value={familyId} data-testid={`${testId}-family`} onChange={e => setFamilyId(e.target.value)}>
          {catalog.families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button className="btn btn-outline btn-sm" data-testid={`${testId}-clear`} disabled={!value} onClick={() => onChange(null)}>Nessuno</button>
      </div>
      <div className="swatches">
        {variants.map(v => {
          const disabled = v.outOfProduction;
          const selected = value?.code === v.code;
          return (
            <button key={v.code} type="button" className={'swatch' + (selected ? ' selected' : '') + (disabled ? ' disabled' : '')}
              title={disabled ? `${v.code} — fuori produzione, non ordinabile` : `${family?.name} ${v.code}`}
              disabled={disabled} data-testid={`${testId}-variant-${v.code}`}
              onClick={() => onChange({ familyId: v.familyId, code: v.code })}>
              {disabled ? <span className="swatch-out">FUORI<br/>PROD.</span> : <img src={apiUrl(v.swatchUrl)} alt={v.code} loading="lazy" />}
              <span className="swatch-code">{v.code}</span>
            </button>
          );
        })}
      </div>
      <div className="mp-current" data-testid={`${testId}-current`}>
        {current ? <>Scelto: <b>{catalog.families.find(f => f.id === current.familyId)?.name} {current.code}</b> · codice articolo laboratorio <code>{current.code}</code></> : <span className="hint">Nessun materiale scelto per questa superficie</span>}
      </div>
    </div>
  );
}
