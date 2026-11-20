import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigationType, useParams } from 'react-router-dom';
import { useProgress } from '../progress/ProgressProvider';
import { AccountDialog } from './pages/Account';
import { Home } from './pages/Home';
import { Topics } from './pages/Topics';
import { ProgressPage } from './pages/ProgressPage';
import { topicById } from '../content/curriculum';
import { GENERIC_LESSONS } from '../content/lessons';
import { CASES } from '../content/cases';
import { Icon } from './components/Icon';
import { CourseLayout, NavProvider, TopicsToggle } from './nav/CourseLayout';

const CUSTOM: Record<string, React.LazyExoticComponent<ComponentType>> = {
  'first-booking': lazy(() => import('./lessons/FirstBooking')),
  'replica-lag': lazy(() => import('./lessons/ReplicaLag')),
  'lru-cache': lazy(() => import('./lessons/LruCache')),
};
const GenericLesson = lazy(() => import('./lessons/GenericLesson'));
const CaseStudyPage = lazy(() => import('./pages/CaseStudy'));
const LabPage = lazy(() => import('./labs/LabRouter'));
const PatternsPage = lazy(() => import('./pages/Patterns'));
const PracticePage = lazy(() => import('./pages/Practice'));
const InterviewPage = lazy(() => import('./pages/Interview'));
const CapstonePage = lazy(() => import('./pages/Capstone'));
const CoveragePage = lazy(() => import('./pages/Coverage'));

function Brand() {
  return (
    <Link to="/" className="brand" aria-label="System Design Masterclass home">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <rect x="6" y="12.5" width="7" height="7" rx="2" fill="var(--paper)" />
        <rect x="19" y="6" width="7" height="7" rx="2" fill="var(--paper)" />
        <rect x="19" y="19" width="7" height="7" rx="2" fill="var(--active)" />
        <path d="M13 15.2 19 10.3M13 16.8l6 4.9" stroke="var(--paper)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="brand-text">System Design Masterclass</span>
    </Link>
  );
}

