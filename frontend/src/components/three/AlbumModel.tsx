import React from 'react';
import * as THREE from 'three';
import { Catalog } from '../../lib/api';
import { AlbumSpec, ConfigBody, albumDims } from '../../lib/config3d';
import { Surface, useImageTexture, useSurface } from './materials';

interface Props { cfg: ConfigBody; catalog: Catalog | null; coverSrc: string | null; position?: [number, number, number] }

// Album chiuso, appoggiato sul piano XZ. Fronte = materiale proprio o fotografia; dorso e retro = stesso materiale.
export function AlbumModel({ cfg, catalog, coverSrc, position = [0, 0, 0] }: Props) {
  const a: AlbumSpec = cfg.album;
  const d = albumDims(a);
  const band = a.frontBandCm ?? 0;
  const panelW = d.w - band;
  const front = useSurface(cfg.materials.cover, catalog, panelW, d.h);
  const bandLook = useSurface(cfg.materials.spine, catalog, Math.max(band, 0.01), d.h);
  const backSpine = useSurface(cfg.materials.spine, catalog, d.w + d.spineWidth, d.h);
  const photo = useImageTexture(a.coverModel === 'photo_front' ? coverSrc : null);
  const photoOnFront = a.coverModel === 'photo_front' && !!photo;
  const faces = ['+x', '-x', '+y', '-y', '+z', '-z'];
  return (
    <group position={position}>
      <mesh position={[0, d.t / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[d.w, d.t, d.h]} />
        <Surface look={backSpine} />
      </mesh>
      <mesh position={[0.15, d.t + d.block / 2, 0]} castShadow>
        <boxGeometry args={[d.w - 0.3, d.block, d.h - 0.4]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.9} />
      </mesh>
      {band > 0 && <mesh position={[-d.w / 2 + band / 2, d.t + d.block + d.t / 2, 0]} castShadow>
        <boxGeometry args={[band, d.t, d.h]} />
        <Surface look={bandLook} />
      </mesh>}
      <mesh position={[band / 2, d.t + d.block + d.t / 2, 0]} castShadow>
        <boxGeometry args={[panelW, d.t, d.h]} />
        {faces.map((f, i) => f === '+y' && photoOnFront
          ? <meshStandardMaterial key={f} attach={`material-${i}`} map={photo!} roughness={0.45} />
          : <Surface key={f} attach={`material-${i}`} look={front} />)}
      </mesh>
      <mesh position={[-d.w / 2 - d.t / 2, d.thickness / 2, 0]} castShadow>
        <boxGeometry args={[d.t, d.thickness, d.h]} />
        <Surface look={backSpine} />
      </mesh>
    </group>
  );
}

export const albumFootprint = (a: AlbumSpec) => { const d = albumDims(a); return new THREE.Vector3(d.w + d.t, d.thickness, d.h); };
