import type { GenericLesson } from '../lessonTypes';
import { e, layout, n, py, pyLine } from './_kit';

const VERIFY = py('sdm/passwords.py', 'verify_password');

export const monolithMicroservices: GenericLesson = {
  id: 'monolith-microservices',
  area: 'Architecture and operations',
  opening: 'A team of six builds the booking app. A consultant says “use microservices: one each for events, seats, payments, tickets, users and email”. Six people, six services, six deployment pipelines. Is that good advice?',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Idea', title: 'A modular monolith: one deployable, clear inside', body: ['A **monolith** is one deployable application. A **modular monolith** keeps it in well-separated modules (seats, payments, tickets) that talk through defined interfaces and own their own tables, but ships as one unit.'],
      compare: { left: { title: 'Modular monolith', points: ['One codebase, one deploy, one database (separate schemas per module)', 'Function calls between modules: fast, no network', 'One thing to run and debug'], tone: 'ok' }, right: { title: 'Microservices', points: ['Each module is its own service and deploy', 'Network calls between them', 'Each owns its own database'] } } },
    { kicker: 'Idea', title: 'What microservices buy', body: ['**Microservices** let teams deploy independently, scale parts separately, and isolate failures, *if* the boundaries are right. They pay for it with network calls that can fail, data spread across databases, and much more operational work.'],
      compare: { left: { title: 'Gains', points: ['Independent deploys per team', 'Scale the hot part only', 'A crash stays inside one service'], tone: 'ok' }, right: { title: 'Costs', points: ['Every call can time out ([Timeouts](/learn/timeouts))', 'No cross-service transactions ([Sagas](/learn/distributed-transactions))', 'Tracing, deploys, on-call ×N'], tone: 'fail' } } },
    { kicker: 'Idea', title: 'Draw boundaries around data ownership', body: ['A good **service boundary** surrounds data that changes together and is owned by one team. Seats and holds change together, so keep them in one service. If two “services” must update the same table in one transaction, they’re really one service split badly.'],
      compare: { left: { title: 'Good boundary', points: ['Seat service owns seats + holds', 'Payments owns charges + refunds', 'They talk via API and events'], tone: 'ok' }, right: { title: 'Bad boundary', points: ['“Hold service” and “Seat service” share the seats table', 'Every hold needs both to agree'], tone: 'fail', verdict: 'a distributed monolith' } } },
    { kicker: 'Predict', title: 'Advise the team of six', body: ['One product, one team, uncertain boundaries, launching in three months.'],
      compare: { left: { title: 'Option A', points: ['Modular monolith now', 'Extract a service later where scaling or team ownership demands it'] }, right: { title: 'Option B', points: ['Six microservices from day one'] } },
      predict: { id: 'advise', prompt: 'Which is the better starting point for this team?', choices: [
        { id: 'a', text: 'A: modular monolith, extract later', why: 'Right. Boundaries are still being learned, and six people can’t run six services well. Clean modules make later extraction cheap.' },
        { id: 'b', text: 'B: microservices from the start', why: 'You’d pay the full distributed-systems cost before knowing where the real boundaries are, and wrong boundaries are expensive to move between services.' },
      ], correct: 'a' } },
  ],
  worked: { title: 'when to split a module out', blocks: [
    { type: 'table', head: ['Signal', 'Example', 'Split?'], rows: [['Different scaling needs', 'Seat map reads are 100× everything else', 'Maybe: or cache it first'], ['Different team ownership', 'A payments team with its own release cycle', 'Often yes'], ['Different reliability or compliance needs', 'Card data must be isolated (PCI)', 'Yes'], ['“It feels big”', 'Codebase is large', 'Not by itself: modularise first']] },
    { type: 'p', text: 'Communication style is a separate choice: **synchronous** calls when the caller needs the answer now (hold a seat), **asynchronous** events when others merely react (send email), as in [Queues](/learn/queues).' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Two services must both update the `seats` table inside one transaction for every hold. What does that suggest?', choices: [
    { id: 'merge', text: 'The boundary is wrong: they should be one service owning seats.', why: 'Right. Shared tables and shared transactions mean shared ownership.' },
    { id: '2pc', text: 'Use two-phase commit between them.', why: 'That treats the symptom. The data belongs to one owner.' },
  ], correct: 'merge' }],
  exercise: { id: 'extract', prompt: 'Name one module of the booking app you would extract into its own service first, and why.', checklist: ['Names a module with a concrete reason (e.g. payments: compliance/ownership; notifications: async, different scaling).', 'Mentions a cost of the split.'], model: 'Notifications: it only reacts to events, so it can be asynchronous and fail without blocking bookings; the cost is running a queue and a separate deploy.' },
  next: { id: 'schema-evolution', reason: 'Services and clients change at different times. Next: changing data formats without breaking anyone.' },
};

