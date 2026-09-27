export const SCHEMA_VERSION = 1;

export interface ProjectSettings {
  widthCm: number; // larghezza doppia pagina (comprende taglio)
  heightCm: number;
  dpi: number;
  bleedCm: number; // margine di taglio
  safeCm: number; // margine di sicurezza
  gutterCm: number; // margine centrale totale
}

export interface Cell {
  id: string;
  x: number; // 0..1 proporzionale alla doppia pagina
  y: number;
  w: number;
  h: number;
  photoId: string | null;
  rotation?: number; // degrees, -45..45; rotates the photo, not its cell
  zoom: number; // >= 1
  offsetX: number; // -1..1 punto focale
  offsetY: number;
  borderMm: number;
  borderColor: string;
  layoutRect?: CellRect;
}

export interface Spread {
  cover?: CoverSettings;
  id: string;
  leftColor: string;
  rightColor: string;
  cells: Cell[];
  layoutId: string | null;
  layoutEdited?: boolean;
}

export interface Project {
  productConfig?: import('./lib/config3d').ConfigBody;
  photoSort?: 'name' | 'time';
  id: string;
  schemaVersion: number;
  name: string;
  settings: ProjectSettings;
  spreads: Spread[];
  snapToGuides?: boolean;
  createdAt: number;
  updatedAt: number;
  nameConfirmed?: boolean;
}

export interface PhotoRecord {
  capturedAt?: number;
  fileModifiedAt?: number;
  id: string;
  projectId: string;
  name: string;
  width: number;
  height: number;
  previewBlob: Blob;
  thumbBlob: Blob;
  handle?: any; // FileSystemFileHandle (Chrome/Edge)
  needsRelink: boolean;
}

// Foto in memoria (runtime)
export interface Photo {
  capturedAt?: number;
  fileModifiedAt?: number;
  id: string;
  name: string;
  width: number;
  height: number;
  previewUrl: string;
  thumbUrl: string;
  handle?: any;
  needsRelink: boolean;
}

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  photoCount: number;
  cells: CellRect[];
  custom?: boolean;
}

export interface Preset {
  id: string;
  name: string;
  settings: ProjectSettings;
}

export interface CoverSettings {
  unit?: 'cm' | 'mm';
  sizing?: 'finished' | 'file';
  artisanId?: string;
  mode: 'front' | 'full';
  frontWidth: number;
  height: number;
  spine: number;
  hinge: number;
  wrap: number;
  bleed: number;
  safe: number;
  dpi: number;
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  widthCm: 61,
  heightCm: 30.5,
  dpi: 300,
  bleedCm: 0.5,
  safeCm: 1.5,
  gutterCm: 2,
};
