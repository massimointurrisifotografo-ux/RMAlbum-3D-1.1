import { create } from 'zustand';
import {
  Project,
  Spread,
  Cell,
  Photo,
  ProjectSettings,
  LayoutTemplate,
  CellRect,
  SCHEMA_VERSION,
} from '../types';
import * as db from '../db/database';
import { getBuiltinLayouts } from '../lib/layouts';
import { fitLayout, rankLayouts } from '../lib/layoutFit';
import { inside } from '../lib/geometry';
import { settingsFor } from '../lib/cover';
import { useToast } from '../components/Toast';

const preferencesKey = 'rmalbum-layout-preferences';
function readLayoutPreferences(): Record<number, string> {
  try {
    const value = JSON.parse(localStorage.getItem(preferencesKey) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

const uid = () => crypto.randomUUID();

function newCell(rect: CellRect): Cell {
  return {
    id: uid(),
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    photoId: null,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    borderMm: 0,
    borderColor: '#FFFFFF',
  };
}

function newSpread(): Spread {
  return {
    id: uid(),
    leftColor: '#FFFFFF',
    rightColor: '#FFFFFF',
    cells: [],
    layoutId: null,
    layoutEdited: false,
  };
}

export function createProject(name: string, settings: ProjectSettings): Project {
  const now = Date.now();
  return {
    id: uid(),
    schemaVersion: SCHEMA_VERSION,
    name,
    settings,
    spreads: [newSpread()],
    snapToGuides: true,
    createdAt: now,
    updatedAt: now,
  };
}

interface State {
  project: Project | null;
  photos: Record<string, Photo>;
  customLayouts: LayoutTemplate[];
  selectedSpreadId: string | null;
  selectedCellId: string | null;
  selectedCellIds: string[];
  selectCells: (ids: string[]) => void;
  deleteCells: (ids: string[]) => void;
  updateCells: (patches: { id: string; rect: CellRect }[]) => void;
  swapPhotos: (source: string, target: string) => void;
  toggleLibraryPhoto: (id: string) => 'inserted' | 'removed' | 'cancelled';
  deletionVisit: string | null;
  skipAutoLayout: boolean;
  pendingPhotoId: string | null;
  // ui
  leftOpen: boolean;
  bottomOpen: boolean;
  showGuides: boolean;
  rightTab: 'layout' | 'properties';
  dirty: boolean;
  layoutOpen: boolean;
  rightOpen: boolean;
  lastLayouts: Record<number, string>;

  // actions
  setProject: (p: Project | null) => void;
  updateProjectMeta: (name: string, settings: ProjectSettings) => void;
  loadProject: (p: Project, photos: Photo[]) => void;
  touch: () => void;
  save: (name?: string) => Promise<void>;
  setPhotoSort: (order: 'name'|'time') => void;
  setCover: (cover: import('../types').CoverSettings) => void;

  addPhotos: (photos: Photo[]) => void;
  updatePhoto: (id: string, patch: Partial<Photo>) => void;

  addSpread: () => void;
  duplicateSpread: (id: string) => void;
  deleteSpread: (id: string) => void;
  selectSpread: (id: string) => void;
  moveSpread: (id: string, dir: -1 | 1) => void;
  updateSpread: (id: string, patch: Partial<Spread>) => void;

  selectCell: (id: string | null) => void;
  updateCell: (id: string, patch: Partial<Cell>) => void;
  addCell: () => void;
  deleteCell: (id: string) => void;
  duplicateCell: (id: string) => void;
  assignPhoto: (cellId: string, photoId: string) => void;
  placePhoto: (photoId: string) => void;
  createCellWithPhoto: (photoId: string, center?: { cx: number; cy: number }) => void;
  removePhotoFromCell: (cellId: string) => void;
  setSnapToGuides: (v: boolean) => void;

  applyLayout: (template: LayoutTemplate) => boolean;
  autoLayout: () => void;
  cycleLayout: (direction: -1 | 1) => void;
  setLayoutOpen: (v: boolean) => void;
  setRightOpen: (v: boolean) => void;
  setPendingPhoto: (id: string | null) => void;

  loadCustomLayouts: () => Promise<void>;
  saveCurrentAsLayout: (name: string) => Promise<void>;
  removeCustomLayout: (id: string) => Promise<void>;

  setLeftOpen: (v: boolean) => void;
  setBottomOpen: (v: boolean) => void;
  setShowGuides: (v: boolean) => void;
  setRightTab: (t: 'layout' | 'properties') => void;
}

function currentSpread(s: State): Spread | undefined {
  return s.project?.spreads.find((sp) => sp.id === s.selectedSpreadId);
}

export const useStore = create<State>((set, get) => ({
  project: null,
  photos: {},
  customLayouts: [],
  selectedSpreadId: null,
  selectedCellId: null,
  selectedCellIds: [],
  deletionVisit: null,
  skipAutoLayout: false,
  pendingPhotoId: null,
  leftOpen: true,
  bottomOpen: true,
  showGuides: true,
  rightTab: 'layout',
  dirty: false,
  layoutOpen: false,
  rightOpen: true,
  lastLayouts: readLayoutPreferences(),

  setProject: (p) =>
    set({
      project: p,
      selectedCellIds: [], deletionVisit: null, skipAutoLayout: false,
      selectedSpreadId: p ? p.spreads[0]?.id ?? null : null,
      selectedCellId: null,
      photos: {},
      pendingPhotoId: null,
      dirty: false,
      layoutOpen: false,
      rightOpen: true,
    }),

  updateProjectMeta: (name, settings) => {
    const p = get().project;
    if (!p) return;
    set({ project: { ...p, name, settings, updatedAt: Date.now() }, dirty: true });
  },

  loadProject: (p, photos) => {
    const map: Record<string, Photo> = {};
    for (const ph of photos) map[ph.id] = ph;
    const normalizedProject = { ...p, snapToGuides: p.snapToGuides ?? true,
      spreads: p.spreads.map((sp) => {
        const catalog = [...getBuiltinLayouts(settingsFor(p,sp)), ...get().customLayouts];
        const template = catalog.find((t) => t.id === sp.layoutId);
        const matches = template && template.cells.length === sp.cells.length &&
          template.cells.every((c, i) => ['x', 'y', 'w', 'h'].every((k) =>
            Math.abs(c[k] - sp.cells[i][k]) < 0.000001));
        return { ...sp, cells: sp.cells.map((c,i) => ({ ...c, layoutRect: c.layoutRect ?? (template?.cells.length === sp.cells.length ? template.cells[i] : undefined) })), layoutEdited: sp.layoutEdited ?? (sp.cells.length > 0 && !matches) };
      }),
    };
    set({
      project: normalizedProject,
      selectedCellIds: [], deletionVisit: null, skipAutoLayout: false,
      photos: map,
      selectedSpreadId: normalizedProject.spreads[0]?.id ?? null,
      selectedCellId: null,
      pendingPhotoId: null,
      dirty: false,
      layoutOpen: false,
      rightOpen: true,
    });
  },

  touch: () => {
    const p = get().project;
    if (!p) return;
    set({ project: { ...p, updatedAt: Date.now() }, dirty: true });
  },

  setPhotoSort: (photoSort) => {
    const p=get().project;
    if(p)set({project:{...p,photoSort,updatedAt:Date.now()},dirty:true});
  },
  setCover: (cover) => {
    const p=get().project;
    if(!p)return;
    const existing=p.spreads.find(s=>s.cover && s.id===get().selectedSpreadId) ?? p.spreads.find(s=>s.cover);
    const sp={...(existing ?? newSpread()),cover};
    set({project:{...p,spreads:existing?p.spreads.map(s=>s.id===sp.id?sp:s):[...p.spreads,sp],updatedAt:Date.now()},dirty:true});
    get().selectSpread(sp.id);
  },

  save: async (name) => {
    const p = get().project;
    if (!p) return;
    if (name !== undefined && !name.trim()) throw new Error('Inserisci un nome');
    const toSave = { ...p, name: name?.trim() ?? p.name, nameConfirmed: name !== undefined ? true : p.nameConfirmed, updatedAt: Date.now() };
    await db.saveProject(toSave);
    // Do not overwrite edits made while IndexedDB is saving.
    if (get().project === p) set({ project: toSave, dirty: false });
    else if (get().project?.id === p.id) set({ project: { ...get().project!, name: toSave.name, nameConfirmed: toSave.nameConfirmed }, dirty: true });
  },

  addPhotos: (photos) =>
    set((s) => {
      const map = { ...s.photos };
      for (const ph of photos) map[ph.id] = ph;
      return { photos: map };
    }),

  updatePhoto: (id, patch) =>
    set((s) => ({ photos: { ...s.photos, [id]: { ...s.photos[id], ...patch } } })),

  addSpread: () => {
    const p = get().project;
    if (!p) return;
    const sp = newSpread();
    set({
      project: { ...p, spreads: [...p.spreads, sp], updatedAt: Date.now() },
      selectedSpreadId: sp.id,
      selectedCellId: null,
      dirty: true,
    });
  },

  duplicateSpread: (id) => {
    const p = get().project;
    if (!p) return;
    const idx = p.spreads.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const src = p.spreads[idx];
    const copy: Spread = {
      ...src,
      id: uid(),
      cells: src.cells.map((c) => ({ ...c, id: uid() })),
    };
    const spreads = [...p.spreads];
    spreads.splice(idx + 1, 0, copy);
    set({
      project: { ...p, spreads, updatedAt: Date.now() },
      selectedSpreadId: copy.id,
      selectedCellId: null,
      dirty: true,
    });
  },

  deleteSpread: (id) => {
    const p = get().project;
    if (!p || p.spreads.length <= 1) return;
    const spreads = p.spreads.filter((s) => s.id !== id);
    set({
      project: { ...p, spreads, updatedAt: Date.now() },
      selectedSpreadId: spreads[0].id,
      selectedCellId: null,
      dirty: true,
    });
  },

  selectSpread: (id) => set({ selectedSpreadId: id, selectedCellId: null, selectedCellIds: [], deletionVisit: null }),

  moveSpread: (id, dir) => {
    const p = get().project;
    if (!p) return;
    const idx = p.spreads.findIndex((s) => s.id === id);
    const ni = idx + dir;
    if (idx < 0 || ni < 0 || ni >= p.spreads.length) return;
    const spreads = [...p.spreads];
    const [item] = spreads.splice(idx, 1);
    spreads.splice(ni, 0, item);
    set({ project: { ...p, spreads, updatedAt: Date.now() }, dirty: true });
  },

  updateSpread: (id, patch) => {
    const p = get().project;
    if (!p) return;
    const spreads = p.spreads.map((s) => (s.id === id ? { ...s, ...patch } : s));
    set({ project: { ...p, spreads, updatedAt: Date.now() }, dirty: true });
  },

  selectCell: (id) => set({ selectedCellId: id, selectedCellIds: id ? [id] : [] }),
  updateCells: (patches) => {
    const sp = currentSpread(get());
    if (!sp) return;
    const valid = patches.filter(p => [p.rect.x,p.rect.y,p.rect.w,p.rect.h].every(Number.isFinite));
    get().updateSpread(sp.id, { cells: sp.cells.map(c => {
      const patch = valid.find(p => p.id === c.id);
      return patch ? { ...c, ...inside(patch.rect) } : c;
    }), layoutEdited: true });
  },
  swapPhotos: (source, target) => {
    const sp = currentSpread(get());
    const a = sp?.cells.find(c => c.id === source), b = sp?.cells.find(c => c.id === target);
    if (!sp || !a?.photoId || !b || a === b) return;
    // Reset framing for the destination aspect ratio, preserve cell geometry/borders.
    get().updateSpread(sp.id, { cells: sp.cells.map(c => c === a || c === b ? {
      ...c, photoId: c === a ? b.photoId : a.photoId, rotation: c === a ? b.rotation : a.rotation, zoom: 1, offsetX: 0, offsetY: 0,
    } : c) });
  },
  toggleLibraryPhoto: (id) => {
    const sp = currentSpread(get());
    if (!sp || !get().photos[id]) return 'cancelled';
    const ids = sp.cells.filter(c => c.photoId === id).map(c => c.id);
    if (!ids.length) { get().placePhoto(id); return 'inserted'; }
    get().deleteCells(ids);
    return currentSpread(get())?.cells.some(c => c.photoId === id) ? 'cancelled' : 'removed';
  },
  selectCells: (ids) => {
    const valid = [...new Set(ids)].filter(id => currentSpread(get())?.cells.some(c => c.id === id));
    set({ selectedCellIds: valid, selectedCellId: valid[valid.length - 1] ?? null });
  },
  deleteCells: (ids) => {
    const sp = currentSpread(get());
    if (!sp) return;
    const targets = sp.cells.filter(c => ids.includes(c.id));
    if (!targets.length) return;
    const visit = `${get().project!.id}/${sp.id}`;
    if (get().deletionVisit !== visit && !window.confirm('Eliminare le celle selezionate dal foglio? Le foto restano nella libreria. Non verrà richiesto di nuovo finché rimani su questo foglio.')) return;
    set({ deletionVisit: visit, skipAutoLayout: targets.some(c => !!c.photoId) });
    get().updateSpread(sp.id, { cells: sp.cells.filter(c => !ids.includes(c.id)), layoutEdited: true });
    get().selectCell(null);
  },

  updateCell: (id, patch) => {
    const p = get().project;
    const sid = get().selectedSpreadId;
    if (!p || !sid) return;
    const spreads = p.spreads.map((s) =>
      s.id === sid
        ? { ...s, layoutEdited: s.layoutEdited || s.cells.some((c) => c.id === id &&
              ['x', 'y', 'w', 'h'].some((k) => patch[k] !== undefined && patch[k] !== c[k])),
            cells: s.cells.map((c) => (c.id === id ? { ...c, ...patch } : c)) }
        : s
    );
    set({ project: { ...p, spreads, updatedAt: Date.now() }, dirty: true });
  },

  addCell: () => {
    const sp = currentSpread(get());
    if (!sp) return;
    const cell = newCell({ x: 0.3, y: 0.3, w: 0.3, h: 0.3 });
    get().updateSpread(sp.id, { cells: [...sp.cells, cell], layoutEdited: true });
    set({ selectedCellId: cell.id });
  },

  deleteCell: (id) => {
    get().deleteCells([id]);
  },

  duplicateCell: (id) => {
    const sp = currentSpread(get());
    if (!sp) return;
    const src = sp.cells.find((c) => c.id === id);
    if (!src) return;
    const copy: Cell = {
      ...src,
      id: uid(),
      x: Math.min(0.9, src.x + 0.03),
      y: Math.min(0.9, src.y + 0.03),
    };
    get().updateSpread(sp.id, { cells: [...sp.cells, copy], layoutEdited: true });
    set({ selectedCellId: copy.id });
  },

  assignPhoto: (cellId, photoId) => {
    get().updateCell(cellId, { photoId, rotation: 0, zoom: 1, offsetX: 0, offsetY: 0 });
    set({ pendingPhotoId: null });
  },

  // Inserisce la foto: cella selezionata vuota → prima cella vuota → nuova cella.
  // Una cella già occupata si sostituisce soltanto trascinandovi sopra una foto.
  placePhoto: (photoId) => {
    const s = get();
    const sp = currentSpread(s);
    if (!sp) return;
    const selected = s.selectedCellId
      ? sp.cells.find((c) => c.id === s.selectedCellId)
      : undefined;
    if (selected && !selected.photoId) {
      get().assignPhoto(selected.id, photoId);
      return;
    }
    const empty = sp.cells.find((c) => !c.photoId);
    if (empty) {
      get().assignPhoto(empty.id, photoId);
      set({ selectedCellId: empty.id });
      return;
    }
    get().createCellWithPhoto(photoId);
  },

  createCellWithPhoto: (photoId, center) => {
    const s = get();
    const sp = currentSpread(s);
    if (!sp || !s.project) return;
    const photo = s.photos[photoId];
    const { widthCm, heightCm } = settingsFor(s.project,sp);
    // rapporto larghezza/altezza in coordinate proporzionali per rispettare
    // il rapporto originale della foto senza deformarla
    let w = 0.4;
    let h = 0.6;
    if (photo && photo.width && photo.height) {
      const k = (photo.width / photo.height) * (heightCm / widthCm); // = w/h
      h = 0.62;
      w = h * k;
      const maxW = 0.44;
      const maxH = 0.9;
      if (w > maxW) {
        w = maxW;
        h = w / k;
      }
      if (h > maxH) {
        h = maxH;
        w = h * k;
      }
    }
    const cx = center ? center.cx : 0.25;
    const cy = center ? center.cy : 0.5;
    const x = Math.max(0, Math.min(1 - w, cx - w / 2));
    const y = Math.max(0, Math.min(1 - h, cy - h / 2));
    const cell = newCell({ x, y, w, h });
    cell.photoId = photoId;
    get().updateSpread(sp.id, { cells: [...sp.cells, cell] });
    set({ selectedCellId: cell.id, pendingPhotoId: null });
  },

  setSnapToGuides: (v) => {
    const p = get().project;
    if (!p) return;
    set({ project: { ...p, snapToGuides: v, updatedAt: Date.now() }, dirty: true });
  },

  removePhotoFromCell: (cellId) =>
    get().updateCell(cellId, { photoId: null, rotation: 0, zoom: 1, offsetX: 0, offsetY: 0 }),

  applyLayout: (template) => {
    const sp = currentSpread(get());
    if (!sp) return false;
    const occupied = sp.cells.filter((c) => c.photoId);
    if (occupied.length > template.cells.length) {
      useToast.getState().show('Questo layout ha meno celle delle foto presenti. Scegli un layout più grande.');
      return false;
    }
    if (sp.layoutEdited && !window.confirm('Hai modificato il layout senza salvarlo nella libreria. Applicare il nuovo layout e sostituire queste modifiche? Premi Annulla per conservarle e usare Salva layout.')) return false;
    // conserva le foto (in ordine) quando cambia layout
    const placed = sp.cells
      .filter((c) => c.photoId)
      .map((c) => ({
        photoId: c.photoId,
        zoom: c.zoom,
        rotation: c.rotation,
        offsetX: c.offsetX,
        offsetY: c.offsetY,
        borderMm: c.borderMm,
        borderColor: c.borderColor,
      }));
    const assignment = fitLayout(template, occupied.map(c => get().photos[c.photoId!] ?? { width:1, height:1 }), settingsFor(get().project!,sp)).slots;
    const cells: Cell[] = template.cells.map((rect, i) => {
      const photoIndex = assignment.indexOf(i);
      const cell = { ...newCell(rect), layoutRect: { ...rect }, id: occupied[photoIndex]?.id ?? uid() };
      if (photoIndex >= 0) {
        Object.assign(cell, placed[photoIndex]);
      }
      return cell;
    });
    get().updateSpread(sp.id, { cells, layoutId: template.id, layoutEdited: false });
    const lastLayouts = { ...get().lastLayouts, [template.photoCount]: template.id };
    try { localStorage.setItem(preferencesKey, JSON.stringify(lastLayouts)); } catch {}
    set({ lastLayouts });
    set({ selectedCellId: null });
    return true;
  },

  autoLayout: () => {
    if (get().skipAutoLayout) { set({ skipAutoLayout: false }); return; }
    const sp = currentSpread(get());
    if (!sp) return;
    const count = sp.cells.filter((c) => c.photoId).length;
    if (!count) return;
    const settings=settingsFor(get().project!,sp);
    const options = [...getBuiltinLayouts(settings), ...get().customLayouts].filter((l) => l.photoCount === count);
    const template = rankLayouts(options, sp.cells.filter(c => c.photoId).map(c => get().photos[c.photoId!] ?? {width:1,height:1}), settings, get().lastLayouts[count])[0];
    if (!template) {
      useToast.getState().show(`Nessun layout da ${count} foto: composizione mantenuta. Puoi salvarla come nuovo layout.`);
      return;
    }
    get().applyLayout(template);
  },

  cycleLayout: (direction) => {
    const sp = currentSpread(get());
    if (!sp) return;
    const count = sp.cells.filter((c) => c.photoId).length || sp.cells.length;
    const settings=settingsFor(get().project!,sp);
    const options = rankLayouts([...getBuiltinLayouts(settings), ...get().customLayouts].filter((l) => l.photoCount === count), sp.cells.filter(c => c.photoId).map(c => get().photos[c.photoId!] ?? {width:1,height:1}), settings);
    if (!options.length) {
      useToast.getState().show(`Nessun layout disponibile per ${count} foto`);
      return;
    }
    const index = options.findIndex((l) => l.id === sp.layoutId);
    const next = index < 0 ? (direction === 1 ? 0 : options.length - 1)
      : (index + direction + options.length) % options.length;
    if (get().applyLayout(options[next])) useToast.getState().show(options[next].name);
  },

  setLayoutOpen: (v) => set({ layoutOpen: v }),
  setRightOpen: (v) => set({ rightOpen: v }),

  setPendingPhoto: (id) => set({ pendingPhotoId: id }),

  loadCustomLayouts: async () => {
    const layouts = await db.listCustomLayouts();
    set({ customLayouts: layouts });
  },

  saveCurrentAsLayout: async (name) => {
    const sp = currentSpread(get());
    if (!sp) return;
    const layout: LayoutTemplate = {
      id: uid(),
      name,
      photoCount: sp.cells.length,
      cells: sp.cells.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h })),
      custom: true,
    };
    await db.saveCustomLayout(layout);
    set((s) => ({ customLayouts: [...s.customLayouts, layout] }));
    // Il salvataggio del progetto non equivale al salvataggio di un layout riutilizzabile.
    const latest = get().project?.spreads.find((s) => s.id === sp.id);
    if (latest && latest.cells.length === sp.cells.length && latest.cells.every((c, i) =>
      ['x', 'y', 'w', 'h'].every((k) => c[k] === sp.cells[i][k]))) {
      get().updateSpread(sp.id, { layoutId: layout.id, layoutEdited: false, cells: latest.cells.map((c,i) => ({ ...c, layoutRect: { ...layout.cells[i] } })) });
    }
    const lastLayouts = { ...get().lastLayouts, [layout.photoCount]: layout.id };
    try { localStorage.setItem(preferencesKey, JSON.stringify(lastLayouts)); } catch {}
    set({ lastLayouts });
  },

  removeCustomLayout: async (id) => {
    await db.deleteCustomLayout(id);
    const s = get();
    const lastLayouts = Object.fromEntries(Object.entries(s.lastLayouts).filter(([, value]) => value !== id));
    try { localStorage.setItem(preferencesKey, JSON.stringify(lastLayouts)); } catch {}
    set({ customLayouts: s.customLayouts.filter((l) => l.id !== id), lastLayouts,
      dirty: s.dirty || !!s.project?.spreads.some((sp) => sp.layoutId === id),
      project: s.project ? { ...s.project, spreads: s.project.spreads.map((sp) =>
        sp.layoutId === id ? { ...sp, layoutEdited: true } : sp) } : null,
    });
  },

  setLeftOpen: (v) => set({ leftOpen: v }),
  setBottomOpen: (v) => set({ bottomOpen: v }),
  setShowGuides: (v) => set({ showGuides: v }),
  setRightTab: (t) => set({ rightTab: t }),
}));

export function useCurrentSpread(): Spread | undefined {
  return useStore((s) => s.project?.spreads.find((sp) => sp.id === s.selectedSpreadId));
}

export function useUsedPhotoIds(): Set<string> {
  return useStore((s) => {
    const set = new Set<string>();
    s.project?.spreads.forEach((sp) =>
      sp.cells.forEach((c) => c.photoId && set.add(c.photoId))
    );
    return set;
  });
}
