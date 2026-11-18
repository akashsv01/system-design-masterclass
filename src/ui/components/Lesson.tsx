/**
 * Calm lesson reader primitives (docs/DESIGN.md D2, D4, D7, D10).
 * One column: title → opening → stage → active-step caption → controls → disclosures.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useRecord } from '../../progress/ProgressProvider';
import { useMarkStarted } from '../../progress/activity';
import type { Source } from '../../content/types';

export function LessonShell({
  id,
  crumbs,
  title,
  opening,
  children,
}: {
  id: string;
  crumbs?: ReactNode;
  title: string;
  opening: ReactNode;
  children: ReactNode;
}) {
  useMarkStarted(id);
  return (
    <article className="lesson" aria-labelledby="lesson-title">
      <header className="lesson-head">
        {crumbs && <div className="crumbs">{crumbs}</div>}
        <h1 id="lesson-title">{title}</h1>
        <p className="opening">{opening}</p>
      </header>
      {children}
    </article>
  );
}

/**
 * Current step, persisted per lesson so a learner returns to the exact step.
 * ← / → move between steps; R replays (handled by the caller via onReplay).
 */
export function useStep(lessonId: string, count: number, opts: { onReplay?: () => void; canAdvance?: boolean } = {}) {
  const [stored, setStored] = useRecord<number>(`step:${lessonId}`, 0);
  const step = Math.min(Math.max(stored, 0), count - 1);
  const canAdvance = opts.canAdvance ?? true;
  const go = useCallback((n: number) => setStored(Math.min(Math.max(n, 0), count - 1)), [count, setStored]);
  const replayRef = useRef(opts.onReplay);
  replayRef.current = opts.onReplay;

  // After a step change, bring the stage into view if it is hidden under the header or far above/below.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const stage = document.querySelector<HTMLElement>('.lesson .stage') ?? document.querySelector<HTMLElement>('.lesson .caption');
    if (!stage) return;
    const header = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
    const top = stage.getBoundingClientRect().top;
    if (top < header || top > window.innerHeight * 0.45) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: window.scrollY + top - header - 8, behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"], canvas')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' && canAdvance) go(step + 1);
      else if (e.key === 'ArrowLeft') go(step - 1);
      else if ((e.key === 'r' || e.key === 'R') && replayRef.current) replayRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, step, canAdvance]);

  return { step, go, next: () => go(step + 1), back: () => go(step - 1) };
}

export interface Change {
  kind: 'add' | 'chg' | 'del';
  text: ReactNode;
}

