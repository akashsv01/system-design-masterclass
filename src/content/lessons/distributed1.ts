import type { GenericLesson } from '../lessonTypes';
import { e, layout, n } from './_kit';

export const requirements: GenericLesson = {
  id: 'requirements',
  area: 'HLD and distributed systems',
  opening: '“Build us a ticketing system.” That’s the whole brief. Before drawing a single box, you need to know what it must do, how well, and within which limits. Ten minutes of questions here saves weeks of the wrong design.',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Idea', title: 'What it does vs how well', body: ['**Functional requirements** say what the system does: browse events, hold a seat, pay, get a ticket. **Non-functional requirements** say how well it does it: how fast, how available, at what scale, how consistent.'],
      compare: { left: { title: 'Functional', points: ['Browse events and seat maps', 'Hold a seat for 10 minutes', 'Pay and receive a ticket', 'Cancel and refund'] }, right: { title: 'Non-functional', points: ['Seat map loads in < 300 ms (p99)', 'Never sell one seat twice', '99.95% available during on-sales', '50,000 holds/minute at peak'] } } },
    { kicker: 'Idea', title: 'Constraints are given, not chosen', body: ['**Constraints** are limits you must design within: an existing payment provider, a team of four, data must stay in the EU, launch in three months. They rule out options before you compare them.'],
      compare: { left: { title: 'Requirements', points: ['Decide what success looks like'] }, right: { title: 'Constraints', points: ['Payments via Stripe (existing contract)', 'EU data residency', 'Team of 4, 3 months'], tone: 'fail', verdict: 'shrink the design space' }, focus: 'right' } },
    { kicker: 'Predict', title: 'Which requirement drives the design?', body: ['Some requirements barely matter to the architecture. Others decide it.'],
      compare: { left: { title: 'Candidate A', points: ['“Users can add events to a wishlist”'] }, right: { title: 'Candidate B', points: ['“A seat is never sold to two people, even at 50,000 holds a minute”'] } },
      predict: { id: 'driver', prompt: 'Which requirement will shape the architecture more?', choices: [
        { id: 'b', text: 'B: no double-selling under heavy concurrency', why: 'Right. It forces decisions about where seat state lives, how holds are made atomic, and how the system behaves under load.' },
        { id: 'a', text: 'A: wishlists', why: 'A wishlist is a simple per-user list that fits almost any architecture.' },
      ], correct: 'b' } },
    { kicker: 'Trade-off', title: 'Write them down with numbers', body: ['“Fast” and “scalable” can’t be designed against. “p99 under 300 ms at 50,000 holds per minute” can. Numbers also let you say what you’re *not* building: scope is a decision too.'],
      compare: { left: { title: 'Vague', points: ['“Should be fast”', '“Must scale”', '“Highly available”'], tone: 'fail' }, right: { title: 'Designable', points: ['p99 < 300 ms for seat maps', '50k holds/min peak, 2k/min typical', '99.95% monthly during on-sales'], tone: 'ok' } } },
  ],
  worked: { title: 'a requirements page for the ticketing brief', blocks: [
    { type: 'list', items: ['**In scope:** browse, seat map, hold (10 min), pay, ticket email, cancel within 24 h.', '**Out of scope (v1):** resale marketplace, dynamic pricing, mobile wallet passes.', '**Scale:** 3M bookings/month; on-sale peak 50k holds/min; seat map reads 20× holds.', '**Latency:** seat map p99 < 300 ms; hold p99 < 500 ms.', '**Correctness:** a seat is never sold twice; a paid order always yields a ticket or a refund.', '**Availability:** 99.95% during on-sales; brief maintenance allowed off-peak.', '**Constraints:** existing payment provider; EU data residency; team of 4.'] },
    { type: 'p', text: 'In interviews, spend the first few minutes producing exactly this list, out loud. The [capacity estimate](/learn/capacity-estimation) follows directly from the scale line.' },
  ] },
  checks: [{ kind: 'order', id: 'flow', prompt: 'Put the start of a design conversation in a sensible order.', items: ['Clarify functional requirements and scope', 'Agree non-functional targets with numbers', 'Note constraints', 'Estimate capacity', 'Sketch a first design'], explain: 'Scope and targets first, then limits, then numbers derived from them. Only then is there enough to design against.' }],
  exercise: { id: 'nfr', prompt: 'Turn “the chat app should feel instant” into one designable non-functional requirement.', checklist: ['Names a metric (e.g. message delivery latency).', 'Gives a percentile and threshold, ideally with scale.'], model: '99% of messages reach an online recipient within 500 ms of being sent, at 20,000 messages per second.' },
  next: { id: 'api-design', reason: 'Requirements say what the system does. The API contract says exactly how clients ask for it.' },
};

