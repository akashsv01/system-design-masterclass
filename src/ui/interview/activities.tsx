/**
 * The main interaction of each stage (interview brief §5): one activity, one question. Every activity reads and
 * writes the saved session, so switching tabs, opening help or resuming later keeps the learner’s work.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Activity, InterviewScript, PaletteItem, Stage } from '../../content/interview/types';
import { find, shortestPath, type DesignGraph, type Sel } from '../../sim/interview/graph';
import { checkRoles, machineFrom, planQuery, planTrace, runQueue, runScenario, runTimeline, traceRequest, RULES, validOrder, type Guard, type KeyChoice, type Policy, type TLOp } from '../../sim/interview/sims';
import { Builder, type Mark } from './Builder';
import { usePlayer } from './player';
import type { SessionV2 } from './record';
import { Icon } from '../components/Icon';
import { Rich } from '../components/Rich';

export interface DesignApi { graph: DesignGraph; commit: (g: DesignGraph, say: string) => void; undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }
export interface ActProps {
  script: InterviewScript;
  stage: Stage;
  s: SessionV2;
  update: (f: (s: SessionV2) => SessionV2) => void;
  design: DesignApi;
  states: DesignApi;
  onEdited: (say: string) => void;
  guided: boolean;
  /** The interviewer speaks (appends to the conversation). */
  say: (text: string) => void;
}

type A<K extends Activity['kind']> = Extract<Activity, { kind: K }>;

export function useWork<T extends Record<string, unknown>>(p: ActProps, init: T): [T, (patch: Partial<T>) => void] {
  const w = { ...init, ...(p.s.work[p.stage.id] as Partial<T> | undefined) } as T;
  return [w, (patch) => p.update((s) => ({ ...s, work: { ...s.work, [p.stage.id]: { ...(s.work[p.stage.id] ?? {}), ...patch } } }))];
}
export const setResult = (p: ActProps, key: string, value: string) => p.update((s) => (s.results[key] === value ? s : { ...s, results: { ...s.results, [key]: value }, first: s.first?.[key] ? s.first : { ...(s.first ?? {}), [key]: value } }));

function Controls({ pl, labels }: { pl: ReturnType<typeof usePlayer>; labels?: { play?: string } }) {
  return (
    <div className="player" role="group" aria-label="Playback">
      {pl.playing ? (
        <button className="btn btn-small" onClick={pl.pause}><Icon name="pause" size={14} /> Pause</button>
      ) : (
        <button className="btn btn-small btn-primary" onClick={pl.play}><Icon name={pl.done ? 'replay' : 'play'} size={14} /> {pl.done ? 'Replay' : pl.started ? 'Continue' : labels?.play ?? 'Run'}</button>
      )}
      <button className="btn btn-small btn-quiet" onClick={pl.back} disabled={!pl.started}><Icon name="arrow-left" size={14} /> Step back</button>
      <button className="btn btn-small btn-quiet" onClick={pl.step} disabled={pl.done}>Step <Icon name="arrow-right" size={14} /></button>
    </div>
  );
}

function Predict({ q, choices, value, onPick, locked }: { q: string; choices: { id: string; label: string }[]; value?: string; onPick: (id: string) => void; locked?: boolean }) {
  return (
    <fieldset className="predict">
      <legend>Predict first: {q}</legend>
      <div className="choice-row">
        {choices.map((c) => (
          <button key={c.id} className="choice" aria-pressed={value === c.id} disabled={locked && value !== c.id} onClick={() => onPick(c.id)}>{c.label}</button>
        ))}
      </div>
    </fieldset>
  );
}

// ── Clarify: ask, hear consistent answers, state assumptions ─────────────────────────────────────────

