/**
 * Case study reader. A case is a sequence of decisions on one stable diagram:
 * clarify → simple design → critical path → failure → changed requirement → compare,
 * with a short learner note at each stage, progressive hints, and a reference answer on request.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CASES } from '../../content/cases';
import { topicById } from '../../content/curriculum';
import { Diagram } from '../components/Diagram';
import { Caption, Controls, LessonShell, Sources, useStep, Question } from '../components/Lesson';
import { SaveStatus } from '../components/Draft';
import { Blocks } from '../lessons/GenericLesson';
import { Rich } from '../components/Rich';
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { raiseStatus } from '../../progress/activity';
import type { CaseStage } from '../../content/caseTypes';
import type { DNode, DEdge } from '../components/Diagram';
import type { StepView } from '../../content/lessonTypes';

const KIND_LABEL: Record<CaseStage['kind'], string> = {
  clarify: 'Clarify', simple: 'First design', 'critical-path': 'Critical path', failure: 'Failure', change: 'Changed requirement', compare: 'Compare', model: 'Model', invariants: 'Invariants', tests: 'Tests',
};

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
  const count = cs.stages.length + 1;
  const { step, next, back } = useStep(id, count);
  const stage = cs.stages[step] as CaseStage | undefined;
  const paired = cs.pairedWith ? topicById(cs.pairedWith) : undefined;
  useEffect(() => {
    if (step === count - 1) raiseStatus(store, id, 'studied');
  }, [step, count, store, id]);
  const view = stage?.view ?? (step === count - 1 ? {} : undefined);
  const { nodes, edges } = applyView(cs.diagram.nodes, cs.diagram.edges, view);
  const isLld = topic.kind === 'case-lld';

  return (
    <LessonShell
      id={id}
      crumbs={<><Link to={`/topics#${topic.module}`}>{isLld ? 'LLD case studies' : 'HLD case studies'}</Link> / {topic.short ?? topic.title}</>}
      title={topic.title}
      opening={<><strong>The prompt:</strong> “{cs.prompt}”{paired && <> <span className="muted">Paired with <Link to={paired.route}>{paired.title}</Link>.</span></>}</>}
    >
      <section className="stage" aria-label="Design diagram">
        <Diagram nodes={nodes} edges={edges} wide={cs.diagram.wide} narrow={cs.diagram.narrow} description={stage ? stage.title : 'Final design'} />
      </section>

      {stage ? <StageView caseId={id} stage={stage} index={step} /> : <Wrap caseId={id} />}

      <Controls step={step} count={count} onBack={back} onNext={next} nextLabel={step + 1 < cs.stages.length ? cs.stages[step + 1].title : step + 1 === cs.stages.length ? 'Check yourself' : undefined} />

      {step === 0 && (
        <details className="more">
          <summary>Assumptions used in this case</summary>
          <div className="more-body"><ul>{cs.assumptions.map((a, i) => <li key={i}><Rich text={a} /></li>)}</ul></div>
        </details>
      )}
      <Sources sources={topic.sources} />
    </LessonShell>
  );
}

function StageView({ caseId, stage, index }: { caseId: string; stage: CaseStage; index: number }) {
  const [st, setSt] = useRecord<{ text: string; hints: number; shown: boolean; savedAt?: number }>(`draft:case:${caseId}:${index}`, { text: '', hints: 0, shown: false });
  const set = (p: Partial<typeof st>) => setSt({ ...st, ...p, savedAt: Date.now() });
  return (
    <>
      <Caption kicker={KIND_LABEL[stage.kind]} title={stage.title}>
        <p><Rich text={stage.task} /></p>
      </Caption>
      <div className="question" style={{ background: 'var(--surface)' }}>
        <label className="field" htmlFor={`case-${index}`} style={{ marginBottom: 6 }}><span>Your answer (a sentence or two, or a list)</span></label>
        <textarea id={`case-${index}`} rows={3} style={{ minHeight: 84 }} value={st.text} onChange={(e) => set({ text: e.target.value })} placeholder="Write before you look." />
        <p className="save-note"><SaveStatus savedAt={st.savedAt} /></p>
        {stage.hints.slice(0, st.hints).map((h, i) => <div key={i} className="callout"><strong>Hint {i + 1}</strong><Rich text={h} /></div>)}
        <div className="toolbar" style={{ marginBottom: 0 }}>
          {st.hints < stage.hints.length && <button className="btn btn-small" onClick={() => set({ hints: st.hints + 1 })}>{st.hints ? 'Another hint' : 'Hint'}</button>}
          <button className={`btn btn-small ${st.shown ? '' : 'btn-primary'}`} onClick={() => set({ shown: !st.shown })}>{st.shown ? 'Hide reference answer' : 'Show a reference answer'}</button>
        </div>
      </div>
      {st.shown && (
        <div className="caption" style={{ borderLeft: '4px solid var(--accent)', paddingLeft: 14 }}>
          <p className="step-kicker">Reference answer</p>
          <Blocks blocks={stage.reference} />
          <p className="muted" style={{ fontSize: 14 }}>A different answer can be just as good if its assumptions are stated and it meets the requirements.</p>
        </div>
      )}
    </>
  );
}

function Wrap({ caseId }: { caseId: string }) {
  const cs = CASES[caseId];
  const { store } = useProgress();
  const [scores, setScores] = useRecord<Record<string, number>>(`draft:case-rubric:${caseId}`, {});
  return (
    <>
      <Caption kicker="Wrap-up" title="Check yourself">
        <p>Two quick checks, then rate your own answers against the rubric. Your ratings are saved, and weak areas come back for revision.</p>
      </Caption>
      {cs.checks.map((c) => c.kind === 'choice' && (
        <Question key={c.id} recordKey={`${caseId}:${c.id}`} prompt={<Rich text={c.prompt} />} choices={c.choices.map((x) => ({ id: x.id, text: <Rich text={x.text} /> }))} correct={c.correct}
          onAnswered={(p) => { if (p === c.correct) raiseStatus(store, caseId, 'hinted'); else store.set(`mistake:${caseId}:${c.id}`, { lessonId: caseId, text: c.prompt, at: Date.now(), resolved: false }); }}
          explain={(p) => <p><Rich text={c.choices.find((x) => x.id === p)?.why ?? ''} /></p>} />
      ))}
      {cs.alternatives && cs.alternatives.length > 0 && (
        <div className="caption">
          <h3 style={{ fontSize: 18 }}>Defensible alternatives</h3>
          <div className="table-wrap"><table className="data"><thead><tr><th>Option</th><th>Choose it when</th><th>Cost</th></tr></thead>
            <tbody>{cs.alternatives.map((a) => <tr key={a.name}><td><strong>{a.name}</strong></td><td><Rich text={a.when} /></td><td><Rich text={a.cost} /></td></tr>)}</tbody></table></div>
        </div>
      )}
      <div className="question">
        <p className="step-kicker" style={{ margin: 0 }}>Rubric</p>
        <h3>How strong was your answer in each area?</h3>
        {cs.rubric.map((r) => (
          <div key={r.area} style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{r.area}</p>
            <p className="muted" style={{ margin: '0 0 6px', fontSize: 15 }}>Strong: <Rich text={r.strong} /></p>
            <div className="toolbar" style={{ margin: 0 }} role="radiogroup" aria-label={r.area}>
              {['Missing', 'Partial', 'Strong'].map((lbl, i) => (
                <button key={lbl} className={`btn btn-small ${scores[r.area] === i ? 'btn-primary' : ''}`} role="radio" aria-checked={scores[r.area] === i}
                  onClick={() => { const nextScores = { ...scores, [r.area]: i }; setScores(nextScores); if (i < 2) store.set(`mistake:${caseId}:rubric-${r.area.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { lessonId: caseId, text: `${r.area}: ${r.strong}`, at: Date.now(), resolved: false }); if (Object.keys(nextScores).length === cs.rubric.length && Object.values(nextScores).every((v) => v === 2)) raiseStatus(store, caseId, 'independent'); }}>{lbl}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
