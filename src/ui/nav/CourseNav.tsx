/**
 * The course navigator (D19–D22; project-wide instructions §2): one component for the Topics page, the desktop
 * sidebar and the phone drawer. Category → Module → Lesson. Expanding never navigates and never moves what the
 * learner is looking at; expansion and scroll position are remembered; the current lesson's ancestors open by
 * themselves; search finds lessons inside collapsed branches and shows their full path.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES } from '../../content/manifest';
import { topicById } from '../../content/curriculum';
import type { TopicWithStatus } from '../../content/types';
import { DECISIONS } from '../../content/decisions';
import { pathOf, searchOutline, unitKey } from '../../content/outline';
import { useRecords } from '../../progress/ProgressProvider';
import type { TopicKind } from '../../content/types';
import { Icon } from '../components/Icon';

const OPEN_KEY = 'sdm:outline:open';
const KIND: Partial<Record<TopicKind, string>> = { lab: 'Lab', 'case-hld': 'HLD case', 'case-lld': 'LLD case', bridge: 'Bridge', pattern: 'Reference', capstone: 'Capstone' };

function load<T>(key: string, fallback: T, store: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): T {
  try { const v = store?.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function save(key: string, v: unknown, store: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage) {
  try { store?.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable: the outline still works */ }
}

type Status = 'done' | 'started' | undefined;
function useStatuses(): Record<string, Status> {
  const recs = useRecords('status:');
  return useMemo(() => Object.fromEntries(recs.map(([k, v]) => [k.slice(7), v === 'started' ? 'started' : v ? 'done' : undefined])), [recs]);
}

