/**
 * The interview session (interview brief §2–9). Layout: what the interviewer is asking (question card, always
 * visible) · where the learner acts (the stage’s activity, the most room) · how to get help (I’m stuck / Show
 * solution beside the question, the ladder in the interviewer panel). On phones the brief, workspace and
 * interviewer are tabs that stay mounted, so each keeps its state.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import type { InterviewScript, Stage } from '../../content/interview/types';
import { acks as findAcks, coachLines, debrief, fill, nextQuestion, type Ctx } from '../../sim/interview/rules';
import { addComp, byId, connect, find, setLabel, type DesignGraph } from '../../sim/interview/graph';
import { verbsFor } from '../../content/interview/catalogue';
import { SCRIPTS } from '../../content/interview/scripts';
import { CASES } from '../../content/cases';
import { topicById } from '../../content/curriculum';
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { raiseStatus } from '../../progress/activity';
import { recordSelf } from '../../progress/evidence';
import { Blocks } from '../lessons/GenericLesson';
import { Rich } from '../components/Rich';
import { Icon } from '../components/Icon';
import { useDesignHistory, Builder, type Mark } from './Builder';
import { BuildActivity, ClarifyActivity, ModelActivity, QueueActivity, RolesActivity, StatesActivity, TimelineActivity, TraceFailActivity, type ActProps } from './activities';
import { migrate, newSessionId, blank, type HelpLevel, type SessionV2 } from './record';
import { usePlayer } from './player';

type Tab = 'brief' | 'workspace' | 'interviewer';

export function Session({ sessionId }: { sessionId: string }) {
  const [raw, setRaw] = useRecord<unknown>(`interview:${sessionId}`, null);
  const caseId = (raw as { caseId?: string } | null)?.caseId;
  const script = caseId ? SCRIPTS[caseId] : undefined;
  const s = useMemo(() => migrate(raw, script), [raw, script]);
  if (!s) return <div className="page reading"><h1>Interview not found</h1><p>This interview isn’t saved on this device or in your account. <Link to="/interview">Choose a case</Link>.</p></div>;
  if (!script) return <div className="page reading"><h1>{topicById(s.caseId)?.title ?? 'Interview'}</h1><p className="notice warn">This case doesn’t have an interview script yet. <Link to={topicById(s.caseId)?.route ?? '/interview'}>Open the case study</Link> or <Link to="/interview">choose another case</Link>.</p></div>;
  return <Running key={sessionId} script={script} s={s} save={(n) => setRaw({ ...n, savedAt: Date.now() })} />;
}

function Running({ script, s, save }: { script: InterviewScript; s: SessionV2; save: (s: SessionV2) => void }) {
  const { store } = useProgress();
  const nav = useNavigate();
  const ref = useRef(s);
  ref.current = s;
  const update = (f: (x: SessionV2) => SessionV2) => {
    const prev = ref.current;
    let next = f(prev);
    if (next === prev) return;
    // Conversation is threaded by stage: stamp new entries with the stage they belong to.
    if (next.log.length > prev.log.length) next = { ...next, log: next.log.map((e, i) => (i >= prev.log.length && e.stage === undefined ? { ...e, stage: prev.stage } : e)) };
    ref.current = next;
    save(next);
  };
  const designH = useDesignHistory(s.design, (g) => update((x) => ({ ...x, design: g })));
  const statesH = useDesignHistory(s.states, (g) => update((x) => ({ ...x, states: g })));
  const debriefing = s.stage >= script.stages.length;
  const stage = script.stages[Math.min(s.stage, script.stages.length - 1)];
  const guided = s.mode === 'guided';
  const [tab, setTab] = useState<Tab>('workspace');
  const [briefOpen, setBriefOpen] = useState(false);
  const [panel, setPanel] = useState<'talk' | 'help'>('talk');
  const [helpLevel, setHelpLevel] = useState<HelpLevel>(0);
  const [view, setView] = useState<'mine' | 'solution'>('mine');
  const [diffIx, setDiffIx] = useState(0);
  const [walkIx, setWalkIx] = useState(0);
  const [pending, setPending] = useState<{ kind: 'rule'; id: string } | { kind: 'label'; linkId: string } | null>(null);
  const [earlier, setEarlier] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!s.timer.on) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [s.timer.on]);
  useEffect(() => { document.title = `${topicById(script.caseId)?.short ?? script.brief.interviewer.name} · Interview · System Design Masterclass`; }, [script]);
  // Entering a stage: remember the design so “Try this step again” can restore it; reset help and views.
  useEffect(() => {
    setPanel('talk'); setHelpLevel(0); setView('mine'); setDiffIx(0); setWalkIx(0); setPending(null);
    if (!debriefing && !s.snapshots[stage.id]) update((x) => ({ ...x, snapshots: { ...x.snapshots, [stage.id]: { design: x.design, states: x.states } }, reached: Math.max(x.reached, x.stage) }));
  }, [s.stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx: Ctx = { g: s.design, answers: s.answers, results: s.results };
  const say = (text: string, extra: Partial<SessionV2['log'][number]> = {}) => update((x) => ({ ...x, log: [...x.log, { at: Date.now(), who: 'interviewer', text, ...extra }] }));

  /** “Discuss my design”: acknowledge what is already addressed, then ask one question. */
  const discuss = (quietIfNothing = false) => {
    const x = ref.current;
    const c: Ctx = { g: x.design, answers: x.answers, results: x.results };
    const ack = findAcks(script.rules, c, stage.id, new Set(x.acked))[0];
    const askedIds = new Set(Object.keys(x.answers));
    const q = pending ? null : nextQuestion(script.rules, c, stage.id, askedIds);
    const lines: SessionV2['log'] = [];
    if (ack) lines.push({ at: Date.now(), who: 'interviewer', text: '✓ ' + fill(ack.ack!, x.design), rule: ack.id });
    if (q?.kind === 'label') {
      const l = x.design.links.find((k) => k.id === q.linkId)!;
      lines.push({ at: Date.now(), who: 'interviewer', text: `Your arrow from ${byId(x.design, l.from)?.label} to ${byId(x.design, l.to)?.label} doesn’t say what it does yet. What does it mean?` });
      setPending(q);
    } else if (q?.kind === 'rule') {
      lines.push({ at: Date.now(), who: 'interviewer', text: fill(q.rule.ask!.text, x.design), rule: q.rule.id });
      setPending({ kind: 'rule', id: q.rule.id });
    } else if (!ack && !pending && !quietIfNothing) {
      lines.push({ at: Date.now(), who: 'interviewer', text: guided ? 'Nothing more from me on this stage. Move on when you’re ready, or keep improving it.' : 'Okay. Carry on when you’re ready.' });
    }
    if (lines.length) update((y) => ({ ...y, log: [...y.log, ...lines], acked: ack ? [...y.acked, ack.id] : y.acked }));
    // Only an explicit “Discuss my design” switches panels; automatic follow-ups wait in the conversation.
    if (lines.length && !quietIfNothing) setPanel('talk');
  };
  // The interviewer follows up on decisions as they happen (activity outcomes); design edits wait for “Discuss” in mock mode.
  const resultsKey = JSON.stringify(s.results);
  const firstRun = useRef(true);
  useEffect(() => { if (firstRun.current) { firstRun.current = false; return; } discuss(true); }, [resultsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (id: string) => {
    if (!pending) return;
    const x = ref.current;
    if (pending.kind === 'label') {
      const l = x.design.links.find((k) => k.id === pending.linkId);
      if (l) designH.commit(setLabel(x.design, l.id, id));
      update((y) => ({ ...y, log: [...y.log, { at: Date.now(), who: 'you', text: id }, { at: Date.now(), who: 'interviewer', text: 'Got it. That’s on the arrow now.' }] }));
      setPending(null);
      return;
    }
    const rule = script.rules.find((r) => r.id === pending.id)!;
    const choice = rule.ask!.choices?.find((c) => c.id === id);
    update((y) => ({ ...y, answers: { ...y.answers, [rule.id]: id }, log: [...y.log, { at: Date.now(), who: 'you', text: choice ? fill(choice.label, y.design) : id }, ...(choice ? [{ at: Date.now(), who: 'interviewer' as const, text: fill(choice.reply, y.design), verdict: choice.verdict }] : [])] }));
    setPending(null);
  };

  const go = (i: number) => update((x) => ({ ...x, stage: Math.max(0, Math.min(script.stages.length, i)), reached: Math.max(x.reached, i) }));
  const openHelp = (lvl: HelpLevel) => {
    setPanel('help'); setHelpLevel(lvl); setTab('interviewer');
    update((x) => ((x.help[stage.id] ?? 0) >= lvl ? x : { ...x, help: { ...x.help, [stage.id]: lvl } }));
    
  };
  const retry = () => {
    const snap = s.snapshots[stage.id];
    update((x) => {
      const results = Object.fromEntries(Object.entries(x.results).filter(([k]) => k !== stage.id && !k.startsWith(`${stage.id}:`) && !(stage.id === 'design' && k.startsWith('trace:'))));
      return { ...x, design: snap?.design ?? x.design, states: snap?.states ?? x.states, work: { ...x.work, [stage.id]: {} }, results, log: [...x.log, { at: Date.now(), who: 'interviewer', text: `Let’s take “${stage.title}” again from where you started it.` }] };
    });
    setPanel('talk'); setView('mine'); setHelpLevel(0);
  };

  const diffs = useMemo(() => differences(script, s.design), [script, s.design]);
  const solutionMarks: Record<string, Mark> = {};
  const walkFocus = panel === 'help' && helpLevel === 2 ? stage.help.walkthrough[walkIx]?.focus : undefined;
  if (walkFocus) walkFocus.forEach((id) => { solutionMarks[id] = { tone: 'focus', tag: `Step ${walkIx + 1}` }; });
  else if (diffs.length) { const i = Math.min(diffIx, diffs.length - 1); solutionMarks[diffs[i].id] = { tone: 'focus', tag: diffs[i].alt ? 'Different part' : 'Missing from yours' }; }
  const adopt = (id: string) => {
    const next = adoptPart(script, s.design, id);
    if (next !== s.design) designH.commit(next);
    update((x) => ({ ...x, log: [...x.log, { at: Date.now(), who: 'interviewer', text: 'Adopted. I’ll ask about your updated design from here on.' }] }));
  };

  const actProps: ActProps = { script, stage, s, update, design: { graph: s.design, ...designH, commit: (g) => designH.commit(g) }, states: { graph: s.states, ...statesH, commit: (g) => statesH.commit(g) }, onEdited: () => setPending((p) => (p?.kind === 'label' && !ref.current.design.links.some((l) => l.id === p.linkId && !l.label) ? null : p)), guided, say: (t) => say(t) };
  const coach = guided && !debriefing ? coachLines(script.rules, ctx, stage.id)[0] : undefined;
  const elapsed = s.timer.startedAt ? now - s.timer.startedAt : 0;
  const left = s.timer.minutes * 60_000 - elapsed;
  const pendingRule = pending?.kind === 'rule' ? script.rules.find((r) => r.id === pending.id) : undefined;
  const pendingLink = pending?.kind === 'label' ? s.design.links.find((l) => l.id === pending.linkId) : undefined;
  const unread = pending ? 1 : 0;

  const header = (
    <div className="iv-top">
      <Link to="/interview" className="iv-back"><Icon name="arrow-left" size={15} /> Interviews</Link>
      <h1 className="iv-title">{topicById(script.caseId)?.short ?? topicById(script.caseId)?.title}</h1>
      <span className="pill">{script.track.toUpperCase()}</span>
      <button className={`pill mode ${guided ? 'accent' : ''}`} onClick={() => update((x) => ({ ...x, mode: guided ? 'mock' : 'guided' }))} title="Switch between guided practice and a mock interview">{guided ? 'Guided practice' : 'Mock interview'}</button>
      <span className="iv-top-right">
        <button className="btn btn-small btn-quiet" onClick={() => update((x) => ({ ...x, timer: { ...x.timer, on: !x.timer.on, startedAt: x.timer.startedAt ?? Date.now() } }))} aria-pressed={s.timer.on}>
          <Icon name="clock" size={15} /> {s.timer.on ? (left > 0 ? fmt(left) : `+${fmt(-left)}`) : 'Timer off'}
        </button>
        <button className="btn btn-small" onClick={() => { setBriefOpen(!briefOpen); setTab('brief'); }} aria-expanded={briefOpen}><Icon name="book" size={15} /> View brief</button>
      </span>
    </div>
  );
  const rail = (
    <nav className="iv-rail" aria-label="Interview stages">
      <ol>
        {script.stages.map((st, i) => (
          <li key={st.id}><button aria-current={s.stage === i ? 'step' : undefined} className={i < s.stage || (i <= s.reached && i !== s.stage) ? 'done' : ''} onClick={() => go(i)}>
            <span className="n">{i < s.stage ? <Icon name="check" size={13} /> : i + 1}</span> {st.title}{st.change ? <span className="chg" title="Changed condition"> · changed</span> : null}
          </button></li>
        ))}
        <li><button aria-current={debriefing ? 'step' : undefined} onClick={() => go(script.stages.length)} disabled={s.reached < script.stages.length - 1 && !debriefing}><span className="n"><Icon name="flag" size={13} /></span> Debrief</button></li>
      </ol>
    </nav>
  );

  if (debriefing) {
    return (
      <div className="iv-session debrief-mode">
        {header}{rail}
        <Debrief script={script} s={s} go={go} update={update} store={store} nav={nav} />
      </div>
    );
  }

  return (
    <div className={`iv-session ${briefOpen ? 'brief-open' : ''}`} data-tab={tab}>
      {header}
      {rail}
      <section className="iv-question" aria-labelledby="iv-q">
        <p className="iv-who"><span className="avatar" aria-hidden="true">{script.brief.interviewer.name[0]}</span> {script.brief.interviewer.name} · {script.brief.interviewer.role}{stage.change ? <span className="pill warn"> changed condition</span> : null}</p>
        {guided && <p className="iv-intro">{stage.intro}</p>}
        <h2 id="iv-q" className="iv-q">{s.stage === 0 && s.log.length === 0 ? script.brief.firstMove : stage.question}</h2>
        <div className="iv-help-row">
          <button className="btn btn-small" onClick={() => openHelp(1)}><Icon name="spark" size={15} /> I’m stuck</button>
          <button className="btn btn-small" onClick={() => { openHelp(3); if (hasCanvas(stage)) { setView('solution'); setTab('workspace'); } }}><Icon name="eye" size={15} /> Show solution</button>
          <button className="btn btn-small btn-quiet mobile-only" onClick={() => setTab('brief')}><Icon name="book" size={15} /> Brief</button>
        </div>
      </section>
      <div className="iv-tabs segmented" role="tablist" aria-label="Interview panes">
        {(['brief', 'workspace', 'interviewer'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} aria-controls={`pane-${t}`} onClick={() => setTab(t)}>
            {t === 'brief' ? 'Brief' : t === 'workspace' ? 'Workspace' : 'Interviewer'}{t === 'interviewer' && unread ? <span className="badge" aria-label="1 question waiting">1</span> : null}
          </button>
        ))}
      </div>
      <div className="iv-main">
        <section id="pane-workspace" className="pane pane-workspace" aria-label="Workspace">
          {hasCanvas(stage) && (
            <div className="view-switch">
              <div className="segmented" role="radiogroup" aria-label="Which design to show">
                <button role="radio" aria-checked={view === 'mine'} onClick={() => setView('mine')}>Your design</button>
                <button role="radio" aria-checked={view === 'solution'} onClick={() => { setView('solution'); setDiffIx(0); }}>Reference design</button>
              </div>
              {view === 'solution' && (
                <p className="view-note">One sound answer to this case, for comparison. Your design stays as you left it.</p>
              )}
              {view === 'solution' && stage.activity.kind === 'build' && diffs.length > 0 && !walkFocus && (() => {
                const i = Math.min(diffIx, diffs.length - 1);
                const d = diffs[i];
                return (
                  <div className="diff" aria-live="polite">
                    <span className="pill accent">{d.alt ? 'Different part, same job' : `Missing from yours · ${i + 1} of ${diffs.length}`}</span>
                    <span>{d.text}</span>
                    {!d.alt && <button className="btn btn-small" onClick={() => adopt(d.id)}>Add it to my design</button>}
                    {diffs.length > 1 && <button className="btn btn-small btn-quiet" onClick={() => setDiffIx((i + 1) % diffs.length)}>Next</button>}
                  </div>
                );
              })()}
              {view === 'solution' && stage.activity.kind === 'build' && diffs.length === 0 && <span className="ok-line small"><Icon name="check" size={14} /> Your design has every part the reference has.</span>}
            </div>
          )}
          <ActivityFor p={actProps} view={view} solutionMarks={solutionMarks} next={() => go(s.stage + 1)} />
          <div className="iv-next">
            {s.stage > 0 && <button className="btn btn-quiet" onClick={() => go(s.stage - 1)}><Icon name="arrow-left" size={15} /> {script.stages[s.stage - 1].title}</button>}
            <button className="btn btn-primary" onClick={() => go(s.stage + 1)}>{s.stage === script.stages.length - 1 ? 'Finish and see the debrief' : `Next: ${script.stages[s.stage + 1].title}`} <Icon name="arrow-right" size={15} /></button>
          </div>
        </section>
        <aside id="pane-interviewer" className="pane pane-interviewer" aria-label="Interviewer">
          <div className="segmented panel-switch" role="tablist" aria-label="Interviewer or help">
            <button role="tab" aria-selected={panel === 'talk'} onClick={() => setPanel('talk')}>Interviewer</button>
            <button role="tab" aria-selected={panel === 'help'} onClick={() => { setPanel('help'); if (!helpLevel) openHelp(1); }}>Help</button>
          </div>
          {panel === 'talk' ? (
            <div className="talk">
              <ol className="log" aria-live="polite">
                {(earlier ? s.log : s.log.filter((m) => (m.stage ?? 0) === s.stage)).slice(earlier ? -40 : -10).map((m, i) => <li key={i} className={`msg ${m.who} ${m.verdict ?? ''}`}>{m.who === 'interviewer' && <span className="who">{script.brief.interviewer.name}</span>}<Rich text={m.text} /></li>)}
                {!s.log.some((m) => (m.stage ?? 0) === s.stage) && !earlier && <li className="msg interviewer"><span className="who">{script.brief.interviewer.name}</span>{guided ? stage.intro : 'Go ahead. I’ll follow up on what you decide.'}</li>}
              </ol>
              {s.log.some((m) => (m.stage ?? 0) !== s.stage) && <button className="btn-link small" onClick={() => setEarlier(!earlier)}>{earlier ? 'Show this stage only' : 'Show earlier conversation'}</button>}
              {pendingRule?.ask && (
                <div className="ask-now">
                  <div className="choice-col">{pendingRule.ask.choices?.map((c) => <button key={c.id} className="choice" onClick={() => answer(c.id)}>{fill(c.label, s.design)}</button>)}</div>
                  {pendingRule.ask.free && <FreeAnswer placeholder={pendingRule.ask.free.placeholder} onSend={(t) => { update((y) => ({ ...y, answers: { ...y.answers, [pendingRule.id]: 'free' }, log: [...y.log, { at: Date.now(), who: 'you', text: t }, { at: Date.now(), who: 'interviewer', text: `What I was listening for: ${pendingRule.ask!.free!.listen}` }] })); setPending(null); }} />}
                </div>
              )}
              {pendingLink && (
                <div className="ask-now"><div className="choice-col">{[...new Set([...verbsFor(byId(s.design, pendingLink.from)?.kind ?? 'service', byId(s.design, pendingLink.to)?.kind ?? 'service'), ...script.verbs.slice(0, 2)])].map((v) => <button key={v} className="choice" onClick={() => answer(v)}>{v}</button>)}</div></div>
              )}
              {coach && !pending && <p className="coach"><Icon name="target" size={15} /> {fill(coach.coach!, s.design)}</p>}
              {!pending && <button className="btn btn-primary discuss" onClick={() => discuss()}><Icon name="spark" size={15} /> Discuss my design</button>}
              <p className="muted small">{guided ? 'Guided: the interviewer coaches as you work.' : 'Mock: the interviewer follows up on your decisions; coaching waits for the debrief.'}</p>
            </div>
          ) : (
            <HelpPanel script={script} stage={stage} level={helpLevel} setLevel={(l) => openHelp(l)} walkIx={walkIx} setWalkIx={(i) => { setWalkIx(i); if (stage.help.walkthrough[i]?.focus && hasCanvas(stage)) setView('solution'); }}
              onRetry={retry} onContinue={() => { setPanel('talk'); setView('mine'); }} showSolutionView={() => setView('solution')} />
          )}
        </aside>
        <section id="pane-brief" className="pane pane-brief" aria-label="Brief">
          <BriefPanel script={script} s={s} onClose={() => { setBriefOpen(false); setTab('workspace'); }} />
        </section>
      </div>
    </div>
  );
}

