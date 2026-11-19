/**
 * Shared lab structure (MASTER_PROMPT §8): a prediction, a meaningful control, an observable
 * consequence, and a fresh problem. Same reader controls as lessons; deterministic simulations.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Caption, Controls, LessonShell, Metrics, More, Question, Sources, useStep, type PrimaryAction } from '../components/Lesson';
import { EvidenceScope, ShortAnswer, useOutcome, type ShortAnswerSpec } from '../components/Exercise';
import { topicById } from '../../content/curriculum';
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { raiseStatus } from '../../progress/activity';
import { recordSelf, type SelfAssessment } from '../../progress/evidence';
import type { ChoiceQuestion } from '../../content/lessonTypes';
import { Rich } from '../components/Rich';
import { Icon } from '../components/Icon';

export interface LabProps {
  id: string;
  opening: string;
  /** The situation the prediction is about, drawn above the question. */
  predictVisual?: () => ReactNode;
  predict: ChoiceQuestion;
  experiment: { title: string; body: string; render: () => ReactNode; action?: () => PrimaryAction | undefined };
  explain: { title: string; body: string[] };
  fresh: {
    question: ChoiceQuestion;
    reveal: () => ReactNode;
    /** Drawn above the fresh question (e.g. the new starting state). */
    visual?: () => ReactNode;
    /** Distinguishes generated problems so each one is answered fresh. */
    key?: string;
    /** Offer another generated problem after this one is answered. */
    another?: { label: string; onClick: () => void };
  };
  exercise: ShortAnswerSpec;
  assumptions: string[];
}

const STEPS = ['Predict', 'Experiment', 'What happened', 'A fresh problem'];

