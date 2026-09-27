export const cmToPx = (cm: number, dpi: number) => Math.round((cm / 2.54) * dpi);
export const mmToScreenPx = (mm: number, pxPerCm: number) => (mm / 10) * pxPerCm;
export const mmToPrintPx = (mm: number, dpi: number) => (mm / 10 / 2.54) * dpi;

export interface Crop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

// Keep the current visible centre fixed while zooming, even after panning.
// On zoom-out clamp only when an image edge would otherwise leave a gap.
export function centeredZoom(imgW: number, imgH: number, cellAR: number,
  oldZoom: number, zoom: number, offsetX: number, offsetY: number) {
  const before = computeCover(imgW, imgH, cellAR, oldZoom, offsetX, offsetY);
  const after = computeCover(imgW, imgH, cellAR, zoom, 0, 0);
  const offset = (size: number, crop: number, center: number) =>
    size - crop > 1e-9 ? Math.max(-1, Math.min(1, (size - 2 * center) / (size - crop))) : 0;
  return {
    zoom,
    offsetX: offset(imgW, after.sw, before.sx + before.sw / 2),
    offsetY: offset(imgH, after.sh, before.sy + before.sh / 2),
  };
}

// Calcola il rettangolo sorgente dell'immagine per un riempimento "aspect fill"
// della cella, con zoom e punto focale. imgW/imgH sono le dimensioni dell'immagine
// usata (anteprima o originale). cellAR = larghezza/altezza dell'area foto.
export function computeCover(
  imgW: number,
  imgH: number,
  cellAR: number,
  zoom: number,
  offsetX: number,
  offsetY: number
): Crop {
  const imageAR = imgW / imgH;
  let sw: number;
  let sh: number;
  if (imageAR >= cellAR) {
    sh = imgH;
    sw = imgH * cellAR;
  } else {
    sw = imgW;
    sh = imgW / cellAR;
  }
  const z = Math.max(1, zoom);
  sw /= z;
  sh /= z;
  const maxPanX = imgW - sw;
  const maxPanY = imgH - sh;
  let sx = (maxPanX * (1 - offsetX)) / 2;
  let sy = (maxPanY * (1 - offsetY)) / 2;
  sx = Math.max(0, Math.min(maxPanX, sx));
  sy = Math.max(0, Math.min(maxPanY, sy));
  return { sx, sy, sw, sh };
}
