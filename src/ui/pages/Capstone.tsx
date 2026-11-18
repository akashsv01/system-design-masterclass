/**
 * Capstone (topic: capstone). Same workspace as interview practice, a surprise requirement at
 * step 3, a transparent rubric, and a comparison with the learner's first design in the course
 * (their saved explanation of the double-booking race) showing which skills their work demonstrates.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CAPSTONE } from '../../content/capstone';
import { topicById } from '../../content/curriculum';
import { Caption, Controls, LessonShell, More, Sources, useStep } from '../components/Lesson';
import { Workspace, EMPTY_DIAGRAM, type WsDiagram } from '../components/Workspace';
import { Estimator } from './Interview';
import { Blocks } from '../lessons/GenericLesson';
import { SaveStatus } from '../components/Draft';
import { Rich } from '../components/Rich';
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { raiseStatus } from '../../progress/activity';

interface CapRec { notes: string; diagram: WsDiagram; estimates: { dau: number; perUser: number; peak: number; bytes: number }; surpriseNotes: string; scores: Record<string, number>; savedAt?: number; finishedAt?: number }

export default function Capstone() {
  const { store } = useProgress();
  const topic = topicById('capstone')!;
  const { step, next, back } = useStep('capstone', CAPSTONE.phases.length);
  const [rec, setRec] = useRecord<CapRec>('draft:capstone:main', { notes: '', diagram: EMPTY_DIAGRAM, estimates: { dau: 80000, perUser: 10, peak: 10, bytes: 300 }, surpriseNotes: '', scores: {} });
  const [firstDraft] = useRecord<{ text: string; strokes: unknown[] } | null>('draft:first-booking:race', null);
  const set = (p: Partial<CapRec>) => setRec({ ...rec, ...p, savedAt: Date.now() });
  useEffect(() => { document.title = 'Capstone · System Design Masterclass'; }, []);
  const phase = CAPSTONE.phases[step];
  const allText = `${rec.notes}\n${rec.surpriseNotes}\n${rec.diagram.boxes.map((b) => b.label).join(' ')}`.toLowerCase();
  const skills = CAPSTONE.skills.map((s) => ({ ...s, found: s.terms.some((t) => allText.includes(t)) }));

  return (
    <LessonShell id="capstone" crumbs={<><Link to="/practice">Practice</Link> / Capstone</>} title="Capstone: a festival that keeps working offline" opening={<Rich text={CAPSTONE.prompt} />}>
      {step === 0 && (
        <>
          <Caption kicker="Brief" title="What you know">
            <ul>{CAPSTONE.context.map((c, i) => <li key={i}>{c}</li>)}</ul>
            <p>{phase.task} There’s no single right answer. State your assumptions.</p>
          </Caption>
          <section className="stage"><Estimator value={rec.estimates} onChange={(estimates) => set({ estimates })} /></section>
          <label className="field" style={{ marginTop: 16 }} htmlFor="cap-notes"><span>Your notes</span></label>
          <textarea id="cap-notes" value={rec.notes} onChange={(e) => set({ notes: e.target.value })} style={{ minHeight: 140 }} placeholder="Questions, assumptions, estimates…" />
          <p className="save-note"><SaveStatus savedAt={rec.savedAt} /></p>
        </>
      )}
      {step === 1 && (
        <>
          <section className="stage"><Workspace value={rec.diagram} onChange={(diagram) => set({ diagram })} /></section>
          <Caption kicker="Design" title={phase.title}><p>{phase.task}</p></Caption>
          <label className="field" htmlFor="cap-notes2"><span>Notes</span></label>
          <textarea id="cap-notes2" value={rec.notes} onChange={(e) => set({ notes: e.target.value })} style={{ minHeight: 140 }} />
          <p className="save-note"><SaveStatus savedAt={rec.savedAt} /></p>
        </>
      )}
      {step === 2 && (
        <>
          <div className="callout warn"><strong>Surprise requirement</strong>{CAPSTONE.surprise}</div>
          <section className="stage"><Workspace value={rec.diagram} onChange={(diagram) => set({ diagram })} /></section>
          <Caption kicker="Adapt" title="Keep the east side working"><p>{phase.task}</p></Caption>
          <label className="field" htmlFor="cap-surprise"><span>How your design changes</span></label>
          <textarea id="cap-surprise" value={rec.surpriseNotes} onChange={(e) => set({ surpriseNotes: e.target.value })} style={{ minHeight: 140 }} placeholder="What happens at a terminal with no link? How is it repaired later?" />
          <p className="save-note"><SaveStatus savedAt={rec.savedAt} /></p>
        </>
      )}
      {step === 3 && (
        <>
          <Caption kicker="Review" title="Then and now">
            <p>Your first design in this course was an explanation of why two buyers both got seat F12:</p>
            <blockquote className="notice" style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>{firstDraft?.text?.trim() || <em>You didn’t save one. Open the <Link to="/learn/first-booking">first lesson</Link> to compare.</em>}</blockquote>
            <p>Now you designed a payment and entry system that stays correct through a network partition. Here are the concepts your capstone notes and diagram mention. We look for the listed terms, so this is a prompt for reflection, not a grade.</p>
          </Caption>
          <ul className="card-list">
            {skills.map((s) => (
              <li key={s.concept} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{s.found ? '✓' : '○'} <strong>{s.concept}</strong>{!s.found && <span className="muted"> · not mentioned: review <Link to={topicById(s.lesson)?.route ?? '/topics'}>{topicById(s.lesson)?.short ?? s.lesson}</Link></span>}</span>
                <span className={`pill ${s.found ? 'ok' : ''}`}>{s.found ? 'demonstrated' : 'not yet'}</span>
              </li>
            ))}
          </ul>
          <div className="question">
            <h3>Rate your design</h3>
            {CAPSTONE.rubric.map((r) => (
              <div key={r.area} style={{ marginBottom: 12 }}>
                <p style={{ margin: '0 0 2px', fontWeight: 600 }}>{r.area}</p>
                <p className="muted" style={{ margin: '0 0 6px', fontSize: 15 }}>Strong: {r.strong}</p>
                <div className="toolbar" style={{ margin: 0 }}>{['Missing', 'Partial', 'Strong'].map((lbl, i) => <button key={lbl} className={`btn btn-small ${rec.scores[r.area] === i ? 'btn-primary' : ''}`} aria-pressed={rec.scores[r.area] === i} onClick={() => set({ scores: { ...rec.scores, [r.area]: i } })}>{lbl}</button>)}</div>
              </div>
            ))}
            <button className="btn btn-primary" disabled={Object.keys(rec.scores).length < CAPSTONE.rubric.length} onClick={() => {
              set({ finishedAt: Date.now() });
              raiseStatus(store, 'capstone', CAPSTONE.rubric.every((r) => rec.scores[r.area] === 2) ? 'independent' : 'hinted');
            }}>{rec.finishedAt ? 'Update' : 'Finish the capstone'}</button>
          </div>
          <More summary="Reference design" defaultOpen={!!rec.finishedAt}><Blocks blocks={CAPSTONE.reference} /></More>
        </>
      )}
      <Controls step={step} count={CAPSTONE.phases.length} onBack={back} onNext={next} nextLabel={CAPSTONE.phases[step + 1]?.title} />
      <Sources sources={topic.sources} />
    </LessonShell>
  );
}