export function LabFrame(p: LabProps) {
  const { store } = useProgress();
  const topic = topicById(p.id)!;
  const [pred] = useRecord<{ attempts: unknown[] } | null>(`quiz:${p.id}:${p.predict.id}`, null);
  const freshKey = `${p.id}:${p.fresh.question.id}${p.fresh.key ? `:${p.fresh.key}` : ''}`;
  const [fresh] = useRecord<{ attempts: { picked: string }[] } | null>(`quiz:${freshKey}`, null);
  const { step, next, back, go, reachable } = useStep(p.id, STEPS.length, { reachable: pred?.attempts?.length ? undefined : 0 });
  useEffect(() => {
    if (step === STEPS.length - 1) raiseStatus(store, p.id, 'studied');
  }, [step, store, p.id]);

  const action = step === 1 ? p.experiment.action?.() : undefined;

  return (
    <EvidenceScope required={[p.fresh.question.id]}>
      <LessonShell id={p.id} crumbs={<><Link to="/topics#labs">Labs</Link><span className="sep">/</span>{topic.short ?? topic.title}</>} title={topic.title} opening={<Rich text={p.opening} />}>
        {step === 0 && (
          <>
            {p.predictVisual && <section className="stage" aria-label="Starting state">{p.predictVisual()}</section>}
            <Caption kicker="Predict" title="Before you touch anything">
              <p>Commit to a guess. The next step lets you test it, so a wrong guess costs nothing and shows you what to watch for.</p>
            </Caption>
            <Question
              key={p.predict.id}
              isPrediction
              required={!pred?.attempts?.length}
              recordKey={`${p.id}:${p.predict.id}`}
              prompt={<Rich text={p.predict.prompt} />}
              choices={p.predict.choices.map((x) => ({ id: x.id, text: <Rich text={x.text} /> }))}
              correct={p.predict.correct}
              explain={(picked) => <p><Rich text={p.predict.choices.find((x) => x.id === picked)?.why ?? ''} /></p>}
            />
          </>
        )}
        {step === 1 && (
          <>
            <section className="stage" aria-label="Experiment">{p.experiment.render()}</section>
            <Caption kicker="Experiment" title={p.experiment.title}><p><Rich text={p.experiment.body} /></p></Caption>
          </>
        )}
        {step === 2 && (
          <Caption kicker="Explain" title={p.explain.title}>
            {p.explain.body.map((b, i) => <p key={i}><Rich text={b} /></p>)}
          </Caption>
        )}
        {step === 2 && <ShortAnswer lessonId={p.id} spec={p.exercise} />}
        {step === 3 && (
          <>
            {p.fresh.visual && <section className="stage" aria-label="Fresh problem">{p.fresh.visual()}</section>}
            <Caption kicker="Fresh problem" title="Same mechanism, new situation">
              <p>Answer before you look anything up: this is the check that counts as evidence. Then compare with the simulation.</p>
            </Caption>
            <FreshQuestion labId={p.id} q={p.fresh.question} recordKey={freshKey} />
            {fresh?.attempts?.length ? (
              <>
                <section className="stage enter" style={{ marginTop: 16 }} aria-label="Answer from the simulation">{p.fresh.reveal()}</section>
                <Confidence labId={p.id} itemKey={freshKey} />
                {p.fresh.another && (
                  <div className="toolbar" style={{ marginTop: 14 }}>
                    <button className="btn" onClick={p.fresh.another.onClick}><Icon name="replay" size={16} /> {p.fresh.another.label}</button>
                  </div>
                )}
              </>
            ) : null}
          </>
        )}
        <Controls step={step} count={STEPS.length} onBack={back} onNext={next} nextLabel={STEPS[step + 1]}
          nextDisabled={step >= reachable} nextHint={step >= reachable ? 'Make a prediction above to continue' : undefined}
          action={action} steps={STEPS} reachable={reachable} onJump={go} />
        <More summary="Model assumptions">
          <ul>{p.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
          <p className="muted" style={{ fontSize: 14 }}>The simulation is deterministic: the same settings always produce the same result, so you can replay any run exactly.</p>
        </More>
        <Sources sources={topic.sources} />
      </LessonShell>
    </EvidenceScope>
  );
}

function FreshQuestion({ labId, q, recordKey }: { labId: string; q: ChoiceQuestion; recordKey: string }) {
  const record = useOutcome(labId);
  return (
    <Question
      key={recordKey}
      recordKey={recordKey}
      prompt={<Rich text={q.prompt} />}
      choices={q.choices.map((x) => ({ id: x.id, text: <Rich text={x.text} /> }))}
      correct={q.correct}
      onAnswered={(picked) => { if (q.correct) record(q.id, picked === q.correct, false, q.prompt.replace(/[*`]/g, '')); }}
      explain={(picked) => <p><Rich text={q.choices.find((x) => x.id === picked)?.why ?? ''} /></p>}
    />
  );
}

/** Confidence is self-assessment: stored apart from the graded answer and never changes the topic's status. */
function Confidence({ labId, itemKey }: { labId: string; itemKey: string }) {
  const { store } = useProgress();
  const [self] = useRecord<SelfAssessment | null>(`self:${labId}`, null);
  const cur = self?.confidence?.[itemKey];
  return (
    <div className="question" style={{ background: 'transparent' }} role="group" aria-label="How sure were you?">
      <p className="step-kicker">Self-assessment</p>
      <h3 style={{ marginBottom: 10 }}>How sure were you before you saw the answer?</h3>
      <div className="segmented">
        {[['guess', 'I guessed'], ['fairly', 'Fairly sure'], ['sure', 'Certain']].map(([id, label]) => (
          <button key={id} aria-pressed={cur === id} onClick={() => recordSelf(store, labId, { confidence: { [itemKey]: id } })}>{label}</button>
        ))}
      </div>
      <p className="muted small" style={{ margin: '10px 0 0' }}>Saved separately from your answer. It helps you spot lucky guesses; it doesn’t change what counts as solved.</p>
    </div>
  );
}

export function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="range-row" style={{ fontSize: 15, marginBottom: 8 }}>
      <span style={{ minWidth: 150, fontWeight: 600 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={`${value} ${unit}`} />
      <span className="mono" style={{ minWidth: 96, textAlign: 'right' }}>{value.toLocaleString()} {unit}</span>
    </label>
  );
}

export function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: '0 0 8px' }}>
      <legend style={{ fontSize: 15, marginBottom: 4 }}>{label}</legend>
      <div className="toolbar" style={{ margin: 0 }}>
        <div className="segmented">
          {options.map((o) => (
            <button key={o.id} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
          ))}
        </div>
      </div>
    </fieldset>
  );
}

/**
 * The lab's readout (D14): the few numbers the control changes, right under the controls, with the ones that
 * changed on the last input marked. Values are formatted strings so the comparison matches what is shown.
 */
export function Readout({ items, children }: { items: { name: string; value: string; tone?: 'good' | 'bad' }[]; children?: ReactNode }) {
  const prev = useRef<Record<string, string> | null>(null);
  const changed = useRef<Set<string>>(new Set());
  const now = Object.fromEntries(items.map((i) => [i.name, i.value]));
  if (prev.current && JSON.stringify(prev.current) !== JSON.stringify(now)) {
    changed.current = new Set(items.filter((i) => prev.current![i.name] !== i.value).map((i) => i.name));
  }
  prev.current = now;
  return (
    <div aria-live="polite" style={{ marginTop: 12 }}>
      <Metrics items={items.map((i) => ({ ...i, changed: changed.current.has(i.name) }))} />
      {children && <p className="small" style={{ margin: '4px 0 10px', color: 'var(--ink-2)' }}>{children}</p>}
    </div>
  );
}
