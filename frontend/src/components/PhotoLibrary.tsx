import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { importPhotos, relinkPhoto } from '../lib/photos';
import { useToast } from './Toast';
import { IconImage, IconDown, IconUp } from './Icons';
import { sortPhotos } from '../lib/photoOrder';
import { ensurePermission, photoDates } from '../lib/photos';
import { savePhotoDates } from '../db/database';

export function PhotoLibrary() {
  const project = useStore((s) => s.project)!;
  const photosMap = useStore((s) => s.photos);
  const addPhotos = useStore((s) => s.addPhotos);
  const updatePhoto = useStore((s) => s.updatePhoto);
  const selectedCellId = useStore((s) => s.selectedCellId);
  const placePhoto = useStore((s) => s.placePhoto);
  const toggleLibraryPhoto = useStore((s) => s.toggleLibraryPhoto);
  const setPendingPhoto = useStore((s) => s.setPendingPhoto);
  const pendingPhotoId = useStore((s) => s.pendingPhotoId);
  const open = useStore((s) => s.bottomOpen);
  const setOpen = useStore((s) => s.setBottomOpen);
  const spreads = useStore((s) => s.project?.spreads);
  const show = useToast((s) => s.show);
  const [importing, setImporting] = useState(false);
  const [panelHeight, setPanelHeight] = useState(() => {
    try { return Math.max(150, Math.min(500, Number(localStorage.getItem('rmalbum-library-height')) || 230)); }
    catch { return 230; }
  });
  const resizeStart = React.useRef<{ y: number; height: number } | null>(null);
  const thumbnailWidth = Math.max(110, Math.min(250, panelHeight * .62));
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  useEffect(() => {
    setSelectedPhotoIds([]);
    setSelectionAnchor(null);
  }, [project.id]);

  const photos = sortPhotos(Object.values(photosMap), project.photoSort);
  const [readingDates,setReadingDates]=useState(false);
  const readDates=async () => {
    setReadingDates(true);
    let missing=0;
    try {
      for(const photo of photos) {
        if(photo.fileModifiedAt)continue;
        try {
          if(!await ensurePermission(photo.handle)){missing++;continue;}
          const dates=await photoDates(await photo.handle.getFile());
          await savePhotoDates(photo.id,dates);
          updatePhoto(photo.id,dates);
        } catch {missing++;}
      }
      show(missing ? `${missing} foto senza data disponibile: ordinate per nome in fondo` : 'Date aggiornate');
    } finally {setReadingDates(false);setSelectionAnchor(null);}
  };
  const used = new Set<string>();
  spreads?.forEach((sp) => sp.cells.forEach((c) => c.photoId && used.add(c.photoId)));

  const insertSelected = useCallback(() => {
    if (selectedPhotoIds.length === 0) return;
    selectedPhotoIds.forEach((id) => placePhoto(id));
    show(`${selectedPhotoIds.length} foto inserite nella pagina`);
    setSelectedPhotoIds([]);
    setSelectionAnchor(null);
  }, [placePhoto, selectedPhotoIds, show]);

  useEffect(() => {
    if (selectedPhotoIds.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (document.querySelector('.modal-backdrop') || target?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        insertSelected();
      } else if (e.key === 'Escape') {
        setSelectedPhotoIds([]);
        setSelectionAnchor(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [insertSelected, selectedPhotoIds.length]);

  const onClickPhoto = (e: React.MouseEvent, id: string, index: number) => {
    if (e.metaKey || e.ctrlKey) {
      setSelectedPhotoIds((current) =>
        current.includes(id) ? current.filter((photoId) => photoId !== id) : [...current, id]
      );
      setSelectionAnchor(index);
      return;
    }
    if (e.shiftKey) {
      const start = selectionAnchor ?? index;
      const from = Math.min(start, index);
      const to = Math.max(start, index);
      setSelectedPhotoIds(photos.slice(from, to + 1).map((photo) => photo.id));
      setSelectionAnchor(start);
      return;
    }
    const result = toggleLibraryPhoto(id);
    setPendingPhoto(null);
    setSelectedPhotoIds([]);
    setSelectionAnchor(index);
    if (result !== 'cancelled') show(result === 'removed' ? 'Foto rimossa dal foglio attivo; originale conservato' : 'Foto inserita nel foglio attivo');
  };

  const doImport = async () => {
    setImporting(true);
    try {
      const p = await importPhotos(project.id);
      if (p.length) {
        addPhotos(p);
        show(`${p.length} foto importate`);
      }
    } finally {
      setImporting(false);
    }
  };

  const doRelink = async (id: string) => {
    const photo = photosMap[id];
    const handle = await relinkPhoto(photo);
    if (handle) {
      updatePhoto(id, { handle, needsRelink: false });
      show('Originale ricollegato');
    }
  };

  return (
    <div className={'bottom' + (open ? '' : ' closed')} data-testid="photo-library"
      style={open ? { height: panelHeight, minHeight: 0, maxHeight: '60vh', '--thumb-size': `${thumbnailWidth}px` } as React.CSSProperties : undefined}>
      {open && <div className="library-resizer" role="separator" aria-label="Ridimensiona libreria fotografica"
        aria-orientation="horizontal" tabIndex={0} title="Trascina verso l’alto per ingrandire libreria e miniature"
        onPointerDown={e => {
          resizeStart.current = { y: e.clientY, height: panelHeight };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          if (!resizeStart.current) return;
          const height = Math.max(150, Math.min(window.innerHeight * .6, resizeStart.current.height + resizeStart.current.y - e.clientY));
          setPanelHeight(height);
        }}
        onPointerUp={e => {
          resizeStart.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
          try { localStorage.setItem('rmalbum-library-height', String(panelHeight)); } catch {}
        }}
        onPointerCancel={() => { resizeStart.current = null; }}
        onKeyDown={e => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          setPanelHeight(h => Math.max(150, Math.min(window.innerHeight * .6, h + (e.key === 'ArrowRight' ? 20 : -20))));
        }} />}
      <div className="bottom-head">
        <button className="icon-btn" onClick={() => setOpen(!open)} data-testid="toggle-bottom">
          {open ? <IconDown size={16} /> : <IconUp size={16} />}
        </button>
        <span>Libreria fotografica</span>
        <select aria-label="Ordina foto" data-testid="photo-sort" value={project.photoSort ?? 'name'} onChange={e=>{
          useStore.getState().setPhotoSort(e.target.value as 'name'|'time');setSelectionAnchor(null);
        }}><option value="name">Nome alfanumerico</option><option value="time">Data e ora dello scatto</option></select>
        {project.photoSort==='time' && <button className="btn btn-sm" disabled={readingDates} onClick={readDates} title="Per le vecchie importazioni: legge la data EXIF, altrimenti la data del file. Senza data: in fondo per nome.">{readingDates?'Leggo…':'Aggiorna date'}</button>}
        <span style={{ color: 'var(--rm-text-dark)' }}>{photos.length}</span>
        <div style={{ flex: 1 }} />
        {pendingPhotoId && open && <span style={{ color: 'var(--rm-gold-dark)' }}>Clicca una cella per inserire la foto selezionata</span>}
        {selectedPhotoIds.length > 0 && open && (
          <button className="btn btn-sm btn-gold" onClick={insertSelected} data-testid="lib-insert-selected">
            Inserisci selezionate ({selectedPhotoIds.length})
          </button>
        )}
        <button className="btn btn-sm btn-dark" onClick={doImport} disabled={importing} data-testid="lib-import">
          <IconImage size={13} /> {importing ? 'Importo…' : 'Importa'}
        </button>
      </div>
      {open && (
        <div className="filmstrip">
          {photos.length === 0 && <div className="empty-lib">Nessuna foto. Usa "Importa" per aggiungere JPEG o PNG.</div>}
          {photos.map((p) => (
            <div
              key={p.id}
              className={'thumb-card' + (used.has(p.id) ? ' used' : '') + (pendingPhotoId === p.id || selectedPhotoIds.includes(p.id) ? ' selected' : '')}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/photo-id', p.id);
              }}
              onClick={(e) => onClickPhoto(e, p.id, photos.indexOf(p))}
              data-testid={`lib-photo-${p.id}`}
              title={p.name}
              aria-selected={selectedPhotoIds.includes(p.id)}
            >
              {selectedPhotoIds.includes(p.id) && <span className="selection-badge">✓ {selectedPhotoIds.indexOf(p.id) + 1}</span>}
              <img className="thumb-img" src={p.thumbUrl} alt={p.name} draggable={false} />
              <div className="thumb-name">{p.name}</div>
              {p.needsRelink && (
                <button className="thumb-relink" onClick={(e) => { e.stopPropagation(); doRelink(p.id); }} data-testid={`relink-${p.id}`}>
                  ⚠ Ricollega
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
