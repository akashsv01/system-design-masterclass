import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgress, useRecords } from '../../progress/ProgressProvider';
import { CURRICULUM, topicById } from '../../content/curriculum';
import type { LessonStatus } from '../../../shared/progress';

export function ProgressPage() {
  const { store, user } = useProgress();
  const statuses = useRecords('status:');
  const mistakes = useRecords('mistake:') as [string, { lessonId: string; text: string; at: number; resolved: boolean }][];
  const reviews = useRecords('review:') as [string, { lessonId: string; due: number; reps: number }][];
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    document.title = 'My progress · System Design Masterclass';
  }, []);

  const count = (s: LessonStatus) => statuses.filter(([, v]) => v === s).length;
  const now = Date.now();
  const due = reviews.filter(([, r]) => r.due <= now).sort((a, b) => a[1].due - b[1].due);
  const open = mistakes.filter(([, m]) => !m.resolved).sort((a, b) => b[1].at - a[1].at);
  const total = CURRICULUM.filter((t) => t.status !== 'planned').length;

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
      <h1 style={{ marginTop: 0 }}>My progress</h1>
      {!user && (
        <p className="notice">Your progress is saved in this browser only. Sign in (top right) to keep it across devices, or export it below.</p>
      )}
      <div className="table-wrap">
        <table className="data">
          <tbody>
            <tr><th>Studied (worked through)</th><td>{count('studied')}</td></tr>
            <tr><th>Solved with hints</th><td>{count('hinted')}</td></tr>
            <tr><th>Solved independently</th><td>{count('independent')}</td></tr>
            <tr><th>Started, not finished</th><td>{count('started')}</td></tr>
            <tr><th>Topics available</th><td>{total}</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Due for revision</h2>
      {due.length ? (
        <ul className="card-list">
          {due.map(([k, r]) => {
            const t = topicById(r.lessonId);
            return t ? <li key={k}><Link className="title" to={t.route}>{t.title}</Link><p>Revisit and redo its checks. Interval grows each time you solve it without hints.</p></li> : null;
          })}
        </ul>
      ) : (
        <p className="muted">Nothing due. Lessons come back for revision 1, 3, 7, 16 and 35 days after you solve their checks.</p>
      )}

      <h2>Mistake notebook</h2>
      {open.length ? (
        <ul className="card-list">
          {open.map(([k, m]) => {
            const t = topicById(m.lessonId);
            return (
              <li key={k}>
                {t ? <Link className="title" to={t.route}>{t.title}</Link> : m.lessonId}
                {m.text && <p>{m.text}</p>}
                <div className="toolbar" style={{ marginTop: 6, marginBottom: 0 }}>
                  <button className="btn btn-small btn-quiet" onClick={() => store.set(k, { ...m, resolved: true })}>Mark as understood</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">Empty. Checks you miss, or solve only with hints, are collected here.</p>
      )}

      <h2>Export and import</h2>
      <p className="muted" style={{ fontSize: 15 }}>A versioned JSON file with your progress, notes and drafts. Importing never overwrites a draft: if both differ, both are kept.</p>
      <div className="toolbar">
        <button className="btn" onClick={doExport}>Export my progress</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>Import a file</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
      </div>
      {msg && <p className="notice" role="status">{msg}</p>}
    </div>
  );
}
