import JSZip from 'jszip';
import { drawPhoto } from './photoRender';
import { Project, Spread, Photo } from '../types';
import { cmToPx, mmToPrintPx, computeCover } from './units';
import { ensurePermission } from './photos';
import { settingsFor } from './cover';
import { zipFileName } from './exportName';

export interface ExportResult {
  missing: { spreadIndex: number; photoName: string }[];
}

async function loadOriginal(photo: Photo): Promise<ImageBitmap | null> {
  if (photo.handle) {
    const ok = await ensurePermission(photo.handle);
    if (!ok) return null;
    try {
      const file = await photo.handle.getFile();
      return await createImageBitmap(file);
    } catch {
      return null;
    }
  }
  return null;
}

export async function renderSpread(
  project: Project,
  spread: Spread,
  photos: Record<string, Photo>,
  spreadIndex: number,
  missing: { spreadIndex: number; photoName: string }[]
): Promise<HTMLCanvasElement> {
  const { widthCm, heightCm, dpi } = settingsFor(project,spread);
  const W = cmToPx(widthCm, dpi);
  const H = cmToPx(heightCm, dpi);
  if(W>30000 || H>30000 || W*H>150000000) throw new Error('Formato troppo grande: riduci misure o DPI prima di esportare.');
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // sfondi pagina sinistra / destra
  ctx.fillStyle = spread.leftColor;
  ctx.fillRect(0, 0, Math.round(W / 2), H);
  ctx.fillStyle = spread.rightColor;
  ctx.fillRect(Math.round(W / 2), 0, W - Math.round(W / 2), H);

  for (const cell of spread.cells) {
    const cx = cell.x * W;
    const cy = cell.y * H;
    const cw = cell.w * W;
    const ch = cell.h * H;
    const border = mmToPrintPx(cell.borderMm, dpi);

    // bordo interno colorato
    if (cell.borderMm > 0) {
      ctx.fillStyle = cell.borderColor;
      ctx.fillRect(cx, cy, cw, ch);
    }

    const innerX = cx + border;
    const innerY = cy + border;
    const innerW = Math.max(1, cw - 2 * border);
    const innerH = Math.max(1, ch - 2 * border);

    if (!cell.photoId) continue;
    const photo = photos[cell.photoId];
    if (!photo) continue;
    const bitmap = await loadOriginal(photo);
    if (!bitmap) {
      missing.push({ spreadIndex, photoName: photo.name });
      continue;
    }
    drawPhoto(ctx,bitmap,bitmap.width,bitmap.height,innerX,innerY,innerW,innerH,cell.zoom,cell.offsetX,cell.offsetY,cell.rotation);
    bitmap.close();
  }

  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', quality)
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const exportFileName = (project: Project, i: number) => project.spreads[i].cover
  ? `Copertina_${project.spreads.slice(0,i+1).filter(s=>s.cover).length}.jpg`
  : String(project.spreads.slice(0,i+1).filter(s=>!s.cover).length).padStart(3,'0')+'.jpg';

// Esporta una singola doppia pagina (indice 0-based nel progetto).
export async function exportSingle(
  project: Project,
  photos: Record<string, Photo>,
  spreadIndex: number,
  quality: number
): Promise<ExportResult> {
  const missing: { spreadIndex: number; photoName: string }[] = [];
  const canvas = await renderSpread(
    project,
    project.spreads[spreadIndex],
    photos,
    spreadIndex,
    missing
  );
  const blob = await canvasToBlob(canvas, quality);
  download(blob, exportFileName(project,spreadIndex));
  return { missing };
}

// Esporta tutte (o alcune) le doppie pagine in un file ZIP.
export async function exportZip(
  project: Project,
  photos: Record<string, Photo>,
  indices: number[],
  quality: number,
  onProgress?: (done: number, total: number) => void
): Promise<ExportResult> {
  const missing: { spreadIndex: number; photoName: string }[] = [];
  const zip = new JSZip();
  let done = 0;
  for (const idx of indices) {
    const canvas = await renderSpread(project, project.spreads[idx], photos, idx, missing);
    const blob = await canvasToBlob(canvas, quality);
    zip.file(exportFileName(project,idx), blob);
    done++;
    onProgress?.(done, indices.length);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  download(zipBlob, zipFileName(project.name,quality));
  return { missing };
}
