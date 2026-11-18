import type { GenericLesson } from '../lessonTypes';
import { e, layout, n, py } from './_kit';

const LOOKUP = py('sdm/index.py', 'index_lookup');
const LSM_PUT = py('sdm/lsm.py', 'put');
const LSM_GET = py('sdm/lsm.py', 'get');

export const accessPatterns: GenericLesson = {
  id: 'access-patterns',
  area: 'Data systems',
  opening: 'Before choosing tables, list the questions the app will ask its data, and how often. “Show free seats for tonight’s show” runs a million times on sale day. “Total revenue per venue” runs once a night. They want different shapes.',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [
        n('event', 'box', 'Event', { sub: 'id, venue, starts_at' }),
        n('seat', 'box', 'Seat', { sub: 'id, event_id, row, status' }),
        n('booking', 'box', 'Booking', { sub: 'id, seat_id, buyer_id, paid' }),
        n('buyer', 'box', 'Buyer', { sub: 'id, email, name' }),
      ],
      edges: [e('event', 'seat', '1 → many'), e('seat', 'booking', '1 → 0..1'), e('buyer', 'booking', '1 → many')],
      ...layout(300, 450, {
        event: [{ x: 120, y: 80, w: 200 }, { x: 180, y: 45, w: 230 }],
        seat: [{ x: 420, y: 80, w: 230 }, { x: 180, y: 160, w: 260 }],
        booking: [{ x: 420, y: 230, w: 240 }, { x: 180, y: 285, w: 260 }],
        buyer: [{ x: 720, y: 230, w: 170 }, { x: 180, y: 405, w: 230 }],
      }),
    },
  },
  steps: [
    { kicker: 'Idea', title: 'Start with the questions', body: ['An **access pattern** is one question the app asks, how often it asks, and how fast the answer must come. For the booking app: (1) free seats for an event, a million times on sale day, under 50 ms; (2) a buyer’s bookings, often; (3) revenue per venue, nightly, can take minutes.'], view: { hide: ['seat', 'booking', 'buyer'] } },
    { kicker: 'Watch', title: 'Entities and relationships', body: ['The nouns in those questions become **entities**: Event, Seat, Booking, Buyer. The lines between them are **relationships**: one event has many seats, a seat has at most one booking, a buyer has many bookings. Together they form the **schema**: which tables and columns exist.'], view: { states: { seat: 'focus' } }, changes: [{ kind: 'add', text: 'Seat, Booking, Buyer and their relationships' }] },
    { kicker: 'Predict', title: 'Which question shapes the design most?', body: ['Each question pulls the schema a different way. The hottest one wins ties.'], view: { states: { seat: 'active', event: 'active' } },
      predict: { id: 'hot', prompt: 'Which access pattern should drive how the Seat table is organised?', choices: [
        { id: 'free', text: 'Free seats for one event: very frequent, must be fast.', why: 'Right. It runs constantly at peak, so seats should be quick to find by event and status.' },
        { id: 'rev', text: 'Revenue per venue: complex but nightly.', why: 'It can be slow, or run on a copy of the data. Don’t optimise the main tables for it.' },
      ], correct: 'free' } },
    { kicker: 'Trade-off', title: 'Write the pattern table first', body: ['Writing this table before drawing schemas saves rework. It also exposes conflicts early: a design that makes “free seats” fast may make “revenue per venue” slow, and that may be fine.'], view: {} },
  ],
  worked: { title: 'the access-pattern table', blocks: [
    { type: 'table', head: ['Question', 'Frequency (peak)', 'Latency target', 'Shape it needs'], rows: [
      ['Free seats for event E', '~1M/hour', '< 50 ms', 'Seats findable by (event_id, status)'], ['Hold seat S for buyer B', '~10k/min', '< 100 ms, exactly once', 'Single-row conditional update'], ['Bookings for buyer B', '~100k/hour', '< 200 ms', 'Bookings findable by buyer_id'], ['Revenue per venue per day', 'nightly', 'minutes OK', 'Scan or a separate analytics copy'],
    ] },
    { type: 'p', text: 'The next lessons answer the rest: whether to store the venue name once or on every booking ([Normalization](/learn/normalization)), how “findable by event_id” becomes an index ([Indexes](/learn/indexes)), and which database family fits ([Data models](/learn/data-models)).' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'A new feature shows “people who bought this also bought…”, recomputed weekly. How much should it change the main booking tables?', choices: [
    { id: 'little', text: 'Very little. Compute it offline from a copy and store the result.', why: 'Right. A rare, slow-tolerant question shouldn’t reshape the hot path.' },
    { id: 'lots', text: 'Redesign the tables around it.', why: 'It runs weekly, and the hot paths (seat lookup, holds) matter far more.' },
  ], correct: 'little' }],
  exercise: { id: 'chat', prompt: 'For a chat app, write the single most important access pattern and its latency target.', checklist: ['Names a concrete question (e.g. latest 50 messages in a conversation).', 'Gives a frequency or latency target.'], model: '“Latest 50 messages in conversation C, newest first”: runs every time someone opens a chat, so it must answer in well under 100 ms.' },
  next: { id: 'normalization', reason: 'You have entities. Next: where each fact should live, once or copied.' },
};

