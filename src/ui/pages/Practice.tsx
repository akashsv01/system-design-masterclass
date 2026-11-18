/**
 * Practice hub: what's due for revision, fresh exercises chosen from the learner's recorded
 * gaps, independent practice (labs, cases), and interview mode. Evidence levels are shown as
 * studied / solved with hints / solved independently.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CURRICULUM, topicById } from '../../content/curriculum';
import { useRecords } from '../../progress/ProgressProvider';
import type { LessonStatus } from '../../../shared/progress';
import type { TopicWithStatus } from '../../content/types';

/** Topics that build on, or share scope with, a topic the learner struggled with. */
export function freshFor(id: string, done: Set<string>): TopicWithStatus[] {
  const t = topicById(id);
  if (!t) return [];
  const terms = new Set(t.covers.map((c) => c.toLowerCase()));
  return CURRICULUM.filter((c) => c.id !== id && c.status !== 'planned' && !done.has(c.id) && (c.prereqs.includes(id) || c.covers.some((x) => terms.has(x.toLowerCase()))))
    .sort((a, b) => Number(b.kind === 'lab') - Number(a.kind === 'lab'))
    .slice(0, 2);
}

export default function Practice() {
  useEffect(() => { document.title = 'Practice · System Design Masterclass'; }, []);
  const statuses = Object.fromEntries(useRecords('status:').map(([k, v]) => [k.slice(7), v as LessonStatus]));
  const reviews = useRecords('review:') as [string, { lessonId: string; due: number }][];
  const mistakes = (useRecords('mistake:') as [string, { lessonId: string; text: string; resolved: boolean }][]).filter(([, m]) => !m.resolved);
  const now = Date.now();
  const due = reviews.filter(([, r]) => typeof r.due === 'number' && r.due <= now);
  const done = new Set(Object.entries(statuses).filter(([, s]) => s === 'independent').map(([k]) => k));
  const gapTopics = [...new Set(mistakes.map(([, m]) => m.lessonId))];
  const count = (s: LessonStatus) => Object.values(statuses).filter((x) => x === s).length;
  const labs = CURRICULUM.filter((t) => t.kind === 'lab' && t.status !== 'planned');

  return (
    <div className="page reading">
      <h1 style={{ marginTop: 0 }}>Practice</h1>
      <p className="muted">
        Your evidence so far: <strong>{count('studied')}</strong> studied · <strong>{count('hinted')}</strong> solved with hints · <strong>{count('independent')}</strong> solved
        independently. “Independently” means you answered the checks correctly first time without opening hints.
      </p>

      <h2>Due for revision</h2>
      {due.length ? (
        <ul className="card-list">{due.map(([k, r]) => { const t = topicById(r.lessonId); return t ? <li key={k}><Link className="title" to={t.route}>{t.title}</Link><p>Redo its checks from memory before rereading.</p></li> : null; })}</ul>
      ) : <p className="muted">Nothing due right now.</p>}

      <h2>Fresh exercises for your gaps</h2>
      {gapTopics.length ? (
        <ul className="card-list">
          {gapTopics.slice(0, 6).map((id) => {
            const t = topicById(id);
            const fresh = freshFor(id, done);
            return t ? (
              <li key={id}>
                <span className="muted" style={{ fontSize: 14 }}>You found this hard:</span> <Link className="title" to={t.route}>{t.short ?? t.title}</Link>
                {fresh.length > 0 && <p>Try the same idea in a new setting: {fresh.map((f, i) => <span key={f.id}>{i > 0 && ' · '}<Link to={f.route}>{f.short ?? f.title}</Link></span>)}</p>}
              </li>
            ) : null;
          })}
        </ul>
      ) : <p className="muted">No gaps recorded yet. Checks you miss, rubric areas you rate below “Strong”, and exercises you solve only with hints show up here.</p>}

      <h2>Independent practice</h2>
      <ul className="card-list">
        <li><Link className="title" to="/interview">Mock interview</Link><p>Timed or untimed, HLD or LLD, with a changing requirement and a rubric.</p></li>
        <li><Link className="title" to="/topics#cases-hld">HLD case studies</Link><p>17 ambiguous prompts worked through decisions, failures and changes.</p></li>
        <li><Link className="title" to="/topics#cases-lld">LLD case studies</Link><p>14 designs in Python: responsibilities, invariants, tests.</p></li>
        <li><Link className="title" to="/capstone/capstone">Capstone</Link><p>An unfamiliar system with a surprise requirement, compared with your first design.</p></li>
      </ul>

      <h2>Labs</h2>
      <ul className="card-list">{labs.map((l) => <li key={l.id}><Link className="title" to={l.route}>{l.short ?? l.title}</Link><p>{l.objective}</p></li>)}</ul>
    </div>
  );
}
