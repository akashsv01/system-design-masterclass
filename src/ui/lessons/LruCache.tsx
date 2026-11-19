/**
 * Lesson: "Which item should the cache forget?"
 * Format: behaviour → implementation. Storyboard: docs/STORYBOARDS.md §3.
 * Behaviour views derive from runLru(); the code view highlights lines of python/sdm/lru_cache.py.
 */
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Caption, Controls, LessonShell, More, NextLesson, Question, Sources, useStep } from '../components/Lesson';
import { EvidenceScope, FillBlank, LinePick, Snippet, useOutcome } from '../components/Exercise';
import { extractDefAt } from '../../py/snippets';
import blankSource from '../../../python/blanks/lru_evict_condition.py?raw';
import blankChecks from '../../../python/blanks/lru_evict_condition_check.py?raw';
import { CodeBlock } from '../components/Code';
import { RecencyRow } from '../components/RecencyRow';
import { runLru, linesFor, type LruOp, type LruStep } from '../../sim/lru';
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { raiseStatus } from '../../progress/activity';
import { topicById } from '../../content/curriculum';
import lruSource from '../../../python/sdm/lru_cache.py?raw';
import lruOrdered from '../../../python/sdm/lru_ordered.py?raw';

const ID = 'lru-cache';
const BUGGY_PUT = `def put(self, key, value):
    node = self.index.get(key)
    if node is not None:
        node.value = value
        self._unlink(node)
        self._push_front(node)
        return
    if len(self.index) == self.capacity:
        self._unlink(self.tail)
    node = Node(key, value)
    self.index[key] = node
    self._push_front(node)`;
const BUGGY_LINE = 9;
const STEPS = ['Three items', 'Read one', 'Predict the eviction', 'Try it yourself', 'The Python behind it', 'Practice'];
const SETUP: LruOp[] = [
  { type: 'put', key: 'A', value: 'apple' },
  { type: 'put', key: 'B', value: 'banana' },
  { type: 'put', key: 'C', value: 'cherry' },
];
const LESSON_OPS: LruOp[] = [...SETUP, { type: 'get', key: 'A' }, { type: 'put', key: 'D', value: 'date' }];
const lessonTrace = runLru(3, LESSON_OPS);

const IMPL_OPS: LruOp[] = [...SETUP, { type: 'get', key: 'A' }, { type: 'get', key: 'Z' }, { type: 'put', key: 'D', value: 'date' }, { type: 'put', key: 'C', value: 'cocoa' }];
const implTrace = runLru(3, IMPL_OPS);

function opText(op: LruOp) {
  return op.type === 'get' ? `get("${op.key}")` : `put("${op.key}", "${op.value}")`;
}

/** Recency row: fixed slots, items slide between them; evicted item fades out. */