export const normalization: GenericLesson = {
  id: 'normalization',
  area: 'Data systems',
  opening: 'The venue renames itself from “Riverside Hall” to “Riverside Arena”. 80,000 past bookings each store the venue name. Do you update 80,000 rows, or one?',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Problem', title: 'Copies drift apart', body: ['If the venue name is stored on every booking, renaming it means updating every copy. Miss one, or crash halfway, and the data disagrees with itself. This is an **update anomaly**.'],
      compare: { left: { title: 'bookings (venue copied)', points: ['`b1 | F12 | Riverside Arena`', '`b2 | F13 | Riverside Hall` ← missed', '`b3 | G01 | Riverside Arena`'], tone: 'fail', verdict: 'two names for one venue' }, right: { title: 'Which is right?', points: ['Reports now count two venues', 'Emails show the old name to some buyers'] }, focus: 'left' } },
    { kicker: 'Fix', title: 'Normalize: store each fact once', body: ['**Normalization** puts each fact in exactly one place and refers to it by id. The venue name lives in a venues table, and bookings point at the venue’s id. Renaming changes one row.'],
      compare: { left: { title: 'venues', points: ['`v7 | Riverside Arena` ← one update'], tone: 'ok' }, right: { title: 'bookings', points: ['`b1 | F12 | v7`', '`b2 | F13 | v7`', '`b3 | G01 | v7`'], tone: 'ok', verdict: 'always consistent' } },
      changes: [{ kind: 'chg', text: 'Venue name moved to its own table' }] },
    { kicker: 'Trade-off', title: 'Now reads need a JOIN', body: ['Showing a booking with its venue name now joins two tables. That’s usually cheap with an index. For a page shown 10,000 times a second, the extra lookup can add up.'],
      compare: { left: { title: 'Normalized read', points: ['`SELECT b.seat, v.name FROM bookings b JOIN venues v ON v.id = b.venue_id WHERE b.id = $1`', 'two lookups'] }, right: { title: 'Denormalized read', points: ['`SELECT seat, venue_name FROM bookings WHERE id = $1`', 'one lookup'] } } },
    { kicker: 'Predict', title: 'When copying is the right call', body: ['**Denormalization** deliberately copies a fact to make a read faster, accepting the work of keeping copies in sync.'],
      compare: { left: { title: 'Normalized', points: ['One source of truth', 'Reads join'] }, right: { title: 'Denormalized', points: ['Fast single-row reads', 'Writes must update copies'] } },
      predict: { id: 'when', prompt: 'A ticket PDF shows the venue name *as it was when the ticket was sold*, even if the venue is renamed later. Normalize or copy?', choices: [
        { id: 'copy', text: 'Copy the name onto the ticket at sale time.', why: 'Right. Here the copy isn’t a stale duplicate: it’s a historical fact about the sale, and it should never change.' },
        { id: 'norm', text: 'Reference the venue id.', why: 'Then old tickets would show the new name, which is wrong for a record of what was sold.' },
      ], correct: 'copy' } },
  ],
  worked: { title: 'normalize first, then denormalize on purpose', blocks: [
    { type: 'list', items: ['Start normalized: each fact once, related by ids. It’s the safest default.', 'Measure. If one read path is too slow or too expensive, denormalize *that* path. Store a copy, or a precomputed result (a “read model”).', 'Write down who updates the copy and how stale it may be. That decision is now a consistency rule you own.'], ordered: true },
    { type: 'p', text: 'Document databases often store related data together (a booking with its seat and venue embedded). That’s denormalization by default, which is great when you always read them together and painful when shared facts change.' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Each booking row stores the buyer’s email. A buyer changes their email. What problem appears?', choices: [
    { id: 'anom', text: 'Every one of their booking rows must be updated, or some show the old email.', why: 'Right: an update anomaly. Storing buyer_id and keeping the email in buyers avoids it.' },
    { id: 'none', text: 'None. Emails rarely change.', why: 'Rare changes still happen, and when they do, the copies disagree.' },
  ], correct: 'anom' }],
  exercise: { id: 'feed', prompt: 'A social feed shows each post with its author’s name and photo, read 50,000 times a second. Would you denormalize, and what would you have to handle?', checklist: ['Decides (e.g. copy name/photo into a feed read model).', 'Names how copies stay fresh when an author changes their name or photo.'], model: 'Yes: store author name and photo in the precomputed feed entries so a feed read is one lookup; when an author updates their profile, a background job rewrites (or lazily refreshes) their entries, accepting a short window of staleness.' },
  next: { id: 'indexes', reason: 'Normalized tables are queried by ids and joins. Next: how the database finds rows fast.' },
};