export const apiDesign: GenericLesson = {
  id: 'api-design',
  area: 'HLD and distributed systems',
  opening: 'A buyer scrolls the list of upcoming events. Page 1 shows events 1–20. While they read, three new events are added at the top. They tap “next page”, and see events 18, 19 and 20 again. The bug is in the API contract.',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Idea', title: 'A contract both sides can rely on', body: ['An **API contract** fixes the endpoint, inputs, outputs, errors and limits. Clients are written against it, often by other teams and apps you can’t update, so changing it later is expensive.'],
      compare: { left: { title: 'Request', points: ['`GET /events?city=berlin&limit=20`'] }, right: { title: 'Response', points: ['`{"events": [...20 items], "next": "eyJpZCI6..."}`', 'Errors: `400` bad city, `429` too many requests'] } } },
    { kicker: 'Failure', title: 'Offset pagination drifts', body: ['`?offset=20&limit=20` means “skip 20 rows, return the next 20”. If three rows are inserted at the top between requests, page 2 starts three rows earlier than intended, and the buyer sees repeats.'],
      compare: { left: { title: 'Page 1 (offset 0)', points: ['events 1–20'] }, right: { title: 'Page 2 (offset 20) after 3 inserts', points: ['events 18–37', '18, 19, 20 shown twice'], tone: 'fail' }, focus: 'right' } },
    { kicker: 'Fix', title: 'Cursor pagination', body: ['Return a **cursor** that encodes where page 1 ended, say “starts after event id 9020”. Page 2 asks for rows after that id. Inserts elsewhere don’t shift it, and the database can jump straight there with an index instead of counting skipped rows.'],
      compare: { left: { title: 'Offset', points: ['`?offset=20`', 'Drifts with inserts/deletes', 'Deep pages get slow (counts skipped rows)'], tone: 'fail' }, right: { title: 'Cursor', points: ['`?after=eyJpZCI6OTAyMH0`', 'Stable under inserts', 'Fast at any depth (index seek)'], tone: 'ok' } },
      changes: [{ kind: 'chg', text: 'Pagination: offset → cursor' }] },
    { kicker: 'Predict', title: 'Changing a contract safely', body: ['Mobile apps stay installed for months. A new field is needed and an old one is wrong.'],
      compare: { left: { title: 'Option A', points: ['Add `price_cents`, keep `price` for old apps', 'Remove `price` once traffic drops to ~0'] }, right: { title: 'Option B', points: ['Change `price` from cents to euros in place'] } },
      predict: { id: 'version', prompt: 'Which change keeps old apps working?', choices: [
        { id: 'a', text: 'A: add a new field, deprecate the old one later', why: 'Right. Additive changes are backward compatible. For a truly breaking change, use a new version (`/v2/…`) and run both for a while.' },
        { id: 'b', text: 'B: change the meaning in place', why: 'Old apps would show prices 100× off, silently. Same field name, different meaning: the worst kind of breaking change.' },
      ], correct: 'a' } },
  ],
  worked: { title: 'a small, complete contract', blocks: [
    { type: 'code', lang: 'http', code: 'POST /v1/holds\nIdempotency-Key: 3f1c…\n{"event_id": 9031, "seat_id": "F12"}\n\n201 Created\n{"hold_id": "h_81f2", "expires_at": "2026-11-20T20:10:00Z"}\n\n409 Conflict\n{"error": "seat_unavailable", "message": "F12 is held or sold"}\n\nGET /v1/events?city=berlin&limit=20&after=<cursor>\n200 OK\n{"events": [...], "next": "<cursor or null>"}' },
    { type: 'list', items: ['Version in the path (`/v1`) so a future breaking change can live at `/v2`.', 'Machine-readable error codes (`seat_unavailable`) plus a human message.', 'An idempotency key on creates, so retries are safe ([Idempotency](/learn/idempotency)).', 'A `limit` with a server-side maximum so one client can’t request a million rows.'] },
  ] },
  checks: [
    { kind: 'choice', id: 'deep', prompt: 'Why does `?offset=1000000&limit=20` get slow on big tables?', choices: [
      { id: 'count', text: 'The database must walk past a million rows before returning 20.', why: 'Right. A cursor lets it seek directly to the starting key.' },
      { id: 'net', text: 'The response contains a million rows.', why: 'It only returns 20. The cost is skipping the first million.' },
    ], correct: 'count' },
  ],
  exercise: { id: 'feed', prompt: 'A social feed is sorted by time, newest first. What would your cursor encode, and why not just the timestamp?', checklist: ['Encodes the last item’s position (timestamp plus a unique id).', 'Explains ties: many posts can share a timestamp.'], model: 'The last item’s (created_at, id): the timestamp orders the feed, and the id breaks ties so posts sharing a timestamp are neither skipped nor repeated.' },
  next: { id: 'proxies-gateways', reason: 'Clients call the API. Next: what sits in the path between them and your code.' },
};