export function CourseNav({ currentId, variant, onChoose, top, autoFocus, revealKey }: {
  currentId?: string;
  variant: 'page' | 'sidebar' | 'drawer';
  /** Called after the learner picks a lesson (the drawer closes). */
  onChoose?: () => void;
  /** Rendered above the tree (e.g. “Continue where you left off”). */
  top?: ReactNode;
  autoFocus?: boolean;
  /** A category or category/module to open and scroll to (Topics page deep links). */
  revealKey?: string;
}) {
  const statuses = useStatuses();
  const [open, setOpen] = useState<Set<string>>(() => new Set(load<string[]>(OPEN_KEY, [])));
  const [q, setQ] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const anchor = useRef<{ el: HTMLElement; top: number } | null>(null);
  const beforeSearch = useRef(0);
  const scrollKey = `sdm:outline:scroll:${variant}`;
  const ownScroll = variant !== 'page';

  // The current lesson's category and module open by themselves (the learner can still close them).
  useEffect(() => {
    const p = currentId ? pathOf(currentId) : undefined;
    if (p) setOpen((o) => (o.has(p.category.id) && o.has(unitKey(p.category.id, p.unit.id)) ? o : new Set([...o, p.category.id, unitKey(p.category.id, p.unit.id)])));
  }, [currentId]);
  useEffect(() => {
    if (!revealKey) return;
    const [c, u] = revealKey.split('/');
    setOpen((o) => new Set([...o, c, ...(u ? [unitKey(c, u)] : [])]));
    requestAnimationFrame(() => document.getElementById(`cn-${revealKey.replace('/', '--')}`)?.scrollIntoView({ block: 'start' }));
  }, [revealKey]);
  useEffect(() => save(OPEN_KEY, [...open]), [open]);
  // Remembered scroll position; the current lesson stays in view when the outline reopens.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !ownScroll) return;
    el.scrollTop = load<number>(scrollKey, 0, typeof sessionStorage === 'undefined' ? undefined : sessionStorage);
    const cur = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (cur) {
      const r = cur.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      if (r.top < b.top + 48 || r.bottom > b.bottom - 8) el.scrollTop += r.top - b.top - b.height / 3;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (autoFocus) inputRef.current?.focus({ preventScroll: true }); }, [autoFocus]);
  // Expanding or collapsing keeps the pressed row exactly where it was on screen.
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    const d = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(d) < 1) return;
    if (ownScroll && scrollRef.current) scrollRef.current.scrollTop += d;
    else window.scrollBy(0, d);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: string, el: HTMLElement) => {
    anchor.current = { el, top: el.getBoundingClientRect().top };
    setOpen((o) => { const n = new Set(o); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };
  const setQuery = (v: string) => {
    if (!q && v && scrollRef.current) beforeSearch.current = scrollRef.current.scrollTop;
    setQ(v);
    if (q && !v) requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = beforeSearch.current; });
  };
  const hits = useMemo(() => searchOutline(q), [q]);
  const reveal = (t: TopicWithStatus) => {
    const p = pathOf(t.id);
    if (p) setOpen((o) => new Set([...o, p.category.id, unitKey(p.category.id, p.unit.id)]));
    setQ('');
    onChoose?.();
  };
  const counts = (ids: string[]) => `${ids.filter((id) => statuses[id] === 'done').length} / ${ids.length}`;
  const allOpen = CATEGORIES.every((c) => open.has(c.id));

  return (
    <div className={`course-nav v-${variant}`}>
      <div className="cn-search" role="search">
        <label>
          <Icon name="search" size={17} />
          <span className="visually-hidden">Search all topics</span>
          <input
            ref={inputRef}
            type="search"
            value={q}
            placeholder="Search topics"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && q) { e.stopPropagation(); setQuery(''); }
              if (e.key === 'ArrowDown') { e.preventDefault(); (e.currentTarget.closest('.course-nav')?.querySelector('.cn-results a') as HTMLElement | null)?.focus(); }
              if (e.key === 'Enter' && hits[0]) (e.currentTarget.closest('.course-nav')?.querySelector('.cn-results a') as HTMLElement | null)?.click();
            }}
          />
        </label>
        {variant === 'page' && !q && <button className="btn btn-small btn-quiet" onClick={() => setOpen(allOpen ? new Set() : new Set(CATEGORIES.flatMap((c) => [c.id, ...c.units.map((u) => unitKey(c.id, u.id))])))}>{allOpen ? 'Collapse all' : 'Expand all'}</button>}
      </div>
      <div className="cn-scroll" ref={scrollRef} onScroll={(e) => ownScroll && save(scrollKey, e.currentTarget.scrollTop, typeof sessionStorage === 'undefined' ? undefined : sessionStorage)}>
        {!q && top}
        {q ? (
          <div aria-live="polite">
            <p className="cn-count muted small">{hits.length ? `${hits.length} ${hits.length === 1 ? 'topic' : 'topics'} match “${q.trim()}”` : `No topics match “${q.trim()}”. Try a broader word, such as “cache” or “queue”.`}</p>
            <ul className="cn-results">
              {hits.map((h) => (
                <li key={h.topic.id}>
                  <Link to={h.topic.route} onClick={() => reveal(h.topic)} aria-current={h.topic.id === currentId ? 'page' : undefined}
                    onKeyDown={(e) => {
                      const items = [...(e.currentTarget.closest('.cn-results')?.querySelectorAll('a') ?? [])] as HTMLElement[];
                      const i = items.indexOf(e.currentTarget);
                      if (e.key === 'ArrowDown') { e.preventDefault(); items[i + 1]?.focus(); }
                      if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] ?? inputRef.current)?.focus(); }
                    }}>
                    <span className="cn-title"><Highlight text={h.topic.title} q={q} /></span>
                    <span className="cn-path">{h.path.category.title} › {h.path.unit.title}{KIND[h.topic.kind] ? ` · ${KIND[h.topic.kind]}` : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="cn-tree" aria-label="Course outline">
            {CATEGORIES.map((c) => {
              const catIds = c.units.flatMap((u) => u.topics);
              const co = open.has(c.id);
              return (
                <li key={c.id} id={`cn-${c.id}`} className="cn-cat-li">
                  <button className="cn-cat" aria-expanded={co} onClick={(e) => toggle(c.id, e.currentTarget)}>
                    <Icon name={co ? 'chevron-down' : 'chevron-right'} size={16} />
                    <span className="cn-name">{c.title}</span>
                    <span className="cn-meta">{counts(catIds)}</span>
                  </button>
                  {co && (
                    <>
                      {variant === 'page' && <p className="cn-blurb">{c.blurb}</p>}
                      <ul className="cn-units">
                        {c.units.map((u) => {
                          const k = unitKey(c.id, u.id);
                          const uo = open.has(k);
                          return (
                            <li key={u.id} id={`cn-${c.id}--${u.id}`}>
                              <button className="cn-unit" aria-expanded={uo} onClick={(e) => toggle(k, e.currentTarget)}>
                                <Icon name={uo ? 'chevron-down' : 'chevron-right'} size={15} />
                                <span className="cn-name">{u.title}</span>
                                <span className="cn-meta">{counts(u.topics)}</span>
                              </button>
                              {uo && (
                                <ul className="cn-lessons">
                                  {u.topics.map((id) => {
                                    const t = topicById(id);
                                    if (!t) return null;
                                    const st = statuses[id];
                                    const cur = id === currentId;
                                    return (
                                      <li key={id}>
                                        <Link to={t.route} className={`cn-lesson ${cur ? 'current' : ''}`} aria-current={cur ? 'page' : undefined} onClick={onChoose}>
                                          <span className={`cn-dot ${st ?? ''}`} aria-hidden="true" />
                                          <span className="cn-lesson-text">
                                            <span className="cn-name">{t.short ?? t.title}</span>
                                            {variant === 'page' && DECISIONS[id] && <span className="cn-decision">You decide: {DECISIONS[id]}.</span>}
                                          </span>
                                          <span className="cn-meta">
                                            {cur ? <strong className="cn-here">You are here</strong> : st === 'done' ? 'Done' : st === 'started' ? 'Started' : KIND[t.kind] ?? ''}
                                            <span className="visually-hidden">{st ? `, ${st === 'done' ? 'completed' : 'started'}` : ''}</span>
                                          </span>
                                        </Link>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  const s = q.trim().toLowerCase().split(/\s+/)[0];
  const i = s ? text.toLowerCase().indexOf(s) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + s.length)}</mark>{text.slice(i + s.length)}</>;
}