export const indexes: GenericLesson = {
  id: 'indexes',
  area: 'Data systems',
  opening: '“Find the buyer with email maya@example.com” takes 2 seconds on 10 million buyers. Add one line of SQL and the same query takes 2 milliseconds. What did that line build?',
  visual: { kind: 'chart', xLabel: 'rows in table (millions)', yLabel: 'rows examined (or index steps)', note: 'The index line looks flat because it needs about 20–27 steps while a scan examines millions of rows.' },
  experiment: {
    step: 3, label: 'Rows in table', min: 1, max: 100, stepSize: 1, initial: 10, unit: 'million',
    compute: (m) => {
      const rows = m * 1_000_000;
      const steps = Math.ceil(Math.log2(rows));
      return { text: `Full scan: up to **${rows.toLocaleString()} rows** examined. Index (binary search over sorted emails): about **${steps} steps**. Grow the table 10× and the index needs only ~3 more steps.`, chart: { series: [{ name: 'full scan', points: [1, 25, 50, 75, 100].map((x) => [x, x * 1_000_000] as [number, number]), tone: 'fail' }, { name: 'index', points: [1, 25, 50, 75, 100].map((x) => [x, Math.log2(x * 1e6)] as [number, number]), tone: 'ok' }], marks: [{ x: m, y: rows, label: `${m}M rows scanned` }] } };
    },
    assumptions: ['Looking up one row by an exact value. Index steps counted as binary-search comparisons; real B-tree indexes use wide pages, so they need even fewer disk reads (typically 3–4).'],
  },
  steps: [
    { kicker: 'Problem', title: 'Without help, it checks every row', body: ['With no index on `email`, the database must read every row and compare: a **full table scan**. On 10 million rows that’s 10 million comparisons, much of it read from disk.'], chart: { series: [{ name: 'full scan', points: [1, 25, 50, 75, 100].map((x) => [x, x * 1_000_000] as [number, number]), tone: 'fail' }] } },
    { kicker: 'Idea', title: 'An index is a sorted lookup structure', body: ['`CREATE INDEX buyers_email ON buyers (email);` builds a separate structure holding every email **in sorted order**, each pointing to its row. In sorted data, each comparison halves what’s left to search.'], chart: { series: [{ name: 'full scan', points: [1, 25, 50, 75, 100].map((x) => [x, x * 1_000_000] as [number, number]), tone: 'fail' }, { name: 'index', points: [1, 25, 50, 75, 100].map((x) => [x, Math.log2(x * 1e6)] as [number, number]), tone: 'ok' }] }, code: { code: LOOKUP, caption: 'python/sdm/index.py — binary search over a sorted index; real databases use B-trees, the same idea in wide pages' }, changes: [{ kind: 'add', text: 'Index on buyers(email)' }] },
    { kicker: 'Predict', title: 'Reading the query plan', body: ['`EXPLAIN` shows how the database plans to run a query. Before the index it says *Seq Scan* (read everything). After, *Index Scan* (jump to matching rows).'], chart: { series: [{ name: 'index', points: [1, 25, 50, 75, 100].map((x) => [x, Math.log2(x * 1e6)] as [number, number]), tone: 'ok' }] },
      predict: { id: 'write', prompt: 'You add indexes on 6 columns of the bookings table. What happens to inserting a booking?', choices: [
        { id: 'slower', text: 'It gets slower: every insert also updates 6 indexes.', why: 'Right. Indexes speed up reads they match and slow down every write. Add the ones your access patterns need.' },
        { id: 'same', text: 'Nothing changes. Indexes only affect reads.', why: 'Every index is a structure that has to be updated on each insert, update and delete.' },
        { id: 'faster', text: 'It gets faster.', why: 'Indexes add write work. They never remove it.' },
      ], correct: 'slower' } },
    { kicker: 'Try it', title: 'Grow the table', body: ['Drag the table size. The scan grows in a straight line. The index barely moves.'] },
  ],
  worked: { title: 'an index that matches the access pattern', blocks: [
    { type: 'code', lang: 'sql', code: "-- Hot query: free seats for one event\nSELECT id FROM seats WHERE event_id = 9031 AND status = 'free';\n\n-- An index whose leading column matches the equality filter\nCREATE INDEX seats_event_status ON seats (event_id, status);" },
    { type: 'code', lang: 'text', code: "Before:  Seq Scan on seats  (rows examined: 4,000,000)\n           Filter: event_id = 9031 AND status = 'free'\nAfter:   Index Scan using seats_event_status on seats  (rows examined: 1,214)\n           Index Cond: event_id = 9031 AND status = 'free'", caption: 'Illustrative EXPLAIN output (simplified; exact format differs by database). Read the plan type and the rows examined.' },
    { type: 'p', text: 'Column order matters: an index on `(event_id, status)` helps queries filtering by `event_id` alone, but not queries filtering only by `status`, just as a phone book sorted by surname then first name can’t find everyone named “Maya” quickly.' },
  ] },
  checks: [
    { kind: 'choice', id: 'order', prompt: 'You have an index on `(event_id, status)`. Which query can use it well?', choices: [
      { id: 'a', text: '`WHERE event_id = 9031`', why: 'Right. The index is sorted by event_id first.' },
      { id: 'b', text: '`WHERE status = \'free\'` (all events)', why: 'Status is the second column; free seats are scattered across every event’s section of the index.' },
    ], correct: 'a' },
    { kind: 'numeric', id: 'steps', prompt: 'About how many binary-search steps does it take to find one email among 1,000,000 sorted emails?', answer: 20, tolerance: 0.1, unit: 'steps', solution: ['Each step halves the range', '2²⁰ ≈ 1,048,576 ≥ 1,000,000', 'so about 20 steps'] },
  ],
  exercise: { id: 'which', prompt: 'The “bookings for buyer B” page is slow. What index would you add, and what does it cost?', checklist: ['Index on bookings(buyer_id) (optionally plus created_at for ordering).', 'Notes extra write cost and storage.'], model: 'An index on bookings(buyer_id, created_at) turns the lookup into an index scan returning that buyer’s bookings already in date order; the cost is slightly slower booking inserts and extra disk for the index.' },
  next: { id: 'data-models', reason: 'Indexes make one kind of database fast. Next: other kinds of database, and when each fits.' },
};

