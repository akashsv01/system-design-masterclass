/**
 * Home (brief §2, §4).
 *  - First visit: a concrete question with the opening scenario drawn beside it, one prominent action
 *    (Start from scratch → the first lesson), "Browse all topics" close by, and HLD/LLD introduced through
 *    the same example before any choice of practice.
 *  - Return visit: the exact unfinished activity (named down to the step) as the primary action, then what is
 *    due and the shape of the route.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRecord, useRecords } from '../../progress/ProgressProvider';
import { MODULES, topicsInModule } from '../../content/curriculum';
import { recommend, type LastActivity, type Mistake, type Review } from '../../progress/recommend';
import type { LessonStatus } from '../../../shared/progress';
import { Diagram, type Layout } from '../components/Diagram';
import { Icon } from '../components/Icon';

const TEASER_WIDE: Layout = {
  width: 560,
  height: 300,
  nodes: {
    maya: { x: 100, y: 70, w: 170 },
    leo: { x: 100, y: 230, w: 170 },
    server: { x: 300, y: 150, w: 120, h: 70 },
    db: { x: 465, y: 150, w: 170, h: 80 },
  },
};
const TEASER_NARROW: Layout = {
  width: 360,
  height: 330,
  nodes: {
    maya: { x: 95, y: 50, w: 160 },
    leo: { x: 265, y: 50, w: 160 },
    server: { x: 180, y: 165, w: 150, h: 64 },
    db: { x: 180, y: 278, w: 200, h: 74 },
  },
};

function Teaser() {
  return (
    <figure className="hero-figure" style={{ margin: 0 }}>
      <Diagram
        nodes={[
          { id: 'maya', kind: 'client', label: 'Maya’s phone', value: 'F12 · 1 left', state: 'active' },
          { id: 'leo', kind: 'client', label: 'Leo’s phone', value: 'F12 · 1 left', state: 'active' },
          { id: 'server', kind: 'server', label: 'Booking system', state: 'placeholder' },
          { id: 'db', kind: 'db', label: 'Seat F12', value: 'available' },
        ]}
        edges={[
          { id: 'a', from: 'maya', to: 'server' },
          { id: 'b', from: 'leo', to: 'server' },
          { id: 'c', from: 'server', to: 'db' },
        ]}
        tokens={[
          { id: 't1', from: 'maya', to: 'server', label: 'Reserve', tone: 'request', at: 0.55 },
          { id: 't2', from: 'leo', to: 'server', label: 'Reserve', tone: 'request', at: 0.45 },
        ]}
        wide={TEASER_WIDE}
        narrow={TEASER_NARROW}
        breakpoint={420}
        description="Two phones both show seat F12 with one left, and both send Reserve at the same moment toward a booking system that isn't drawn yet."
      />
      <figcaption>Both phones say “1 left”, and both buyers tap Reserve 5 ms apart. The first lesson follows both requests through the system.</figcaption>
    </figure>
  );
}

export function Home() {
  const [last] = useRecord<LastActivity | null>('pref:last-activity', null);
  const statusEntries = useRecords('status:');
  const statuses = Object.fromEntries(statusEntries.map(([k, v]) => [k.slice(7), v as LessonStatus]));
  const reviews = useRecords('review:').map(([, v]) => v as Review);
  const mistakes = useRecords('mistake:').map(([, v]) => v as Mistake);
  useEffect(() => {
    document.title = 'System Design Masterclass: learn system design from scratch';
  }, []);
  const returning = statusEntries.length > 0;
  const rec = returning ? recommend('home', { statuses, last, reviews, mistakes }) : null;
  const due = reviews.filter((r) => typeof r.due === 'number' && r.due <= Date.now()).length;
  const openMistakes = mistakes.filter((m) => !m.resolved).length;
  const solvedCount = Object.values(statuses).filter((s) => s === 'hinted' || s === 'independent').length;

  return (
    <div className="page">
      {returning && rec ? (
        <section className="home-section" style={{ marginTop: 8 }} aria-labelledby="resume-title">
          <div className="resume-panel">
            <p className="kicker accent">{rec.kind === 'continue' ? 'Continue where you stopped' : rec.kind === 'revision' ? 'Due for revision' : 'Recommended next'}</p>
            <h2 id="resume-title">{rec.title}</h2>
            <p className="where">{rec.reason}</p>
            {rec.kind === 'continue' && last?.count ? (
              <div className="meter" role="img" aria-label={`Step ${(last.step ?? 0) + 1} of ${last.count}`}><span style={{ width: `${(((last.step ?? 0) + 1) / last.count) * 100}%` }} /></div>
            ) : null}
            <div className="home-actions">
              <Link className="btn btn-primary btn-lg" to={rec.topic.route}>
                {rec.kind === 'continue' ? `Continue at step ${(last?.step ?? 0) + 1}` : 'Start it'} <Icon name="arrow-right" />
              </Link>
              <Link className="secondary-link" to="/topics">Browse all topics</Link>
            </div>
          </div>
          <ul className="evidence-key" style={{ marginTop: 16 }}>
            <li><Link to="/progress">{solvedCount} solved</Link></li>
            <li>{due ? <Link to="/practice">{due} due for revision</Link> : 'Nothing due for revision'}</li>
            <li>{openMistakes ? <Link to="/progress#mistakes">{openMistakes} in your mistake notebook</Link> : 'Mistake notebook empty'}</li>
          </ul>
        </section>
      ) : (
        <section className="home-hero" aria-labelledby="hero-title">
          <div>
            <p className="kicker accent">A free, visual course in system design</p>
            <h1 id="hero-title">Two people tap Reserve on the last seat. Who gets it?</h1>
            <p className="lede">
              Start with that question and one small booking system. You’ll follow a request from a phone to a server to a database and back,
              predict what happens when two arrive together, and see why both buyers can be told “Confirmed”. Everything after that, from caches to
              interviews, builds on the same reasoning.
            </p>
            <div className="home-actions">
              <Link className="btn btn-primary btn-lg" to="/learn/first-booking">
                Start from scratch <Icon name="arrow-right" />
              </Link>
              <Link className="secondary-link" to="/topics">Browse all topics</Link>
            </div>
            <p className="muted small" style={{ marginTop: 16 }}>
              No sign-up. Your work saves in this browser; sign in only if you want it on another device.
            </p>
          </div>
          <Teaser />
        </section>
      )}

      <section className="home-section" aria-labelledby="zoom-title">
        <h2 id="zoom-title">One feature, two zoom levels</h2>
        <p className="section-lede">
          Design questions come at two heights. The same booking feature shows both, and the first lesson works through each before you choose any
          practice.
        </p>
        <div className="zoom-pair">
          <div>
            <p className="kicker">High-level design (HLD)</p>
            <h3>Which parts does booking need, and which part owns seat availability?</h3>
            <p>Apps, a booking service, a seat store, a payment provider: what each one stores or does, and what travels along each arrow.</p>
          </div>
          <div>
            <p className="kicker">Low-level design (LLD)</p>
            <h3>Which states can a seat be in, and which rule stops two confirmed buyers?</h3>
            <p>Available → held → booked: the objects, their invariants, and the one line of Python that enforces “one seat, one buyer”.</p>
          </div>
        </div>
      </section>

      <section className="home-section" aria-labelledby="need-title">
        <h2 id="need-title">What you need</h2>
        <p className="section-lede" style={{ marginBottom: 0 }}>
          If you can read a loop and a small function, you can start. Servers, databases, SQL, diagrams and interview technique are introduced when
          a lesson needs them. Code examples are short Python 3, and the exercises ask you to predict, pick a line, or explain a choice, not to write
          programs from scratch.
        </p>
      </section>

      <section className="home-section" aria-labelledby="route-title">
        <h2 id="route-title">The route</h2>
        <p className="section-lede">There is no schedule. Each part builds on the ones before it, and what you can demonstrate decides what is next.</p>
        <ol className="route">
          {MODULES.map((m, i) => {
            const topics = topicsInModule(m.id);
            const done = topics.filter((t) => statuses[t.id] === 'hinted' || statuses[t.id] === 'independent').length;
            return (
              <li key={m.id}>
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                <Link className="name" to={m.id === 'start' ? topics[0].route : `/topics#${m.id}`}>{m.title}</Link>
                <span className="count">{returning && done ? `${done} of ${topics.length} solved` : `${topics.length} ${topics.length === 1 ? 'item' : 'items'}`}</span>
                <p>{m.blurb}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
