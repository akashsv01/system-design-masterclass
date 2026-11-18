/**
 * A small, calm diagram workspace for interview practice: boxes and arrows, drag to move,
 * tap two boxes to connect them. Every element also appears in an editable text list,
 * so the workspace is usable with a keyboard or screen reader.
 */
import { useRef, useState } from 'react';

export interface WsBox { id: string; x: number; y: number; label: string }
export interface WsArrow { from: string; to: string }
export interface WsDiagram { boxes: WsBox[]; arrows: WsArrow[] }

export const EMPTY_DIAGRAM: WsDiagram = { boxes: [], arrows: [] };
const W = 800;
const H = 460;
const BW = 140;
const BH = 50;

function newId() {
  return 'b' + Math.random().toString(36).slice(2, 8);
}

export function Workspace({ value, onChange }: { value: WsDiagram; onChange: (d: WsDiagram) => void }) {
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const d = value;

  const toSvg = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const add = () => {
    const text = label.trim();
    if (!text) return;
    const i = d.boxes.length;
    const box = { id: newId(), x: 100 + (i % 4) * 190, y: 70 + Math.floor(i / 4) * 110, label: text.slice(0, 40) };
    onChange({ ...d, boxes: [...d.boxes, box] });
    setLabel('');
  };
  const remove = (id: string) => {
    onChange({ boxes: d.boxes.filter((b) => b.id !== id), arrows: d.arrows.filter((a) => a.from !== id && a.to !== id) });
    setSelected(null);
  };
  const tapBox = (id: string) => {
    if (connectFrom && connectFrom !== id) {
      if (!d.arrows.some((a) => a.from === connectFrom && a.to === id)) onChange({ ...d, arrows: [...d.arrows, { from: connectFrom, to: id }] });
      setConnectFrom(null);
      setSelected(id);
    } else setSelected(id === selected ? null : id);
  };
  const byId = Object.fromEntries(d.boxes.map((b) => [b.id, b]));

  return (
    <div>
      <div className="toolbar">
        <label style={{ flex: '1 1 200px' }}>
          <span className="visually-hidden">New component name</span>
          <input type="text" value={label} placeholder="Add a component, e.g. “Booking service”" onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        </label>
        <button className="btn btn-small btn-primary" onClick={add} disabled={!label.trim()}>Add</button>
        <button className="btn btn-small" disabled={!selected} onClick={() => setConnectFrom(selected)} aria-pressed={!!connectFrom}>
          {connectFrom ? 'Now tap the target…' : 'Connect from selected'}
        </button>
        <button className="btn btn-small btn-quiet" disabled={!selected} onClick={() => selected && remove(selected)}>Delete selected</button>
      </div>
      <svg ref={svgRef} className="diagram workspace" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Your diagram: ${d.boxes.length} components, ${d.arrows.length} connections`}
        style={{ background: 'var(--surface)', border: '1px dashed var(--line-strong)', borderRadius: 10, touchAction: 'none' }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const p = toSvg(e);
          drag.current.moved = true;
          const id = drag.current.id;
          onChange({ ...d, boxes: d.boxes.map((b) => (b.id === id ? { ...b, x: Math.max(BW / 2, Math.min(W - BW / 2, p.x - drag.current!.dx)), y: Math.max(BH / 2, Math.min(H - BH / 2, p.y - drag.current!.dy)) } : b)) });
        }}
        onPointerUp={() => {
          if (drag.current && !drag.current.moved) tapBox(drag.current.id);
          drag.current = null;
        }}
      >
        <defs>
          <marker id="ws-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink-2)" /></marker>
        </defs>
        {d.arrows.map((a, i) => {
          const f = byId[a.from];
          const t = byId[a.to];
          if (!f || !t) return null;
          const dx = t.x - f.x;
          const dy = t.y - f.y;
          const s = Math.min(dx ? (BW / 2) / Math.abs(dx) : Infinity, dy ? (BH / 2) / Math.abs(dy) : Infinity);
          return <line key={i} x1={f.x + dx * s} y1={f.y + dy * s} x2={t.x - dx * s} y2={t.y - dy * s} stroke="var(--ink-2)" strokeWidth={2} markerEnd="url(#ws-arrow)" />;
        })}
        {d.boxes.map((b) => (
          <g key={b.id} style={{ cursor: 'grab' }} onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            const p = toSvg(e);
            drag.current = { id: b.id, dx: p.x - b.x, dy: p.y - b.y, moved: false };
          }}>
            <rect x={b.x - BW / 2} y={b.y - BH / 2} width={BW} height={BH} rx={10} fill={selected === b.id ? 'var(--accent-soft)' : 'var(--paper)'} stroke={connectFrom === b.id ? 'var(--active)' : selected === b.id ? 'var(--accent)' : 'var(--line-strong)'} strokeWidth={selected === b.id || connectFrom === b.id ? 2.5 : 1.5} />
            <text x={b.x} y={b.y} textAnchor="middle" dy="0.35em" style={{ fontSize: 15, fontWeight: 600 }}>{b.label.length > 18 ? b.label.slice(0, 17) + '…' : b.label}</text>
          </g>
        ))}
        {!d.boxes.length && <text x={W / 2} y={H / 2} textAnchor="middle" className="edge-label">Add components above, drag to arrange, tap two to connect.</text>}
      </svg>
      <details className="more">
        <summary>Components and connections as text ({d.boxes.length} / {d.arrows.length})</summary>
        <div className="more-body">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {d.boxes.map((b) => (
              <li key={b.id}>
                {b.label}{' '}
                <button className="btn btn-quiet btn-small" onClick={() => remove(b.id)} aria-label={`Delete ${b.label}`}>delete</button>
                {d.arrows.filter((a) => a.from === b.id).map((a, i) => (
                  <span key={i} className="muted"> → {byId[a.to]?.label} <button className="btn btn-quiet btn-small" aria-label={`Remove connection to ${byId[a.to]?.label}`} onClick={() => onChange({ ...d, arrows: d.arrows.filter((x) => x !== a) })}>×</button></span>
                ))}
              </li>
            ))}
          </ul>
          {d.boxes.length >= 2 && <ConnectByText boxes={d.boxes} onConnect={(from, to) => onChange({ ...d, arrows: [...d.arrows, { from, to }] })} />}
        </div>
      </details>
    </div>
  );
}

function ConnectByText({ boxes, onConnect }: { boxes: WsBox[]; onConnect: (from: string, to: string) => void }) {
  const [from, setFrom] = useState(boxes[0].id);
  const [to, setTo] = useState(boxes[1].id);
  return (
    <div className="toolbar" style={{ marginTop: 8 }}>
      <label><span className="visually-hidden">From</span><select value={from} onChange={(e) => setFrom(e.target.value)}>{boxes.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>
      <span aria-hidden="true">→</span>
      <label><span className="visually-hidden">To</span><select value={to} onChange={(e) => setTo(e.target.value)}>{boxes.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>
      <button className="btn btn-small" disabled={from === to} onClick={() => onConnect(from, to)}>Connect</button>
    </div>
  );
}
