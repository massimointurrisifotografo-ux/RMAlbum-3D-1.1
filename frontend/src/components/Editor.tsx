import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Transformer, Text } from 'react-konva';
import { useStore, useCurrentSpread } from '../store/store';
import { CellNode } from './CellNode';
import { cellSnapLines, nearby, snapMove, snapGroupResize } from '../lib/snapping';
import { getBuiltinLayouts } from '../lib/layouts';
import { Cell, CellRect } from '../types';
import { bounds, constrainResize, moveTogether } from '../lib/geometry';
import { coverGeometry, settingsFor } from '../lib/cover';

export function Editor() {
  const project = useStore((s) => s.project)!;
  const spread = useCurrentSpread();
  const photos = useStore((s) => s.photos);
  const selectedCellId = useStore((s) => s.selectedCellId);
  const storedSelection = useStore((s) => s.selectedCellIds);
  const selectCells = useStore((s) => s.selectCells);
  const customLayouts = useStore((s) => s.customLayouts);
  const selection = selectedCellId ? (storedSelection.includes(selectedCellId) ? storedSelection : [selectedCellId]).filter(id => spread?.cells.some(c => c.id === id)) : [];
  const selectCell = useStore((s) => s.selectCell);
  const updateCell = useStore((s) => s.updateCell);
  const updateCells = useStore(s => s.updateCells);
  const swapPhotos = useStore(s => s.swapPhotos);
  const assignPhoto = useStore((s) => s.assignPhoto);
  const createCellWithPhoto = useStore((s) => s.createCellWithPhoto);
  const pendingPhotoId = useStore((s) => s.pendingPhotoId);
  const showGuides = useStore((s) => s.showGuides);
  const snapToGuides = useStore((s) => s.project?.snapToGuides ?? true);

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const dragState = useRef<{ cells: Cell[]; source: string; swap: boolean } | null>(null);
  const shiftHeld = useRef(false);
  const altHeld = useRef(false);
  const [swapGhost,setSwapGhost]=useState<{src:string;x:number;y:number}|null>(null);
  useEffect(() => {
    const track = (e: KeyboardEvent | MouseEvent) => { shiftHeld.current=e.shiftKey; altHeld.current=e.altKey; };
    const reset = () => { shiftHeld.current=false; altHeld.current=false; setSwapGhost(null); };
    window.addEventListener('keydown',track,true);
    window.addEventListener('keyup',track,true);
    window.addEventListener('mousedown',track,true);
    window.addEventListener('mousemove',track,true);
    window.addEventListener('blur',reset);
    return () => {
      window.removeEventListener('keydown',track,true);
      window.removeEventListener('keyup',track,true);
      window.removeEventListener('mousedown',track,true);
      window.removeEventListener('mousemove',track,true);
      window.removeEventListener('blur',reset);
    };
  },[]);
  const [size, setSize] = useState({ w: 800, h: 400 });
  const [snapHi, setSnapHi] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const clearSnap = () => setSnapHi({ x: [], y: [] });
  const marqueeStart = useRef<{ x: number; y: number; base: string[] } | null>(null);
  const [marquee, setMarquee] = useState<CellRect | null>(null);
  useEffect(() => { marqueeStart.current = null; setMarquee(null); setSwapGhost(null); dragState.current=null; clearSnap(); }, [spread?.id]);

  const settings=settingsFor(project,spread);
  const { widthCm, heightCm, bleedCm, safeCm, gutterCm } = settings;
  const cover=spread?.cover ? coverGeometry(spread.cover) : null;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const availW = el.clientWidth - 48;
      const availH = el.clientHeight - 48;
      const ppc = Math.max(2, Math.min(availW / widthCm, availH / heightCm));
      setSize({ w: widthCm * ppc, h: heightCm * ppc });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [widthCm, heightCm]);

  const pxPerCm = size.w / widthCm;
  const spreadW = size.w;
  const spreadH = size.h;

  // attach transformer to selected cell
  useEffect(() => {
    const tr = trRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;
    tr.nodes(selection.map(id => layer.findOne('.' + id)).filter(Boolean));
    tr.getLayer()?.batchDraw();
  }, [selectedCellId, storedSelection, spread, spreadW, spreadH]);

  const handleSelect = (id: string, additive = false) => {
    if (pendingPhotoId) {
      assignPhoto(id, pendingPhotoId);
    }
    if (additive) selectCells(selection.includes(id) ? selection.filter(c => c !== id) : [...selection, id]);
    else if (!selection.includes(id)) selectCell(id);
  };

  const beginDrag = (id: string, swap: boolean) => {
    clearSnap();
    const state=useStore.getState();
    const selected=state.selectedCellIds.includes(id) ? state.selectedCellIds : [id];
    dragState.current = {source:id, swap, cells: spread?.cells.filter(c => swap ? c.id===id : selected.includes(c.id)).map(c=>({...c})) ?? []};
  };
  const dragGroup = (id:string,node:any,end:boolean) => {
    const state=dragState.current;
    if(!state || state.source!==id) return false;
    const source=state.cells.find(c=>c.id===id);
    if(!source)return false;
    if(altHeld.current && source.photoId && !state.swap) {
      state.swap=true;
      state.cells.forEach(c=>layerRef.current?.findOne('.'+c.id)?.position({x:c.x*spreadW,y:c.y*spreadH}));
      clearSnap();
    }
    if(state.swap) {
      node.position({x:source.x*spreadW,y:source.y*spreadH});
      const pointer=stageRef.current?.getPointerPosition();
      const rect=stageRef.current?.container().getBoundingClientRect();
      if(pointer && rect && source.photoId && photos[source.photoId])setSwapGhost({src:photos[source.photoId].thumbUrl,x:rect.left+pointer.x+12,y:rect.top+pointer.y+12});
      if(end) {
        const pointer=stageRef.current?.getPointerPosition();
        const target=pointer && [...(spread?.cells ?? [])].reverse().find(c=>c.id!==id && pointer.x>=c.x*spreadW && pointer.x<=(c.x+c.w)*spreadW && pointer.y>=c.y*spreadH && pointer.y<=(c.y+c.h)*spreadH);
        if(target)swapPhotos(id,target.id);
        setSwapGhost(null);
        dragState.current=null;
      }
      return true;
    }
    if(state.cells.length<2) { if(end)dragState.current=null; return false; }
    let moved=moveTogether(state.cells,node.x()/spreadW-source.x,node.y()/spreadH-source.y);
    if(snapToGuides) {
      const ids=state.cells.map(c=>c.id);
      const extra=cellSnapLines(spread?.cells.filter(c=>!ids.includes(c.id)).map(pixels) ?? [], undefined, gapSource);
      const origin=bounds(state.cells.map(c=>pixels(c.layoutRect ?? c)));
      const snap=snapMove(pixels(bounds(moved)),{x:[...xLines,...extra.x,origin.x,origin.x+origin.w],y:[...yLines,...extra.y,origin.y,origin.y+origin.h]});
      const final=moveTogether(moved,snap.dx/spreadW,snap.dy/spreadH);
      const b=pixels(bounds(final));
      setSnapHi({x:snap.x.filter(v=>[b.x,b.x+b.w/2,b.x+b.w].some(n=>Math.abs(n-v)<.1)),y:snap.y.filter(v=>[b.y,b.y+b.h/2,b.y+b.h].some(n=>Math.abs(n-v)<.1))});
      moved=final;
    }
    moved.forEach((c,i)=>layerRef.current?.findOne('.'+state.cells[i].id)?.position({x:c.x*spreadW,y:c.y*spreadH}));
    if(end) {
      updateCells(moved.map((rect,i)=>({id:state.cells[i].id,rect})));
      dragState.current=null;
      clearSnap();
    }
    return true;
  };
  const finishTransform = () => {
    const patches = (trRef.current?.nodes() ?? []).map((node:any) => {
      const cell=spread?.cells.find(c=>c.id===node.name());
      if(!cell)return null;
      const rect={x:node.x()/spreadW,y:node.y()/spreadH,w:cell.w*node.scaleX(),h:cell.h*node.scaleY()};
      node.scale({x:1,y:1});
      return {id:cell.id,rect};
    }).filter(Boolean);
    if(patches.length)updateCells(patches);
    clearSnap();
  };

  const onStageMouseDown = (e: any) => {
    if (e.target === e.target.getStage()) {
      const p = e.target.getStage().getPointerPosition();
      if (!p || (e.evt.button !== undefined && e.evt.button !== 0)) return;
      const base = e.evt.metaKey || e.evt.ctrlKey || e.evt.shiftKey ? selection : [];
      marqueeStart.current = { ...p, base };
      setMarquee({ ...p, w: 0, h: 0 });
      selectCells(base);
    }
  };
  const onMarqueeMove = () => {
    const start = marqueeStart.current;
    const p = stageRef.current?.getPointerPosition();
    if (!start || !p) return;
    const end = { x: Math.max(0, Math.min(spreadW, p.x)), y: Math.max(0, Math.min(spreadH, p.y)) };
    const rect = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), w: Math.abs(end.x-start.x), h: Math.abs(end.y-start.y) };
    setMarquee(rect);
    if (rect.w < 3 && rect.h < 3) return;
    const hits = spread?.cells.filter(c => c.x*spreadW < rect.x+rect.w && (c.x+c.w)*spreadW > rect.x && c.y*spreadH < rect.y+rect.h && (c.y+c.h)*spreadH > rect.y).map(c => c.id) ?? [];
    selectCells([...start.base, ...hits]);
  };
  const endMarquee = () => { marqueeStart.current = null; setMarquee(null); };

  // drop foto dalla libreria
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const photoId = e.dataTransfer.getData('text/photo-id');
    if (!photoId || !spread) return;
    const container = stageRef.current?.container();
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const px = (e.clientX - rect.left) / spreadW;
    const py = (e.clientY - rect.top) / spreadH;
    for (let i = spread.cells.length - 1; i >= 0; i--) {
      const c = spread.cells[i];
      if (px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h) {
        assignPhoto(c.id, photoId);
        selectCell(c.id);
        return;
      }
    }
    // rilascio su pagina vuota → crea una cella proporzionata alla foto
    createCellWithPhoto(photoId, { cx: px, cy: py });
  };

  const bleed = bleedCm * pxPerCm;
  const safe = (bleedCm + safeCm) * pxPerCm;
  const foldX = spreadW / 2;
  const gutter = (gutterCm / 2) * pxPerCm;

  const xLines = cover ? [0,spreadW,spreadW/2,...cover.safeX.map(x=>x*pxPerCm),...cover.x.map(x=>x*pxPerCm)] : [0, spreadW, bleed, spreadW - bleed, safe, spreadW - safe, foldX, foldX - gutter, foldX + gutter];
  const yLines = [0, spreadH, bleed, spreadH - bleed, safe, spreadH - safe, spreadH / 2];
  const template = [...getBuiltinLayouts(settings), ...customLayouts].find(t => t.id === spread?.layoutId);
  const pixels = (r: CellRect): CellRect => ({ x: r.x*spreadW, y: r.y*spreadH, w: r.w*spreadW, h: r.h*spreadH });
  const original = (index: number) => spread?.cells[index].layoutRect ?? (template?.cells.length === spread?.cells.length ? template?.cells[index] : undefined);
  const gapSource = spread?.cells.map((c,i) => pixels(original(i) ?? c)) ?? [];
  const snapLinesFor = (id: string) => {
    const index = spread?.cells.findIndex(c => c.id === id) ?? -1;
    const origin = index >= 0 ? original(index) : undefined;
    const extra = cellSnapLines(spread?.cells.filter(c => c.id !== id).map(pixels) ?? [], origin ? pixels(origin) : undefined, gapSource);
    return { x: [...xLines, ...extra.x], y: [...yLines, ...extra.y] };
  };
  const groupExtra=cellSnapLines(spread?.cells.filter(c=>!selection.includes(c.id)).map(pixels) ?? [],undefined,gapSource);
  const resizeLines = selection.length>1 ? {x:[...xLines,...groupExtra.x],y:[...yLines,...groupExtra.y]} : selectedCellId ? snapLinesFor(selectedCellId) : { x: xLines, y: yLines };

  return (
    <div className="stage-wrap" style={{ position: 'relative' }} ref={wrapRef} onMouseDown={(e) => {
      if (e.target === e.currentTarget) selectCell(null);
    }} onDragOver={(e) => e.preventDefault()} onDrop={onDrop} data-testid="editor">
      {swapGhost && <img className="swap-photo-ghost" data-testid="swap-photo-ghost" src={swapGhost.src} alt="" style={{left:swapGhost.x,top:swapGhost.y}} />}
      <div className="stage-shadow">
        <Stage ref={stageRef} width={spreadW} height={spreadH} onMouseDown={onStageMouseDown} onTouchStart={onStageMouseDown}
          onMouseMove={onMarqueeMove} onTouchMove={onMarqueeMove} onMouseUp={endMarquee} onTouchEnd={endMarquee} onMouseLeave={endMarquee}>
          {/* sfondo pagine */}
          <Layer listening={false}>
            <Rect x={0} y={0} width={spreadW / 2} height={spreadH} fill={spread?.leftColor || '#fff'} />
            <Rect x={spreadW / 2} y={0} width={spreadW / 2} height={spreadH} fill={spread?.rightColor || '#fff'} />
          </Layer>

          {/* celle + foto */}
          <Layer ref={layerRef}>
            {spread?.cells.map((cell, index) => (
              <CellNode
                key={cell.id}
                cell={cell}
                spreadW={spreadW}
                spreadH={spreadH}
                pxPerCm={pxPerCm}
                photo={cell.photoId ? photos[cell.photoId] : undefined}
                selected={selection.includes(cell.id)}
                multiSelected={selection.length > 1 && selection.includes(cell.id)}
                originalPosition={original(index) ? pixels(original(index)!) : undefined}
                onSelect={handleSelect}
                onSelectOnly={selectCell}
                onDragBegin={beginDrag}
                onDragGroup={dragGroup}
                onChange={updateCell}
                snapEnabled={snapToGuides}
                xLines={snapLinesFor(cell.id).x}
                yLines={snapLinesFor(cell.id).y}
                centerXLine={foldX}
                centerYLine={spreadH / 2}
                onSnapHi={setSnapHi}
                onSnapEnd={clearSnap}
              />
            ))}
            <Transformer
              ref={trRef}
              rotateEnabled={false}
              keepRatio={false}
              shiftBehavior="default"
              ignoreStroke
              onTransformEnd={finishTransform}
              flipEnabled={false}
              enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']}
              anchorFill="#B49A6A"
              anchorStroke="#967D52"
              anchorSize={10}
              borderStroke="#B49A6A"
              borderStrokeWidth={2}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 18 || newBox.height < 18) return oldBox;
                const anchor = trRef.current?.getActiveAnchor() ?? '';
                const proportional=shiftHeld.current && !anchor.includes('center') && !anchor.includes('middle');
                const constrained=constrainResize(oldBox,newBox,spreadW,spreadH,anchor,proportional);
                if (!snapToGuides) return constrained;
                if(proportional) {
                  const box=constrainResize(oldBox,snapGroupResize(constrained,resizeLines,anchor),spreadW,spreadH,anchor,true);
                  const x=anchor.includes('left')?box.x:box.x+box.width,y=anchor.includes('top')?box.y:box.y+box.height;
                  setSnapHi({x:resizeLines.x.filter(v=>Math.abs(v-x)<.1),y:resizeLines.y.filter(v=>Math.abs(v-y)<.1)});
                  return box;
                }
                const box = { ...constrained };
                const hix: number[] = [];
                const hiy: number[] = [];
                const right = box.x + box.width;
                const bottom = box.y + box.height;
                const nl = anchor.includes('left') ? nearby(box.x, resizeLines.x) : null;
                if (nl !== null) {
                  box.width = right - nl;
                  box.x = nl;
                  hix.push(nl);
                }
                const nr = anchor.includes('right') ? nearby(box.x + box.width, resizeLines.x) : null;
                if (nr !== null) {
                  box.width = nr - box.x;
                  hix.push(nr);
                }
                const nt = anchor.includes('top') ? nearby(box.y, resizeLines.y) : null;
                if (nt !== null) {
                  box.height = bottom - nt;
                  box.y = nt;
                  hiy.push(nt);
                }
                const nb = anchor.includes('bottom') ? nearby(box.y + box.height, resizeLines.y) : null;
                if (nb !== null) {
                  box.height = nb - box.y;
                  hiy.push(nb);
                }
                if (box.width < 18 || box.height < 18) return constrained;
                setSnapHi({ x: hix, y: hiy });
                return constrainResize(oldBox,box,spreadW,spreadH,anchor);
              }}
            />
          </Layer>

          {marquee && <Layer listening={false}><Rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="rgba(0,127,168,0.13)" stroke="#007fa8" strokeWidth={1} dash={[5,3]} /></Layer>}

          {/* guide */}
          {showGuides && (
            <Layer listening={false}>
              <Rect x={bleed} y={bleed} width={spreadW - 2 * bleed} height={spreadH - 2 * bleed} stroke="#e0554d" strokeWidth={1} dash={[6, 4]} />
              <Rect x={safe} y={safe} width={spreadW - 2 * safe} height={spreadH - 2 * safe} stroke="#4a90d9" strokeWidth={1} dash={[4, 4]} opacity={0.7} />
              {!cover && <Line points={[foldX, 0, foldX, spreadH]} stroke="#967D52" strokeWidth={1} dash={[10, 6]} />}
              <Line points={[0, spreadH / 2, spreadW, spreadH / 2]} stroke="#967D52" strokeWidth={1} dash={[10, 6]} />
              {!cover && <><Line points={[foldX - gutter, 0, foldX - gutter, spreadH]} stroke="#B49A6A" strokeWidth={1} dash={[3, 5]} opacity={0.6} />
              <Line points={[foldX + gutter, 0, foldX + gutter, spreadH]} stroke="#B49A6A" strokeWidth={1} dash={[3, 5]} opacity={0.6} /></>}
              {cover && <>
                {cover.x.map((x,i)=><Line key={i} points={[x*pxPerCm,0,x*pxPerCm,spreadH]} stroke="#967D52" dash={[5,4]} />)}
                {cover.safeX.map((x,i)=><Line key={'safe'+i} points={[x*pxPerCm,safe,x*pxPerCm,spreadH-safe]} stroke="#4a90d9" dash={[4,4]} opacity={0.7} />)}
                <Text x={cover.inset*pxPerCm+5} y={bleed+5} text={spread?.cover?.mode==='full'?'RETRO':'FRONTE'} fill="#967D52" />
                {spread?.cover?.mode==='full' && <><Text x={cover.spineStart*pxPerCm+2} y={bleed+5} text="DORSO" rotation={90} fill="#967D52" /><Text x={(cover.spineEnd+spread.cover.hinge)*pxPerCm+5} y={bleed+5} text="FRONTE" fill="#967D52" /></>}
                <Rect x={(spread!.cover!.bleed)*pxPerCm} y={(spread!.cover!.bleed)*pxPerCm} width={spreadW-2*spread!.cover!.bleed*pxPerCm} height={spreadH-2*spread!.cover!.bleed*pxPerCm} stroke="#e0554d" dash={[2,3]} />
              </>}
            </Layer>
          )}

          {/* evidenziazione guida agganciata */}
          {(snapHi.x.length > 0 || snapHi.y.length > 0) && (
            <Layer listening={false}>
              {snapHi.x.map((x, i) => (
                <Line key={'sx' + i} points={[x, 0, x, spreadH]} stroke="#B49A6A" strokeWidth={2} />
              ))}
              {snapHi.y.map((y, i) => (
                <Line key={'sy' + i} points={[0, y, spreadW, y]} stroke="#B49A6A" strokeWidth={2} />
              ))}
            </Layer>
          )}
        </Stage>
      </div>
      {spread && spread.cells.length === 0 && (
        <div className="empty-page-hint" data-testid="empty-page-hint">
          Apri la barra <b>Layout</b> dal pulsante in alto,<br />oppure trascina o clicca una foto per inserirla.
        </div>
      )}
    </div>
  );
}
