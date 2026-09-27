import { CellRect, LayoutTemplate, ProjectSettings } from '../types';

// Splits operate in centimetres: the same gap is used on both axes.
type Tree = null | { axis: 'x' | 'y'; children: Tree[]; weights?: number[]; inset?: number; fold?: boolean };
const split = (axis: 'x' | 'y', children: Tree[], weights?: number[]): Tree => ({ axis, children, weights });
const row = (n: number): Tree => split('x', Array(n).fill(null));
const stack = (n: number): Tree => split('y', Array(n).fill(null));
const inset = (tree: Tree, amount = 1): Tree => ({ axis: 'x', children: [tree], inset: amount });
const pair = (a: Tree, b: Tree): Tree => ({ axis: 'x', children: [a, b], fold: true });
const rows = (n: number, count: number): Tree => {
  count = Math.max(1, Math.min(n, count));
  const base = Math.floor(n / count), extra = n % count;
  return split('y', Array.from({ length: count }, (_, i) => row(base + (i < extra ? 1 : 0))));
};

function materialize(tree: Tree, box: CellRect, gap: number, gutter: number): CellRect[] {
  if (!tree) return [box];
  const { axis, children, weights = children.map(() => 1) } = tree;
  if (tree.inset) {
    const d = Math.min(tree.inset, box.w * .18, box.h * .18);
    box = { x: box.x + d, y: box.y + d, w: box.w - 2 * d, h: box.h - 2 * d };
  }
  const spacing = tree.fold ? Math.max(gap, gutter) : gap;
  const extent = axis === 'x' ? box.w : box.h;
  const usable = extent - spacing * (children.length - 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let cursor = axis === 'x' ? box.x : box.y;
  return children.flatMap((child, i) => {
    const size = usable * weights[i] / total;
    const r = axis === 'x' ? { ...box, x: cursor, w: size } : { ...box, y: cursor, h: size };
    cursor += size + spacing;
    return materialize(child, r, gap, gutter);
  });
}

/** New guide-aware templates; legacy IDs and stored project rectangles remain untouched. */
export function guideLayouts(s: ProjectSettings): LayoutTemplate[] {
  const W = s.widthCm, H = s.heightCm;
  const margin = Math.min(s.bleedCm + s.safeCm, W * .15, H * .15);
  const gap = Math.min(W, H) * .012;
  const result: LayoutTemplate[] = [];
  const add = (id: string, name: string, tree: Tree, full = false, mirror = false) => {
    const m = full ? 0 : margin;
    const physical = materialize(tree, { x: m, y: m, w: W - 2 * m, h: H - 2 * m }, gap, Math.min(s.gutterCm, W * .15));
    const cells = physical.map(c => ({ x: c.x / W, y: c.y / H, w: c.w / W, h: c.h / H }));
    result.push({ id: `g-${id}`, name: `${cells.length} · ${name}`, photoCount: cells.length, cells });
    if (mirror) result.push({ id: `g-${id}-mirror`, name: `${cells.length} · ${name} ↔`, photoCount: cells.length,
      cells: cells.map(c => ({ ...c, x: 1 - c.x - c.w })) });
  };

  for (let n = 1; n <= 24; n++) {
    // Format-aware density, with alternatives for every count, including odd counts.
    const idealRows = Math.max(1, Math.min(n, Math.round(Math.sqrt(n / (W / H) * 1.4))));
    const variants = [...new Set([idealRows, Math.max(1, idealRows - 1), Math.min(n, idealRows + 1)])];
    variants.forEach(r => add(`grid-${n}-${r}`, `Griglia ${r} ${r === 1 ? 'riga' : 'righe'}`, rows(n, r)));
    add(`edge-grid-${n}`, 'Griglia a bordo pagina', rows(n, idealRows), true);
    if (n === 1) { add('full', 'Tutta doppia pagina', null, true); add('single-inset', 'Centrata', inset(null, H * .12)); }
    if (n >= 2) {
      add(`pages-${n}`, 'Pagine separate', pair(rows(Math.ceil(n / 2), Math.max(1, Math.round(idealRows))),
        rows(Math.floor(n / 2), Math.max(1, Math.min(Math.floor(n / 2), idealRows)))));
      add(`hero-${n}`, 'Dominante + sequenza', split('x', [null, rows(n - 1, Math.min(n - 1, idealRows + 1))], [1.5, 1]), false, true);
      add(`edge-hero-${n}`, 'Foto a bordo + sequenza con margini', split('x', [null, inset(rows(n-1,Math.min(n-1,idealRows+1)), margin)], [1.5,1]), true, true);
    }
  }
  add('two-full-inset', 'Grande + foto con margini', split('x', [null, inset(null)], [1.5, 1]), true, true);
  add('two-air', 'Grande + verticale isolata', split('x', [null, inset(null, H * .13)], [1.9, 1]), true, true);
  add('two-page-inset', 'Pagina piena + pagina con margini', split('x', [null, inset(null)]), true, true);
  add('three-columns', 'Tre colonne a filo', row(3), true);
  add('three-wide', 'Larga + due verticali', split('x', [null, null, null], [2.5, 1.5, 1]), false, true);
  add('three-strip', 'Due piccole + dominante', split('x', [stack(2), null], [1, 3.4]), true, true);
  add('three-stack', 'Dominante + due con margini', split('x', [null, inset(stack(2))], [1.9, 1]), true, true);
  add('three-air', 'Dominante + due isolate', split('x', [null, inset(stack(2), H * .13)], [1.9, 1]), true, true);
  add('three-portrait-pair', 'Due verticali + pagina piena', split('x', [inset(row(2)), null]), true, true);
  add('four-center', 'Verticali ai lati + due centrali', split('x', [null, stack(2), null], [2, 1, 2]));
  add('four-center-wide', 'Laterali + due centrali larghe', split('x', [null, stack(2), null], [1, 1.3, 1]));
  const trio = split('y', [null, row(2)]);
  add('four-hero-trio', 'Dominante + gruppo di tre', split('x', [null, trio], [1.8, 1]), true, true);
  add('four-inset-trio', 'Dominante + tre con margini', split('x', [null, inset(trio)]), true, true);
  add('four-stack', 'Dominante + tre sovrapposte', split('x', [null, inset(stack(3))], [1.5, 1]), true, true);
  add('four-alternating', 'Altezze alternate', pair(split('y', [null, null], [1.7, 1]), split('y', [null, null], [1, 1.7])), false, true);
  add('five-center', 'Dominante centrale + quattro', split('x', [stack(2), null, stack(2)], [1, 2, 1]));
  add('five-two-three', 'Due grandi + tre centrate', split('y', [pair(null, null), inset(row(3), H * .045)], [1.8, 1]));
  add('five-mosaic', 'Verticale + gruppo di tre + grande', split('x', [null, trio, null], [1, 1.5, 2.3]), false, true);
  add('six-alternating', 'Due larghe in diagonale', split('y', [split('x', [null, row(2)], [1.1, 1]), split('x', [row(2), null], [1, 1.1])]), false, true);
  add('seven-mosaic', 'Tre + quattro', pair(split('x', [null, stack(2)]), split('x', [null, stack(3)], [2, 1])), false, true);
  add('nine-mosaic', 'Mosaico sei + tre', split('x', [split('x', [split('y', [null, null, null], [1.3, .8, 1.8]), split('y', [null, null, null], [1.8, 1.3, .9])]), trio]), true, true);
  add('ten-diagonal', 'Due grandi + otto piccole', split('y', [split('x', [rows(4, 2), null]), split('x', [null, rows(4, 2)])]), false, true);
  add('eleven-hero', 'Verticale + dieci', split('x', [null, rows(10, 2)], [1, 2.4]), false, true);
  add('twelve-vertical', 'Tre colonne × quattro righe', rows(12, 4));
  add('twelve-square', 'Quattro colonne × tre righe', rows(12, 3));
  add('nineteen', 'Diciannove · ultima cella divisa', split('y', [row(6), row(6), split('x', [null, null, null, null, null, row(2)])]));
  return result;
}