export default function LruCacheLesson() {
  const { store } = useProgress();
  const [didRead, setDidRead] = useRecord<boolean>('sim:lru-cache:read', false);
  const [pred] = useRecord<{ attempts: { picked: string }[] } | null>('quiz:lru-cache:predict', null);
  const answered = !!pred?.attempts?.length;
  const blocked = [!didRead ? 1 : null, !answered ? 2 : null].filter((x): x is number => x !== null);
  const { step, next, back, go, reachable } = useStep(ID, STEPS.length, { reachable: blocked.length ? Math.min(...blocked) : undefined });
  const record = useOutcome(ID);
  const topic = topicById(ID);

  useEffect(() => {
    if (step === STEPS.length - 1) raiseStatus(store, ID, 'studied');
  }, [step, store]);

  let view: { st: LruStep; moved?: string; evicted?: string; inserted?: string };
  if (step === 0 || (step === 1 && !didRead)) view = { st: lessonTrace[2] };
  else if (step === 1 || (step === 2 && !answered)) view = { st: lessonTrace[3], moved: step === 1 ? 'A' : undefined };
  else view = { st: lessonTrace[4], evicted: 'B', inserted: 'D' };

  return (
    <LessonShell
      id={ID}
      crumbs={<><Link to="/topics#lld">LLD and machine coding</Link><span className="sep">/</span>Caching</>}
      title="Which item should the cache forget?"
      opening="A cache keeps copies of things you looked up recently so the next lookup is instant. It has room for only a few. When a new item arrives and it’s full, something has to go. Which one?"
    >
      {step <= 2 && (
        <section className="stage" aria-label="Cache contents">
          <div className="stage-top">
            <span className="stage-label">Cache · capacity 3</span>
            {step > 0 && <span className="clock">{step === 1 ? (didRead ? 'get("A")' : '—') : answered ? 'put("D")' : 'put("D") ?'}</span>}
          </div>
          <RecencyRow order={view.st.order} values={view.st.values} moved={view.moved} evicted={view.evicted} inserted={view.inserted} />
        </section>
      )}
      {step === 3 && <Playground />}
      {step === 4 && <Implementation />}

      <StepText key={step} step={step} didRead={didRead} answered={answered} />

      {step === 2 && (
        <Question
          isPrediction
          required={!answered}
          recordKey="lru-cache:predict"
          prompt="The cache is full: A, C, B (most → least recent). You now put D. Which item is evicted?"
          choices={[{ id: 'A', text: 'A — it was added first.' }, { id: 'C', text: 'C — it’s in the middle.' }, { id: 'B', text: 'B — it was used least recently.' }]}
          correct="B"
          explain={(p) =>
            p === 'B' ? <p>Right. B hasn’t been touched since it was added. A was added first, but the read moved it to the front.</p> :
            p === 'A' ? <p>That’s “first in, first out”. LRU tracks <em>use</em>, not arrival. The read of A made it the most recently used, so B goes.</p> :
            <p>Position in the middle doesn’t matter. Only the item at the least-recent end leaves: B.</p>
          }
        />
      )}

      {step === 5 && (
        <EvidenceScope required={['trace', 'bug', 'evict-condition']}>
          <Question
            onAnswered={(p) => record('trace', p === 'a', false, 'Trace an LRU sequence: a miss changes nothing; a put on a full cache evicts the least recent key.')}
            recordKey="lru-cache:trace"
            prompt={'Capacity 2. Run: put("X"), put("Y"), get("X"), put("Z"), get("Y"). What does the last get return, and what is the order?'}
            choices={[
              { id: 'a', text: 'None; order Z, X' },
              { id: 'b', text: '"y"; order Y, Z' },
              { id: 'c', text: 'None; order X, Z' },
            ]}
            correct="a"
            explain={() => <p>After get("X") the order is X, Y. put("Z") evicts Y → Z, X. get("Y") misses and returns None, so nothing moves: <strong>Z, X</strong>.</p>}
          />
          <LinePick
            lessonId={ID}
            spec={{
              id: 'bug',
              prompt: 'A teammate’s `put` works for a while, then the cache stops accepting new keys correctly: it evicts on every insert, even after deletions. Which line is missing something?',
              code: BUGGY_PUT,
              answer: [BUGGY_LINE],
              explain: 'The node is unlinked from the list, but its key stays in `self.index`. The dict keeps growing, so `len(self.index) == self.capacity` stays true forever. The fix adds `del self.index[lru.key]`.',
              hint: 'Each entry lives in two structures. When one is evicted, both must forget it.',
              wrong: { 1: 'Looking up the key is fine.', [BUGGY_LINE - 1]: 'The size check is right — the problem is what the dict contains after an eviction.' },
            }}
          />
          <FillBlank
            lessonId={ID}
            spec={{
              id: 'evict-condition',
              prompt: 'Here is the short version using `OrderedDict` (a dict that remembers order). Fill in the condition that decides when to evict.',
              code: blankSource,
              checks: blankChecks,
              answer: 'len(cache.items) == cache.capacity',
              hint: 'Evict only when adding a *new* key to a cache that is already full.',
              explain: 'The `elif` only runs for new keys, so the cache evicts exactly when it’s full and a new key arrives.',
            }}
          />
        </EvidenceScope>
      )}

      <Controls step={step} count={STEPS.length} onBack={back} onNext={next} nextLabel={STEPS[step + 1]}
        nextDisabled={step >= reachable}
        nextHint={step === 2 && !answered ? 'Predict the evicted item to continue' : undefined}
        action={step === 1 && !didRead ? { label: 'Read A: get("A")', onClick: () => setDidRead(true) } : undefined}
        steps={STEPS} reachable={reachable} onJump={go} />

      <More summary="The short version with the standard library">
        <p>
          Python’s <code>collections.OrderedDict</code> remembers the order keys were inserted and can move a key to the end in constant time. That’s
          exactly the recency list, already built. In real code, prefer this; in an interview, be ready to build the linked list yourself.
        </p>
        <CodeBlock code={lruOrdered} lang="python" caption="python/sdm/lru_ordered.py — tested against the linked-list version" />
        <p className="muted" style={{ fontSize: 14 }}>
          For caching function results, <code>functools.lru_cache</code> wraps a function with exactly this policy.
        </p>
      </More>
      <More summary="Go deeper: when LRU is the wrong choice">
        <p>
          LRU assumes the recent past predicts the near future. A one-off scan that touches every item once (a nightly report, say) pushes out
          everything useful. Policies like LFU (least <em>frequently</em> used) or scan-resistant variants handle that better, at the cost of more
          bookkeeping.
        </p>
      </More>
      {step === STEPS.length - 1 && (
        <NextLesson to="/learn/caching" title="Should we cache the seat map?" reason="You can now predict what a cache forgets. Next: where to put a cache in a real system, and what happens when the data it copied changes." />
      )}
      {topic && <Sources sources={topic.sources} />}
    </LessonShell>
  );
}

