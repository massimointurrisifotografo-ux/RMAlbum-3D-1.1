import { CoverSettings, Project, Spread } from '../types';
import { coverGeometry } from './cover';
import type { Family, Variant } from './api';

export type Orientation = 'quadrato' | 'orizzontale' | 'verticale';
export type CoverModel = 'photo_front' | 'material';
export type BoxType = 'none' | 'C' | 'G';
export type SurfaceKey = 'cover' | 'spine' | 'boxCExterior' | 'boxCInterior' | 'boxCLidInterior' | 'boxG';
export interface MaterialRef { familyId: string; code: string }
export interface Crop { zoom: number; offsetX: number; offsetY: number }

export interface AlbumSpec {
  orientation: Orientation;
  coverMode: CoverSettings['mode'];
  coverModel: CoverModel;
  boardWidthCm: number;   // piatto visibile, esclusi risvolti e abbondanze
  frontBandCm?: number;   // fascia sul fronte, inclusa in boardWidthCm; non è lo spessore dorso
  boardHeightCm: number;
  spineCm: number;        // dorso dalla copertina del progetto
  boardThicknessCm: number; // indicativo, non presente nel catalogo
  pages: number;
  hasCoverSpread: boolean;
  spineSideNoWrap?: boolean; // file solo fronte con risvolto su tre lati (lato dorso senza risvolto)
}
export interface BoxSpec {
  type: BoxType;
  cInterior: 'photo' | 'fabric';
  cInteriorPhotoId: string | null;
  cInteriorCrop: Crop;
  wallCm: number;       // indicativo: misure box non presenti nel catalogo
  clearanceCm: number;
  plexiCm: number;
}
export interface ConfigBody {
  name: string;
  projectId: string;
  projectName: string;
  album: AlbumSpec;
  materials: Partial<Record<SurfaceKey, MaterialRef | null>>;
  box: BoxSpec;
  previews: { coverFront?: string | null; boxInterior?: string | null };
  notes: string;
}
export interface SavedConfig extends ConfigBody {
  id: string; ownerId: string; shareToken: string | null; shareRevoked: boolean; shareExpiresAt: string | null;
  published?: (ConfigBody & { publishedAt: string }) | null; createdAt: string; updatedAt: string;
}
export interface SharedConfig extends ConfigBody { publishedAt: string; variants: Variant[]; families: Family[] }

export const SURFACES: { key: SurfaceKey; label: string; hint: string }[] = [
  { key: 'cover', label: 'Fronte copertina', hint: 'Solo il piatto anteriore: materiale oppure fotografia' },
  { key: 'spine', label: 'Dorso, fascia e retro', hint: 'La fascia laterale sul fronte usa lo stesso materiale del dorso e del retro' },
  { key: 'boxCExterior', label: 'Box C — esterno', hint: 'Coperchio e base' },
  { key: 'boxCInterior', label: 'Box C — vano', hint: 'Rivestimento interno del vano album' },
  { key: 'boxG', label: 'Box G — vassoio', hint: 'Vassoio sotto il plexiglas' },
  { key: 'boxCLidInterior', label: 'Box C — interno coperchio', hint: 'Materiale indipendente dal vano, in alternativa alla fotografia' },
];

export const coverSpreadOf = (p: Project): Spread | undefined => p.spreads.find(s => s.cover);

export function orientationOf(w: number, h: number): Orientation {
  if (Math.abs(w - h) <= 0.5) return 'quadrato';
  return w > h ? 'orizzontale' : 'verticale';
}

export function withFrontBand(a: AlbumSpec, value: number): AlbumSpec {
  const band = Number.isFinite(value) ? Math.min(10, Math.max(0, value)) : 0;
  const panelWidth = a.boardWidthCm - (a.frontBandCm ?? 0);
  const width = +(panelWidth + band).toFixed(2);
  return {...a, frontBandCm: band, boardWidthCm: width, orientation: orientationOf(width, a.boardHeightCm)};
}

