import type { GenericLesson } from '../lessonTypes';
import { e, layout, n, py, pyLine } from './_kit';

const CHARGE = py('sdm/retries.py', 'charge');
const BACKOFF = py('sdm/retries.py', 'backoff_delays');
const LAMPORT = py('sdm/clocks.py').split('\n\n\ndef quorum_overlaps')[0];
const QUORUM = py('sdm/clocks.py', 'quorum_overlaps');

export const cdn: GenericLesson = {
  id: 'cdn',
  area: 'HLD and distributed systems',
  opening: 'The event poster is a 400 KB image stored in Virginia. A fan in Sydney opens the page: every round trip crosses the Pacific, about 200 ms each way. Ten thousand Sydney fans download the same picture. Why fetch it from Virginia ten thousand times?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('fan', 'client', 'Fan in Sydney'), n('edge', 'cache', 'CDN edge (Sydney)', { value: 'empty' }), n('origin', 'server', 'Origin (Virginia)')],
      edges: [e('fan', 'edge', '~10 ms'), e('edge', 'origin', '~200 ms')],
      ...layout(220, 420, {
        fan: [{ x: 110, y: 110, w: 170 }, { x: 180, y: 50, w: 200 }],
        edge: [{ x: 410, y: 110, w: 210 }, { x: 180, y: 200, w: 230 }],
        origin: [{ x: 710, y: 110, w: 180 }, { x: 180, y: 360, w: 200 }],
      }),
    },
  },
  experiment: {
    step: 3, label: 'Edge hit ratio', min: 0, max: 99, stepSize: 1, initial: 95, unit: '%',
    compute: (h) => {
      const avg = (h / 100) * 20 + (1 - h / 100) * 420;
      return { text: `Average poster fetch: **${Math.round(avg)} ms** (edge hit ≈ 20 ms; miss ≈ 20 ms + 400 ms to Virginia and back). Origin serves ${100 - h}% of requests.`, diagram: { values: { edge: `hit ratio ${h}%` }, states: { origin: h < 80 ? 'active' : 'idle' } } };
    },
    assumptions: ['Round trip fan↔edge 20 ms, edge↔origin 400 ms; one round trip per fetch (connection already open).'],
  },
  steps: [
    { kicker: 'Idea', title: 'Copies near the users', body: ['A **content delivery network (CDN)** runs cache servers (**edges**) in many cities. Users connect to the nearest edge. If the edge already has the file, it answers in a few milliseconds.'], view: { hide: ['origin'], values: { edge: 'empty' } } },
    { kicker: 'Watch', title: 'The first fan pays the long trip', body: ['The Sydney edge doesn’t have the poster yet. It fetches it from the origin in Virginia, sends it to the fan, and keeps a copy.'], view: { tokens: [{ from: 'edge', to: 'origin', label: 'miss → fetch', tone: 'request' }], values: { edge: 'poster.jpg' }, states: { edge: 'focus' } }, changes: [{ kind: 'add', text: 'Sydney edge caches poster.jpg' }] },
    { kicker: 'Predict', title: 'How long may it keep the copy?', body: ['The origin controls this with response headers: `Cache-Control: public, max-age=86400` means any cache may keep it for a day.'], view: { values: { edge: 'poster.jpg' }, tokens: [{ from: 'fan', to: 'edge', label: 'hit', tone: 'response' }] },
      predict: { id: 'deploy', prompt: 'You publish a corrected poster under the same URL, `poster.jpg`, cached for a day. What do Sydney fans see?', choices: [
        { id: 'old', text: 'The old poster, for up to a day.', why: 'Right. The edge has no reason to ask again. That’s why static files use versioned names (`poster.3f9a.jpg`): a new file gets a new URL and is never stale.' },
        { id: 'new', text: 'The new one, immediately.', why: 'The edge only re-checks when its copy expires or someone purges it.' },
      ], correct: 'old' } },
    { kicker: 'Try it', title: 'Change the hit ratio', body: ['The CDN’s value is the hit ratio. Long cache times and versioned filenames push it up. Personalised or private responses must never be cached at the edge.'] },
  ],
  worked: { title: 'what to put on a CDN', blocks: [
    { type: 'table', head: ['Content', 'CDN?', 'Cache-Control'], rows: [['Images, CSS, JS with a hash in the name', 'Yes', '`public, max-age=31536000, immutable`'], ['Public event page HTML', 'Often, briefly', '`public, max-age=60`'], ['Seat map (changes every second on sale day)', 'Rarely, or very short', '`max-age=1` or none'], ['“My tickets”, anything personal', 'No', '`private, no-store`']] },
    { type: 'p', text: 'This site serves its own build files with a one-year cache because their names contain a content hash. Its API responses are `no-store`.' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Which response must never be cached by a shared CDN?', choices: [
    { id: 'mine', text: '`GET /me/tickets`', why: 'Right. It’s personal. A shared cache could serve one user’s tickets to another.' },
    { id: 'logo', text: '`GET /static/logo.8c1d.svg`', why: 'A versioned public file is the ideal CDN content.' },
  ], correct: 'mine' }],
  exercise: { id: 'why', prompt: 'Why do build tools put a content hash in static filenames?', checklist: ['Files can be cached for a very long time.', 'A changed file gets a new name, so users never see a stale version.'], model: 'So the files can be cached for a year everywhere: any change produces a new filename, which no cache has seen, so nobody gets a stale copy.' },
  next: { id: 'timeouts', reason: 'Edges hide distance. Next: what to do when the thing you call is slow or silent.' },
};

