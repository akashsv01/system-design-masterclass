/**
 * The learner's design as data (interview brief §4): components and directed, labelled connections.
 * Pure functions only — the workspace, the interviewer's rules, the trace and failure simulations and the
 * worked-solution comparison all read this one structure.
 */

/** Shapes the workspace can draw. HLD parts first, then LLD (class diagrams and state machines). */
export type CompKind =
  | 'client' | 'lb' | 'gateway' | 'service' | 'worker' | 'db' | 'cache' | 'queue' | 'stream' | 'storage' | 'cdn' | 'ext' | 'search' | 'scheduler'
  | 'class' | 'enum' | 'iface' | 'state';

export interface Comp {
  id: string;
  /** Palette item this came from (e.g. "seat-db"); custom parts use "custom". */
  type: string;
  kind: CompKind;
  label: string;
  x: number;
  y: number;
}

export interface Link {
  id: string;
  from: string;
  to: string;
  /** Meaning of the arrow, e.g. "writes to". Undefined = not yet stated (the interviewer asks). */
  label?: string;
}

export interface DesignGraph {
  comps: Comp[];
  links: Link[];
}

export const EMPTY_GRAPH: DesignGraph = { comps: [], links: [] };

/** A selector for components: string = kind; object fields are OR within a field and AND across fields. */
export type Sel = CompKind | { kind?: CompKind | CompKind[]; type?: string | string[]; name?: string | string[] };

const arr = <T,>(v: T | T[] | undefined): T[] | undefined => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);

export function matches(c: Comp, sel: Sel): boolean {
  if (typeof sel === 'string') return c.kind === sel;
  const kinds = arr(sel.kind);
  const types = arr(sel.type);
  const names = arr(sel.name);
  if (kinds && !kinds.includes(c.kind)) return false;
  if (types && !types.includes(c.type)) return false;
  if (names && !names.some((n) => c.label.toLowerCase().includes(n.toLowerCase()))) return false;
  return !!(kinds || types || names);
}

export const find = (g: DesignGraph, sel: Sel) => g.comps.filter((c) => matches(c, sel));
export const byId = (g: DesignGraph, id: string) => g.comps.find((c) => c.id === id);

/** Links from a component matching `a` to one matching `b` (optionally with one of the given labels). */
export function linksBetween(g: DesignGraph, a: Sel, b: Sel, labels?: string[]): Link[] {
  return g.links.filter((l) => {
    const f = byId(g, l.from);
    const t = byId(g, l.to);
    return !!f && !!t && matches(f, a) && matches(t, b) && (!labels || (!!l.label && labels.includes(l.label)));
  });
}

/** Shortest directed path (component ids) from any match of `a` to any match of `b`; null if none. */
export function shortestPath(g: DesignGraph, a: Sel, b: Sel): string[] | null {
  const starts = find(g, a).map((c) => c.id);
  const goal = new Set(find(g, b).map((c) => c.id));
  const prev = new Map<string, string | null>(starts.map((s) => [s, null]));
  const queue = [...starts];
  while (queue.length) {
    const cur = queue.shift()!;
    if (goal.has(cur)) {
      const path = [cur];
      let p = prev.get(cur);
      while (p) { path.unshift(p); p = prev.get(p); }
      return path;
    }
    for (const l of g.links) if (l.from === cur && !prev.has(l.to)) { prev.set(l.to, cur); queue.push(l.to); }
  }
  return null;
}

// ── Editing (every edit returns a new graph; the workspace keeps undo/redo stacks of these) ──────────