export const proxiesGateways: GenericLesson = {
  id: 'proxies-gateways',
  area: 'HLD and distributed systems',
  opening: 'Maya’s request doesn’t go straight to the booking code. It passes through two or three pieces of infrastructure first, each doing a job your code would otherwise repeat in every service.',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('client', 'client', 'App'), n('proxy', 'lb', 'Reverse proxy', { sub: 'TLS, spread load' }), n('gw', 'service', 'API gateway', { sub: 'auth, limits, routing' }), n('book', 'server', 'Booking service', { stack: 3 }), n('pay', 'server', 'Payment service', { stack: 2 }), n('reg', 'db', 'Service registry', { sub: 'who is where' })],
      edges: [e('client', 'proxy'), e('proxy', 'gw'), e('gw', 'book', '/holds'), e('gw', 'pay', '/payments'), e('book', 'reg', 'register', { dashed: true }), e('gw', 'reg', 'look up', { dashed: true })],
      ...layout(330, 520, {
        client: [{ x: 80, y: 120, w: 110 }, { x: 180, y: 40, w: 150 }],
        proxy: [{ x: 250, y: 120, w: 170 }, { x: 180, y: 140, w: 210 }],
        gw: [{ x: 460, y: 120, w: 180 }, { x: 180, y: 250, w: 210 }],
        book: [{ x: 700, y: 60, w: 180 }, { x: 92, y: 370, w: 164 }],
        pay: [{ x: 700, y: 190, w: 180 }, { x: 268, y: 370, w: 164 }],
        reg: [{ x: 460, y: 280, w: 190 }, { x: 180, y: 475, w: 210 }],
      }),
    },
  },
  steps: [
    { kicker: 'Idea', title: 'A reverse proxy faces the internet', body: ['A **reverse proxy** accepts connections on your behalf: it ends TLS, absorbs slow clients, compresses responses and spreads requests across servers. Your services only ever talk to it, never directly to the internet.'], view: { hide: ['gw', 'book', 'pay', 'reg'], states: { proxy: 'focus' }, tokens: [{ from: 'client', to: 'proxy', label: 'HTTPS', tone: 'request' }] } },
    { kicker: 'Idea', title: 'An API gateway applies shared rules', body: ['An **API gateway** checks who the caller is, enforces rate limits, and routes by path: `/holds` to booking, `/payments` to payments. Without it, every service would reimplement authentication and limits slightly differently.'], view: { hide: ['reg'], states: { gw: 'focus' }, tokens: [{ from: 'gw', to: 'book', label: '/holds', tone: 'request' }] }, changes: [{ kind: 'add', text: 'Gateway: auth, rate limits, routing' }] },
    { kicker: 'Predict', title: 'Servers come and go', body: ['Booking runs three copies today and six during an on-sale. Their addresses change whenever they restart.'], view: { states: { book: 'active' } },
      predict: { id: 'disc', prompt: 'How does the gateway know where the booking servers are right now?', choices: [
        { id: 'reg', text: 'Each server registers itself in a service registry, and the gateway looks them up there.', why: 'Right. That’s **service discovery**. Unhealthy or departed servers drop out of the registry.' },
        { id: 'hard', text: 'Their IP addresses are written in the gateway’s config file.', why: 'That breaks the first time a server restarts with a new address or you scale up.' },
      ], correct: 'reg' } },
    { kicker: 'Watch', title: 'Service discovery keeps the map current', body: ['Servers announce themselves when they start and are removed when health checks fail. Callers ask the registry (or a DNS name backed by it) for the current list.'], view: { states: { reg: 'focus' }, tokens: [{ from: 'book', to: 'reg', label: 'I’m at 10.0.3.7', tone: 'copy' }] } },
    { kicker: 'Trade-off', title: 'Every hop costs', body: ['Each layer adds a little latency and is another thing that can fail or be misconfigured. Small systems often combine them into one component. The jobs stay the same even when the boxes merge.'], view: {} },
  ],
  worked: { title: 'which layer does what', blocks: [{ type: 'table', head: ['Layer', 'Typical jobs', 'Examples'], rows: [['Reverse proxy / load balancer', 'TLS termination, connection handling, spreading load, health checks', 'nginx, HAProxy, cloud load balancers'], ['API gateway', 'Authentication, rate limits, routing by path, request/response shaping', 'Kong, cloud API gateways, Envoy-based gateways'], ['Service discovery', 'Current list of healthy instances per service', 'DNS-based discovery, Consul, Kubernetes Services']] }] },
  checks: [{ kind: 'choice', id: 'where', prompt: 'Where should “at most 100 requests per minute per API key” be enforced first?', choices: [
    { id: 'gw', text: 'At the API gateway', why: 'Right. One place, applied before requests reach any service.' },
    { id: 'each', text: 'Inside each service separately', why: 'Each would count separately, and every team would reimplement it.' },
  ], correct: 'gw' }],
  exercise: { id: 'one', prompt: 'A startup has one service. Does it need a separate API gateway? One or two sentences.', checklist: ['Says probably not as a separate box.', 'Notes the jobs (TLS, auth, limits) still need doing, perhaps in a proxy or the app.'], model: 'Not as a separate component: a reverse proxy plus auth and rate limiting in the app cover it. Split out a gateway when several services need the same rules.' },
  next: { id: 'load-balancing', reason: 'The proxy spreads requests across servers. Next: how it decides which server gets each one.' },
};