export const timeouts: GenericLesson = {
  id: 'timeouts',
  area: 'HLD and distributed systems',
  opening: 'The payment provider usually answers in 300 ms. Today, some calls never return. Your checkout threads wait forever, one by one, until no threads are left. Now checkout is down for everyone, including people paying with a provider that’s working fine.',
  visual: { kind: 'chart', xLabel: 'percent of payment calls finished →', yLabel: 'response time (ms)', note: 'Illustrative sample of 20 calls. The hung call (30 s+) is drawn at the top of the scale.' },
  experiment: {
    step: 3, label: 'Timeout', min: 200, max: 5000, stepSize: 100, initial: 2000, unit: 'ms',
    compute: (t) => {
      const lat = [180, 200, 220, 240, 260, 280, 300, 320, 350, 380, 420, 480, 550, 650, 800, 1000, 1400, 2200, 4000, 30000];
      const cut = lat.filter((x) => x > t).length;
      const held = Math.round(100 * lat.reduce((a, x) => a + Math.min(x, t), 0) / lat.length) / 100;
      return { text: `**${(cut / lat.length * 100).toFixed(0)}%** of calls are cut off as failures; a thread is held for **${Math.round(held)} ms** on average (versus ${Math.round(lat.reduce((a, b) => a + b, 0) / lat.length)} ms with no timeout, dominated by the hung call). Pick a timeout above the p99 of healthy calls, not above the hung ones.`, chart: { series: [{ name: 'calls', points: lat.map((v, i) => [(i + 1) * 5, Math.min(v, 5000)] as [number, number]) }], thresholds: [{ y: t, label: `timeout ${t} ms` }] } };
    },
    assumptions: ['20 representative calls; one hangs for 30 s (drawn capped at 5 s). Threads are released when a call returns or times out.'],
  },
  steps: [
    { kicker: 'Problem', title: 'Waiting is not free', body: ['Every in-progress call holds a thread, a connection and some memory. A call that never returns holds them forever. In a distributed system, “no answer yet” can mean slow, dead, or the reply got lost: you can’t tell which. This is **partial failure**.'], chart: { series: [{ name: 'calls', points: [180, 200, 220, 240, 260, 280, 300, 320, 350, 380, 420, 480, 550, 650, 800, 1000, 1400, 2200, 4000, 5000].map((v, i) => [(i + 1) * 5, v] as [number, number]) }] } },
    { kicker: 'Failure', title: 'One slow call takes everything down', body: ['If payment calls hang, checkout threads pile up waiting. When the pool is exhausted, *every* request to the checkout service fails, even ones that never needed that provider. That’s a **cascading failure**.'], chart: { series: [{ name: 'calls', points: [180, 200, 220, 240, 260, 280, 300, 320, 350, 380, 420, 480, 550, 650, 800, 1000, 1400, 2200, 4000, 5000].map((v, i) => [(i + 1) * 5, v] as [number, number]) }], marks: [{ x: 100, y: 5000, label: 'hung: 30 s+' }] } },
    { kicker: 'Predict', title: 'Where to set the timeout', body: ['Healthy calls: p50 ≈ 300 ms, p99 ≈ 2,200 ms.'], chart: { series: [{ name: 'calls', points: [180, 200, 220, 240, 260, 280, 300, 320, 350, 380, 420, 480, 550, 650, 800, 1000, 1400, 2200, 4000, 5000].map((v, i) => [(i + 1) * 5, v] as [number, number]) }], thresholds: [{ y: 2500, label: 'timeout?' }] },
      predict: { id: 'where', prompt: 'Which timeout is most sensible for this payment call?', choices: [
        { id: '2500', text: 'About 2.5 s: a little above the healthy p99', why: 'Right. Nearly every healthy call finishes; hung calls release their thread within seconds.' },
        { id: '300', text: '300 ms: the median', why: 'Half of perfectly healthy calls would be cut off and counted as failures.' },
        { id: '60', text: '60 s: be patient', why: 'Threads would be held for a minute per hung call, which is enough to exhaust the pool during an incident.' },
      ], correct: '2500' } },
    { kicker: 'Try it', title: 'Move the timeout', body: ['Too low and you fail healthy requests. Too high and hung calls hold resources. A timeout says when to stop waiting. What to do next (retry, fall back, show an error) is the next lesson.'] },
  ],
  worked: { title: 'timeouts in practice', blocks: [
    { type: 'list', items: ['Set a timeout on **every** network call: database, cache, HTTP, queue. Many libraries default to “wait forever”.', 'Derive it from measured latency (p99 of healthy calls plus margin), and revisit it when the dependency changes.', 'Give the whole request a **deadline** and pass the remaining time down, so a 3 s user request doesn’t make a 5 s downstream call.', 'Pair timeouts with a **circuit breaker**: after many failures, stop calling the sick dependency for a while and fail fast.'] },
    { type: 'code', lang: 'python', code: 'import requests\n\n# connect timeout 0.5 s, read timeout 2.5 s — never the library default of "forever"\nresp = requests.post(PAYMENTS_URL, json=body, timeout=(0.5, 2.5))', caption: 'New Python: `requests` waits indefinitely unless you pass `timeout=`.' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'A call times out after 2.5 s. What do you know about the payment?', choices: [
    { id: 'unknown', text: 'Nothing for certain: it may have been charged, or not.', why: 'Right. The request may have succeeded and the reply been lost. That uncertainty is why retries need [idempotency](/learn/idempotency).' },
    { id: 'failed', text: 'It failed, so the card wasn’t charged.', why: 'A timeout only means you stopped waiting. The provider may still have processed it.' },
  ], correct: 'unknown' }],
  exercise: { id: 'cascade', prompt: 'In one or two sentences: how does a missing timeout turn one slow dependency into a full outage?', checklist: ['Calls pile up holding threads/connections.', 'Pool exhaustion makes unrelated requests fail too.'], model: 'Without a timeout, every call to the slow dependency holds a thread indefinitely; the pool fills up and the service can no longer serve anything, including requests that never touch that dependency.' },
  next: { id: 'retries', reason: 'A call timed out. Should you try again? Next: retries that help instead of hurt.' },
};

export const retries: GenericLesson = {
  id: 'retries',
  area: 'HLD and distributed systems',
  opening: 'Your payment timed out. Should the app try again? Retrying fixes a one-off network blip. But if the payment provider is overloaded, every client retrying at once makes the overload worse. The details of *how* you retry decide which happens.',
  visual: { kind: 'chart', xLabel: 'seconds since the provider slowed down', yLabel: 'requests/s reaching the provider', note: 'Illustrative model: 1,000 user requests/s; the provider starts failing 80% of calls at 2 s.' },
  experiment: {
    step: 3, label: 'Retries per failed call', min: 0, max: 5, stepSize: 1, initial: 3, unit: 'retries',
    compute: (r) => {
      const base = 1000;
      // With failure rate f, attempts per request = 1 + f + f^2 + ... + f^r
      const f = 0.8;
      let amp = 0;
      for (let i = 0; i <= r; i++) amp += f ** i;
      return { text: `When 80% of calls fail, each user request becomes **${amp.toFixed(1)} attempts**: the provider receives **${Math.round(base * amp).toLocaleString()} req/s** instead of 1,000. Retries multiply load exactly when the dependency can least afford it.`, chart: { series: [{ name: 'immediate retries', points: Array.from({ length: 11 }, (_, s) => [s, s < 2 ? base : Math.round(base * amp)] as [number, number]), tone: 'fail' }, { name: 'no retries', points: Array.from({ length: 11 }, (_, s) => [s, base] as [number, number]), tone: 'ok', dashed: true }] } };
    },
    assumptions: ['1,000 user requests/s; provider fails 80% of calls while overloaded; each retry is sent immediately.'],
  },
  steps: [
    { kicker: 'Idea', title: 'Retry transient failures', body: ['Some failures go away on their own: a dropped packet, a server restarting, a brief overload. Trying again a moment later often succeeds. Others never will: a declined card or a malformed request. Retry only the first kind.'], chart: { series: [{ name: 'no retries', points: Array.from({ length: 11 }, (_, s) => [s, 1000] as [number, number]), tone: 'ok' }] } },
    { kicker: 'Failure', title: 'Retries amplify overload', body: ['The provider slows down at t = 2 s and starts failing calls. Every client retries immediately, three times. Load on the struggling provider jumps from 1,000 to over 2,900 requests a second: a **retry storm**.'], chart: { series: [{ name: 'immediate retries', points: Array.from({ length: 11 }, (_, s) => [s, s < 2 ? 1000 : 2952] as [number, number]), tone: 'fail' }, { name: 'no retries', points: Array.from({ length: 11 }, (_, s) => [s, 1000] as [number, number]), tone: 'ok', dashed: true }] } },
    { kicker: 'Fix', title: 'Back off, and add jitter', body: ['**Exponential backoff** waits longer before each retry: 0.1 s, 0.2 s, 0.4 s… so pressure eases as failures continue. **Jitter** randomises each wait, so thousands of clients don’t all retry at the same instant. Cap the number of attempts.'], chart: { series: [{ name: 'backoff + jitter', points: [[0, 1000], [1, 1000], [2, 1000], [3, 1500], [4, 1300], [5, 1150], [6, 1080], [7, 1040], [8, 1020], [9, 1010], [10, 1000]], tone: 'accent' }, { name: 'no retries', points: Array.from({ length: 11 }, (_, s) => [s, 1000] as [number, number]), tone: 'ok', dashed: true }] },
      code: { code: BACKOFF, highlight: [pyLine(BACKOFF, 'ceiling = min'), pyLine(BACKOFF, 'rng.uniform')], caption: 'python/sdm/retries.py — capped exponential backoff with “full jitter”' } },
    { kicker: 'Try it', title: 'Change how many retries', body: ['Drag the retry count and watch the load multiply. Large systems also set a **retry budget**: retries may add at most, say, 10% extra load, after which clients fail fast.'] },
    { kicker: 'Predict', title: 'One more trap', body: ['The payment call timed out, so you retry it.'], chart: { series: [{ name: 'backoff + jitter', points: [[0, 1000], [10, 1000]], tone: 'accent' }] },
      predict: { id: 'double', prompt: 'The first attempt actually succeeded. Only its reply was lost. What does a plain retry do?', choices: [
        { id: 'twice', text: 'Charges the card a second time.', why: 'Right. Retries are only safe if the operation is idempotent. That’s the next lesson.' },
        { id: 'safe', text: 'Nothing: the provider knows it’s a retry.', why: 'Only if you tell it, with an idempotency key. Otherwise it’s just another charge request.' },
      ], correct: 'twice' } },
  ],
  worked: { title: 'a retry policy you can defend', blocks: [
    { type: 'list', items: ['Retry only errors that may be transient: timeouts, 503, 429 (respecting `Retry-After`), connection resets. Never retry 400s or declined cards.', 'Exponential backoff from ~100 ms, capped (e.g. 5 s), with full jitter.', 'At most 2–3 attempts, and within the caller’s overall deadline.', 'Retry at **one** layer. If the app, the client library and the proxy each retry 3 times, one failure can become 27 calls.', 'Only retry operations that are idempotent, or made idempotent with a key.'] },
    { type: 'code', lang: 'python', code: 'from sdm.retries import backoff_delays\n\nprint([round(d, 2) for d in backoff_delays(5, base=0.1, cap=5, jitter=False)])\n# [0.1, 0.2, 0.4, 0.8, 1.6]\nprint([round(d, 2) for d in backoff_delays(5, base=0.1, cap=5)])\n# five random waits, each between 0 and that ceiling' },
  ] },
  checks: [
    { kind: 'numeric', id: 'layers', prompt: 'The app, the HTTP client and the service mesh each retry up to 2 extra times (3 attempts each). How many calls can one failing request become?', answer: 27, tolerance: 0.01, unit: 'calls', solution: ['Each layer multiplies attempts by 3', '3 × 3 × 3 = 27'] },
    { kind: 'choice', id: 'which', prompt: 'Which response should a client retry?', choices: [
      { id: '503', text: '503 Service Unavailable', why: 'Right. The server is temporarily unable. Retry with backoff.' },
      { id: '400', text: '400 Bad Request', why: 'The request itself is wrong. Retrying the same request fails the same way.' },
      { id: '402', text: 'Payment declined', why: 'The bank said no. Retrying doesn’t change the answer and may trigger fraud checks.' },
    ], correct: '503' },
  ],
  exercise: { id: 'jitter', prompt: 'Why does jitter matter when thousands of clients fail at the same moment?', checklist: ['Without jitter, they all retry at the same instants (synchronised waves).', 'Randomness spreads retries out so the dependency can recover.'], model: 'Without jitter every client that failed together waits the same time and retries together, hitting the dependency in synchronised waves; random waits spread the retries out so it gets room to recover.' },
  next: { id: 'idempotency', reason: 'Backoff makes retries gentle. Idempotency makes them safe.' },
};

export const idempotency: GenericLesson = {
  id: 'idempotency',
  area: 'HLD and distributed systems',
  opening: 'Maya pays €45. The request reaches the provider, the card is charged, and the reply is lost on the way back. Her app times out and retries. Without one small addition to the request, she pays €90.',
  visual: { kind: 'timeline', unit: 'ms', lanes: [{ id: 'app', label: 'Maya’s app' }, { id: 'pay', label: 'Payment service' }, { id: 'card', label: 'Card' }], events: [
    { t: 0, lane: 'app', label: 'charge €45', to: { lane: 'pay', t: 40 } },
    { t: 60, lane: 'card', label: '−€45', tone: 'active' },
    { t: 80, lane: 'pay', label: 'reply lost', tone: 'fail' },
    { t: 2500, lane: 'app', label: 'timeout → retry', to: { lane: 'pay', t: 2540 } },
    { t: 2560, lane: 'card', label: '−€45 again', tone: 'fail' },
  ] },
  steps: [
    { kicker: 'Problem', title: 'The first attempt succeeded', body: ['The charge went through at 60 ms. The reply was lost, so Maya’s app sees only silence.'], timeline: { upTo: 3 } },
    { kicker: 'Failure', title: 'The retry charges again', body: ['After the 2.5 s timeout, the app retries. To the payment service it’s a brand-new charge request, so the card is charged twice.'], timeline: { upTo: 5 }, changes: [{ kind: 'del', text: 'Card charged €90 for a €45 ticket' }] },
    { kicker: 'Fix', title: 'Send an idempotency key', body: ['An operation is **idempotent** if doing it twice has the same effect as doing it once. Make the charge idempotent: the app generates a unique **idempotency key** for this payment (say, the order id) and sends it with every attempt. The service remembers keys it has processed and returns the stored result instead of charging again.'], timeline: { upTo: 5, focus: 3 }, code: { code: CHARGE, highlight: [pyLine(CHARGE, 'if idempotency_key is not None and idempotency_key in self.results:'), pyLine(CHARGE, 'return self.results[idempotency_key]')], caption: 'python/sdm/retries.py — a retried key returns the first result', open: true } },
    { kicker: 'Predict', title: 'Choosing the key', body: ['The key must be the same for retries of one payment and different for genuinely separate payments.'], timeline: { upTo: 5 },
      predict: { id: 'key', prompt: 'Which is a good idempotency key for paying for order #91?', choices: [
        { id: 'order', text: 'A random id generated once when the order’s payment starts, reused on every retry (e.g. `pay-order-91-attempt-1`).', why: 'Right. Stable across retries of this payment, unique per payment.' },
        { id: 'time', text: 'The current timestamp, generated on each attempt.', why: 'Each retry would get a new key, so the service would treat it as a new payment.' },
        { id: 'card', text: 'The card number.', why: 'Every future purchase with that card would be treated as a duplicate.' },
      ], correct: 'order' } },
    { kicker: 'Trade-off', title: 'What the server must get right', body: ['Store the key and the result **atomically** with the charge, or a crash between them reopens the hole. Keep keys long enough to cover all retries (often 24 hours). If a second request with the same key arrives *while the first is still running*, make it wait or return “in progress”. Never run both.'], timeline: { upTo: 5 } },
  ],
  worked: { title: 'idempotent by design', blocks: [
    { type: 'table', head: ['Operation', 'Idempotent?', 'How to make it safe'], rows: [['`GET /holds/h1`', 'Yes', 'Reads change nothing'], ['`PUT /seats/F12/status = held`', 'Yes', 'Setting a value twice leaves the same value'], ['`DELETE /holds/h1`', 'Yes', 'Deleting twice: second is a no-op (often 404)'], ['`POST /charges`', 'No', 'Idempotency key, stored with the result'], ['`balance = balance - 45`', 'No', 'Record the operation id; skip if already applied'], ['Send email', 'No', 'Deduplicate by message id before sending']] },
    { type: 'p', text: 'This site’s own progress sync works this way: every batch of saved changes carries a `mutationId`, and the server stores the result, so a retried save after a dropped connection is applied once.' },
  ] },
  checks: [
    { kind: 'choice', id: 'q1', prompt: 'Which operation is naturally idempotent?', choices: [
      { id: 'set', text: '“Set seat F12’s status to booked”', why: 'Right. Doing it twice leaves the same state.' },
      { id: 'inc', text: '“Add 1 to tickets sold”', why: 'Twice adds 2. It needs an operation id to deduplicate.' },
    ], correct: 'set' },
    { kind: 'line', id: 'bug', prompt: 'This handler is meant to be idempotent but can still double-charge on a retry. Which line is the problem?', code: 'def charge(self, card, amount, key):\n    if key in self.results:\n        return self.results[key]\n    result = self.provider.charge(card, amount)\n    self.audit_log.append((key, result))\n    return result', answer: [5], explain: 'The result is written to an audit log but never to `self.results`, so a retry with the same key isn’t recognised. It should store `self.results[key] = result`, ideally atomically with the charge.', wrong: { 2: 'The check is right; the problem is that nothing ever adds the key.', 4: 'Charging is the point; the issue is what’s remembered afterwards.' } },
  ],
  exercise: { id: 'email', prompt: 'A queue may deliver the “send ticket email” message twice. How would you make sure the buyer gets one email?', checklist: ['Uses a unique message/order id as a deduplication key.', 'Checks (and records) it before or atomically with sending.'], model: 'Give each message a unique id (e.g. order id + “ticket-email”), and before sending, record that id in a store of sent messages; if it’s already there, skip.' },
  next: { id: 'clocks-ordering', reason: 'Retries and duplicates raise a harder question: in what order did things really happen?' },
};

export const clocksOrdering: GenericLesson = {
  id: 'clocks-ordering',
  area: 'HLD and distributed systems',
  opening: 'Two servers log events with their own clocks. Server A says the seat was released at 20:00:00.120. Server B says it was booked at 20:00:00.100. Booked before it was released? Server B’s clock runs 50 ms slow. Wall clocks can’t settle “which happened first”.',
  visual: { kind: 'timeline', unit: 'ms (true time)', lanes: [{ id: 'a', label: 'Server A' }, { id: 'b', label: 'Server B (clock −50 ms)' }], events: [
    { t: 120, lane: 'a', label: 'release F12 (stamp .120)', to: { lane: 'b', t: 140 } },
    { t: 150, lane: 'b', label: 'book F12 (stamp .100)', tone: 'fail' },
  ] },
  steps: [
    { kicker: 'Problem', title: 'Every machine’s clock is a little wrong', body: ['Computer clocks drift, and synchronisation (NTP) keeps them close, typically within milliseconds, but never identical. A clock can even jump backwards when corrected.'], timeline: { upTo: 1 } },
    { kicker: 'Failure', title: 'Timestamps contradict cause and effect', body: ['In true time, the release (120 ms) caused the booking (150 ms). But B’s slow clock stamps the booking .100, earlier than the release. Sort by timestamp and you’d conclude it was booked before it was free.'], timeline: { upTo: 2 }, changes: [{ kind: 'del', text: 'Timestamp order ≠ real order' }] },
    { kicker: 'Fix', title: 'Order by causality, not wall time', body: ['A **Lamport clock** is a counter on each server: add 1 for every event, attach it to every message, and on receiving a message jump ahead of the sender’s counter. If event X could have caused Y, X’s number is smaller.'], timeline: { upTo: 2, focus: 0 }, code: { code: LAMPORT, highlight: [pyLine(LAMPORT, 'self.time = max(self.time, sent_at) + 1')], caption: 'python/sdm/clocks.py — the receive rule keeps causes before effects', open: true } },
    { kicker: 'Predict', title: 'What about unrelated events?', body: ['Two buyers in different cities, with no messages between their servers, act at nearly the same moment.'], timeline: { upTo: 2 },
      predict: { id: 'conc', prompt: 'Their Lamport numbers are 7 and 9. Does that prove the first happened before the second?', choices: [
        { id: 'no', text: 'No. Unrelated events have no real order; the numbers just break the tie.', why: 'Right. Lamport clocks guarantee “cause before effect”, not the reverse. Vector clocks can detect that two events were concurrent.' },
        { id: 'yes', text: 'Yes. Smaller number means earlier.', why: 'Only for causally related events. For independent ones, the order is arbitrary but consistent.' },
      ], correct: 'no' } },
    { kicker: 'Trade-off', title: 'Practical ordering', body: ['Most systems avoid needing global order. They funnel events that must be ordered through **one sequencer**: one database row, one leader, or one partition of a log, which hands out increasing numbers. Spanner instead bounds clock uncertainty with special hardware and waits it out.'], timeline: { upTo: 2 } },
  ],
  worked: { title: 'tools for ordering', blocks: [{ type: 'table', head: ['Tool', 'Guarantees', 'Cost'], rows: [['Wall-clock timestamps', 'Roughly right; wrong under skew', 'None; misleading for close events'], ['Sequence from one leader / partition', 'Total order within that scope', 'That leader is a bottleneck and must fail over'], ['Lamport clock', 'Cause before effect', 'Can’t tell concurrent from ordered'], ['Vector clock', 'Detects concurrency', 'Size grows with participants'], ['Bounded-uncertainty time (Spanner TrueTime)', 'Global order consistent with real time', 'Special infrastructure; commit waits']] }] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'A chat must show messages in the same order to everyone in a conversation. A simple robust approach?', choices: [
    { id: 'seq', text: 'Route each conversation’s messages through one partition or leader that assigns increasing sequence numbers.', why: 'Right. One sequencer per conversation gives a total order where it matters.' },
    { id: 'ts', text: 'Sort by the sender’s phone timestamp.', why: 'Phone clocks can be minutes off, so messages would appear out of order or jump around.' },
  ], correct: 'seq' }],
  exercise: { id: 'why', prompt: 'Why is “last write wins by timestamp” risky across servers?', checklist: ['Clock skew can make an older write look newer.', 'A real, later update can be silently discarded.'], model: 'With skewed clocks, a write made earlier on a fast-clock server can carry a later timestamp and overwrite a genuinely newer write, which is silently lost.' },
  next: { id: 'consistency-models', reason: 'Ordering underpins every consistency promise. Next: the promises themselves.' },
};

