import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CURRICULUM, MODULES } from '../../content/curriculum';
import { useRecords } from '../../progress/ProgressProvider';
import type { LessonStatus } from '../../../shared/progress';

const LEARNER_LABEL: Record<LessonStatus, string> = {
  started: 'Started',
  studied: 'Studied',
  hinted: 'Solved with hints',
  independent: 'Solved independently',
};

export function Topics() {
  const [q, setQ] = useState('');
  const statuses = Object.fromEntries(useRecords('status:').map(([k, v]) => [k.slice(7), v as LessonStatus]));
  useEffect(() => {
    document.title = 'All topics · System Design Masterclass';
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, []);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CURRICULUM;
    return CURRICULUM.filter((t) => [t.title, t.short ?? '', t.objective, ...t.covers].join(' ').toLowerCase().includes(s));
  }, [q]);

  return (
    <div className="page">
      <h1 style={{ marginTop: 0 }}>All topics</h1>
      <p className="muted reading">
        Everything is open. The order below is the recommended route; each topic lists what to read first. Topics marked <em>planned</em> are not
        written yet.
      </p>
      <label className="reading" style={{ display: 'block', margin: '16px 0 8px' }}>
        <span className="visually-hidden">Search topics</span>
        <input type="search" placeholder="Search: cache, idempotency, Strategy, sharding…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {MODULES.map((m) => {
        const items = filtered.filter((t) => t.module === m.id);
        if (!items.length) return null;
        return (
          <section key={m.id} id={m.id} style={{ marginTop: 32 }} className="reading">
            <h2 style={{ fontSize: 20, marginBottom: 2 }}>{m.title}</h2>
            <p className="muted" style={{ margin: '0 0 8px', fontSize: 15 }}>{m.blurb}</p>
            <ul className="card-list">
              {items.map((t) => (
                <li key={t.id}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <Link className="title" to={t.route}>{t.title}</Link>
                    <span style={{ display: 'flex', gap: 6 }}>
                      {statuses[t.id] && <span className={`pill ${statuses[t.id] === 'independent' ? 'ok' : statuses[t.id] === 'started' ? '' : 'active'}`}>{LEARNER_LABEL[statuses[t.id]]}</span>}
                      {t.status === 'planned' && <span className="pill">planned</span>}
                      {t.status === 'partial' && <span className="pill">in progress</span>}
                    </span>
                  </div>
                  <p>{t.objective}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {!filtered.length && <p>No topics match “{q}”.</p>}
      <p className="muted" style={{ marginTop: 40, fontSize: 14 }}>
        Curious how complete the course is? See the <Link to="/coverage">coverage report</Link>.
      </p>
    </div>
  );
}