function StepText({ step, didRead, answered }: { step: number; didRead: boolean; answered: boolean }) {
  switch (step) {
    case 0:
      return (
        <Caption kicker="Setup" title="Three items, ordered by use">
          <p>
            We stored A, then B, then C. The row is ordered by <strong>recency</strong>: the most recently used item on the left, the least recently
            used on the right. A is on the right because nobody has touched it since it arrived.
          </p>
        </Caption>
      );
    case 1:
      return didRead ? (
        <Caption kicker="Watch" title="Reading A moves it to the front" changes={[{ kind: 'chg', text: 'A: least recent → most recent' }, { kind: 'chg', text: 'B is now least recent' }]}>
          <p>Using an item counts. A slid to the front, and everything that was ahead of it moved one place right. B is now last in line.</p>
        </Caption>
      ) : (
        <Caption kicker="Try it" title="Read A">
          <p>Read A, as if a user just asked for it. Watch where it goes.</p>
        </Caption>
      );
    case 2:
      return (
        <Caption kicker="Predict" title="A new item arrives" changes={answered ? [{ kind: 'del', text: 'B evicted' }, { kind: 'add', text: 'D at the front' }] : undefined}>
          <p>
            The cache holds three items and is full. This policy is called <strong>least recently used (LRU)</strong>: when space runs out, it
            forgets whatever has gone longest without being used.
          </p>
        </Caption>
      );
    case 3:
      return (
        <Caption kicker="Experiment" title="Test your own guesses">
          <p>Read and add items. Before each click, guess what moves and what leaves. If you’re surprised, the log explains why.</p>
        </Caption>
      );
    case 4:
      return (
        <Caption kicker="Implementation" title="Two structures, each doing one job">
          <p>
            To be fast at any size, every operation should take the same small amount of work. Two structures share the job. A <strong>dict</strong>{' '}
            maps each key to its node, so finding an item is one step. A <strong>doubly linked list</strong> keeps the recency order: each node points
            to the one before and after it, so moving or removing a node changes only its neighbours.
          </p>
          <p>Step through the operations. The highlighted Python lines are the ones that just ran.</p>
        </Caption>
      );
    case 5:
      return (
        <Caption kicker="Practice" title="Check that you can predict it — and extend it">
          <p>Three short checks: predict a trace, find a bug, fill in one condition.</p>
        </Caption>
      );
    default:
      return null;
  }
}

