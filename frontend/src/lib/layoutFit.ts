import { LayoutTemplate, Photo, ProjectSettings } from '../types';

/** Minimum log-aspect error, with a stable one-to-one assignment. */
export function fitLayout(layout: LayoutTemplate, photos: Pick<Photo, 'width' | 'height'>[], s: ProjectSettings) {
  const items = photos.map((p,i) => ({ i, ratio: Math.max(.0001, p.width / p.height) })).sort((a,b) => a.ratio-b.ratio || a.i-b.i);
  const slots = layout.cells.map((c,i) => ({ i, ratio: c.w*s.widthCm/(c.h*s.heightCm) })).sort((a,b) => a.ratio-b.ratio || a.i-b.i);
  const n = items.length, m = slots.length;
  if (n > m) return { score: Infinity, slots: [] as number[] };
  const dp = Array.from({length:n+1}, () => Array(m+1).fill(Infinity));
  const take = Array.from({length:n+1}, () => Array(m+1).fill(false));
  dp[0].fill(0);
  for (let i=1;i<=n;i++) for (let j=1;j<=m;j++) {
    const used = dp[i-1][j-1] + Math.abs(Math.log(items[i-1].ratio/slots[j-1].ratio));
    const skipped = dp[i][j-1];
    take[i][j] = used < skipped;
    dp[i][j] = Math.min(used, skipped);
  }
  const assignment = Array(n).fill(-1);
  let i=n,j=m;
  while(i && j) {
    if(take[i][j]) { assignment[items[i-1].i] = slots[j-1].i; i--; }
    j--;
  }
  return { score: n ? dp[n][m]/n : 0, slots: assignment };
}

export function rankLayouts(layouts: LayoutTemplate[], photos: Pick<Photo,'width'|'height'>[], s: ProjectSettings, preferred?: string) {
  return layouts.map((layout,index) => ({layout,index,score:fitLayout(layout,photos,s).score})).sort((a,b) =>
    Math.abs(a.score-b.score) > 1e-8 ? a.score-b.score : (a.layout.id===preferred ? -1 : b.layout.id===preferred ? 1 : a.index-b.index)
  ).map(item => item.layout);
}

export const isFullBleed = (layout: LayoutTemplate) => layout.cells.some(c => c.x < 1e-6 || c.y < 1e-6 || c.x+c.w > 1-1e-6 || c.y+c.h > 1-1e-6);
