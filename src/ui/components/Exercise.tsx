/**
 * Lightweight activities (MASTER_PROMPT Amendment 3):
 *  - ShortAnswer: explain a trade-off in one or two sentences, then compare with a model and a checklist.
 *  - LinePick:    "spot the mistake" / "which line explains it?" by selecting a line of a short snippet.
 *  - FillBlank:   complete one expression in an otherwise complete snippet; checked by running Python tests.
 * Each records "independent" when solved without hints or reveals, otherwise "hinted".
 */
import { useState } from 'react';
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { raiseStatus } from '../../progress/activity';
import { Rich } from './Rich';
import { SaveStatus } from './Draft';
import { runPython, type RunResult } from '../../py/runner';

const kicker = (text: string) => (
  <p style={{ margin: '0 0 4px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 600 }}>{text}</p>
);

function useOutcome(lessonId: string) {
  const { store } = useProgress();
  return (activityId: string, solved: boolean, helped: boolean, gap?: string) => {
    if (solved) raiseStatus(store, lessonId, helped ? 'hinted' : 'independent');
    if (!solved || helped) {
      store.set(`mistake:${lessonId}:${activityId}`, { lessonId, activityId, text: gap ?? '', at: Date.now(), resolved: false });
    } else if (store.get(`mistake:${lessonId}:${activityId}`)) {
      store.set(`mistake:${lessonId}:${activityId}`, { ...(store.get(`mistake:${lessonId}:${activityId}`) as object), resolved: true });
    }
    const prev = store.get<{ reps: number }>(`review:${lessonId}`);
    const reps = solved && !helped ? (prev?.reps ?? 0) + 1 : 0;
    // Spaced revision: 1, 3, 7, 16, 35 days.
    const days = [1, 3, 7, 16, 35][Math.min(reps, 4)];
    store.set(`review:${lessonId}`, { lessonId, reps, due: Date.now() + days * 86400_000, last: Date.now() });
  };
}

/* ---------------- Short answer ---------------- */

export interface ShortAnswerSpec {
  id: string;
  prompt: string;
  hint?: string;
  /** Two or three points a good answer covers. */
  checklist: string[];
  model: string;
}

interface SAState { text: string; hint: boolean; model: boolean; checked: boolean[]; done?: boolean; savedAt?: number }

export function ShortAnswer({ lessonId, spec }: { lessonId: string; spec: ShortAnswerSpec }) {
  const record = useOutcome(lessonId);
  const [st, setSt] = useRecord<SAState>(`draft:sa:${lessonId}:${spec.id}`, { text: '', hint: false, model: false, checked: [] });
  const set = (p: Partial<SAState>) => setSt({ ...st, ...p, savedAt: Date.now() });
  const long = st.text.length > 400;
  return (
    <section className="question" style={{ background: 'var(--surface)' }} aria-label="Explain">
      {kicker('Explain in one or two sentences')}
      <h3><Rich text={spec.prompt} /></h3>
      <label className="visually-hidden" htmlFor={`sa-${spec.id}`}>Your answer</label>
      <textarea id={`sa-${spec.id}`} value={st.text} rows={3} style={{ minHeight: 84 }} onChange={(e) => set({ text: e.target.value })} placeholder="One or two sentences." />
      <p className="save-note">
        <SaveStatus savedAt={st.savedAt} />
        {long && <span>· That’s more than two sentences’ worth. Try saying it shorter.</span>}
      </p>
      {st.hint && spec.hint && <div className="callout"><strong>Hint</strong><Rich text={spec.hint} /></div>}
      {!st.model ? (
        <div className="toolbar" style={{ marginTop: 8, marginBottom: 0 }}>
          <button className="btn btn-primary btn-small" disabled={!st.text.trim()} onClick={() => set({ model: true })}>Compare with a model answer</button>
          {spec.hint && !st.hint && <button className="btn btn-small btn-quiet" onClick={() => set({ hint: true })}>Show a hint</button>}
        </div>
      ) : (
        <>
          <div className="callout" style={{ marginTop: 12 }}><strong>Model answer</strong><Rich text={spec.model} /></div>
          <p style={{ margin: '8px 0 6px', fontWeight: 600, fontSize: 15 }}>Did your answer…</p>
          {spec.checklist.map((c, i) => (
            <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 15, marginBottom: 6 }}>
              <input type="checkbox" checked={!!st.checked[i]} onChange={(e) => { const c2 = [...st.checked]; c2[i] = e.target.checked; set({ checked: c2 }); }} style={{ marginTop: 4 }} />
              <span><Rich text={c} /></span>
            </label>
          ))}
          <div className="toolbar" style={{ marginTop: 6, marginBottom: 0 }}>
            <button className="btn btn-small" onClick={() => {
              const all = spec.checklist.every((_, i) => st.checked[i]);
              set({ done: true });
              record(spec.id, all, st.hint, spec.checklist.filter((_, i) => !st.checked[i]).join(' '));
            }}>Save my self-check</button>
            {st.done && <span className="pill ok">Saved</span>}
          </div>
        </>
      )}
    </section>
  );
}