let seq = 0;
export function newId(prefix: string) {
  seq = (seq + 1) % 1e6;
  return `${prefix}${Date.now().toString(36).slice(-4)}${seq.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function addComp(g: DesignGraph, c: Omit<Comp, 'id'> & { id?: string }): [DesignGraph, string] {
  const id = c.id ?? newId('c');
  return [{ ...g, comps: [...g.comps, { ...c, id }] }, id];
}
export const moveComp = (g: DesignGraph, id: string, x: number, y: number): DesignGraph => ({ ...g, comps: g.comps.map((c) => (c.id === id ? { ...c, x, y } : c)) });
export const renameComp = (g: DesignGraph, id: string, label: string): DesignGraph => ({ ...g, comps: g.comps.map((c) => (c.id === id ? { ...c, label: label.slice(0, 40) } : c)) });
export const removeComp = (g: DesignGraph, id: string): DesignGraph => ({ comps: g.comps.filter((c) => c.id !== id), links: g.links.filter((l) => l.from !== id && l.to !== id) });

/** Connects two components; an existing arrow in the same direction is kept (no duplicates), self-links refused. */
export function connect(g: DesignGraph, from: string, to: string, label?: string): [DesignGraph, string | null] {
  if (from === to || !byId(g, from) || !byId(g, to)) return [g, null];
  const existing = g.links.find((l) => l.from === from && l.to === to);
  if (existing) return [label && existing.label !== label ? setLabel(g, existing.id, label) : g, existing.id];
  const id = newId('l');
  return [{ ...g, links: [...g.links, { id, from, to, label }] }, id];
}
export const setLabel = (g: DesignGraph, id: string, label: string | undefined): DesignGraph => ({ ...g, links: g.links.map((l) => (l.id === id ? { ...l, label } : l)) });
export const removeLink = (g: DesignGraph, id: string): DesignGraph => ({ ...g, links: g.links.filter((l) => l.id !== id) });
export const reverseLink = (g: DesignGraph, id: string): DesignGraph => ({ ...g, links: g.links.map((l) => (l.id === id ? { ...l, from: l.to, to: l.from } : l)) });
/** Point an existing arrow at a different target (or from a different source). */
export function reconnect(g: DesignGraph, id: string, end: 'from' | 'to', compId: string): DesignGraph {
  const l = g.links.find((x) => x.id === id);
  if (!l) return g;
  const next = { ...l, [end]: compId };
  if (next.from === next.to || g.links.some((x) => x.id !== id && x.from === next.from && x.to === next.to)) return g;
  return { ...g, links: g.links.map((x) => (x.id === id ? next : x)) };
}

// ── Undo / redo ──────────────────────────────────────────────────────────────────────────────────────

export interface History { past: DesignGraph[]; future: DesignGraph[] }
export const EMPTY_HISTORY: History = { past: [], future: [] };
const LIMIT = 60;
export const pushHistory = (h: History, before: DesignGraph): History => ({ past: [...h.past.slice(-LIMIT + 1), before], future: [] });
export function undo(h: History, cur: DesignGraph): [History, DesignGraph] | null {
  if (!h.past.length) return null;
  return [{ past: h.past.slice(0, -1), future: [cur, ...h.future] }, h.past[h.past.length - 1]];
}
export function redo(h: History, cur: DesignGraph): [History, DesignGraph] | null {
  if (!h.future.length) return null;
  return [{ past: [...h.past, cur], future: h.future.slice(1) }, h.future[0]];
}

// ── Auto-arrange: layered left-to-right (or top-to-bottom on narrow screens) ────────────────────────

export function autoArrange(g: DesignGraph, opts: { width: number; height: number; vertical?: boolean }): DesignGraph {
  if (!g.comps.length) return g;
  // Rank = longest path from a source, ignoring arrows that would close a cycle (visited-set DFS order).
  const rank = new Map<string, number>(g.comps.map((c) => [c.id, 0]));
  const order = topoOrder(g);
  for (const id of order) for (const l of g.links) if (l.from === id && order.indexOf(l.to) > order.indexOf(id)) rank.set(l.to, Math.max(rank.get(l.to)!, rank.get(id)! + 1));
  const layers: string[][] = [];
  for (const id of order) (layers[rank.get(id)!] ??= []).push(id);
  const cols = layers.length;
  const pos = new Map<string, { x: number; y: number }>();
  layers.forEach((ids, li) => {
    ids.forEach((id, i) => {
      const along = (li + 0.5) / cols;
      const across = (i + 0.5) / ids.length;
      pos.set(id, opts.vertical ? { x: across * opts.width, y: along * opts.height } : { x: along * opts.width, y: across * opts.height });
    });
  });
  return { ...g, comps: g.comps.map((c) => ({ ...c, ...(pos.get(c.id) ?? {}) })).map((c) => ({ ...c, x: Math.round(c.x), y: Math.round(c.y) })) };
}

function topoOrder(g: DesignGraph): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const indeg = new Map(g.comps.map((c) => [c.id, 0]));
  for (const l of g.links) indeg.set(l.to, (indeg.get(l.to) ?? 0) + 1);
  // Sources first (in placement order), then whatever remains (cycles), depth-first.
  const roots = [...g.comps.filter((c) => !indeg.get(c.id)), ...g.comps].map((c) => c.id);
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
    for (const l of g.links) if (l.from === id) visit(l.to);
  };
  roots.forEach(visit);
  return out;
}

/** Plain-language description of the design, used for the accessible list and screen-reader summaries. */
export function describe(g: DesignGraph): string {
  if (!g.comps.length) return 'Empty design.';
  const name = (id: string) => byId(g, id)?.label ?? '?';
  const parts = g.comps.map((c) => c.label).join(', ');
  const arrows = g.links.map((l) => `${name(l.from)} ${l.label ?? '→'} ${name(l.to)}`).join('; ');
  return `${g.comps.length} components: ${parts}.${g.links.length ? ` Connections: ${arrows}.` : ' No connections yet.'}`;
}

/** Splits the arrow A→B around a new part X: A→X (keeps the arrow's meaning) and X→B (meaning `onward`). */
export function insertInto(g: DesignGraph, linkId: string, c: Omit<Comp, 'id' | 'x' | 'y'>, onward?: string): [DesignGraph, string] {
  const l = g.links.find((x) => x.id === linkId);
  const a = l && byId(g, l.from);
  const b = l && byId(g, l.to);
  if (!l || !a || !b) return [g, ''];
  const [g1, id] = addComp(g, { ...c, x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) + (a.y === b.y ? 0 : 0) });
  // Nudge the old endpoints apart if the new part would sit on top of one of them.
  const g2: DesignGraph = { comps: g1.comps, links: g1.links.filter((x) => x.id !== linkId) };
  const [g3] = connect(g2, a.id, id, l.label);
  const [g4] = connect(g3, id, b.id, onward);
  return [g4, id];
}
