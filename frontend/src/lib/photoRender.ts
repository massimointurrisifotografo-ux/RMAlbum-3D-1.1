import { computeCover } from './units';
export const photoAngle = (value = 0) => Number.isFinite(value) ? Math.max(-45, Math.min(45, value)) : 0;
export function rotatedViewport(w:number,h:number,angle=0) {
  const r=photoAngle(angle)*Math.PI/180, c=Math.abs(Math.cos(r)), s=Math.abs(Math.sin(r));
  return {w:w*c+h*s,h:w*s+h*c};
}
// Fit the inverse-rotated viewport inside the original. No distorted pixels or empty corners.
export function photoTransform(iw:number,ih:number,w:number,h:number,zoom:number,ox:number,oy:number,angle=0) {
  const rotation=photoAngle(angle), r=rotation*Math.PI/180;
  const box=rotatedViewport(w,h,rotation), crop=computeCover(iw,ih,box.w/box.h,zoom,ox,oy);
  const scale=box.w/crop.sw;
  const dx=(iw/2-crop.sx-crop.sw/2)*scale, dy=(ih/2-crop.sy-crop.sh/2)*scale;
  return {x:w/2+dx*Math.cos(r)-dy*Math.sin(r),y:h/2+dx*Math.sin(r)+dy*Math.cos(r),w:iw*scale,h:ih*scale,rotation,crop,box};
}
export function drawPhoto(ctx:CanvasRenderingContext2D,img:CanvasImageSource,iw:number,ih:number,x:number,y:number,w:number,h:number,zoom:number,ox:number,oy:number,angle=0) {
  const t=photoTransform(iw,ih,w,h,zoom,ox,oy,angle);
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  ctx.translate(x+t.x,y+t.y); ctx.rotate(t.rotation*Math.PI/180);
  ctx.drawImage(img,-t.w/2,-t.h/2,t.w,t.h); ctx.restore();
}
