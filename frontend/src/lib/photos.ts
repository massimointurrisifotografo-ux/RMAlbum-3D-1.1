import { Photo, PhotoRecord } from '../types';
import { savePhotoRecord, updatePhotoHandle } from '../db/database';
import { exifTime } from './photoOrder';

export async function photoDates(file: File) {
  return { capturedAt: exifTime(await file.slice(0, 1024 * 1024).arrayBuffer()), fileModifiedAt: file.lastModified };
}

const PREVIEW_LONG = 1100;
const THUMB_LONG = 220;

async function scaleToBlob(
  bitmap: ImageBitmap,
  longSide: number,
  quality: number
): Promise<Blob> {
  const { width, height } = bitmap;
  const scale = Math.min(1, longSide / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', quality)
  );
}

export async function processFile(file: File): Promise<{
  previewBlob: Blob;
  thumbBlob: Blob;
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  const previewBlob = await scaleToBlob(bitmap, PREVIEW_LONG, 0.82);
  const thumbBlob = await scaleToBlob(bitmap, THUMB_LONG, 0.7);
  bitmap.close();
  return { previewBlob, thumbBlob, width, height };
}

export function recordToPhoto(rec: PhotoRecord): Photo {
  return {
    id: rec.id,
    capturedAt: rec.capturedAt,
    fileModifiedAt: rec.fileModifiedAt,
    name: rec.name,
    width: rec.width,
    height: rec.height,
    previewUrl: URL.createObjectURL(rec.previewBlob),
    thumbUrl: URL.createObjectURL(rec.thumbBlob),
    handle: rec.handle,
    needsRelink: rec.needsRelink,
  };
}

const ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

// Importa foto usando File System Access API (Chrome/Edge) per conservare
// l'accesso agli originali. Fallback su <input file> se non disponibile.
export async function importPhotos(
  projectId: string,
  onProgress?: (done: number, total: number) => void
): Promise<Photo[]> {
  const inIframe = window.self !== window.top;
  const fsa = (window as any).showOpenFilePicker;
  const files: { file: File; handle: any }[] = [];
  let useInput = !fsa || inIframe;

  if (fsa && !inIframe) {
    try {
      const handles = await fsa({
        multiple: true,
        types: [{ description: 'Immagini', accept: ACCEPT }],
      });
      for (const handle of handles) {
        const file = await handle.getFile();
        files.push({ file, handle });
      }
    } catch (err: any) {
      // L'utente ha annullato → non fare nulla
      if (err && err.name === 'AbortError') return [];
      // API bloccata (es. dentro l'iframe dell'anteprima) → fallback su input file
      useInput = true;
    }
  }

  if (useInput && files.length === 0) {
    const picked = await pickWithInput();
    for (const file of picked) files.push({ file, handle: undefined });
  }

  const out: Photo[] = [];
  let done = 0;
  for (const { file, handle } of files) {
    try {
      const { previewBlob, thumbBlob, width, height } = await processFile(file);
      const id = crypto.randomUUID();
      const rec: PhotoRecord = {
        ...await photoDates(file),
        id,
        projectId,
        name: file.name,
        width,
        height,
        previewBlob,
        thumbBlob,
        handle,
        needsRelink: !handle,
      };
      await savePhotoRecord(rec);
      out.push(recordToPhoto(rec));
    } catch (e) {
      console.error('Errore importazione', file.name, e);
    }
    done++;
    onProgress?.(done, files.length);
  }
  return out;
}

function pickWithInput(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png';
    input.multiple = true;
    input.onchange = () => resolve(Array.from(input.files || []));
    input.click();
  });
}

export async function ensurePermission(handle: any): Promise<boolean> {
  if (!handle) return false;
  try {
    const opts = { mode: 'read' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if ((await handle.requestPermission(opts)) === 'granted') return true;
  } catch {
    return false;
  }
  return false;
}

// Ricollega l'originale di una foto scegliendo di nuovo il file.
export async function relinkPhoto(photo: Photo): Promise<any | null> {
  const fsa = (window as any).showOpenFilePicker;
  if (!fsa) return null;
  try {
    const [handle] = await fsa({
      multiple: false,
      types: [{ description: 'Immagini', accept: ACCEPT }],
    });
    await updatePhotoHandle(photo.id, handle);
    return handle;
  } catch {
    return null;
  }
}