export const consistencyModels: GenericLesson = {
  id: 'consistency-models',
  area: 'HLD and distributed systems',
  opening: 'You’ve seen a profile show an old name (replica lag) and a seat sold twice (a race). Both are about what a reader is allowed to see after a write. Consistency models name those guarantees precisely, so you can choose one per feature.',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Idea', title: 'Strong: one copy, one timeline', body: ['**Linearizability** (strong consistency): the system behaves as if there were a single copy of the data. Once a write completes, every later read sees it, from anyone, anywhere.'],
      compare: { left: { title: 'Linearizable', points: ['Maya saves “Alex” at 10:00:00.5', 'Any read after that, by anyone, returns “Alex”'], tone: 'ok' }, right: { title: 'Cost', points: ['Coordination on every write or read', 'Higher latency; unavailable during partitions'] } } },
    { kicker: 'Idea', title: 'Eventual: copies converge… eventually', body: ['**Eventual consistency**: if writes stop, all copies will *eventually* agree. Until then, reads may return old values, and different readers may see different ones.'],
      compare: { left: { title: 'Eventually consistent', points: ['Follower returns “Sam” for ~1.5 s', 'Then “Alex” everywhere'] }, right: { title: 'Benefit', points: ['Fast, local reads', 'Keeps working when replicas can’t talk'], tone: 'ok' } } },
    { kicker: 'Idea', title: 'Useful guarantees in between', body: ['Session guarantees cover what one user notices without the full cost of strong consistency. **Read-your-writes**: you always see your own changes. **Monotonic reads**: you never see time go backwards. **Causal**: if you saw a post, you also see what it replies to.'],
      compare: { left: { title: 'Read-your-writes', points: ['Maya sees “Alex” immediately', 'Her sister may still see “Sam” briefly'], tone: 'ok' }, right: { title: 'Causal', points: ['A reply never appears before the message it answers'], tone: 'ok' } } },
    { kicker: 'Predict', title: 'Choose per feature', body: ['One system, different needs.'],
      compare: { left: { title: 'Feature A', points: ['Seat hold: two buyers must never both succeed'] }, right: { title: 'Feature B', points: ['“12,408 fans interested” counter on the event page'] } },
      predict: { id: 'pick', prompt: 'Which feature needs linearizable behaviour?', choices: [
        { id: 'a', text: 'A: the seat hold', why: 'Right. The hold decision must act on the single current truth. The counter can lag by seconds without harming anyone.' },
        { id: 'b', text: 'B: the interest counter', why: 'Being off by a few for a few seconds harms nobody. Paying for strong consistency there is waste.' },
      ], correct: 'a' } },
  ],
  worked: { title: 'mapping features to models', blocks: [
    { type: 'table', head: ['Feature', 'Model', 'Typical mechanism'], rows: [['Seat hold / payment state', 'Linearizable for that record', 'Single leader + conditional write, or consensus'], ['Your profile after editing', 'Read-your-writes', 'Route your reads to the leader briefly, or client-side update'], ['Chat replies', 'Causal', 'Per-conversation sequence numbers'], ['Like counts, view counts', 'Eventual', 'Async replication, periodic aggregation'], ['Search index', 'Eventual (seconds)', 'Index updated from a change stream']] },
    { type: 'p', text: 'Strong consistency usually applies per record or per partition, not to the whole system. Designing which records need it is a large part of HLD.' },
  ] },
  checks: [{ kind: 'choice', id: 'mono', prompt: 'A user refreshes and sees 5 comments, refreshes again and sees 3, then 5 again. Which guarantee is missing?', choices: [
    { id: 'mono', text: 'Monotonic reads', why: 'Right. Their reads hit replicas at different lag. Pinning a user to one replica fixes it.' },
    { id: 'lin', text: 'Nothing. That’s fine under eventual consistency.', why: 'It’s allowed under plain eventual consistency, which is exactly why monotonic reads exists as a stronger, cheap guarantee.' },
  ], correct: 'mono' }],
  exercise: { id: 'feed', prompt: 'For a social feed, which consistency guarantee would you insist on for the author, and which is fine for everyone else?', checklist: ['Read-your-writes for the author (they see their own post).', 'Eventual for followers, with a reason.'], model: 'The author gets read-your-writes so their post appears immediately for them; followers can be eventually consistent, since seeing a post a few seconds later harms nobody.' },
  next: { id: 'cap-quorums', reason: 'Stronger guarantees need copies to coordinate. Next: what happens when they can’t.' },
};

