import { CellRect } from '../types';
export const clamp = (v:number,a:number,b:number) => Math.max(a,Math.min(b,v));
export function inside(r:CellRect):CellRect {
  const w=clamp(r.w,.000001,1),h=clamp(r.h,.000001,1);
  return {x:clamp(r.x,0,1-w),y:clamp(r.y,0,1-h),w,h};
}
export function bounds(cells:CellRect[]):CellRect {
  const x=Math.min(...cells.map(c=>c.x)),y=Math.min(...cells.map(c=>c.y));
  return {x,y,w:Math.max(...cells.map(c=>c.x+c.w))-x,h:Math.max(...cells.map(c=>c.y+c.h))-y};
}
export function moveTogether(cells:CellRect[],dx:number,dy:number) {
  const b=bounds(cells);
  dx=clamp(dx,-b.x,1-b.x-b.w);dy=clamp(dy,-b.y,1-b.y-b.h);
  return cells.map(c=>({...c,x:c.x+dx,y:c.y+dy}));
}
/** Absolute canvas boxes; group corner resizing retains the opposite corner and ratio. */
export function constrainResize<T extends {x:number;y:number;width:number;height:number}>(old: T, next: T, W:number,H:number, anchor:string, proportional=false): T {
  if (next.width <= 0 || next.height <= 0) return old;
  if (proportional) {
    const left=anchor.includes('left'),top=anchor.includes('top');
    const px=left?old.x+old.width:old.x,py=top?old.y+old.height:old.y;
    const limit=Math.min((left?px:W-px)/old.width,(top?py:H-py)/old.height);
    const scale=Math.min(next.width/old.width,next.height/old.height,limit);
    if(scale<=0 || old.width*scale<18 || old.height*scale<18)return old;
    const width=old.width*scale,height=old.height*scale;
    return {...next,x:left?px-width:px,y:top?py-height:py,width,height};
  }
  const x=clamp(next.x,0,W),y=clamp(next.y,0,H);
  const right=clamp(next.x+next.width,0,W),bottom=clamp(next.y+next.height,0,H);
  return right-x<18 || bottom-y<18 ? old : {...next,x,y,width:right-x,height:bottom-y};
}