const hasCanvas = (st: Stage) => st.activity.kind === 'build';
const fmt = (ms: number) => { const t = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

function ActivityFor({ p, view, solutionMarks, next }: { p: ActProps; view: 'mine' | 'solution'; solutionMarks: Record<string, Mark>; next: () => void }) {
  const a = p.stage.activity;
  switch (a.kind) {
    case 'clarify': return <ClarifyActivity {...p} a={a} onNext={next} />;
    case 'build': return <BuildActivity {...p} a={a} view={view} solutionMarks={solutionMarks} />;
    case 'trace': return <TraceFailActivity {...p} a={a} />;
    case 'timeline': return <TimelineActivity {...p} a={a} />;
    case 'states': return <StatesActivity {...p} a={a} />;
    case 'roles': return <RolesActivity {...p} a={a} />;
    case 'model': return <ModelActivity {...p} a={a} />;
    case 'queue': return <QueueActivity {...p} a={a} />;
  }
}

function FreeAnswer({ placeholder, onSend }: { placeholder: string; onSend: (t: string) => void }) {
  const [t, setT] = useState('');
  return (
    <form className="free" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onSend(t.trim()); setT(''); } }}>
      <label><span className="visually-hidden">Your answer in a sentence or two</span><textarea rows={2} maxLength={400} value={t} onChange={(e) => setT(e.target.value)} placeholder={placeholder} /></label>
      <button className="btn btn-small" disabled={!t.trim()}>Say it</button>
    </form>
  );
}