export function ClarifyActivity(p: ActProps & { a: A<'clarify'>; onNext: () => void }) {
  const [own, setOwn] = useState('');
  const asked = p.a.questions.filter((q) => p.s.answers[`asked:${q.id}`]);
  const ask = (id: string) => {
    const q = p.a.questions.find((x) => x.id === id)!;
    if (p.s.answers[`asked:${id}`]) return;
    p.update((s) => ({ ...s, answers: { ...s.answers, [`asked:${id}`]: '1' }, log: [...s.log, { at: Date.now(), who: 'you', text: q.q, stage: s.stage }, { at: Date.now(), who: 'interviewer', text: q.a, stage: s.stage }] }));
  };
  const askOwn = () => {
    const words = own.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const best = p.a.questions.map((q) => ({ q, n: words.filter((w) => `${q.q} ${q.a}`.toLowerCase().includes(w)).length })).sort((x, y) => y.n - x.n)[0];
    const text = own.trim();
    setOwn('');
    if (best && best.n >= 1) {
      p.update((s) => ({ ...s, answers: { ...s.answers, [`asked:${best.q.id}`]: '1' }, log: [...s.log, { at: Date.now(), who: 'you', text, stage: s.stage }, { at: Date.now(), who: 'interviewer', text: best.q.a, stage: s.stage }] }));
    } else {
      p.update((s) => ({ ...s, log: [...s.log, { at: Date.now(), who: 'you', text, stage: s.stage }, { at: Date.now(), who: 'interviewer', stage: s.stage, text: 'The brief doesn’t settle that. Make a reasonable assumption, say it out loud, and carry it through.' }] }));
    }
  };
  return (
    <div className="act clarify">
      <section aria-labelledby="clarify-q">
        <h3 id="clarify-q" className="act-h">Ask the interviewer</h3>
        <div className="ask-grid">
          {p.a.questions.map((q) => {
            const done = !!p.s.answers[`asked:${q.id}`];
            return (
              <div key={q.id} className={`ask ${done ? 'answered' : ''}`}>
                <button className="ask-q" onClick={() => ask(q.id)} aria-expanded={done}>{done ? <Icon name="check" size={15} /> : <Icon name="info" size={15} />} {q.q}</button>
                {done && <p className="ask-a"><Rich text={q.a} /></p>}
              </div>
            );
          })}
        </div>
        <form className="ask-own" onSubmit={(e) => { e.preventDefault(); if (own.trim()) askOwn(); }}>
          <label><span className="visually-hidden">Ask your own question</span><input value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Or ask your own question…" maxLength={160} /></label>
          <button className="btn btn-small" disabled={!own.trim()}>Ask</button>
        </form>
      </section>
      {p.a.assumptions.length > 0 && (
        <section aria-labelledby="assume-h">
          <h3 id="assume-h" className="act-h">Where the brief leaves a choice, state your assumption</h3>
          {p.a.assumptions.map((as) => {
            const v = p.s.answers[`assume:${as.id}`];
            const opt = as.options.find((o) => o.id === v);
            return (
              <fieldset key={as.id} className="assume">
                <legend>{as.q}</legend>
                <div className="choice-row">
                  {as.options.map((o) => <button key={o.id} className="choice" aria-pressed={v === o.id} onClick={() => p.update((s) => ({ ...s, answers: { ...s.answers, [`assume:${as.id}`]: o.id } }))}>{o.label}</button>)}
                </div>
                {opt && <p className="consequence"><Icon name="arrow-right" size={14} /> {opt.consequence}</p>}
              </fieldset>
            );
          })}
        </section>
      )}
      <div className="act-foot">
        <span className="muted small">{asked.length} of {p.a.questions.length} questions asked{p.a.assumptions.length ? ` · ${p.a.assumptions.filter((x) => p.s.answers[`assume:${x.id}`]).length} of ${p.a.assumptions.length} assumptions stated` : ''}</span>
        <button className="btn btn-primary" onClick={p.onNext}>Start designing <Icon name="arrow-right" size={15} /></button>
      </div>
    </div>
  );
}

// ── Build (HLD architecture or LLD classes), with tracing through the learner’s own design ───────────