/* ---------------- Snippet with selectable lines ---------------- */

export function Snippet({
  code,
  highlight = [],
  pickable,
  picked,
  onPick,
  marks = {},
  caption,
}: {
  code: string;
  highlight?: number[];
  pickable?: boolean;
  picked?: number | null;
  onPick?: (line: number) => void;
  marks?: Record<number, 'right' | 'wrong'>;
  caption?: string;
}) {
  const lines = code.replace(/\n$/, '').split('\n');
  return (
    <figure style={{ margin: '0 0 4px', minWidth: 0 }}>
      <div className="snippet" role={pickable ? 'listbox' : undefined} aria-label={pickable ? 'Choose a line' : caption ?? 'Python code'}>
        {lines.map((l, i) => {
          const n = i + 1;
          const mark = marks[n];
          const cls = ['snip-line', highlight.includes(n) ? 'hl' : '', picked === n ? 'picked' : '', mark ?? ''].join(' ');
          const content = (
            <>
              <span className="ln" aria-hidden="true">{n}</span>
              <code>{l || ' '}</code>
              {mark && <span className="snip-mark" aria-hidden="true">{mark === 'right' ? '✓' : '✕'}</span>}
            </>
          );
          return pickable && l.trim() ? (
            <button key={i} className={cls} role="option" aria-selected={picked === n} onClick={() => onPick?.(n)} aria-label={`Line ${n}: ${l.trim()}`}>
              {content}
            </button>
          ) : (
            <div key={i} className={cls}>{content}</div>
          );
        })}
      </div>
      {caption && <figcaption className="muted" style={{ fontSize: 13, marginTop: 4 }}>{caption}</figcaption>}
    </figure>
  );
}

export interface LinePickSpec {
  id: string;
  prompt: string;
  code: string;
  /** Correct line numbers (1-based). Any of them counts. */
  answer: number[];
  explain: string;
  /** Optional feedback for specific wrong lines. */
  wrong?: Record<number, string>;
  hint?: string;
  highlight?: number[];
}

export function LinePick({ lessonId, spec, kickerText = 'Spot it' }: { lessonId: string; spec: LinePickSpec; kickerText?: string }) {
  const record = useOutcome(lessonId);
  const [st, setSt] = useRecord<{ attempts: { picked: string; at: number; correct: boolean }[]; hint?: boolean } | null>(`quiz:${lessonId}:${spec.id}`, null);
  const last = st?.attempts?.[st.attempts.length - 1];
  const pickedLine = last ? Number(last.picked) : null;
  const correct = last?.correct;
  const [retry, setRetry] = useState(false);
  const show = last && !retry;
  const pick = (n: number) => {
    const ok = spec.answer.includes(n);
    const attempts = [...(st?.attempts ?? []), { picked: String(n), at: Date.now(), correct: ok }];
    setSt({ attempts, hint: st?.hint });
    setRetry(false);
    if (ok) record(spec.id, true, attempts.length > 1 || !!st?.hint);
    else record(spec.id, false, !!st?.hint, spec.prompt);
  };
  return (
    <section className="question" aria-label="Choose a line">
      {kicker(kickerText)}
      <h3><Rich text={spec.prompt} /></h3>
      <Snippet
        code={spec.code}
        highlight={spec.highlight}
        pickable={!show}
        picked={show ? pickedLine : null}
        onPick={pick}
        marks={show && pickedLine ? { [pickedLine]: correct ? 'right' : 'wrong', ...(correct ? {} : {}) } : {}}
      />
      {!show && spec.hint && (st?.hint ? <div className="callout"><strong>Hint</strong><Rich text={spec.hint} /></div> : (
        <button className="btn btn-small btn-quiet" onClick={() => setSt({ attempts: st?.attempts ?? [], hint: true })}>Show a hint</button>
      ))}
      {show && (
        <div className="feedback" role="status">
          {correct ? <p><strong>Yes — line {pickedLine}.</strong> <Rich text={spec.explain} /></p> : (
            <p><strong>Not line {pickedLine}.</strong> <Rich text={spec.wrong?.[pickedLine!] ?? 'Look again at which line makes the decision.'} /></p>
          )}
          {!correct && <button className="btn btn-small" onClick={() => setRetry(true)}>Try another line</button>}
          {correct && <button className="btn btn-small btn-quiet" onClick={() => setRetry(true)}>Answer again</button>}
        </div>
      )}
    </section>
  );
}

/* ---------------- Fill one blank ---------------- */

