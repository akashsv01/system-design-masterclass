/**
 * Interview workspace: pick a case (or let the app pick), optionally run a timer, work through
 * the phases with a diagram, notes and estimates, open hints progressively, receive a changed
 * requirement part-way, then self-assess against the case's transparent rubric and compare with
 * reference answers. Everything is saved as an `interview:` record and works without any AI API.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CASES } from '../../content/cases';
import { CURRICULUM, topicById } from '../../content/curriculum';
import { useProgress, useRecord, useRecords } from '../../progress/ProgressProvider';
import { raiseStatus } from '../../progress/activity';
import { recordSelf } from '../../progress/evidence';
import { Workspace, EMPTY_DIAGRAM, type WsDiagram } from '../components/Workspace';
import { Blocks } from '../lessons/GenericLesson';
import { Rich } from '../components/Rich';
import { SaveStatus } from '../components/Draft';
import { DECISIONS } from '../../content/decisions';
import { Icon } from '../components/Icon';

export interface InterviewRecord {
  caseId: string;
  startedAt: number;
  timed: boolean;
  minutes: number;
  phase: number;
  notes: string;
  diagram: WsDiagram;
  estimates: { dau: number; perUser: number; peak: number; bytes: number };
  hintsUsed: number;
  changeShown: boolean;
  scores: Record<string, number>;
  finishedAt?: number;
  savedAt?: number;
}

const HLD_PHASES = ['Requirements', 'Estimates', 'API and data', 'Design', 'Failures and changes', 'Review'];
const LLD_PHASES = ['Requirements', 'Classes and responsibilities', 'Invariants', 'Key method', 'Changes', 'Review'];

export default function Interview() {
  const { id } = useParams();
  useEffect(() => { document.title = 'Interview practice · System Design Masterclass'; }, []);
  return id ? <Session sessionId={id} /> : <Picker />;
}

function Picker() {
  const nav = useNavigate();
  const { store } = useProgress();
  const past = useRecords('interview:') as [string, InterviewRecord][];
  const cases = CURRICULUM.filter((t) => (t.kind === 'case-hld' || t.kind === 'case-lld') && CASES[t.id]);
  const start = (caseId: string, timed: boolean) => {
    const sid = `${caseId}-${Date.now().toString(36)}`;
    const rec: InterviewRecord = { caseId, startedAt: Date.now(), timed, minutes: 45, phase: 0, notes: '', diagram: EMPTY_DIAGRAM, estimates: { dau: 1_000_000, perUser: 10, peak: 5, bytes: 1000 }, hintsUsed: 0, changeShown: false, scores: {} };
    store.set(`interview:${sid}`, rec);
    nav(`/interview/${sid}`);
  };
  const [kind, setKind] = useState<'case-hld' | 'case-lld'>('case-hld');
  const [timed, setTimed] = useState(true);
  const pool = cases.filter((c) => c.kind === kind);
  const surprise = () => start(pool[Math.floor(Math.random() * pool.length)].id, timed);
  return (
    <div className="page reading">
      <h1 className="page-title">Practise a design interview</h1>
      <p className="page-lede">
        A quiet workspace to think, sketch and revise: a diagram, notes and an estimator. Part-way through, the interviewer changes a requirement.
        Hints are there if you need them and are recorded honestly. At the end you compare with reference answers and rate yourself against the rubric.
      </p>
      <div className="toolbar" style={{ gap: 14, marginBottom: 18 }}>
        <div className="segmented" role="tablist" aria-label="Interview type">
          <button role="tab" aria-selected={kind === 'case-hld'} onClick={() => setKind('case-hld')}>High-level design</button>
          <button role="tab" aria-selected={kind === 'case-lld'} onClick={() => setKind('case-lld')}>Low-level design</button>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 15 }}>
          <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} /> 45-minute timer
        </label>
        <button className="btn btn-primary" onClick={surprise} style={{ marginLeft: 'auto' }}><Icon name="spark" size={16} /> Pick one for me</button>
      </div>
      <ul className="card-list">
        {pool.map((c) => (
          <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
            <span>
              <strong>{c.short ?? c.title.replace(/^Design an? /, '').replace(/^./, (x) => x.toUpperCase())}</strong>
              <p>“{CASES[c.id].prompt}” <span className="muted">You decide: {DECISIONS[c.id]}.</span></p>
            </span>
            <button className="btn btn-small" onClick={() => start(c.id, timed)} aria-label={`Start: ${c.title}`}>Start</button>
          </li>
        ))}
      </ul>
      {past.length > 0 && (
        <>
          <h2>Your mock interviews</h2>
          <ul className="card-list">
            {past.sort((a, b) => b[1].startedAt - a[1].startedAt).map(([k, r]) => (
              <li key={k}>
                <Link className="title" to={`/interview/${k.slice('interview:'.length)}`}>{topicById(r.caseId)?.title ?? r.caseId}</Link>
                <p>{new Date(r.startedAt).toLocaleString()} · {r.finishedAt ? `finished, ${Object.values(r.scores).filter((v) => v === 2).length}/${Object.keys(r.scores).length} rubric areas strong` : 'in progress'} · {r.hintsUsed} hint(s)</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function fmtTime(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function Estimator({ value, onChange }: { value: InterviewRecord['estimates']; onChange: (v: InterviewRecord['estimates']) => void }) {
  const avg = (value.dau * value.perUser) / 86400;
  const peak = avg * value.peak;
  const storageDay = value.dau * value.perUser * value.bytes;
  const field = (k: keyof typeof value, label: string, unit: string) => (
    <label className="field" style={{ marginBottom: 8 }}>
      <span>{label} <span className="muted">({unit})</span></span>
      <input type="number" min={0} value={value[k]} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) || 0 })} />
    </label>
  );
  const human = (b: number) => (b >= 1e12 ? `${(b / 1e12).toFixed(1)} TB` : b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);
  return (
    <div className="grid-2">
      <div>
        {field('dau', 'Daily active users', 'people')}
        {field('perUser', 'Requests per user per day', 'requests')}
        {field('peak', 'Peak ÷ average', '×')}
        {field('bytes', 'Bytes stored per request', 'bytes')}
      </div>
      <div className="notice" aria-live="polite">
        <p style={{ margin: '0 0 6px' }}>Average: <strong>{Math.round(avg).toLocaleString()} req/s</strong> <span className="muted">= {value.dau.toLocaleString()} × {value.perUser} ÷ 86,400</span></p>
        <p style={{ margin: '0 0 6px' }}>Peak: <strong>{Math.round(peak).toLocaleString()} req/s</strong></p>
        <p style={{ margin: '0 0 6px' }}>Storage: <strong>{human(storageDay)}/day</strong>, {human(storageDay * 365)}/year</p>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>State these assumptions out loud; the interviewer cares about the reasoning more than the exact number.</p>
      </div>
    </div>
  );
}

function Session({ sessionId }: { sessionId: string }) {
  const { store } = useProgress();
  const [rec, setRec] = useRecord<InterviewRecord | null>(`interview:${sessionId}`, null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const cs = rec ? CASES[rec.caseId] : undefined;
  const topic = rec ? topicById(rec.caseId) : undefined;
  const phases = topic?.kind === 'case-lld' ? LLD_PHASES : HLD_PHASES;
  const changeStage = useMemo(() => cs?.stages.find((s) => s.kind === 'change'), [cs]);
  const allHints = useMemo(() => (cs ? cs.stages.flatMap((s) => s.hints) : []), [cs]);
  if (!rec || !cs || !topic) return <div className="page reading"><p>This interview session isn’t on this device. <Link to="/interview">Start a new one</Link>.</p></div>;
  const set = (p: Partial<InterviewRecord>) => setRec({ ...rec, ...p, savedAt: Date.now() });
  const elapsed = (rec.finishedAt ?? now) - rec.startedAt;
  const remaining = rec.minutes * 60_000 - elapsed;
  // The changed requirement arrives at the start of phase 5, or after 30 minutes on the clock.
  const changeDue = rec.phase >= 4 || (rec.timed && elapsed > 30 * 60_000);
  const reviewing = rec.phase === phases.length - 1;

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <p className="crumbs"><Link to="/interview">Interview practice</Link> / {topic.title}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 30 }}>“{cs.prompt}”</h1>
        {rec.timed && <span className={`clock ${remaining < 5 * 60_000 ? 'changed' : ''}`} aria-live="off"><Icon name="clock" size={15} /> {remaining > 0 ? fmtTime(remaining) : `+${fmtTime(-remaining)} over`}</span>}
      </div>
      <nav className="tabs" aria-label="Interview phases" style={{ marginBottom: 16 }}>
        {phases.map((p, i) => <button key={p} aria-selected={rec.phase === i} onClick={() => set({ phase: i })}>{i + 1}. {p}</button>)}
      </nav>

      {!reviewing && (
        <>
          {changeDue && changeStage && (
            rec.changeShown ? (
              <div className="callout warn"><strong>Changed requirement</strong><Rich text={changeStage.task} /></div>
            ) : (
              <div className="notice warn" style={{ marginBottom: 12 }}>
                The interviewer has a new requirement for you. <button className="btn btn-small" onClick={() => set({ changeShown: true })}>Hear it</button>
              </div>
            )
          )}
          {topic.kind === 'case-hld' && rec.phase === 1 && <section className="stage" style={{ marginBottom: 16 }}><Estimator value={rec.estimates} onChange={(estimates) => set({ estimates })} /></section>}
          <section className="stage" aria-label="Diagram workspace">
            <Workspace value={rec.diagram} onChange={(diagram) => set({ diagram })} />
          </section>
          <label className="field" style={{ marginTop: 16 }} htmlFor="iv-notes"><span>Notes ({phases[rec.phase]})</span></label>
          <textarea id="iv-notes" value={rec.notes} onChange={(e) => set({ notes: e.target.value })} style={{ minHeight: 160 }} placeholder={rec.phase === 0 ? 'Questions you’d ask, and the answers you’d assume…' : 'Keep writing; notes are shared across phases.'} />
          <p className="save-note"><SaveStatus savedAt={rec.savedAt} /></p>
          <div className="toolbar">
            {rec.hintsUsed < allHints.length && <button className="btn btn-small" onClick={() => set({ hintsUsed: rec.hintsUsed + 1 })}>{rec.hintsUsed ? 'Another hint' : 'I’m stuck: show a hint'}</button>}
            <button className="btn btn-small btn-primary" onClick={() => set({ phase: Math.min(phases.length - 1, rec.phase + 1) })}>Next: {phases[Math.min(phases.length - 1, rec.phase + 1)]} <Icon name="arrow-right" size={15} /></button>
          </div>
          {allHints.slice(0, rec.hintsUsed).map((h, i) => <div key={i} className="callout"><strong>Hint {i + 1}</strong><Rich text={h} /></div>)}
        </>
      )}

      {reviewing && (
        <div className="reading" style={{ maxWidth: 760 }}>
          <h2 style={{ marginTop: 0 }}>Rate your answer</h2>
          <p className="muted">The rubric is the same one used in the case study. Compare your notes and diagram with the reference answers below, then rate each area honestly. Hints used: {rec.hintsUsed}.</p>
          {cs.rubric.map((r) => (
            <div key={r.area} style={{ marginBottom: 12 }}>
              <p style={{ margin: '0 0 2px', fontWeight: 600 }}>{r.area}</p>
              <p className="muted" style={{ margin: '0 0 6px', fontSize: 15 }}>Strong: <Rich text={r.strong} /></p>
              <div className="toolbar" style={{ margin: 0 }}>
                {['Missing', 'Partial', 'Strong'].map((lbl, i) => (
                  <button key={lbl} className={`btn btn-small ${rec.scores[r.area] === i ? 'btn-primary' : ''}`} aria-pressed={rec.scores[r.area] === i} onClick={() => set({ scores: { ...rec.scores, [r.area]: i } })}>{lbl}</button>
                ))}
              </div>
            </div>
          ))}
          <button className="btn btn-primary" disabled={Object.keys(rec.scores).length < cs.rubric.length} onClick={() => {
            set({ finishedAt: Date.now() });
            // Interview ratings are self-assessment: recorded, compared over time, but never a verified "solved".
            raiseStatus(store, rec.caseId, 'studied');
            recordSelf(store, rec.caseId, { ratings: Object.fromEntries(Object.entries(rec.scores).map(([k, v]) => [`interview: ${k}`, v])) });
            cs.rubric.filter((r) => (rec.scores[r.area] ?? 0) < 2).forEach((r) => store.set(`mistake:${rec.caseId}:iv-${r.area.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { lessonId: rec.caseId, text: `${r.area}: ${r.strong}`, self: true, at: Date.now(), resolved: false }));
          }}>{rec.finishedAt ? 'Update my result' : 'Finish interview'}</button>
          {rec.finishedAt && <p className="notice" style={{ marginTop: 12 }}>Saved as self-assessment. Areas you rated below “Strong” are in your <Link to="/progress">mistake notebook</Link>. To turn this into verified evidence, answer the case’s graded checks in an <Link to={topic.route}>independent attempt</Link>.</p>}
          <h2>Reference answers</h2>
          {cs.stages.map((s, i) => (
            <details key={i} className="more"><summary>{s.title}</summary><div className="more-body"><Blocks blocks={s.reference} /></div></details>
          ))}
          <p style={{ marginTop: 16 }}><Link to={topic.route}>Open the full case study →</Link></p>
        </div>
      )}
    </div>
  );
}