// ── Help: hint → walkthrough → stage solution → full case solution ─────────────────────────────────

function HelpPanel({ script, stage, level, setLevel, walkIx, setWalkIx, onRetry, onContinue }: { script: InterviewScript; stage: Stage; level: HelpLevel; setLevel: (l: HelpLevel) => void; walkIx: number; setWalkIx: (i: number) => void; onRetry: () => void; onContinue: () => void; showSolutionView?: () => void }) {
  const h = stage.help;
  const [full, setFull] = useState(false);
  const steps: [HelpLevel, string][] = [[1, 'Hint'], [2, 'Walkthrough'], [3, 'Answer']];
  return (
    <div className="help">
      <p className="help-lede">Take as much help as you need, from a nudge to the full answer.</p>
      <div className="segmented help-levels" role="tablist" aria-label="How much help">
        {steps.map(([l, name]) => <button key={l} role="tab" aria-selected={level === l} onClick={() => setLevel(l)}>{name}</button>)}
      </div>
      <div className="help-body" aria-live="polite">
        {level === 1 && <p className="hint-q"><Rich text={h.hint} /></p>}
        {level === 2 && (
          <div className="walk">
            <ol className="walk-steps">{h.walkthrough.map((w, i) => <li key={i} className={i === walkIx ? 'now' : i < walkIx ? 'done' : ''} aria-current={i === walkIx ? 'step' : undefined}>{i <= walkIx ? <Rich text={w.text} /> : <span className="muted">Step {i + 1}</span>}</li>)}</ol>
            <div className="player">
              <button className="btn btn-small btn-quiet" disabled={walkIx === 0} onClick={() => setWalkIx(walkIx - 1)}><Icon name="arrow-left" size={14} /> Back</button>
              <button className="btn btn-small" disabled={walkIx >= h.walkthrough.length - 1} onClick={() => setWalkIx(walkIx + 1)}>Next step <Icon name="arrow-right" size={14} /></button>
            </div>
          </div>
        )}
        {level >= 3 && <div><Blocks blocks={h.solution} /><p className="why"><strong>Why this works:</strong> <Rich text={h.why} /></p></div>}
      </div>
      <button className="btn-link help-full" onClick={() => { setLevel(4); setFull(true); }}>See the full solution for this case</button>
      <div className="after-help">
        <button className="btn btn-primary" onClick={onContinue}>Back to my design</button>
        <button className="btn-link small" onClick={onRetry}>Start this step over</button>
      </div>
      {full && <FullSolution script={script} onClose={() => setFull(false)} />}
    </div>
  );
}