// Regione visibile (cm) del fronte, retro e dorso nel file copertina.
// I risvolti impostati nell'editor valgono su tutti e quattro i lati,
// incluso quello del dorso. Non dedurre eccezioni dal formato nominale.
export function coverRegions(c: CoverSettings, pageWidthCm?: number) {
  const g = coverGeometry(c);
  const y0 = g.inset, y1 = g.height - g.inset;
  if (c.mode === 'front') {
    const front = { x0: g.x[0], x1: g.x[1], y0, y1 };
    return { width: g.width, height: g.height, front, back: null, spine: null, spineSideNoWrap: false };
  }
  return { width: g.width, height: g.height, front: { x0: g.x[4], x1: g.x[5], y0, y1 }, back: { x0: g.x[0], x1: g.x[1], y0, y1 }, spine: { x0: g.x[2], x1: g.x[3], y0, y1 }, spineSideNoWrap: false };
}

export function deriveAlbum(p: Project, prev?: Partial<AlbumSpec>): AlbumSpec {
  const cover = coverSpreadOf(p)?.cover;
  const pages = p.spreads.filter(s => !s.cover).length;
  let boardW = p.settings.widthCm / 2, boardH = p.settings.heightCm, spine = pages / 10, mode: CoverSettings['mode'] = 'front', spineSideNoWrap = false;
  if (cover) {
    const r = coverRegions(cover, p.settings.widthCm / 2);
    boardW = r.front.x1 - r.front.x0; boardH = r.front.y1 - r.front.y0; spine = cover.spine; mode = cover.mode; spineSideNoWrap = r.spineSideNoWrap;
  }
  // A zero from an album without a cover/full cover is not a manual choice
  // for a newly created photo front. Preserve explicit choices on existing fronts.
  const previousFront = prev?.hasCoverSpread && prev.coverMode === 'front';
  const frontBandCm = cover?.mode === 'front' ? Math.min(10, Math.max(0, (previousFront ? prev?.frontBandCm : undefined) ?? 2.5)) : 0;
  boardW += frontBandCm;
  return {
    orientation: orientationOf(boardW, boardH), coverMode: mode,
    coverModel: prev?.coverModel ?? 'photo_front',
    boardWidthCm: +boardW.toFixed(2), frontBandCm, boardHeightCm: +boardH.toFixed(2), spineCm: +Math.max(spine, 0.2).toFixed(2),
    boardThicknessCm: prev?.boardThicknessCm ?? 0.3, pages, hasCoverSpread: !!cover, spineSideNoWrap,
  };
}

export const defaultBox = (): BoxSpec => ({ type: 'none', cInterior: 'photo', cInteriorPhotoId: null, cInteriorCrop: { zoom: 1, offsetX: 0, offsetY: 0 }, wallCm: 0.5, clearanceCm: 0.5, plexiCm: 0.4 });

export function defaultConfig(p: Project): ConfigBody {
  return { name: `${p.name} — configurazione`, projectId: p.id, projectName: p.name, album: deriveAlbum(p), materials: {}, box: defaultBox(), previews: {}, notes: '' };
}

export const boxCAvailable = (a: AlbumSpec) => a.orientation !== 'verticale';

// Dimensioni derivate (cm) usate dalla scena 3D
export function albumDims(a: AlbumSpec) {
  const t = a.boardThicknessCm, block = a.spineCm;
  return { w: a.boardWidthCm, h: a.boardHeightCm, t, block, thickness: block + 2 * t, spineWidth: block + 2 * t };
}
export function boxDims(a: AlbumSpec, b: BoxSpec) {
  const d = albumDims(a), wall = b.wallCm, gap = b.clearanceCm;
  const innerW = d.w + 2 * gap, innerD = d.h + 2 * gap, innerH = d.thickness + gap;
  return { innerW, innerD, innerH, outerW: innerW + 2 * wall, outerD: innerD + 2 * wall, baseH: innerH + wall, lidH: wall + 1.5, wall, plexi: b.plexiCm };
}

export function missingData(cfg: ConfigBody): string[] {
  const out: string[] = [];
  if (!cfg.album.hasCoverSpread) out.push('Il progetto non ha una copertina: misure dei piatti derivate dal formato pagina (larghezza doppia pagina ÷ 2 × altezza).');
  if (cfg.box.type !== 'none') out.push('Il catalogo PDF non riporta le misure dei box: spessore pareti, gioco interno e spessore plexiglas sono valori indicativi modificabili, da confermare con il laboratorio.');
  out.push('Spessore del piatto e scala delle texture sono indicativi: il PDF non indica misure fisiche dei campioni. La resa 3D non è una prova colore.');
  return out;
}
