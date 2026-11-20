/**
 * Curriculum manifest: every topic in scope, its prerequisites, objective, the scope
 * terms it covers, and sources. Status is NOT declared here; it is computed in
 * curriculum.ts from the content that actually exists (see TopicStatus).
 *
 * Order within a module is the recommended order.
 *
 * Learner language: Python 3 (MASTER_PROMPT Amendments 1–4). Worked code lives in python/ and is
 * verified with pytest. Objectives describe understanding, prediction and decisions; required exercises
 * are small (predict, fill one condition, change a line, pick a line, choose a design, explain briefly).
 */
import type { Category, Module, Topic, TopicKind } from './types';
import { SRC, type SourceKey } from './sources';

/**
 * The course outline (brief §5): Category → Module → Lesson. It is the single source of truth for the
 * navigator, the topic explorer, breadcrumbs, previous/next lesson and the recommended route. Every topic
 * appears exactly once; order within a module is the recommended order (checked by audit:content).
 */
export const CATEGORIES: Category[] = [
  { id: 'start', title: 'Start here', blurb: 'One booking system, end to end: client, server, database, and your first race condition.', units: [
    { id: 'first-system', title: 'Your first system', topics: ['first-booking', 'hld-vs-lld'] },
  ] },
  { id: 'bridges', title: 'Programming bridges', blurb: 'Short refreshers on the programming ideas the course leans on.', units: [
    { id: 'formats', title: 'JSON and SQL', topics: ['bridge-json', 'bridge-sql'] },
    { id: 'structures', title: 'Maps and linked lists', topics: ['bridge-maps', 'bridge-linked-lists'] },
    { id: 'code-together', title: 'Interfaces and threads', topics: ['bridge-interfaces', 'bridge-threads'] },
  ] },
  { id: 'foundations', title: 'Foundations and networking', blurb: 'What happens between a tap and a reply, how to measure it, and how to estimate load.', units: [
    { id: 'request', title: 'Inside a request', topics: ['inside-a-request', 'tcp-udp', 'http-rest-rpc', 'realtime-delivery'] },
    { id: 'machines', title: 'Processes, memory and disk', topics: ['processes-threads', 'memory-disk'] },
    { id: 'capacity', title: 'Speed and capacity', topics: ['latency', 'lab-request-tracing', 'throughput-bandwidth', 'capacity-estimation'] },
    { id: 'scale', title: 'Staying up and scaling out', topics: ['availability', 'stateless-scaling'] },
  ] },
  { id: 'data', title: 'Data systems', blurb: 'How data is modelled, stored, cached, copied and split, and what each choice costs.', units: [
    { id: 'modeling', title: 'Modeling and queries', topics: ['access-patterns', 'normalization', 'indexes', 'data-models'] },
    { id: 'storage', title: 'Storage and transactions', topics: ['storage-engines', 'transactions', 'locking-mvcc', 'concurrent-reservations'] },
    { id: 'replication', title: 'Replication', topics: ['replica-lag', 'failover', 'lab-stale-reads'] },
    { id: 'caching', title: 'Caching', topics: ['caching', 'cache-invalidation', 'lru-cache', 'lab-cache', 'lab-lru'] },
    { id: 'partitioning', title: 'Partitioning', topics: ['sharding', 'consistent-hashing', 'lab-hot-spots'] },
  ] },
  { id: 'distributed', title: 'Distributed systems (HLD)', blurb: 'Designing systems from parts that fail independently: APIs, traffic, failures, ordering, agreement and messaging.', units: [
    { id: 'interfaces', title: 'Requirements and APIs', topics: ['requirements', 'api-design'] },
    { id: 'traffic', title: 'Traffic and edges', topics: ['proxies-gateways', 'load-balancing', 'cdn', 'lab-load-balancing'] },
    { id: 'failures', title: 'When calls fail', topics: ['timeouts', 'retries', 'idempotency', 'lab-payment-retries'] },
    { id: 'agreement', title: 'Time, order and agreement', topics: ['clocks-ordering', 'consistency-models', 'cap-quorums', 'consensus'] },
    { id: 'messaging', title: 'Messaging and streams', topics: ['queues', 'logs-delivery', 'backpressure', 'batch-stream', 'lab-queue-backlog'] },
    { id: 'multi-service', title: 'Transactions across services', topics: ['distributed-transactions', 'cqrs-event-sourcing'] },
  ] },
  { id: 'architecture', title: 'Architecture and operations', blurb: 'Service boundaries, security, observability, reliability targets, deployment, recovery and cost.', units: [
    { id: 'boundaries', title: 'Services and boundaries', topics: ['monolith-microservices', 'schema-evolution', 'multitenancy', 'multi-region'] },
    { id: 'security', title: 'Security and limits', topics: ['authn-authz', 'encryption-privacy', 'rate-limiting'] },
    { id: 'operations', title: 'Running in production', topics: ['observability', 'slos', 'deployments', 'backups-dr', 'cost'] },
  ] },
  { id: 'lld', title: 'Low-level design (LLD)', blurb: 'Objects, invariants, state machines, tests, concurrency and design patterns, in short Python.', units: [
    { id: 'objects', title: 'Objects and responsibilities', topics: ['responsibilities', 'polymorphism-composition', 'cohesion-coupling', 'solid'] },
    { id: 'rules', title: 'Rules, models and diagrams', topics: ['contracts-invariants', 'domain-objects', 'dependency-injection', 'uml', 'state-machines'] },
    { id: 'correctness', title: 'Tests, refactoring, concurrency', topics: ['testing', 'refactoring-lesson', 'concurrency-lld'] },
    { id: 'patterns', title: 'Design patterns', topics: ['gof-reference', 'pattern-strategy', 'pattern-observer', 'pattern-state', 'pattern-decorator', 'pattern-factory-builder', 'pattern-adapter', 'pattern-command'] },
  ] },
  { id: 'cases', title: 'Design cases', blurb: 'Ambiguous prompts worked into defensible designs, at the HLD and LLD zoom levels, ending in a capstone.', units: [
    { id: 'commerce', title: 'Booking and payments', topics: ['case-ticket-booking', 'lld-booking', 'case-payments', 'case-checkout', 'lld-shopping-cart'] },
    { id: 'realtime', title: 'Messaging and live updates', topics: ['case-notifications', 'lld-notifications', 'case-live-scores', 'lld-live-scores', 'case-chat', 'case-collab-editor'] },
    { id: 'products', title: 'Products at scale', topics: ['case-url-shortener', 'case-feed', 'case-autocomplete', 'case-file-sync', 'case-video', 'case-ride-matching'] },
    { id: 'platform', title: 'Platform services', topics: ['case-rate-limiter', 'lld-rate-limiter', 'case-scheduler', 'lld-scheduler', 'case-metrics', 'case-crawler', 'lld-logger'] },
    { id: 'classics', title: 'Machine-coding classics', topics: ['lld-parking-lot', 'lld-elevator', 'lld-vending-machine', 'lld-library', 'lld-expense-sharing', 'lld-lru', 'lld-board-game'] },
    { id: 'capstone', title: 'Capstone', topics: ['capstone'] },
  ] },
];