export interface FillBlankSpec {
  id: string;
  prompt: string;
  /** Snippet containing exactly one "____". */
  code: string;
  /** pytest-style checks that import `blank`. */
  checks: string;
  /** Extra modules the checks import, e.g. { 'sdm/booking.py': source }. */
  support?: Record<string, string>;
  answer: string;
  hint?: string;
  explain: string;
}

export function FillBlank({ lessonId, spec }: { lessonId: string; spec: FillBlankSpec }) {
  const record = useOutcome(lessonId);
  const [st, setSt] = useRecord<{ value: string; hint: boolean; revealed: boolean; passed?: boolean; tries: number; savedAt?: number }>(`draft:blank:${lessonId}:${spec.id}`, { value: '', hint: false, revealed: false, tries: 0 });
  const [running, setRunning] = useState(false);
  const [res, setRes] = useState<RunResult | null>(null);
  const [before, after] = spec.code.split('____');
  const lineNo = before.split('\n').length;
  const lines = spec.code.split('\n');
  const run = async () => {
    setRunning(true);
    const filled = spec.code.replace('____', st.value.trim() || 'None');
    const r = await runPython({ 'blank.py': filled, 'tests/test_check.py': spec.checks, ...(spec.support ?? {}) }, ['tests/test_check.py']);
    setRes(r);
    setRunning(false);
    const passed = r.ok && r.results.length > 0 && r.results.every((x) => x.outcome === 'passed');
    const tries = st.tries + 1;
    setSt({ ...st, passed, tries, savedAt: Date.now() });
    if (passed) record(spec.id, true, st.hint || st.revealed || tries > 1);
    else if (tries === 1) record(spec.id, false, st.hint, spec.prompt);
  };
  void after;
  return (
    <section className="question" aria-label="Fill the blank">
      {kicker('Fill the blank')}
      <h3><Rich text={spec.prompt} /></h3>
      <div className="snippet" aria-label="Python code with one blank">
        {lines.map((l, i) => {
          const n = i + 1;
          if (n !== lineNo) return <div key={i} className="snip-line"><span className="ln" aria-hidden="true">{n}</span><code>{l || ' '}</code></div>;
          const [pre, post] = l.split('____');
          return (
            <div key={i} className="snip-line hl">
              <span className="ln" aria-hidden="true">{n}</span>
              <code style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ whiteSpace: 'pre' }}>{pre}</span>
                <input
                  aria-label="Missing expression"
                  className="blank-input"
                  value={st.value}
                  spellCheck={false}
                  autoCapitalize="off"
                  onChange={(e) => setSt({ ...st, value: e.target.value, passed: undefined, savedAt: Date.now() })}
                  onKeyDown={(e) => { if (e.key === 'Enter') void run(); }}
                  size={Math.max(12, st.value.length + 2)}
                />
                <span style={{ whiteSpace: 'pre' }}>{post}</span>
              </code>
            </div>
          );
        })}
      </div>
      <div className="toolbar" style={{ marginTop: 10, marginBottom: 0 }}>
        <button className="btn btn-primary btn-small" onClick={run} disabled={running || !st.value.trim()}>{running ? 'Running Python…' : 'Run the checks'}</button>
        {spec.hint && !st.hint && <button className="btn btn-small btn-quiet" onClick={() => setSt({ ...st, hint: true })}>Show a hint</button>}
        {!st.revealed && st.tries > 0 && !st.passed && <button className="btn btn-small btn-quiet" onClick={() => setSt({ ...st, revealed: true })}>Show the answer</button>}
      </div>
      {running && st.tries === 0 && <p className="muted" style={{ fontSize: 14 }}>The first run loads Python into your browser (about 12 MB, then cached). Nothing is sent to a server.</p>}
      {st.hint && spec.hint && <div className="callout"><strong>Hint</strong><Rich text={spec.hint} /></div>}
      {res && (
        <div className={`notice ${st.passed ? '' : 'warn'}`} style={{ marginTop: 10 }} role="status">
          {res.error && <p style={{ margin: 0 }}>{res.error}</p>}
          {st.passed && <p style={{ margin: 0 }}><strong>All {res.results.length} checks pass.</strong> <Rich text={spec.explain} /></p>}
          {!st.passed && !res.error && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15 }}>
              {res.results.map((r) => (
                <li key={r.name}>
                  {r.outcome === 'passed' ? '✓' : '✕'} <code>{r.name.replace(/^test_/, '').replace(/_/g, ' ')}</code>
                  {r.outcome !== 'passed' && <div className="muted" style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{r.message}</div>}
                </li>
              ))}
            </ul>
          )}
          {res.stdout && <pre className="code" style={{ marginTop: 8, marginBottom: 0 }}>{res.stdout}</pre>}
        </div>
      )}
      {st.revealed && <div className="callout"><strong>Answer</strong><code>{spec.answer}</code> — <Rich text={spec.explain} /></div>}
      {st.savedAt && <p className="save-note"><SaveStatus savedAt={st.savedAt} /></p>}
    </section>
  );
}