export const loadBalancing: GenericLesson = {
  id: 'load-balancing',
  area: 'HLD and distributed systems',
  opening: 'Three booking servers sit behind a load balancer. One of them is struggling: a noisy neighbour on its host makes it three times slower. Round robin keeps sending it a third of all requests. Is there a smarter way to choose?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('lb', 'lb', 'Load balancer'), n('a', 'server', 'Server A', { value: '50 ms' }), n('b', 'server', 'Server B', { value: '50 ms' }), n('c', 'server', 'Server C', { value: '150 ms' })],
      edges: [e('lb', 'a'), e('lb', 'b'), e('lb', 'c')],
      ...layout(280, 380, {
        lb: [{ x: 150, y: 140, w: 180 }, { x: 180, y: 50, w: 200 }],
        a: [{ x: 600, y: 50, w: 180 }, { x: 70, y: 280, w: 116 }],
        b: [{ x: 600, y: 140, w: 180 }, { x: 180, y: 280, w: 100 }],
        c: [{ x: 600, y: 230, w: 180 }, { x: 292, y: 280, w: 116 }],
      }),
    },
  },
  experiment: {
    step: 4, label: 'Server C response time', min: 50, max: 400, stepSize: 25, initial: 150, unit: 'ms',
    compute: (slow) => {
      const rr = (50 + 50 + slow) / 3;
      // Least-connections steers traffic in proportion to speed (1/latency).
      const w = [1 / 50, 1 / 50, 1 / slow];
      const tot = w.reduce((a, b) => a + b, 0);
      const share = w.map((x) => x / tot);
      const lc = share[0] * 50 + share[1] * 50 + share[2] * slow;
      return { text: `Round robin: C gets 33% of requests, average **${Math.round(rr)} ms**. Least connections: C gets about ${Math.round(share[2] * 100)}% because its requests pile up, average **${Math.round(lc)} ms**.`, diagram: { values: { c: `${slow} ms · ${Math.round(share[2] * 100)}%`, a: `50 ms · ${Math.round(share[0] * 100)}%`, b: `50 ms · ${Math.round(share[1] * 100)}%` }, states: { c: slow > 100 ? 'active' : 'idle' } } };
    },
    assumptions: ['Steady load well below total capacity. Least-connections approximated as sending traffic in proportion to each server’s speed.'],
  },
  steps: [
    { kicker: 'Idea', title: 'Round robin: take turns', body: ['**Round robin** sends request 1 to A, 2 to B, 3 to C, 4 to A, and so on. It’s simple and fair *if every server is equally fast*.'], view: { tokens: [{ from: 'lb', to: 'c', label: 'request 3', tone: 'request' }] } },
    { kicker: 'Failure', title: 'One slow server, same share', body: ['Server C now takes 150 ms per request. Round robin still sends it every third request, so a third of users wait three times longer, and C’s queue grows if it can’t keep up.'], view: { states: { c: 'fail' }, tags: { c: { text: '3× slower', tone: 'fail' } } } },
    { kicker: 'Idea', title: 'Least connections: pick the least busy', body: ['**Least connections** sends each request to the server with the fewest requests in progress. A slow server holds requests longer, so it shows more open connections and gets fewer new ones. Load tends to follow capacity, though open connections are only a rough proxy for it.'], view: { states: { a: 'focus', c: 'active' }, tokens: [{ from: 'lb', to: 'a', label: 'fewest open', tone: 'request' }] } },
    { kicker: 'Predict', title: 'And if a server dies?', body: ['The load balancer sends a **health check** (say `GET /healthz`) every few seconds.'], view: { states: { c: 'fail' }, tags: { c: { text: 'health check failed', tone: 'fail' } } },
      predict: { id: 'health', prompt: 'Server C fails three health checks in a row. What should the load balancer do?', choices: [
        { id: 'remove', text: 'Stop sending it traffic until it passes checks again.', why: 'Right. Requests go to A and B. When C recovers and passes checks, it rejoins.' },
        { id: 'keep', text: 'Keep sending its share. It might come back.', why: 'Every request sent to a dead server fails or times out. Remove it and re-add it when healthy.' },
      ], correct: 'remove' } },
    { kicker: 'Try it', title: 'Make server C slower', body: ['Drag C’s response time and compare the two policies. Least connections can’t make C faster. It only stops C from slowing everyone else.'] },
  ],
  worked: { title: 'policies compared', blocks: [
    { type: 'table', head: ['Policy', 'How it picks', 'Good when', 'Watch out'], rows: [['Round robin', 'In turn', 'Identical servers, similar requests', 'Ignores slow servers'], ['Least connections', 'Fewest in progress', 'Uneven request costs or server speeds', 'Needs live counts; a server that fails fast can look idle and attract traffic unless errors count as load'], ['Power of two choices', 'Pick 2 at random, send to the less busy', 'Many balancers, large fleets', 'Slightly less optimal than global least-busy'], ['Hash (e.g. by user id)', 'Same key → same server', 'Server-local caches, sticky sessions', 'Hot keys; reshuffles when servers change']] },
    { type: 'p', text: 'You’ll push these policies into overload in the [load balancing lab](/labs/lab-load-balancing).' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Requests vary widely: some take 5 ms, some 2 s. Which policy handles that better?', choices: [
    { id: 'lc', text: 'Least connections', why: 'Right. A server stuck on slow requests shows more open connections and gets fewer new ones.' },
    { id: 'rr', text: 'Round robin', why: 'It would keep giving new work to servers already busy with long requests.' },
  ], correct: 'lc' }],
  exercise: { id: 'hc', prompt: 'What should a health check endpoint actually check, in one or two sentences?', checklist: ['That the server can do real work (e.g. reach its database), not only that the process is running.', 'Warns against making it so strict that one shared dependency failing removes every server.'], model: 'That the server can serve real requests (it’s running and can reach the things it needs), but not so strictly that one shared dependency blip marks every server unhealthy at once and leaves nothing to route to.' },
  next: { id: 'caching', reason: 'Balancing spreads the load. Caching removes some of it. Next: what to cache and where.' },
};

