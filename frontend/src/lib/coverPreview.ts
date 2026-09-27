import { drawPhoto } from './photoRender';
import { Photo, Project, Spread } from '../types';
import { computeCover } from './units';
import { coverRegions, Crop } from './config3d';

const loadImage = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

// Rende lo spread con le anteprime (nessun accesso agli originali), max `maxPx` sul lato lungo.
export async function renderSpreadPreview(project: Project, spread: Spread, photos: Record<string, Photo>, widthCm: number, heightCm: number, maxPx = 1600) {
  const scale = maxPx / Math.max(widthCm, heightCm);
  const W = Math.round(widthCm * scale), H = Math.round(heightCm * scale);
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = spread.leftColor; ctx.fillRect(0, 0, Math.round(W / 2), H);
  ctx.fillStyle = spread.rightColor; ctx.fillRect(Math.round(W / 2), 0, W - Math.round(W / 2), H);
  for (const cell of spread.cells) {
    const cx = cell.x * W, cy = cell.y * H, cw = cell.w * W, ch = cell.h * H;
    const border = (cell.borderMm / 10) * scale;
    if (cell.borderMm > 0) { ctx.fillStyle = cell.borderColor; ctx.fillRect(cx, cy, cw, ch); }
    const ix = cx + border, iy = cy + border, iw = Math.max(1, cw - 2 * border), ih = Math.max(1, ch - 2 * border);
    const photo = cell.photoId ? photos[cell.photoId] : null;
    if (!photo) { if (cell.photoId) throw new Error('Una foto della copertina non è disponibile. Ricollegala prima di pubblicare.'); continue; }
    try {
      const img = await loadImage(photo.previewUrl);
      const c = computeCover(img.naturalWidth, img.naturalHeight, iw / ih, cell.zoom, cell.offsetX, cell.offsetY);
      drawPhoto(ctx,img,img.naturalWidth,img.naturalHeight,ix,iy,iw,ih,cell.zoom,cell.offsetX,cell.offsetY,cell.rotation);
    } catch { throw new Error(`Anteprima non disponibile per ${photo.name}. Ricollega la foto prima di pubblicare.`); }
  }
  return { canvas, scale };
}

// Solo la porzione visibile del fronte (esclusi risvolti e abbondanze).
export async function renderCoverFront(project: Project, spread: Spread, photos: Record<string, Photo>, maxPx = 1600) {
  const r = coverRegions(spread.cover!, project.settings.widthCm / 2);
  const { canvas, scale } = await renderSpreadPreview(project, spread, photos, r.width, r.height, maxPx);
  const f = r.front;
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round((f.x1 - f.x0) * scale)); out.height = Math.max(1, Math.round((f.y1 - f.y0) * scale));
  out.getContext('2d')!.drawImage(canvas, f.x0 * scale, f.y0 * scale, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// Foto interna del Box C con ritaglio indipendente.
export async function renderPhotoCrop(photo: Photo, aspect: number, crop: Crop, maxPx = 1400) {
  const img = await loadImage(photo.previewUrl);
  const W = aspect >= 1 ? maxPx : Math.round(maxPx * aspect), H = aspect >= 1 ? Math.round(maxPx / aspect) : maxPx;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const c = computeCover(img.naturalWidth, img.naturalHeight, aspect, crop.zoom, crop.offsetX, crop.offsetY);
  canvas.getContext('2d')!.drawImage(img, c.sx, c.sy, c.sw, c.sh, 0, 0, W, H);
  return canvas;
}

export const canvasBlob = (c: HTMLCanvasElement, q = 0.85) => new Promise<Blob>((res,rej) => c.toBlob(b => b ? res(b) : rej(new Error('Creazione anteprima non riuscita')), 'image/jpeg', q));
