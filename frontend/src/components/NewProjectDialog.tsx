import React, { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, ProjectSettings, Preset } from '../types';
import { listPresets, savePreset, deletePreset } from '../db/database';
import { albumPresets } from '../lib/artigiano';
import { useToast } from './Toast';

interface Props {
  onCancel: () => void;
  onCreate: (name: string, settings: ProjectSettings) => void;
  initialName?: string;
  initialSettings?: ProjectSettings;
  title?: string;
  submitLabel?: string;
}

const NumField = ({
  label,
  value,
  onChange,
  step = 0.1,
  testid,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  testid: string;
}) => (
  <div className="m-field">
    <label>{label}</label>
    <input
      className="m-input"
      type="number"
      step={step}
      value={Number.isNaN(value)?'':value}
      data-testid={testid}
      onChange={(e) => onChange(e.target.value===''?NaN:Number(e.target.value))}
    />
  </div>
);

export function NewProjectDialog({ onCancel, onCreate, initialName, initialSettings, title, submitLabel }: Props) {
  const [name, setName] = useState(initialName ?? '');
  const [st, setSt] = useState<ProjectSettings>({ ...(initialSettings ?? {...DEFAULT_SETTINGS,widthCm:NaN,heightCm:NaN,bleedCm:NaN,safeCm:NaN,gutterCm:NaN}) });
  const [selectedPreset,setSelectedPreset]=useState('');
  const [presets, setPresets] = useState<Preset[]>([]);
  const show = useToast((s) => s.show);
  const settings={...st,bleedCm:Number.isNaN(st.bleedCm)?0:st.bleedCm,safeCm:Number.isNaN(st.safeCm)?0:st.safeCm,gutterCm:Number.isNaN(st.gutterCm)?0:st.gutterCm};
  const valid=Object.values(settings).every(v=>Number.isFinite(v) && v>=0) && settings.widthCm>0 && settings.heightCm>0 && settings.widthCm<=200 && settings.heightCm<=200 && settings.dpi>=72 && settings.dpi<=1200 &&
    2*(settings.bleedCm+settings.safeCm)<Math.min(settings.widthCm,settings.heightCm) && settings.gutterCm<settings.widthCm;

  useEffect(() => {
    listPresets().then(setPresets);
  }, []);

  const upd = (patch: Partial<ProjectSettings>) => setSt((s) => ({ ...s, ...patch }));

  const applyPreset = (p: Preset) => {
    setSt({ ...p.settings });
    setName(p.name);
  };

  const saveFavorite = async () => {
    if(!valid)return;
    const pname = window.prompt('Nome del profilo preferito:', name);
    if (!pname) return;
    try {
      await savePreset({ id: crypto.randomUUID(), name: pname, settings: { ...settings } });
      setPresets(await listPresets());
      show('Profilo salvato');
    } catch (e: any) {
      show(e.message || 'Errore');
    }
  };

  const removeFavorite = async (id: string) => {
    await deletePreset(id);
    setPresets(await listPresets());
  };

  return (
    <div className="modal-backdrop" data-testid="new-project-modal">
      <div className="modal">
        <h2>{title ?? 'Nuovo progetto'}</h2>
        <div className="sub">Le dimensioni della doppia pagina comprendono già il margine di taglio.</div>

        <div className="m-field">
          <label htmlFor="album-presets">Profili preferiti</label>
          <select id="album-presets" className="m-input" data-testid="np-preset" value={selectedPreset} onChange={e=>{
            setSelectedPreset(e.target.value);const p=[...albumPresets,...presets].find(p=>p.id===e.target.value);if(p)applyPreset(p);
          }}><option value="">Scegli un preferito…</option><optgroup label="Artigiano">{albumPresets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</optgroup><optgroup label="Personali">{presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</optgroup></select>
          {presets.some(p=>p.id===selectedPreset) && <button className="btn btn-outline" onClick={async()=>{if(!window.confirm('Eliminare questo preferito personale?'))return;try{await removeFavorite(selectedPreset);setSelectedPreset('');}catch{show('Impossibile eliminare il preferito');}}}>Elimina preferito</button>}
        </div>

        <div className="m-field">
          <label>Nome progetto</label>
          <input
            className="m-input"
            value={name}
            data-testid="np-name"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="m-grid">
          <NumField label="Larghezza doppia pagina (cm)" value={st.widthCm} step={0.1} onChange={(v) => upd({ widthCm: v })} testid="np-width" />
          <NumField label="Altezza (cm)" value={st.heightCm} step={0.1} onChange={(v) => upd({ heightCm: v })} testid="np-height" />
        </div>

        <div className="m-grid3">
          <NumField label="DPI" value={st.dpi} step={1} onChange={(v) => upd({ dpi: v })} testid="np-dpi" />
          <NumField label="Taglio (cm, facoltativo)" value={st.bleedCm} step={0.1} onChange={(v) => upd({ bleedCm: v })} testid="np-bleed" />
          <NumField label="Sicurezza (cm, facoltativo)" value={st.safeCm} step={0.1} onChange={(v) => upd({ safeCm: v })} testid="np-safe" />
        </div>

        <NumField label="Margine centrale totale (cm, facoltativo)" value={st.gutterCm} step={0.1} onChange={(v) => upd({ gutterCm: v })} testid="np-gutter" />
        <p className="sub">I margini guida lasciati vuoti valgono zero. Per Artigiano non sono state fornite misure dei margini interni: puoi impostarli qui senza cambiare il formato del file.</p>

        <div className="warn-box" style={{ background: '#efece5', border: '1px solid #ded8cf', color: '#817970' }}>
          {valid?`Colore: sRGB. A ${st.dpi} DPI la pagina misura circa ${Math.round(st.widthCm/2.54*st.dpi)} × ${Math.round(st.heightCm/2.54*st.dpi)} px.`:'Inserisci larghezza e altezza valide o scegli un preferito. DPI da 72 a 1200; formato massimo 200 × 200 cm.'}
        </div>

        <div className="modal-actions">
          <button className="btn btn-outline" disabled={!valid} onClick={saveFavorite} data-testid="np-save-preset">
            Salva come preferito
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-outline" onClick={onCancel} data-testid="np-cancel">
            Annulla
          </button>
          <button className="btn btn-gold" disabled={!valid} data-testid="np-create" onClick={() => {if(valid)onCreate(name.trim() || 'Album', settings);}}>
            {submitLabel ?? 'Crea progetto'}
          </button>
        </div>
      </div>
    </div>
  );
}
