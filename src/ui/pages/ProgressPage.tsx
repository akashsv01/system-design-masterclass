/**
 * Progress (brief §4, §10, §11): what the learner can already do (verified by graded checks), which skill to
 * revisit (the mistake notebook and due revision), their own self-assessment kept separate, and export/import.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgress, useRecords } from '../../progress/ProgressProvider';
import { CURRICULUM, MODULES, topicById } from '../../content/curriculum';
import type { LessonStatus } from '../../../shared/progress';
import type { SelfAssessment } from '../../progress/evidence';
import { Icon } from '../components/Icon';

type MistakeRec = { lessonId: string; text: string; at: number; resolved: boolean; self?: boolean };

export function ProgressPage() {
  const { store, user } = useProgress();
  const statuses = Object.fromEntries(useRecords('status:').map(([k, v]) => [k.slice(7), v as LessonStatus]));
  const mistakes = useRecords('mistake:') as [string, MistakeRec][];
  const reviews = useRecords('review:') as [string, { lessonId: string; due: number; reps: number }][];
  const selfs = useRecords('self:') as [string, SelfAssessment][];
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    document.title = 'Progress · System Design Masterclass';
    if (location.hash) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 50);
  }, []);

  const now = Date.now();
  const due = reviews.filter(([, r]) => r.due <= now).sort((a, b) => a[1].due - b[1].due);
  const upcoming = reviews.filter(([, r]) => r.due > now).sort((a, b) => a[1].due - b[1].due).slice(0, 5);
  const open = mistakes.filter(([, m]) => !m.resolved).sort((a, b) => Number(!!a[1].self) - Number(!!b[1].self) || b[1].at - a[1].at);
  const independent = CURRICULUM.filter((t) => statuses[t.id] === 'independent');
  const helped = CURRICULUM.filter((t) => statuses[t.id] === 'hinted');
  const started = Object.values(statuses).length;

  const doExport = () => {
    const blob = new Blob([JSON.stringify(store.exportJson(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `system-design-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const doImport = async (f: File) => {
    try {
      const r = store.importJson(JSON.parse(await f.text()));
      setMsg(`Imported ${r.imported} item(s).${r.keptBoth ? ` ${r.keptBoth} draft(s) differed from yours, so both versions were kept.` : ''}`);
    } catch (e) {
      setMsg(`That file couldn’t be imported: ${(e as Error).message.slice(0, 200)}`);
    }
  };

  return (
    <div className="page reading">
      <h1 className="page-title">Progress</h1>
      <p className="page-lede">What you can already do, what to revisit, and how you rated yourself, kept apart so each stays honest.</p>
      {!user && (
        <p className="notice"><Icon name="device" size={16} /> Saved in this browser only. <strong>Sign in</strong> (top right) to keep it on your other devices, or export a copy below.</p>
      )}

      {!started ? (
        <div className="empty" style={{ marginTop: 24 }}>
          <p>Nothing recorded yet. Progress appears here once you answer a lesson’s checks.</p>
          <p><Link className="btn btn-primary" to="/learn/first-booking">Start the first lesson <Icon name="arrow-right" /></Link></p>
        </div>
      ) : (
        <>
          <h2 id="can-do">What you can do</h2>
          <p className="muted small" style={{ marginTop: -6 }}>Counted only from graded checks. “Independently” means right first time with no hint, reveal or retry.</p>
          <div className="skill-grid">
            {MODULES.map((m) => {
              const all = CURRICULUM.filter((t) => t.category === m.id);
              const ind = all.filter((t) => statuses[t.id] === 'independent').length;
              const help = all.filter((t) => statuses[t.id] === 'hinted').length;
              return (
                <div key={m.id} className="skill-area">
                  <h3>{m.title}</h3>
                  <div className="meter" role="img" aria-label={`${ind} solved independently and ${help} with help, of ${all.length}`}>
                    <span style={{ width: `${((ind + help) / all.length) * 100}%`, background: ind ? `linear-gradient(90deg, var(--ok) ${(ind / Math.max(1, ind + help)) * 100}%, var(--accent) 0)` : 'var(--accent)' }} />
                  </div>
                  <p>{ind} independently · {help} with help · {all.length} in all</p>
                </div>
              );
            })}
          </div>
          {independent.length > 0 && (
            <details className="more" open={independent.length <= 6}>
              <summary>Shown without help ({independent.length})</summary>
              <div className="more-body">
                <ul className="card-list">
                  {independent.map((t) => <li key={t.id}><Link className="title" to={t.route}>{t.short ?? t.title}</Link><p>{t.objective}</p></li>)}
                </ul>
              </div>
            </details>
          )}
          {helped.length > 0 && (
            <details className="more">
              <summary>Solved with help ({helped.length}): worth one more independent try</summary>
              <div className="more-body">
                <ul className="card-list">
                  {helped.map((t) => <li key={t.id}><Link className="title" to={t.route}>{t.short ?? t.title}</Link><p>{t.objective}</p></li>)}
                </ul>
              </div>
            </details>
          )}

          <h2 id="mistakes">Revisit: your mistake notebook</h2>
          {open.length ? (
            <ul className="card-list">
              {open.map(([k, m]) => {
                const t = topicById(m.lessonId);
                return (
                  <li key={k}>
                    <span className={`pill ${m.self ? '' : 'active'}`} style={{ marginRight: 8 }}>{m.self ? 'your rating' : 'missed check'}</span>
                    {t ? <Link className="title" to={t.route}>{t.short ?? t.title}</Link> : m.lessonId}
                    {m.text && <p>{m.text}</p>}
                    <div className="toolbar" style={{ marginTop: 8, marginBottom: 0 }}>
                      {t && <Link className="btn btn-small" to={t.route}>Try it again</Link>}
                      <button className="btn btn-small btn-quiet" onClick={() => store.set(k, { ...m, resolved: true })}>Mark as understood</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty"><p>Empty. Checks you miss or solve only with help land here, with a link back to the exact topic.</p></div>
          )}

          <h2>Revision schedule</h2>
          {due.length ? (
            <ul className="card-list">
              {due.map(([k, r]) => {
                const t = topicById(r.lessonId);
                return t ? <li key={k}><Link className="title" to={t.route}>{t.title}</Link><p>Due now. Start a revision round in its practice step and answer from memory.</p></li> : null;
              })}
            </ul>
          ) : (
            <p className="muted">Nothing due now.{upcoming.length ? '' : ' Topics come back 1, 3, 7, 16 and 35 days after you solve their checks; each independent revision pushes the next one further out.'}</p>
          )}
          {upcoming.length > 0 && (
            <ul className="history" aria-label="Coming up">
              {upcoming.map(([k, r]) => (
                <li key={k}><time>{new Date(r.due).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time><span>{topicById(r.lessonId)?.short ?? r.lessonId}</span></li>
              ))}
            </ul>
          )}

          <h2>Your self-assessment</h2>
          <p className="muted small" style={{ marginTop: -6 }}>Rubric ratings, short-answer self-checks and confidence. Useful for spotting blind spots; never counted as solved.</p>
          {selfs.length ? (
            <ul className="card-list">
              {selfs.map(([k, s]) => {
                const t = topicById(k.slice(5));
                const ratings = Object.entries(s.ratings ?? {});
                const strong = ratings.filter(([, v]) => v === 2).length;
                const conf = Object.values(s.confidence ?? {});
                return (
                  <li key={k}>
                    {t ? <Link className="title" to={t.route}>{t.short ?? t.title}</Link> : k}
                    <p>
                      {ratings.length ? `${strong} of ${ratings.length} rubric areas rated strong. ` : ''}
                      {Object.keys(s.checklist ?? {}).length ? `${Object.keys(s.checklist ?? {}).length} short answer(s) self-checked. ` : ''}
                      {conf.length ? `Confidence recorded ${conf.length} time(s): ${conf.filter((c) => c === 'guess').length} guess(es).` : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty"><p>No self-ratings yet. Case studies, mock interviews and the capstone ask you to rate your answer against a rubric.</p></div>
          )}
        </>
      )}

      <h2>Export and import</h2>
      <p className="muted" style={{ fontSize: 15 }}>A versioned JSON file with your progress, notes, sketches and drafts. Importing never overwrites a draft: if both differ, both are kept.</p>
      <div className="toolbar">
        <button className="btn" onClick={doExport}>Export my progress</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>Import a file</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
      </div>
      {msg && <p className="notice" role="status">{msg}</p>}
    </div>
  );
}
