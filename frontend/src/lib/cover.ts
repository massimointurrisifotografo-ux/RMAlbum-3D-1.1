import { CoverSettings, Project, ProjectSettings, Spread } from '../types';

export const defaultCover: CoverSettings = { mode:'front', frontWidth:30, height:30, spine:2, hinge:0, wrap:0, bleed:0.3, safe:1, dpi:300 };
export function coverFromAlbum(project:Project):CoverSettings {
  return {...defaultCover,unit:'cm',frontWidth:project.settings.widthCm/2,height:project.settings.heightCm,
    dpi:project.settings.dpi,bleed:0,spine:project.spreads.filter(s=>!s.cover).length/10};
}
export function validCover(c: CoverSettings) {
  return ['front','full'].includes(c.mode) && ['frontWidth','height','spine','hinge','wrap','bleed','safe','dpi'].every(k => typeof c[k]==='number' && Number.isFinite(c[k]) && c[k]>=0) &&
    c.frontWidth>0 && c.height>0 && c.dpi>=72 && c.dpi<=1200 && c.safe<Math.min(c.frontWidth,c.height)/2 && (c.mode==='front' || c.spine>0) &&
    (c.unit===undefined || ['cm','mm'].includes(c.unit)) && (c.sizing===undefined || ['finished','file'].includes(c.sizing)) &&
    (c.sizing!=='file' || 2*(c.wrap+c.bleed+c.safe)<Math.min(c.frontWidth,c.height));
}
// Upgrade only the known Artigiano 2.5 cm legacy preset, not custom wraps.
export function normalizeCover(c: CoverSettings): CoverSettings {
  return c.artisanId && c.mode==='front' && c.sizing==='file' && c.wrap===2.5
    ? {...c,wrap:1.5,safe:1} : c;
}
export function coverGeometry(settings: CoverSettings) {
  const c=normalizeCover(settings);
  const inset=c.wrap+c.bleed;
  const addedInset=c.sizing==='file'?0:inset;
  const width=2*addedInset+c.frontWidth*(c.mode==='full'?2:1)+(c.mode==='full'?c.spine+2*c.hinge:0);
  const height=2*addedInset+c.height;
  const spineStart=addedInset+c.frontWidth+c.hinge;
  const safeX=c.mode==='full' ? [inset+c.safe,spineStart-c.hinge-c.safe,spineStart+c.spine+c.hinge+c.safe,width-inset-c.safe] : [inset+c.safe,width-inset-c.safe];
  return {width,height,inset,spineStart,spineEnd:spineStart+c.spine,safeX,
    x:c.mode==='full' ? [inset,spineStart-c.hinge,spineStart,spineStart+c.spine,spineStart+c.spine+c.hinge,width-inset] : [inset,width-inset]};
}
export function settingsFor(project: Project, spread?: Spread): ProjectSettings {
  if (!spread?.cover) return project.settings;
  const c=spread.cover, g=coverGeometry(c);
  return {widthCm:g.width,heightCm:g.height,dpi:c.dpi,bleedCm:g.inset,safeCm:c.safe,gutterCm:0};
}
