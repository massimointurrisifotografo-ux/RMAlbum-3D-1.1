import React from 'react';
import { useStore } from '../store/store';
import { Spread } from '../types';
import { IconPlus, IconCopy, IconTrash, IconUp, IconDown } from './Icons';

function Mini({ spread }: { spread: Spread }) {
  return (
    <div className="spread-thumb">
      <div className="half" style={{ left: 0, width: '50%', background: spread.leftColor }} />
      <div className="half" style={{ left: '50%', width: '50%', background: spread.rightColor }} />
      {spread.cells.map((c) => (
        <div
          key={c.id}
          className="cellmini"
          style={{
            left: `${c.x * 100}%`,
            top: `${c.y * 100}%`,
            width: `${c.w * 100}%`,
            height: `${c.h * 100}%`,
            background: c.photoId ? 'rgba(150,125,82,0.55)' : 'rgba(180,180,180,0.35)',
          }}
        />
      ))}
    </div>
  );
}

export function SpreadList() {
  const project = useStore((s) => s.project)!;
  const selectedId = useStore((s) => s.selectedSpreadId);
  const selectSpread = useStore((s) => s.selectSpread);
  const addSpread = useStore((s) => s.addSpread);
  const duplicateSpread = useStore((s) => s.duplicateSpread);
  const deleteSpread = useStore((s) => s.deleteSpread);
  const moveSpread = useStore((s) => s.moveSpread);

  return (
    <div className="left-col" data-testid="spread-list">
      <div className="panel-head">
        <span>Fogli Album <small data-testid="interior-count">· {project.spreads.filter(s => !s.cover).length} interni</small></span>
        <button className="icon-btn" style={{ color: 'var(--rm-gold)' }} onClick={addSpread} title="Aggiungi doppia pagina" data-testid="add-spread">
          <IconPlus size={16} />
        </button>
      </div>
      <div className="spread-scroll">
        {project.spreads.map((sp, i) => (
          <div
            key={sp.id}
            className={'spread-item' + (sp.id === selectedId ? ' selected' : '')}
            data-testid={`spread-item-${i}`}
            onClick={() => selectSpread(sp.id)}
          >
            <Mini spread={sp} />
            <div className="spread-row">
              <span className="spread-num">{sp.cover ? 'Copertina' : String(project.spreads.slice(0,i+1).filter(s=>!s.cover).length).padStart(2, '0')}</span>
              <div className="mini-actions">
                <button className="icon-btn" title="Su" onClick={(e) => { e.stopPropagation(); moveSpread(sp.id, -1); }} data-testid={`spread-up-${i}`}>
                  <IconUp size={14} />
                </button>
                <button className="icon-btn" title="Giù" onClick={(e) => { e.stopPropagation(); moveSpread(sp.id, 1); }} data-testid={`spread-down-${i}`}>
                  <IconDown size={14} />
                </button>
                <button className="icon-btn" title="Duplica" onClick={(e) => { e.stopPropagation(); duplicateSpread(sp.id); }} data-testid={`spread-dup-${i}`}>
                  <IconCopy size={14} />
                </button>
                <button className="icon-btn" title="Elimina" onClick={(e) => { e.stopPropagation(); deleteSpread(sp.id); }} data-testid={`spread-del-${i}`}>
                  <IconTrash size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
