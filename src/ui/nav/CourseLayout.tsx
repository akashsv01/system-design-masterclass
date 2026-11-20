/**
 * Layout for every course page (lessons, labs, cases, patterns, capstone): the navigator as a collapsible
 * sidebar on wide screens or a Topics drawer on narrow ones, a Category › Module › Lesson breadcrumb, and
 * previous/next lesson links (distinct from in-lesson step controls). The page records the learner's last place
 * (`pref:last`, synced when signed in) so the home page, Topics and the drawer can offer “Continue”.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { neighbours, pathOf, topicForPath } from '../../content/outline';
import { topicById } from '../../content/curriculum';
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { CourseNav } from './CourseNav';
import { Icon } from '../components/Icon';

interface NavCtl { available: boolean; open: boolean; toggle: () => void; register: (c: { open: boolean; toggle: () => void } | null) => void }
const Ctx = createContext<NavCtl>({ available: false, open: false, toggle: () => {}, register: () => {} });
export const InCourseLayout = createContext(false);

/** Lets the site header show the Topics toggle while a course page is open. */
export function NavProvider({ children }: { children: ReactNode }) {
  const [c, setC] = useState<{ open: boolean; toggle: () => void } | null>(null);
  return <Ctx.Provider value={{ available: !!c, open: !!c?.open, toggle: () => c?.toggle(), register: setC }}>{children}</Ctx.Provider>;
}

export function TopicsToggle() {
  const n = useContext(Ctx);
  if (!n.available) return null;
  return (
    <button className="topics-toggle" aria-label="Topics" aria-expanded={n.open} aria-controls="course-nav" onClick={n.toggle} title={n.open ? 'Hide the course outline' : 'Show the course outline'}>
      <Icon name="list" size={18} /> <span>Topics</span>
    </button>
  );
}

function useMedia(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, [q]);
  return m;
}

export interface LastPlace { id: string; at: number }

export function ContinueLink({ exclude, compact }: { exclude?: string; compact?: boolean }) {
  const [last] = useRecord<LastPlace | null>('pref:last', null);
  const [step] = useRecord<number>(`step:${last?.id ?? '_'}`, 0);
  const t = last ? topicById(last.id) : undefined;
  if (!t || t.id === exclude) return null;
  return (
    <Link className={`continue-link ${compact ? 'compact' : ''}`} to={t.route} state={{ restore: true }}>
      <Icon name="replay" size={16} />
      <span><span className="muted small">Continue where you left off</span><strong>{t.short ?? t.title}</strong>{step > 0 && <span className="muted small"> · step {step + 1}</span>}</span>
    </Link>
  );
}

export function CourseLayout() {
  const loc = useLocation();
  const topic = topicForPath(loc.pathname);
  const wide = useMedia('(min-width: 1100px)');
  const [sideOpen, setSideOpen] = useState(() => { try { return localStorage.getItem('sdm:outline:side') !== '0'; } catch { return true; } });
  const [drawer, setDrawer] = useState(false);
  const ctl = useContext(Ctx);
  const { store } = useProgress();
  const opener = useRef<HTMLElement | null>(null);
  const open = wide ? sideOpen : drawer;
  const toggle = () => {
    if (wide) setSideOpen((v) => { try { localStorage.setItem('sdm:outline:side', v ? '0' : '1'); } catch { /* ignore */ } return !v; });
    else { opener.current = document.activeElement as HTMLElement; setDrawer((v) => !v); }
  };
  useEffect(() => { ctl.register({ open, toggle }); }, [open, wide]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => ctl.register(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setDrawer(false); }, [loc.pathname]);
  useEffect(() => { if (topic) store.set('pref:last', { id: topic.id, at: Date.now() } satisfies LastPlace); }, [topic?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = topic ? pathOf(topic.id) : undefined;
  const { prev, next } = topic ? neighbours(topic.id) : {};
  return (
    <InCourseLayout.Provider value={true}>
      <div className={`course ${wide && sideOpen ? 'with-side' : ''}`}>
        {wide && sideOpen && (
          <aside id="course-nav" className="course-side" aria-label="Course outline">
            <CourseNav currentId={topic?.id} variant="sidebar" top={<ContinueLink exclude={topic?.id} compact />} />
          </aside>
        )}
        <div className="course-main">
          {p && (
            <nav className="course-crumbs" aria-label="Breadcrumb">
              <Link to={`/topics#${p.category.id}`}>{p.category.title}</Link>
              <Icon name="chevron-right" size={14} />
              <Link to={`/topics#${p.category.id}/${p.unit.id}`}>{p.unit.title}</Link>
              <Icon name="chevron-right" size={14} />
              <span aria-current="page">{p.topic.short ?? p.topic.title}</span>
            </nav>
          )}
          <Outlet />
          {topic && (prev || next) && (
            <nav className="lesson-pager" aria-label="Previous and next lesson">
              {prev ? <Link rel="prev" to={prev.route}><span className="dir"><Icon name="arrow-left" size={15} /> Previous lesson</span><span className="t">{prev.short ?? prev.title}</span></Link> : <span />}
              {next ? <Link rel="next" to={next.route} className="next"><span className="dir">Next lesson <Icon name="arrow-right" size={15} /></span><span className="t">{next.short ?? next.title}</span></Link> : <span />}
            </nav>
          )}
        </div>
        {!wide && drawer && <Drawer onClose={() => { setDrawer(false); opener.current?.focus({ preventScroll: true }); }} currentId={topic?.id} />}
      </div>
    </InCourseLayout.Provider>
  );
}

/** Phone/tablet: the outline in a modal drawer. Dismissing it leaves the page (step, scroll) exactly as it was. */
function Drawer({ onClose, currentId }: { onClose: () => void; currentId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('a[href], button, input')].filter((x) => !x.hasAttribute('disabled'));
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { html.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return (
    <div className="drawer-root">
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <div id="course-nav" ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label="Topics">
        <div className="drawer-head">
          <strong>Topics</strong>
          <Link to="/topics" className="small">All topics page</Link>
          <button className="icon-btn" onClick={onClose} aria-label="Close topics"><Icon name="close" size={18} /></button>
        </div>
        <CourseNav currentId={currentId} variant="drawer" onChoose={onClose} autoFocus top={<ContinueLink exclude={currentId} compact />} />
      </div>
    </div>
  );
}