function SyncChip({ onOpen }: { onOpen: () => void }) {
  const { user, sync } = useProgress();
  // Five honest states: saved locally (guest), saving, synced, pending, failed (brief §11).
  const label = !user
    ? { short: 'On this device', long: 'Saved on this device' }
    : sync.kind === 'saved'
      ? { short: 'Synced', long: 'Synced to your account' }
      : sync.kind === 'saving'
        ? { short: 'Syncing…', long: 'Syncing…' }
        : sync.kind === 'pending'
          ? { short: `${sync.count} waiting`, long: `${sync.count} change${sync.count === 1 ? '' : 's'} waiting to sync` }
          : sync.kind === 'error'
            ? { short: 'Sync failed', long: 'Sync failed — retrying' }
            : { short: 'Saved locally', long: 'Saved locally' };
  return (
    <button
      className="sync-chip"
      data-kind={user ? sync.kind : 'local'}
      onClick={onOpen}
      title={sync.kind === 'pending' ? sync.reason : sync.kind === 'error' ? sync.message : label.long}
      aria-label={`${label.long}. ${user ? 'Account and sync settings' : 'Sign in to sync across devices'}`}
    >
      <span className="dot" aria-hidden="true" />
      <span className="label-long">{label.long}</span>
      {user ? null : <span className="chip-action">Sign in</span>}
    </button>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<string | null>(() => {
    try {
      return localStorage.getItem('sdm:theme');
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try {
      if (theme) localStorage.setItem('sdm:theme', theme);
      else localStorage.removeItem('sdm:theme');
    } catch {
      /* ignore */
    }
  }, [theme]);
  const dark = theme ? theme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return (
    <button className="icon-btn" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title="Theme">
      <Icon name={dark ? 'sun' : 'moon'} size={19} />
    </button>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(false);
  const loc = useLocation();
  const [tucked, setTucked] = useState(false);
  useEffect(() => setOpen(false), [loc.pathname]);
  // Keep navigation out of the lesson on phones: hide while scrolling down, show on scroll up.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const inLesson = !!document.querySelector('.lesson');
      if (!inLesson || window.innerWidth > 760) setTucked(false);
      else if (y > last + 6 && y > 80) setTucked(true);
      else if (y < last - 6) setTucked(false);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={`site-header ${tucked && !open && !account ? 'tucked' : ''}`}>
      <TopicsToggle />
      <Brand />
      <nav className={`nav ${open ? 'open' : ''}`} aria-label="Main">
        <NavLink to="/topics">All topics</NavLink>
        <NavLink to="/practice">Practice</NavLink>
        <NavLink to="/interview">Interview</NavLink>
        <NavLink to="/progress">Progress</NavLink>
      </nav>
      <div className="header-right">
        <SyncChip onOpen={() => setAccount(true)} />
        <ThemeToggle />
        <button className="icon-btn menu-btn" aria-expanded={open} aria-label={open ? 'Close menu' : 'Menu'} onClick={() => setOpen(!open)}>
          <Icon name={open ? 'close' : 'menu'} size={20} />
        </button>
      </div>
      {account && <AccountDialog onClose={() => setAccount(false)} />}
    </header>
  );
}

function LessonRoute() {
  const { id = '' } = useParams();
  const topic = topicById(id);
  useEffect(() => {
    document.title = topic ? `${topic.short ?? topic.title} · System Design Masterclass` : 'System Design Masterclass';
  }, [id, topic]);
  const Custom = CUSTOM[id];
  if (Custom) return <Custom />;
  if (GENERIC_LESSONS[id]) return <GenericLesson id={id} />;
  if (topic) return <Planned id={id} />;
  return <NotFound />;
}

function CaseRoute() {
  const { id = '' } = useParams();
  const topic = topicById(id);
  useEffect(() => {
    document.title = topic ? `${topic.title} · System Design Masterclass` : 'System Design Masterclass';
  }, [topic]);
  if (CASES[id]) return <CaseStudyPage id={id} />;
  if (topic) return <Planned id={id} />;
  return <NotFound />;
}

export function Planned({ id }: { id: string }) {
  const t = topicById(id)!;
  return (
    <div className="page reading">
      <p className="crumbs"><Link to="/topics">All topics</Link></p>
      <h1>{t.title}</h1>
      <p className="notice warn">This topic is planned but not written yet. Its place in the course is below.</p>
      <p><strong>You’ll be able to:</strong> {t.objective}</p>
      {t.prereqs.length > 0 && (
        <p>
          <strong>Before this:</strong>{' '}
          {t.prereqs.map((p, i) => {
            const pt = topicById(p);
            return pt ? <span key={p}>{i > 0 && ', '}<Link to={pt.route}>{pt.short ?? pt.title}</Link></span> : null;
          })}
        </p>
      )}
    </div>
  );
}

function NotFound() {
  return (
    <div className="page reading">
      <h1>Page not found</h1>
      <p>
        That address doesn’t match a lesson. <Link to="/topics">Browse all topics</Link> or <Link to="/learn/first-booking">start from scratch</Link>.
      </p>
    </div>
  );
}

/**
 * New page, new reading position — except when the learner comes back (browser Back, or a “Continue” link):
 * then the page returns to where they were. Positions are remembered per address for this tab.
 */
function ScrollToTop() {
  const { pathname, hash, state } = useLocation();
  const navType = useNavigationType();
  // Save the position when the learner leaves (a link click or Back/Forward), before the old page unmounts and
  // the browser clamps the scroll. Saving on every scroll would record that clamped 0.
  const current = useRef(pathname);
  useEffect(() => { current.current = pathname; }, [pathname]);
  useEffect(() => {
    const saveNow = () => { try { sessionStorage.setItem(`sdm:scroll:${current.current}`, String(Math.round(window.scrollY))); } catch { /* ignore */ } };
    const onClick = (e: MouseEvent) => { if ((e.target as Element | null)?.closest?.('a[href]')) saveNow(); };
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', saveNow);
    window.addEventListener('pagehide', saveNow);
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('popstate', saveNow); window.removeEventListener('pagehide', saveNow); };
  }, []);
  useEffect(() => {
    if (hash) return;
    let saved = 0;
    try { saved = Number(sessionStorage.getItem(`sdm:scroll:${pathname}`) ?? 0); } catch { /* ignore */ }
    const restore = (navType === 'POP' || (state as { restore?: boolean } | null)?.restore) && saved > 0;
    if (!restore) { window.scrollTo(0, 0); return; }
    // Lessons load lazily: retry until the page is tall enough to reach the saved position.
    let tries = 0;
    const tick = () => {
      if (document.documentElement.scrollHeight - window.innerHeight >= saved - 2 || tries++ > 40) window.scrollTo(0, saved);
      else setTimeout(tick, 25);
    };
    tick();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function App() {
  return (
    <NavProvider>
      <ScrollToTop />
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Suspense fallback={<div className="page muted">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/topics" element={<Topics />} />
            <Route element={<CourseLayout />}>
              <Route path="/learn/:id" element={<LessonRoute />} />
              <Route path="/labs/:id" element={<LabPage />} />
              <Route path="/cases/:id" element={<CaseRoute />} />
              <Route path="/patterns/:id?" element={<PatternsPage />} />
              <Route path="/capstone/:id?" element={<CapstonePage />} />
            </Route>
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/interview/:id?" element={<InterviewPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/coverage" element={<CoveragePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </NavProvider>
  );
}
