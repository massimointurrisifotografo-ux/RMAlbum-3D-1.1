import { CellRect, LayoutTemplate, ProjectSettings } from '../types';
import { guideLayouts } from './guideLayouts';

export function getBuiltinLayouts(settings: ProjectSettings): LayoutTemplate[] {
  return [...guideLayouts(settings), ...BUILTIN_LAYOUTS];
}

const M = 0.035; // margine esterno
const G = 0.02; // spaziatura tra celle

function grid(cols: number, rows: number): CellRect[] {
  const cw = (1 - 2 * M - (cols - 1) * G) / cols;
  const ch = (1 - 2 * M - (rows - 1) * G) / rows;
  const cells: CellRect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ x: M + c * (cw + G), y: M + r * (ch + G), w: cw, h: ch });
    }
  }
  return cells;
}

const H = 1 - 2 * M; // altezza utile
const leftW = 0.5 - M - G / 2;
const rightX = 0.5 + G / 2;
const rightW = 1 - M - rightX;

// count 3: grande a sinistra + 2 impilate a destra
const bigLeft2: CellRect[] = [
  { x: M, y: M, w: leftW, h: H },
  { x: rightX, y: M, w: rightW, h: (H - G) / 2 },
  { x: rightX, y: M + (H - G) / 2 + G, w: rightW, h: (H - G) / 2 },
];

// count 5: grande a sinistra + griglia 2x2 a destra
const rQw = (rightW - G) / 2;
const rQh = (H - G) / 2;
const bigLeftQuad: CellRect[] = [
  { x: M, y: M, w: leftW, h: H },
  { x: rightX, y: M, w: rQw, h: rQh },
  { x: rightX + rQw + G, y: M, w: rQw, h: rQh },
  { x: rightX, y: M + rQh + G, w: rQw, h: rQh },
  { x: rightX + rQw + G, y: M + rQh + G, w: rQw, h: rQh },
];

function rowCells(y: number, h: number, n: number): CellRect[] {
  const w = (1 - 2 * M - (n - 1) * G) / n;
  const out: CellRect[] = [];
  for (let i = 0; i < n; i++) out.push({ x: M + i * (w + G), y, w, h });
  return out;
}

const rowH = (H - G) / 2;
const topY = M;
const botY = M + rowH + G;

// count 5: 2 sopra + 3 sotto
const two3: CellRect[] = [...rowCells(topY, rowH, 2), ...rowCells(botY, rowH, 3)];
// count 7: 3 sopra + 4 sotto
const three4: CellRect[] = [...rowCells(topY, rowH, 3), ...rowCells(botY, rowH, 4)];
// count 7: 4 sopra + 3 sotto
const four3: CellRect[] = [...rowCells(topY, rowH, 4), ...rowCells(botY, rowH, 3)];

export const BUILTIN_LAYOUTS: LayoutTemplate[] = [
  { id: 'b-1a', name: '1 · Pieno', photoCount: 1, cells: [{ x: 0.04, y: 0.04, w: 0.92, h: 0.92 }] },
  { id: 'b-1b', name: '1 · Centrato', photoCount: 1, cells: [{ x: 0.14, y: 0.1, w: 0.72, h: 0.8 }] },

  { id: 'b-2a', name: '2 · Affiancate', photoCount: 2, cells: grid(2, 1) },
  { id: 'b-2b', name: '2 · Impilate', photoCount: 2, cells: grid(1, 2) },

  { id: 'b-3a', name: '3 · Colonne', photoCount: 3, cells: grid(3, 1) },
  { id: 'b-3b', name: '3 · Grande + 2', photoCount: 3, cells: bigLeft2 },

  { id: 'b-4a', name: '4 · Griglia 2×2', photoCount: 4, cells: grid(2, 2) },
  { id: 'b-4b', name: '4 · Colonne', photoCount: 4, cells: grid(4, 1) },

  { id: 'b-5a', name: '5 · Grande + 4', photoCount: 5, cells: bigLeftQuad },
  { id: 'b-5b', name: '5 · 2 + 3', photoCount: 5, cells: two3 },

  { id: 'b-6a', name: '6 · Griglia 3×2', photoCount: 6, cells: grid(3, 2) },
  { id: 'b-6b', name: '6 · Griglia 2×3', photoCount: 6, cells: grid(2, 3) },

  { id: 'b-7a', name: '7 · 3 + 4', photoCount: 7, cells: three4 },
  { id: 'b-7b', name: '7 · 4 + 3', photoCount: 7, cells: four3 },

  { id: 'b-8a', name: '8 · Griglia 4×2', photoCount: 8, cells: grid(4, 2) },
  { id: 'b-8b', name: '8 · Griglia 2×4', photoCount: 8, cells: grid(2, 4) },
];
