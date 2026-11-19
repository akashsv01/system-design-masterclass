/**
 * Interactive layered view (docs/LESSON_GUIDE.md §3, DESIGN.md D16).
 *
 * Plates are drawn in perspective (turn + tilt, computed here so the SVG stays crisp), but every label is
 * drawn upright beside its plate and joined to it by a leader line. Turning or pulling the stack apart
 * moves the plates and leaders; the text never rotates. The selected layer's name and detail are always
 * upright and highlighted. A flat, fully labelled list is always available and is the default under
 * reduced motion.
 */
import { useEffect, useRef, useState } from 'react';
import { useStageWidth } from './Diagram';
import { Icon } from './Icon';

export interface Layer {
  id: string;
  label: string;
  /** Short content shown beside the layer, e.g. "GET /seats/F12". */
  detail?: string;
  tone?: 'plain' | 'active' | 'ok' | 'fail' | 'accent';
}

function prefersReduced() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Ease displayed values toward their targets so plates glide instead of jumping. */
function useTween(target: number, ms = 420) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (prefersReduced()) {
      setV(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      const cur = a + (target - a) * e;
      from.current = cur;
      setV(cur);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function wrap(text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export function LayerStack({
  layers,
  separation = 0.6,
  focus,
  description,
  ghost = [],
}: {
  /** Top layer first. */
  layers: Layer[];
  /** 0 = stacked close, 1 = fully pulled apart. The learner can change it. */
  separation?: number;
  focus?: string;
  description: string;
  /** Layer ids reserved but not shown yet (keeps positions stable as layers are revealed). */
  ghost?: string[];
}) {
  const [ref, width] = useStageWidth<HTMLDivElement>();
  const narrow = width < 560;
  const [sepTarget, setSep] = useState(separation);
  const [turnTarget, setTurn] = useState(30);
  const [flat, setFlat] = useState(prefersReduced);
  useEffect(() => setSep(separation), [separation]);
  const sep = useTween(sepTarget);
  const turn = useTween(turnTarget);

  const n = layers.length;
  const visible = layers.filter((l) => !ghost.includes(l.id));

  // Geometry (viewBox units).
  const W = narrow ? 360 : 760;
  const PW = narrow ? 150 : 236; // plate width
  const PD = narrow ? 92 : 140; // plate depth
  const K = 0.5; // vertical squash from the tilt
  const maxGap = narrow ? 64 : 74;
  const gap = (narrow ? 18 : 24) + sep * (maxGap - (narrow ? 18 : 24));
  const diag = Math.hypot(PW, PD) / 2;
  const H = Math.round((n - 1) * maxGap + diag * K * 2 + 24);
  const cx = narrow ? 100 : 230;
  const cy = H / 2;
  const th = (turn * Math.PI) / 180;
  const proj = (x: number, y: number, z: number) => {
    const xr = x * Math.cos(th) - y * Math.sin(th);
    const yr = x * Math.sin(th) + y * Math.cos(th);
    return { x: cx + xr, y: cy + yr * K - z };
  };
  const zOf = (i: number) => ((n - 1) / 2 - i) * gap;
  const plates = layers.map((l, i) => {
    const z = zOf(i);
    const corners = [proj(-PW / 2, -PD / 2, z), proj(PW / 2, -PD / 2, z), proj(PW / 2, PD / 2, z), proj(-PW / 2, PD / 2, z)];
    const right = corners.reduce((a, b) => (b.x > a.x ? b : a));
    return { l, i, corners, right, centerY: cy - z };
  });
  // Labels sit in a column to the right of the stack, upright, spaced so they never overlap.
  const labelX = narrow ? 196 : 450;
  const maxChars = narrow ? 18 : 30;
  const labelBlocks = plates
    .filter((p) => !ghost.includes(p.l.id))
    .map((p) => ({ ...p, lines: p.l.detail ? wrap(p.l.detail, maxChars) : [] }));
  let lastBottom = -Infinity;
  const placed = labelBlocks.map((p) => {
    const h = 20 + p.lines.length * 17;
    let top = p.centerY - h / 2;
    if (top < lastBottom + 8) top = lastBottom + 8;
    lastBottom = top + h;
    return { ...p, top, h };
  });

  return (
    <div ref={ref}>
      {flat ? (
        <ol className="layer-flat" aria-label={description}>
          {visible.map((l) => (
            <li key={l.id} className={`layer-flat-item ${l.tone ?? ''} ${focus === l.id ? 'focus' : ''}`}>
              <span>
                <strong>{l.label}</strong> {focus === l.id && <span className="focus-tag">· selected</span>}
              </span>
              {l.detail && <span className="mono">{l.detail}</span>}
            </li>
          ))}
        </ol>
      ) : (
        <svg className="diagram layer-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description}>
          {/* Bottom layer first so higher plates are drawn on top. */}
          {[...plates].reverse().map((p) => (
            <polygon
              key={p.l.id}
              className={`plate ${p.l.tone ?? ''} ${focus === p.l.id ? 'focus' : ''}`}
              points={p.corners.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')}
              opacity={ghost.includes(p.l.id) ? 0 : 1}
              strokeLinejoin="round"
            />
          ))}
          {placed.map((p) => {
            const isFocus = focus === p.l.id;
            const ly = p.top + 13;
            return (
              <g key={p.l.id}>
                <polyline className={`leader ${isFocus ? 'focus' : ''}`} points={`${p.right.x + 4},${p.right.y} ${labelX - 14},${ly - 4} ${labelX - 6},${ly - 4}`} />
                <circle cx={p.right.x + 4} cy={p.right.y} r={2.5} fill={isFocus ? 'var(--accent)' : 'var(--line-strong)'} />
                <text className={`l-name ${isFocus ? 'focus' : ''}`} x={labelX} y={ly}>
                  {p.l.label}
                </text>
                {p.lines.map((line, k) => (
                  <text key={k} className="l-detail" x={labelX} y={ly + 18 + k * 17}>{line}</text>
                ))}
              </g>
            );
          })}
        </svg>
      )}
      <div className="layer-tools">
        {!flat && (
          <>
            <label className="range-row">
              <span>Pull apart</span>
              <input type="range" min={0} max={1} step={0.05} value={sepTarget} onChange={(e) => setSep(Number(e.target.value))} aria-valuetext={`${Math.round(sepTarget * 100)}% apart`} />
            </label>
            <button className="btn btn-small" onClick={() => setTurn((t) => Math.max(-60, t - 15))} disabled={turnTarget <= -60}>
              <Icon name="turn-left" size={16} /> Turn
            </button>
            <button className="btn btn-small" onClick={() => setTurn((t) => Math.min(60, t + 15))} disabled={turnTarget >= 60}>
              Turn <Icon name="turn-right" size={16} />
            </button>
          </>
        )}
        <button className="btn btn-small btn-quiet" onClick={() => setFlat(!flat)} aria-pressed={flat}>
          <Icon name={flat ? 'layers' : 'list'} size={16} /> {flat ? 'Layered view' : 'Flat list'}
        </button>
      </div>
    </div>
  );
}