export const schemaEvolution: GenericLesson = {
  id: 'schema-evolution',
  area: 'Architecture and operations',
  opening: 'You want to rename the `name` column to `full_name`. Old app servers are still running during the deploy, and old phones will call the API for months. Rename it in one step, and something breaks. Do it in four small steps, and nothing does.',
  visual: { kind: 'timeline', unit: 'deploy', lanes: [{ id: 'db', label: 'Database' }, { id: 'app', label: 'App code' }], note: 'Expand, migrate, contract: each step is safe with the versions running before and after it.', events: [
    { t: 1, lane: 'db', label: 'add full_name (nullable)', tone: 'ok' },
    { t: 2, lane: 'app', label: 'write both, read name', tone: 'active' },
    { t: 3, lane: 'db', label: 'backfill full_name', tone: 'active' },
    { t: 4, lane: 'app', label: 'read full_name, write both', tone: 'active' },
    { t: 5, lane: 'app', label: 'stop writing name', tone: 'active' },
    { t: 6, lane: 'db', label: 'drop name', tone: 'ok' },
  ] },
  steps: [
    { kicker: 'Problem', title: 'Old and new versions overlap', body: ['During a rolling deploy, old and new app servers run at the same time against the same database. Old mobile apps keep calling the API long after. A change that only works for the newest version breaks the others.'], timeline: { upTo: 0 } },
    { kicker: 'Idea', title: 'Expand: add without removing', body: ['First add `full_name` as a new nullable column. Old code doesn’t know it exists and keeps working. Then deploy code that writes *both* columns.'], timeline: { upTo: 2 }, changes: [{ kind: 'add', text: 'Column full_name (nullable)' }] },
    { kicker: 'Watch', title: 'Migrate: backfill and switch reads', body: ['Copy existing values into `full_name` in batches. Then deploy code that reads `full_name`. Both versions still work, because both columns are kept up to date.'], timeline: { upTo: 4 } },
    { kicker: 'Predict', title: 'Contract: remove the old', body: ['Only when no running code reads `name` can it go.'], timeline: { upTo: 4 },
      predict: { id: 'drop', prompt: 'Why not drop `name` in the same deploy that starts reading `full_name`?', choices: [
        { id: 'old', text: 'Old servers still running during that deploy read `name`, and they’d fail.', why: 'Right. Each step must be compatible with the version before and after it. Drop only after nothing uses it.' },
        { id: 'fine', text: 'No reason; it would be fine.', why: 'A rolling deploy means old servers handle requests while new ones start, so they’d hit a missing column.' },
      ], correct: 'old' } },
    { kicker: 'Fix', title: 'Every step works with both neighbours', body: ['This is **expand/contract** (also called parallel change). The same rule covers APIs and event formats: readers must tolerate fields they don’t know (**forward compatibility**), and new code must handle old data (**backward compatibility**).'], timeline: { upTo: 6 } },
  ],
  worked: { title: 'compatibility rules for messages and APIs', blocks: [
    { type: 'table', head: ['Change', 'Safe?', 'Why'], rows: [['Add an optional field', 'Yes', 'Old readers ignore it; new readers default it'], ['Remove a field readers still use', 'No', 'Old readers break'], ['Rename a field', 'No (in one step)', 'Equivalent to remove + add: use expand/contract'], ['Change a field’s type or units', 'No', 'Readers misinterpret silently'], ['Add a new enum value', 'Careful', 'Old readers may reject unknown values']] },
    { type: 'p', text: 'Event logs make this stricter: events written years ago must still be readable. Version each event schema and keep readers for old versions, or upgrade events as you read them.' },
  ] },
  checks: [{ kind: 'order', id: 'steps', prompt: 'Put the safe rename in order.', items: ['Add the new column', 'Write to both columns', 'Backfill the new column', 'Read from the new column', 'Stop writing the old column', 'Drop the old column'], explain: 'Expand first, migrate the data and reads, and only contract once nothing depends on the old column.' }],
  exercise: { id: 'enum', prompt: 'You add a new booking status `waitlisted`. What could break, and how would you roll it out?', checklist: ['Old readers (apps, consumers) may not handle the unknown value.', 'Deploy readers that tolerate it before any writer produces it.'], model: 'Older apps or consumers may crash or mis-handle an unknown status, so first ship readers that treat unknown statuses gracefully, and only then start writing `waitlisted`.' },
  next: { id: 'multitenancy', reason: 'Schemas change over time. Next: one system serving many customers at once.' },
};

