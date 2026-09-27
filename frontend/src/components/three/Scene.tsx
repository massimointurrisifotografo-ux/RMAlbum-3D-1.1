import React, { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Catalog } from '../../lib/api';
import { ConfigBody, boxDims, albumDims } from '../../lib/config3d';
import { AlbumModel } from './AlbumModel';
import { BoxC } from './BoxC';
import { BoxG } from './BoxG';

export interface SceneProps { cfg: ConfigBody; catalog: Catalog | null; coverSrc: string | null; interiorSrc: string | null; boxOpen: boolean; showPlexi: boolean }

export function Scene({ cfg, catalog, coverSrc, interiorSrc, boxOpen, showPlexi }: SceneProps) {
  const size = useMemo(() => {
    const a = albumDims(cfg.album), b = boxDims(cfg.album, cfg.box);
    return cfg.box.type === 'none' ? Math.max(a.w, a.h) : Math.max(b.outerW, b.outerD);
  }, [cfg.album, cfg.box]);
  const dist = size * (cfg.box.type === 'C' ? 2.8 : 2.3);
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [dist * 0.55, dist * 0.7, dist * 0.85], fov: 32, near: 0.5, far: 2000 }} style={{ background: 'radial-gradient(circle at 50% 35%, #fbfaf7 0%, #e9e4dc 70%, #d8d1c6 100%)' }} data-testid="viewer-3d">
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#ffffff', '#c9bfae', 0.5]} />
      <directionalLight position={[size, size * 1.6, size * 0.8]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <directionalLight position={[-size, size * 0.8, -size * 0.6]} intensity={0.45} />
      <Suspense fallback={null}>
        <group position={[0, 0, 0]}>
          {cfg.box.type === 'none' && <AlbumModel cfg={cfg} catalog={catalog} coverSrc={coverSrc} />}
          {cfg.box.type === 'C' && <BoxC cfg={cfg} catalog={catalog} coverSrc={coverSrc} interiorSrc={interiorSrc} open={boxOpen} />}
          {cfg.box.type === 'G' && <BoxG cfg={cfg} catalog={catalog} coverSrc={coverSrc} showPlexi={showPlexi} />}
        </group>
        <ContactShadows position={[0, -0.01, 0]} opacity={0.5} scale={size * 3} blur={2.2} far={size} />
      </Suspense>
      <OrbitControls makeDefault target={[0, size * 0.08, 0]} minDistance={size * 0.6} maxDistance={size * 5} maxPolarAngle={Math.PI / 2 - 0.02} enablePan={false} />
    </Canvas>
  );
}
