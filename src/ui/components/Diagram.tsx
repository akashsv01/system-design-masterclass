/**
 * Stable architecture diagram.
 *
 * Every node has a fixed slot in two layouts: "wide" (landscape, for ≥ 640 px stages)
 * and "narrow" (portrait, for phones). We switch layouts instead of shrinking, so
 * labels stay legible (docs/DESIGN.md D5). Nodes that are not yet relevant render
 * as "ghost" (invisible but reserving space) so nothing moves when they appear (D3).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export type NodeKind = 'client' | 'server' | 'db' | 'cache' | 'queue' | 'service' | 'ext' | 'lb' | 'box';
export type NodeState = 'idle' | 'ghost' | 'dim' | 'active' | 'ok' | 'fail' | 'focus';

export interface DNode {
  id: string;
  label: string;
  sub?: string;
  value?: string;
  kind: NodeKind;
  state?: NodeState;
  /** A small tag drawn just above the node: e.g. "was: available". */
  tag?: { text: string; tone?: 'changed' | 'ok' | 'fail' | 'plain' };
  /** Draw this node as a stack of n similar things (replicas, shards, a server pool). */
  stack?: number;
}

export interface DEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  state?: 'idle' | 'ghost' | 'active';
  dashed?: boolean;
}

export interface DToken {
  /** Change the id to restart the animation. */
  id: string;
  from: string;
  to: string;
  label: string;
  tone: 'request' | 'response' | 'fail' | 'copy';
  /** 0..1 position to rest at when not animating (e.g. in flight but paused). */
  at?: number;
}

export interface Layout {
  width: number;
  height: number;
  nodes: Record<string, { x: number; y: number; w?: number; h?: number }>;
}

interface Props {
  nodes: DNode[];
  edges: DEdge[];
  tokens?: DToken[];
  wide: Layout;
  narrow: Layout;
  /** Accessible summary of what the diagram currently shows. */
  description: string;
  /** Container width below which the narrow layout is used. */
  breakpoint?: number;
  /** 'layered' adds a subtle depth offset to every node; use it where structure, not flow, is the point. */
  depth?: 'flat' | 'layered';
}

const GLYPH: Record<NodeKind, string> = {
  client: '▯', server: '▣', db: '⛁', cache: '⚡', queue: '☰', service: '◆', ext: '◎', lb: '⇉', box: '',
};

export function useStageWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(800);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const DEFAULT_W = 168;
const DEFAULT_H = 74;

function box(layout: Layout, id: string) {
  const n = layout.nodes[id];
  if (!n) return { x: 0, y: 0, w: DEFAULT_W, h: DEFAULT_H };
  return { x: n.x, y: n.y, w: n.w ?? DEFAULT_W, h: n.h ?? DEFAULT_H };
}

/** Point where the segment from a's centre to b's centre leaves a's rectangle. */
function exitPoint(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return { x: a.x, y: a.y };
  const sx = Math.abs(dx) > 0 ? a.w / 2 / Math.abs(dx) : Infinity;
  const sy = Math.abs(dy) > 0 ? a.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: a.x + dx * s, y: a.y + dy * s };
}

function endpoints(layout: Layout, from: string, to: string) {
  const a = box(layout, from);
  const b = box(layout, to);
  const p1 = exitPoint(a, b);
  const p2 = exitPoint(b, a);
  return { p1, p2 };
}

function Token({ t, layout, offset }: { t: DToken; layout: Layout; offset: number }) {
  const { p1, p2 } = endpoints(layout, t.from, t.to);
  // Offset perpendicular so request and response on the same edge do not overlap.
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
  const nx = (-(p2.y - p1.y) / len) * offset;
  const ny = ((p2.x - p1.x) / len) * offset;
  const start = { x: p1.x + nx, y: p1.y + ny };
  const end = { x: p2.x + nx, y: p2.y + ny };
  const rest = t.at ?? 1;
  const target = { x: start.x + (end.x - start.x) * rest, y: start.y + (end.y - start.y) * rest };
  const [pos, setPos] = useState(start);
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    setPos(start);
    setArrived(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPos(target)));
    // A message that reaches its destination fades away so the node's new state is readable.
    const fade = rest >= 1 ? setTimeout(() => setArrived(true), 1100) : undefined;
    return () => {
      cancelAnimationFrame(id);
      if (fade) clearTimeout(fade);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.id, layout.width]);
  const w = Math.max(64, t.label.length * 8 + 18);
  return (
    <g className={`token ${t.tone} ${arrived ? 'arrived' : ''}`} style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }} aria-hidden="true">
      <rect x={-w / 2} y={-14} width={w} height={28} rx={14} />
      <text textAnchor="middle" dy="0.35em">
        {t.label}
      </text>
    </g>
  );
}