export const multitenancy: GenericLesson = {
  id: 'multitenancy',
  area: 'Architecture and operations',
  opening: 'Your ticketing platform now sells for 400 venues. One stadium runs an on-sale and every small theatre’s box office slows to a crawl. They share databases, so one tenant’s rush is everyone’s problem.',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('stadium', 'client', 'Stadium', { sub: 'on-sale: 20k req/s' }), n('theatres', 'client', '399 small venues', { stack: 3, sub: '1k req/s total' }), n('pool', 'server', 'Shared app pool', { stack: 3 }), n('db', 'db', 'Shared database', { value: 'CPU 98%' })],
      edges: [e('stadium', 'pool'), e('theatres', 'pool'), e('pool', 'db')],
      ...layout(300, 450, {
        stadium: [{ x: 120, y: 70, w: 190 }, { x: 92, y: 50, w: 166 }],
        theatres: [{ x: 120, y: 220, w: 190 }, { x: 268, y: 50, w: 166 }],
        pool: [{ x: 440, y: 145, w: 190 }, { x: 180, y: 220, w: 210 }],
        db: [{ x: 720, y: 145, w: 170 }, { x: 180, y: 380, w: 210 }],
      }),
    },
  },
  steps: [
    { kicker: 'Idea', title: 'Many customers, one system', body: ['A **multi-tenant** system serves many customers (tenants) from shared infrastructure. Sharing is cheap: one deploy, one database to run. Every row carries a `tenant_id`.'], view: { values: { db: 'CPU 30%' } } },
    { kicker: 'Failure', title: 'A noisy neighbour', body: ['The stadium’s on-sale sends 20,000 requests a second. The shared database hits 98% CPU, and every venue’s queries slow down, including theatres selling ten tickets an hour.'], view: { states: { db: 'fail', stadium: 'active' }, tags: { db: { text: 'everyone slows', tone: 'fail' } } }, changes: [{ kind: 'del', text: 'Small venues’ p99 latency: 80 ms → 2 s' }] },
    { kicker: 'Predict', title: 'Contain the blast radius', body: ['Options range from per-tenant limits to fully separate infrastructure.'], view: { states: { db: 'fail' } },
      predict: { id: 'fix', prompt: 'Which change most directly protects small venues during big on-sales?', choices: [
        { id: 'iso', text: 'Per-tenant rate limits, plus moving very large tenants to their own database or pool.', why: 'Right. Limits stop one tenant from taking everything, and isolating the few giants removes the biggest source of contention.' },
        { id: 'bigger', text: 'A bigger shared database.', why: 'It raises the ceiling, but the next bigger on-sale fills it again, and every tenant still shares the same fate.' },
      ], correct: 'iso' } },
    { kicker: 'Fix', title: 'Pool the many, isolate the few', body: ['A common shape: most tenants share a pooled database, while a handful of large or regulated tenants get dedicated resources. Per-tenant quotas cap the rest. **Shuffle sharding** assigns each tenant to a random small subset of servers, so one bad tenant only affects the few tenants that share its exact subset.'], view: { values: { db: 'CPU 45%' }, states: { stadium: 'focus' }, subs: { stadium: 'dedicated DB' } } },
  ],
  worked: { title: 'tenancy models', blocks: [
    { type: 'table', head: ['Model', 'Isolation', 'Cost per tenant', 'Fits'], rows: [['Shared tables with tenant_id', 'Lowest: needs careful query scoping', 'Lowest', 'Many small tenants'], ['Schema or database per tenant', 'Medium', 'Medium', 'Mid-size tenants, per-tenant backups'], ['Dedicated stack per tenant', 'Highest', 'Highest', 'Giants, regulated customers'], ['Hybrid (pool + dedicated for a few)', 'Tuned', 'Tuned', 'Most SaaS at scale']] },
    { type: 'callout', tone: 'warn', title: 'Isolation is also security', text: 'With shared tables, one missing `WHERE tenant_id = ?` leaks another customer’s data. Enforce it centrally (row-level security, a repository that always adds the filter), not by remembering it in every query.' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Why must tenant scoping be enforced centrally rather than in each query?', choices: [
    { id: 'leak', text: 'One forgotten filter exposes another tenant’s data.', why: 'Right. A single mistake becomes a data breach, so make the safe path the default.' },
    { id: 'speed', text: 'Central enforcement makes queries faster.', why: 'It’s about correctness and security, not speed.' },
  ], correct: 'leak' }],
  exercise: { id: 'which', prompt: 'A hospital wants to buy your platform but requires its data to be stored separately. Which tenancy model, and what does it cost you?', checklist: ['Dedicated database or stack for that tenant.', 'Names a cost (more infrastructure, per-tenant upgrades/migrations).'], model: 'Give them a dedicated database (or stack): it meets the separation requirement, at the cost of running, upgrading and migrating one more environment separately.' },
  next: { id: 'multi-region', reason: 'Isolation within one region is covered. Next: surviving the loss of a whole region.' },
};

