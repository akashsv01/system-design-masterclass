/**
 * Calm lesson reader primitives (docs/DESIGN.md D2, D4, D7, D10, D12–D18).
 * One column: title → opening → stage → active-step caption → controls → disclosures.
 *
 * Navigation rules:
 *  - `reachable` is the furthest step the learner may open. A step that needs an answer or an action
 *    holds `reachable` at itself until it is done. Next, → and the step list all respect it.
 *  - Each moment has one primary action. When a step needs an action (Reserve, Next event), the control
 *    row's primary button performs it; once its outcome is visible the button becomes "Next: <step>".
 *  - Rapid clicks on the primary button are ignored for a short lock period, so an event can't be
 *    duplicated or skipped faster than it animates.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { useMarkStarted } from '../../progress/activity';
import type { Source } from '../../content/types';
import { Icon } from './Icon';

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

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Keep the stage and its caption visible together (D12): scroll only if the stage is under the header or the
 * caption is under the sticky controls. Called after step changes and after a step's action changes the caption.
 */
export function keepInView() {
  const stage = document.querySelector<HTMLElement>('.lesson .stage') ?? document.querySelector<HTMLElement>('.lesson .caption');
  if (!stage) return;
  // Reserve the header's full height even if it is currently tucked away: it reappears on upward scrolls.
  const header = document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 0;
  const controlsH = document.querySelector<HTMLElement>('.lesson .controls')?.offsetHeight ?? 0;
  const top = stage.getBoundingClientRect().top;
  const caption = document.querySelector<HTMLElement>('.lesson .caption');
  const capBottom = caption ? caption.getBoundingClientRect().bottom : top;
  const visibleBottom = window.innerHeight - controlsH - 8;
  let delta = 0;
  if (top < header + 4) delta = top - header - 12; // stage hidden under the header
  else if (capBottom > visibleBottom) delta = Math.min(top - header - 12, capBottom - visibleBottom); // caption under the controls
  if (Math.abs(delta) > 4) window.scrollTo({ top: window.scrollY + delta, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/**
 * Current step, persisted per lesson so a learner returns to the exact step.
 * ← / → move between steps (→ never past `reachable`); R replays (handled by the caller via onReplay).
 */
export function useStep(lessonId: string, count: number, opts: { onReplay?: () => void; reachable?: number } = {}) {
  const [stored, setStored] = useRecord<number>(`step:${lessonId}`, 0);
  const reachable = Math.min(count - 1, Math.max(0, opts.reachable ?? count - 1));
  const step = Math.min(Math.max(stored, 0), count - 1);
  const go = useCallback(
    (n: number) => setStored(Math.min(Math.max(n, 0), count - 1, Math.max(reachable, step))),
    [count, setStored, reachable, step],
  );
  const replayRef = useRef(opts.onReplay);
  replayRef.current = opts.onReplay;

  // After a step change, keep the stage and its caption in view together (D12).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    keepInView();
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"], canvas')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' && step < reachable) go(step + 1);
      else if (e.key === 'ArrowLeft') go(step - 1);
      else if ((e.key === 'r' || e.key === 'R') && replayRef.current) replayRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, step, reachable]);

  return { step, go, reachable, next: () => go(step + 1), back: () => go(step - 1) };
}

export interface Change {
  kind: 'add' | 'chg' | 'del';
  text: ReactNode;
  /** For a changed value: what it was and what it is now (D13). */
  from?: ReactNode;
  to?: ReactNode;
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
  return (
    <div className="caption" aria-live="polite">
      {kicker && <p className="step-kicker">{kicker}</p>}
      <h2>{title}</h2>
      {children}
      {changes && changes.length > 0 && <ChangeList changes={changes} />}
    </div>
  );
}

export function ChangeList({ changes }: { changes: Change[] }) {
  return (
    <ul className="changes" aria-label="What changed">
      {changes.map((c, i) => (
        <li key={i} className={c.kind}>
          <span className="sym" aria-hidden="true">
            {c.kind === 'add' ? '+' : c.kind === 'chg' ? '~' : '−'}
          </span>
          <span>
            <span className="visually-hidden">{c.kind === 'add' ? 'Added: ' : c.kind === 'chg' ? 'Changed: ' : 'Removed or failed: '}</span>
            {c.text}
            {c.from !== undefined && c.to !== undefined && (
              <>
                {c.text ? ': ' : ''}
                <span className="from">{c.from}</span> <span aria-hidden="true">→</span><span className="visually-hidden"> became </span> <span className="to">{c.to}</span>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface PrimaryAction {
  label: string;
  onClick: () => void;
  /** Minimum time between two accepted clicks of the same action family (ms), so its animation can play. Defaults to 450. */
  lockMs?: number;
  /** Actions in one family share the lock (e.g. "Start the race" and "Next event"). Defaults to the label's first word. */
  family?: string;
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
  action,
  steps,
  reachable,
  onJump,
}: {
  step: number;
  count: number;
  onBack: () => void;
  onNext: () => void;
  onReplay?: () => void;
  nextLabel?: string;
  /** True when the step still needs the learner's input. The reason belongs beside that input; `nextHint` repeats it here. */
  nextDisabled?: boolean;
  nextHint?: string;
  /** When set, the primary button performs this action instead of moving to the next step (D15). */
  action?: PrimaryAction;
  /** Step titles, for the "Steps" list. */
  steps?: string[];
  reachable?: number;
  onJump?: (n: number) => void;
}) {
  const last = step >= count - 1;
  const lastClick = useRef(0);
  const [open, setOpen] = useState(false);
  const { store } = useProgress();
  useEffect(() => setOpen(false), [step]);
  // Remember the exact step for "Continue" on the home page. Runs after LessonShell has recorded which activity this is.
  const stepTitle = steps?.[step];
  useEffect(() => {
    const t = setTimeout(() => {
      const cur = store.get<{ id: string; at: number; step?: number; stepTitle?: string; count?: number }>('pref:last-activity');
      if (cur && (cur.step !== step || cur.stepTitle !== stepTitle || cur.count !== count)) store.set('pref:last-activity', { ...cur, step, count, stepTitle });
    }, 0);
    return () => clearTimeout(t);
  }, [step, count, stepTitle, store]);
  // Repeating the same action waits for its animation (ms); a different button only needs a double-click guard,
  // so a deliberate click is never silently ignored.
  const lastLabel = useRef('');
  const guarded = (fn: () => void, ms: number, label: string) => () => {
    const now = Date.now();
    const wait = label === lastLabel.current ? ms : 300;
    if (now - lastClick.current < (prefersReducedMotion() ? Math.min(wait, 150) : wait)) return;
    lastClick.current = now;
    lastLabel.current = label;
    fn();
  };
  const reach = reachable ?? count - 1;
  return (
    <>
      <nav className="controls" aria-label="Lesson steps">
        <button className="btn" onClick={onBack} disabled={step === 0} aria-label="Previous step">
          <Icon name="arrow-left" /> <span className="replay-label">Back</span>
        </button>
        {onReplay && (
          <button className="btn btn-quiet" onClick={onReplay} aria-label="Replay this step" title="Replay this step (R)">
            <Icon name="replay" /> <span className="replay-label">Replay</span>
          </button>
        )}
        <span className="count">
          {steps && onJump ? (
            <button className="steps-toggle" aria-expanded={open} aria-controls="steps-list" onClick={() => setOpen(!open)} title="Show all steps">
              <span className="count-long">Step {step + 1} of {count}</span>
              <span className="count-short" aria-hidden="true">{step + 1}/{count}</span>
              <Icon name="chevron-down" size={14} />
            </button>
          ) : (
            <span aria-live="polite">
              <span className="count-long">Step {step + 1} of {count}</span>
              <span className="count-short" aria-hidden="true">{step + 1}/{count}</span>
            </span>
          )}
        </span>
        {action ? (
          <button className="btn btn-primary btn-next is-action" onClick={guarded(() => { action.onClick(); setTimeout(keepInView, 80); }, action.lockMs ?? 450, action.family ?? action.label.split(' ')[0])}>
            <span className="next-text"><span className="next-name">{action.label}</span></span>
            <Icon name="play" size={14} />
          </button>
        ) : !last ? (
          <button
            className="btn btn-primary btn-next"
            onClick={guarded(onNext, 250, 'next')}
            disabled={nextDisabled}
            title={nextDisabled ? nextHint : undefined}
            aria-describedby={nextDisabled ? 'gate-reason' : undefined}
          >
            <span className="next-text">
              <span className="next-k">Next{nextLabel ? ':' : ''}</span>
              {nextLabel && <span className="next-name">{nextLabel}</span>}
            </span>
            {nextDisabled ? <Icon name="lock" size={16} /> : <Icon name="arrow-right" />}
          </button>
        ) : null}
        {nextDisabled && nextHint && !action && <span id="gate-reason" className="visually-hidden">{nextHint}</span>}
        {/* A stable live region: captions remount per step (for their entrance), so the step change is announced here. */}
        <span className="visually-hidden" aria-live="polite" aria-atomic="true">Step {step + 1} of {count}{stepTitle ? `: ${stepTitle}` : ''}</span>
      </nav>
      {open && steps && onJump && (
        <ol className="steps-list enter" id="steps-list" aria-label="All steps">
          {steps.map((s, i) => (
            <li key={i}>
              <button aria-current={i === step ? 'step' : undefined} disabled={i > Math.max(reach, step)} onClick={() => onJump(i)}>
                <span className="n">{String(i + 1).padStart(2, '0')}</span>
                <span>{s}</span>
                {i > Math.max(reach, step) ? <Icon name="lock" size={14} /> : i < step ? <Icon name="check" size={14} /> : <span />}
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
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
            {s.checked ? <span className="pill ok" style={{ marginLeft: 6 }}>checked against the source</span> : null}
          </li>
        ))}
      </ul>
      <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>
        Sources point to where the ideas are treated in depth. Numbers in the visuals are illustrative unless a source is named next to them.
        Items marked “checked against the source” were read for this lesson; the rest identify where the topic is covered.
      </p>
    </More>
  );
}

export interface Choice {
  id: string;
  text: ReactNode;
}

/**
 * One prediction or check question. The answer is saved, so the learner sees their own prediction when they return.
 * A graded question records whether the *first* attempt was right; later attempts can't upgrade it (see progress/evidence).
 */
export function Question({
  recordKey,
  prompt,
  choices,
  correct,
  explain,
  onAnswered,
  isPrediction,
  required,
  kicker,
}: {
  recordKey: string;
  prompt: ReactNode;
  choices: Choice[];
  /** Omit for an opinion/prediction with no single right answer. */
  correct?: string;
  explain: (picked: string) => ReactNode;
  onAnswered?: (picked: string, attempt: number) => void;
  isPrediction?: boolean;
  /** Shows that answering is what unlocks the next step (the reason sits beside the input, not only on the button). */
  required?: boolean;
  kicker?: string;
}) {
  const [saved, setSaved] = useRecord<{ attempts: { picked: string; at: number; correct?: boolean }[] } | null>(`quiz:${recordKey}`, null);
  const picked = saved?.attempts?.[saved.attempts.length - 1]?.picked ?? null;
  const [retrying, setRetrying] = useState(false);
  const show = picked && !retrying;
  const answeredAt = useRef(0);
  const pick = (id: string) => {
    if (Date.now() - answeredAt.current < 300) return; // a double tap must not record two attempts
    answeredAt.current = Date.now();
    const attempts = [...(saved?.attempts ?? []), { picked: id, at: Date.now(), ...(correct ? { correct: id === correct } : {}) }];
    setSaved({ attempts });
    setRetrying(false);
    onAnswered?.(id, attempts.length);
    if (isPrediction) {
      // The answer usually triggers motion on the stage; make sure the learner can see it.
      setTimeout(() => {
        const stage = document.querySelector<HTMLElement>('.lesson .stage');
        const header = document.querySelector<HTMLElement>('.site-header')?.offsetHeight ?? 0;
        if (stage && stage.getBoundingClientRect().top < header) {
          window.scrollTo({ top: window.scrollY + stage.getBoundingClientRect().top - header - 8, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        }
      }, 50);
    }
  };
  const firstRight = saved?.attempts?.[0]?.correct;
  return (
    <div className="question" role="group" aria-label={isPrediction ? 'Prediction' : 'Check your understanding'}>
      <div className="q-head">
        <p className="step-kicker">{kicker ?? (isPrediction ? 'Predict' : 'Check')}</p>
        {required && !picked && (
          <span className="required"><Icon name="lock" size={13} /> Answer to continue</span>
        )}
      </div>
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
                  : 'faded'
              : isPicked
                ? 'picked'
                : 'faded'
            : '';
          return (
            <button key={c.id} className={`choice ${cls}`} onClick={() => pick(c.id)} disabled={!!show} aria-pressed={isPicked || undefined}>
              <span className="mark" aria-hidden="true">
                {show && correct && c.id === correct ? <Icon name="check" size={14} strokeWidth={2.6} /> : isPicked && correct ? <Icon name="x" size={14} strokeWidth={2.6} /> : String.fromCharCode(65 + i)}
              </span>
              <span>{c.text}</span>
            </button>
          );
        })}
      </div>
      {show && (
        <div className="feedback enter">
          {correct && (
            <p className={`verdict ${picked === correct ? 'ok' : 'fail'}`}>
              <Icon name={picked === correct ? 'check' : 'x'} size={16} strokeWidth={2.4} />
              {picked === correct ? 'Right.' : 'Not this one.'}
            </p>
          )}
          {explain(picked!)}
          {correct && saved && saved.attempts.length > 1 && firstRight === false && (
            <p className="muted small">Your first answer was recorded as a miss, so this one counts as solved with help.</p>
          )}
          {correct && picked !== correct && (
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-small btn-quiet" onClick={() => setRetrying(true)}>
                <Icon name="replay" size={15} /> Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function NextLesson({ to, title, reason, consequence }: { to: string; title: string; reason: ReactNode; consequence?: ReactNode }) {
  return (
    <aside className="next-lesson enter" aria-label="Recommended next">
      <p className="step-kicker">Recommended next</p>
      {consequence && <p className="consequence">{consequence}</p>}
      <h2>{title}</h2>
      <p>{reason}</p>
      <Link className="btn btn-primary" to={to}>
        Continue <Icon name="arrow-right" />
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
      <Icon name="clock" size={15} /> {time}
    </span>
  );
}

/** Named values above a visual (D14). The changed one is marked with a rule and the word "changed". */
export function Metrics({ items }: { items: { name: string; value: ReactNode; changed?: boolean; tone?: 'good' | 'bad' }[] }) {
  return (
    <ul className="metrics" aria-label="Current values">
      {items.map((m) => (
        <li key={m.name} className={`${m.changed ? 'changed' : ''} ${m.tone ?? ''}`}>
          <span className="m-name">{m.name}</span>
          <span className="m-value">{m.value}</span>
          {m.changed && <span className="m-note">changed</span>}
        </li>
      ))}
    </ul>
  );
}

export function useReplay(): [number, () => void] {
  const [n, setN] = useState(0);
  return [n, () => setN((x) => x + 1)];
}
