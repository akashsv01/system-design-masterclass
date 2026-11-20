/**
 * Lightweight activities (MASTER_PROMPT Amendment 3):
 *  - ShortAnswer: explain a trade-off in one or two sentences, then compare with a model and a checklist.
 *  - LinePick:    "spot the mistake" / "which line explains it?" by selecting a line of a short snippet.
 *  - FillBlank:   complete one expression in an otherwise complete snippet; checked by running Python tests.
 * Objective activities report through progress/evidence: first-try, no-help success is "independent";
 * success after a miss, hint or reveal is "hinted". Short answers are self-assessment and never raise a status.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { recordOutcome, recordSelf, type Evidence } from '../../progress/evidence';
import { Rich } from './Rich';
import { SaveStatus } from './Draft';
import { runPython, type RunResult } from '../../py/runner';

const kicker = (text: string) => (
  <p style={{ margin: '0 0 4px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 600 }}>{text}</p>
);

const ScopeCtx = createContext<{ required?: string[] }>({});

/** Declares which objective activities must all be solved for the topic to count as solved (brief §10). */
export function EvidenceScope({ required, children }: { required: string[]; children: ReactNode }) {
  return <ScopeCtx.Provider value={{ required }}>{children}</ScopeCtx.Provider>;
}

export function useOutcome(lessonId: string) {
  const { store } = useProgress();
  const { required } = useContext(ScopeCtx);
  return (activityId: string, solved: boolean, helped: boolean, gap?: string) =>
    recordOutcome(store, lessonId, activityId, !solved ? 'missed' : helped ? 'hinted' : 'independent', { required, gap });
}

/** The current revision round for a topic; record keys get a round suffix so revision shows fresh copies. */
export function useRoundKey(topicId: string, base: string): string {
  const [ev] = useRecord<Evidence | null>(`evidence:${topicId}`, null);
  const r = ev?.round ?? 0;
  return r > 0 ? `${base}:r${r}` : base;
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
  const { store } = useProgress();
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
            {!st.model ? (
        <div className="toolbar" style={{ marginTop: 8, marginBottom: 0 }}>
          <button className="btn btn-primary btn-small" disabled={!st.text.trim()} onClick={() => set({ model: true })}>Compare with a model answer</button>
          {spec.hint && <HintToggle text={spec.hint} used={st.hint} onUse={() => set({ hint: true })} />}
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
              set({ done: true });
              // Self-assessment: kept apart from verified evidence. Points you say you missed go to the notebook.
              recordSelf(store, lessonId, { checklist: { [spec.id]: spec.checklist.map((_, i) => !!st.checked[i]) } });
              const missed = spec.checklist.filter((_, i) => !st.checked[i]);
              if (missed.length) store.set(`mistake:${lessonId}:${spec.id}`, { lessonId, activityId: spec.id, text: `You said your answer missed: ${missed.join(' ')}`, self: true, at: Date.now(), resolved: false });
            }}>Save my self-check</button>
            {st.done && <span className="pill">Saved as self-assessment</span>}
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
  const key = useRoundKey(lessonId, `quiz:${lessonId}:${spec.id}`);
  const [st, setSt] = useRecord<{ attempts: { picked: string; at: number; correct: boolean }[]; hint?: boolean } | null>(key, null);
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
      {!show && spec.hint && (<HintToggle text={spec.hint} used={!!st?.hint} onUse={() => setSt({ attempts: st?.attempts ?? [], hint: true })} />
      )}
      {show && (
        <div className="feedback" role="status">
          {correct ? <p><strong>Yes — line {pickedLine}.</strong> <Rich text={spec.explain} /></p> : (
            <p><strong>Not line {pickedLine}.</strong> <Rich text={spec.wrong?.[pickedLine!] ?? 'Look again at which line makes the decision.'} /></p>
          )}
          {!correct && <button className="btn btn-small" onClick={() => setRetry(true)}>Try another line</button>}

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
  const key = useRoundKey(lessonId, `draft:blank:${lessonId}:${spec.id}`);
  const [st, setSt] = useRecord<{ value: string; hint: boolean; revealed: boolean; passed?: boolean; tries: number; savedAt?: number }>(key, { value: '', hint: false, revealed: false, tries: 0 });
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
    else record(spec.id, false, st.hint, spec.prompt);
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
        {spec.hint && <HintToggle text={spec.hint} used={st.hint} onUse={() => setSt({ ...st, hint: true })} />}
        {!st.revealed && st.tries > 0 && !st.passed && <button className="btn btn-small btn-quiet" onClick={() => setSt({ ...st, revealed: true })}>Show the answer</button>}
      </div>
      {running && st.tries === 0 && <p className="muted" style={{ fontSize: 14 }}>The first run loads Python into your browser (about 12 MB, then cached). Nothing is sent to a server.</p>}
      {res && (
        <div className={`notice ${st.passed ? '' : 'warn'}`} style={{ marginTop: 10 }} role="status">
          {res.error && <p style={{ margin: 0 }}>{res.error}</p>}
          {st.passed && <p style={{ margin: 0 }}><strong>All {res.results.length} checks pass.</strong> <Rich text={spec.explain} /></p>}
          {!st.passed && !res.error && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15 }}>
              {res.results.map((r) => (
                <li key={r.name}>
                  {r.outcome === 'passed' ? 'Pass:' : 'Fail:'} <code>{r.name.replace(/^test_/, '').replace(/_/g, ' ')}</code>
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

/** A hint the learner can open and close again. Opening it the first time is recorded (it counts as help). */
function HintToggle({ text, used, onUse }: { text: string; used: boolean; onUse: () => void }) {
  const [open, setOpen] = useState(used);
  return (
    <div className="hint-toggle">
      <button className="btn btn-small btn-quiet" aria-expanded={open} onClick={() => { if (!used) onUse(); setOpen(!open); }}>{open ? 'Hide hint' : used ? 'Show the hint again' : 'Show a hint'}</button>
      {open && <div className="callout"><strong>Hint</strong><Rich text={text} /></div>}
    </div>
  );
}