export const multiRegion: GenericLesson = {
  id: 'multi-region',
  area: 'Architecture and operations',
  opening: 'Your whole platform runs in one cloud region. At 19:55, five minutes before a major on-sale, that region has an outage. Nothing in your code is wrong. Could the on-sale still go ahead?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('users', 'client', 'Users', { stack: 3 }), n('dns', 'lb', 'Global routing', { sub: 'DNS / anycast' }), n('eu', 'server', 'Region: EU', { value: 'primary' }), n('us', 'server', 'Region: US', { value: 'standby' }), n('eudb', 'db', 'EU database', { value: 'leader' }), n('usdb', 'db', 'US database', { value: 'replica (lag ~200 ms)' })],
      edges: [e('users', 'dns'), e('dns', 'eu'), e('dns', 'us', undefined, { dashed: true }), e('eu', 'eudb'), e('us', 'usdb'), e('eudb', 'usdb', 'async copy', { dashed: true })],
      ...layout(340, 520, {
        users: [{ x: 90, y: 170, w: 130 }, { x: 180, y: 40, w: 160 }],
        dns: [{ x: 280, y: 170, w: 170 }, { x: 180, y: 140, w: 200 }],
        eu: [{ x: 520, y: 70, w: 170 }, { x: 92, y: 270, w: 166 }],
        us: [{ x: 520, y: 270, w: 170 }, { x: 268, y: 270, w: 166 }],
        eudb: [{ x: 740, y: 70, w: 150 }, { x: 92, y: 440, w: 166 }],
        usdb: [{ x: 740, y: 270, w: 150 }, { x: 268, y: 440, w: 166 }],
      }),
    },
  },
  steps: [
    { kicker: 'Idea', title: 'Active-passive: a warm standby', body: ['Run the full stack in a second region, with its database receiving an asynchronous copy. Normally all traffic goes to the EU. If the EU fails, global routing sends users to the US, and the US database is promoted.'], view: { tokens: [{ from: 'eudb', to: 'usdb', label: 'changes', tone: 'copy' }] } },
    { kicker: 'Watch', title: 'The EU region fails', body: ['Routing detects the failure and shifts traffic to the US. The US replica was about 200 ms behind, so the last fraction of a second of EU writes may be lost or delayed. The on-sale goes ahead minutes later.'], view: { states: { eu: 'fail', eudb: 'fail', us: 'ok', usdb: 'ok' }, values: { us: 'now primary', usdb: 'promoted' }, edgeStates: { 'dns-eu': 'ghost', 'dns-us': 'active' } }, changes: [{ kind: 'chg', text: 'Traffic → US; US database promoted' }] },
    { kicker: 'Predict', title: 'Why not active-active?', body: ['In **active-active**, both regions accept writes at the same time.'], view: { values: { eu: 'active', us: 'active', eudb: 'leader', usdb: 'leader' } },
      predict: { id: 'aa', prompt: 'Both regions accept holds for seat F12 at the same moment. What new problem appears?', choices: [
        { id: 'conflict', text: 'Conflicting writes: each region may approve a different buyer before they sync.', why: 'Right. Active-active needs conflict resolution, or a rule that each record has one home region, or cross-region consensus (slow: ~100 ms per write).' },
        { id: 'none', text: 'Nothing new, just more capacity.', why: 'Two leaders for the same data can disagree. That’s the multi-leader problem at continental distance.' },
      ], correct: 'conflict' } },
    { kicker: 'Trade-off', title: 'Pick by what the data needs', body: ['Read-heavy, latency-sensitive data (event pages, seat maps) can be served from every region. Records that must never conflict (seat holds) either live in one home region per event or use cross-region consensus and accept the latency. Many systems mix both.'], view: {} },
  ],
  worked: { title: 'multi-region options', blocks: [{ type: 'table', head: ['Design', 'Region failure', 'Write latency', 'Complexity'], rows: [['Single region + backups', 'Hours to restore elsewhere', 'Lowest', 'Low'], ['Active-passive (async replica)', 'Minutes; may lose the last moments of writes', 'Low', 'Medium'], ['Active-active, data homed per event/user', 'Minutes for affected homes', 'Low for local data', 'High'], ['Active-active with cross-region consensus', 'Seconds, no loss', 'High (inter-region round trips)', 'Highest']] }] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'With active-passive and asynchronous replication, what can a region failure cost?', choices: [
    { id: 'loss', text: 'The writes not yet copied to the standby, plus minutes of failover.', why: 'Right. That’s the RPO and RTO of this design ([Backups and DR](/learn/backups-dr)).' },
    { id: 'none', text: 'Nothing: the standby is identical.', why: 'Asynchronous means the standby is slightly behind.' },
  ], correct: 'loss' }],
  exercise: { id: 'home', prompt: 'How would you keep seat holds conflict-free in an active-active, two-region design?', checklist: ['Give each event (or venue) a home region that owns its seat state.', 'Notes cost: users far from the home region pay extra latency for holds.'], model: 'Give each event a home region that owns its seat holds; other regions forward hold requests there. Holds never conflict, at the cost of extra latency for buyers far from that region.' },
  next: { id: 'authn-authz', reason: 'More regions, more entry points. Next: knowing who is calling, and what they may do.' },
};