export const dataModels: GenericLesson = {
  id: 'data-models',
  area: 'Data systems',
  opening: 'Seats and bookings fit neatly in tables. But the “fans also follow” graph, full-text venue search, per-second ticket sales charts and PDF tickets don’t. Different shapes of data have databases built for them.',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Idea', title: 'Relational vs document', body: ['**Relational** databases store tables with a fixed schema and join them. They’re strong at transactions and ad hoc queries. **Document** databases store self-contained JSON-like documents, which suits data you read and write as one unit.'],
      compare: { left: { title: 'Relational (e.g. PostgreSQL)', points: ['Seats, bookings, payments', 'Transactions across rows', 'Any query via SQL + indexes'], tone: 'ok' }, right: { title: 'Document (e.g. MongoDB)', points: ['An event page: event + lineup + FAQ in one document', 'Flexible fields', 'Joins are weak or manual'], tone: 'ok' } } },
    { kicker: 'Idea', title: 'Key-value vs wide-column', body: ['**Key-value** stores do one thing fast: get and set a value by key. **Wide-column** stores (Bigtable-style) organise rows by a key and spread them across many machines, which suits huge, write-heavy data read by key ranges.'],
      compare: { left: { title: 'Key-value (e.g. Redis, DynamoDB)', points: ['Sessions, carts, rate-limit counters', 'Sub-millisecond by key', 'No queries beyond the key'], tone: 'ok' }, right: { title: 'Wide-column (e.g. Cassandra, Bigtable)', points: ['Sensor readings per device per time', 'Massive write throughput', 'Design rows around the read pattern'], tone: 'ok' } } },
    { kicker: 'Idea', title: 'Graph vs search', body: ['**Graph** databases store things and the links between them, so walking links (“friends of friends who like jazz”) is natural. **Search** engines build inverted indexes over text: “riverside jaz” finds “Riverside Jazz Night”, ranked by relevance.'],
      compare: { left: { title: 'Graph (e.g. Neo4j)', points: ['“Fans who follow X also follow…”', 'Multi-hop relationship queries'], tone: 'ok' }, right: { title: 'Search (e.g. Elasticsearch, OpenSearch)', points: ['Venue and artist search', 'Typos, ranking, filters'], tone: 'ok' } } },
    { kicker: 'Predict', title: 'Time-series and object storage', body: ['**Time-series** databases store measurements stamped with time and are built for “average per minute over the last hour”. **Object storage** (S3-style) stores large files cheaply by name.'],
      compare: { left: { title: 'Time-series (e.g. Prometheus, TimescaleDB)', points: ['Ticket sales per second', 'Server metrics', 'Downsampling, time windows'], tone: 'ok' }, right: { title: 'Object storage (e.g. S3, GCS)', points: ['PDF tickets, venue photos, backups', 'Cheap, durable, big files', 'Not for queries or small hot records'], tone: 'ok' } },
      predict: { id: 'pdf', prompt: 'Each ticket has a 200 KB PDF. Where should the PDFs live?', choices: [
        { id: 'obj', text: 'Object storage, with the booking row holding its key.', why: 'Right. Big immutable files are cheap and durable there; the database keeps a small pointer.' },
        { id: 'sql', text: 'In a column of the bookings table.', why: 'It works, but bloats the database (600 GB a month at 3M bookings), slows backups, and wastes expensive storage.' },
      ], correct: 'obj' } },
  ],
  worked: { title: 'one system, several stores', blocks: [
    { type: 'table', head: ['Data', 'Store', 'Why'], rows: [['Seats, holds, bookings, payments', 'Relational', 'Transactions and conditional updates'], ['Sessions, rate-limit counters', 'Key-value', 'Fast by key, expiring entries'], ['Artist and venue search', 'Search engine', 'Text relevance, typos'], ['Sales per second, metrics', 'Time-series', 'Time windows and aggregation'], ['Ticket PDFs, images', 'Object storage', 'Big files, cheap and durable']] },
    { type: 'callout', tone: 'warn', title: 'The cost of more stores', text: 'Each extra database is another system to run, back up, secure and keep in sync. Start with one relational database. Add another store when a specific access pattern needs it, and copy data into it from the source of truth.' },
  ] },
  checks: [
    { kind: 'choice', id: 'q1', prompt: 'You need “how many tickets sold per minute over the last 24 hours”, updated live. Best fit?', choices: [
      { id: 'ts', text: 'Time-series database', why: 'Right. It’s built for timestamped measurements and windowed aggregates.' },
      { id: 'kv', text: 'Key-value store', why: 'You’d have to build all the time-window logic yourself.' },
      { id: 'graph', text: 'Graph database', why: 'There are no relationships to traverse here, just measurements over time.' },
    ], correct: 'ts' },
    { kind: 'choice', id: 'q2', prompt: 'Holding a seat must check it’s free and mark it held atomically. Which store do you trust with that first?', choices: [
      { id: 'rel', text: 'The relational database with a conditional update', why: 'Right. Transactions and conditional writes are what relational databases are best at.' },
      { id: 'search', text: 'The search engine', why: 'Search indexes are usually updated asynchronously and aren’t a source of truth for exact state.' },
    ], correct: 'rel' },
  ],
  exercise: { id: 'pick', prompt: 'A ride-sharing app stores driver locations every 3 seconds and asks “drivers within 2 km of me”. What kind of store would you consider, and why?', checklist: ['Names a fitting store (key-value/in-memory with geo index, or a database with geospatial indexing).', 'Ties it to the access pattern (frequent writes, nearby queries, freshness over history).'], model: 'An in-memory key-value store with geospatial indexing (or a database with a geo index): locations are overwritten constantly, only the latest matters, and the query is “nearby”, which a geo index answers quickly.' },
  next: { id: 'storage-engines', reason: 'Every one of these stores writes to disk somehow. Next: how a database survives a crash mid-write.' },
};

