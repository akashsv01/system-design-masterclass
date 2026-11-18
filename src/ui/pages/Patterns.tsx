/**
 * Searchable reference of all 23 Gang of Four patterns (topic: gof-reference).
 * One column of entries; each expands to show its problem, idea, Python sketch, cost and example.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GOF, type PatternEntry } from '../../content/gof';
import { topicById } from '../../content/curriculum';
import { Question, Sources } from '../components/Lesson';
import { ShortAnswer } from '../components/Exercise';
import { CodeBlock } from '../components/Code';
import { useMarkStarted } from '../../progress/activity';
import { useRecord } from '../../progress/ProgressProvider';

const CATS = ['All', 'Creational', 'Structural', 'Behavioral'] as const;

export default function Patterns() {
  const { id } = useParams();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<(typeof CATS)[number]>('All');
  const [, setBookmark] = useRecord<boolean>('bookmark:gof-reference', false);
  const topic = topicById('gof-reference')!;
  useMarkStarted('gof-reference');
  useEffect(() => {
    document.title = 'Design patterns · System Design Masterclass';
  }, []);
  useEffect(() => {
    if (id && id !== 'gof-reference') document.getElementById(`p-${id}`)?.scrollIntoView();
  }, [id]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return GOF.filter((p) => (cat === 'All' || p.category === cat) && (!s || [p.name, p.problem, p.idea, p.example].join(' ').toLowerCase().includes(s)));
  }, [q, cat]);

  return (
    <div className="page reading">
      <p className="crumbs"><Link to="/topics#lld">LLD and machine coding</Link> / Pattern reference</p>
      <h1 style={{ marginTop: 0 }}>Which pattern solves this problem?</h1>
      <p style={{ fontSize: 18, color: 'var(--ink-2)' }}>
        All 23 patterns from the Gang of Four book, each described by the problem it solves, with a short Python sketch and a booking-system
        example. Search by problem (“undo”, “retry”, “swap rules”) rather than by name. Seven of them have full refactoring lessons.
      </p>
      <div className="toolbar">
        <label style={{ flex: '1 1 240px' }}>
          <span className="visually-hidden">Search patterns</span>
          <input type="search" placeholder="Search: undo, retries, family of objects…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="tabs" role="tablist" aria-label="Category" style={{ border: 0 }}>
          {CATS.map((c) => (
            <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 14 }}>{shown.length} of 23 patterns</p>
      <ul className="card-list">
        {shown.map((p) => <PatternItem key={p.id} p={p} open={id === p.id} />)}
      </ul>
      {!shown.length && <p>No pattern matches “{q}”. Try describing the problem instead.</p>}

      <h2>Check yourself</h2>
      <Question
        recordKey="gof-reference:undo"
        prompt="Venue staff need Undo for seat-map edits. Which pattern fits most directly?"
        choices={[{ id: 'command', text: 'Command' }, { id: 'observer', text: 'Observer' }, { id: 'singleton', text: 'Singleton' }]}
        correct="command"
        explain={(p) => <p>{p === 'command' ? 'Right: each edit becomes a do/undo pair kept on a stack.' : 'Undo needs actions stored as values with their reversal, which is Command.'}</p>}
      />
      <Question
        recordKey="gof-reference:bank"
        prompt="A partner bank’s library has a different method signature from your payment interface. Which pattern?"
        choices={[{ id: 'facade', text: 'Facade' }, { id: 'adapter', text: 'Adapter' }, { id: 'proxy', text: 'Proxy' }]}
        correct="adapter"
        explain={(p) => <p>{p === 'adapter' ? 'Right: it translates one interface into another.' : 'A Facade simplifies many parts and a Proxy controls access to the same interface. Translating a mismatched interface is Adapter.'}</p>}
      />
      <Question
        recordKey="gof-reference:tree"
        prompt="Capacity must be computed for a whole venue, a level, a section or a single row with the same call. Which pattern?"
        choices={[{ id: 'composite', text: 'Composite' }, { id: 'decorator', text: 'Decorator' }, { id: 'strategy', text: 'Strategy' }]}
        correct="composite"
        explain={(p) => <p>{p === 'composite' ? 'Right: groups and leaves share `capacity()`, and groups sum their children.' : 'Treating a tree of parts uniformly is Composite.'}</p>}
      />
      <ShortAnswer lessonId="gof-reference" spec={{ id: 'singleton', prompt: 'Why do Python developers usually avoid the Singleton pattern?', checklist: ['Hidden global state makes tests and concurrency harder.', 'Passing the dependency in (or a module-level object) is simpler.'], model: 'A singleton is hidden global state, which makes code hard to test and reason about; passing the object in where it’s needed is clearer, and a module-level instance already gives “one of them” when that’s truly required.' }} />
      <div className="toolbar" style={{ marginTop: 16 }}>
        <button className="btn btn-small btn-quiet" onClick={() => setBookmark(true)}>Bookmark this reference</button>
      </div>
      <Sources sources={topic.sources} />
    </div>
  );
}

function PatternItem({ p, open }: { p: PatternEntry; open: boolean }) {
  return (
    <li id={`p-${p.id}`}>
      <details open={open}>
        <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <strong>{p.name}</strong>
            <span className="pill">{p.category}</span>
          </span>
          <span className="muted" style={{ display: 'block', fontSize: 15 }}>{p.problem}</span>
        </summary>
        <div style={{ paddingTop: 10 }}>
          <p style={{ margin: '0 0 8px' }}><strong>Idea:</strong> {p.idea}</p>
          <CodeBlock code={p.python} lang="python" caption="Illustrative sketch" />
          <p style={{ margin: '0 0 6px' }}><strong>Booking example:</strong> {p.example}</p>
          <p style={{ margin: '0 0 6px' }}><strong>Cost:</strong> {p.cost}</p>
          <p style={{ margin: '0 0 6px' }}><strong>Skip it when:</strong> {p.whenNot}</p>
          {p.lesson && topicById(p.lesson) && <p style={{ margin: 0 }}><Link to={topicById(p.lesson)!.route}>Refactoring lesson: {topicById(p.lesson)!.short ?? topicById(p.lesson)!.title} →</Link></p>}
        </div>
      </details>
    </li>
  );
}
