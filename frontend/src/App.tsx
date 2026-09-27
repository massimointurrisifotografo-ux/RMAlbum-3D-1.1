import React, { useEffect, useRef, useState } from 'react';
import { useStore, createProject } from './store/store';
import { ProjectSettings } from './types';
import { getProject, getPhotosByProject, saveProject } from './db/database';
import { recordToPhoto } from './lib/photos';
import { StartScreen } from './components/StartScreen';
import { TopBar } from './components/TopBar';
import { SpreadList } from './components/SpreadList';
import { Editor } from './components/Editor';
import { RightPanel } from './components/RightPanel';
import { LayoutPanel } from './components/LayoutPanel';
import { PhotoLibrary } from './components/PhotoLibrary';
import { NewProjectDialog } from './components/NewProjectDialog';
import { ExportDialog } from './components/ExportDialog';
import { Toast, useToast } from './components/Toast';
import { CoverDialog } from './components/CoverDialog';
import { Preview3D } from './components/Preview3D';
import { SharePage } from './components/SharePage';

const shareToken = window.location.pathname.match(/^\/share\/([A-Za-z0-9_-]+)/)?.[1] ?? null;

export default function App() {
  if (shareToken) return <SharePage token={shareToken} />;
  return <Workspace />;
}

function Workspace() {
  const project = useStore((s) => s.project);
  const leftOpen = useStore((s) => s.leftOpen);
  const layoutOpen = useStore((s) => s.layoutOpen);
  const selectedSpreadId = useStore((s) => s.selectedSpreadId);
  const autoLayout = useStore((s) => s.autoLayout);
  const cycleLayout = useStore((s) => s.cycleLayout);
  const setProject = useStore((s) => s.setProject);
  const updateProjectMeta = useStore((s) => s.updateProjectMeta);
  const loadProject = useStore((s) => s.loadProject);
  const loadCustomLayouts = useStore((s) => s.loadCustomLayouts);
  const show = useToast((s) => s.show);

  const [showNew, setShowNew] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCover,setShowCover]=useState(false);
  const [show3D,setShow3D]=useState(false);
  const previousCount = useRef<{ key: string; count: number } | null>(null);
  const spread = project?.spreads.find((s) => s.id === selectedSpreadId);
  const photoCount = spread?.cells.filter((c) => c.photoId).length ?? 0;

  useEffect(() => {
    const key = `${project?.id}/${selectedSpreadId}`;
    const previous = previousCount.current;
    previousCount.current = { key, count: photoCount };
    if (previous?.key === key && previous.count !== photoCount) autoLayout();
  }, [project?.id, selectedSpreadId, photoCount, autoLayout]);

  useEffect(() => {
    if (!project || showNew || showExport || showSettings || showCover || show3D) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.isComposing || target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      if(e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || target?.closest('button, [role="separator"]'))return;
      if(e.key==='ArrowLeft' || e.key==='ArrowRight') {
        const s=useStore.getState(), pages=s.project!.spreads;
        const i=pages.findIndex(p=>p.id===s.selectedSpreadId), next=pages[i+(e.key==='ArrowRight'?1:-1)];
        e.preventDefault();if(next)s.selectSpread(next.id);return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const state = useStore.getState();
        if (state.selectedCellId) {
          e.preventDefault();
          if (!e.repeat) state.deleteCells(state.selectedCellIds.includes(state.selectedCellId) ? state.selectedCellIds : [state.selectedCellId]);
        }
        return;
      }
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      if (!e.repeat) cycleLayout(e.key === 'ArrowUp' ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [!!project, showNew, showExport, showSettings, showCover, show3D, cycleLayout]);

  useEffect(() => {
    loadCustomLayouts();
    document.title = 'RMAlbum';
  }, [loadCustomLayouts]);

  useEffect(() => {
    document.title = project ? `RMAlbum — ${project.name}` : 'RMAlbum';
  }, [project]);

  const openProject = async (id: string) => {
    const p = await getProject(id);
    if (!p) {
      show('Progetto non trovato');
      return;
    }
    const recs = await getPhotosByProject(id);
    const photos = recs.map(recordToPhoto);
    loadProject(p, photos);
  };

  const handleCreate = async (name: string, settings: ProjectSettings) => {
    const p = createProject(name, settings);
    await saveProject(p);
    setProject(p);
    setShowNew(false);
  };

  if (!project) {
    return (
      <>
        <StartScreen onNew={() => setShowNew(true)} onOpen={openProject} />
        {showNew && <NewProjectDialog onCancel={() => setShowNew(false)} onCreate={handleCreate} />}
        <Toast />
      </>
    );
  }

  if (show3D) return <><Preview3D onBack={() => setShow3D(false)} /><Toast /></>;

  return (
    <div className="app" data-testid="workspace">
      <TopBar
        onNew={() => setShowNew(true)}
        onOpenStart={() => setProject(null)}
        onExport={() => setShowExport(true)}
        onSettings={() => setShowSettings(true)}
        onCover={() => setShowCover(true)}
        on3D={() => setShow3D(true)}
      />
      <div className="body">
        {leftOpen && <SpreadList />}
        <div className="center">
          {layoutOpen && <LayoutPanel />}
          <Editor />
        </div>
        <RightPanel />
      </div>
      <PhotoLibrary />
      {showNew && <NewProjectDialog onCancel={() => setShowNew(false)} onCreate={handleCreate} />}
      {showSettings && (
        <NewProjectDialog
          title="Formato del progetto"
          submitLabel="Applica"
          initialName={project.name}
          initialSettings={project.settings}
          onCancel={() => setShowSettings(false)}
          onCreate={(name, settings) => {
            updateProjectMeta(name, settings);
            setShowSettings(false);
            show('Formato aggiornato');
          }}
        />
      )}
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {showCover && <CoverDialog onClose={()=>setShowCover(false)} />}
      <Toast />
    </div>
  );
}