export const caching: GenericLesson = {
  id: 'caching',
  area: 'HLD and distributed systems',
  opening: 'On sale day the seat map for one show is requested 20,000 times a second, and the database answers each in 8 ms. It can’t keep up. But the map changes only when someone holds a seat. Why ask the database every time?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('app', 'server', 'App server'), n('cache', 'cache', 'Cache', { sub: 'in memory', value: 'empty' }), n('db', 'db', 'Database', { sub: '8 ms per query' })],
      edges: [e('app', 'cache', '1. look here'), e('app', 'db', '2. on miss')],
      ...layout(300, 420, {
        app: [{ x: 140, y: 150, w: 180 }, { x: 180, y: 50, w: 200 }],
        cache: [{ x: 560, y: 60, w: 200 }, { x: 92, y: 300, w: 160 }],
        db: [{ x: 560, y: 240, w: 200 }, { x: 268, y: 300, w: 160 }],
      }),
    },
  },
  experiment: {
    step: 4, label: 'Hit rate', min: 0, max: 99, stepSize: 1, initial: 90, unit: '%',
    compute: (h) => {
      const dbQps = Math.round(20000 * (1 - h / 100));
      const avg = (h / 100) * 0.5 + (1 - h / 100) * 8.5;
      return { text: `Database load: **${dbQps.toLocaleString()} queries/s** (from 20,000). Average read time: **${avg.toFixed(1)} ms** (hit 0.5 ms, miss 8.5 ms). Going from 90% to 99% cuts database load by another 10×.`, diagram: { values: { cache: `hit rate ${h}%`, db: `${dbQps.toLocaleString()} q/s` }, states: { db: dbQps > 5000 ? 'fail' : dbQps > 1000 ? 'active' : 'ok' } } };
    },
    assumptions: ['20,000 reads/s; cache hit 0.5 ms; miss = 0.5 ms cache check + 8 ms database; database comfortably handles ~1,000 q/s.'],
  },
  steps: [
    { kicker: 'Idea', title: 'Keep a copy close by', body: ['A **cache** stores copies of answers in fast memory. Cache-aside is the most common pattern: look in the cache first; on a miss, ask the database and store the answer for next time.'], view: { values: { cache: 'empty' } } },
    { kicker: 'Watch', title: 'The first request misses', body: ['The cache is empty, so the app asks the database (8 ms) and stores the seat map in the cache.'], view: { tokens: [{ from: 'app', to: 'db', label: 'miss → query', tone: 'request' }], values: { cache: 'seat map v1' }, states: { cache: 'focus' } }, changes: [{ kind: 'add', text: 'Cache now holds seat map v1' }] },
    { kicker: 'Watch', title: 'The next 999 requests hit', body: ['Every later request finds the map in the cache in about 0.5 ms. The database doesn’t hear about them at all.'], view: { tokens: [{ from: 'app', to: 'cache', label: 'hit', tone: 'response' }], values: { cache: 'seat map v1' }, states: { cache: 'ok' } } },
    { kicker: 'Predict', title: 'Where should the cache live?', body: ['You could cache in the browser, at a CDN edge, in each app server’s memory, or in a shared cache like Redis.'], view: { values: { cache: 'seat map v1' } },
      predict: { id: 'place', prompt: 'Five app servers each keep their own in-memory copy of the seat map. What problem appears when a seat is held?', choices: [
        { id: 'stale', text: 'Each server’s copy goes stale separately, and they disagree until each refreshes.', why: 'Right. Local caches are fastest but the hardest to keep consistent. A shared cache gives one copy to invalidate, at the cost of a network hop.' },
        { id: 'none', text: 'None. Memory caches update themselves.', why: 'Nothing tells each server’s copy that the database changed. That’s the invalidation problem.' },
      ], correct: 'stale' } },
    { kicker: 'Try it', title: 'Change the hit rate', body: ['Drag the hit rate. A cache’s value is measured in database load avoided, and the last few percent matter most.'] },
  ],
  worked: { title: 'cache placement and eviction', blocks: [
    { type: 'table', head: ['Where', 'Speed', 'Freshness control', 'Good for'], rows: [['Browser / app', 'No network at all', 'Hard: you can’t reach into users’ devices', 'Static assets, user’s own data briefly'], ['CDN edge', 'Close to user', 'TTLs, purge APIs', 'Images, scripts, public pages'], ['App server memory', '~microseconds', 'Per-server; drifts', 'Small, rarely changing reference data'], ['Shared cache (Redis, Memcached)', '~0.5 ms', 'One copy to update or delete', 'Seat maps, sessions, computed results']] },
    { type: 'p', text: 'Caches are small, so something must be evicted when they fill. **LRU** (least recently used) is the usual default. You built the mechanism in the [LRU lesson](/learn/lru-cache). What happens when cached data changes is the next lesson: [invalidation](/learn/cache-invalidation).' },
  ] },
  checks: [{ kind: 'numeric', id: 'load', prompt: '50,000 reads/s with a 95% hit rate. How many reach the database per second?', answer: 2500, tolerance: 0.02, unit: 'queries/s', solution: ['Misses = 5% of 50,000', '= 2,500 queries/s'] }],
  exercise: { id: 'what', prompt: 'Name one thing in the booking system you would *not* cache, and why.', checklist: ['Names something where staleness breaks correctness (e.g. the seat state used to decide a hold, or payment status).', 'Explains the harm of a stale value.'], model: 'The seat’s state when deciding a hold: acting on a stale “free” would double-sell. That decision must read the source of truth with a conditional write; the cache can only serve the display.' },
  next: { id: 'cache-invalidation', reason: 'Caches make reads fast until the data changes. Next: keeping copies fresh, and the thundering herd.' },
};

