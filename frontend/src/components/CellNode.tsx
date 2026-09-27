import React, { useRef, useState } from 'react';
import { Group, Rect, Shape, Text } from 'react-konva';
import useImage from 'use-image';
import { drawPhoto } from '../lib/photoRender';
import { Cell, Photo } from '../types';
import { mmToScreenPx, computeCover } from '../lib/units';

interface Props {
  cell: Cell;
  spreadW: number;
  spreadH: number;
  pxPerCm: number;
  photo?: Photo;
  selected: boolean;
  onSelect: (id: string, additive?: boolean) => void;
  originalPosition?: { x: number; y: number };
  multiSelected?: boolean;
  onDragBegin: (id: string, swap: boolean) => void;
  onDragGroup: (id: string, node: any, end: boolean) => boolean;
  onSelectOnly: (id: string) => void;
  onChange: (id: string, patch: Partial<Cell>) => void;
  snapEnabled?: boolean;
  xLines?: number[];
  yLines?: number[];
  centerXLine?: number;
  centerYLine?: number;
  onSnapHi?: (hi: { x: number[]; y: number[] }) => void;
  onSnapEnd?: () => void;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function CellNode({ cell, spreadW, spreadH, pxPerCm, photo, selected, onSelect, onChange, snapEnabled, xLines = [], yLines = [], centerXLine, centerYLine, onSnapHi, onSnapEnd, originalPosition, multiSelected, onDragBegin, onDragGroup, onSelectOnly }: Props) {
  const groupRef = useRef<any>(null);
  const [transforming, setTransforming] = useState(false);
  const [img] = useImage(photo?.previewUrl || '', 'anonymous');

  const cw = cell.w * spreadW;
  const ch = cell.h * spreadH;
  const b = mmToScreenPx(cell.borderMm, pxPerCm);
  const innerX = b;
  const innerY = b;
  const innerW = Math.max(1, cw - 2 * b);
  const innerH = Math.max(1, ch - 2 * b);

  let crop: any = null;
  if (img) {
    const cellAR = innerW / innerH;
    const c = computeCover(img.width, img.height, cellAR, cell.zoom, cell.offsetX, cell.offsetY);
    crop = { x: c.sx, y: c.sy, width: c.sw, height: c.sh };
  }

  const handleDragMove = (e: any) => {
    const node = e.target;
    node.getStage()?.setPointersPositions(e.evt);
    if (onDragGroup(cell.id, node, false)) return;
    if (!snapEnabled) {
      node.position({x:clamp(node.x(),0,spreadW-cw),y:clamp(node.y(),0,spreadH-ch)});
      return;
    }
    let x = node.x();
    let y = node.y();
    const tol = 8;
    const near = (v: number, lines: number[]) => {
      let best: number | null = null;
      let bd = tol;
      for (const L of lines) {
        const d = Math.abs(v - L);
        if (d <= bd) {
          bd = d;
          best = L;
        }
      }
      return best;
    };
    const hix: number[] = [];
    const hiy: number[] = [];
    const nc = centerXLine === undefined ? null : near(x + cw / 2, [centerXLine]);
    const nl = near(x, xLines);
    const nr = near(x + cw, xLines);
    if (nc !== null) {
      x = nc - cw / 2;
      hix.push(nc);
    } else if (nl !== null) {
      x = nl;
      hix.push(nl);
    } else if (nr !== null) {
      x = nr - cw;
      hix.push(nr);
    }
    const nt = near(y, yLines);
    const nb = near(y + ch, yLines);
    const ncy = centerYLine === undefined ? null : near(y + ch / 2, [centerYLine]);
    if (ncy !== null) {
      y = ncy - ch / 2;
      hiy.push(ncy);
    } else if (nt !== null) {
      y = nt;
      hiy.push(nt);
    } else if (nb !== null) {
      y = nb - ch;
      hiy.push(nb);
    }
    // The exact layout position wins over nearby generic guide lines.
    if (originalPosition && Math.abs(node.x() - originalPosition.x) <= tol) { x = originalPosition.x; hix.push(x); }
    if (originalPosition && Math.abs(node.y() - originalPosition.y) <= tol) { y = originalPosition.y; hiy.push(y); }
    node.x(clamp(x,0,spreadW-cw));
    node.y(clamp(y,0,spreadH-ch));
    onSnapHi?.({ x: hix, y: hiy });
  };

  const handleDragEnd = (e: any) => {
    const node = e.target;
    node.getStage()?.setPointersPositions(e.evt);
    if (onDragGroup(cell.id, node, true)) { onSnapEnd?.(); return; }
    let x = node.x() / spreadW;
    let y = node.y() / spreadH;
    x = clamp(x, 0, 1 - cell.w);
    y = clamp(y, 0, 1 - cell.h);
    node.x(x * spreadW);
    node.y(y * spreadH);
    onSnapEnd?.();
    onChange(cell.id, { x, y });
  };

  const handleTransformEnd = () => {
    setTransforming(false);
    onSnapEnd?.();
  };

  const showImage = !!(photo && img && crop && !transforming);

  return (
    <Group
      ref={groupRef}
      name={cell.id}
      x={cell.x * spreadW}
      y={cell.y * spreadH}
      draggable
      onMouseDown={(e) => {
        if (e.evt.altKey) onSelectOnly(cell.id);
        else onSelect(cell.id, e.evt.metaKey || e.evt.ctrlKey || e.evt.shiftKey);
      }}
      onDblClick={() => onSelectOnly(cell.id)}
      onTap={() => onSelect(cell.id)}
      onDragStart={(e) => onDragBegin(cell.id, e.evt.altKey)}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onTransformStart={() => setTransforming(true)}
      onTransformEnd={handleTransformEnd}
    >
      {/* base / bordo interno / area cella (sempre hittabile) */}
      <Rect x={0} y={0} width={cw} height={ch} fill={cell.borderMm > 0 ? cell.borderColor : photo ? '#e9e3da' : '#ece7df'} />

      {showImage && (
        <Group clipX={innerX} clipY={innerY} clipWidth={innerW} clipHeight={innerH}>
          <Shape x={innerX} y={innerY} width={innerW} height={innerH} listening={false} sceneFunc={ctx => { if(img) drawPhoto(ctx as any,img,img.width,img.height,0,0,innerW,innerH,cell.zoom,cell.offsetX,cell.offsetY,cell.rotation); }} />
        </Group>
      )}

      {!photo && (
        <Text
          text={'＋'}
          x={0}
          y={ch / 2 - 14}
          width={cw}
          align="center"
          fontSize={26}
          fill="#b9b0a2"
          listening={false}
        />
      )}

      {/* contorno cella */}
      <Rect
        x={0.5}
        y={0.5}
        width={cw - 1}
        height={ch - 1}
        stroke={selected ? '#007fa8' : 'rgba(150,125,82,0.45)'}
        strokeWidth={selected ? 3 : 1}
        listening={false}
      />
    </Group>
  );
}
