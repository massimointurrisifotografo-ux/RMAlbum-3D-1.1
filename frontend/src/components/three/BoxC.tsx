import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Catalog } from '../../lib/api';
import { ConfigBody, albumDims, boxDims } from '../../lib/config3d';
import { AlbumModel } from './AlbumModel';
import { Surface, useImageTexture, useSurface } from './materials';

interface Props { cfg: ConfigBody; catalog: Catalog | null; coverSrc: string | null; interiorSrc: string | null; open: boolean }

// Box C: cofanetto a conchiglia. Coperchio incernierato sul lato posteriore (-Z), album nel vano.
export function BoxC({ cfg, catalog, coverSrc, interiorSrc, open }: Props) {
  const a = albumDims(cfg.album), b = boxDims(cfg.album, cfg.box);
  const ext = useSurface(cfg.materials.boxCExterior, catalog, b.outerW, b.outerD);
  const inner = useSurface(cfg.materials.boxCInterior, catalog, b.innerW, b.innerD);
  const lidInner = useSurface(cfg.materials.boxCLidInterior === undefined ? cfg.materials.boxCInterior : cfg.materials.boxCLidInterior, catalog, b.innerW, b.innerD);
  const photo = useImageTexture(cfg.box.cInterior === 'photo' ? interiorSrc : null);
  const lid = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!lid.current) return;
    const target = open ? -THREE.MathUtils.degToRad(100) : 0;
    lid.current.rotation.x = THREE.MathUtils.damp(lid.current.rotation.x, target, 4, dt);
  });
  const frame = 1.6, w = b.wall;
  const panelW = b.outerW - 2 * w - 2 * frame, panelD = b.lidH + b.outerD - 2 * w - 2 * frame;
  return (
    <group>
      {/* base: fondo + pareti */}
      <mesh position={[0, w / 2, 0]} receiveShadow castShadow><boxGeometry args={[b.outerW, w, b.outerD]} /><Surface look={ext} /></mesh>
      <mesh position={[0, w + b.innerH / 2, -b.outerD / 2 + w / 2]} castShadow><boxGeometry args={[b.outerW, b.innerH, w]} /><Surface look={ext} /></mesh>
      <mesh position={[0, w + b.innerH / 2, b.outerD / 2 - w / 2]} castShadow><boxGeometry args={[b.outerW, b.innerH, w]} /><Surface look={ext} /></mesh>
      <mesh position={[-b.outerW / 2 + w / 2, w + b.innerH / 2, 0]} castShadow><boxGeometry args={[w, b.innerH, b.innerD]} /><Surface look={ext} /></mesh>
      <mesh position={[b.outerW / 2 - w / 2, w + b.innerH / 2, 0]} castShadow><boxGeometry args={[w, b.innerH, b.innerD]} /><Surface look={ext} /></mesh>
      {/* rivestimento interno del vano */}
      <mesh position={[0, w + b.innerH / 2 - 0.01, 0]}><boxGeometry args={[b.innerW + 0.02, b.innerH - 0.02, b.innerD + 0.02]} /><meshStandardMaterial color={inner.color} map={inner.map ?? undefined} roughness={inner.roughness} side={THREE.BackSide} /></mesh>
      <AlbumModel cfg={cfg} catalog={catalog} coverSrc={coverSrc} position={[a.t / 2, w + 0.05, 0]} />
      {/* coperchio */}
      <group ref={lid} position={[0, b.baseH, -b.outerD / 2]}>
        <mesh position={[0, b.lidH - w / 2, b.outerD / 2]} castShadow><boxGeometry args={[b.outerW, w, b.outerD]} /><Surface look={ext} /></mesh>
        <mesh position={[0, (b.lidH - w) / 2, w / 2]} castShadow><boxGeometry args={[b.outerW, b.lidH - w, w]} /><Surface look={ext} /></mesh>
        <mesh position={[0, (b.lidH - w) / 2, b.outerD - w / 2]} castShadow><boxGeometry args={[b.outerW, b.lidH - w, w]} /><Surface look={ext} /></mesh>
        <mesh position={[-b.outerW / 2 + w / 2, (b.lidH - w) / 2, b.outerD / 2]} castShadow><boxGeometry args={[w, b.lidH - w, b.outerD]} /><Surface look={ext} /></mesh>
        <mesh position={[b.outerW / 2 - w / 2, (b.lidH - w) / 2, b.outerD / 2]} castShadow><boxGeometry args={[w, b.lidH - w, b.outerD]} /><Surface look={ext} /></mesh>
        {/* pannello interno coperchio: foto o tessuto */}
        <mesh position={[0, b.lidH - w - 0.06, b.outerD / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[panelW, Math.min(panelD, b.outerD - 2 * w - 2 * frame)]} />
          {photo ? <meshStandardMaterial map={photo} roughness={0.5} /> : <Surface look={lidInner} />}
        </mesh>
      </group>
    </group>
  );
}
