import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRecord, useRecords } from '../../progress/ProgressProvider';
import { MODULES, topicById, topicsInModule } from '../../content/curriculum';

export function Home() {
  const [last] = useRecord<{ id: string; at: number } | null>('pref:last-activity', null);
  const statuses = useRecords('status:');
  const lastTopic = last ? topicById(last.id) : undefined;
  const [step] = useRecord<number>(`step:${last?.id ?? 'none'}`, 0);
  useEffect(() => {
    document.title = 'System Design Masterclass — learn system design from scratch';
  }, []);
  const started = statuses.length > 0;

  return (
    <div className="page">
      <section className="home-hero">
        <h1>Learn to design systems that work when it matters.</h1>
        <p className="lede">
          Start with one ticket, two buyers and a database. Step through each idea visually, predict what happens, and build up to the designs
          asked in interviews. Free, and open to everyone.
        </p>
        {lastTopic ? (
          <Link className="continue-card" to={lastTopic.route}>
            <small>Continue learning</small>
            <strong>{lastTopic.title}</strong>
            <small>Pick up at step {step + 1}</small>
          </Link>
        ) : null}
        <div className="home-actions">
          {!lastTopic && (
            <Link className="btn btn-primary btn-lg" to="/learn/first-booking">
              Start from scratch →
            </Link>
          )}
          <Link to="/topics">Browse all topics</Link>
          {started && <Link to="/progress">See my progress</Link>}
        </div>
      </section>

      <section className="home-section">
        <h2>What you need</h2>
        <p className="muted" style={{ margin: 0 }}>
          If you can read a loop and a small function, you can start. Everything else — servers, databases, diagrams, HLD and LLD — is introduced
          when you need it. Code examples are short Python.
        </p>
      </section>

      <section className="home-section">
        <h2>The route</h2>
        <ol className="path-list">
          {MODULES.map((m) => {
            const topics = topicsInModule(m.id);
            const first = topics[0];
            return (
              <li key={m.id}>
                <span>
                  {first ? <Link to={m.id === 'start' ? first.route : `/topics#${m.id}`}>{m.title}</Link> : m.title}{' '}
                  <span className="muted" style={{ fontSize: 14 }}>· {topics.length} {topics.length === 1 ? 'item' : 'items'}</span>
                </span>
                <p>{m.blurb}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
