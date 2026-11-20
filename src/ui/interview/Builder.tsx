/**
 * The interview workspace builder (interview brief §4; Figma "SDM — Interview simulator workspace").
 *
 * One stored design, two orientations: positions live in a 640×440 virtual space; desktop draws it left→right,
 * phones draw the same design top→bottom so labels stay full size. Three ways to do everything:
 *  - pointer: drag a part chip onto the canvas, drag parts to move, drag from a part's handle to connect;
 *  - tap: tap a chip to add, tap a part, “Connect to…”, tap the destination (works on every device);
 *  - keyboard / list: chips and parts are buttons; the “Parts and connections” list adds, connects, labels,
 *    reverses, renames and deletes without any pointer precision.
 * Feedback is immediate (≤ 180 ms, motion tokens); nothing travels under reduced motion.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKE, type PointerEvent as RPE } from 'react';
import { addComp, byId, connect, insertInto, moveComp, removeComp, removeLink, renameComp, reconnect, reverseLink, setLabel, autoArrange, type Comp, type CompKind, type DesignGraph, type Link } from '../../sim/interview/graph';
import { CATALOGUE, KIND_NAME, LLD_CATALOGUE, verbsFor } from '../../content/interview/catalogue';
import type { PaletteItem } from '../../content/interview/types';
import { useStageWidth } from '../components/Diagram';
import { Icon, SvgIcon, type IconName } from '../components/Icon';

export const VW = 640;
export const VH = 440;

export type Mark = { tone: 'active' | 'ok' | 'fail' | 'focus' | 'dim'; tag?: string };
export interface Token { from: string; to: string; t: number; label: string; tone: 'request' | 'response' | 'fail' }

export interface BuilderProps {
  graph: DesignGraph;
  /** Commit an edit (the parent keeps undo/redo history). */
  commit?: (g: DesignGraph, say: string) => void;
  undo?: () => void;
  redo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  palette: PaletteItem[];
  verbs: string[];
  mode: 'architecture' | 'classes' | 'states';
  readOnly?: boolean;
  label: string;
  marks?: Record<string, Mark>;
  linkTone?: Record<string, 'active' | 'ok' | 'fail' | 'dim'>;
  token?: Token | null;
  /** External pick mode (e.g. "tap the part to take offline"). */
  pick?: { prompt: string; onPick: (id: string) => void; can?: (c: Comp) => boolean } | null;
  /** Extra controls at the right end of the toolbar (e.g. Trace). */
  actions?: React.ReactNode;
  emptyHint?: string;
  /** Called after any edit with a short description; the interviewer/coach can react. */
  onEdited?: (say: string) => void;
}

const ICON: Partial<Record<CompKind, IconName>> = {
  client: 'phone', lb: 'split', gateway: 'split', service: 'service', worker: 'server', db: 'database', cache: 'bolt', queue: 'queue',
  stream: 'layers', storage: 'cloud', cdn: 'globe', ext: 'globe', search: 'search', scheduler: 'clock', class: 'list', enum: 'list', iface: 'layers',
};

function prefersReduced() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

type Sel = { kind: 'comp'; id: string } | { kind: 'link'; id: string } | null;
type Pending = { kind: 'connect'; from: string } | { kind: 'reconnect'; link: string } | { kind: 'insert'; link: string } | null;