export const storageEngines: GenericLesson = {
  id: 'storage-engines',
  area: 'Data systems',
  opening: 'The power fails 3 ms after the database said “saved”. When it restarts, Maya’s booking must still be there, and it must never be half-written. How does a database make that promise with ordinary disks?',
  visual: {
    kind: 'stack',
    layers: [
      { id: 'mem', label: 'Memtable (memory)', detail: 'recent writes, sorted' },
      { id: 'wal', label: 'Write-ahead log (disk)', detail: 'every write appended first' },
      { id: 'l0', label: 'Sorted run 1 (disk)', detail: 'F12=free  F13=free' },
      { id: 'l1', label: 'Sorted run 2 (disk)', detail: 'F12=held  F14=free' },
    ],
  },
  steps: [
    { kicker: 'Idea', title: 'Write it to a log first', body: ['Before changing anything, the database appends the change to a **write-ahead log (WAL)** on disk. Appending to the end of a file is fast, and once it’s there, a crash can’t lose it: on restart the database replays the log.'], stack: { ghost: ['mem', 'l0', 'l1'], focus: 'wal', tones: { wal: 'active' } }, code: { code: LSM_PUT, highlight: [2], caption: 'python/sdm/lsm.py — step 1: append to the log' } },
    { kicker: 'Watch', title: 'Keep recent writes in memory', body: ['The write also goes into a sorted in-memory table, the **memtable**, so reads see it immediately. The WAL is for durability. The memtable is for speed.'], stack: { ghost: ['l0', 'l1'], focus: 'mem', tones: { wal: 'ok', mem: 'active' } }, changes: [{ kind: 'add', text: 'Memtable: F12 = held' }] },
    { kicker: 'Watch', title: 'Flush full memtables as sorted runs', body: ['When the memtable fills, it’s written to disk as an immutable **sorted run** (an SSTable), and the log can be trimmed. Over time several runs pile up, newest on top. This design is a **log-structured merge tree (LSM tree)**.'], stack: { focus: 'l1', separation: 0.8, tones: { l1: 'active' } } },
    { kicker: 'Predict', title: 'Reading means checking newest first', body: ['F12 appears in two runs: “free” in the older one, “held” in the newer one.'], stack: { separation: 0.8, tones: { l1: 'ok', l0: 'fail' } }, code: { code: LSM_GET, highlight: [4, 5], caption: 'python/sdm/lsm.py — search newest to oldest' },
      predict: { id: 'read', prompt: 'A read for F12 checks the memtable (empty), then the runs. What does it return?', choices: [
        { id: 'held', text: '“held”, from the newest run', why: 'Right. Newer runs win. The old “free” is now garbage.' },
        { id: 'free', text: '“free”, from the first run written', why: 'Runs are checked newest first, so later writes override earlier ones.' },
      ], correct: 'held' } },
    { kicker: 'Trade-off', title: 'Compaction tidies up', body: ['Many runs mean slow reads and stale values taking space. **Compaction** merges runs in the background, keeping only the newest value per key. LSM trees make writes cheap (always append) and pay later in compaction work and in reads that may check several runs.'], stack: { separation: 0.3, tones: { l0: 'ok', l1: 'ok' }, details: { l0: 'merged: F12=held F13=free F14=free' }, ghost: ['l1'] } },
  ],
  worked: { title: 'LSM trees vs B-trees', blocks: [
    { type: 'table', head: ['', 'LSM tree (e.g. RocksDB, Cassandra)', 'B-tree (e.g. PostgreSQL, MySQL InnoDB)'], rows: [['Write', 'Append to log + memtable; flush sequentially', 'Find the page, update it in place (plus WAL)'], ['Read', 'Check memtable, then possibly several runs (helped by Bloom filters)', 'Walk 3–4 pages from root to leaf'], ['Background work', 'Compaction', 'Page splits, vacuum'], ['Shines at', 'Very high write rates', 'Reads and range scans with steady latency']] },
    { type: 'p', text: 'Both use a write-ahead log for crash safety. The difference is what happens after: a B-tree keeps one sorted structure updated in place, while an LSM tree keeps writing new sorted files and merges them later.' },
    { type: 'code', lang: 'python', code: py('sdm/lsm.py'), caption: 'python/sdm/lsm.py — the write path in 30 lines (no files), tested with pytest' },
  ] },
  checks: [
    { kind: 'order', id: 'path', prompt: 'Put an LSM tree’s write path in order.', items: ['Append the change to the write-ahead log', 'Insert into the in-memory memtable', 'When the memtable is full, write it out as a sorted run', 'Later, compaction merges runs'], explain: 'Durability first (log), then visibility (memtable), then persistence in sorted form (flush), then cleanup (compaction).' },
    { kind: 'choice', id: 'crash', prompt: 'The power fails after a write reached the WAL but before the memtable was flushed. After restart?', choices: [
      { id: 'safe', text: 'The write is recovered by replaying the log.', why: 'Right. That’s the whole point of writing the log first.' },
      { id: 'lost', text: 'The write is lost because memory was wiped.', why: 'Memory was wiped, but the log on disk still has it, and replay rebuilds the memtable.' },
    ], correct: 'safe' },
  ],
  exercise: { id: 'choose', prompt: 'A metrics system writes 500,000 data points a second and reads them rarely. LSM-based or B-tree-based storage, and why?', checklist: ['Chooses LSM.', 'Explains sequential appends handle high write rates; reads are rare so their extra cost is acceptable.'], model: 'LSM: writes are just appends to a log and memtable, flushed sequentially, which sustains huge write rates; reads are rare, so checking a few runs (and compaction) is an acceptable cost.' },
  next: { id: 'transactions', reason: 'Durability covers one write. Next: keeping several writes correct when they happen together.' },
};

export const DATA1 = [accessPatterns, normalization, indexes, dataModels, storageEngines];
