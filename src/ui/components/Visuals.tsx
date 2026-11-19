/**
 * Additional visual formats for the generic reader (docs/LESSON_GUIDE.md §4):
 * Timeline (who did what, when), Chart (one quantity changing), Compare (two designs side by side).
 * All keep earlier elements in place as steps advance and highlight only what changed.
 */
import type { ReactNode } from 'react';
import { useStageWidth } from './Diagram';
import { Rich } from './Rich';

/* ---------------- Timeline ---------------- */

export interface TimelineEvent {
  t: number;
  lane: string;
  label: string;
  tone?: 'plain' | 'active' | 'ok' | 'fail' | 'accent';
  /** Optional arrow to another lane at time `toT` (a message). */
  to?: { lane: string; t: number };
}

export function Timeline({
  lanes,
  events,
  upTo,
  focus,
  unit = 'ms',
  description,
  note,
}: {
  note?: string;
  lanes: { id: string; label: string }[];
  events: TimelineEvent[];
  /** Number of events visible (earlier ones stay in place). */
  upTo: number;
  focus?: number;
  unit?: string;
  description: string;
}) {
  const [ref, width] = useStageWidth<HTMLDivElement>();
  const shown = events.slice(0, upTo);
  if (width < 560) {
    // Phones: a vertical list in time order reads better than tiny lanes.
    return (
      <div ref={ref}>
        <ol className="tl-list" aria-label={description}>
          {shown.map((e, i) => (
            <li key={i} className={`tl-item ${e.tone ?? ''} ${i === (focus ?? upTo - 1) ? 'focus' : ''}`}>
              <span className="mono tl-time">{e.t} {unit}</span>
              <span><strong>{lanes.find((l) => l.id === e.lane)?.label}</strong> · <Rich text={e.label} />{e.to && <> → {lanes.find((l) => l.id === e.to!.lane)?.label}</>}</span>
            </li>
          ))}
          {!shown.length && <li className="muted">Nothing has happened yet.</li>}
        </ol>
        {note && <p className="visual-note">{note}</p>}
      </div>
    );
  }
  const maxT = Math.max(1, ...events.map((e) => Math.max(e.t, e.to?.t ?? 0)));
  const left = Math.max(110, Math.max(...lanes.map((l) => l.label.length)) * 8.6 + 34);
  const W = 800;
  const laneH = 64;
  const H = lanes.length * laneH + 36;
  const x = (t: number) => left + ((W - left - 30) * t) / maxT;
  const y = (lane: string) => lanes.findIndex((l) => l.id === lane) * laneH + laneH / 2 + 8;
  return (
    <div ref={ref}>
      <svg className="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description} style={{ fontSize: 15 }}>
        <defs>
          <marker id="tl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-2)" />
          </marker>
        </defs>
        {lanes.map((l) => (
          <g key={l.id}>
            <text x={12} y={y(l.id)} dy="0.35em" className="n-label">{l.label}</text>
            <line x1={left} x2={W - 20} y1={y(l.id)} y2={y(l.id)} className="edge" />
          </g>
        ))}
        <text x={W - 20} y={H - 6} textAnchor="end" className="edge-label">time ({unit}) →</text>
        {shown.map((e, i) => {
          const isFocus = i === (focus ?? upTo - 1);
          const cls = e.tone === 'fail' ? 'var(--fail)' : e.tone === 'ok' ? 'var(--ok)' : e.tone === 'active' ? 'var(--active)' : 'var(--accent)';
          return (
            <g key={i} opacity={isFocus ? 1 : 0.55}>
              {e.to && <line x1={x(e.t)} y1={y(e.lane)} x2={x(e.to.t)} y2={y(e.to.lane)} stroke="var(--ink-2)" strokeWidth={1.5} markerEnd="url(#tl-arrow)" />}
              <circle cx={x(e.t)} cy={y(e.lane)} r={isFocus ? 8 : 6} fill={cls} />
              <text x={x(e.t)} y={y(e.lane) - 16} textAnchor="middle" style={{ fontSize: 13, fontWeight: isFocus ? 700 : 400 }}>{e.label.replace(/[*`]/g, '')}</text>
              <text x={x(e.t)} y={y(e.lane) + 22} textAnchor="middle" className="edge-label" style={{ fontSize: 12 }}>{e.t}</text>
            </g>
          );
        })}
      </svg>
      {note && <p className="visual-note">{note}</p>}
    </div>
  );
}

/* ---------------- Chart ---------------- */

export interface Series {
  name: string;
  points: [number, number][];
  tone?: 'accent' | 'active' | 'ok' | 'fail';
  dashed?: boolean;
}

export function Chart({
  series,
  xLabel,
  yLabel,
  marks = [],
  thresholds = [],
  kind = 'line',
  description,
  yMax,
  yLog,
  categories,
  note,
}: {
  /** Category labels for bar charts (x values are indexes). */
  categories?: string[];
  /** Shown under the chart: units, unusual scales, or "illustrative values". */
  note?: string;
  series: Series[];
  xLabel: string;
  yLabel: string;
  marks?: { x: number; y: number; label: string }[];
  thresholds?: { y: number; label: string }[];
  kind?: 'line' | 'bar';
  description: string;
  yMax?: number;
  /** Logarithmic y axis for values spanning orders of magnitude. */
  yLog?: boolean;
}) {
  const [ref, width] = useStageWidth<HTMLDivElement>();
  const narrow = width < 560;
  let lo = 0;
  if (yLog) {
    const tf = (v: number) => Math.log10(Math.max(v, 1e-9));
    const raw = series.flatMap((s) => s.points.map((p) => p[1]));
    lo = Math.floor(Math.min(...raw.map(tf)));
    series = series.map((s) => ({ ...s, points: s.points.map(([x, y]) => [x, tf(y) - lo + 0.3] as [number, number]) }));
    marks = marks.map((m) => ({ ...m, y: tf(m.y) - lo + 0.3 }));
  }
  const W = narrow ? 360 : 800;
  const H = narrow ? 260 : 320;
  const L = narrow ? 48 : 64;
  const B = categories ? 52 : 44;
  const all = series.flatMap((s) => s.points);
  const xs = all.map((p) => p[0]);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const rawMax = yMax ?? (yLog ? Math.max(1, ...all.map((p) => p[1])) + 0.6 : Math.max(1, ...all.map((p) => p[1]), ...thresholds.map((t) => t.y)) * 1.08);
  // Round the axis up to a "nice" number (1, 2, 2.5 or 5 × 10^k) so ticks read cleanly.
  const niceStep = (() => {
    if (yLog) return rawMax / 4;
    const rough = rawMax / 4;
    const mag = 10 ** Math.floor(Math.log10(rough));
    const f = rough / mag;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  })();
  const maxY = yLog ? rawMax : Math.ceil(rawMax / niceStep) * niceStep;
  const sx = (v: number) => L + ((W - L - 16) * (v - minX)) / (maxX - minX || 1);
  // The y-axis title sits above the plot, so the top tick never collides with it.
  const TOP = 34;
  const sy = (v: number) => H - B - ((H - B - TOP) * v) / maxY;
  const color = (t?: string) => (t === 'fail' ? 'var(--fail)' : t === 'ok' ? 'var(--ok)' : t === 'active' ? 'var(--active)' : 'var(--accent)');
  const ticks = yLog ? Array.from({ length: Math.ceil(maxY) }, (_, i) => i + 0.3).filter((t) => t <= maxY) : Array.from({ length: Math.round(maxY / niceStep) + 1 }, (_, i) => i * niceStep);
  const fmtLin = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));
  const fmt = (v: number) => {
    if (!yLog) return fmtLin(v);
    const real = 10 ** (v - 0.3 + lo);
    return real >= 1e6 ? `${Math.round(real / 1e5) / 10}M` : real >= 1000 ? `${Math.round(real / 100) / 10}k` : real >= 1 ? String(Math.round(real)) : real.toPrecision(1);
  };
  return (
    <div ref={ref}>
      <svg className="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description} style={{ fontSize: 14 }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - 16} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
            <text x={L - 6} y={sy(t)} dy="0.35em" textAnchor="end" className="edge-label">{fmt(t)}</text>
          </g>
        ))}
        <text x={L - 6} y={14} className="edge-label" style={{ fontWeight: 600 }}>{yLabel}</text>
        <text x={W - 16} y={H - 8} textAnchor="end" className="edge-label">{xLabel}</text>
        {thresholds.map((t) => (
          <g key={t.label}>
            <line x1={L} x2={W - 16} y1={sy(t.y)} y2={sy(t.y)} stroke="var(--fail)" strokeDasharray="6 5" strokeWidth={1.5} />
            <text x={W - 18} y={sy(t.y) - 6} textAnchor="end" style={{ fontSize: 13, fill: 'var(--fail)' }}>{t.label}</text>
          </g>
        ))}
        {series.map((s) =>
          kind === 'bar' ? (
            s.points.map(([px, py], i) => {
              // Bars sit in fixed category slots so a chart with few bars stays proportionate.
              const nCat = categories?.length ?? Math.max(...s.points.map((p) => p[0])) + 1;
              const slot = (W - L - 16) / nCat;
              const bw = Math.min(slot * 0.55, 96);
              const cx = L + slot * (px + 0.5);
              return (
                <g key={`${s.name}-${i}`}>
                  <rect x={cx - bw / 2} y={sy(py)} width={bw} height={Math.max(0, H - B - sy(py))} fill={color(s.tone)} opacity={0.85} rx={3} />
                  <text x={cx} y={H - B + 16} textAnchor="middle" className="edge-label" style={{ fontSize: narrow ? 11 : 13 }}>
                    {wrapLabel(String(categories?.[px] ?? px), narrow ? 9 : 18).map((line, li) => (
                      <tspan key={li} x={cx} dy={li === 0 ? 0 : '1.15em'}>{line}</tspan>
                    ))}
                  </text>
                  <text x={cx} y={sy(py) - 6} textAnchor="middle" style={{ fontSize: narrow ? 11 : 13, fontWeight: 600 }}>{s.name === 'values' ? fmt(py) : ''}</text>
                </g>
              );
            })
          ) : (
            <g key={s.name}>
              <polyline fill="none" stroke={color(s.tone)} strokeWidth={2.5} strokeDasharray={s.dashed ? '6 5' : undefined} points={s.points.map(([px, py]) => `${sx(px)},${sy(py)}`).join(' ')} />
              {series.length > 1 && !narrow && s.points.length > 0 && (
                <text x={sx(s.points[s.points.length - 1][0]) - 4} y={sy(s.points[s.points.length - 1][1]) - 8} textAnchor="end" style={{ fontSize: 13, fill: color(s.tone), fontWeight: 600 }}>{s.name}</text>
              )}
            </g>
          ),
        )}
        {kind === 'line' && [minX, (minX + maxX) / 2, maxX].map((v) => (
          <text key={v} x={sx(v)} y={H - B + 18} textAnchor="middle" className="edge-label">{fmt(v)}</text>
        ))}
        {marks.map((m) => (
          <g key={m.label}>
            <circle cx={sx(m.x)} cy={sy(m.y)} r={6} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} />
            <text x={sx(m.x) + (sx(m.x) > W * 0.6 ? -10 : 10)} y={Math.max(14, sy(m.y) - 10)} textAnchor={sx(m.x) > W * 0.6 ? 'end' : 'start'} style={{ fontSize: narrow ? 12.5 : 13, fontWeight: 700 }} paintOrder="stroke" stroke="var(--surface)" strokeWidth={4}>{m.label}</text>
          </g>
        ))}
      </svg>
      {narrow && series.length > 1 && (
        <ul className="chart-legend">
          {series.map((s) => (
            <li key={s.name}><span className="swatch" style={{ background: color(s.tone), opacity: s.dashed ? 0.6 : 1 }} />{s.name}</li>
          ))}
        </ul>
      )}
      {note && <p className="visual-note">{note}</p>}
    </div>
  );
}

/** Split a label into at most two lines of roughly `max` characters. */
function wrapLabel(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const words = text.split(' ');
  let first = '';
  for (const w of words) {
    if ((first + ' ' + w).trim().length > max && first) break;
    first = (first + ' ' + w).trim();
  }
  return [first, text.slice(first.length).trim()].filter(Boolean);
}

/* ---------------- Compare ---------------- */

export function Compare({
  left,
  right,
  focus = 'both',
}: {
  left: { title: string; body: ReactNode; verdict?: string; tone?: 'ok' | 'fail' | 'plain' };
  right: { title: string; body: ReactNode; verdict?: string; tone?: 'ok' | 'fail' | 'plain' };
  focus?: 'left' | 'right' | 'both';
}) {
  const side = (s: typeof left, which: 'left' | 'right') => (
    <div className={`compare-side ${focus !== 'both' && focus !== which ? 'dim' : ''} ${s.tone ?? ''}`}>
      <h3>{s.title}</h3>
      <div>{s.body}</div>
      {s.verdict && <p className="compare-verdict">{s.tone === 'ok' ? '✓ ' : s.tone === 'fail' ? '✕ ' : ''}{s.verdict}</p>}
    </div>
  );
  return (
    <div className="compare">
      {side(left, 'left')}
      {side(right, 'right')}
    </div>
  );
}