export function Builder(p: BuilderProps) {
  const g = p.graph;
  // Orientation follows the whole builder's width (stable); the drawing follows the canvas area's width.
  const [rootRef, rootW] = useStageWidth<HTMLDivElement>();
  const [wrapRef, width] = useStageWidth<HTMLDivElement>();
  const portrait = rootW > 0 && rootW < 640;
  const W = Math.max(280, Math.round(width || 640));
  const H = portrait ? 560 : Math.round(Math.max(380, Math.min(520, W * 0.66)));
  const NW = portrait ? 132 : 150;
  const NH = p.mode === 'states' ? 40 : portrait ? 48 : 54;
  const padX = NW / 2 + 10;
  const padY = NH / 2 + 26;
  const scr = (x: number, y: number) => (portrait
    ? { x: padX + (y / VH) * (W - 2 * padX), y: padY + (x / VW) * (H - 2 * padY) }
    : { x: padX + (x / VW) * (W - 2 * padX), y: padY + (y / VH) * (H - 2 * padY) });
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const virt = (sx: number, sy: number) => (portrait
    ? { x: Math.round(clamp((sy - padY) / (H - 2 * padY)) * VW), y: Math.round(clamp((sx - padX) / (W - 2 * padX)) * VH) }
    : { x: Math.round(clamp((sx - padX) / (W - 2 * padX)) * VW), y: Math.round(clamp((sy - padY) / (H - 2 * padY)) * VH) });

  const [sel, setSel] = useState<Sel>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [live, setLive] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [wire, setWire] = useState<{ from: string; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  // Drop selections that no longer exist (after undo, delete, or a new graph).
  useEffect(() => {
    if (sel?.kind === 'comp' && !byId(g, sel.id)) setSel(null);
    if (sel?.kind === 'link' && !g.links.some((l) => l.id === sel.id)) setSel(null);
  }, [g, sel]);
  useEffect(() => { if (!fresh) return; const t = setTimeout(() => setFresh(null), 900); return () => clearTimeout(t); }, [fresh]);

  const say = (msg: string) => { setLive(msg); p.onEdited?.(msg); };
  const edit = (next: DesignGraph, msg: string) => { if (!p.commit || next === g) return; p.commit(next, msg); say(msg); };
  const name = (id: string) => byId(g, id)?.label ?? '?';
  const kindOfNew: CompKind = p.mode === 'states' ? 'state' : p.mode === 'classes' ? 'class' : 'service';
  const extra = p.mode === 'architecture' ? CATALOGUE : p.mode === 'classes' ? LLD_CATALOGUE : [];

  /** Next free cell on a grid sized to the parts as drawn, so new parts never overlap (either orientation). */
  const freeSpot = (): { x: number; y: number } => {
    const taken = g.comps.map((c) => scr(c.x, c.y));
    // Room between parts for an arrow and its label (≈ 90 px), in either orientation.
    const stepX = portrait ? NW + 40 : NW + 96;
    const stepY = portrait ? NH + 96 : NH + 72;
    for (let sy = padY; sy <= H - padY + 1; sy += stepY) {
      for (let sx = padX; sx <= W - padX + 1; sx += stepX) {
        if (taken.every((t) => Math.abs(t.x - sx) > NW + 16 || Math.abs(t.y - sy) > NH + 24)) return virt(sx, sy);
      }
    }
    return virt(padX + ((g.comps.length * 37) % Math.max(1, W - 2 * padX)), padY + ((g.comps.length * 53) % Math.max(1, H - 2 * padY)));
  };
  /** The free cell closest to a target point (used when a part is inserted into an arrow). */
  const nearestFree = (target: { x: number; y: number }, ignore: string[] = []): { x: number; y: number } => {
    const t = scr(target.x, target.y);
    const taken = g.comps.filter((c) => !ignore.includes(c.id)).map((c) => scr(c.x, c.y));
    const ok = (x: number, y: number) => taken.every((q) => Math.abs(q.x - x) > NW + 16 || Math.abs(q.y - y) > NH + 24);
    if (ok(t.x, t.y)) return target;
    let best: { x: number; y: number; d: number } | null = null;
    for (let y = padY; y <= H - padY + 1; y += (NH + 24) / 2) for (let x = padX; x <= W - padX + 1; x += (NW + 16) / 2) {
      if (!ok(x, y)) continue;
      const d = Math.hypot(x - t.x, y - t.y);
      if (!best || d < best.d) best = { x, y, d };
    }
    return best ? virt(best.x, best.y) : target;
  };

  const add = (item: PaletteItem, at?: { x: number; y: number }) => {
    if (p.readOnly) return;
    const pos = at ?? freeSpot();
    const taken = g.comps.filter((c) => c.label === item.name).length;
    const label = taken ? `${item.name} ${taken + 1}` : item.name;
    const [next, id] = addComp(g, { type: item.type, kind: item.kind, label, ...pos });
    if (pending?.kind === 'insert') {
      const [ins0, nid] = insertInto(g, pending.link, { type: item.type, kind: item.kind, label });
      const placed = ins0.comps.find((c) => c.id === nid)!;
      const spot = nearestFree(placed);
      const ins = moveComp(ins0, nid, spot.x, spot.y);
      const l = ins.links.find((x) => x.from === nid);
      edit(ins, `Inserted ${label} between ${name(g.links.find((x) => x.id === pending.link)!.from)} and ${l ? name(l.to) : '?'}.`);
      setPending(null);
      setSel({ kind: 'comp', id: nid });
      setFresh(nid);
      return;
    }
    edit(next, `Added ${label}.`);
    setSel({ kind: 'comp', id });
    setFresh(id);
  };

  const finishConnect = (to: string) => {
    if (pending?.kind === 'connect') {
      if (to === pending.from) { setPending(null); return; }
      const [next, lid] = connect(g, pending.from, to);
      edit(next, `Connected ${name(pending.from)} to ${name(to)}. Choose what the arrow means.`);
      setPending(null);
      if (lid) setSel({ kind: 'link', id: lid });
      return true;
    }
    if (pending?.kind === 'reconnect') {
      const next = reconnect(g, pending.link, 'to', to);
      edit(next, `The arrow now points to ${name(to)}.`);
      setPending(null);
      setSel({ kind: 'link', id: pending.link });
      return true;
    }
    return false;
  };

  const tapComp = (id: string) => {
    if (p.pick) { const c = byId(g, id); if (c && (!p.pick.can || p.pick.can(c))) p.pick.onPick(id); return; }
    if (finishConnect(id)) return;
    setSel(sel?.kind === 'comp' && sel.id === id ? null : { kind: 'comp', id });
  };

  // ── pointer: move parts, drag from handles ──
  const toSvg = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const onNodeDown = (e: RPE, c: Comp) => {
    if (p.readOnly || p.pick || e.button > 0) return;
    const s = scr(c.x, c.y);
    const pt = toSvg(e);
    dragRef.current = { id: c.id, sx: pt.x, sy: pt.y, ox: pt.x - s.x, oy: pt.y - s.y, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onNodeMove = (e: RPE) => {
    const d = dragRef.current;
    if (!d) return;
    const pt = toSvg(e);
    if (!d.moved && Math.hypot(pt.x - d.sx, pt.y - d.sy) < 5) return;
    d.moved = true;
    setDrag({ id: d.id, ...virt(pt.x - d.ox, pt.y - d.oy) });
  };
  const onNodeUp = (c: Comp) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.moved && drag) { edit(moveComp(g, d.id, drag.x, drag.y), `Moved ${c.label}.`); setDrag(null); return; }
    setDrag(null);
    tapComp(c.id);
  };
  const onHandleDown = (e: RPE, c: Comp) => {
    e.stopPropagation();
    if (p.readOnly) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const pt = toSvg(e);
    setWire({ from: c.id, x: pt.x, y: pt.y });
  };
  const onHandleMove = (e: RPE) => { if (wire) { const pt = toSvg(e); setWire({ ...wire, x: pt.x, y: pt.y }); } };
  const onHandleUp = (e: RPE) => {
    if (!wire) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-comp]');
    const to = el?.getAttribute('data-comp');
    if (to && to !== wire.from) {
      const [next, lid] = connect(g, wire.from, to);
      edit(next, `Connected ${name(wire.from)} to ${name(to)}. Choose what the arrow means.`);
      if (lid) setSel({ kind: 'link', id: lid });
    }
    setWire(null);
  };

  // ── keyboard on the canvas and the whole builder ──
  const onKey = (e: RKE) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) p.redo?.(); else p.undo?.(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); p.redo?.(); return; }
    if (e.key === 'Escape') { setPending(null); setRenaming(null); setSel(null); return; }
    if (sel?.kind === 'comp' && !p.readOnly) {
      const c = byId(g, sel.id);
      if (!c) return;
      const step = e.shiftKey ? 48 : 16;
      const d: Record<string, [number, number]> = portrait
        ? { ArrowUp: [-step, 0], ArrowDown: [step, 0], ArrowLeft: [0, -step], ArrowRight: [0, step] }
        : { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] };
      if (d[e.key]) { e.preventDefault(); edit(moveComp(g, c.id, Math.max(0, Math.min(VW, c.x + d[e.key][0])), Math.max(0, Math.min(VH, c.y + d[e.key][1]))), `Moved ${c.label}.`); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); edit(removeComp(g, c.id), `Deleted ${c.label} and its arrows.`); setSel(null); return; }
      if (e.key.toLowerCase() === 'c') { e.preventDefault(); setPending({ kind: 'connect', from: c.id }); return; }
    }
    if (sel?.kind === 'link' && !p.readOnly && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); edit(removeLink(g, sel.id), 'Deleted the arrow.'); setSel(null); }
  };

  const shown = (c: Comp) => (drag?.id === c.id ? { ...c, x: drag.x, y: drag.y } : c);
  const pos = useMemo(() => Object.fromEntries(g.comps.map((c) => { const s = shown(c); return [c.id, scr(s.x, s.y)]; })), [g, drag, W, H, portrait]); // eslint-disable-line react-hooks/exhaustive-deps
  const edgePts = (l: Link) => {
    const a = pos[l.from];
    const b = pos[l.to];
    if (!a || !b) return null;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const k = (dx2: number, dy2: number) => Math.min(dx2 ? NW / 2 / Math.abs(dx2) : Infinity, dy2 ? NH / 2 / Math.abs(dy2) : Infinity);
    const s = k(dx, dy);
    // Two arrows between the same pair (A→B and B→A) sit side by side instead of on top of each other.
    const twin = g.links.some((o) => o.from === l.to && o.to === l.from);
    const len = Math.hypot(dx, dy) || 1;
    const off = twin ? 7 : 0;
    const ox = (-dy / len) * off;
    const oy = (dx / len) * off;
    return { x1: a.x + dx * s + ox, y1: a.y + dy * s + oy, x2: b.x - dx * s + ox, y2: b.y - dy * s + oy, len };
  };

  const selComp = sel?.kind === 'comp' ? byId(g, sel.id) : undefined;
  const selLink = sel?.kind === 'link' ? g.links.find((l) => l.id === sel.id) : undefined;
  const verbOptions = (l: Link) => {
    const a = byId(g, l.from);
    const b = byId(g, l.to);
    if (!a || !b) return p.verbs;
    const base = p.mode === 'states' ? p.verbs : verbsFor(a.kind, b.kind);
    return [...new Set([...base, ...(p.mode === 'states' ? [] : p.verbs.filter((v) => base.includes(v) || base.length === 0))])];
  };
  const filtered = query.trim()
    ? [...p.palette, ...extra.filter((x) => !p.palette.some((y) => y.type === x.type))].filter((x) => `${x.name} ${x.blurb}`.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  const reduced = prefersReduced();
  const selectionActions = selComp ? (
    renaming === selComp.id ? (
      <RenameForm initial={selComp.label} onDone={(v) => { if (v && v !== selComp.label) edit(renameComp(g, selComp.id, v), `Renamed to ${v}.`); setRenaming(null); }} />
    ) : (
      <span className="bld-actions">
        <strong className="bld-sel-name">{selComp.label}</strong>
        <button className="btn btn-small btn-primary" onClick={() => setPending({ kind: 'connect', from: selComp.id })}><Icon name="arrow-right" size={15} /> Connect to…</button>
        <button className="btn btn-small" onClick={() => setRenaming(selComp.id)}><Icon name="pencil" size={15} /> Rename</button>
        <button className="btn btn-small btn-quiet danger" onClick={() => { edit(removeComp(g, selComp.id), `Deleted ${selComp.label} and its arrows.`); setSel(null); }}><Icon name="x" size={15} /> Delete</button>
      </span>
    )
  ) : selLink ? (
    <span className="bld-actions bld-link">
      <span className="bld-sel-name">{name(selLink.from)} <Icon name="arrow-right" size={14} /> {name(selLink.to)}</span>
      <span className="verb-chips" role="group" aria-label="What this arrow means">
        {verbOptions(selLink).map((v) => (
          <button key={v} className="chip" aria-pressed={selLink.label === v} onClick={() => edit(setLabel(g, selLink.id, selLink.label === v ? undefined : v), `${name(selLink.from)} ${v} ${name(selLink.to)}.`)}>{v}</button>
        ))}
      </span>
      <span className="bld-link-more">
        <button className="btn btn-small btn-quiet" onClick={() => edit(reverseLink(g, selLink.id), 'Reversed the arrow.')}><Icon name="replay" size={14} /> Reverse</button>
        <button className="btn btn-small btn-quiet" onClick={() => setPending({ kind: 'reconnect', link: selLink.id })}>Change destination</button>
        {p.mode === 'architecture' && <button className="btn btn-small btn-quiet" onClick={() => setPending({ kind: 'insert', link: selLink.id })}>Insert a part here</button>}
        <button className="btn btn-small btn-quiet danger" onClick={() => { edit(removeLink(g, selLink.id), 'Deleted the arrow.'); setSel(null); }}><Icon name="x" size={14} /> Delete</button>
      </span>
    </span>
  ) : null;
  // Desktop: the actions float next to the selection, so selecting never pushes the canvas down.
  const anchor = !portrait && !pending && !p.pick && !p.readOnly ? (selComp ? (() => { const q = pos[selComp.id]; return q ? { x: q.x, y: q.y - NH / 2 - (p.marks?.[selComp.id]?.tag ? 26 : 8), below: q.y + NH / 2 + 8 } : null; })() : selLink ? (() => { const e = edgePts(selLink); return e ? { x: (e.x1 + e.x2) / 2, y: Math.min(e.y1, e.y2) - 22, below: Math.max(e.y1, e.y2) + 22 } : null; })() : null) : null;
  const popHalf = Math.min(selLink ? 240 : 190, W / 2 - 8);

  return (
    <div className={`builder ${portrait ? 'portrait' : ''} ${p.readOnly ? 'read-only' : ''}`} ref={rootRef} onKeyDown={onKey}>
      <p className="visually-hidden" aria-live="polite">{live}</p>
      {!p.readOnly && (
        <div className="bld-bar">
          <div className="bld-context" aria-live="polite">
            {p.pick ? (
              <span className="bld-prompt"><Icon name="target" size={16} /> {p.pick.prompt}</span>
            ) : pending ? (
              <span className="bld-prompt">
                <Icon name="target" size={16} />{' '}
                {pending.kind === 'connect' ? <>Now tap the part that <strong>{name(pending.from)}</strong> connects to.</> : pending.kind === 'reconnect' ? 'Tap the new destination for this arrow.' : 'Choose the part to insert into this arrow.'}
                <button className="btn btn-small btn-quiet" onClick={() => setPending(null)}>Cancel</button>
              </span>
            ) : portrait && (selComp || selLink) ? (
              selectionActions
            ) : (
              <span className="muted bld-hint">{portrait ? 'Tap a part to add it. Tap a placed part to connect it.' : 'Add parts from the left (click or drag). Select a part to connect it, or drag from its handle.'}</span>
            )}
          </div>
          <div className="bld-tools">
            <button className="icon-btn" onClick={p.undo} disabled={!p.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)"><Icon name="turn-left" size={17} /></button>
            <button className="icon-btn" onClick={p.redo} disabled={!p.canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Icon name="turn-right" size={17} /></button>
            <button className="btn btn-small btn-quiet" disabled={g.comps.length < 2} onClick={() => edit(shift(autoArrange(g, { width: VW - 80, height: VH - 60 }), 40, 30), 'Arranged the parts from left to right.')}><Icon name="layers" size={15} /> Arrange</button>
            {p.actions}
          </div>
        </div>
      )}
      <div className="bld-body">
        {!p.readOnly && (
          <div className="bld-palette" role="group" aria-label={pending?.kind === 'insert' ? 'Choose a part to insert' : 'Add a part'}>
            <span className="bld-palette-title">{pending?.kind === 'insert' ? 'Insert' : 'Add a part'}</span>
            <div className="bld-chips">
              {p.palette.map((item) => (
                <span key={item.type} className={`part-chip ${info === item.type ? 'open' : ''}`}>
                  <button
                    className="part-add"
                    draggable={!portrait}
                    onDragStart={(e) => { e.dataTransfer.setData('text/sdm-part', item.type); e.dataTransfer.effectAllowed = 'copy'; }}
                    onClick={() => add(item)}
                    aria-label={`Add ${item.name}`}
                  >
                    {ICON[item.kind] ? <Icon name={ICON[item.kind]!} size={16} /> : <span className="state-dot" aria-hidden="true" />}
                    <span>{item.name}</span>
                  </button>
                  <button className="part-info" aria-label={`About ${item.name}`} aria-expanded={info === item.type} onClick={() => setInfo(info === item.type ? null : item.type)}><Icon name="info" size={14} /></button>
                </span>
              ))}
              <button className="btn-link part-more" aria-expanded={more} onClick={() => setMore(!more)}>{more ? 'Fewer parts' : 'More parts…'}</button>
            </div>
            {info && <p className="part-blurb">{p.palette.find((x) => x.type === info)?.blurb}</p>}
            {more && (
              <div className="part-search">
                <label>
                  <span className="visually-hidden">Search parts or type a custom name</span>
                  <input type="search" value={query} placeholder="Search parts, or type a name" onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) { add(filtered[0] ?? { type: 'custom', kind: kindOfNew, name: query.trim().slice(0, 40), blurb: '' }); setQuery(''); } }} />
                </label>
                {query.trim() && (
                  <ul className="part-results">
                    {filtered.slice(0, 6).map((x) => <li key={x.type}><button onClick={() => { add(x); setQuery(''); }}>{x.name} <span className="muted">· {x.blurb}</span></button></li>)}
                    <li><button onClick={() => { add({ type: 'custom', kind: kindOfNew, name: query.trim().slice(0, 40), blurb: '' }); setQuery(''); }}>Add “{query.trim()}” as a custom {KIND_NAME[kindOfNew]}</button></li>
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        <div className="bld-canvas-wrap" ref={wrapRef}>
          <svg
            ref={svgRef}
            className={`bld-canvas ${pending || p.pick ? 'picking' : ''}`}
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            role="group"
            aria-label={`${p.label}: ${g.comps.length} parts, ${g.links.length} arrows`}
            onDragOver={(e) => { if (!p.readOnly) e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const t = e.dataTransfer.getData('text/sdm-part');
              const item = p.palette.find((x) => x.type === t);
              if (item) { const pt = toSvg(e); add(item, virt(pt.x, pt.y)); }
            }}
            onPointerMove={(e) => { onNodeMove(e); onHandleMove(e); }}
            onPointerUp={onHandleUp}
            onClick={(e) => { if (e.target === svgRef.current && !pending) setSel(null); }}
          >
            <defs>
              <pattern id="bld-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" className="bld-dot" /></pattern>
              {(['ink', 'accent', 'ok', 'fail', 'active'] as const).map((t) => (
                <marker key={t} id={`bld-arrow-${t}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" className={`m-${t}`} /></marker>
              ))}
            </defs>
            <rect width={W} height={H} fill="url(#bld-dots)" className="bld-bg" />
            {g.links.map((l) => {
              const pts = edgePts(l);
              if (!pts) return null;
              const tone = p.linkTone?.[l.id] ?? (sel?.kind === 'link' && sel.id === l.id ? 'active' : undefined);
              const marker = tone === 'fail' ? 'fail' : tone === 'ok' ? 'ok' : tone === 'active' ? 'accent' : !l.label ? 'active' : 'ink';
              const mx = (pts.x1 + pts.x2) / 2;
              const my = (pts.y1 + pts.y2) / 2;
              const tokenHere = p.token && p.token.from === l.from && p.token.to === l.to;
              const text = l.label ?? '? meaning';
              const pillW = Math.min(150, 14 + text.length * 6.6);
              const short = pts.len < NW + pillW * 0.6;
              // On short arrows the label floats beside the line instead of covering the parts.
              const nx = -(pts.y2 - pts.y1) / (Math.hypot(pts.x2 - pts.x1, pts.y2 - pts.y1) || 1);
              const ny = (pts.x2 - pts.x1) / (Math.hypot(pts.x2 - pts.x1, pts.y2 - pts.y1) || 1);
              const lx = mx - (short ? nx * 18 : 0);
              const ly = my - (short ? ny * 18 : 0);
              return (
                <g key={l.id} className={`bld-link ${tone ?? ''} ${!l.label ? 'bare' : ''}`} onClick={(e) => { e.stopPropagation(); if (!p.readOnly && !pending && !p.pick) setSel({ kind: 'link', id: l.id }); }}>
                  <line x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2} className="hit" />
                  <line x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2} className="ln" markerEnd={`url(#bld-arrow-${marker})`} />
                  {!tokenHere && (
                    <g className="pill" transform={`translate(${lx} ${ly})`}>
                      <rect x={-pillW / 2} y={-10} width={pillW} height={20} rx={10} />
                      <text textAnchor="middle" dy="0.35em">{text.length > 22 ? text.slice(0, 21) + '…' : text}</text>
                    </g>
                  )}
                </g>
              );
            })}
            {wire && pos[wire.from] && <line className="bld-wire" x1={pos[wire.from].x} y1={pos[wire.from].y} x2={wire.x} y2={wire.y} markerEnd="url(#bld-arrow-accent)" />}
            {g.comps.map((c) => {
              const s = pos[c.id];
              const m = p.marks?.[c.id];
              const selected = sel?.kind === 'comp' && sel.id === c.id;
              const source = pending?.kind === 'connect' && pending.from === c.id;
              const pickable = !!p.pick && (!p.pick.can || p.pick.can(c));
              const tone = source ? 'active' : m?.tone ?? (selected ? 'focus' : undefined);
              const tag = source ? 'Connecting from here' : m?.tag;
              const icon = ICON[c.kind];
              const isState = c.kind === 'state';
              const label = c.label.length > (portrait ? 15 : 17) ? c.label.slice(0, portrait ? 14 : 16) + '…' : c.label;
              return (
                <g
                  key={c.id}
                  data-comp={c.id}
                  className={`bld-node k-${c.kind} ${tone ?? ''} ${selected ? 'selected' : ''} ${fresh === c.id && !reduced ? 'fresh' : ''} ${pickable ? 'pickable' : ''} ${drag?.id === c.id ? 'dragging' : ''}`}
                  transform={`translate(${s.x} ${s.y})`}
                  tabIndex={0}
                  role="button"
                  aria-pressed={selected}
                  aria-label={`${c.label}, ${KIND_NAME[c.kind]}${tag ? `, ${tag}` : ''}. ${g.links.filter((l) => l.from === c.id || l.to === c.id).length} arrows.`}
                  onPointerDown={(e) => onNodeDown(e, c)}
                  onPointerMove={onNodeMove}
                  onPointerUp={() => onNodeUp(c)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapComp(c.id); } }}
                >
                  {tag && (
                    <g className={`bld-tag t-${tone ?? 'plain'}`} transform={`translate(0 ${-NH / 2 - 14})`}>
                      <rect x={-Math.min(NW, 12 + tag.length * 6.4) / 2} y={-10} width={Math.min(NW, 12 + tag.length * 6.4)} height={20} rx={10} />
                      <text textAnchor="middle" dy="0.35em">{tag}</text>
                    </g>
                  )}
                  <rect className="box" x={-NW / 2} y={-NH / 2} width={NW} height={NH} rx={isState ? NH / 2 : 10} />
                  {c.kind === 'db' && <path className="cyl" d={`M${-NW / 2} ${-NH / 2 + 9} q${NW / 2} 9 ${NW} 0`} />}
                  {(c.kind === 'class' || c.kind === 'enum' || c.kind === 'iface') && <line className="cls" x1={-NW / 2} x2={NW / 2} y1={NH / 2 - 16} y2={NH / 2 - 16} />}
                  {icon && <SvgIcon name={icon} x={-NW / 2 + 19} y={c.kind === 'class' || c.kind === 'enum' || c.kind === 'iface' ? -7 : 0} size={18} className="n-icon" />}
                  <text className="n-label" x={icon ? -NW / 2 + 34 : 0} y={isState ? 0 : -3} textAnchor={icon ? 'start' : 'middle'} dy={isState ? '0.35em' : undefined}>{label}</text>
                  {!isState && <text className="n-kind" x={icon ? -NW / 2 + 34 : 0} y={13} textAnchor={icon ? 'start' : 'middle'}>{c.kind === 'iface' ? '«interface»' : c.kind === 'enum' ? '«enum»' : KIND_NAME[c.kind]}</text>}
                  {selected && !p.readOnly && !portrait && (
                    <circle className="bld-handle" cx={NW / 2} cy={0} r={7} onPointerDown={(e) => onHandleDown(e, c)} onPointerMove={onHandleMove} onPointerUp={onHandleUp}>
                      <title>Drag to connect</title>
                    </circle>
                  )}
                </g>
              );
            })}
            {p.token && pos[p.token.from] && pos[p.token.to] && (() => {
              const a = pos[p.token.from];
              const b = pos[p.token.to];
              const x = a.x + (b.x - a.x) * p.token.t;
              const y = a.y + (b.y - a.y) * p.token.t;
              return (
                <g className={`bld-token ${p.token.tone}`} transform={`translate(${x} ${y})`}>
                  <circle r={8} />
                  <text y={-14} textAnchor="middle">{p.token.label}</text>
                </g>
              );
            })()}
            {!g.comps.length && (
              <text x={W / 2} y={H / 2} textAnchor="middle" className="bld-empty" aria-hidden="true">{p.emptyHint ?? (portrait ? 'Tap a part above to add it here.' : 'Click a part on the left, or drag it here.')}</text>
            )}
          </svg>
          {anchor && selectionActions && (
            <div className={`bld-pop ${anchor.y < 120 ? 'below' : ''}`} style={{ left: Math.max(popHalf, Math.min(W - popHalf, anchor.x)) + 8, top: (anchor.y < 120 ? anchor.below : anchor.y) + 8 }} role="toolbar" aria-label="Selection actions">
              {selectionActions}
            </div>
          )}
        </div>
      </div>
      <PartsList {...p} name={name} verbOptions={verbOptions} onSelect={(s) => setSel(s)} edit={edit} kindOfNew={kindOfNew} />
    </div>
  );
}

const shift = (g: DesignGraph, dx: number, dy: number): DesignGraph => ({ ...g, comps: g.comps.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy })) });