export function Diagram({ nodes, edges, tokens = [], wide, narrow, description, breakpoint = 640, depth = 'flat' }: Props) {
  const [ref, width] = useStageWidth<HTMLDivElement>();
  const layout = width < breakpoint ? narrow : wide;
  const isNarrow = layout === narrow;
  const fs = isNarrow ? 15 : 16;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <div ref={ref}>
      <svg
        className="diagram"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={description}
        style={{ fontSize: fs }}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--line-strong)" />
          </marker>
        </defs>
        {edges.map((e) => {
          const { p1, p2 } = endpoints(layout, e.from, e.to);
          // The path a message took this step stays highlighted after the token fades.
          const traveled = tokens.some((t) => (t.from === e.from && t.to === e.to) || (t.from === e.to && t.to === e.from));
          const hidden = e.state === 'ghost' || byId[e.from]?.state === 'ghost' || byId[e.to]?.state === 'ghost';
          const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
          return (
            <g key={e.id}>
              <line
                className={`edge ${hidden ? 'ghost' : e.state ?? (traveled ? 'active' : '')} ${e.dashed ? 'dashed' : ''}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
              />
              {e.label && !hidden && (
                <text className="edge-label" x={mid.x} y={mid.y - 8} textAnchor="middle">
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map((n) => {
          const b = box(layout, n.id);
          const hasValue = n.value !== undefined;
          return (
            <g key={n.id} className={`node ${n.state ?? 'idle'}`} aria-hidden={n.state === 'ghost'}>
              {Array.from({ length: Math.max(0, Math.max(n.stack ?? 0, depth === 'layered' ? 2 : 0) - 1) }, (_, k) => {
                const backs = Math.max(0, Math.max(n.stack ?? 0, depth === 'layered' ? 2 : 0) - 1);
                const off = (backs - k) * 6;
                return <rect key={k} className="n-box n-back" x={b.x - b.w / 2 + off} y={b.y - b.h / 2 - off} width={b.w} height={b.h} rx={n.kind === 'db' ? 18 : 10} />;
              })}
              <rect className="n-box" x={b.x - b.w / 2} y={b.y - b.h / 2} width={b.w} height={b.h} rx={n.kind === 'db' ? 18 : 10} />
              <text className="n-label" x={b.x} y={b.y - (hasValue ? 10 : n.sub ? 6 : -1)} textAnchor="middle" dy="0.35em">
                {GLYPH[n.kind] ? `${GLYPH[n.kind]} ` : ''}
                {n.label}
              </text>
              {n.sub && !hasValue && (
                <text className="n-sub" x={b.x} y={b.y + 16} textAnchor="middle" dy="0.35em" style={{ fontSize: fs - 2 }}>
                  {n.sub}
                </text>
              )}
              {hasValue && (
                <text className="n-value" x={b.x} y={b.y + 15} textAnchor="middle" dy="0.35em" style={{ fontSize: fs - 1 }}>
                  {n.value}
                </text>
              )}
              {n.stack && n.stack > 1 && n.state !== 'ghost' && (
                <text className="n-sub" x={b.x + b.w / 2 - 6} y={b.y + b.h / 2 - 8} textAnchor="end" style={{ fontSize: fs - 3 }}>×{n.stack}</text>
              )}
              {n.tag && n.state !== 'ghost' && (
                // Above the node, unless that would leave the stage; then below it.
                <TagLabel x={b.x} y={b.y - b.h / 2 - 20 < 14 ? b.y + b.h / 2 + 20 : b.y - b.h / 2 - 20} text={n.tag.text} tone={n.tag.tone ?? 'plain'} />
              )}
            </g>
          );
        })}
        {tokens.map((t, i) => (
          <Token key={t.id} t={t} layout={layout} offset={tokens.length > 1 ? (i % 2 ? 14 : -14) : 0} />
        ))}
      </svg>
    </div>
  );
}

function TagLabel({ x, y, text, tone }: { x: number; y: number; text: string; tone: string }) {
  const w = text.length * 7.8 + 18;
  return (
    <g className={`tag ${tone}`}>
      <rect x={x - w / 2} y={y - 13} width={w} height={26} rx={6} />
      <text x={x} y={y} textAnchor="middle" dy="0.35em">
        {text}
      </text>
    </g>
  );
}

export function DiagramLegend({ items }: { items: { tone: string; label: ReactNode }[] }) {
  return (
    <ul className="legend" style={{ display: 'flex', gap: 14, listStyle: 'none', padding: 0, margin: '8px 0 0', fontSize: 13, color: 'var(--muted)', flexWrap: 'wrap' }}>
      {items.map((it, i) => (
        <li key={i}>
          <span className={`pill ${it.tone}`}>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
