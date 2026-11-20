/**
 * Case study reader. A case is a sequence of decisions: clarify → first design → critical path → failure →
 * changed requirement → compare (HLD), or model → invariants → tests → change (LLD).
 *
 * Two ways through (brief §3 B6, §10):
 *  - Guided walkthrough: the reference design is drawn stage by stage and reference answers open on request.
 *  - Independent attempt: the reference design stays hidden. The learner sketches and writes first; each stage's
 *    reference (and the reference diagram) appears only after their answer is saved. The wrap-up compares their
 *    answers with the reference. Only this mode, without hints, can count as "solved independently".
 * Rubric ratings are self-assessment and never change the topic's status.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CASES } from '../../content/cases';
import { guaranteesFor } from '../../content/cases/guarantees';
import { topicById } from '../../content/curriculum';
import { Diagram } from '../components/Diagram';
import { Caption, Controls, LessonShell, Sources, useStep, Question } from '../components/Lesson';
import { SaveStatus } from '../components/Draft';
import { Blocks } from '../lessons/GenericLesson';
import { Rich } from '../components/Rich';
import { Icon } from '../components/Icon';
import { Workspace, EMPTY_DIAGRAM, type WsDiagram } from '../components/Workspace';
import { EvidenceScope, useOutcome } from '../components/Exercise';
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { raiseStatus } from '../../progress/activity';
import { recordSelf } from '../../progress/evidence';
import type { CaseStage } from '../../content/caseTypes';
import type { DNode, DEdge } from '../components/Diagram';
import type { StepView } from '../../content/lessonTypes';

const KIND_LABEL: Record<CaseStage['kind'], string> = {
  clarify: 'Clarify', simple: 'First design', 'critical-path': 'Critical path', failure: 'Failure', change: 'Changed requirement', compare: 'Compare', model: 'Model', invariants: 'Invariants', tests: 'Tests',
};

type Mode = 'guided' | 'independent';
interface StageDraft { text: string; hints: number; shown: boolean; savedAt?: number; attemptedFirst?: boolean }

function applyView(nodes: DNode[], edges: DEdge[], v: StepView = {}) {
  return {
    nodes: nodes.map((n) => ({ ...n, state: v.hide?.includes(n.id) ? ('ghost' as const) : v.dim?.includes(n.id) ? ('dim' as const) : v.states?.[n.id] ?? n.state, value: v.values?.[n.id] ?? n.value, tag: v.tags && n.id in v.tags ? v.tags[n.id] : n.tag })),
    edges: edges.map((e) => ({ ...e, state: v.edgeStates?.[e.id] ?? e.state })),
  };
}

export default function CaseStudyPage({ id }: { id: string }) {
  const cs = CASES[id];
  const topic = topicById(id)!;
  const { store } = useProgress();
  const [mode, setMode] = useRecord<Mode | null>(`pref:case-mode:${id}`, null);
  const count = cs.stages.length + 1;
  const { step, next, back, go, reachable } = useStep(id, count, { reachable: mode ? undefined : 0 });
  const stage = cs.stages[step] as CaseStage | undefined;
  const paired = cs.pairedWith ? topicById(cs.pairedWith) : undefined;
  const [stageDraft] = useRecord<StageDraft | null>(`draft:case:${id}:${step}`, null);
  useEffect(() => {
    if (step === count - 1) raiseStatus(store, id, 'studied');
  }, [step, count, store, id]);
  const isLld = topic.kind === 'case-lld';
  const independent = mode === 'independent';
  // In independent mode the reference design for a stage appears only once that stage's own answer is saved.
  const showReferenceDiagram = mode === 'guided' || (independent && (step === count - 1 || !!stageDraft?.shown));
  const view = stage?.view ?? (step === count - 1 ? {} : undefined);
  const { nodes, edges } = applyView(cs.diagram.nodes, cs.diagram.edges, view);

  return (
    <EvidenceScope required={cs.checks.map((c) => c.id)}>
      <LessonShell
        id={id}
        crumbs={<><Link to={`/topics#${topic.category}`}>{isLld ? 'LLD case studies' : 'HLD case studies'}</Link><span className="sep">/</span>{topic.short ?? topic.title}</>}
        title={topic.title}
        opening={<><strong>The prompt:</strong> “{cs.prompt}”{paired && <> <span className="muted">Paired with <Link to={paired.route}>{paired.title}</Link>, the same feature at the other zoom level.</span></>}</>}
      >
        {!mode ? (
          <ModePicker onPick={(m) => setMode(m)} isLld={isLld} />
        ) : (
          <>
            <div className="toolbar" style={{ justifyContent: 'space-between' }}>
              <span className="muted small">{independent ? 'Independent attempt: references open after you save each answer.' : 'Guided walkthrough: the reference design is shown as you go.'}</span>
              <div className="segmented" role="group" aria-label="How to work through this case">
                <button aria-pressed={mode === 'guided'} onClick={() => setMode('guided')}>Guided</button>
                <button aria-pressed={independent} onClick={() => setMode('independent')}>Independent</button>
              </div>
            </div>
            {showReferenceDiagram ? (
              <section className="stage" aria-label={independent ? 'Reference design for this stage' : 'Design diagram'}>
                {independent && step < count - 1 && <div className="stage-top"><span className="stage-label">Reference design at this stage (shown after your answer)</span></div>}
                <Diagram nodes={nodes} edges={edges} wide={cs.diagram.wide} narrow={cs.diagram.narrow} description={stage ? stage.title : 'Final design'} />
              </section>
            ) : (
              <SketchStage caseId={id} isLld={isLld} />
            )}

            {stage ? <StageView key={step} caseId={id} stage={stage} index={step} mode={mode} /> : <Wrap caseId={id} mode={mode} />}
          </>
        )}

        <Controls
          step={step}
          count={count}
          onBack={back}
          onNext={next}
          nextLabel={step + 1 < cs.stages.length ? cs.stages[step + 1].title : step + 1 === cs.stages.length ? 'Check yourself' : undefined}
          nextDisabled={step >= reachable}
          nextHint={!mode ? 'Choose guided or independent above to begin' : undefined}
          steps={[...cs.stages.map((s) => s.title), 'Check yourself']}
          reachable={reachable}
          onJump={go}
        />

        {step === 0 && (
          <details className="more">
            <summary>Assumptions used in this case</summary>
            <div className="more-body"><ul>{cs.assumptions.map((a, i) => <li key={i}><Rich text={a} /></li>)}</ul></div>
          </details>
        )}
        <Sources sources={topic.sources} />
      </LessonShell>
    </EvidenceScope>
  );
}

function ModePicker({ onPick, isLld }: { onPick: (m: Mode) => void; isLld: boolean }) {
  return (
    <section aria-label="Choose how to work through this case" style={{ marginTop: 4 }}>
      <div className="grid-2">
        <button className="mode-card" onClick={() => onPick('guided')}>
          <span className="kicker accent">Learn the approach</span>
          <strong>Guided walkthrough</strong>
          <span>The reference {isLld ? 'model' : 'architecture'} is drawn stage by stage. Write a short answer at each stage if you like, and open hints and reference answers whenever you want.</span>
        </button>
        <button className="mode-card" onClick={() => onPick('independent')}>
          <span className="kicker accent">Test yourself</span>
          <strong>Independent attempt</strong>
          <span>The reference stays hidden. Sketch and write your own design first; each stage’s reference opens after you save your answer. Then compare, and face a failure and a changed requirement.</span>
        </button>
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>You can switch at any time. Only an independent attempt without hints can count as solved independently.</p>
    </section>
  );
}

function SketchStage({ caseId, isLld }: { caseId: string; isLld: boolean }) {
  const [sketch, setSketch] = useRecord<{ diagram: WsDiagram; savedAt?: number }>(`draft:case-sketch:${caseId}`, { diagram: EMPTY_DIAGRAM });
  return (
    <section className="stage" aria-label="Your sketch">
      <div className="stage-top">
        <span className="stage-label"><Icon name="pencil" size={15} /> Your {isLld ? 'classes and states' : 'design'} (the reference stays hidden until you save each answer)</span>
        <span className="save-note" style={{ margin: 0 }}><SaveStatus savedAt={sketch.savedAt} /></span>
      </div>
      <Workspace value={sketch.diagram} onChange={(diagram) => setSketch({ diagram, savedAt: Date.now() })} />
    </section>
  );
}

function StageView({ caseId, stage, index, mode }: { caseId: string; stage: CaseStage; index: number; mode: Mode }) {
  const [st, setSt] = useRecord<StageDraft>(`draft:case:${caseId}:${index}`, { text: '', hints: 0, shown: false });
  const set = (p: Partial<StageDraft>) => setSt({ ...st, ...p, savedAt: Date.now() });
  const independent = mode === 'independent';
  const canReveal = !independent || st.text.trim().length >= 8;
  return (
    <>
      <Caption kicker={KIND_LABEL[stage.kind]} title={stage.title}>
        <p><Rich text={stage.task} /></p>
      </Caption>
      <div className="question">
        <label className="field" htmlFor={`case-${index}`} style={{ marginBottom: 6 }}>
          <span>{independent ? 'Your answer (required before the reference opens)' : 'Your answer (optional: a sentence or two, or a list)'}</span>
        </label>
        <textarea id={`case-${index}`} rows={3} style={{ minHeight: 88 }} value={st.text} onChange={(e) => set({ text: e.target.value })} placeholder="Write before you look." readOnly={independent && st.shown} />
        <p className="save-note"><SaveStatus savedAt={st.savedAt} />{st.hints > 0 && <span>· {st.hints} hint{st.hints > 1 ? 's' : ''} used</span>}</p>
        {stage.hints.slice(0, st.hints).map((h, i) => <div key={i} className="callout enter"><strong>Hint {i + 1}</strong><Rich text={h} /></div>)}
        <div className="toolbar" style={{ marginBottom: 0 }}>
          {!st.shown && st.hints < stage.hints.length && (
            <button className="btn btn-small btn-quiet" onClick={() => set({ hints: st.hints + 1 })}>{st.hints ? 'Another hint' : 'Show a hint'}</button>
          )}
          {!st.shown ? (
            <button className="btn btn-small btn-primary" disabled={!canReveal} onClick={() => set({ shown: true, attemptedFirst: st.text.trim().length >= 8 })}>
              {independent ? 'Save my answer and open the reference' : 'Show the reference answer'}
            </button>
          ) : !independent ? (
            <button className="btn btn-small" onClick={() => set({ shown: false })}>Hide the reference answer</button>
          ) : null}
          {independent && !canReveal && <span className="muted small">Write at least a few words first.</span>}
        </div>
      </div>
      {st.shown && (
        <div className="enter" style={{ maxWidth: 'var(--read)', marginTop: 16 }}>
          {independent && st.text.trim() && (
            <div className="compare" style={{ marginBottom: 12 }}>
              <div className="compare-side"><h3>Your answer</h3><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{st.text}</p></div>
              <div className="compare-side ok"><h3>Reference</h3><Blocks blocks={stage.reference} /></div>
            </div>
          )}
          {!(independent && st.text.trim()) && (
            <div className="caption" style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 14 }}>
              <p className="step-kicker">Reference answer</p>
              <Blocks blocks={stage.reference} />
            </div>
          )}
          <p className="muted small">A different answer can be just as good if its assumptions are stated and it meets the requirements. Note what you would revise, then continue.</p>
        </div>
      )}
    </>
  );
}

function Wrap({ caseId, mode }: { caseId: string; mode: Mode }) {
  const cs = CASES[caseId];
  const { store } = useProgress();
  const record = useOutcome(caseId);
  const [scores, setScores] = useRecord<Record<string, number>>(`draft:case-rubric:${caseId}`, {});
  const drafts = cs.stages.map((_, i) => store.get<StageDraft>(`draft:case:${caseId}:${i}`));
  const hintsUsed = drafts.reduce((a, d) => a + (d?.hints ?? 0), 0);
  const attemptedAll = drafts.every((d) => d?.attemptedFirst);
  // Objective checks count as independent only after an independent attempt with no hints.
  const helped = mode !== 'independent' || hintsUsed > 0 || !attemptedAll;
  return (
    <>
      <Caption kicker="Wrap-up" title="Check yourself">
        <p>
          {cs.checks.length === 1 ? 'One graded check' : `${cs.checks.length} graded checks`}, then compare your design with the reference and rate it against the rubric.
          {helped
            ? ' Because you used the guided walkthrough, hints, or skipped an answer, correct checks count as solved with help.'
            : ' You worked independently with no hints, so checks right first time count as solved independently.'}
        </p>
      </Caption>
      {cs.checks.map((c) => c.kind === 'choice' && (
        <Question key={c.id} recordKey={`${caseId}:${c.id}`} prompt={<Rich text={c.prompt} />} choices={c.choices.map((x) => ({ id: x.id, text: <Rich text={x.text} /> }))} correct={c.correct}
          onAnswered={(p) => record(c.id, p === c.correct, helped, c.prompt.replace(/[*`]/g, ''))}
          explain={(p) => <p><Rich text={c.choices.find((x) => x.id === p)?.why ?? ''} /></p>} />
      ))}
      {mode === 'independent' && (
        <div className="caption">
          <h3 style={{ fontSize: 19 }}>Your design next to the reference</h3>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Stage</th><th>You wrote</th></tr></thead>
              <tbody>
                {cs.stages.map((s, i) => (
                  <tr key={i}><td><strong>{s.title}</strong></td><td style={{ whiteSpace: 'pre-wrap' }}>{drafts[i]?.text?.trim() || <span className="muted">No answer saved</span>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Open each stage with the step list to see its reference answer beside yours.</p>
        </div>
      )}
      {guaranteesFor(caseId) && (() => {
        const g = guaranteesFor(caseId)!;
        const isHld = g.hld === caseId;
        const other = topicById(isHld ? g.lld : g.hld);
        return (
          <div className="caption">
            <h3 style={{ fontSize: 19 }}>Who guarantees what, at both zoom levels</h3>
            <p className="muted small">This case is paired with <Link to={other?.route ?? '/topics'}>{other?.title}</Link>. Each promise has an owner in the architecture and a mechanism inside that owner.</p>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Promise</th><th>HLD: which part owns it</th><th>LLD: what enforces it</th><th>What would change it</th></tr></thead>
                <tbody>{g.rows.map((r) => <tr key={r.behavior}><td><strong>{r.behavior}</strong></td><td><Rich text={r.hld} /></td><td><Rich text={r.lld} /></td><td><Rich text={r.changes} /></td></tr>)}</tbody>
              </table>
            </div>
          </div>
        );
      })()}
      {cs.alternatives && cs.alternatives.length > 0 && (
        <div className="caption">
          <h3 style={{ fontSize: 19 }}>Defensible alternatives, and what would change the answer</h3>
          <div className="table-wrap"><table className="data"><thead><tr><th>Option</th><th>Choose it when</th><th>Cost</th></tr></thead>
            <tbody>{cs.alternatives.map((a) => <tr key={a.name}><td><strong>{a.name}</strong></td><td><Rich text={a.when} /></td><td><Rich text={a.cost} /></td></tr>)}</tbody></table></div>
        </div>
      )}
      <div className="question">
        <p className="step-kicker">Rubric · self-assessment</p>
        <h3>How strong was your answer in each area?</h3>
        <p className="muted small" style={{ marginTop: -6 }}>Your ratings are saved apart from the graded checks. Areas you rate below “Strong” go to your mistake notebook for revision; ratings never mark a case as solved.</p>
        {cs.rubric.map((r) => (
          <div key={r.area} style={{ marginBottom: 14 }}>
            <p style={{ margin: '0 0 2px', fontWeight: 650 }}>{r.area}</p>
            <p className="muted" style={{ margin: '0 0 8px', fontSize: 15 }}>Strong looks like: <Rich text={r.strong} /></p>
            <div className="segmented" role="radiogroup" aria-label={r.area}>
              {['Missing', 'Partial', 'Strong'].map((lbl, i) => (
                <button key={lbl} role="radio" aria-checked={scores[r.area] === i}
                  onClick={() => {
                    const nextScores = { ...scores, [r.area]: i };
                    setScores(nextScores);
                    recordSelf(store, caseId, { ratings: { [r.area]: i } });
                    const mk = `mistake:${caseId}:rubric-${r.area.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                    if (i < 2) store.set(mk, { lessonId: caseId, text: `${r.area}: ${r.strong}`, self: true, at: Date.now(), resolved: false });
                    else if (store.get(mk)) store.set(mk, { ...(store.get(mk) as object), resolved: true });
                  }}>{lbl}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
