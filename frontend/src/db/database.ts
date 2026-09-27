import { openDB, IDBPDatabase } from 'idb';
import { Project, PhotoRecord, LayoutTemplate, Preset } from '../types';

const DB_NAME = 'rmalbum';
const VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('photos')) {
          const s = db.createObjectStore('photos', { keyPath: 'id' });
          s.createIndex('projectId', 'projectId');
        }
        if (!db.objectStoreNames.contains('layouts')) {
          db.createObjectStore('layouts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('presets')) {
          db.createObjectStore('presets', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// -------- Progetti --------
export async function saveProject(project: Project) {
  const db = await getDB();
  await db.put('projects', project);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDB();
  const all = (await db.getAll('projects')) as Project[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id: string) {
  const db = await getDB();
  await db.delete('projects', id);
  const photos = await db.getAllFromIndex('photos', 'projectId', id);
  const tx = db.transaction('photos', 'readwrite');
  for (const p of photos as PhotoRecord[]) await tx.store.delete(p.id);
  await tx.done;
}

// -------- Foto --------
export async function savePhotoRecord(rec: PhotoRecord) {
  const db = await getDB();
  await db.put('photos', rec);
}

export async function getPhotosByProject(projectId: string): Promise<PhotoRecord[]> {
  const db = await getDB();
  return (await db.getAllFromIndex('photos', 'projectId', projectId)) as PhotoRecord[];
}

export async function updatePhotoHandle(id: string, handle: any) {
  const db = await getDB();
  const rec = (await db.get('photos', id)) as PhotoRecord | undefined;
  if (rec) {
    rec.handle = handle;
    rec.needsRelink = false;
    await db.put('photos', rec);
  }
}

export async function savePhotoDates(id: string, dates: { capturedAt?: number; fileModifiedAt?: number }) {
  const db=await getDB();
  const rec=await db.get('photos',id);
  if(rec) await db.put('photos',{...rec,...dates});
}

// Atomic copy: a failed transaction leaves neither a partial project nor orphan photos.
export async function copyProject(project: Project): Promise<Project> {
  const db=await getDB();
  const records=await getPhotosByProject(project.id);
  const id=crypto.randomUUID();
  const ids=new Map(records.map(r=>[r.id,crypto.randomUUID()]));
  if(project.spreads.some(s=>s.cells.some(c=>c.photoId && !ids.has(c.photoId))))throw new Error('Alcune foto non sono disponibili per la copia.');
  const productConfig=project.productConfig ? {...project.productConfig,projectId:id,projectName:project.name,previews:{},box:{...project.productConfig.box,cInteriorPhotoId:project.productConfig.box.cInteriorPhotoId ? ids.get(project.productConfig.box.cInteriorPhotoId) ?? null : null}} : undefined;
  const copy={...project,id,productConfig,createdAt:Date.now(),updatedAt:Date.now(),spreads:project.spreads.map(s=>({...s,id:crypto.randomUUID(),cells:s.cells.map(c=>({...c,id:crypto.randomUUID(),photoId:c.photoId ? ids.get(c.photoId) ?? null : null}))}))};
  const tx=db.transaction(['projects','photos'],'readwrite');
  await tx.objectStore('projects').put(copy);
  for(const r of records) await tx.objectStore('photos').put({...r,id:ids.get(r.id)!,projectId:id});
  await tx.done;
  return copy;
}

// -------- Layout personali --------
export async function saveCustomLayout(layout: LayoutTemplate) {
  const db = await getDB();
  await db.put('layouts', layout);
}

export async function listCustomLayouts(): Promise<LayoutTemplate[]> {
  const db = await getDB();
  return (await db.getAll('layouts')) as LayoutTemplate[];
}

export async function deleteCustomLayout(id: string) {
  const db = await getDB();
  await db.delete('layouts', id);
}

// -------- Preferiti (profili misure) --------
export async function savePreset(preset: Preset) {
  const db = await getDB();
  const all = (await db.getAll('presets')) as Preset[];
  if (all.length >= 10 && !all.find((p) => p.id === preset.id)) {
    throw new Error('Massimo 10 profili preferiti.');
  }
  await db.put('presets', preset);
}

export async function listPresets(): Promise<Preset[]> {
  const db = await getDB();
  return (await db.getAll('presets')) as Preset[];
}

export async function deletePreset(id: string) {
  const db = await getDB();
  await db.delete('presets', id);
}
