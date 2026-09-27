import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { apiUrl, Catalog, Variant } from '../../lib/api';
import { MaterialRef } from '../../lib/config3d';

// Il PDF non indica la misura fisica dei campioni: 10 cm è un'ipotesi dichiarata (scala texture indicativa).
export const SWATCH_CM = 10;
const ROUGHNESS: Record<string, number> = { tela: 0.92, corteccia: 0.8, 'eco-liscio': 0.5, vellutino: 0.97 };
const cache = new Map<string, Promise<THREE.Texture>>();

// Texture della famiglia resa neutra (grigio normalizzato) per essere tinta con il colore della variante.
function neutralTexture(url: string) {
  if (!cache.has(url)) cache.set(url, new Promise((res, rej) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 512;
      const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0, 512, 512);
      // rimuove il gradiente di illuminazione della scansione (passa-alto) per una trama ripetibile
      const low = document.createElement('canvas'); low.width = low.height = 8;
      low.getContext('2d')!.drawImage(img, 0, 0, 8, 8);
      const lc = document.createElement('canvas'); lc.width = lc.height = 512;
      const lctx = lc.getContext('2d')!; lctx.imageSmoothingEnabled = true; lctx.drawImage(low, 0, 0, 512, 512);
      const lp = lctx.getImageData(0, 0, 512, 512).data;
      const d = ctx.getImageData(0, 0, 512, 512), px = d.data; let sum = 0;
      for (let i = 0; i < px.length; i += 4) {
        const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const ll = Math.max(8, 0.299 * lp[i] + 0.587 * lp[i + 1] + 0.114 * lp[i + 2]);
        px[i] = l / ll; sum += l;
      }
      const mean = sum / (px.length / 4);
      for (let i = 0; i < px.length; i += 4) { const v = Math.min(255, px[i] * mean * (232 / mean)); px[i] = px[i + 1] = px[i + 2] = v; }
      ctx.putImageData(d, 0, 0);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.anisotropy = 8;
      res(t);
    };
    img.onerror = rej; img.src = apiUrl(url);
  }));
  return cache.get(url)!;
}

export interface SurfaceLook { color: string; map: THREE.Texture | null; roughness: number; metalness: number; missing: boolean }
export const NEUTRAL: SurfaceLook = { color: '#d9d4cc', map: null, roughness: 0.85, metalness: 0, missing: true };

export function useSurface(ref: MaterialRef | null | undefined, catalog: Catalog | null, wCm: number, hCm: number): SurfaceLook {
  const variant: Variant | undefined = useMemo(() => ref && catalog ? catalog.variants.find(v => v.code === ref.code) : undefined, [ref?.code, catalog]);
  const family = variant && catalog ? catalog.families.find(f => f.id === variant.familyId) : undefined;
  const [base, setBase] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true; setBase(null);
    if (family) neutralTexture(family.textureUrl).then(t => alive && setBase(t)).catch(() => {});
    return () => { alive = false; };
  }, [family?.id]);
  const map = useMemo(() => {
    if (!base) return null;
    const t = base.clone(); t.repeat.set(Math.max(0.5, wCm / SWATCH_CM), Math.max(0.5, hCm / SWATCH_CM)); t.needsUpdate = true; return t;
  }, [base, wCm, hCm]);
  if (!variant || !variant.colorHex) return NEUTRAL;
  return { color: variant.colorHex, map, roughness: ROUGHNESS[variant.familyId] ?? 0.8, metalness: 0, missing: false };
}

export function useImageTexture(src: string | null | undefined) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!src) { setTex(null); return; }
    let alive = true;
    new THREE.TextureLoader().setCrossOrigin('anonymous').load(src.startsWith('data:') || src.startsWith('blob:') ? src : apiUrl(src), t => {
      if (!alive) return; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; setTex(t);
    });
    return () => { alive = false; };
  }, [src]);
  return tex;
}

export const Surface = ({ look, attach }: { look: SurfaceLook; attach?: string }) =>
  <meshStandardMaterial key={look.map ? 'tex' : 'flat'} attach={attach} color={look.color} map={look.map ?? undefined} roughness={look.roughness} metalness={look.metalness} />;