function RenameForm({ initial, onDone }: { initial: string; onDone: (v: string | null) => void }) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.select(); }, []);
  return (
    <form className="bld-rename" onSubmit={(e) => { e.preventDefault(); onDone(v.trim() || null); }}>
      <label><span className="visually-hidden">New name</span><input ref={ref} value={v} maxLength={40} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && onDone(null)} /></label>
      <button className="btn btn-small btn-primary" type="submit">Save</button>
      <button className="btn btn-small btn-quiet" type="button" onClick={() => onDone(null)}>Cancel</button>
    </form>
  );
}

/** The same design as a readable, fully operable list (no pointer precision needed). */
function PartsList(p: BuilderProps & { name: (id: string) => string; verbOptions: (l: Link) => string[]; onSelect: (s: Sel) => void; edit: (g: DesignGraph, msg: string) => void; kindOfNew: CompKind }) {
  const g = p.graph;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [verb, setVerb] = useState('');
  const f = from || g.comps[0]?.id || '';
  const t = to || g.comps.find((c) => c.id !== f)?.id || '';
  const fk = byId(g, f)?.kind;
  const tk = byId(g, t)?.kind;
  const options = fk && tk ? (p.mode === 'states' ? p.verbs : verbsFor(fk, tk)) : [];
  return (
    <details className="bld-list">
      <summary>Parts and connections <span className="muted">({g.comps.length} {g.comps.length === 1 ? 'part' : 'parts'} · {g.links.length} {g.links.length === 1 ? 'arrow' : 'arrows'}) — every edit is possible here with a keyboard</span></summary>
      <div className="bld-list-body">
        {!g.comps.length && <p className="muted">No parts yet. Add one with the buttons above.</p>}
        <ul className="bld-parts">
          {g.comps.map((c) => (
            <li key={c.id}>
              <button className="btn-link" onClick={() => p.onSelect({ kind: 'comp', id: c.id })}>{c.label}</button> <span className="muted">· {KIND_NAME[c.kind]}</span>
              {!p.readOnly && <button className="btn btn-small btn-quiet" onClick={() => p.edit(removeComp(g, c.id), `Deleted ${c.label} and its arrows.`)} aria-label={`Delete ${c.label}`}>Delete</button>}
            </li>
          ))}
        </ul>
        {g.links.length > 0 && (
          <ul className="bld-arrows">
            {g.links.map((l) => (
              <li key={l.id}>
                <span>{p.name(l.from)}</span>
                {p.readOnly ? <span className="muted"> {l.label ?? '→'} </span> : (
                  <label>
                    <span className="visually-hidden">Meaning of the arrow from {p.name(l.from)} to {p.name(l.to)}</span>
                    <select value={l.label ?? ''} onChange={(e) => p.edit(setLabel(g, l.id, e.target.value || undefined), `${p.name(l.from)} ${e.target.value || '→'} ${p.name(l.to)}.`)}>
                      <option value="">→ (meaning not stated)</option>
                      {[...new Set([...p.verbOptions(l), ...(l.label ? [l.label] : [])])].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                )}
                <span>{p.name(l.to)}</span>
                {!p.readOnly && (
                  <>
                    <button className="btn btn-small btn-quiet" onClick={() => p.edit(reverseLink(g, l.id), 'Reversed the arrow.')} aria-label={`Reverse the arrow from ${p.name(l.from)} to ${p.name(l.to)}`}>Reverse</button>
                    <button className="btn btn-small btn-quiet" onClick={() => p.edit(removeLink(g, l.id), 'Deleted the arrow.')} aria-label={`Delete the arrow from ${p.name(l.from)} to ${p.name(l.to)}`}>Delete</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {!p.readOnly && g.comps.length >= 2 && (
          <form className="bld-connect" onSubmit={(e) => { e.preventDefault(); if (f && t && f !== t) { const [next] = connect(g, f, t, verb || undefined); p.edit(next, `Connected ${p.name(f)} to ${p.name(t)}.`); } }}>
            <span className="muted">Connect</span>
            <label><span className="visually-hidden">From</span><select value={f} onChange={(e) => setFrom(e.target.value)}>{g.comps.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
            <label><span className="visually-hidden">Meaning</span><select value={verb} onChange={(e) => setVerb(e.target.value)}><option value="">→</option>{options.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
            <label><span className="visually-hidden">To</span><select value={t} onChange={(e) => setTo(e.target.value)}>{g.comps.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
            <button className="btn btn-small" type="submit" disabled={!f || !t || f === t}>Add arrow</button>
          </form>
        )}
      </div>
    </details>
  );
}

/** Undo/redo history for a design that lives in a saved record. */
export function useDesignHistory(graph: DesignGraph, save: (g: DesignGraph) => void) {
  const [past, setPast] = useState<DesignGraph[]>([]);
  const [future, setFuture] = useState<DesignGraph[]>([]);
  return {
    commit: (next: DesignGraph) => { setPast((ps) => [...ps.slice(-59), graph]); setFuture([]); save(next); },
    undo: () => { if (!past.length) return; const prev = past[past.length - 1]; setPast(past.slice(0, -1)); setFuture([graph, ...future]); save(prev); },
    redo: () => { if (!future.length) return; const nxt = future[0]; setFuture(future.slice(1)); setPast([...past, graph]); save(nxt); },
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
