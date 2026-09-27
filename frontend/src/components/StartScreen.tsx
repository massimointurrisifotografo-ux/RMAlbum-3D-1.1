import React, { useEffect, useState } from 'react';
import { listProjects, deleteProject } from '../db/database';
import { Project } from '../types';
import { IconFolder, IconPlus, IconTrash } from './Icons';

interface Props {
  onNew: () => void;
  onOpen: (id: string) => void;
}

export function StartScreen({ onNew, onOpen }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);

  const refresh = () => listProjects().then(setProjects);
  useEffect(() => {
    refresh();
  }, []);

  const remove = async (id: string) => {
    if (!window.confirm('Eliminare definitivamente questo progetto locale?')) return;
    await deleteProject(id);
    refresh();
  };

  const fmt = (t: number) => new Date(t).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="start" data-testid="start-screen">
      <div className="start-mark">
        RM<b>Album</b>
      </div>
      <div className="start-sub">Impaginazione di album fotografici per la stampa · locale</div>

      <div className="start-actions">
        <button className="btn btn-gold" data-testid="start-new" onClick={onNew}>
          <IconPlus size={16} /> Nuovo progetto
        </button>
      </div>

      <div className="recent">
        <h3>Progetti recenti</h3>
        {projects.length === 0 && (
          <div className="empty-lib" style={{ color: 'var(--rm-text-muted)' }}>
            Nessun progetto salvato. Creane uno nuovo per iniziare.
          </div>
        )}
        {projects.map((p) => (
          <div className="recent-item" key={p.id} data-testid={`recent-${p.id}`}>
            <IconFolder size={22} />
            <div>
              <div className="ri-name">{p.name}</div>
              <div className="ri-meta">
                {p.settings.widthCm}×{p.settings.heightCm} cm · {p.settings.dpi} DPI · {p.spreads.length} doppie pagine · {fmt(p.updatedAt)}
              </div>
            </div>
            <div className="spacer" />
            <button className="btn btn-gold btn-sm" data-testid={`open-${p.id}`} onClick={() => onOpen(p.id)}>
              Apri
            </button>
            <button className="icon-btn" style={{ color: 'var(--rm-text-muted)' }} onClick={() => remove(p.id)} title="Elimina">
              <IconTrash size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
