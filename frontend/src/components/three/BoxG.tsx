import React from 'react';
import * as THREE from 'three';
import { Catalog } from '../../lib/api';
import { ConfigBody, albumDims, boxDims } from '../../lib/config3d';
import { AlbumModel } from './AlbumModel';
import { Surface, useSurface } from './materials';

interface Props { cfg: ConfigBody; catalog: Catalog | null; coverSrc: string | null; showPlexi: boolean }

// Box G: vassoio con album alloggiato, lastra di plexiglas fissata con quattro viti angolari.
export function BoxG({ cfg, catalog, coverSrc, showPlexi }: Props) {
  const a = albumDims(cfg.album), b = boxDims(cfg.album, cfg.box);
  const tray = useSurface(cfg.materials.boxG, catalog, b.outerW, b.outerD);
  const w = b.wall, inset = 1.3, screwR = 0.32;
  const corners: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  return (
    <group>
      <mesh position={[0, w / 2, 0]} receiveShadow castShadow><boxGeometry args={[b.outerW, w, b.outerD]} /><Surface look={tray} /></mesh>
      <mesh position={[0, w + b.innerH / 2, -b.outerD / 2 + w / 2]} castShadow><boxGeometry args={[b.outerW, b.innerH, w]} /><Surface look={tray} /></mesh>
      <mesh position={[0, w + b.innerH / 2, b.outerD / 2 - w / 2]} castShadow><boxGeometry args={[b.outerW, b.innerH, w]} /><Surface look={tray} /></mesh>
      <mesh position={[-b.outerW / 2 + w / 2, w + b.innerH / 2, 0]} castShadow><boxGeometry args={[w, b.innerH, b.innerD]} /><Surface look={tray} /></mesh>
      <mesh position={[b.outerW / 2 - w / 2, w + b.innerH / 2, 0]} castShadow><boxGeometry args={[w, b.innerH, b.innerD]} /><Surface look={tray} /></mesh>
      <mesh position={[0, w + b.innerH / 2 - 0.01, 0]}><boxGeometry args={[b.innerW + 0.02, b.innerH - 0.02, b.innerD + 0.02]} /><meshStandardMaterial color={tray.color} map={tray.map ?? undefined} roughness={tray.roughness} side={THREE.BackSide} /></mesh>
      <AlbumModel cfg={cfg} catalog={catalog} coverSrc={coverSrc} position={[a.t / 2, w + 0.05, 0]} />
      {showPlexi && (
        <group position={[0, b.baseH, 0]}>
          <mesh position={[0, b.plexi / 2, 0]} castShadow>
            <boxGeometry args={[b.outerW, b.plexi, b.outerD]} />
            <meshPhysicalMaterial color="#e6eef3" transparent opacity={0.36} roughness={0.03} metalness={0} clearcoat={1} clearcoatRoughness={0.03} reflectivity={1} depthWrite={false} />
          </mesh>
          <lineSegments position={[0, b.plexi / 2, 0]}>
            <edgesGeometry args={[new THREE.BoxGeometry(b.outerW, b.plexi, b.outerD)]} />
            <lineBasicMaterial color="#ffffff" transparent opacity={0.7} />
          </lineSegments>
          {corners.map(([sx, sz], i) => (
            <group key={i} position={[sx * (b.outerW / 2 - inset), b.plexi, sz * (b.outerD / 2 - inset)]}>
              <mesh position={[0, 0.09, 0]} castShadow><cylinderGeometry args={[screwR, screwR, 0.18, 24]} /><meshStandardMaterial color="#b9bec4" metalness={0.9} roughness={0.28} /></mesh>
              <mesh position={[0, -b.plexi / 2, 0]}><cylinderGeometry args={[screwR * 0.45, screwR * 0.45, b.plexi + 0.02, 12]} /><meshStandardMaterial color="#9aa0a6" metalness={0.9} roughness={0.3} /></mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
}