export const authnAuthz: GenericLesson = {
  id: 'authn-authz',
  area: 'Architecture and operations',
  opening: 'Maya is signed in. She requests `GET /orders/1042`, which is someone else’s order. Your server correctly knows she is Maya. Does it also check whether Maya may see order 1042? Knowing who someone is and knowing what they may do are two different checks.',
  visual: { kind: 'timeline', unit: 'step', lanes: [{ id: 'app', label: 'App' }, { id: 'idp', label: 'Identity provider' }, { id: 'api', label: 'Booking API' }], note: 'Simplified OAuth 2.0 authorization-code flow with OpenID Connect.', events: [
    { t: 1, lane: 'app', label: 'redirect to sign-in', to: { lane: 'idp', t: 1.5 } },
    { t: 2, lane: 'idp', label: 'user signs in, consents', tone: 'active' },
    { t: 3, lane: 'idp', label: 'code → app', to: { lane: 'app', t: 3.5 } },
    { t: 4, lane: 'app', label: 'exchange code for tokens', to: { lane: 'idp', t: 4.5 } },
    { t: 5, lane: 'app', label: 'call API with access token', to: { lane: 'api', t: 5.5 } },
    { t: 6, lane: 'api', label: 'check token + permission', tone: 'ok' },
  ] },
  steps: [
    { kicker: 'Idea', title: 'Authentication: who are you?', body: ['**Authentication** proves identity: a password, a passkey, a sign-in with an identity provider. After it, the server knows “this is Maya”.'], timeline: { upTo: 2 } },
    { kicker: 'Idea', title: 'Sessions or tokens', body: ['The server then gives the client something to send with every request. A **session** is a random id in an HTTP-only cookie, mapped to the user in a server-side store (revocable instantly). A **token** such as a signed JWT carries the user’s identity itself, with no lookup, but it’s hard to revoke before it expires.'], timeline: { upTo: 2 }, code: { code: VERIFY, highlight: [pyLine(VERIFY, 'hmac.compare_digest')], caption: 'python/sdm/passwords.py — verify a salted, slow hash in constant time' } },
    { kicker: 'Watch', title: 'OAuth and OpenID Connect', body: ['With “Sign in with …”, your app never sees the password. **OAuth 2.0** lets the user grant your app an **access token** for an API. **OpenID Connect (OIDC)** adds an **ID token** saying who the user is. The authorization-code flow keeps tokens off the browser’s address bar.'], timeline: { upTo: 6 } },
    { kicker: 'Predict', title: 'Authorization: may you do this?', body: ['Maya’s token is valid. She asks for order 1042, which belongs to Leo.'], timeline: { upTo: 6 },
      predict: { id: 'authz', prompt: 'What must the API do?', choices: [
        { id: 'check', text: 'Check that order 1042 belongs to Maya (or that she has a role allowing access), and refuse with 403 or 404 otherwise.', why: 'Right. **Authorization** happens on every request, on the server, for the specific resource. Guessable ids make this check essential.' },
        { id: 'ok', text: 'Return it. She’s signed in.', why: 'Being signed in says who she is, not what she may see. This exact bug is one of the most common causes of data leaks.' },
      ], correct: 'check' } },
  ],
  worked: { title: 'authorization patterns', blocks: [
    { type: 'table', head: ['Pattern', 'Rule', 'Example'], rows: [['Ownership', 'You may act on what you own', 'Orders where buyer_id = me'], ['Role-based (RBAC)', 'Roles grant permissions', 'venue_admin may edit seat maps for their venue'], ['Attribute-based (ABAC)', 'Rules over attributes', 'Refunds allowed if event hasn’t started and amount < €500']] },
    { type: 'p', text: 'This site uses server-side sessions: an HTTP-only cookie holds a random token, the server stores only its SHA-256 hash, and every progress query is scoped by the user id taken from the session, never from the request body. That is why one account can’t read another’s progress (checked by the test suite).' },
  ] },
  checks: [
    { kind: 'choice', id: 'q1', prompt: 'A user is fired and must lose access now. Which approach makes that easiest?', choices: [
      { id: 'session', text: 'Server-side sessions: delete them.', why: 'Right. Revocation is immediate. Self-contained tokens stay valid until they expire unless you add a revocation check.' },
      { id: 'jwt', text: 'Long-lived signed tokens with no lookup.', why: 'The server never checks a store, so it can’t notice the user was removed until the token expires.' },
    ], correct: 'session' },
    { kind: 'line', id: 'idor', prompt: 'Which line is missing an authorization check?', code: 'def get_order(request, order_id):\n    user = authenticate(request)        # raises if not signed in\n    order = db.orders.get(order_id)\n    if order is None:\n        return 404\n    return order', answer: [6], explain: 'Before returning, it must check `order.buyer_id == user.id` (or a role). Otherwise any signed-in user can read any order by changing the id.', wrong: { 2: 'Authentication is there. The problem is what happens after.', 3: 'Fetching is fine; returning it to the wrong person isn’t.' } },
  ],
  exercise: { id: 'where', prompt: 'Why must authorization be enforced on the server, not only by hiding buttons in the app?', checklist: ['Clients can be modified or bypassed (direct API calls).', 'The server is the only place you control.'], model: 'Anyone can call the API directly or modify the app, so hidden buttons stop nobody; the server must check permission on every request because it is the only part you control.' },
  next: { id: 'encryption-privacy', reason: 'Access control protects data in use. Next: protecting it in transit, at rest, and from yourself.' },
};

