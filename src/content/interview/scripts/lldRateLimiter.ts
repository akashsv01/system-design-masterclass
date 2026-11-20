import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';
import { py } from '../../lessons/_kit';

const st = (states: [string, string, number, number][], trans: [string, string, string][]) => ({
  comps: states.map(([id, label, x, y]) => ({ id, type: id, kind: 'state' as const, label, x, y })),
  links: trans.map(([from, to, label]) => ({ id: `${from}-${to}-${label}`, from, to, label })),
});

export const lldRateLimiter: InterviewScript = {
  caseId: 'lld-rate-limiter',
  track: 'lld',
  doLine: 'Walk the 11th request through a token bucket, race two threads for the last token, then stop millions of idle keys from filling memory',
  skills: ['object-design', 'concurrency', 'state-machines'],
  brief: {
    interviewer: { name: 'Priya', role: 'engineer who owns the API gateway library' },
    intro: 'The gateway needs a small rate limiter class that other code calls before doing any work. I want the objects inside it: who holds the tokens, who does the arithmetic, and what keeps it correct when threads collide.',
    users: 'Other code: request handlers inside one gateway process, called by many threads at once, one call per incoming request.',
    needs: ['Allow at most 10 requests in a burst per key, refilling 2 tokens a second', 'Keep every key (user or API key) independent of the others', 'Answer allow or deny immediately; never block the caller'],
    mustHold: ['A bucket never goes below zero tokens', 'Two threads can never spend the same token', 'One noisy key cannot use up another key’s tokens'],
    constraints: ['Burst capacity 10 per key; refill 2 tokens per second', 'Many handler threads call the same limiter at once', 'Time is passed in as `now`, so tests can control the clock', 'There may be millions of distinct keys over a day'],
    outOfScope: ['Sharing limits across many servers (that is the distributed rate limiter case)', 'What the handler sends back on a denial'],
    terms: [
      { term: 'token bucket', meaning: 'a counter that refills at a steady rate up to a maximum; each request spends one token' },
      { term: 'burst', meaning: 'how many requests may arrive at once before the limiter says no' },
      { term: 'atomic', meaning: 'done as one step that no other thread can see half-finished' },
    ],
    firstMove: 'Eleven requests for the same key arrive within 100 milliseconds. Tell me which object decides each one and what the eleventh gets back.',
  },
  palette: [
    { type: 'limiter', kind: 'class', name: 'KeyedLimiter', blurb: 'Maps each key to its bucket and exposes allow(key, now).' },
    { type: 'bucket', kind: 'class', name: 'TokenBucket', blurb: 'One key’s tokens, capacity, refill rate and last update time.' },
    { type: 'lock', kind: 'class', name: 'Lock', blurb: 'Lets one thread at a time run the check-and-spend.' },
    { type: 'handler', kind: 'class', name: 'RequestHandler', blurb: 'Gateway code that calls allow() and decides what to answer.' },
    { type: 'clock', kind: 'iface', name: 'Clock', blurb: 'Supplies the current time; tests use a fake that they advance.' },
  ],
  verbs: ['uses', 'has many', 'creates'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Pin down what “rate limit” means before drawing any classes.',
      question: 'Which rules would you confirm before writing a class?',
      activity: { kind: 'clarify', questions: [
        { id: 'shape', q: 'Is the limit “10 per second” exactly, or an average with bursts?', a: 'An average of 2 a second, with bursts up to 10. A key that was quiet may send 10 at once.' },
        { id: 'keys', q: 'What is a key?', a: 'A string such as a user id or API key. Each key has its own budget.' },
        { id: 'deny', q: 'What should allow() do when the key is out of tokens?', a: 'Return False straight away. It never sleeps or queues.' },
        { id: 'threads', q: 'Is the limiter shared between threads?', a: 'Yes. Many handler threads call allow() on the same object.' },
        { id: 'time', q: 'Where does the current time come from?', a: 'The caller passes `now` in seconds, so tests do not sleep.' },
      ], assumptions: [
        { id: 'memory', q: 'How long should a key’s bucket stay in memory?', options: [
          { id: 'forever', label: 'Forever: simplest, buckets are never removed', consequence: 'Memory grows with every key ever seen; fine for thousands of keys, a risk for millions.' },
          { id: 'sweep', label: 'Remove buckets that have sat unused', consequence: 'Memory follows active keys, but you must decide when removing a bucket is safe.' },
        ] },
      ] },
      help: {
        hint: 'What does the eleventh request in the burst need to find out?',
        walkthrough: [{ text: 'A bucket holds up to 10 tokens and refills 2 a second.' }, { text: 'Each key has its own bucket.' }, { text: 'Denial is an immediate False.' }, { text: 'Many threads share the limiter, so check-and-spend must be one step.' }],
        solution: [{ type: 'list', items: ['Per key: capacity 10, refill 2/s.', 'allow(key, now) returns True or False at once.', '`now` is passed in.', 'Shared across threads: one atomic check-and-spend.'] }],
        why: 'These are the rules the classes must keep; the rest is naming.',
      },
      lessons: ['rate-limiting', 'contracts-invariants'],
    },
    {
      id: 'roles', title: 'Who does what', intro: 'Give each job to one object, then walk the eleventh request through them.',
      question: 'Which object owns each job, and which one says no to the eleventh request?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'limiter', name: 'KeyedLimiter', blurb: 'allow(key, now); one bucket per key.' },
          { id: 'bucket', name: 'TokenBucket', blurb: 'tokens, capacity, rate, updated.' },
          { id: 'handler', name: 'RequestHandler', blurb: 'Gateway code serving one request.' },
        ],
        cards: [
          { id: 'find', text: 'Find the bucket for a key, creating it on first use', owner: 'limiter', why: 'Only the limiter sees every key.' },
          { id: 'refill', text: 'Add the tokens earned since the last call', owner: 'bucket', why: 'Refill maths needs the bucket’s own tokens, rate and last update.' },
          { id: 'spend', text: 'Decide yes or no and spend one token', owner: 'bucket', why: 'The bucket owns its token count, so it should be the only code that changes it.' },
          { id: 'atomic', text: 'Make find, refill and spend one uninterrupted step', owner: 'limiter', alt: ['bucket'], why: 'One lock in the limiter also protects the map of buckets. A lock per bucket is valid, but creating buckets then needs its own protection.' },
          { id: 'time', text: 'Read the current time and pass it in', owner: 'handler', why: 'The caller supplies `now`, so the limiter stays deterministic under test.' },
          { id: 'reply', text: 'Turn a denial into a 429 reply', owner: 'handler', why: 'What to tell the client is the gateway’s job; the limiter only answers True or False.' },
        ],
        walk: { title: 'The eleventh request for key “ana”', steps: [
          { prompt: 'Who knows the current time?', owner: 'handler', call: 'now = clock()' },
          { prompt: 'Who finds Ana’s bucket and takes the lock?', owner: 'limiter', call: 'limiter.allow("ana", now)' },
          { prompt: 'Who notices only 0.2 tokens are left?', owner: 'bucket', call: 'bucket.allow(now)  # tokens 0.2 < 1' },
          { prompt: 'Who turns False into an answer for the client?', owner: 'handler', call: 'return 429' },
        ] },
      },
      help: {
        hint: 'Put each job next to the data it reads and changes.',
        walkthrough: [
          { text: 'The limiter sees all keys, so it finds buckets and owns the lock.', focus: ['limiter', 'lock'] },
          { text: 'The bucket holds tokens and the refill rate, so it refills and spends.', focus: ['bucket'] },
          { text: 'The handler supplies time and decides the reply.', focus: ['handler', 'clock'] },
        ],
        solution: [
          { type: 'code', lang: 'python', code: py('sdm/rate_limit.py', 'TokenBucket'), caption: 'python/sdm/rate_limit.py — tested with pytest' },
          { type: 'p', text: 'The bucket refills for the time since `updated`, then spends a token only if at least one is there.' },
        ],
        why: 'Each invariant (never below zero, one token one spender) sits with the object that owns the number.',
      },
      lessons: ['responsibilities', 'cohesion-coupling', 'dependency-injection'],
    },
    {
      id: 'race', title: 'Last token', intro: 'Two threads ask for the last token of one key at the same moment. Pick a guard and run it.',
      question: 'Thread A and Thread B both see one token left. Can both of them be told yes?',
      activity: {
        kind: 'timeline', names: ['Thread A', 'Thread B'], resource: 'Bucket for “ana” (tokens left)', initial: 1,
        read: 'reads the tokens', write: 'takes a token',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'No guard: read, decide, then write', detail: 'Each thread trusts the count it read, even if the other thread has changed it since.', code: 'if self.tokens >= 1:\n    self.tokens -= 1   # another thread may have run in between\n    return True' },
          { id: 'conditional', label: 'Atomic take: only if a token is still there', detail: 'The check and the decrement happen as one step, for example with an atomic compare-and-set.', code: 'with atomic:\n    if self.tokens >= 1:\n        self.tokens -= 1' },
          { id: 'lock', label: 'A lock around check and spend', detail: 'The second thread waits until the first has finished.', code: 'with self._lock:\n    if self.tokens >= 1:\n        self.tokens -= 1' },
        ],
        predict: { q: 'With no guard, how many threads are told “allowed” for one token?', choices: [{ id: 'one', label: 'One' }, { id: 'both', label: 'Both' }, { id: 'none', label: 'Neither' }] },
      },
      help: {
        hint: 'Between “I read 1” and “I wrote 0”, what can the other thread do?',
        walkthrough: [
          { text: 'A reads 1. B reads 1. Nothing has changed yet.' },
          { text: 'A writes 0 and is allowed; B writes 0 too, because it still believes 1 was there.', focus: ['bucket'] },
          { text: 'Make the check and the spend one step, so B sees the real count.', focus: ['lock'] },
        ],
        solution: [
          { type: 'code', lang: 'python', code: py('sdm/cases/keyed_limiter.py', 'KeyedLimiter'), caption: 'python/sdm/cases/keyed_limiter.py — tested with pytest' },
          { type: 'p', text: 'One lock covers the bucket map and the spend. Two spends of one token become one spend and one denial.' },
        ],
        why: 'The invariant “never spend a token you do not have” only holds if the check and the spend cannot be separated.',
      },
      lessons: ['concurrency-lld', 'rate-limiting'],
    },
    {
      id: 'memory', title: 'Millions of keys', intro: 'The interviewer changes one condition. Predict, run it, revise.',
      question: 'A crawler uses a new key for every request and never returns. Draw a bucket’s life so idle buckets leave memory and a returning key starts fresh.',
      change: { announce: 'New condition: the gateway now sees about 5 million distinct keys a day, and most appear once. Your limiter keeps a bucket for each of them.', rule: RULES.states },
      activity: {
        kind: 'states', entity: 'Bucket for one key', initial: 'gone',
        states: [
          { key: 'gone', label: 'No bucket', blurb: 'Nothing is stored for this key.' },
          { key: 'active', label: 'Active', blurb: 'In memory with fewer than 10 tokens: it still remembers recent spending.' },
          { key: 'full', label: 'Full again', blurb: 'Refilled to 10 tokens: identical to a brand-new bucket.' },
        ],
        events: [{ id: 'request', label: 'request' }, { id: 'refill', label: 'refilled (1 min)' }, { id: 'sweep', label: 'sweep' }],
        timer: { event: 'refill', after: 1 },
        scenario: [
          { at: 0, event: 'request', label: '12:00 first request for “ana”', expect: 'active' },
          { at: 3, event: 'sweep', label: '12:03 the sweep removes buckets that are full', expect: 'gone' },
          { at: 4, event: 'request', label: '12:04 Ana returns', expect: 'active' },
        ],
        starter: st([['gone', 'No bucket', 90, 220], ['active', 'Active', 320, 220]], [['gone', 'active', 'request']]),
      },
      help: {
        hint: 'When is it safe to forget a bucket without anyone noticing?',
        walkthrough: [
          { text: '12:00 the first request creates a bucket and spends a token: No bucket → Active.' },
          { text: 'After a minute with no requests the bucket has refilled to 10, so it is the same as a new one: Active → Full again on “refilled”.' },
          { text: '12:03 the sweep deletes buckets that are full: Full again → No bucket. Nobody can tell.' },
          { text: '12:04 Ana returns and gets a fresh bucket: No bucket → Active.' },
        ],
        solution: [
          { type: 'table', head: ['From', 'Event', 'To'], rows: [['No bucket', 'request', 'Active'], ['Active', 'request', 'Active'], ['Active', 'refilled (1 min)', 'Full again'], ['Full again', 'request', 'Active'], ['Full again', 'sweep', 'No bucket']] },
          { type: 'p', text: 'Only full buckets are removed, so deleting one never gives a key extra tokens. Idle but not yet full buckets stay until they refill.' },
        ],
        why: 'Memory then follows the keys active in the last minute, not every key ever seen, and no key can cheat by waiting to be forgotten.',
      },
      lessons: ['state-machines', 'rate-limiting', 'concurrency-lld'],
    },
  ],
  rules: [
    { id: 'roles-coach', stage: 'roles', when: { all: [] }, coach: 'Start with the number each job reads: tokens belong to the bucket, the map of keys belongs to the limiter, the clock belongs to the caller.' },
    { id: 'roles-good', stage: 'roles', when: { result: 'roles', is: 'pass' }, ack: 'Refill and spend sit with the bucket; finding buckets and locking sit with the limiter.', strength: 'You put token arithmetic in TokenBucket and the map of keys in KeyedLimiter, so each invariant has one owner.' },
    { id: 'roles-gap', stage: 'roles', when: { result: 'roles', is: 'gaps' }, priority: 4, gap: { text: 'Some jobs were given to objects that do not own the data they need.', fix: 'Reassign the cards marked “reconsider” and walk the eleventh request again.', stage: 'roles', lesson: 'responsibilities' } },
    { id: 'lock-grain', stage: 'roles', when: { result: 'roles', is: 'pass' }, priority: 3, ask: { text: 'You have one lock in the limiter. Another valid design gives every bucket its own lock. What is the trade-off?', choices: [
      { id: 'single', label: 'One lock is simpler, but all keys wait for each other', reply: 'Right. The critical section is a few arithmetic steps, so one lock is fine at gateway rates, and you can shard into several limiters if it becomes hot.', verdict: 'sound' },
      { id: 'per', label: 'A lock per bucket lets different keys run in parallel, but creating buckets still needs protection', reply: 'Also right. You still need a lock around the map for first use, so it is more code for a benefit you may not need yet.', verdict: 'sound' },
      { id: 'none', label: 'Neither matters, Python threads never collide', reply: 'They do: a thread can be paused between the check and the decrement. The race stage shows it.', verdict: 'risky' },
    ] } },
    { id: 'race-fixed', stage: 'race', when: { result: 'race', is: 'one' }, ack: 'With the check and the spend as one step, only one thread got the token.', strength: 'You made check-and-spend one step, so two threads cannot spend the same token.' },
    { id: 'race-over', stage: 'race', when: { result: 'race', is: 'oversold' }, priority: 6, ask: { text: 'Both threads were allowed, but the bucket only had one token. What should change?', choices: [
      { id: 'atomic', label: 'Make the check and the decrement one atomic step', reply: 'Yes. Pick a lock or an atomic take and run the same order again.', verdict: 'sound' },
      { id: 'recheck', label: 'Check twice, once before and once after', reply: 'A second check still leaves a gap between check and write; the gap has to disappear, not shrink.', verdict: 'risky' },
      { id: 'sleep', label: 'Make B wait a few milliseconds', reply: 'Timing luck is not a guarantee. Under load the same collision returns.', verdict: 'risky' },
    ] }, gap: { text: 'Check and spend were separate steps, so one token was spent twice.', fix: 'Wrap the check and the decrement in one lock, or use an atomic take.', stage: 'race', lesson: 'concurrency-lld' } },
    { id: 'race-keys', stage: 'race', when: { result: 'race', is: 'one' }, priority: 3, ask: { text: 'The timeline shows one key. With one lock in the limiter, what happens to a different key called at the same moment?', choices: [
      { id: 'waits', label: 'It briefly waits for the lock, but gets the correct answer', reply: 'Correct. The wait is only the few steps inside the lock, and the answer is still right.', verdict: 'sound' },
      { id: 'wrong', label: 'It can be told the wrong answer', reply: 'No: the lock only adds a wait. Each key still reads its own bucket.', verdict: 'partial' },
    ] } },
    { id: 'mem-ok', stage: 'memory', when: { result: 'memory', is: 'pass' }, ack: 'Your machine removed a refilled bucket and recreated it when Ana returned.', strength: 'You only removed buckets that had refilled, so forgetting a key cannot give it extra tokens.' },
    { id: 'mem-stuck', stage: 'memory', when: { result: 'memory', is: 'stuck' }, priority: 6, ask: { text: 'Your machine refused an event because no arrow allowed it from the current state. Why is a bucket that has refilled to full safe to delete?', choices: [
      { id: 'same', label: 'A full bucket is exactly what a new bucket would be', reply: 'Yes. Add Active → Full again on “refilled”, then Full again → No bucket on “sweep”.', verdict: 'sound' },
      { id: 'old', label: 'Because it is old', reply: 'Age alone is not safe: a bucket emptied a second ago and then deleted would hand the key a free burst.', verdict: 'risky' },
    ] }, gap: { text: 'There was no safe path from an in-use bucket to being forgotten, so idle keys would stay in memory.', fix: 'Add Active → Full again on “refilled (1 min)” and Full again → No bucket on “sweep”.', stage: 'memory', lesson: 'state-machines' } },
    { id: 'mem-lru', stage: 'memory', when: { result: 'memory', is: 'pass' }, priority: 4, ask: { text: 'Another valid way to bound memory is an LRU: keep at most N buckets and evict the least recently used. What can go wrong?', choices: [
      { id: 'early', label: 'It may evict a bucket that is not full, giving that key a fresh burst', reply: 'Yes. LRU bounds memory strictly, but an attacker can flush buckets by sending many keys. The refill-based sweep never forgives spending.', verdict: 'sound' },
      { id: 'nothing', label: 'Nothing, evicted keys always start empty', reply: 'The opposite: a new bucket starts full, so an evicted key gets its burst back.', verdict: 'risky' },
      { id: 'slow', label: 'It is too slow to be used', reply: 'It is O(1) with the right structure. The risk is correctness under pressure, not speed.', verdict: 'partial' },
    ] } },
    { id: 'mem-race', stage: 'memory', when: { result: 'memory', is: 'pass' }, priority: 2, ask: { text: 'The diagram shows the sweep deleting a bucket. It does not show a request arriving at the same moment. What must be true?', choices: [
      { id: 'lock', label: 'The sweep takes the same lock as allow()', reply: 'Right. Otherwise a request could spend a token from a bucket the sweep is about to delete, and that spend would be lost.', verdict: 'sound' },
      { id: 'ignore', label: 'Nothing, a deleted bucket is recreated anyway', reply: 'Recreating it would lose the spend that just happened. The sweep and allow() must not interleave.', verdict: 'risky' },
    ] } },
    { id: 'lock-strength', when: { answer: 'mem-race', is: 'lock' }, strength: 'You saw that the sweep must share the lock with allow().' },
  ],
  solution: {
    design: {
      comps: [
        { id: 'handler', type: 'handler', kind: 'class', label: 'RequestHandler', x: 90, y: 200 },
        { id: 'clock', type: 'clock', kind: 'iface', label: 'Clock', x: 90, y: 370 },
        { id: 'limiter', type: 'limiter', kind: 'class', label: 'KeyedLimiter', x: 320, y: 200 },
        { id: 'bucket', type: 'bucket', kind: 'class', label: 'TokenBucket', x: 540, y: 120 },
        { id: 'lock', type: 'lock', kind: 'class', label: 'Lock', x: 540, y: 290 },
      ],
      links: [
        { id: 'h-l', from: 'handler', to: 'limiter', label: 'uses' }, { id: 'h-c', from: 'handler', to: 'clock', label: 'uses' },
        { id: 'l-b', from: 'limiter', to: 'bucket', label: 'has many' }, { id: 'l-k', from: 'limiter', to: 'lock', label: 'uses' },
      ],
    },
    why: {
      handler: 'Reads the clock, calls allow(key, now) and turns False into a 429 reply.',
      clock: 'An interface so tests advance time themselves instead of sleeping.',
      limiter: 'Maps each key to its bucket, creates buckets on first use and holds the lock.',
      bucket: 'Owns tokens, capacity, rate and last update; refills and spends.',
      lock: 'Makes find, refill and spend one step across threads, and is shared with the sweep.',
    },
    alternatives: {
      lock: { types: ['class'], tradeoff: 'A lock inside each bucket lets different keys run in parallel; creating a bucket still needs its own protection.' },
    },
    trace: { title: 'The eleventh request in 100 ms', steps: [
      { from: 'handler', to: 'clock', text: 'now = clock(): the time is read once, by the caller.' },
      { from: 'handler', to: 'limiter', text: 'allow("ana", now) is called.' },
      { from: 'limiter', to: 'lock', text: 'The limiter takes the lock: no other thread can touch any bucket now.' },
      { from: 'limiter', to: 'bucket', text: 'bucket.allow(now): refill adds 0.2 tokens, total 0.2, below 1, so False.' },
      { from: 'limiter', to: 'handler', text: 'The lock is released and False returns; the handler replies 429.' },
    ] },
    tradeoff: 'One lock around everything is simple and obviously correct, but all keys share it; per-bucket locks run in parallel at the cost of more code.',
    otherApproach: 'When limits must hold across many servers, an in-process bucket is not enough; keep the counters in a shared store with atomic operations instead (see the distributed rate limiter case).',
  },
};