/** Category summaries, in outline order. */
export const MODULES: Module[] = CATEGORIES.map(({ id, title, blurb }) => ({ id, title, blurb }));

const ROUTE: Record<TopicKind, string> = {
  lesson: '/learn/', bridge: '/learn/', lab: '/labs/', 'case-hld': '/cases/', 'case-lld': '/cases/', pattern: '/patterns/', capstone: '/capstone/',
};

type RawTopic = Omit<Topic, 'category' | 'unit'>;

/** `_group` is the topic's pre-outline grouping, kept only so the entries below read as before; the outline decides placement. */
function T(
  id: string,
  title: string,
  _group: string,
  kind: TopicKind,
  prereqs: string[],
  objective: string,
  covers: string[],
  sources: SourceKey[],
  short?: string,
): RawTopic {
  return { id, title, short, kind, prereqs, objective, covers, sources: sources.map((k) => SRC[k]), route: ROUTE[kind] + id };
}

const RAW_TOPICS: RawTopic[] = [
  // ---------------- Start here ----------------
  T('first-booking', 'Two buyers see one seat left. Who gets it?', 'start', 'lesson', [],
    'Trace one request through client, server and database, and explain why two overlapping reservations can both succeed.',
    ['client', 'server', 'database', 'request', 'response', 'race condition', 'HLD', 'LLD'], ['kurose', 'ddia7'], 'Your first system'),
  T('hld-vs-lld', 'Same feature, two zoom levels: HLD and LLD', 'start', 'lesson', ['first-booking'],
    'Tell apart a high-level design question from a low-level design question about the same feature, and say which artifacts each produces.',
    ['HLD', 'LLD', 'requirements'], ['sdi1', 'fsa'], 'HLD and LLD'),

  // ---------------- Bridges ----------------
  T('bridge-json', 'What does a request body actually look like?', 'bridges', 'bridge', [],
    'Read and write JSON objects, arrays and nested values, and spot why a field type change breaks a client.',
    ['JSON'], ['rfc8259'], 'JSON'),
  T('bridge-maps', 'How does a program find one item among a million?', 'bridges', 'bridge', [],
    'Explain how a hash map gives near-constant-time lookup and what a key must guarantee.',
    ['maps', 'hash map', 'dict'], ['pyDict'], 'Maps'),
  T('bridge-linked-lists', 'How do you move an item to the front without shifting everything?', 'bridges', 'bridge', ['bridge-maps'],
    'Manipulate a doubly linked list (unlink, push front, remove tail) and state the cost of each operation.',
    ['linked lists'], [], 'Linked lists'),
  T('bridge-sql', 'How do you ask a database a question?', 'bridges', 'bridge', ['bridge-json'],
    'Read SELECT, INSERT, UPDATE with WHERE, and a JOIN, predict their results on a small table, and complete one clause.',
    ['SQL'], ['ddia2', 'pgIndexes'], 'SQL basics'),
  T('bridge-interfaces', 'How can two classes promise the same behaviour?', 'bridges', 'bridge', [],
    'Recognise a shared interface in Python (duck typing, then typing.Protocol) and predict which implementation runs when both are called through the same code.',
    ['interfaces', 'Protocol', 'duck typing'], ['pyProtocol'], 'Interfaces'),
  T('bridge-threads', 'What happens when two things run at once in one program?', 'bridges', 'bridge', [],
    'Predict the result of two Python threads incrementing a shared counter and explain why the final count can be wrong.',
    ['threads'], ['ostepThreads', 'pyThreading'], 'Threads'),

  // ---------------- Foundations ----------------
  T('inside-a-request', 'What’s inside a request?', 'foundations', 'lesson', ['first-booking'],
    'Name the parts of an HTTP request and response (method, path, headers, body, status) and trace DNS → TCP → TLS → HTTP with timings.',
    ['networks', 'DNS', 'IP', 'TCP', 'TLS', 'HTTP'], ['kurose', 'rfc9110', 'rfc1034', 'rfc9293', 'rfc8446'], 'Inside a request'),
  T('processes-threads', 'Why can one server handle a thousand users at once?', 'foundations', 'lesson', ['bridge-threads'],
    'Distinguish processes from threads, and concurrency from parallelism, using a request-handling server as the example.',
    ['processes', 'threads', 'concurrency', 'parallelism'], ['ostepProc', 'ostepThreads'], 'Processes and threads'),
  T('memory-disk', 'Why is reading from disk so much slower than from memory?', 'foundations', 'lesson', ['processes-threads'],
    'Order memory, SSD, disk and network by access latency to within an order of magnitude and use it to explain caching and durability.',
    ['memory', 'disk'], ['ostepPersist', 'ddia3'], 'Memory and disk'),
  T('tcp-udp', 'Should a video call resend a lost packet?', 'foundations', 'lesson', ['inside-a-request'],
    'Compare TCP and UDP guarantees (ordering, delivery, connection setup) and choose one for a given workload.',
    ['TCP', 'UDP', 'IP'], ['kurose', 'rfc9293', 'rfc768'], 'TCP vs UDP'),
  T('http-rest-rpc', 'Is “POST /reserve” a good API?', 'foundations', 'lesson', ['inside-a-request', 'bridge-json'],
    'Design resource-oriented REST endpoints and an equivalent RPC interface; choose methods and status codes with idempotency in mind.',
    ['HTTP', 'REST', 'RPC'], ['rfc9110', 'rfc9113', 'rfc9114'], 'HTTP, REST and RPC'),
  T('realtime-delivery', 'How does the score update without refreshing?', 'foundations', 'lesson', ['http-rest-rpc', 'tcp-udp'],
    'Compare polling, long polling, server-sent events and WebSockets by latency, server cost and failure behaviour.',
    ['polling', 'SSE', 'WebSockets'], ['sse', 'mdnSse', 'rfc6455'], 'Polling, SSE, WebSockets'),
  T('latency', 'The average is 80 ms. Why are users complaining?', 'foundations', 'lesson', ['inside-a-request'],
    'Compute and interpret p50/p95/p99 latency from samples and explain why tail latency grows with fan-out.',
    ['latency', 'percentiles'], ['sreMonitoring', 'ddia1'], 'Latency and percentiles'),
  T('throughput-bandwidth', 'Can this server handle Friday’s ticket drop?', 'foundations', 'lesson', ['latency'],
    'Relate throughput, latency and concurrency (Little’s law), and distinguish throughput from bandwidth.',
    ['throughput', 'bandwidth', 'bottlenecks'], ['ddia1', 'sreOverload'], 'Throughput and bandwidth'),
  T('availability', 'What does “99.9% available” allow?', 'foundations', 'lesson', ['latency'],
    'Convert availability percentages to downtime budgets and compute the availability of serial and redundant components.',
    ['availability'], ['sreRisk', 'sap'], 'Availability'),
  T('capacity-estimation', 'How many servers do we need for a ticket drop?', 'foundations', 'lesson', ['throughput-bandwidth'],
    'Estimate requests per second, peak load, storage and bandwidth from stated assumptions, with units and arithmetic.',
    ['capacity estimation', 'peak load', 'bottlenecks'], ['sdi1', 'ddia1'], 'Capacity estimation'),
  T('stateless-scaling', 'Why does adding a second server log people out?', 'foundations', 'lesson', ['capacity-estimation', 'processes-threads'],
    'Explain stateful vs stateless services and when to scale vertically or horizontally.',
    ['stateful/stateless services', 'vertical scaling', 'horizontal scaling'], ['sdi1', 'ddia1'], 'Stateless services and scaling'),

  // ---------------- Data systems ----------------
  T('access-patterns', 'Which questions will the app ask its data?', 'data', 'lesson', ['bridge-sql'],
    'List an application’s read and write access patterns and derive a schema from them.',
    ['access patterns', 'schemas', 'relationships'], ['ddia2'], 'Access patterns and schemas'),
  T('normalization', 'Store the venue name once, or on every ticket?', 'data', 'lesson', ['access-patterns'],
    'Normalise a schema to remove update anomalies, then denormalise one read path and state the cost.',
    ['normalization', 'denormalization', 'relationships'], ['ddia2'], 'Normalization'),
  T('indexes', 'Why does one query take 2 seconds and the next 2 ms?', 'data', 'lesson', ['bridge-sql', 'memory-disk'],
    'Read a query plan, add an index that turns a scan into a lookup, and state what the index costs on writes.',
    ['SQL', 'query plans', 'indexes'], ['pgExplain', 'pgIndexes', 'ddia3'], 'Indexes and query plans'),
  T('data-models', 'Which kind of database fits this data?', 'data', 'lesson', ['access-patterns'],
    'Match relational, document, key-value, wide-column, graph, search, time-series and object storage to access patterns.',
    ['relational', 'document', 'key-value', 'wide-column', 'graph', 'search', 'time-series', 'object storage'], ['ddia2', 'bigtable', 'dynamo'], 'Data models'),
  T('storage-engines', 'How does a database survive a power cut mid-write?', 'data', 'lesson', ['indexes'],
    'Explain B-trees, LSM trees, write-ahead logs and compaction, and compare their read/write costs.',
    ['B-trees', 'LSM trees', 'write-ahead logs', 'compaction'], ['ddia3', 'dbInternals', 'lsm', 'pgWal'], 'Storage engines'),
  T('transactions', 'Why did the bank balance go negative?', 'data', 'lesson', ['first-booking', 'bridge-sql'],
    'Define atomicity and isolation, and identify dirty reads, lost updates, write skew and phantoms in interleavings.',
    ['transactions', 'isolation anomalies'], ['ddia7', 'critique', 'pgIso'], 'Transactions and isolation'),
  T('locking-mvcc', 'How can readers and writers avoid blocking each other?', 'data', 'lesson', ['transactions'],
    'Compare pessimistic locking, optimistic concurrency and MVCC snapshots on the same workload.',
    ['locking', 'MVCC'], ['ddia7', 'pgMvcc', 'pgLocking'], 'Locking and MVCC'),
  T('replica-lag', 'Why does my profile still show my old name?', 'data', 'lesson', ['first-booking'],
    'Explain asynchronous replication lag, predict a stale read, and compare read-your-writes strategies by cost.',
    ['replication', 'replication lag', 'consistency models'], ['ddia5'], 'Replication lag'),
  T('failover', 'The leader database died. Now what?', 'data', 'lesson', ['replica-lag'],
    'Walk through leader failover, data loss windows and split brain, and choose sync vs async replicas.',
    ['replication', 'failover'], ['ddia5', 'ablLeader'], 'Failover'),
  T('sharding', 'One database can’t hold every ticket. How do we split it?', 'data', 'lesson', ['data-models', 'capacity-estimation'],
    'Choose a partition key, predict hot spots, and compare range and hash partitioning.',
    ['sharding', 'partition keys', 'hot spots'], ['ddia6'], 'Sharding'),
  T('consistent-hashing', 'Adding one server reshuffled every key. Can we avoid that?', 'data', 'lesson', ['sharding'],
    'Compute key movement under modulo hashing vs consistent hashing with virtual nodes, and plan a rebalance.',
    ['consistent hashing', 'rebalancing'], ['karger', 'dynamo', 'ddia6'], 'Consistent hashing'),

  // ---------------- HLD and distributed ----------------
  T('requirements', 'What exactly are we building?', 'distributed', 'lesson', ['hld-vs-lld', 'capacity-estimation'],
    'Turn an ambiguous prompt into functional requirements, non-functional requirements and explicit constraints.',
    ['requirements', 'constraints'], ['sdi1', 'sap'], 'Requirements'),
  T('api-design', 'How should the app ask for page 2 of results?', 'distributed', 'lesson', ['http-rest-rpc', 'requirements'],
    'Choose an API contract with cursor pagination, errors and a versioning plan, and justify each choice.',
    ['API contracts', 'pagination', 'versioning'], ['rfc9110', 'ddia4'], 'API design'),
  T('proxies-gateways', 'What sits between the internet and your servers?', 'distributed', 'lesson', ['api-design', 'stateless-scaling'],
    'Place reverse proxies, API gateways and service discovery in a request path and state each one’s job.',
    ['proxies', 'gateways', 'service discovery'], ['fsa', 'sreLbFront'], 'Proxies and gateways'),
  T('load-balancing', 'Three servers, one is slow. Where should the next request go?', 'distributed', 'lesson', ['proxies-gateways'],
    'Compare round robin, least connections and power-of-two choices, and explain health checks.',
    ['load balancing'], ['sreLbDc', 'sreLbFront'], 'Load balancing'),
  T('cdn', 'Why does the poster image load fast in Sydney?', 'distributed', 'lesson', ['inside-a-request', 'caching'],
    'Explain how a CDN serves content from edge locations, and how cache headers control freshness.',
    ['CDNs'], ['kurose', 'rfc9110'], 'CDNs'),
  T('caching', 'Should we cache the seat map?', 'distributed', 'lesson', ['memory-disk', 'replica-lag'],
    'Choose cache placement (client, CDN, service, database) and a write strategy, and predict hit-rate effects.',
    ['cache placement', 'eviction', 'invalidation'], ['ablCaching', 'ddia1'], 'Caching'),
  T('cache-invalidation', 'The price changed but users see the old one. Why?', 'distributed', 'lesson', ['caching'],
    'Compare TTLs, explicit invalidation and versioned keys; prevent a cache stampede.',
    ['invalidation', 'stampedes'], ['ablCaching'], 'Invalidation and stampedes'),
  T('lru-cache', 'Which item should the cache forget?', 'lld', 'lesson', ['bridge-maps', 'bridge-linked-lists'],
    'Predict LRU evictions, then explain from the worked Python code how a dict plus a doubly linked list make every operation O(1).',
    ['eviction', 'LRU', 'linked lists', 'maps'], ['ablCaching', 'pyOrderedDict'], 'LRU cache'),
  T('timeouts', 'The payment service is slow. Should we keep waiting?', 'distributed', 'lesson', ['latency'],
    'Pick a timeout from latency percentiles and explain how partial failure cascades without one.',
    ['timeouts', 'partial failure'], ['ablRetries', 'releaseIt', 'ddia8', 'sreCascading'], 'Timeouts and partial failure'),
  T('retries', 'Your payment timed out. Should the app try again?', 'distributed', 'lesson', ['timeouts'],
    'Design a retry policy with exponential backoff and jitter, and show how retries amplify load.',
    ['retries', 'backoff', 'jitter'], ['ablRetries', 'sreCascading'], 'Retries, backoff, jitter'),
  T('idempotency', 'The retry charged the card twice. How do we stop that?', 'distributed', 'lesson', ['retries'],
    'Make an operation safe to retry with idempotency keys and deduplication storage.',
    ['idempotency', 'deduplication'], ['ablIdempotent', 'rfc9110'], 'Idempotency'),
  T('clocks-ordering', 'Which message came first?', 'distributed', 'lesson', ['realtime-delivery'],
    'Explain why wall clocks disagree, and order events with sequence numbers and Lamport clocks.',
    ['ordering', 'clocks'], ['lamport', 'ddia8', 'spanner'], 'Clocks and ordering'),
  T('consistency-models', 'What promises can a copy of data make?', 'distributed', 'lesson', ['replica-lag', 'clocks-ordering'],
    'Distinguish linearizability, sequential, causal, read-your-writes and eventual consistency with timelines.',
    ['consistency models'], ['ddia9', 'vanSteen'], 'Consistency models'),
  T('cap-quorums', 'The network split. Answer, or refuse?', 'distributed', 'lesson', ['consistency-models'],
    'Apply CAP during a partition and reason about quorum overlap (R + W > N) and its assumptions.',
    ['CAP during partitions', 'quorum assumptions'], ['gilbertLynch', 'dynamo', 'ddia9'], 'CAP and quorums'),
  T('consensus', 'How do three servers agree on one leader?', 'distributed', 'lesson', ['cap-quorums', 'failover'],
    'Explain leader election, terms and log replication in Raft at an intuitive level, and where coordination services fit.',
    ['leader election', 'consensus', 'Raft intuition', 'coordination'], ['raft', 'ddia9', 'ablLeader', 'mit6824'], 'Consensus and Raft'),
  T('queues', 'Why put a queue between checkout and email?', 'distributed', 'lesson', ['timeouts'],
    'Use queues and pub/sub to decouple producers from consumers, and choose between them.',
    ['queues', 'pub/sub', 'synchronous and asynchronous communication'], ['ddia11', 'ablBacklog'], 'Queues and pub/sub'),
  T('logs-delivery', 'Did the consumer process that message once, twice, or never?', 'distributed', 'lesson', ['queues', 'idempotency'],
    'Explain partitioned logs, consumer groups, offsets and at-most/at-least/effectively-once delivery.',
    ['logs', 'consumer groups', 'delivery guarantees'], ['ddia11'], 'Logs and delivery guarantees'),
  T('backpressure', 'Producers send 2,000/s, consumers handle 1,500/s. What happens?', 'distributed', 'lesson', ['queues', 'throughput-bandwidth'],
    'Compute backlog growth and drain time, and apply backpressure or load shedding.',
    ['backpressure', 'queues'], ['ablBacklog', 'ablShedding', 'sreOverload'], 'Backpressure'),
  T('batch-stream', 'Count ticket sales per minute — now, or tonight?', 'distributed', 'lesson', ['logs-delivery'],
    'Compare batch and stream processing; use event time, windows and watermarks for late data.',
    ['batch processing', 'stream processing', 'event time', 'watermarks'], ['ddia10', 'ddia11', 'mapreduce'], 'Batch and stream'),
  T('distributed-transactions', 'Payment succeeded but the seat booking failed. Now what?', 'distributed', 'lesson', ['transactions', 'queues', 'idempotency'],
    'Compare two-phase commit with sagas, design compensations, and use the outbox pattern to publish reliably.',
    ['distributed transactions', 'sagas', 'outbox'], ['ddia9', 'sagas'], 'Sagas and outbox'),
  T('cqrs-event-sourcing', 'Can we rebuild every booking from its history?', 'distributed', 'lesson', ['distributed-transactions', 'logs-delivery'],
    'Separate write and read models (CQRS) and derive state from an event log (event sourcing), with costs.',
    ['CQRS', 'event sourcing'], ['ddia11', 'ddia12'], 'CQRS and event sourcing'),

  // ---------------- Architecture and operations ----------------
  T('monolith-microservices', 'Should the booking app be one service or ten?', 'architecture', 'lesson', ['requirements', 'queues'],
    'Choose between a modular monolith and microservices, and draw service boundaries around data ownership.',
    ['modular monoliths', 'microservices', 'service boundaries', 'synchronous and asynchronous communication'], ['fsa', 'ddd'], 'Monolith vs microservices'),
  T('schema-evolution', 'How do you rename a field without breaking old apps?', 'architecture', 'lesson', ['api-design'],
    'Plan backward- and forward-compatible changes with expand/contract migrations.',
    ['schema evolution', 'versioning'], ['ddia4'], 'Schema evolution'),
  T('multitenancy', 'One big customer slows everyone down. Why?', 'architecture', 'lesson', ['sharding'],
    'Compare shared, pooled and isolated tenancy models and limit noisy neighbours.',
    ['multitenancy'], ['ablShuffle', 'fsa'], 'Multitenancy'),
  T('multi-region', 'What happens when a whole region goes down?', 'architecture', 'lesson', ['failover', 'cap-quorums'],
    'Compare active-passive and active-active multi-region designs by latency, consistency and cost.',
    ['multi-region design'], ['ddia5', 'spanner'], 'Multi-region'),
  T('authn-authz', 'Who are you, and are you allowed to do that?', 'architecture', 'lesson', ['http-rest-rpc'],
    'Distinguish authentication from authorization; compare sessions and tokens; outline OAuth 2.0 and OIDC flows.',
    ['authentication', 'authorization', 'sessions', 'OAuth/OIDC fundamentals'], ['rfc6749', 'oidc', 'rfc7519'], 'Authentication and authorization'),
  T('encryption-privacy', 'What should an attacker see if they steal the database?', 'architecture', 'lesson', ['authn-authz'],
    'Apply encryption in transit and at rest, hash passwords properly, and minimise personal data.',
    ['encryption', 'privacy'], ['rfc8446'], 'Encryption and privacy'),
  T('rate-limiting', 'One client sends 10,000 requests a second. What do we do?', 'architecture', 'lesson', ['throughput-bandwidth'],
    'Trace token bucket and sliding window limiters step by step, compare their behaviour on bursts, and choose where to enforce them.',
    ['rate limiting'], ['rfc6585', 'sdi1'], 'Rate limiting'),
  T('observability', 'Checkout is slow. Where do you look first?', 'architecture', 'lesson', ['latency'],
    'Use logs, metrics and traces together to localise a slow request.',
    ['observability', 'logs', 'metrics', 'traces'], ['sreMonitoring'], 'Observability'),
  T('slos', 'How reliable is reliable enough?', 'architecture', 'lesson', ['availability', 'observability'],
    'Define SLIs and SLOs and spend an error budget on a release decision.',
    ['SLIs', 'SLOs', 'error budgets'], ['sreSlo', 'sreRisk', 'sreWorkbookSlo'], 'SLIs, SLOs, error budgets'),
  T('deployments', 'The new version is failing for 5% of users. Roll back?', 'architecture', 'lesson', ['slos'],
    'Compare rolling, blue-green and canary deployments and plan a rollback.',
    ['deployments', 'rollback'], ['sreRisk', 'releaseIt'], 'Deployments and rollback'),
  T('backups-dr', 'A bad migration blanked every email. Can we get them back?', 'architecture', 'lesson', ['failover'],
    'Plan backups, restore testing and disaster recovery to meet RPO and RTO targets.',
    ['backups', 'restore testing', 'disaster recovery', 'RPO/RTO'], ['ddia5'], 'Backups and disaster recovery'),
  T('cost', 'Which design is cheaper at 10× traffic?', 'architecture', 'lesson', ['capacity-estimation'],
    'Estimate the monthly cost of two designs from unit prices and identify the dominant cost driver.',
    ['cost reasoning'], ['fsa'], 'Cost reasoning'),

  // ---------------- LLD ----------------
  T('responsibilities', 'Who should know a seat’s price?', 'lld', 'lesson', ['bridge-interfaces', 'hld-vs-lld'],
    'Assign responsibilities to classes, hide data behind behaviour, and define interfaces around roles.',
    ['responsibilities', 'interfaces', 'abstraction', 'encapsulation'], ['posd', 'pyDataclasses'], 'Responsibilities and encapsulation'),
  T('polymorphism-composition', 'Add a new payment method without editing checkout', 'lld', 'lesson', ['responsibilities'],
    'Use polymorphism through interfaces, and prefer composition over inheritance where behaviour varies.',
    ['polymorphism', 'inheritance', 'composition'], ['gof', 'pyProtocol', 'effJava'], 'Polymorphism and composition'),
  T('cohesion-coupling', 'Why does a change to emails break pricing?', 'lld', 'lesson', ['responsibilities'],
    'Measure cohesion and coupling in a class design and refactor toward deep, focused modules.',
    ['cohesion', 'coupling'], ['posd', 'refactoring'], 'Cohesion and coupling'),
  T('solid', 'Which design rule does this class break?', 'lld', 'lesson', ['polymorphism-composition', 'cohesion-coupling'],
    'Identify violations of each SOLID principle in code and fix one with a minimal change.',
    ['SOLID'], ['refactoring', 'posd'], 'SOLID'),
  T('contracts-invariants', 'What must always be true about a booking?', 'lld', 'lesson', ['responsibilities'],
    'State preconditions, postconditions and invariants; enforce them with immutability, validation and errors.',
    ['contracts', 'invariants', 'immutability', 'validation', 'error handling'], ['pyDataclasses', 'effJava'], 'Contracts and invariants'),
  T('domain-objects', 'Is a seat number an object?', 'lld', 'lesson', ['contracts-invariants'],
    'Distinguish entities from value objects, and put persistence behind a repository interface.',
    ['entities', 'value objects', 'repositories'], ['ddd', 'poeaa'], 'Entities, value objects, repositories'),
  T('dependency-injection', 'How do you test checkout without charging a real card?', 'lld', 'lesson', ['polymorphism-composition'],
    'Explain how passing dependencies in (constructor or function arguments) lets a test swap in a fake.',
    ['dependency injection', 'test doubles'], ['pytest', 'pyMock'], 'Dependency injection'),
  T('uml', 'Can you draw the design before writing it?', 'lld', 'lesson', ['responsibilities'],
    'Read and draw UML class, sequence and state diagrams for a small design.',
    ['UML class/sequence/state diagrams'], ['gof'], 'UML diagrams'),
  T('state-machines', 'Can a refunded ticket be scanned at the door?', 'lld', 'lesson', ['uml', 'contracts-invariants'],
    'Model a resource lifecycle as an explicit state machine with guarded transitions.',
    ['state machines', 'resource lifecycle'], ['gof'], 'State machines'),
  T('testing', 'How do you know the hold expiry works?', 'lld', 'lesson', ['dependency-injection'],
    'Read and complete unit tests (arrange/act/assert), inject a fake clock, and choose between fakes, stubs and mocks.',
    ['tests', 'test doubles'], ['pytest', 'pyMock', 'refactoring'], 'Tests and test doubles'),
  T('refactoring-lesson', 'This method is 200 lines. Where do you start?', 'lld', 'lesson', ['testing', 'cohesion-coupling'],
    'Recognise code smells and choose the small behaviour-preserving refactoring (extract function, replace conditional with polymorphism) that fixes each.',
    ['refactoring'], ['refactoring'], 'Refactoring'),
  T('concurrency-lld', 'Two threads, one counter, wrong answer. Why?', 'lld', 'lesson', ['bridge-threads', 'processes-threads'],
    'Identify races, protect shared state with locks or atomics, and prevent deadlock with lock ordering.',
    ['synchronization', 'races', 'deadlocks'], ['ostepLocks', 'ostepBugs', 'pyThreading'], 'Races and deadlocks'),
  T('gof-reference', 'Design pattern reference: all 23 Gang of Four patterns', 'lld', 'pattern', ['polymorphism-composition'],
    'Recognise each Gang of Four pattern by the problem it solves and its cost.',
    ['Gang of Four patterns'], ['gof', 'headFirst'], 'Pattern reference'),
  T('pattern-strategy', 'Refactor: pricing rules keep multiplying', 'lld', 'lesson', ['gof-reference', 'solid'],
    'Recognise when a growing conditional should become a Strategy: start with a pricing function passed in, move to a class only when the rule needs state.',
    ['Strategy', 'refactoring'], ['gof', 'refactoring'], 'Strategy (refactoring)'),
  T('pattern-observer', 'Refactor: checkout knows about every notification', 'lld', 'lesson', ['gof-reference'],
    'Decouple event producers from listeners with Observer and discuss ordering and failure.',
    ['Observer', 'refactoring'], ['gof', 'headFirst'], 'Observer (refactoring)'),
  T('pattern-state', 'Refactor: a switch on status in every method', 'lld', 'lesson', ['state-machines', 'gof-reference'],
    'Move state-specific behaviour into State objects.',
    ['State', 'refactoring'], ['gof'], 'State (refactoring)'),
  T('pattern-decorator', 'Refactor: add logging and retries without editing the client', 'lld', 'lesson', ['gof-reference', 'retries'],
    'Wrap an interface with Decorators to add cross-cutting behaviour.',
    ['Decorator', 'refactoring'], ['gof'], 'Decorator (refactoring)'),
  T('pattern-factory-builder', 'Refactor: constructors with nine parameters', 'lld', 'lesson', ['gof-reference'],
    'Use Factory Method and Builder to make object creation readable and valid.',
    ['Factory Method', 'Builder', 'refactoring'], ['gof', 'pyDataclasses', 'effJavaCreate'], 'Factory and Builder (refactoring)'),
  T('pattern-adapter', 'Refactor: two payment providers, two incompatible APIs', 'lld', 'lesson', ['gof-reference'],
    'Wrap an incompatible interface with an Adapter so the domain code stays unchanged.',
    ['Adapter', 'refactoring'], ['gof'], 'Adapter (refactoring)'),
  T('pattern-command', 'Refactor: support undo for seat-map edits', 'lld', 'lesson', ['gof-reference'],
    'Represent operations as Command objects to queue, log and undo them.',
    ['Command', 'refactoring'], ['gof'], 'Command (refactoring)'),

  // ---------------- Labs ----------------
  T('lab-request-tracing', 'Lab: where did the 900 ms go?', 'labs', 'lab', ['inside-a-request', 'latency'],
    'Read a request trace and identify the span that dominates latency, then predict the effect of a fix.', ['traces', 'latency'], ['sreMonitoring'], 'Request tracing'),
  T('lab-load-balancing', 'Lab: overload and load balancing', 'labs', 'lab', ['load-balancing', 'throughput-bandwidth'],
    'Predict queueing under overload and compare balancing policies on a slow server.', ['load balancing', 'bottlenecks', 'peak load'], ['sreLbDc', 'sreOverload'], 'Overload and load balancing'),
  T('lab-cache', 'Lab: cache hit rates and stampedes', 'labs', 'lab', ['caching', 'cache-invalidation'],
    'Predict hit rate from cache size and access skew, and observe a stampede on expiry.', ['cache placement', 'eviction', 'stampedes'], ['ablCaching'], 'Cache behaviour'),
  T('lab-stale-reads', 'Lab: stale reads under replication lag', 'labs', 'lab', ['replica-lag'],
    'Measure the fraction of stale reads as lag and routing change.', ['replication', 'consistency models'], ['ddia5'], 'Stale reads'),
  T('lab-hot-spots', 'Lab: partitioning and hot spots', 'labs', 'lab', ['sharding', 'consistent-hashing'],
    'Choose a partition key and observe load per shard under a celebrity event.', ['partition keys', 'hot spots', 'rebalancing'], ['ddia6'], 'Partitioning and hot spots'),
  T('lab-queue-backlog', 'Lab: queue backlog', 'labs', 'lab', ['backpressure'],
    'Predict backlog growth and drain time when consumers fall behind.', ['queues', 'backpressure'], ['ablBacklog'], 'Queue backlog'),
  T('lab-payment-retries', 'Lab: payment retries', 'labs', 'lab', ['idempotency', 'retries'],
    'Observe duplicate charges without idempotency keys and retry storms without jitter.', ['retries', 'jitter', 'idempotency'], ['ablRetries', 'ablIdempotent'], 'Payment retries'),
  T('lab-lru', 'Lab: LRU operations', 'labs', 'lab', ['lru-cache'],
    'Predict the final state of an LRU cache after a sequence of operations.', ['eviction', 'LRU'], [], 'LRU operations'),
  T('concurrent-reservations', 'Lab: concurrent reservations', 'labs', 'lab', ['first-booking', 'transactions'],
    'Fix the double-booking race with a conditional write and test it under every interleaving.', ['races', 'locking', 'transactions'], ['ddia7', 'pgIso'], 'Concurrent reservations'),

  // ---------------- HLD cases ----------------
  ...([
    ['case-url-shortener', 'Design a URL shortener', ['api-design', 'sharding', 'caching'], ['sdi1']],
    ['case-rate-limiter', 'Design a distributed rate limiter', ['rate-limiting', 'consistency-models'], ['sdi1']],
    ['case-notifications', 'Design a notification system', ['queues', 'retries', 'idempotency'], ['sdi1']],
    ['case-chat', 'Design a chat system', ['realtime-delivery', 'clocks-ordering', 'logs-delivery'], ['sdi1']],
    ['case-feed', 'Design a social feed', ['caching', 'queues', 'sharding'], ['sdi1']],
    ['case-autocomplete', 'Design search autocomplete', ['caching', 'data-models'], ['sdi1']],
    ['case-file-sync', 'Design file storage and sync', ['data-models', 'consistency-models'], ['sdi1', 'gfs']],
    ['case-video', 'Design video streaming', ['cdn', 'batch-stream'], ['sdi1']],
    ['case-ticket-booking', 'Design ticket booking (HLD)', ['first-booking', 'transactions', 'distributed-transactions'], ['sdi2']],
    ['case-payments', 'Design a payment system', ['idempotency', 'distributed-transactions'], ['sdi2']],
    ['case-checkout', 'Design inventory and checkout', ['transactions', 'distributed-transactions'], ['sdi2']],
    ['case-ride-matching', 'Design ride matching', ['sharding', 'realtime-delivery'], ['sdi2']],
    ['case-metrics', 'Design metrics ingestion', ['batch-stream', 'data-models'], ['sdi2']],
    ['case-scheduler', 'Design a distributed job scheduler', ['consensus', 'queues'], ['primer']],
    ['case-crawler', 'Design a web crawler', ['queues', 'rate-limiting'], ['sdi1']],
    ['case-collab-editor', 'Design a collaborative editor', ['clocks-ordering', 'realtime-delivery'], ['primer']],
    ['case-live-scores', 'Design live scores with fan rooms (HLD)', ['realtime-delivery', 'logs-delivery'], ['primer']],
  ] as [string, string, string[], SourceKey[]][]).map(([id, title, pre, src]) =>
    T(id, title, 'cases-hld', 'case-hld', pre, `Work from an ambiguous prompt to a defended design: ${title.replace('Design ', '').replace(' (HLD)', '')}.`, [title], src)),

  // ---------------- LLD cases ----------------
  ...([
    ['lld-parking-lot', 'Parking lot', ['state-machines', 'polymorphism-composition']],
    ['lld-elevator', 'Elevator controller', ['state-machines', 'concurrency-lld']],
    ['lld-vending-machine', 'Vending machine', ['state-machines', 'pattern-state']],
    ['lld-library', 'Library management', ['domain-objects']],
    ['lld-expense-sharing', 'Expense sharing', ['domain-objects', 'contracts-invariants']],
    ['lld-logger', 'Logger', ['pattern-decorator', 'concurrency-lld']],
    ['lld-notifications', 'Notification service (LLD)', ['pattern-observer', 'pattern-strategy']],
    ['lld-lru', 'LRU cache (machine coding)', ['lru-cache', 'testing']],
    ['lld-rate-limiter', 'Rate limiter (LLD)', ['rate-limiting', 'concurrency-lld']],
    ['lld-scheduler', 'Task scheduler (LLD)', ['concurrency-lld', 'testing']],
    ['lld-booking', 'Seat booking (LLD)', ['first-booking', 'state-machines', 'concurrency-lld']],
    ['lld-shopping-cart', 'Shopping cart', ['domain-objects', 'pattern-strategy']],
    ['lld-board-game', 'Board game (tic-tac-toe → Connect Four)', ['polymorphism-composition', 'testing']],
    ['lld-live-scores', 'Live score event processor', ['clocks-ordering', 'idempotency', 'state-machines']],
  ] as [string, string, string[]][]).map(([id, title, pre]) =>
    T(id, `Design a ${title.charAt(0).toLowerCase() + title.slice(1)}`, 'cases-lld', 'case-lld', pre,
      `Decide responsibilities, states and invariants for ${title}; read the worked Python design and complete small checks against it.`, [title], ['gof', 'pytest'], title)),

  T('capstone', 'Capstone: an unfamiliar system with a surprise requirement', 'capstone', 'capstone', ['case-ticket-booking', 'lld-booking', 'case-notifications'],
    'Design an unfamiliar system end to end under time pressure, adapt to a surprise requirement, and compare with your first design.',
    ['requirements', 'capacity estimation', 'API contracts', 'failure reasoning'], ['sdi1', 'sdi2'], 'Capstone'),
];