export const cacheInvalidation: GenericLesson = {
  id: 'cache-invalidation',
  area: 'HLD and distributed systems',
  opening: 'The promoter drops a ticket price from €80 to €60. Ten minutes later, buyers still see €80 and support is flooded. The database is right. The cache is wrong. And the obvious fix, a short expiry, causes a different outage.',
  visual: { kind: 'timeline', unit: 's', lanes: [{ id: 'db', label: 'Database' }, { id: 'cache', label: 'Cache' }, { id: 'users', label: 'Users' }], events: [
    { t: 0, lane: 'cache', label: 'price €80 cached (TTL 600 s)' },
    { t: 60, lane: 'db', label: 'price → €60', tone: 'active' },
    { t: 120, lane: 'users', label: 'see €80', tone: 'fail', to: { lane: 'cache', t: 121 } },
    { t: 600, lane: 'cache', label: 'expires', tone: 'active' },
    { t: 601, lane: 'users', label: 'see €60', tone: 'ok', to: { lane: 'cache', t: 602 } },
  ] },
  steps: [
    { kicker: 'Idea', title: 'TTL: let it expire', body: ['The simplest rule is a **time to live (TTL)**: each cache entry expires after, say, 600 seconds. It needs no coordination, but data can be stale for up to the full TTL.'], timeline: { upTo: 1 } },
    { kicker: 'Watch', title: 'The price changed; the cache didn’t', body: ['At 60 s the database says €60. The cache keeps serving €80 until its entry expires at 600 s, so buyers see the wrong price for nine minutes.'], timeline: { upTo: 5, focus: 2 }, changes: [{ kind: 'del', text: 'Stale price shown for 540 s' }] },
    { kicker: 'Fix', title: 'Invalidate on write', body: ['When the price changes, the code that writes the database also **deletes** the cache entry (or bumps a version in the key, such as `price:v8`). The next read misses and loads €60. Staleness drops to milliseconds, but every write path must remember to do it.'], timeline: { upTo: 5, focus: 1 } },
    { kicker: 'Predict', title: 'A popular key expires', body: ['The seat map for the biggest show is read 20,000 times a second. Its cache entry expires.'], timeline: { upTo: 5, focus: 3 },
      predict: { id: 'herd', prompt: 'In the 8 ms it takes to reload it, what happens?', choices: [
        { id: 'herd', text: 'About 160 requests all miss and all query the database at once.', why: 'Right: a **cache stampede** (thundering herd). 20,000/s × 8 ms ≈ 160 identical queries, and if the slower database makes reloads slower still, it spirals.' },
        { id: 'one', text: 'One request reloads it while the others wait.', why: 'Only if you build that. By default every miss queries the database independently.' },
      ], correct: 'herd' } },
    { kicker: 'Fix', title: 'Stop the stampede', body: ['Let one request reload while others briefly wait or serve the old value (**request coalescing**, a short lock). Or refresh popular entries *before* they expire. Adding random jitter to TTLs stops many keys from expiring at the same instant.'], timeline: { upTo: 5 } },
  ],
  worked: { title: 'strategies side by side', blocks: [
    { type: 'table', head: ['Strategy', 'Staleness', 'Cost'], rows: [['TTL only', 'Up to the TTL', 'None, but long TTLs mean long staleness'], ['Delete on write', 'Milliseconds', 'Every writer must do it; a missed path means stale data until TTL'], ['Versioned keys (`price:v8`)', 'None for new reads', 'Old versions linger until evicted'], ['Write-through (update cache on write)', 'Milliseconds', 'Writes are slower; races between concurrent writers'], ['Coalescing / early refresh', 'Same as TTL', 'Prevents stampedes; more code']] },
    { type: 'p', text: 'A common, robust combination: delete on write **plus** a modest TTL as a safety net, **plus** coalescing for hot keys. You’ll trigger a stampede yourself in the [cache lab](/labs/lab-cache).' },
  ] },
  checks: [{ kind: 'numeric', id: 'herd-size', prompt: 'A key is read 5,000 times/s and takes 40 ms to reload. Without coalescing, about how many requests hit the database when it expires?', answer: 200, tolerance: 0.05, unit: 'requests', solution: ['Requests arriving during the reload = 5,000/s × 0.04 s', '= 200'] }],
  exercise: { id: 'pick', prompt: 'For the ticket price, which invalidation approach would you use and why?', checklist: ['Delete/update on write (price errors are costly).', 'Keeps a TTL as a safety net or mentions stampede protection.'], model: 'Delete the cache entry whenever the price is written, so buyers see the new price within milliseconds, and keep a short TTL as a safety net in case some write path forgets.' },
  next: { id: 'timeouts', reason: 'Caches cover the happy path. Next: what to do when a service you call is slow.' },
};

export const DISTRIBUTED1 = [requirements, apiDesign, proxiesGateways, loadBalancing, caching, cacheInvalidation];