export function Caption({
  kicker,
  title,
  children,
  changes,
}: {
  kicker?: string;
  title: string;
  children: ReactNode;
  changes?: Change[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="caption" ref={ref} aria-live="polite">
      {kicker && <p className="step-kicker">{kicker}</p>}
      <h2>{title}</h2>
      {children}
      {changes && changes.length > 0 && (
        <ul className="changes" aria-label="What changed">
          {changes.map((c, i) => (
            <li key={i} className={c.kind}>
              <span className="sym" aria-hidden="true">
                {c.kind === 'add' ? '+' : c.kind === 'chg' ? '~' : '−'}
              </span>
              <span>
                <span className="visually-hidden">{c.kind === 'add' ? 'Added: ' : c.kind === 'chg' ? 'Changed: ' : 'Removed or failed: '}</span>
                {c.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Controls({
  step,
  count,
  onBack,
  onNext,
  onReplay,
  nextLabel,
  nextDisabled,
  nextHint,
}: {
  step: number;
  count: number;
  onBack: () => void;
  onNext: () => void;
  onReplay?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextHint?: string;
}) {
  const last = step >= count - 1;
  return (
    <nav className="controls" aria-label="Lesson steps">
      <button className="btn" onClick={onBack} disabled={step === 0} aria-label="Previous step">
        ← <span className="replay-label">Back</span>
      </button>
      {onReplay && (
        <button className="btn btn-quiet" onClick={onReplay} aria-label="Replay this step" title="Replay (R)">
          ↻ <span className="replay-label">Replay</span>
        </button>
      )}
      <span className="count" aria-live="polite">
        <span className="count-long">Step {step + 1} of {count}</span>
        <span className="count-short" aria-hidden="true">{step + 1}/{count}</span>
      </span>
      {!last && (
        <button className="btn btn-primary btn-next" onClick={onNext} disabled={nextDisabled} title={nextHint}>
          {nextDisabled && nextHint ? (
            <span className="next-name">{nextHint}</span>
          ) : (
            <span className="next-text">
              <span className="next-k">Next{nextLabel ? ':' : ''}</span>
              {nextLabel && <span className="next-name">{nextLabel}</span>}
            </span>
          )}
          <span aria-hidden="true">→</span>
        </button>
      )}
    </nav>
  );
}

export function More({ summary, children, defaultOpen }: { summary: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="more" open={defaultOpen}>
      <summary>{summary}</summary>
      <div className="more-body">{children}</div>
    </details>
  );
}

export function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <More summary="Sources and further reading">
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {sources.map((s, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : <cite>{s.title}</cite>}
            {s.where && <> — {s.where}</>}
            {s.note && <span className="muted"> · {s.note}</span>}
          </li>
        ))}
      </ul>
      <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>
        Sources point to where the ideas are treated in depth. Examples, numbers and company scenarios in this lesson are
        illustrative unless a source is named next to them.
      </p>
    </More>
  );
}

export interface Choice {
  id: string;
  text: ReactNode;
}

/**
 * One prediction or check question. The answer is saved, so the learner sees
 * their own prediction when they return.
 */
export function Question({
  recordKey,
  prompt,
  choices,
  correct,
  explain,
  onAnswered,
  isPrediction,
}: {
  recordKey: string;
  prompt: ReactNode;
  choices: Choice[];
  /** Omit for an opinion/prediction with no single right answer. */
  correct?: string;
  explain: (picked: string) => ReactNode;
  onAnswered?: (picked: string) => void;
  isPrediction?: boolean;
}) {
  const [saved, setSaved] = useRecord<{ attempts: { picked: string; at: number; correct?: boolean }[] } | null>(`quiz:${recordKey}`, null);
  const picked = saved?.attempts?.[saved.attempts.length - 1]?.picked ?? null;
  const [retrying, setRetrying] = useState(false);
  const show = picked && !retrying;
  const pick = (id: string) => {
    const attempts = [...(saved?.attempts ?? []), { picked: id, at: Date.now(), ...(correct ? { correct: id === correct } : {}) }];
    setSaved({ attempts });
    setRetrying(false);
    onAnswered?.(id);
    if (isPrediction) {
      // The answer usually triggers motion on the stage; make sure the learner can see it.
      setTimeout(() => {
        const stage = document.querySelector<HTMLElement>('.lesson .stage');
        const header = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0;
        if (stage && stage.getBoundingClientRect().top < header) {
          const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          window.scrollTo({ top: window.scrollY + stage.getBoundingClientRect().top - header - 8, behavior: reduce ? 'auto' : 'smooth' });
        }
      }, 50);
    }
  };
  return (
    <div className="question" role="group" aria-label={isPrediction ? 'Prediction' : 'Check your understanding'}>
      <p className="step-kicker" style={{ margin: '0 0 4px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 600 }}>
        {isPrediction ? 'Predict' : 'Check'}
      </p>
      <h3>{prompt}</h3>
      <div className="choices">
        {choices.map((c, i) => {
          const isPicked = show && picked === c.id;
          const cls = show
            ? correct
              ? c.id === correct
                ? 'right'
                : isPicked
                  ? 'wrong'
                  : ''
              : isPicked
                ? 'picked'
                : ''
            : '';
          return (
            <button key={c.id} className={`choice ${cls}`} onClick={() => pick(c.id)} disabled={!!show} aria-pressed={isPicked || undefined}>
              <span className="mark" aria-hidden="true">
                {show && correct && c.id === correct ? '✓' : isPicked && correct ? '✕' : String.fromCharCode(65 + i)}
              </span>
              <span>{c.text}</span>
            </button>
          );
        })}
      </div>
      {show && (
        <div className="feedback">
          {explain(picked!)}
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-small btn-quiet" onClick={() => setRetrying(true)}>
              Answer again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function NextLesson({ to, title, reason }: { to: string; title: string; reason: ReactNode }) {
  return (
    <aside className="next-lesson" aria-label="Recommended next lesson">
      <p className="step-kicker" style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 600 }}>
        Recommended next
      </p>
      <h2>{title}</h2>
      <p>{reason}</p>
      <Link className="btn btn-primary" to={to}>
        Continue to {title} →
      </Link>
    </aside>
  );
}

/** Clock that highlights when its value changes. */
export function Clock({ time }: { time: string }) {
  const [changed, setChanged] = useState(false);
  const prev = useRef(time);
  useEffect(() => {
    if (prev.current !== time) {
      prev.current = time;
      setChanged(true);
      const t = setTimeout(() => setChanged(false), 1200);
      return () => clearTimeout(t);
    }
  }, [time]);
  return (
    <span className={`clock ${changed ? 'changed' : ''}`} aria-label={`Time ${time}`}>
      ⏱ {time}
    </span>
  );
}

export function useReplay(): [number, () => void] {
  const [n, setN] = useState(0);
  return [n, () => setN((x) => x + 1)];
}
