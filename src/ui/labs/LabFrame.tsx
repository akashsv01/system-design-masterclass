/**
 * Shared lab structure (MASTER_PROMPT §8): a prediction, a meaningful control, an observable
 * consequence, and a fresh problem. Same reader controls as lessons; deterministic simulations.
 */
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Caption, Controls, LessonShell, More, Question, Sources, useStep } from '../components/Lesson';
import { ShortAnswer, type ShortAnswerSpec } from '../components/Exercise';
import { topicById } from '../../content/curriculum';
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { raiseStatus } from '../../progress/activity';
import type { ChoiceQuestion } from '../../content/lessonTypes';
import { Rich } from '../components/Rich';

export interface LabProps {
  id: string;
  opening: string;
  predict: ChoiceQuestion;
  experiment: { title: string; body: string; render: () => ReactNode };
  explain: { title: string; body: string[] };
  fresh: { question: ChoiceQuestion; reveal: () => ReactNode };
  exercise: ShortAnswerSpec;
  assumptions: string[];
}

const STEPS = ['Predict', 'Experiment', 'What happened', 'A fresh problem'];

export function LabFrame(p: LabProps) {
  const { store } = useProgress();
  const topic = topicById(p.id)!;
  const { step, next, back } = useStep(p.id, STEPS.length);
  const [pred] = useRecord<{ attempts: unknown[] } | null>(`quiz:${p.id}:${p.predict.id}`, null);
  const [fresh] = useRecord<{ attempts: unknown[] } | null>(`quiz:${p.id}:${p.fresh.question.id}`, null);
  useEffect(() => {
    if (step === STEPS.length - 1) raiseStatus(store, p.id, 'studied');
  }, [step, store, p.id]);
  const q = (c: ChoiceQuestion, prediction: boolean) => (
    <Question
      key={c.id}
      isPrediction={prediction}
      recordKey={`${p.id}:${c.id}`}
      prompt={<Rich text={c.prompt} />}
      choices={c.choices.map((x) => ({ id: x.id, text: <Rich text={x.text} /> }))}
      correct={c.correct}
      onAnswered={(picked) => {
        if (!prediction && c.correct) {
          if (picked === c.correct) raiseStatus(store, p.id, 'independent');
          else store.set(`mistake:${p.id}:${c.id}`, { lessonId: p.id, text: c.prompt.replace(/[*`]/g, ''), at: Date.now(), resolved: false });
        }
      }}
      explain={(picked) => <p><Rich text={c.choices.find((x) => x.id === picked)?.why ?? ''} /></p>}
    />
  );

  return (
    <LessonShell id={p.id} crumbs={<><Link to="/topics#labs">Labs</Link> / {topic.short ?? topic.title}</>} title={topic.title} opening={<Rich text={p.opening} />}>
      {step === 0 && (
        <>
          <Caption kicker="Predict" title="Before you touch anything">
            <p>Commit to a guess. You’ll test it in the next step.</p>
          </Caption>
          {q(p.predict, true)}
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
          <Caption kicker="Fresh problem" title="Same mechanism, new numbers"><p>Predict first, then check the simulation’s answer.</p></Caption>
          {q(p.fresh.question, false)}
          {fresh?.attempts?.length ? <section className="stage" style={{ marginTop: 16 }} aria-label="Answer">{p.fresh.reveal()}</section> : null}
        </>
      )}
      <Controls step={step} count={STEPS.length} onBack={back} onNext={next} nextLabel={STEPS[step + 1]}
        nextDisabled={step === 0 && !pred?.attempts?.length} nextHint={step === 0 && !pred?.attempts?.length ? 'Make a prediction first' : undefined} />
      <More summary="Model assumptions">
        <ul>{p.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        <p className="muted" style={{ fontSize: 14 }}>The simulation is deterministic: the same settings always produce the same result, so you can replay any run exactly.</p>
      </More>
      <Sources sources={topic.sources} />
    </LessonShell>
  );
}

export function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="range-row" style={{ fontSize: 15, marginBottom: 8 }}>
      <span style={{ minWidth: 150 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={`${value} ${unit}`} />
      <span className="mono" style={{ minWidth: 90 }}>{value.toLocaleString()} {unit}</span>
    </label>
  );
}

export function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: '0 0 8px' }}>
      <legend style={{ fontSize: 15, marginBottom: 4 }}>{label}</legend>
      <div className="toolbar" style={{ margin: 0 }}>
        {options.map((o) => (
          <button key={o.id} className={`btn btn-small ${value === o.id ? 'btn-primary' : ''}`} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
        ))}
      </div>
    </fieldset>
  );
}
