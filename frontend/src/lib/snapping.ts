import { CellRect } from '../types';

export function snapMove(box: CellRect, lines: {x:number[];y:number[]}) {
  const axis=(values:number[],targets:number[])=> {
    let delta=0,hit:number|null=null,distance=8;
    for(const value of values)for(const line of targets)if(Math.abs(line-value)<distance){delta=line-value;hit=line;distance=Math.abs(delta);}
    return {delta,hit};
  };
  const x=axis([box.x,box.x+box.w/2,box.x+box.w],lines.x);
  const y=axis([box.y,box.y+box.h/2,box.y+box.h],lines.y);
  return {dx:x.delta,dy:y.delta,x:x.hit===null?[]:[x.hit],y:y.hit===null?[]:[y.hit]};
}

export function snapGroupResize<T extends {x:number;y:number;width:number;height:number}>(box:T,lines:{x:number[];y:number[]},anchor:string) {
  const left=anchor.includes('left'),top=anchor.includes('top');
  const px=left?box.x+box.width:box.x,py=top?box.y+box.height:box.y;
  const x=left?box.x:box.x+box.width,y=top?box.y:box.y+box.height;
  const nx=nearby(x,lines.x),ny=nearby(y,lines.y);
  const useX=nx!==null && (ny===null || Math.abs(nx-x)<=Math.abs(ny-y));
  const factor=useX?Math.abs(nx!-px)/box.width:ny!==null?Math.abs(ny-py)/box.height:1;
  const width=box.width*factor,height=box.height*factor;
  return {...box,x:left?px-width:px,y:top?py-height:py,width,height};
}

// Work in screen pixels: a constant tolerance feels the same at every zoom.
export function nearby(value: number, lines: number[], tolerance = 8): number | null {
  let result: number | null = null;
  let distance = tolerance;
  for (const line of lines) {
    const d = Math.abs(value - line);
    if (d <= distance) { distance = d; result = line; }
  }
  return result;
}

export function cellSnapLines(cells: CellRect[], original?: CellRect, gapSource = cells) {
  const x: number[] = [];
  const y: number[] = [];
  for (const c of cells) {
    x.push(c.x, c.x + c.w);
    y.push(c.y, c.y + c.h);
  }
  // Reuse actual positive gaps between facing, overlapping neighbour edges.
  const gapsX = new Set<number>();
  const gapsY = new Set<number>();
  for (const a of gapSource) for (const b of gapSource) {
    const gx = b.x - a.x - a.w;
    const gy = b.y - a.y - a.h;
    if (gx > .5 && gx < 80 && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y)) gapsX.add(gx);
    if (gy > .5 && gy < 80 && Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x)) gapsY.add(gy);
  }
  // Physical spacing is shared between horizontal and vertical directions.
  const gaps = [...new Set([...gapsX, ...gapsY])].sort((a,b) => a-b).slice(0, 8);
  for (const c of cells) for (const gap of gaps) {
    x.push(c.x - gap, c.x + c.w + gap);
    y.push(c.y - gap, c.y + c.h + gap);
  }
  if (original) {
    x.push(original.x, original.x + original.w);
    y.push(original.y, original.y + original.h);
  }
  return { x, y };
}