function Playground() {
  const [ops, setOps] = useRecord<LruOp[]>('sim:lru-cache:play', SETUP);
  const trace = useMemo(() => runLru(3, ops), [ops]);
  const last = trace[trace.length - 1];
  const prev = trace[trace.length - 2];
  const keys = ['A', 'B', 'C', 'D', 'E'];
  const fruit: Record<string, string> = { A: 'apple', B: 'banana', C: 'cherry', D: 'date', E: 'elder' };
  return (
    <section className="stage" aria-label="Cache playground">
      <div className="stage-top"><span className="muted" style={{ fontSize: 14 }}>Cache · capacity 3</span><span className="clock">{opText(last.op)}</span></div>
      <RecencyRow order={last.order} values={last.values} evicted={last.evicted} moved={last.op.type === 'get' && last.hit ? last.op.key : undefined} inserted={last.op.type === 'put' ? last.op.key : undefined} />
      <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
        <div className="toolbar" style={{ margin: 0 }}>
          <span style={{ fontSize: 14, minWidth: 40 }}>Read</span>
          {keys.map((k) => <button key={k} className="btn btn-small" onClick={() => setOps([...ops, { type: 'get', key: k }])}>{k}</button>)}
        </div>
        <div className="toolbar" style={{ margin: 0 }}>
          <span style={{ fontSize: 14, minWidth: 40 }}>Put</span>
          {keys.map((k) => <button key={k} className="btn btn-small" onClick={() => setOps([...ops, { type: 'put', key: k, value: fruit[k] }])}>{k}</button>)}
          <button className="btn btn-small btn-quiet" onClick={() => setOps(SETUP)}>Reset</button>
        </div>
      </div>
      <p className="notice" style={{ marginTop: 12, marginBottom: 0 }} aria-live="polite">
        {last.summary}{prev && last.op.type === 'get' && !last.hit ? ' A miss means the app would now fetch it from the slower source and usually put it in the cache.' : ''}
      </p>
    </section>
  );
}

function Implementation() {
  const [i, setI] = useRecord<number>('sim:lru-cache:impl', 3);
  const st = implTrace[i];
  const method = extractDefAt(lruSource, st.op.type);
  const highlight = st.lines.flatMap((id) => linesFor(lruSource, id)).map((n) => n - method.start + 1);
  return (
    <section className="stage" aria-label="Implementation walkthrough">
      <div className="stage-top">
        <span className="clock">{opText(st.op)}</span>
        <div className="toolbar" style={{ margin: 0 }}>
          <button className="btn btn-small" onClick={() => setI(Math.max(3, i - 1))} disabled={i <= 3}>◂ Previous op</button>
          <button className="btn btn-small btn-primary" onClick={() => setI(Math.min(implTrace.length - 1, i + 1))} disabled={i >= implTrace.length - 1}>Next op ▸</button>
        </div>
      </div>
      <div className="impl-grid">
        <div>
          <p style={{ fontSize: 14, margin: '0 0 6px', fontWeight: 600 }}>Linked list (recency order)</p>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, fontFamily: 'var(--mono)', fontSize: 15 }} aria-label={`head ${st.order.join(' ⇄ ')} tail`}>
            <span className="muted">head →</span>
            {st.order.map((k, j) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ padding: '6px 10px', border: `2px solid ${st.op.key === k ? 'var(--active)' : 'var(--line-strong)'}`, background: st.op.key === k ? 'var(--active-soft)' : 'var(--surface)', borderRadius: 8 }}>{k}</span>
                {j < st.order.length - 1 && <span aria-hidden="true">⇄</span>}
              </span>
            ))}
            <span className="muted">← tail</span>
          </div>
          <p style={{ fontSize: 14, margin: '14px 0 6px', fontWeight: 600 }}>dict (key → node)</p>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 15 }}>
            {'{ '}{Object.keys(st.values).sort().map((k) => `"${k}": node(${st.values[k]})`).join(', ')}{' }'}
          </div>
          <p className="notice" style={{ marginTop: 12, fontSize: 15 }}>
            {st.summary}{st.evicted ? ` The tail node (${st.evicted}) is unlinked and its dict entry deleted.` : ''}
          </p>
        </div>
        <div>
          <Snippet code={method.code} highlight={highlight} caption={`The ${st.op.type} method — highlighted lines ran for ${opText(st.op)}`} />
          <p className="muted" style={{ fontSize: 13 }}>
            New Python here: <code>self</code> is the cache object the method was called on; <code>self.index.get(key)</code> returns{' '}
            <code>None</code> when the key is missing.
          </p>
        </div>
      </div>
      <details className="more">
        <summary>Read the whole class (including the two helper methods)</summary>
        <div className="more-body"><CodeBlock code={lruSource} lang="python" caption="python/sdm/lru_cache.py — tested with pytest" /></div>
      </details>
    </section>
  );
}
