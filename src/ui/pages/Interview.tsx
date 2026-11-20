/**
 * Interview practice (interview brief §3): a picker that says what the learner will actually do, browsable by
 * HLD / LLD and skill, with an obvious way to resume; and the session itself (src/ui/interview/Session.tsx).
 * Sessions are `interview:` records in the existing progress store, so they sync for signed-in learners.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SCRIPTS } from '../../content/interview/scripts';
import type { Skill } from '../../content/interview/types';
import { CURRICULUM, topicById } from '../../content/curriculum';
import { useProgress, useRecords } from '../../progress/ProgressProvider';
import { Session } from '../interview/Session';
import { blank, migrate, newSessionId, type SessionV2 } from '../interview/record';
import { Icon } from '../components/Icon';
import '../interview/interview.css';

const SKILL_LABEL: Record<Skill, string> = {
  architecture: 'Service architecture', concurrency: 'Concurrency', reliability: 'Failures', 'data-modeling': 'Data modeling', capacity: 'Capacity',
  caching: 'Caching', messaging: 'Messaging', 'object-design': 'Object design', 'state-machines': 'State machines', consistency: 'Consistency', 'api-design': 'API design',
};

export default function Interview() {
  const { id } = useParams();
  useEffect(() => { if (!id) document.title = 'Interview practice · System Design Masterclass'; }, [id]);
  return id ? <Session sessionId={id} /> : <Picker />;
}

function ago(t?: number) {
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
}

function Picker() {
  const nav = useNavigate();
  const { store, user } = useProgress();
  const records = useRecords('interview:');
  const [track, setTrack] = useState<'all' | 'hld' | 'lld'>('all');
  const [skill, setSkill] = useState<Skill | null>(null);
  const sessions = useMemo(() => records
    .map(([k, v]) => [k.slice('interview:'.length), migrate(v, SCRIPTS[(v as { caseId?: string })?.caseId ?? ''])] as [string, SessionV2 | null])
    .filter((x): x is [string, SessionV2] => !!x[1])
    .sort((a, b) => (b[1].savedAt ?? b[1].startedAt) - (a[1].savedAt ?? a[1].startedAt)), [records]);
  const unfinished = sessions.filter(([, s]) => !s.finishedAt && SCRIPTS[s.caseId]);
  const cases = CURRICULUM.filter((t) => SCRIPTS[t.id]);
  const shown = cases.filter((t) => (track === 'all' || SCRIPTS[t.id].track === track) && (!skill || SCRIPTS[t.id].skills.includes(skill)));
  const skills = [...new Set(cases.flatMap((t) => SCRIPTS[t.id].skills))];
  const start = (caseId: string, mode: 'guided' | 'mock') => {
    const sid = newSessionId(caseId);
    store.set(`interview:${sid}`, blank(caseId, mode));
    nav(`/interview/${sid}`);
  };
  const others = CURRICULUM.filter((t) => (t.kind === 'case-hld' || t.kind === 'case-lld') && !SCRIPTS[t.id]);
  return (
    <div className="page iv-picker">
      <h1 className="page-title">Interview practice</h1>
      <p className="page-lede">An interviewer briefs you. You build your answer on a canvas, and they follow up on what you actually drew. Guided practice coaches as you go; a mock interview saves the coaching for the debrief.</p>
      {unfinished.length > 0 && (
        <section className="resume-list" aria-labelledby="resume-h">
          <h2 id="resume-h" className="eyebrow">Pick up where you left off</h2>
          <ul>
            {unfinished.slice(0, 3).map(([sid, s]) => {
              const sc = SCRIPTS[s.caseId];
              const st = sc.stages[Math.min(s.stage, sc.stages.length - 1)];
              return (
                <li key={sid}>
                  <Link className="resume-card" to={`/interview/${sid}`}>
                    <span className="rc-main"><strong>{topicById(s.caseId)?.short ?? s.caseId}</strong> <span className="muted">· {s.mode === 'guided' ? 'Guided' : 'Mock'} · stage {Math.min(s.stage + 1, sc.stages.length)} of {sc.stages.length}: {st.title}</span></span>
                    <span className="rc-meta muted small">{s.design.comps.length ? `${s.design.comps.length} parts in your design · ` : ''}saved {ago(s.savedAt ?? s.startedAt)}{user ? ' · synced' : ' · on this device'}</span>
                    <span className="rc-go">Resume <Icon name="arrow-right" size={15} /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="iv-filters">
        <div className="segmented" role="radiogroup" aria-label="Interview type">
          {(['all', 'hld', 'lld'] as const).map((t) => <button key={t} role="radio" aria-checked={track === t} onClick={() => setTrack(t)}>{t === 'all' ? 'All' : t === 'hld' ? 'High-level design' : 'Low-level design'}</button>)}
        </div>
        <div className="chips" role="group" aria-label="Filter by skill">
          {skills.map((k) => <button key={k} className="chip" aria-pressed={skill === k} onClick={() => setSkill(skill === k ? null : k)}>{SKILL_LABEL[k]}</button>)}
        </div>
      </div>
      <ul className="case-grid">
        {shown.map((t) => {
          const sc = SCRIPTS[t.id];
          return (
            <li key={t.id} className="case-card">
              <p className="cc-kicker"><span className="pill">{sc.track.toUpperCase()}</span> {sc.stages.map((st) => st.title).join(' → ')}</p>
              <h2 className="cc-title">{t.short ?? t.title}</h2>
              <p className="cc-do">{sc.doLine}</p>
              <p className="cc-skills">{sc.skills.map((k) => <span key={k} className="tag">{SKILL_LABEL[k]}</span>)}</p>
              <div className="cc-actions">
                <button className="btn btn-primary" onClick={() => start(t.id, 'guided')} aria-label={`Guided practice: ${t.title}`}>Guided practice</button>
                <button className="btn" onClick={() => start(t.id, 'mock')} aria-label={`Mock interview: ${t.title}`}>Mock interview</button>
              </div>
            </li>
          );
        })}
        {!shown.length && <li className="empty">No cases match. <button className="btn-link" onClick={() => { setTrack('all'); setSkill(null); }}>Show all</button></li>}
      </ul>
      {others.length > 0 && (
        <details className="more">
          <summary>{others.length} more cases as written case studies</summary>
          <ul className="plain-list">{others.map((t) => <li key={t.id}><Link to={t.route}>{t.title}</Link></li>)}</ul>
        </details>
      )}
      {sessions.length > unfinished.length && (
        <details className="more">
          <summary>Finished interviews ({sessions.length - unfinished.length})</summary>
          <ul className="plain-list">{sessions.filter(([, s]) => s.finishedAt || !SCRIPTS[s.caseId]).map(([sid, s]) => <li key={sid}><Link to={`/interview/${sid}`}>{topicById(s.caseId)?.title ?? s.caseId}</Link> <span className="muted small">· {new Date(s.startedAt).toLocaleDateString()}</span></li>)}</ul>
        </details>
      )}
    </div>
  );
}
