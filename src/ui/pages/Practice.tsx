/**
 * Practice hub (brief §4, §10): recommends one specific exercise and says why; then what is due, fresh
 * exercises for recorded gaps, independent practice (cases, mocks, capstone) and labs. Empty states are honest
 * and still point somewhere useful.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CURRICULUM, topicById } from '../../content/curriculum';
import { DECISIONS } from '../../content/decisions';
import { useRecord, useRecords } from '../../progress/ProgressProvider';
import { freshFor, recommend, type LastActivity, type Mistake, type Review } from '../../progress/recommend';
import type { LessonStatus } from '../../../shared/progress';
import { Icon } from '../components/Icon';

export { freshFor };

export default function Practice() {
  useEffect(() => { document.title = 'Practice · System Design Masterclass'; }, []);
  const statuses = Object.fromEntries(useRecords('status:').map(([k, v]) => [k.slice(7), v as LessonStatus]));
  const reviews = useRecords('review:').map(([, v]) => v as Review);
  const mistakes = useRecords('mistake:').map(([, v]) => v as Mistake);
  const [last] = useRecord<LastActivity | null>('pref:last-activity', null);
  const now = Date.now();
  const due = reviews.filter((r) => typeof r.due === 'number' && r.due <= now);
  const upcoming = reviews.filter((r) => typeof r.due === 'number' && r.due > now).sort((a, b) => a.due - b.due)[0];
  const done = new Set(Object.entries(statuses).filter(([, s]) => s === 'independent').map(([k]) => k));
  const open = mistakes.filter((m) => !m.resolved);
  const gapTopics = [...new Set(open.map((m) => m.lessonId))];
  const count = (s: LessonStatus) => Object.values(statuses).filter((x) => x === s).length;
  const labs = CURRICULUM.filter((t) => t.kind === 'lab' && t.status !== 'planned');
  const rec = recommend('practice', { statuses, last, reviews, mistakes, now });

  return (
    <div className="page reading">
      <h1 className="page-title">Practice</h1>
      <p className="page-lede">
        Short, targeted practice beats rereading. This page picks one thing for you, and lists everything else you can try on your own.
      </p>

      {rec && (
        <section className="recommend" aria-labelledby="rec-title">
          <p className="kicker accent">
            {rec.kind === 'revision' ? 'Recommended: revise' : rec.kind === 'gap' ? 'Recommended: close a gap' : rec.kind === 'continue' ? 'Recommended: finish what you started' : 'Recommended next'}
          </p>
          <h2 id="rec-title">{rec.title}</h2>
          <p className="why">{rec.reason}</p>
          {DECISIONS[rec.topic.id] && <p className="small" style={{ margin: '-6px 0 16px' }}><span className="muted">You decide:</span> {DECISIONS[rec.topic.id]}.</p>}
          <Link className="btn btn-primary" to={rec.topic.route}>Open it <Icon name="arrow-right" /></Link>
        </section>
      )}

      <p className="muted small" style={{ marginTop: 20 }}>
        So far: <strong>{count('studied')}</strong> studied · <strong>{count('hinted')}</strong> solved with help · <strong>{count('independent')}</strong> solved
        independently. “Independently” means every graded check in the topic was right first time, with no hint, reveal or retry. Your own rubric
        ratings are kept separately and never count towards it.
      </p>

      <h2>Due for revision</h2>
      {due.length ? (
        <ul className="card-list">
          {due.map((r) => {
            const t = topicById(r.lessonId);
            return t ? <li key={r.lessonId}><Link className="title" to={t.route}>{t.title}</Link><p>Start a revision round and answer its checks from memory before rereading.</p></li> : null;
          })}
        </ul>
      ) : (
        <div className="empty">
          <p>Nothing is due today.{upcoming && topicById(upcoming.lessonId) ? <> Next up: <strong>{topicById(upcoming.lessonId)!.short ?? topicById(upcoming.lessonId)!.title}</strong> on {new Date(upcoming.due).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.</> : ' Topics come back 1, 3, 7, 16 and 35 days after you solve their checks.'}</p>
          {rec && rec.kind !== 'revision' && <p>Meanwhile, the recommendation above is the most useful thing to do.</p>}
        </div>
      )}

      <h2>Fresh exercises for your gaps</h2>
      {gapTopics.length ? (
        <ul className="card-list">
          {gapTopics.slice(0, 6).map((id) => {
            const t = topicById(id);
            const fresh = freshFor(id, done);
            const selfOnly = open.filter((m) => m.lessonId === id).every((m) => m.self);
            return t ? (
              <li key={id}>
                <span className="muted small">{selfOnly ? 'You rated yourself below strong in' : 'You missed a check in'}</span>{' '}
                <Link className="title" to={t.route}>{t.short ?? t.title}</Link>
                {fresh.length > 0 && <p>Same idea, new setting: {fresh.map((f, i) => <span key={f.id}>{i > 0 && ' · '}<Link to={f.route}>{f.short ?? f.title}</Link></span>)}</p>}
              </li>
            ) : null;
          })}
        </ul>
      ) : (
        <div className="empty"><p>No gaps recorded yet. Checks you miss, answers you solve only with a hint, and rubric areas you rate below “Strong” appear here with a related exercise.</p></div>
      )}

      <h2>Work on your own</h2>
      <ul className="card-list">
        <li><Link className="title" to="/topics#cases-hld">HLD case studies in independent mode</Link><p>17 prompts. The reference design stays hidden until you save your own answer at each stage; a failure and a changed requirement follow.</p></li>
        <li><Link className="title" to="/topics#cases-lld">LLD case studies in independent mode</Link><p>14 designs: responsibilities, states, invariants and the one condition that keeps them true, with tested Python references.</p></li>
        <li><Link className="title" to="/interview">Mock interview</Link><p>Timed or untimed, HLD or LLD, with a sketch workspace, an estimator, a changed requirement and a transparent rubric.</p></li>
        <li><Link className="title" to="/capstone/capstone">Capstone</Link><p>An unfamiliar system with a surprise requirement, compared with the first design you saved in the course.</p></li>
      </ul>

      <h2>Labs</h2>
      <p className="muted small" style={{ marginTop: -6 }}>Each lab asks for a prediction, gives you one control to change, and ends with a fresh problem that counts as evidence.</p>
      <ul className="card-list">
        {labs.map((l) => (
          <li key={l.id}>
            <Link className="title" to={l.route}>{l.short ?? l.title}</Link>
            {statuses[l.id] === 'independent' && <span className="pill ok" style={{ marginLeft: 8 }}>solved</span>}
            <p><span className="muted">You decide:</span> {DECISIONS[l.id]}.</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