const RAW_BY_ID = new Map(RAW_TOPICS.map((t) => [t.id, t]));
/** Topics not placed in the outline, or placed twice, or outline ids with no topic: reported by audit:content. */
export const OUTLINE_PROBLEMS: string[] = [];
{
  const seen = new Map<string, string>();
  for (const c of CATEGORIES) for (const u of c.units) for (const id of u.topics) {
    if (!RAW_BY_ID.has(id)) OUTLINE_PROBLEMS.push(`outline ${c.id} › ${u.id} lists unknown topic "${id}"`);
    if (seen.has(id)) OUTLINE_PROBLEMS.push(`topic "${id}" appears twice in the outline (${seen.get(id)} and ${c.id} › ${u.id})`);
    seen.set(id, `${c.id} › ${u.id}`);
  }
  for (const t of RAW_TOPICS) if (!seen.has(t.id)) OUTLINE_PROBLEMS.push(`topic "${t.id}" is not placed in the outline`);
}

/** Every topic, in outline order (the recommended route), with its category and module. */
export const TOPICS: Topic[] = CATEGORIES.flatMap((c) =>
  c.units.flatMap((u) => u.topics.filter((id) => RAW_BY_ID.has(id)).map((id) => ({ ...RAW_BY_ID.get(id)!, category: c.id, unit: u.id }))),
);

