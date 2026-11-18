import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useProgress } from '../progress/ProgressProvider';
import { AccountDialog } from './pages/Account';
import { Home } from './pages/Home';
import { Topics } from './pages/Topics';
import { ProgressPage } from './pages/ProgressPage';
import { topicById } from '../content/curriculum';
import { GENERIC_LESSONS } from '../content/lessons';
import { CASES } from '../content/cases';

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
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="var(--accent)" />
        <circle cx="9" cy="16" r="4" fill="var(--paper)" />
        <circle cx="23" cy="9" r="4" fill="var(--paper)" />
        <circle cx="23" cy="23" r="4" fill="var(--active)" />
        <path d="M12.5 14.5 19.5 10.5M12.5 17.5l7 4" stroke="var(--paper)" strokeWidth="2" />
      </svg>
      <span className="brand-text">System Design Masterclass</span>
    </Link>
  );
}

function SyncChip({ onOpen }: { onOpen: () => void }) {
  const { user, sync } = useProgress();
  const label = !user
    ? { short: 'Guest', long: 'Saved on this device' }
    : sync.kind === 'saved'
      ? { short: 'Synced', long: 'Synced to your account' }
      : sync.kind === 'saving'
        ? { short: 'Saving…', long: 'Saving…' }
        : sync.kind === 'pending'
          ? { short: `${sync.count} pending`, long: `${sync.count} change(s) waiting to sync` }
          : sync.kind === 'error'
            ? { short: 'Sync failed', long: 'Sync failed' }
            : { short: 'Local', long: 'Saved locally' };
  return (
    <button className="sync-chip" data-kind={user ? sync.kind : 'local'} onClick={onOpen} title={sync.kind === 'pending' ? sync.reason : sync.kind === 'error' ? sync.message : label.long}>
      <span className="dot" aria-hidden="true" />
      <span className="label-long">{label.long}</span>
      <span className="visually-hidden">{label.short}. </span>
      <span>{user ? '' : ' · Sign in'}</span>
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
      {dark ? '☀' : '☾'}
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
      <Brand />
      <nav className={`nav ${open ? 'open' : ''}`} aria-label="Main">
        <NavLink to="/topics">Topics</NavLink>
        <NavLink to="/practice">Practice</NavLink>
        <NavLink to="/interview">Interview</NavLink>
        <NavLink to="/progress">My progress</NavLink>
      </nav>
      <div className="header-right">
        <SyncChip onOpen={() => setAccount(true)} />
        <ThemeToggle />
        <button className="icon-btn menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>
          ☰
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
    window.scrollTo(0, 0);
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

export function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Suspense fallback={<div className="page muted">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/topics" element={<Topics />} />
            <Route path="/learn/:id" element={<LessonRoute />} />
            <Route path="/labs/:id" element={<LabPage />} />
            <Route path="/cases/:id" element={<CaseRoute />} />
            <Route path="/patterns/:id?" element={<PatternsPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/interview/:id?" element={<InterviewPage />} />
            <Route path="/capstone/:id?" element={<CapstonePage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/coverage" element={<CoveragePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}