/** The whole case at once, in its own full-width panel: the design, one request traced through it, the trade-off. */
function FullSolution({ script, onClose }: { script: InterviewScript; onClose: () => void }) {
  const sol = script.solution;
  const pl = usePlayer(sol.trace.steps.length, 'full');
  const step = pl.started ? sol.trace.steps[pl.beat] : undefined;
  const marks: Record<string, Mark> = {};
  sol.trace.steps.slice(0, pl.started ? pl.beat + 1 : 0).forEach((st, i) => { marks[st.to] = { tone: i === pl.beat ? 'active' : 'ok' }; });
  const mode = sol.design.comps.some((c) => c.kind === 'class' || c.kind === 'enum' || c.kind === 'iface') ? 'classes' : 'architecture';
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const html = document.documentElement; const prev = html.style.overflow; html.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); html.style.overflow = prev; };
  }, [onClose]);
  return createPortal(
    <div className="full-root">
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <div className="full-sol" role="dialog" aria-modal="true" aria-labelledby="full-title" ref={ref} tabIndex={-1}>
        <div className="full-head">
          <h2 id="full-title">Full solution</h2>
          <button className="btn btn-small" onClick={onClose}>Close</button>
        </div>
        <div className="full-grid">
          <Builder graph={sol.design} palette={script.palette} verbs={script.verbs} mode={mode} readOnly label="Reference design" marks={marks} token={step ? { from: step.from, to: step.to, t: pl.t, label: '', tone: 'request' } : null} />
          <div className="full-text">
            <h3>{sol.trace.title}</h3>
            <div className="player-row">
              {!pl.started ? <button className="btn btn-small btn-primary" onClick={pl.play}><Icon name="play" size={14} /> Play it</button> : <><button className="btn btn-small" onClick={pl.playing ? pl.pause : pl.play}>{pl.playing ? 'Pause' : pl.done ? 'Play again' : 'Continue'}</button><button className="btn btn-small btn-quiet" onClick={pl.step} disabled={pl.done}>Next step</button></>}
            </div>
            <ol className="walk-steps">{sol.trace.steps.map((st, i) => <li key={i} className={pl.started && i === pl.beat ? 'now' : pl.started && i < pl.beat ? 'done' : ''}><Rich text={st.text} /></li>)}</ol>
            <h3>The main trade-off</h3><p><Rich text={sol.tradeoff} /></p>
            <h3>When another approach fits better</h3><p><Rich text={sol.otherApproach} /></p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Brief (always reachable; never unmounts the workspace) ─────────────────────────────────────────

function BriefPanel({ script, s, onClose }: { script: InterviewScript; s: SessionV2; onClose: () => void }) {
  const b = script.brief;
  const clar = script.stages.flatMap((st) => (st.activity.kind === 'clarify' ? [st.activity] : []))[0];
  return (
    <div className="brief" role="document">
      <div className="brief-head"><h2>Brief</h2><button className="icon-btn" onClick={onClose} aria-label="Close the brief"><Icon name="close" size={18} /></button></div>
      <p className="iv-who"><span className="avatar" aria-hidden="true">{b.interviewer.name[0]}</span> {b.interviewer.name} · {b.interviewer.role}</p>
      <p><Rich text={b.intro} /></p>
      <p className="first-move">“{b.firstMove}”</p>
      <h3>Who it’s for</h3><p>{b.users}</p>
      <h3>What they need to do</h3><ul>{b.needs.map((x) => <li key={x}>{x}</li>)}</ul>
      <h3>Must work correctly</h3><ul>{b.mustHold.map((x) => <li key={x}>{x}</li>)}</ul>
      <h3>Constraints</h3><ul>{b.constraints.map((x) => <li key={x}><Rich text={x} /></li>)}</ul>
      {b.outOfScope?.length ? <><h3>Out of scope</h3><ul>{b.outOfScope.map((x) => <li key={x}>{x}</li>)}</ul></> : null}
      {b.terms?.length ? <><h3>Terms</h3><dl className="terms">{b.terms.map((t) => <div key={t.term}><dt>{t.term}</dt><dd>{t.meaning}</dd></div>)}</dl></> : null}
      {clar && (
        <>
          <h3>What you’ve established</h3>
          <ul>
            {clar.questions.filter((q) => s.answers[`asked:${q.id}`]).map((q) => <li key={q.id}><span className="muted">{q.q}</span> {q.a}</li>)}
            {clar.assumptions.filter((a) => s.answers[`assume:${a.id}`]).map((a) => <li key={a.id}><strong>You assumed:</strong> {a.options.find((o) => o.id === s.answers[`assume:${a.id}`])?.label}</li>)}
            {!clar.questions.some((q) => s.answers[`asked:${q.id}`]) && <li className="muted">Nothing asked yet.</li>}
          </ul>
        </>
      )}
    </div>
  );
}

// ── Worked-solution comparison ───────────────────────────────────────────────────────────────────

function differences(script: InterviewScript, g: DesignGraph): { id: string; text: string; alt?: boolean }[] {
  const out: { id: string; text: string; alt?: boolean }[] = [];
  for (const c of script.solution.design.comps) {
    if (find(g, { type: c.type }).length) continue;
    const alt = script.solution.alternatives?.[c.id];
    if (alt && alt.types.some((t) => find(g, { type: t }).length)) out.push({ id: c.id, text: `Your design uses a different part for “${c.label}”. ${alt.tradeoff}`, alt: true });
    else out.push({ id: c.id, text: `The worked solution has ${c.label}: ${script.solution.why[c.id] ?? ''}` });
  }
  return out;
}

function adoptPart(script: InterviewScript, g: DesignGraph, id: string): DesignGraph {
  const sol = script.solution.design;
  const c = sol.comps.find((x) => x.id === id);
  if (!c || find(g, { type: c.type }).length) return g;
  const free = (x: number, y: number) => g.comps.every((k) => Math.hypot(k.x - x, k.y - y) > 90);
  const [g1, nid] = addComp(g, { type: c.type, kind: c.kind, label: c.label, ...(free(c.x, c.y) ? { x: c.x, y: c.y } : { x: Math.min(600, c.x + 60), y: Math.min(420, c.y + 50) }) });
  let next = g1;
  for (const l of sol.links) {
    const other = l.from === id ? l.to : l.to === id ? l.from : null;
    if (!other) continue;
    const t = sol.comps.find((x) => x.id === other)!.type;
    const mine = find(next, { type: t })[0];
    if (mine) [next] = l.from === id ? connect(next, nid, mine.id, l.label) : connect(next, mine.id, nid, l.label);
  }
  return next;
}

// ── Debrief ──────────────────────────────────────────────────────────────────────────────────────

function Debrief({ script, s, go, update, store, nav }: { script: InterviewScript; s: SessionV2; go: (i: number) => void; update: (f: (x: SessionV2) => SessionV2) => void; store: ReturnType<typeof useProgress>['store']; nav: ReturnType<typeof useNavigate> }) {
  const ctx: Ctx = { g: s.design, answers: s.answers, results: s.results };
  const { strengths, gaps } = debrief(script.rules, ctx);
  const assisted = script.stages.filter((st) => (s.help[st.id] ?? 0) >= 3);
  const stageIx = (id: string) => script.stages.findIndex((st) => st.id === id);
  const BAD = /^(oversold|stuck|fail|gaps|error|broken)$|:unbounded$/;
  const keyStage = (k: string) => (k.startsWith('trace:') ? 'design' : k.split(':')[0]);
  // What changed during the attempt: first outcome was poor, the latest is not.
  const learned = Object.entries(s.first ?? {}).filter(([k, v]) => BAD.test(v) && s.results[k] && !BAD.test(s.results[k])).map(([k]) => stageIx(keyStage(k))).filter((i) => i >= 0);
  // Questions the interviewer asked that the learner left open.
  const open = [...new Map(s.log.filter((e) => e.rule && script.rules.find((r) => r.id === e.rule)?.ask && !s.answers[e.rule]).map((e) => [e.rule!, e])).values()];
  const openRule = open.length ? script.rules.find((r) => r.id === open[0].rule) : undefined;
  const gapRule = gaps[0];
  const strong = strengths[0];
  const gapText = gapRule ? gapRule.gap!.text : openRule ? `You left a question open: “${fill(openRule.ask!.text, s.design)}”` : assisted.length ? `You used the solution for “${assisted[0].title}”.` : null;
  const fixText = gapRule ? gapRule.gap!.fix : openRule ? 'Go back and answer it: say which choice you’d defend and why.' : assisted.length ? `Try “${assisted[0].title}” again without help.` : 'Run it as a mock interview: no coaching until the debrief.';
  const hardest = gapRule ? stageIx(gapRule.gap!.stage) : openRule ? open[0].stage ?? stageIx(openRule.stage ?? '') : assisted[0] ? stageIx(assisted[0].id) : learned[0] ?? -1;
  const changeIx = script.stages.findIndex((st) => st.change?.alternate);
  const other = Object.values(SCRIPTS).filter((x) => x.caseId !== script.caseId && x.skills.some((k) => script.skills.includes(k))).sort((a, b) => Number(a.track === script.track) - Number(b.track === script.track))[0];
  const lessons = [...new Set([gapRule?.gap?.lesson, ...assisted.flatMap((st) => st.lessons ?? []), ...(hardest >= 0 ? script.stages[hardest].lessons?.slice(0, 1) ?? [] : [])].filter(Boolean) as string[])].slice(0, 3);
  const nameOf = (id: string) => topicById(id)?.short ?? topicById(id)?.title ?? id;
  const rubric = CASES[script.caseId]?.rubric ?? [];
  const [scores, setScores] = useState<Record<string, number>>(s.scores ?? {});
  useEffect(() => { if (!s.finishedAt) { update((x) => ({ ...x, finishedAt: Date.now() })); raiseStatus(store, script.caseId, 'studied'); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const startNew = (caseId: string, alternate = false) => {
    const sid = newSessionId(caseId);
    const base = { ...blank(caseId, s.mode) };
    store.set(`interview:${sid}`, alternate ? { ...base, design: s.design, states: s.states, answers: s.answers, stage: changeIx, reached: changeIx, alternate: true } : base);
    nav(`/interview/${sid}`);
  };
  return (
    <div className="debrief">
      <h2 className="iv-q">Debrief</h2>
      <div className="db-grid">
        <section className="db-card ok"><h3><Icon name="check" size={16} /> Strongest decision</h3><p>{strong ? fill(strong.strength!, s.design) : 'You worked through every stage. Discuss your design at each stage to get more specific feedback.'}</p>{strong?.stage && <button className="btn-link" onClick={() => go(stageIx(strong.stage!))}>See it in “{script.stages[stageIx(strong.stage!)]?.title}”</button>}</section>
        <section className="db-card warn"><h3><Icon name="alert" size={16} /> Most consequential gap</h3><p>{gapText ?? 'Nothing left open in what you built and answered.'}</p>{hardest >= 0 && gapText && <button className="btn-link" onClick={() => go(hardest)}>Go back to “{script.stages[hardest].title}”</button>}</section>
        <section className="db-card accent"><h3><Icon name="target" size={16} /> One concrete improvement</h3><p>{fixText}</p>{hardest >= 0 && <button className="btn btn-small" onClick={() => go(hardest)}>Apply it and replay</button>}</section>
      </div>
      {learned.length > 0 && <p className="db-growth"><Icon name="replay" size={15} /> During your attempt you changed your design and the outcome changed with it: {[...new Set(learned)].map((i) => `“${script.stages[i].title}”`).join(', ')}.</p>}
      {s.design.comps.length > 0 && (
        <details className="more" open>
          <summary>Your final design</summary>
          <div className="more-body"><Builder graph={s.design} palette={script.palette} verbs={script.verbs} mode={script.track === 'lld' ? 'classes' : 'architecture'} readOnly label="Your final design" /></div>
        </details>
      )}
      {lessons.length > 0 && <p className="db-lessons"><strong>Revisit:</strong> {lessons.map((l, i) => { const t = topicById(l); return t ? <span key={l}>{i > 0 && ' · '}<Link to={t.route}>{t.short ?? t.title}</Link></span> : null; })}</p>}
      <h3>Next</h3>
      <ul className="db-next">
        {hardest >= 0 && <li><button className="btn" onClick={() => go(hardest)}><Icon name="replay" size={15} /> Retry “{script.stages[hardest].title}”</button></li>}
        {changeIx >= 0 && <li><button className="btn" onClick={() => startNew(script.caseId, true)}><Icon name="alert" size={15} /> {script.stages[changeIx].change!.alternate!.label}</button></li>}
        {other && <li><button className="btn" onClick={() => startNew(other.caseId)}><Icon name="arrow-right" size={15} /> Same skill, new setting: {nameOf(other.caseId)}</button></li>}
      </ul>
      {assisted.length > 0 && <p className="muted small">Assisted stages (private): {assisted.map((st) => st.title).join(', ')}. They stay in your progress until you complete them on your own.</p>}
      {rubric.length > 0 && (
        <details className="more">
          <summary>Rate yourself against the rubric (optional)</summary>
          <div className="more-body">
            {rubric.map((r) => (
              <div key={r.area} className="rub"><p><strong>{r.area}</strong> <span className="muted">Strong: {r.strong}</span></p>
                <div className="choice-row">{['Missing', 'Partial', 'Strong'].map((lbl, i) => <button key={lbl} className="choice small" aria-pressed={scores[r.area] === i} onClick={() => setScores({ ...scores, [r.area]: i })}>{lbl}</button>)}</div></div>
            ))}
            <button className="btn btn-small btn-primary" disabled={Object.keys(scores).length < rubric.length} onClick={() => { update((x) => ({ ...x, scores })); recordSelf(store, script.caseId, { ratings: Object.fromEntries(Object.entries(scores).map(([k, v]) => [`interview: ${k}`, v])) }); }}>Save my ratings</button>
            <p className="muted small">Self-ratings are kept apart from graded evidence.</p>
          </div>
        </details>
      )}
    </div>
  );
}
