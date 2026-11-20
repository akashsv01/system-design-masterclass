import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const urlShortener: InterviewScript = {
  caseId: 'case-url-shortener',
  track: 'hld',
  doLine: 'Place the parts behind a short link, trace “open a short link” through a cache, key the links table, then survive a viral link while the database slows',
  skills: ['architecture', 'data-modeling', 'caching', 'capacity'],
  brief: {
    interviewer: { name: 'Ravi', role: 'engineer on a link-sharing product' },
    intro: 'People paste long links into texts and posts, and we turn them into short ones like sho.rt/aZ3kQ9x. Creating a link is rare. Opening one happens all day, and sometimes a single link goes viral.',
    users: 'People who create short links, and the much larger crowd who open them.',
    needs: ['Create a short link for a long URL, optionally with a custom alias', 'Open a short link and land on the right page quickly, anywhere in the world', 'See all the links I created'],
    mustHold: ['A short code always points to exactly one URL, and two people never get the same code', 'An abusive link can be switched off quickly', 'A viral link never takes the service down for everyone else'],
    constraints: ['100 million new links a month, about 40 a second', 'Reads are about 100 times writes, about 4,000 a second on average', 'A viral link can see 200,000 opens a second', 'Redirects should finish in under 50 ms for most people', 'Codes are 7 characters of letters and digits'],
    outOfScope: ['Click analytics dashboards', 'Link expiry', 'Billing'],
    terms: [
      { term: 'redirect', meaning: 'a reply that tells the browser “the page you want is at this other address”' },
      { term: 'cache', meaning: 'a fast copy of data that is read often; it can be out of date' },
      { term: 'hot key', meaning: 'one value, here one short code, that gets far more traffic than all the others' },
      { term: 'partition key', meaning: 'the field that decides which machine stores a row' },
    ],
    firstMove: 'Start with the common case. Someone taps sho.rt/aZ3kQ9x in a message. Draw what happens between the tap and the page loading, and tell me where you would keep a fast copy of the answer.',
  },
  palette: [
    { type: 'browser', kind: 'client', name: 'Browser', blurb: 'The person who taps a short link, or the creator of a link.' },
    { type: 'edge', kind: 'cdn', name: 'CDN edge', blurb: 'Servers near the user that can answer repeat redirects without reaching our system.' },
    { type: 'redirect', kind: 'service', name: 'Redirect service', blurb: 'Looks up a code and answers with the long URL. Read-heavy.' },
    { type: 'code-cache', kind: 'cache', name: 'Code cache', blurb: 'An in-memory copy of code → URL for popular links. It can be a little out of date.' },
    { type: 'links-db', kind: 'db', name: 'Links store', blurb: 'The source of truth: one row per short code with the long URL, owner and status.' },
    { type: 'create', kind: 'service', name: 'Create service', blurb: 'Makes a new code, stores the link, and rejects a taken alias.' },
    { type: 'clicks', kind: 'queue', name: 'Click log', blurb: 'A queue of “this link was opened” events, counted later and off the redirect path.' },
    { type: 'counter', kind: 'worker', name: 'Click counter', blurb: 'Reads the click log and updates counts in batches.' },
  ],
  verbs: ['sends request', 'reads from', 'writes to', 'reads and writes', 'invalidates', 'publishes event', 'delivers to'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'ratio', q: 'How many creates versus opens?', a: 'About 40 creates a second and 4,000 opens a second on average. Reads are around 100 times writes.' },
          { id: 'viral', q: 'Can one link get most of the traffic?', a: 'Yes. A viral link can reach 200,000 opens a second, while most links are opened rarely.' },
          { id: 'alias', q: 'Are custom aliases allowed?', a: 'Yes, optional. If an alias is taken, the creator gets a clear refusal.' },
          { id: 'expiry', q: 'Do links expire or change?', a: 'They do not expire and the target never changes. The only change is switching a link off for abuse.' },
          { id: 'abuse', q: 'How fast must an abusive link be switched off?', a: 'Within about a minute, everywhere.' },
          { id: 'latency', q: 'How fast should an open feel?', a: 'Under 50 ms for most people, worldwide.' },
        ],
        assumptions: [
          { id: 'status', q: 'Which redirect status do you return?', options: [
            { id: '301', label: '301, permanent', consequence: 'Browsers may cache it indefinitely: fewer requests, but you cannot reliably switch the link off or count opens.' },
            { id: '302', label: '302, temporary', consequence: 'Every open reaches you or your cache, so you can disable links and count opens, at the cost of more requests.' },
          ] },
          { id: 'codes', q: 'How are codes made?', options: [
            { id: 'random', label: 'Random 7-character codes', consequence: 'No coordination and not guessable, but a rare collision must be detected on insert.' },
            { id: 'counter', label: 'A counter turned into letters and digits', consequence: 'No collisions, but codes can be guessed in order and the counter must be shared safely.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers tell you where the time and the traffic go?',
        walkthrough: [
          { text: 'Reads are 100 times writes, so the open path is what you optimise.' },
          { text: 'One viral link can dominate traffic, so a copy of popular answers must sit in front of the store.' },
          { text: 'Links never change except being switched off, which makes copies safe but means they must be purged.' },
          { text: 'A minute to switch off an abusive link limits how long a copy may live.' },
        ],
        solution: [{ type: 'list', items: ['Reads about 100 times writes; about 4,000 opens a second.', 'A viral link can reach 200,000 a second.', 'Links are immutable apart from being disabled.', 'Disabling must take effect within about a minute.', 'Under 50 ms for most people.'] }],
        why: 'Read-heavy traffic, one very hot key and immutable data are what make caching safe and worthwhile. The one exception, disabling, bounds how stale a copy may be.',
      },
      lessons: ['requirements', 'capacity-estimation'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts behind a short link and connect them. Then trace “open a short link” through your own design.',
      question: 'Show me what happens when someone opens a short link. Where would you answer from, and where is the truth kept?',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-browser', 'browser', 'client', 'Browser', 60, 220], ['s-redirect', 'redirect', 'service', 'Redirect service', 300, 220]], [['s-browser', 's-redirect', 'sends request']]),
        traces: [
          { id: 'open', label: 'Open a short link', token: 'GET /aZ3kQ9x', from: 'client', to: { type: ['links-db'] }, read: true },
          { id: 'create', label: 'Create a short link', token: 'POST /v1/links', from: 'client', to: { type: ['links-db'] } },
        ],
      },
      help: {
        hint: 'Which store answers when the link is popular, and which one is the final word if the two disagree?',
        walkthrough: [
          { text: 'The browser asks for the code; the CDN edge may answer repeat requests without reaching us.', focus: ['browser', 'edge'] },
          { text: 'On a miss, Redirect service asks Code cache first, because popular links repeat.', focus: ['edge', 'redirect', 'cache'] },
          { text: 'If the cache does not have it, Redirect service reads Links store, the source of truth, and fills the cache.', focus: ['redirect', 'linksdb'] },
          { text: 'Creates take a separate path: Create service inserts the new code into Links store and rejects one that exists.', focus: ['create', 'linksdb'] },
        ],
        solution: [
          { type: 'p', text: '**Read path and write path are separate.** Opens go through the CDN edge and Code cache, and only a miss reaches Links store. Creates go through Create service, which uses a conditional insert so a code can never be taken twice.' },
          { type: 'code', lang: 'http', code: 'POST /v1/links {url, alias?} → 201 {code: "aZ3kQ9x"} | 409 alias_taken\nGET /aZ3kQ9x → 302 Location: https://… (Cache-Control: max-age=60)' },
        ],
        why: 'Most opens never touch the store: they are answered by an edge or a cache. The store stays the final word, so a copy can always be rebuilt or purged.',
      },
      lessons: ['caching', 'cdn', 'cache-invalidation'],
    },
    {
      id: 'data', title: 'Key the links table', intro: 'The links store is a table. Choose its key, then run two queries and see what each one costs.',
      question: 'What do you key the links table on, and what does “all links created by one user” cost?',
      activity: {
        kind: 'model',
        tables: [
          { id: 'links', name: 'links', fields: ['code', 'long_url', 'user_id', 'created_at', 'disabled'] },
        ],
        table: 'links',
        partitions: 16,
        first: { id: 'q1', text: 'Open a short link: find the long URL for code aZ3kQ9x', filter: 'code' },
        second: { id: 'q2', text: 'Show one user all the links they created, newest first', filter: 'user_id', sort: 'created_at' },
        tradeoffs: [
          { id: 'index', label: 'Add an index on user_id', consequence: 'My links is one lookup. Every create also updates the index, which is small at 40 creates a second.', verdict: 'sound' },
          { id: 'copy', label: 'Keep a second table keyed by user_id, sorted by created_at', consequence: 'My links is one partition, already sorted. Each create writes twice, and the copies can briefly disagree.', verdict: 'sound' },
          { id: 'scatter', label: 'Ask all partitions for that user', consequence: 'Works, but costs 16 reads per page view and you sort after merging. Acceptable only if it is rare.', verdict: 'partial' },
          { id: 'rekey', label: 'Key the table on user_id instead', consequence: 'My links is fast, but every open now scatters, on the path that gets 100 times more traffic.', verdict: 'risky' },
        ],
      },
      help: {
        hint: 'One query happens 4,000 times a second and the other a few times a minute. Which one decides the key?',
        walkthrough: [
          { text: 'Opening a link filters on code, so partition on code: one read, by key.', focus: ['linksdb'] },
          { text: 'A code spreads evenly across partitions, so no machine is overloaded by the table itself.', focus: ['linksdb', 'create'] },
          { text: '“All links by a user” does not use the key, so it needs an index or a second copy.', focus: ['linksdb'] },
          { text: 'Choose by how often it runs: a small index is the simplest answer.', focus: ['linksdb'] },
        ],
        solution: [{ type: 'list', items: ['Partition key `code`.', 'Open: one partition, one row.', 'My links: an index on `user_id` (with `created_at`), or a derived table.', 'Do not re-key on `user_id`: a prolific user would become a hot partition and opens would scatter.'] }],
        why: 'The query that runs 100 times as often decides the key. The occasional query gets an index or a copy and costs a little on every write.',
      },
      lessons: ['access-patterns', 'sharding', 'indexes'],
    },
    {
      id: 'viral', title: 'A link goes viral', intro: 'The interviewer changes one condition. Pick how the system reacts, run it, and compare.',
      question: 'A link gets 12,000 opens a second just as the database slows down. Which policy keeps waits bounded, and what should have answered before the database was asked?',
      change: { announce: 'New condition: a link is shared on a huge account and opens jump to 12,000 a second. For 20 seconds the database answers four times slower than usual.', rule: RULES.queue },
      activity: {
        kind: 'queue', what: 'redirect lookups waiting for the database',
        arrival: [1000, 4000, 12000], workers: [4, 8, 16], serviceMs: 2,
        slow: { from: 20, to: 40, serviceMs: 8, what: 'the links database answers four times slower' },
        timeoutS: 2,
        policies: [
          { id: 'wait', label: 'Keep waiting', detail: 'Lookups queue up and the database works through them at its own pace.' },
          { id: 'retry', label: 'Retry on timeout', detail: 'A lookup that waits too long is sent again, and the old copy stays in the queue.' },
          { id: 'shed', label: 'Shed excess lookups', detail: 'Lookups that cannot start in time get a fast “try again shortly” instead of waiting.' },
          { id: 'breaker', label: 'Circuit breaker with cached answers', detail: 'Stop asking the slow database and answer from the cache or the edge.' },
        ],
      },
      help: {
        hint: 'How many of those 12,000 opens are for the same code? What could answer them without asking the database at all?',
        walkthrough: [
          { text: 'Normally 8 workers at 2 ms each finish about 4,000 lookups a second.', focus: ['redirect', 'linksdb'] },
          { text: 'With the database slow, they finish about 1,000 a second. At 12,000 arrivals the queue explodes.', focus: ['linksdb'] },
          { text: 'But almost all of those opens are for one code. The CDN edge and Code cache can answer it with no database read.', focus: ['edge', 'cache'] },
          { text: 'Whatever still reaches the database can be shed or sent through a breaker, so waits stay short.', focus: ['redirect', 'linksdb'] },
        ],
        solution: [{ type: 'list', items: ['Cache the hot code at the CDN edge (short `max-age`) and in Code cache, so the database sees it once.', 'Let the edge or cache coalesce misses: one lookup per code, not one per request.', 'Shed or open a breaker for requests that still need a slow database, answering fast instead of queueing.', 'Count clicks through the click log, never with a database write per open.'] }],
        why: 'A viral link is one key, so a copy absorbs it. Policies on the database path then protect everyone else’s links while it recovers.',
      },
      lessons: ['backpressure', 'lab-queue-backlog', 'lab-hot-spots'],
    },
  ],
  rules: [
    // Design stage
    { id: 'cache-hit', stage: 'design', when: { result: 'trace:open', is: 'hit' }, ack: 'Your trace stopped at {kind:cache}: Links store was never asked for that open.', strength: 'You answered popular opens from {kind:cache}, so the store sees only misses, and you traced it to prove it.' },
    { id: 'cache-missing', stage: 'design', when: { all: [{ result: 'trace:open', is: 'ok' }, { lacks: 'cache' }, { lacks: 'cdn' }] }, priority: 7, ask: { text: 'Every open went all the way to {type:links-db}. At 4,000 opens a second, and far more for one viral link, what should answer first?', choices: [
      { id: 'cache', label: 'A cache (and a CDN edge) in front of the store, since links never change', reply: 'Yes. Immutable data is the best case for caching. Insert it into the read path and trace again.', verdict: 'sound' },
      { id: 'scale', label: 'Make the database bigger', reply: 'A bigger database still takes every open of the viral link on one partition. Put a copy in front.', verdict: 'partial' },
      { id: 'nothing', label: 'Nothing; a key-value read is cheap', reply: 'One row read at 200,000 a second is a hot partition, whatever the cost per read.', verdict: 'risky' },
    ] }, gap: { text: 'Every open went to the store, with nothing in front for popular links.', fix: 'Add a CDN edge and a code cache in the read path, and keep the store as the source of truth.', stage: 'design', lesson: 'caching' } },
    { id: 'connect-path', stage: 'design', when: { all: [{ has: { type: 'links-db' } }, { not: { path: ['client', { type: 'links-db' }] } }] }, coach: 'Connect the path: Browser → Redirect service → Links store. Select a part, then “Connect to…”.', priority: 3 },
    { id: 'trace-now', stage: 'design', when: { all: [{ path: ['client', { type: 'links-db' }] }, { not: { result: 'trace:open', is: ['ok', 'hit'] } }] }, coach: 'Press “Trace a request” to watch an open travel through your design.', priority: 1 },
    { id: 'no-store', stage: 'design', when: { lacks: { type: 'links-db' } }, coach: 'Links need a home. Add Links store and connect Redirect service to it.', gap: { text: 'No store held the code-to-URL mapping.', fix: 'Add a Links store keyed by code and make Create service its writer.', stage: 'design', lesson: 'first-booking' }, priority: 4 },
    { id: 'client-db', stage: 'design', when: { link: ['client', 'db'] }, priority: 9, ask: { text: 'Your browser talks to {kind:db} directly. Who checks the link is not disabled before the redirect?', choices: [
      { id: 'service', label: 'A redirect service in between, which applies the rules', reply: 'Yes: the browser is not trusted, and one place can enforce disabling.', verdict: 'sound' },
      { id: 'browser', label: 'The browser checks', reply: 'A browser can ignore any check. Keep rules on your side.', verdict: 'risky' },
    ] } },
    { id: 'create-store', stage: 'design', when: { link: [{ type: 'create' }, { type: 'links-db' }], labels: ['writes to', 'reads and writes'] }, priority: 6, ask: { text: 'Create service writes to {type:links-db}. The arrow does not show how two people picking the same alias at once are kept apart. What does?', choices: [
      { id: 'conditional', label: 'A conditional insert: “insert if the code does not exist”; 409 if it does', reply: 'Yes. The check and the write are one step in the store, so exactly one creator wins.', verdict: 'sound' },
      { id: 'check', label: 'Look the code up first, then insert if it is free', reply: 'Two creators can both see it free. That is the same race as two buyers and one seat.', verdict: 'risky' },
      { id: 'lock', label: 'Take a lock on the code, then insert', reply: 'It works, but costs a lock round trip on every create. A conditional insert does the same in one step.', verdict: 'partial' },
    ] }, gap: { text: 'Nothing showed how two creators of the same code are kept apart.', fix: 'Insert with a condition on the code not existing, and return 409 on conflict.', stage: 'design', lesson: 'concurrent-reservations' } },
    { id: 'click-write', stage: 'design', when: { link: [{ type: 'redirect' }, { type: 'links-db' }], labels: ['writes to', 'reads and writes'] }, priority: 8, ask: { text: 'Redirect service writes to {type:links-db}. If that is a click count on every open, what happens at 200,000 opens a second to one link?', choices: [
      { id: 'async', label: 'Publish a click event to a queue and count in batches off the redirect path', reply: 'Yes. Redirects stay read-only and fast; counts can lag a few seconds.', verdict: 'sound' },
      { id: 'every', label: 'Update a counter row on every open', reply: '200,000 writes a second to one row is the worst possible hot spot, on the path that must be fastest.', verdict: 'risky' },
      { id: 'sample', label: 'Count one open in a hundred and scale it up', reply: 'Cheap and fine if rough counts will do, but billing or abuse checks need exact numbers.', verdict: 'partial' },
    ] } },
    { id: 'clicks-queue', stage: 'design', when: { link: [{ type: 'redirect' }, 'queue'] }, ack: 'Opens publish click events to {kind:queue}, so counting never slows a redirect.', strength: 'You moved click counting off the redirect path with {kind:queue}.' },
    { id: 'invalidate', stage: 'design', when: { has: 'cache' }, priority: 5, ask: { text: 'Trust and safety switches off a phishing link. How does {kind:cache} stop serving it?', choices: [
      { id: 'purge', label: 'Disable it in the store, then purge it from the cache and the edge; keep copies short-lived as a safety net', reply: 'Yes: explicit purge for speed, short lifetimes for anything missed. That meets the one-minute target.', verdict: 'sound' },
      { id: 'ttl', label: 'Rely on a 60-second lifetime alone', reply: 'Acceptable for “about a minute” if every copy, at the edge and in the cache, expires within it. Lifetimes add up across layers, so keep each short. A purge makes it faster still.', verdict: 'sound' },
      { id: 'never', label: 'Cached links never change, so nothing', reply: 'They change when disabled. A phishing link served for a day is a serious failure.', verdict: 'risky' },
    ] }, strength: 'You planned how a cached link is switched off, not just how it is served.' },
    { id: 'counter-alt', stage: 'design', when: { answer: 'assume:codes', is: 'counter' }, priority: 4, ask: { text: 'You chose counter-based codes. 50 Create servers each need numbers. How do they get them without handing out the same one twice?', choices: [
      { id: 'ranges', label: 'Each server takes a block of, say, 10,000 numbers from a shared counter', reply: 'Yes. One shared call per 10,000 creates. Remember that codes are guessable in order.', verdict: 'sound' },
      { id: 'local', label: 'Each server counts on its own', reply: 'Two servers will issue the same number. You need a shared source or disjoint ranges.', verdict: 'risky' },
    ] } },
    // Data stage
    { id: 'key-good', stage: 'data', when: { all: [{ result: 'data:q1', is: 'one-partition' }, { result: 'data:q2', is: ['index', 'scatter'] }] }, ack: 'Opening a link reads one partition.', strength: 'You keyed the links on the code, so the busiest query is a single read.' },
    { id: 'key-user', stage: 'data', when: { result: 'data:q1', is: ['scatter', 'index'] }, priority: 6, ask: { text: 'Opening a link had to scatter or use an index, and that is the query that runs 4,000 times a second. What should the key be?', choices: [
      { id: 'code', label: 'The code', reply: 'Yes: random codes spread evenly, and every open is a single-row read.', verdict: 'sound' },
      { id: 'user', label: 'The user id', reply: 'A big user’s links share a partition, and every open must search for its code.', verdict: 'risky' },
    ] }, gap: { text: 'The open query was not a single read on your key.', fix: 'Partition the links table on the code.', stage: 'data', lesson: 'sharding' } },
    { id: 'trade-rekey', stage: 'data', when: { result: 'data:tradeoff', is: 'rekey' }, priority: 5, gap: { text: 'You re-keyed the table for “my links” and made opens scatter.', fix: 'Keep code as the key and give “my links” an index or a derived table.', stage: 'data', lesson: 'access-patterns' } },
    { id: 'trade-ok', stage: 'data', when: { result: 'data:tradeoff', is: ['index', 'copy'] }, ack: 'Your fix for “my links” leaves the open path untouched.', strength: 'You served “my links” without bending the key that serves opens.' },
    { id: 'trade-alt', stage: 'data', when: { result: 'data:tradeoff', is: 'scatter' }, priority: 4, ask: { text: 'You accept asking all partitions for “my links”. When does that stop being acceptable?', choices: [
      { id: 'popular', label: 'When the page is opened often, or partitions grow, so each visit costs more', reply: 'Right. Revisit it when the page becomes common; an index is cheap.', verdict: 'sound' },
      { id: 'never', label: 'Never, the cost is fixed', reply: 'It grows with the number of partitions: 16 reads now, hundreds later.', verdict: 'partial' },
    ] } },
    // Viral stage
    { id: 'wait-unbounded', stage: 'viral', when: { result: 'viral', is: 'wait:unbounded' }, priority: 6, ask: { text: 'Waiting meant the delay grew for every link, not just the viral one. What should have protected the others?', choices: [
      { id: 'cache', label: 'A cached answer for the hot code, so the database is not asked', reply: 'Yes. One key is absorbed by a copy, and the others keep their capacity.', verdict: 'sound' },
      { id: 'workers', label: 'More workers on the database path', reply: 'More workers send more queries to a database that is already struggling, which can make it slower.', verdict: 'risky' },
    ] }, gap: { text: 'Waiting with no limit let a viral link slow every other link.', fix: 'Answer hot codes from the CDN and cache, and shed or break on what still needs the database.', stage: 'viral', lesson: 'backpressure' } },
    { id: 'retry-storm', stage: 'viral', when: { result: 'viral', is: 'retry:unbounded' }, priority: 7, ask: { text: 'Retrying made the queue grow faster. Why?', choices: [
      { id: 'copies', label: 'Each retry adds a request while the original is still waiting', reply: 'Yes. Retries add load exactly when the system is least able to take it. Use backoff, a cap and a breaker.', verdict: 'sound' },
      { id: 'dont-know', label: 'Retries should have helped', reply: 'They help brief hiccups, not a sustained slowdown.', verdict: 'risky' },
    ] } },
    { id: 'viral-bounded', stage: 'viral', when: { result: 'viral', is: ['shed:bounded', 'breaker:bounded'] }, ack: 'Your policy kept the longest wait within the limit.', strength: 'You bounded the wait when the database slowed, so one viral link did not hold everyone hostage.' },
    { id: 'shed-who', stage: 'viral', when: { result: 'viral', is: 'shed:bounded' }, priority: 4, ask: { text: 'Shedding gives the shed callers a fast “try again”. For a redirect, is that acceptable?', choices: [
      { id: 'cache-first', label: 'Only for what the cache and edge cannot answer; hot links never reach that point', reply: 'Yes. Shedding is a last resort once copies have absorbed what they can.', verdict: 'sound' },
      { id: 'all', label: 'Yes, for any link', reply: 'People tapping a link they were sent expect it to open. A cache should answer before you turn anyone away.', verdict: 'partial' },
    ] } },
    { id: 'viral-edge', when: { all: [{ has: 'cdn' }, { has: 'cache' }] }, strength: 'You layered a CDN edge and a code cache in front of the store, which absorbs a viral link.' },
  ],
  solution: {
    design: g([
      ['browser', 'browser', 'client', 'Browser', 20, 200], ['edge', 'edge', 'cdn', 'CDN edge', 150, 200], ['redirect', 'redirect', 'service', 'Redirect service', 290, 200],
      ['cache', 'code-cache', 'cache', 'Code cache', 440, 70], ['linksdb', 'links-db', 'db', 'Links store', 440, 200], ['create', 'create', 'service', 'Create service', 290, 360],
      ['clicks', 'clicks', 'queue', 'Click log', 440, 360], ['counter', 'counter', 'worker', 'Click counter', 570, 360],
    ], [
      ['browser', 'edge', 'sends request'], ['edge', 'redirect', 'sends request'], ['redirect', 'cache', 'reads from'], ['redirect', 'linksdb', 'reads from'], ['redirect', 'clicks', 'publishes event'],
      ['browser', 'create', 'sends request'], ['create', 'linksdb', 'writes to'], ['create', 'cache', 'invalidates'], ['clicks', 'counter', 'delivers to'],
    ]),
    why: {
      browser: 'Taps short links, and creates new ones.',
      edge: 'Answers repeat opens near the user for a short lifetime, so most traffic never reaches us.',
      redirect: 'Looks up a code: cache first, then the store, and returns a 302.',
      cache: 'Holds popular code → URL pairs in memory. A viral link is served from here.',
      linksdb: 'Source of truth, keyed on the code. A disabled flag switches a link off.',
      create: 'Makes a code and inserts it conditionally, so a code is never taken twice.',
      clicks: 'Receives one event per open so counting never slows a redirect.',
      counter: 'Counts clicks in batches from the log.',
    },
    alternatives: { cache: { types: ['edge'], tradeoff: 'A CDN edge alone can absorb most of a viral link, but it is harder to purge precisely; an in-memory cache gives you control inside the system.' } },
    trace: { title: 'Opening sho.rt/aZ3kQ9x', steps: [
      { from: 'browser', to: 'edge', text: 'GET /aZ3kQ9x. The edge has no copy this minute, so it forwards the request.' },
      { from: 'edge', to: 'redirect', text: 'Redirect service receives the code.' },
      { from: 'redirect', to: 'cache', text: 'Code cache has aZ3kQ9x → https://example.com/long/page: a hit.' },
      { from: 'redirect', to: 'linksdb', text: 'On a miss it reads the row by code, checks it is not disabled, and fills the cache.' },
      { from: 'redirect', to: 'clicks', text: 'It publishes “opened aZ3kQ9x” and returns 302 with a short max-age.' },
      { from: 'clicks', to: 'counter', text: 'The counter adds up opens in batches, off the redirect path.' },
    ] },
    tradeoff: 'Copies at the edge and in a cache make opens fast and absorb a viral link, but a copy can be stale, so disabling a link needs an explicit purge and short lifetimes.',
    otherApproach: 'For an internal tool with a few hundred links, one database table behind one service is enough. Add caches when read traffic or one hot link starts to hurt.',
  },
};