export function BuildActivity(p: ActProps & { a: A<'build'>; view: 'mine' | 'solution'; solutionMarks?: Record<string, Mark> }) {
  const g = p.design.graph;
  const [traceId, setTraceId] = useState(p.a.traces?.[0]?.id ?? '');
  const [miss, setMiss] = useState(false);
  const tr = p.a.traces?.find((t) => t.id === traceId);
  const plan = useMemo(() => {
    if (!tr) return null;
    return planTrace(g, shortestPath(g, tr.from as Sel, tr.to as Sel), { read: tr.read, miss });
  }, [g, tr, miss]);
  const key = `${traceId}|${miss}|${plan?.hops.map((h) => `${h.from}>${h.to}`).join(',')}`;
  const [armed, setArmed] = useState(false);
  const pl = usePlayer(plan?.hops.length ?? 0, key);
  useEffect(() => { if (armed && pl.done && plan && tr) setResult(p, `trace:${tr.id}`, plan.outcome); }, [armed, pl.done, plan, tr]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setArmed(false); }, [g]);

  const marks: Record<string, Mark> = {};
  const hops = plan?.hops ?? [];
  if (armed && plan) {
    hops.slice(0, pl.beat + 1).forEach((h, i) => { if (i < pl.beat || pl.t >= 1) marks[h.to] = { tone: 'active', tag: h.note }; });
    if (pl.done && plan.answeredBy) marks[plan.answeredBy] = { tone: 'ok', tag: plan.outcome === 'hit' ? '✓ Answered here (cache hit)' : '✓ Answers' };
    if (hops[0]) marks[hops[0].from] = marks[hops[0].from] ?? { tone: 'active', tag: 'Starts here' };
  }
  const token = armed && plan && pl.started && pl.beat >= 0 && hops[pl.beat] ? { from: hops[pl.beat].from, to: hops[pl.beat].to, t: pl.t, label: tr?.token ?? '', tone: 'request' as const } : null;
  const hasCache = find(g, 'cache').length > 0;
  const starter = p.a.starter;
  const palette: PaletteItem[] = p.script.palette;

  const traceButton = p.a.traces?.length ? (
    <button className="btn btn-small btn-primary" disabled={!g.comps.length} onClick={() => { setArmed(true); pl.replay(); }}><Icon name="play" size={14} /> <span className="wide-only">Trace a request</span><span className="narrow-only">Trace</span></button>
  ) : null;

  if (p.view === 'solution') {
    return (
      <div className="act build">
        <Builder graph={p.script.solution.design} palette={palette} verbs={p.script.verbs} mode={p.a.flavor === 'classes' ? 'classes' : 'architecture'} readOnly label="Worked solution" marks={p.solutionMarks} />
      </div>
    );
  }
  return (
    <div className="act build">
      {p.guided && !g.comps.length && starter && (
        <div className="starter-offer">
          <p><strong>New to this?</strong> Start from two parts and an arrow, then add what’s missing.</p>
          <button className="btn btn-small" onClick={() => p.design.commit(starter, 'Started from the starter design.')}>Use the starter design</button>
        </div>
      )}
      <Builder
        graph={g}
        commit={p.design.commit}
        undo={p.design.undo}
        redo={p.design.redo}
        canUndo={p.design.canUndo}
        canRedo={p.design.canRedo}
        palette={palette}
        verbs={p.script.verbs}
        mode={p.a.flavor === 'classes' ? 'classes' : 'architecture'}
        label="Your design"
        marks={marks}
        token={token}
        actions={traceButton}
        onEdited={p.onEdited}
      />
      {p.a.traces?.length ? (
        <section className="trace-panel" aria-label="Trace a request through your design">
          <div className="trace-row">
            {p.a.traces.length > 1 && (
              <div className="segmented" role="radiogroup" aria-label="Which request">
                {p.a.traces.map((t) => <button key={t.id} role="radio" aria-checked={traceId === t.id} onClick={() => { setTraceId(t.id); setArmed(false); }}>{t.label}</button>)}
              </div>
            )}
            {tr?.read && hasCache && (
              <div className="segmented" role="radiogroup" aria-label="Cache result">
                <button role="radio" aria-checked={!miss} onClick={() => { setMiss(false); setArmed(false); }}>Cache hit</button>
                <button role="radio" aria-checked={miss} onClick={() => { setMiss(true); setArmed(false); }}>Cache miss</button>
              </div>
            )}
            {armed && <Controls pl={pl} labels={{ play: 'Trace' }} />}
          </div>
          {armed && plan && (
            <div className={`trace-out ${pl.done ? plan.outcome : ''}`} aria-live="polite">
              {plan.outcome === 'broken'
                ? <p><Icon name="alert" size={15} /> {plan.explanation} Connect the parts, then trace again.</p>
                : <ol className="hops">{hops.map((h, i) => <li key={i} className={i < pl.beat || (i === pl.beat && pl.t >= 1) ? 'done' : i === pl.beat ? 'now' : ''}>{h.note}</li>)}</ol>}
              {pl.done && plan.outcome !== 'broken' && <p className="trace-result"><strong>{plan.outcome === 'hit' ? 'Answered by the cache.' : 'Answered.'}</strong> {plan.explanation}</p>}
              <p className="rule"><span className="rule-tag">Rule</span> {RULES.trace}</p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

// ── Trace with a part offline (changed condition) ────────────────────────────────────────────────────

export function TraceFailActivity(p: ActProps & { a: A<'trace'> }) {
  const g = p.design.graph;
  const alt = !!p.s.alternate;
  const failType = p.a.failCandidates[alt ? 1 : 0] ?? p.a.failCandidates[0];
  const toType = p.a.to[alt ? 1 : 0] ?? p.a.to[0];
  const [w, setW] = useWork<{ predict?: string; ran?: boolean }>(p, {});
  const offline = find(g, { type: failType })[0];
  const path = shortestPath(g, { type: p.a.from }, { type: toType });
  const result = path ? traceRequest(g, path, offline?.id) : null;
  const key = `${path?.join('>')}|${offline?.id}|${alt}`;
  const pl = usePlayer(result?.hops.length ?? 0, key);
  useEffect(() => { if (w.ran && pl.done && result) setResult(p, p.stage.id, result.outcome); }, [w.ran, pl.done, result?.outcome]); // eslint-disable-line react-hooks/exhaustive-deps
  const offName = offline?.label ?? p.script.palette.find((x) => x.type === failType)?.name ?? failType;
  const marks: Record<string, Mark> = {};
  if (offline) marks[offline.id] = { tone: 'fail', tag: '✕ Offline' };
  if (w.ran && result) result.hops.slice(0, pl.beat + 1).forEach((h, i) => { if (h.ok && (i < pl.beat || pl.t >= 1)) marks[h.to] = marks[h.to] ?? { tone: h.async ? 'focus' : 'active', tag: h.async ? 'Waits in line' : undefined }; });
  const hop = w.ran && result && pl.beat >= 0 ? result.hops[pl.beat] : undefined;
  const token = hop ? { from: hop.from, to: hop.to, t: pl.t, label: hop.ok ? 'request' : '✕ no reply', tone: (hop.ok ? 'request' : 'fail') as 'request' | 'fail' } : null;
  const predicted = p.a.predict.choices.find((c) => c.id === w.predict);
  return (
    <div className="act tracefail">
      <div className="change-banner" role="note"><Icon name="alert" size={16} /> <span>{p.stage.change?.[alt ? 'alternate' : 'announce'] ? (alt ? p.stage.change!.alternate!.announce : p.stage.change!.announce) : null}</span></div>
      <Predict q={p.a.predict.q} choices={p.a.predict.choices} value={w.predict} onPick={(id) => setW({ predict: id })} locked={!!w.ran} />
      <Builder graph={g} commit={p.design.commit} undo={p.design.undo} redo={p.design.redo} canUndo={p.design.canUndo} canRedo={p.design.canRedo}
        palette={p.script.palette} verbs={p.script.verbs} mode="architecture" label="Your design, with one part offline" marks={marks} token={token} onEdited={(m) => { p.onEdited(m); }}
        actions={<button className="btn btn-small btn-primary" disabled={!w.predict} onClick={() => { setW({ ran: true }); pl.replay(); }} title={w.predict ? '' : 'Predict first'}><Icon name="play" size={14} /> {w.ran ? 'Run again' : 'Run it'}</button>} />
      <section className="trace-panel" aria-live="polite">
        {!offline && <p><Icon name="info" size={15} /> Your design has no {offName} yet. Add it where it belongs and connect it, then run.</p>}
        {w.ran && result && (
          <>
            <Controls pl={pl} />
            {pl.done && (
              <div className={`trace-out ${result.outcome}`}>
                <p className="trace-result"><strong>{result.outcome === 'error' ? 'The buyer sees an error.' : result.outcome === 'delayed' ? 'The buyer gets a confirmation; the work waits.' : result.outcome === 'broken' ? 'The request can’t get there.' : 'Unaffected.'}</strong> {result.explanation}</p>
                {predicted && result.outcome !== 'broken' && <p className={predicted.id === result.outcome ? 'ok-line' : 'miss-line'}>{predicted.id === result.outcome ? <><Icon name="check" size={15} /> Your prediction matched.</> : <><Icon name="x" size={15} /> You predicted “{predicted.label}”.</>} Edit your design and run again to see a different outcome.</p>}
              </div>
            )}
          </>
        )}
        <p className="rule"><span className="rule-tag">Rule</span> {p.stage.change?.rule ?? RULES.trace}</p>
      </section>
    </div>
  );
}

// ── Two operations racing on a timeline ─────────────────────────────────────────────────────────────

export function TimelineActivity(p: ActProps & { a: A<'timeline'> }) {
  const [w, setW] = useWork<{ order?: TLOp[]; guard?: Guard; predict?: string; ran?: number }>(p, {});
  const order = w.order ?? p.a.start;
  const guard = w.guard ?? 'plain';
  const r = useMemo(() => runTimeline(order, guard, p.a.initial, p.a.names), [order, guard, p.a.initial, p.a.names]);
  const pl = usePlayer(r.steps.length, `${JSON.stringify(order)}|${guard}`, 650);
  useEffect(() => { if (w.ran && pl.done) setResult(p, p.stage.id, r.oversold ? 'oversold' : 'one'); }, [w.ran, pl.done, r.oversold]); // eslint-disable-line react-hooks/exhaustive-deps
  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    if (validOrder(next)) setW({ order: next, ran: 0 });
  };
  const opLabel = (o: TLOp) => `${p.a.names[o.actor]} ${o.kind === 'read' ? p.a.read : p.a.write}`;
  const shown = pl.started ? r.steps.slice(0, pl.beat + 1) : [];
  const value = shown.length ? shown[shown.length - 1].after : p.a.initial;
  const g = p.a.guards.find((x) => x.id === guard)!;
  const predicted = p.a.predict.choices.find((c) => c.id === w.predict);
  const actual = r.wins.filter(Boolean).length === 2 ? 'both' : r.wins.filter(Boolean).length === 1 ? 'one' : 'none';
  return (
    <div className="act timeline">
      {p.stage.change && <div className="change-banner" role="note"><Icon name="alert" size={16} /> <span>{p.stage.change.announce}</span></div>}
      <div className="tl-top">
        <fieldset className="guard">
          <legend>How the write works</legend>
          <div className="segmented" role="radiogroup" aria-label="How the write works">
            {p.a.guards.map((x) => <button key={x.id} role="radio" aria-checked={guard === x.id} onClick={() => setW({ guard: x.id, ran: 0 })}>{x.label}</button>)}
          </div>
          <p className="muted small">{g.detail}</p>
          {g.code && <pre className="code-mini"><code>{g.code}</code></pre>}
        </fieldset>
        <div className="tl-counter" aria-live="polite"><span className="muted small">{p.a.resource}</span><strong className={value < 0 ? 'bad' : ''}>{value}</strong></div>
      </div>
      <ol className="tl-ops" aria-label="Order of operations (earliest first)">
        {order.map((o, i) => {
          const st = shown.find((s, k) => k === shown.length - 1 && s.actor === o.actor && s.kind === o.kind) ? 'now' : r.steps.slice(0, pl.started ? pl.beat + 1 : 0).some((s) => s.actor === o.actor && s.kind === o.kind) ? 'done' : '';
          const step = r.steps.find((s) => s.actor === o.actor && s.kind === o.kind && !s.waited) ?? r.steps.find((s) => s.actor === o.actor && s.kind === o.kind);
          return (
            <li key={`${o.actor}-${o.kind}`} className={`tl-op a${o.actor} ${st}`}>
              <span className="tl-t mono">t{i + 1}</span>
              <span className="tl-name">{opLabel(o)}</span>
              {st && step && <span className={`tl-note ${step.ok === false ? 'refused' : step.ok ? 'won' : ''}`}>{step.note}</span>}
              <span className="tl-move">
                <button className="icon-btn" aria-label={`Move “${opLabel(o)}” earlier`} disabled={i === 0 || !validOrder(swap(order, i, -1))} onClick={() => move(i, -1)}><Icon name="chevron-down" size={16} style={{ transform: 'rotate(180deg)' }} /></button>
                <button className="icon-btn" aria-label={`Move “${opLabel(o)}” later`} disabled={i === order.length - 1 || !validOrder(swap(order, i, 1))} onClick={() => move(i, 1)}><Icon name="chevron-down" size={16} /></button>
              </span>
            </li>
          );
        })}
      </ol>
      <Predict q={p.a.predict.q} choices={p.a.predict.choices} value={w.predict} onPick={(id) => setW({ predict: id })} />
      <div className="tl-run">
        {!w.ran ? (
          <button className="btn btn-primary" disabled={!w.predict} onClick={() => { setW({ ran: (w.ran ?? 0) + 1 }); pl.replay(); }}><Icon name="play" size={15} /> Run the race</button>
        ) : <Controls pl={pl} />}
        {!w.predict && <span className="muted small">Predict first, then run.</span>}
      </div>
      {w.ran && pl.done ? (
        <div className={`trace-out ${r.oversold ? 'error' : 'ok'}`} aria-live="polite">
          <p className="trace-result"><strong>{r.oversold ? `${p.a.names[0]} and ${p.a.names[1]} were both told “held”. Sold twice.` : `Exactly one buyer won (${p.a.names[r.wins.findIndex(Boolean)]}).`}</strong></p>
          {predicted && <p className={predicted.id === actual ? 'ok-line' : 'miss-line'}>{predicted.id === actual ? <><Icon name="check" size={15} /> Your prediction matched.</> : <><Icon name="x" size={15} /> You predicted “{predicted.label}”.</>} Try another order or another write, and run again.</p>}
        </div>
      ) : null}
      <p className="rule"><span className="rule-tag">Rule</span> {RULES.timeline}</p>
    </div>
  );
}
const swap = (o: TLOp[], i: number, d: number) => { const n = [...o]; if (i + d < 0 || i + d >= n.length) return n; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; };

// ── A state machine with a clock ─────────────────────────────────────────────────────────────────────

export function StatesActivity(p: ActProps & { a: A<'states'> }) {
  const g = p.states.graph;
  const m = useMemo(() => machineFrom(g), [g]);
  const steps = useMemo(() => runScenario(m, p.a.initial, p.a.scenario, p.a.timer), [m, p.a]);
  const [w, setW] = useWork<{ ran?: number }>(p, {});
  const pl = usePlayer(steps.length, JSON.stringify(m), 800);
  const verdict = steps.some((s) => s.expect && !s.accepted) ? 'stuck' : steps.every((s) => !s.expect || s.matches) ? 'pass' : 'fail';
  useEffect(() => { if (w.ran && pl.done) setResult(p, p.stage.id, verdict); }, [w.ran, pl.done, verdict]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = w.ran ? steps.slice(0, pl.started ? pl.beat + 1 : 0) : [];
  const now = shown.length ? shown[shown.length - 1].to : p.a.initial;
  const nowLabel = shown.length ? shown[shown.length - 1].label.split(' ')[0] : '10:00';
  const marks: Record<string, Mark> = {};
  const cur = g.comps.find((c) => (c.type !== 'custom' ? c.type : c.label.toLowerCase()) === now);
  if (cur) marks[cur.id] = { tone: 'active', tag: w.ran ? `Now (${nowLabel})` : 'Start' };
  const palette: PaletteItem[] = p.a.states.map((s) => ({ type: s.key, kind: 'state', name: s.label, blurb: s.blurb }));
  return (
    <div className="act states">
      {p.guided && !g.comps.length && p.a.starter && (
        <div className="starter-offer"><p><strong>New to state machines?</strong> Start with two states and one arrow.</p><button className="btn btn-small" onClick={() => p.states.commit(p.a.starter!, 'Started from the starter states.')}>Use the starter</button></div>
      )}
      <Builder graph={g} commit={p.states.commit} undo={p.states.undo} redo={p.states.redo} canUndo={p.states.canUndo} canRedo={p.states.canRedo}
        palette={palette} verbs={p.a.events.map((e) => e.id)} mode="states" label={`States of ${p.a.entity}`} marks={marks} onEdited={p.onEdited}
        emptyHint="Add the states a seat can be in, then connect them."
        actions={<button className="btn btn-small btn-primary" disabled={!g.comps.length} onClick={() => { setW({ ran: (w.ran ?? 0) + 1 }); pl.replay(); }}><Icon name="clock" size={14} /> Advance the clock</button>} />
      <section className="clock-panel" aria-label="Clock and events" aria-live="polite">
        <div className="trace-row">
          <span className="clock"><Icon name="clock" size={15} /> {nowLabel}</span>
          {w.ran ? <Controls pl={pl} labels={{ play: 'Advance' }} /> : <span className="muted small">Events at 10:00, 10:12 and 10:15. {p.a.timer ? `Timed arrows (“${p.a.timer.event}”) fire on their own after ${p.a.timer.after} minutes.` : ''}</span>}
        </div>
        <ol className="events">
          {(w.ran ? steps : p.a.scenario.map((e) => ({ ...e, from: '', to: '', accepted: true, auto: false, matches: undefined as boolean | undefined }))).map((s, i) => {
            const visible = w.ran && i < shown.length;
            return (
              <li key={i} className={visible ? (s.accepted ? (s.matches === false ? 'mismatch' : 'accepted') : 'refused') : 'pending'}>
                <span>{s.label}</span>
                {visible && <span className="ev-out">{s.accepted ? <><Icon name="check" size={14} /> {s.from} → {s.to}{s.auto ? ' (timed)' : ''}</> : <><Icon name="x" size={14} /> refused: no “{s.event}” arrow from {s.from}</>}{s.matches === false ? ` · expected ${s.expect}` : ''}</span>}
              </li>
            );
          })}
        </ol>
        {w.ran && pl.done && <p className={`trace-result ${verdict}`}><strong>{verdict === 'pass' ? 'Every event did what the brief requires.' : verdict === 'stuck' ? 'An event the brief allows was refused.' : 'The seat ended in the wrong state.'}</strong> Edit your states or arrows and advance the clock again.</p>}
        <p className="rule"><span className="rule-tag">Rule</span> {RULES.states}</p>
      </section>
    </div>
  );
}

// ── Responsibilities, then walk through one interaction ─────────────────────────────────────────────

export function RolesActivity(p: ActProps & { a: A<'roles'> }) {
  const [w, setW] = useWork<{ assigned?: Record<string, string>; checked?: boolean; walk?: number; wrong?: string }>(p, {});
  const assigned = w.assigned ?? {};
  const verdicts = checkRoles(p.a.cards, assigned);
  const all = p.a.cards.every((c) => assigned[c.id]);
  const walk = w.walk ?? 0;
  const cls = (id: string) => p.a.classes.find((c) => c.id === id)?.name ?? id;
  useEffect(() => { if (w.checked) setResult(p, p.stage.id, Object.values(verdicts).every((v) => v === 'right' || v === 'alt') ? 'pass' : 'gaps'); }, [w.checked, JSON.stringify(verdicts)]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="act roles">
      <div className="classes">{p.a.classes.map((c) => <div key={c.id} className="class-card"><strong className="mono">{c.name}</strong><span className="muted small">{c.blurb}</span></div>)}</div>
      <ol className="cards">
        {p.a.cards.map((c) => {
          const v = w.checked ? verdicts[c.id] : 'open';
          return (
            <li key={c.id} className={`role-card v-${v}`}>
              <p className="role-text">{c.text}</p>
              <div className="choice-row" role="radiogroup" aria-label={`Who owns: ${c.text}`}>
                {p.a.classes.map((k) => <button key={k.id} role="radio" aria-checked={assigned[c.id] === k.id} className="choice small mono" onClick={() => setW({ assigned: { ...assigned, [c.id]: k.id }, checked: false })}>{k.name}</button>)}
              </div>
              {w.checked && v !== 'open' && <p className={`role-why ${v}`}>{v === 'right' ? <Icon name="check" size={14} /> : v === 'alt' ? <Icon name="check" size={14} /> : <Icon name="x" size={14} />} {v === 'wrong' ? `Reconsider: ${c.why}` : v === 'alt' ? `Also reasonable. ${c.why}` : c.why}</p>}
            </li>
          );
        })}
      </ol>
      <div className="act-foot">
        <button className="btn btn-primary" disabled={!all} onClick={() => setW({ checked: true })}>Check my choices</button>
        {!all && <span className="muted small">Give every job an owner first.</span>}
      </div>
      {w.checked && (
        <section className="walk" aria-labelledby="walk-h" aria-live="polite">
          <h3 id="walk-h" className="act-h">Walk through: {p.a.walk.title}</h3>
          <ol className="seq">
            {p.a.walk.steps.slice(0, walk).map((s, i) => <li key={i}><span className="muted">{s.prompt}</span> <code>{s.call}</code></li>)}
          </ol>
          {walk < p.a.walk.steps.length ? (
            <div className="walk-q">
              <p>{p.a.walk.steps[walk].prompt}</p>
              <div className="choice-row">
                {p.a.classes.map((k) => <button key={k.id} className="choice small mono" onClick={() => (k.id === p.a.walk.steps[walk].owner ? setW({ walk: walk + 1, wrong: undefined }) : setW({ wrong: k.id }))}>{k.name}</button>)}
              </div>
              {w.wrong && <p className="miss-line"><Icon name="x" size={14} /> Not {cls(w.wrong)}: which object holds the data this step needs?</p>}
            </div>
          ) : <p className="ok-line"><Icon name="check" size={15} /> Interaction complete: each step went to the object that owns its data.</p>}
        </section>
      )}
    </div>
  );
}

// ── Data model: choose keys, test queries ──────────────────────────────────────────────────────────

export function ModelActivity(p: ActProps & { a: A<'model'> }) {
  const t = p.a.tables.find((x) => x.id === p.a.table)!;
  const [w, setW] = useWork<{ partition?: string; sort?: string; indexes?: string[]; q1?: boolean; q2?: boolean; tradeoff?: string }>(p, {});
  const key: KeyChoice = { partition: w.partition ?? '', sort: w.sort || undefined, indexes: w.indexes ?? [] };
  const p1 = w.q1 && key.partition ? planQuery(key, p.a.first, p.a.partitions) : null;
  const p2 = w.q2 && key.partition ? planQuery(key, p.a.second, p.a.partitions) : null;
  useEffect(() => { if (p1) setResult(p, `${p.stage.id}:q1`, p1.plan); }, [p1?.plan]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (p2) setResult(p, `${p.stage.id}:q2`, p2.plan); }, [p2?.plan]); // eslint-disable-line react-hooks/exhaustive-deps
  const to = p.a.tradeoffs.find((x) => x.id === w.tradeoff);
  return (
    <div className="act model">
      <div className="tables">
        {p.a.tables.map((tb) => (
          <div key={tb.id} className={`table-card ${tb.id === t.id ? 'main' : ''}`}>
            <strong className="mono">{tb.name}</strong>
            <ul>{tb.fields.map((f) => <li key={f} className={`mono ${tb.id === t.id && f === key.partition ? 'pk' : ''} ${tb.id === t.id && f === key.sort ? 'sk' : ''}`}>{f}{tb.id === t.id && f === key.partition ? ' · partition key' : ''}{tb.id === t.id && f === key.sort ? ' · sort key' : ''}{tb.links?.find((l) => l.field === f) ? ` → ${p.a.tables.find((x) => x.id === tb.links!.find((l) => l.field === f)!.to)?.name}` : ''}</li>)}</ul>
          </div>
        ))}
      </div>
      <div className="key-pick">
        <label>Partition key of <span className="mono">{t.name}</span> <select value={key.partition} onChange={(e) => setW({ partition: e.target.value, q1: false, q2: false })}><option value="">Choose…</option>{t.fields.map((f) => <option key={f}>{f}</option>)}</select></label>
        <label>Sort key <select value={key.sort ?? ''} onChange={(e) => setW({ sort: e.target.value, q1: false, q2: false })}><option value="">none</option>{t.fields.map((f) => <option key={f}>{f}</option>)}</select></label>
        <fieldset><legend className="small">Extra indexes</legend>{t.fields.map((f) => <label key={f} className="check"><input type="checkbox" checked={key.indexes.includes(f)} onChange={(e) => setW({ indexes: e.target.checked ? [...key.indexes, f] : key.indexes.filter((x) => x !== f), q2: w.q2 && false })} /> <span className="mono">{f}</span></label>)}</fieldset>
      </div>
      {[{ q: p.a.first, plan: p1, run: () => setW({ q1: true }), shown: true }, { q: p.a.second, plan: p2, run: () => setW({ q2: true }), shown: !!p1 }].filter((x) => x.shown).map((x, i) => (
        <div key={x.q.id} className={`query ${x.plan?.plan ?? ''}`}>
          <p><span className="rule-tag">{i === 0 ? 'Query 1' : 'Query 2'}</span> {x.q.text}</p>
          <button className="btn btn-small btn-primary" disabled={!key.partition} onClick={x.run}><Icon name="play" size={14} /> Test this query</button>
          {x.plan && <p className="trace-result" aria-live="polite"><strong>{x.plan.plan === 'one-partition' ? 'Reads one partition.' : x.plan.plan === 'index' ? 'Uses an index.' : `Asks all ${x.plan.partitions} partitions.`}</strong> {x.plan.note}</p>}
        </div>
      ))}
      {p2 && (
        <fieldset className="assume">
          <legend>Query 2 exposes a trade-off. What do you do?</legend>
          <div className="choice-row">{p.a.tradeoffs.map((o) => <button key={o.id} className="choice" aria-pressed={w.tradeoff === o.id} onClick={() => { setW({ tradeoff: o.id }); setResult(p, `${p.stage.id}:tradeoff`, o.id); }}>{o.label}</button>)}</div>
          {to && <p className={`consequence v-${to.verdict}`}><Icon name="arrow-right" size={14} /> {to.consequence}</p>}
        </fieldset>
      )}
      <p className="rule"><span className="rule-tag">Rule</span> {RULES.model}</p>
    </div>
  );
}

// ── Capacity: a queue in front of workers, and a slow dependency ────────────────────────────────────

export function QueueActivity(p: ActProps & { a: A<'queue'> }) {
  const [w, setW] = useWork<{ arrival?: number; workers?: number; policy?: Policy; ran?: number }>(p, {});
  const arrival = w.arrival ?? p.a.arrival[1];
  const workers = w.workers ?? p.a.workers[1];
  const policy = w.policy ?? 'wait';
  const r = useMemo(() => runQueue({ arrival, workers, serviceMs: p.a.serviceMs, slow: p.a.slow, policy, timeoutS: p.a.timeoutS ?? 2 }), [arrival, workers, policy, p.a]);
  const pl = usePlayer(r.series.length, `${arrival}|${workers}|${policy}`, 70);
  const bounded = r.maxWaitS <= (p.a.timeoutS ?? 2) * 1.5;
  useEffect(() => { if (w.ran && pl.done) setResult(p, p.stage.id, `${policy}:${bounded ? 'bounded' : 'unbounded'}`); }, [w.ran, pl.done, policy, bounded]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = w.ran ? r.series.slice(0, Math.max(1, Math.ceil(pl.pos))) : [];
  const Wd = 600; const Hd = 180;
  const maxQ = Math.max(10, ...r.series.map((s) => s.queue));
  const pts = shown.map((s) => `${(s.t / (r.series.length - 1)) * Wd},${Hd - (s.queue / maxQ) * (Hd - 10)}`).join(' ');
  const last = shown[shown.length - 1];
  const cap = Math.round((workers * 1000) / p.a.serviceMs);
  return (
    <div className="act queue">
      {p.stage.change && <div className="change-banner" role="note"><Icon name="alert" size={16} /> <span>{p.stage.change.announce}</span></div>}
      <div className="q-controls">
        <label>Arrivals <strong className="mono">{arrival}/s</strong><input type="range" min={p.a.arrival[0]} max={p.a.arrival[2]} value={arrival} onChange={(e) => setW({ arrival: +e.target.value, ran: 0 })} /></label>
        <label>Workers <strong className="mono">{workers}</strong> <span className="muted small">(can finish {cap}/s)</span><input type="range" min={p.a.workers[0]} max={p.a.workers[2]} value={workers} onChange={(e) => setW({ workers: +e.target.value, ran: 0 })} /></label>
        <fieldset><legend>When {p.a.slow.what}</legend><div className="choice-row">{p.a.policies.map((x) => <button key={x.id} className="choice" aria-pressed={policy === x.id} onClick={() => setW({ policy: x.id, ran: 0 })} title={x.detail}>{x.label}</button>)}</div><p className="muted small">{p.a.policies.find((x) => x.id === policy)?.detail}</p></fieldset>
      </div>
      <div className="q-chart">
        <svg viewBox={`0 0 ${Wd} ${Hd + 22}`} role="img" aria-label={`Queue length over ${r.series.length} seconds. ${last ? `At ${last.t} s: ${last.queue} waiting.` : 'Not run yet.'}`}>
          <rect x={(p.a.slow.from / r.series.length) * Wd} y={0} width={((p.a.slow.to - p.a.slow.from) / r.series.length) * Wd} height={Hd} className="slow-band" />
          <text x={(p.a.slow.from / r.series.length) * Wd + 6} y={14} className="slow-label">{p.a.slow.what}</text>
          <line x1={0} y1={Hd} x2={Wd} y2={Hd} className="axis" />
          {pts && <polyline points={pts} className="q-line" />}
          <text x={0} y={Hd + 18} className="axis-label">0 s</text><text x={Wd} y={Hd + 18} textAnchor="end" className="axis-label">{r.series.length} s</text>
        </svg>
        <dl className="readout">
          <div><dt>Waiting now</dt><dd className="mono">{last?.queue ?? 0}</dd></div>
          <div><dt>Longest wait</dt><dd className="mono">{w.ran && pl.done ? `${r.maxWaitS} s` : '—'}</dd></div>
          <div><dt>Refused or fallback</dt><dd className="mono">{w.ran && pl.done ? r.failed.toLocaleString() : '—'}</dd></div>
        </dl>
      </div>
      <div className="tl-run">{!w.ran ? <button className="btn btn-primary" onClick={() => { setW({ ran: 1 }); pl.replay(); }}><Icon name="play" size={15} /> Run {r.series.length} seconds</button> : <Controls pl={pl} />}</div>
      {w.ran && pl.done ? <p className={`trace-result ${bounded ? 'ok' : 'error'}`} aria-live="polite"><strong>{bounded ? 'Waits stayed bounded.' : 'The queue ran away.'}</strong> Longest wait {r.maxWaitS} s; {r.endQueue.toLocaleString()} still waiting at the end.</p> : null}
      <p className="rule"><span className="rule-tag">Rule</span> {RULES.queue}</p>
    </div>
  );
}
