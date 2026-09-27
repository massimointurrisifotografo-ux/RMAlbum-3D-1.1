import React from 'react';
import { useStore } from '../store/store';
import { PropertiesPanel } from './PropertiesPanel';
import { ContextGuide } from './ContextGuide';
import { IconLeft, IconRight } from './Icons';

export function RightPanel() {
  const open = useStore((s) => s.rightOpen);
  const setOpen = useStore((s) => s.setRightOpen);
  return (
    <aside className={'right-col' + (open ? '' : ' collapsed')} data-testid="right-panel">
      <div className="panel-head">
        <button className="icon-btn" style={{ color: 'var(--rm-gold)' }}
          aria-label={open ? 'Nascondi proprietà' : 'Mostra proprietà'} title={open ? 'Nascondi proprietà' : 'Mostra proprietà'}
          aria-expanded={open} onClick={() => setOpen(!open)} data-testid="toggle-right">
          {open ? <IconRight size={18} /> : <IconLeft size={18} />}
        </button>
        {open && <span>Proprietà</span>}
      </div>
      {open && <div className="right-scroll"><div><PropertiesPanel /></div><ContextGuide /></div>}
    </aside>
  );
}
