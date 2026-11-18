/**
 * Small helpers for authoring generic lessons: node shorthands and layouts that give every node
 * a fixed slot in both the wide (landscape) and narrow (phone) frame.
 */
import type { DNode, DEdge, Layout, NodeKind } from '../../ui/components/Diagram';
import { PY } from '../python.generated';
import { extractDef, lineOf } from '../../py/snippets';

export const n = (id: string, kind: NodeKind, label: string, extra: Partial<DNode> = {}): DNode => ({ id, kind, label, ...extra });
export const e = (from: string, to: string, label?: string, extra: Partial<DEdge> = {}): DEdge => ({ id: `${from}-${to}`, from, to, label, ...extra });

type Slot = { x: number; y: number; w?: number; h?: number };

/** Explicit positions for both frames. Wide frame is 820 wide; narrow is 360 wide. */
export function layout(wideH: number, narrowH: number, slots: Record<string, [Slot, Slot]>): { wide: Layout; narrow: Layout } {
  const wide: Layout = { width: 820, height: wideH, nodes: {} };
  const narrow: Layout = { width: 360, height: narrowH, nodes: {} };
  for (const [id, [w, nr]] of Object.entries(slots)) {
    wide.nodes[id] = w;
    narrow.nodes[id] = nr;
  }
  return { wide, narrow };
}

/** A left-to-right chain on wide screens that becomes a top-to-bottom chain on phones. */
export function chain(ids: string[], opts: { w?: number; h?: number; wideH?: number; gapY?: number } = {}): { wide: Layout; narrow: Layout } {
  const w = opts.w ?? 150;
  const h = opts.h ?? 74;
  const wideH = opts.wideH ?? 220;
  const gapY = opts.gapY ?? 118;
  const slots: Record<string, [Slot, Slot]> = {};
  ids.forEach((id, i) => {
    const x = 90 + (i * (820 - 180)) / Math.max(1, ids.length - 1);
    slots[id] = [{ x, y: wideH / 2, w, h }, { x: 180, y: 50 + i * gapY, w: 220, h }];
  });
  return layout(wideH, 50 + (ids.length - 1) * gapY + 50, slots);
}

/** Exact text of a function from a tested Python file in python/. */
export function py(path: string, fn?: string): string {
  const src = PY[path];
  if (!src) throw new Error(`No python file ${path}`);
  return fn ? extractDef(src, fn) : src.trimEnd();
}

export function pyLine(code: string, needle: string): number {
  return lineOf(code, needle);
}
