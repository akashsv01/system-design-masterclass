/**
 * Topic catalog (brief §4): supports guided progression (modules in route order, the next unstarted topic
 * marked) and direct lookup (search across titles, decisions, objectives and scope terms; module filter).
 * Each row names the decision the activity helps you practise (src/content/decisions.ts).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CURRICULUM, MODULES } from '../../content/curriculum';
import { DECISIONS } from '../../content/decisions';
import { useRecords } from '../../progress/ProgressProvider';
import type { LessonStatus } from '../../../shared/progress';
import type { TopicKind } from '../../content/types';
import { Icon } from '../components/Icon';

const LEARNER_LABEL: Record<LessonStatus, string> = {
  started: 'Started',
  studied: 'Studied',
  hinted: 'Solved with help',
  independent: 'Solved independently',
};
const KIND_LABEL: Record<TopicKind, string> = {
  lesson: 'Lesson', bridge: 'Bridge', lab: 'Lab', 'case-hld': 'HLD case', 'case-lld': 'LLD case', pattern: 'Reference', capstone: 'Capstone',
};
const SHORT: Record<string, string> = {
  start: 'Start here', bridges: 'Bridges', foundations: 'Foundations', data: 'Data', distributed: 'Distributed', architecture: 'Architecture',
  lld: 'LLD', labs: 'Labs', 'cases-hld': 'HLD cases', 'cases-lld': 'LLD cases', capstone: 'Capstone',
};

export function Topics() {
  const [q, setQ] = useState('');
  const [mod, setMod] = useState<string | null>(null);
  const statuses = Object.fromEntries(useRecords('status:').map(([k, v]) => [k.slice(7), v as LessonStatus]));
  useEffect(() => {
    document.title = 'All topics · System Design Masterclass';
    const h = location.hash.slice(1);
    if (h && MODULES.some((m) => m.id === h)) setTimeout(() => document.getElementById(h)?.scrollIntoView(), 50);
  }, []);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CURRICULUM.filter((t) => (!mod || t.category === mod) && (!s || [t.title, t.short ?? '', t.objective, DECISIONS[t.id] ?? '', ...t.covers].join(' ').toLowerCase().includes(s)));
  }, [q, mod]);
  // The next topic on the recommended route: the first one the learner hasn't opened.
  const nextOnRoute = CURRICULUM.find((t) => !statuses[t.id] && t.status !== 'planned')?.id;

  return (
    <div className="page">
      <h1 className="page-title">All topics</h1>
      <p className="page-lede">
        All {CURRICULUM.length} topics are open. Work down the route in order, or search for the one idea you need. Each entry names the decision
        it helps you practise.
      </p>
      <div className="catalog-tools">
        <label className="search">
          <Icon name="search" size={18} />
          <span className="visually-hidden">Search topics</span>
          <input type="search" placeholder="Search: cache, idempotency, Strategy, sharding…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="chips" role="group" aria-label="Filter by part of the course">
          <button className="chip" aria-pressed={!mod} onClick={() => setMod(null)}>Everything</button>
          {MODULES.map((m) => (
            <button key={m.id} className="chip" aria-pressed={mod === m.id} onClick={() => setMod(mod === m.id ? null : m.id)}>{SHORT[m.id] ?? m.title}</button>
          ))}
        </div>
      </div>
      <ul className="evidence-key" aria-label="Status key" style={{ marginBottom: 24 }}>
        <li><span className="state" />Not started</li>
        <li><span className="state studied" />Studied</li>
        <li><span className="state hinted" />Solved with help</li>
        <li><span className="state independent" />Solved independently</li>
      </ul>
      {MODULES.map((m) => {
        const items = filtered.filter((t) => t.category === m.id);
        if (!items.length) return null;
        const all = CURRICULUM.filter((t) => t.category === m.id);
        const solved = all.filter((t) => statuses[t.id] === 'independent' || statuses[t.id] === 'hinted').length;
        return (
          <section key={m.id} id={m.id} className="module-block" aria-labelledby={`h-${m.id}`}>
            <header>
              <h2 id={`h-${m.id}`}>{m.title}</h2>
              <span className="muted small">{all.length} {all.length === 1 ? 'item' : 'items'}{solved ? ` · ${solved} solved` : ''}</span>
            </header>
            <p className="blurb">{m.blurb}</p>
            <ul className="topic-rows">
              {items.map((t) => {
                const st = statuses[t.id];
                return (
                  <li key={t.id} className="topic-row">
                    <span className={`state ${st ?? ''}`} title={st ? LEARNER_LABEL[st] : 'Not started'} aria-hidden="true" />
                    <div>
                      <Link className="t-title" to={t.route}>{t.title}</Link>
                      {t.id === nextOnRoute && <span className="pill accent" style={{ marginLeft: 8 }}>Next on the route</span>}
                      {DECISIONS[t.id] && <p className="t-decision"><span className="muted">You decide:</span> {DECISIONS[t.id]}.</p>}
                    </div>
                    <span className="t-meta">
                      <span className="t-kind">{KIND_LABEL[t.kind]}</span>
                      <span className="visually-hidden">Status: {st ? LEARNER_LABEL[st] : 'not started'}.</span>
                      {st && <span>{LEARNER_LABEL[st]}</span>}
                      {t.status === 'planned' && <span className="pill">planned</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {!filtered.length && (
        <div className="empty">
          <p>No topics match “{q}”{mod ? ` in ${SHORT[mod]}` : ''}.</p>
          <p>Try a broader word, or <button className="btn-link" onClick={() => { setQ(''); setMod(null); }}>clear the search</button>.</p>
        </div>
      )}
      <p className="muted" style={{ marginTop: 40, fontSize: 14 }}>
        How complete is the course, and what has been checked? See the <Link to="/coverage">coverage report</Link>.
      </p>
    </div>
  );
}