export const capQuorums: GenericLesson = {
  id: 'cap-quorums',
  area: 'HLD and distributed systems',
  opening: 'Your seat store runs in two data centres. The link between them fails. A buyer in Berlin asks to hold F12. The Berlin copy can’t ask the Dublin copy whether someone there just held it. Answer anyway, or refuse? There’s no option that gives you both.',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('berlin', 'db', 'Berlin replica', { value: 'F12: free' }), n('dublin', 'db', 'Dublin replica', { value: 'F12: free' }), n('third', 'db', 'Paris replica', { value: 'F12: free' }), n('buyer', 'client', 'Buyer (Berlin)')],
      edges: [e('berlin', 'dublin', 'link'), e('berlin', 'third'), e('dublin', 'third'), e('buyer', 'berlin')],
      ...layout(320, 430, {
        buyer: [{ x: 110, y: 70, w: 160 }, { x: 180, y: 40, w: 190 }],
        berlin: [{ x: 280, y: 220, w: 190 }, { x: 92, y: 180, w: 166 }],
        dublin: [{ x: 700, y: 220, w: 190 }, { x: 268, y: 180, w: 166 }],
        third: [{ x: 490, y: 80, w: 180 }, { x: 180, y: 370, w: 200 }],
      }),
    },
  },
  steps: [
    { kicker: 'Problem', title: 'A network partition', body: ['A **partition** means some replicas can’t talk to others, while each keeps running. Partitions happen: cut cables, misconfigured firewalls, overloaded switches.'], view: { hide: ['third'], edgeStates: { 'berlin-dublin': 'ghost' }, states: { berlin: 'active', dublin: 'active' }, tags: { dublin: { text: 'unreachable', tone: 'fail' } } } },
    { kicker: 'Idea', title: 'CAP: during a partition, pick one', body: ['The **CAP theorem** says: while partitioned, a system can’t be both **consistent** (linearizable: every read sees the latest write) and **available** (every replica answers). Berlin either answers without checking with Dublin (available, maybe wrong) or refuses until the link returns (consistent, unavailable).'], view: { hide: ['third'], edgeStates: { 'berlin-dublin': 'ghost' }, tokens: [{ from: 'buyer', to: 'berlin', label: 'hold F12?', tone: 'request' }] } },
    { kicker: 'Predict', title: 'Choose for seat holds', body: ['If Berlin says yes and Dublin also said yes to someone else, F12 is double-sold.'], view: { hide: ['third'], edgeStates: { 'berlin-dublin': 'ghost' } },
      predict: { id: 'choose', prompt: 'During the partition, what should Berlin do with seat holds?', choices: [
        { id: 'c', text: 'Refuse (or queue) holds it can’t confirm: choose consistency.', why: 'Right. A brief “try again” is better than selling one seat twice. A product catalogue might choose availability instead.' },
        { id: 'a', text: 'Accept, and sort it out later: choose availability.', why: 'Sorting out later means telling someone their confirmed seat is gone. That’s unacceptable for holds.' },
      ], correct: 'c' } },
    { kicker: 'Idea', title: 'Quorums: majority rules', body: ['With 3 replicas, require writes to reach **W = 2** and reads to ask **R = 2**. Because **R + W > N**, every read overlaps at least one replica holding the latest write. Berlin plus Paris form a majority, so they can keep working. Dublin alone can’t.'], view: { states: { berlin: 'ok', third: 'ok', dublin: 'fail' }, edgeStates: { 'berlin-dublin': 'ghost', 'dublin-third': 'ghost' }, tags: { dublin: { text: 'minority: refuses', tone: 'fail' } } }, code: { code: QUORUM, caption: 'python/sdm/clocks.py' } },
    { kicker: 'Trade-off', title: 'Where the arithmetic stops being enough', body: ['R + W > N assumes sloppy details are handled: a replica that missed writes must be repaired, concurrent writes need a rule to decide the winner, and “reached W replicas” must mean durably stored. Quorums reduce stale reads. They don’t automatically make a system linearizable.'], view: { states: { berlin: 'ok', third: 'ok' } } },
  ],
  worked: { title: 'quorum arithmetic', blocks: [
    { type: 'table', head: ['N', 'W', 'R', 'R + W > N?', 'Survives'], rows: [['3', '2', '2', 'yes', '1 replica down for reads and writes'], ['3', '3', '1', 'yes', 'reads with 2 down; writes need all 3'], ['3', '1', '1', 'no', 'fast, but reads can miss the latest write'], ['5', '3', '3', 'yes', '2 replicas down']] },
    { type: 'p', text: 'When there is no partition, the real everyday trade-off is between **latency and consistency**: waiting for more replicas is safer and slower. Dynamo-style stores let each application tune N, R and W (the Dynamo paper’s common setting is 3, 2, 2).' },
  ] },
  checks: [
    { kind: 'choice', id: 'q1', prompt: 'N = 5, W = 2, R = 2. Is a read guaranteed to see the latest successful write?', choices: [
      { id: 'no', text: 'No: 2 + 2 = 4, which is not more than 5', why: 'Right. The read could ask two replicas that both missed the write.' },
      { id: 'yes', text: 'Yes', why: 'R + W must exceed N for the sets to overlap. Here they can be disjoint.' },
    ], correct: 'no' },
    { kind: 'choice', id: 'q2', prompt: 'During a partition, a product-recommendations service keeps serving slightly stale results. Which CAP choice is that?', choices: [
      { id: 'ap', text: 'Availability', why: 'Right. And a sensible one, since stale recommendations harm nobody.' },
      { id: 'cp', text: 'Consistency', why: 'It answers without coordinating, so it chose availability.' },
    ], correct: 'ap' },
  ],
  exercise: { id: 'cart', prompt: 'A shopping cart service: during a partition, would you choose availability or consistency? One or two sentences.', checklist: ['Picks availability for the cart (accept adds), with a merge strategy.', 'Notes checkout/payment still needs consistency.'], model: 'Availability: letting people keep adding items and merging carts afterwards beats refusing; but the final checkout and payment step should require consistency.' },
  next: { id: 'consensus', reason: 'Majorities also let a cluster agree on a leader safely. Next: consensus and Raft.' },
};

export const DISTRIBUTED2 = [cdn, timeouts, retries, idempotency, clocksOrdering, consistencyModels, capQuorums];