export const encryptionPrivacy: GenericLesson = {
  id: 'encryption-privacy',
  area: 'Architecture and operations',
  opening: 'A backup tape is stolen. What does the thief get: buyers’ names and emails in plain text, a password list they can try on other sites, card numbers? Every answer depends on decisions made long before the theft.',
  visual: {
    kind: 'stack',
    layers: [
      { id: 'min', label: 'Collect less', detail: 'don’t store what you don’t need' },
      { id: 'field', label: 'Field-level encryption', detail: 'phone, address encrypted per value' },
      { id: 'hash', label: 'Password hashing', detail: 'scrypt / bcrypt / argon2, salted' },
      { id: 'rest', label: 'Encryption at rest', detail: 'disks and backups encrypted' },
      { id: 'transit', label: 'Encryption in transit', detail: 'TLS everywhere, inside too' },
    ],
  },
  steps: [
    { kicker: 'Idea', title: 'In transit: TLS everywhere', body: ['**Encryption in transit** (TLS) stops anyone on the network path from reading or changing data. Use it between your own services too, not just at the edge: internal networks get compromised.'], stack: { ghost: ['min', 'field', 'hash', 'rest'], focus: 'transit', tones: { transit: 'ok' } } },
    { kicker: 'Idea', title: 'At rest: encrypted disks and backups', body: ['**Encryption at rest** means a stolen disk or backup tape is unreadable without the keys. Keys live in a separate key management service, never next to the data they protect.'], stack: { ghost: ['min', 'field', 'hash'], focus: 'rest', tones: { transit: 'ok', rest: 'ok' } }, changes: [{ kind: 'add', text: 'Backups unreadable without the key service' }] },
    { kicker: 'Predict', title: 'Passwords are different', body: ['You never need to *read* a password back, only to check one.'], stack: { ghost: ['min', 'field'], focus: 'hash', tones: { transit: 'ok', rest: 'ok', hash: 'active' } },
      predict: { id: 'pw', prompt: 'How should passwords be stored?', choices: [
        { id: 'hash', text: 'A slow, salted one-way hash (scrypt, bcrypt, argon2).', why: 'Right. Even with the database, an attacker must guess each password separately and slowly. A unique salt defeats precomputed tables.' },
        { id: 'enc', text: 'Encrypted, so support can look them up.', why: 'Anything you can decrypt, an attacker with your keys can decrypt too. Nobody should ever be able to read a password back.' },
        { id: 'sha', text: 'One round of SHA-256.', why: 'Fast hashes let attackers test billions of guesses per second. Password hashes are deliberately slow.' },
      ], correct: 'hash' } },
    { kicker: 'Idea', title: 'Privacy: the safest data is data you don’t have', body: ['Collect only what the feature needs, keep it only as long as needed, and restrict who can see it. A ticket needs a name and email. It doesn’t need a birth date. **Field-level encryption** protects the few sensitive fields you must keep, even from people with database access.'], stack: { focus: 'min', separation: 0.7, tones: { transit: 'ok', rest: 'ok', hash: 'ok', field: 'ok', min: 'ok' } } },
  ],
  worked: { title: 'what the thief gets', blocks: [
    { type: 'table', head: ['Data', 'Without protection', 'With the layers above'], rows: [['Passwords', 'Reused on other sites', 'Slow hashes: each must be cracked separately'], ['Names, emails', 'Plain text', 'Backup encrypted at rest: unreadable'], ['Phone numbers', 'Plain text', 'Field-encrypted: needs a separate key'], ['Card numbers', 'Plain text', 'Never stored: the payment provider holds them'], ['Birth dates', 'Plain text', 'Not collected']] },
    { type: 'code', lang: 'python', code: py('sdm/passwords.py'), caption: 'python/sdm/passwords.py — salted scrypt with constant-time verify, tested with pytest' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Why does each password get its own random salt?', choices: [
    { id: 'salt', text: 'So identical passwords hash differently and precomputed tables don’t work.', why: 'Right. Attackers must attack each hash individually.' },
    { id: 'speed', text: 'To make hashing faster.', why: 'Salt adds uniqueness, not speed. The slowness comes from the hash parameters.' },
  ], correct: 'salt' }],
  exercise: { id: 'cards', prompt: 'Should the booking system store card numbers? One or two sentences.', checklist: ['No: let the payment provider store them and keep a token/reference.', 'Mentions reduced risk and compliance scope (PCI).'], model: 'No: send card details straight to the payment provider and keep only its token, so a breach of our systems can’t leak cards and our compliance burden stays small.' },
  next: { id: 'rate-limiting', reason: 'Security also means protecting capacity. Next: limiting how fast any one client can call you.' },
};

export const ARCHITECTURE1 = [monolithMicroservices, schemaEvolution, multitenancy, multiRegion, authnAuthz, encryptionPrivacy];
