/**
 * Learner draft: an explanation plus an optional freehand sketch.
 * Saved on every change (locally first; synced when signed in). If another device
 * saved a different version, both are kept and the learner chooses.
 */
import { useEffect, useRef, useState } from 'react';
import { useProgress, useRecord, useRecords } from '../../progress/ProgressProvider';

export interface DraftValue {
  text: string;
  strokes: number[][]; // each stroke: [x0,y0,x1,y1,...] in 0..1000 space
  savedAt?: number;
}

const EMPTY: DraftValue = { text: '', strokes: [] };

export function SaveStatus({ savedAt }: { savedAt?: number }) {
  const { user, sync } = useProgress();
  if (!savedAt) return <span>Not saved yet.</span>;
  const when = new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (!user) return <span>Saved on this device at {when}. Sign in to keep it across devices.</span>;
  if (sync.kind === 'saved') return <span>✓ Saved to your account at {when}.</span>;
  if (sync.kind === 'saving') return <span>Saving to your account…</span>;
  if (sync.kind === 'pending') return <span>⧗ Saved on this device; {sync.reason}</span>;
  if (sync.kind === 'error') return <span style={{ color: 'var(--fail)' }}>✕ {sync.message}</span>;
  return <span>Saved at {when}.</span>;
}

export function Sketch({ strokes, onChange, label }: { strokes: number[][]; onChange: (s: number[][]) => void; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<number[] | null>(null);
  const [, force] = useState(0);

  const redraw = () => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== w * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = getComputedStyle(c).color;
    const all = drawing.current ? [...strokes, drawing.current] : strokes;
    for (const s of all) {
      ctx.beginPath();
      for (let i = 0; i < s.length; i += 2) {
        const x = (s[i] / 1000) * w;
        const y = (s[i + 1] / 1000) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      if (s.length === 2) ctx.lineTo((s[0] / 1000) * w + 0.1, (s[1] / 1000) * h);
      ctx.stroke();
    }
  };

  useEffect(redraw);
  useEffect(() => {
    const onResize = () => redraw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  const pt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * 1000), Math.round(((e.clientY - r.top) / r.height) * 1000)];
  };

  return (
    <div>
      <canvas
        ref={ref}
        className="sketch"
        aria-label={label}
        role="img"
        style={{ color: 'var(--ink)' }}
        onPointerDown={(e) => {
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          drawing.current = pt(e);
          force((x) => x + 1);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          drawing.current.push(...pt(e));
          redraw();
        }}
        onPointerUp={() => {
          if (drawing.current) onChange([...strokes, drawing.current]);
          drawing.current = null;
        }}
      />
      <div className="toolbar" style={{ marginTop: 8 }}>
        <button className="btn btn-small" onClick={() => onChange(strokes.slice(0, -1))} disabled={!strokes.length}>
          Undo stroke
        </button>
        <button className="btn btn-small btn-quiet" onClick={() => onChange([])} disabled={!strokes.length}>
          Clear sketch
        </button>
      </div>
    </div>
  );
}

export function DraftEditor({ recordKey, prompt, placeholder, withSketch = true }: { recordKey: string; prompt: string; placeholder?: string; withSketch?: boolean }) {
  const [draft, setDraft] = useRecord<DraftValue>(`draft:${recordKey}`, EMPTY);
  const update = (patch: Partial<DraftValue>) => setDraft({ ...draft, ...patch, savedAt: Date.now() });
  return (
    <div className="question" style={{ background: 'var(--surface)' }}>
      <ConflictNotice baseKey={`draft:${recordKey}`} />
      <label className="field" htmlFor={`draft-${recordKey}`}>
        <span>{prompt}</span>
      </label>
      <textarea
        id={`draft-${recordKey}`}
        value={draft.text}
        placeholder={placeholder}
        onChange={(e) => update({ text: e.target.value })}
      />
      {withSketch && (
        <details className="more" style={{ marginTop: 12 }} open={draft.strokes.length > 0}>
          <summary>Sketch it instead (optional)</summary>
          <div className="more-body" style={{ paddingLeft: 0 }}>
            <Sketch strokes={draft.strokes} onChange={(strokes) => update({ strokes })} label="Your sketch" />
          </div>
        </details>
      )}
      <p className="save-note" role="status">
        <SaveStatus savedAt={draft.savedAt} />
      </p>
    </div>
  );
}

/** Shown when the server kept two versions of the same work. */
export function ConflictNotice({ baseKey }: { baseKey: string }) {
  const { store } = useProgress();
  const copies = useRecords(`${baseKey}@`);
  if (!copies.length) return null;
  return (
    <div className="notice warn" style={{ marginBottom: 12 }}>
      <strong>You have {copies.length + 1} versions of this.</strong> They were edited on different devices or before you
      signed in. Nothing was discarded.
      {copies.map(([key, value]) => (
        <div key={key} style={{ marginTop: 8, padding: 8, background: 'var(--surface)', borderRadius: 8 }}>
          <div className="muted" style={{ fontSize: 13 }}>Other version</div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 15 }}>{(value as DraftValue)?.text || <em>(sketch only)</em>}</div>
          <div className="toolbar" style={{ marginTop: 6, marginBottom: 0 }}>
            <button className="btn btn-small" onClick={() => { store.set(baseKey, value); store.remove(key); }}>
              Use this version
            </button>
            <button className="btn btn-small btn-quiet" onClick={() => store.remove(key)}>
              Keep the current one
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
