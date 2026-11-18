import type { GenericLesson } from '../lessonTypes';
import { e, layout, n, py } from './_kit';

const RING = py('sdm/partitioning.py').split('\n\n\ndef moved_fraction')[0].split('\n\n\nclass Ring')[1];

export const transactions: GenericLesson = {
  id: 'transactions',
  area: 'Data systems',
  opening: 'Maya and her partner share a ticket wallet with €100. At the same moment, Maya buys an €80 ticket and her partner buys a €70 one. Each app checked “is there enough?” and saw €100. The wallet ends at −€50. Transactions exist to make this impossible.',
  visual: { kind: 'timeline', unit: 'ms', lanes: [{ id: 'a', label: 'Maya’s purchase' }, { id: 'b', label: 'Partner’s purchase' }, { id: 'w', label: 'wallet' }], events: [
    { t: 0, lane: 'a', label: 'read 100' },
    { t: 2, lane: 'b', label: 'read 100', tone: 'active' },
    { t: 4, lane: 'a', label: 'write 20', to: { lane: 'w', t: 4.5 } },
    { t: 5, lane: 'w', label: '20' },
    { t: 6, lane: 'b', label: 'write 30', tone: 'fail', to: { lane: 'w', t: 6.5 } },
    { t: 7, lane: 'w', label: '30 (should be −50!)', tone: 'fail' },
  ] },
  steps: [
    { kicker: 'Idea', title: 'Several steps that must act as one', body: ['A **transaction** groups reads and writes so the database treats them as one unit. Two promises matter here: **atomicity** (all of it happens or none of it does) and **isolation** (concurrent transactions don’t see each other’s half-finished work).'], timeline: { upTo: 0 } },
    { kicker: 'Watch', title: 'Both read before either writes', body: ['Maya’s purchase reads €100. Two milliseconds later her partner’s purchase reads €100 too. Both checks pass.'], timeline: { upTo: 2 } },
    { kicker: 'Predict', title: 'Now both write', body: ['Each writes “balance minus my price”, computed from the €100 it read.'], timeline: { upTo: 2 },
      predict: { id: 'end', prompt: 'Maya writes 100 − 80 = 20, then her partner writes 100 − 70 = 30. What does the wallet hold, and what went wrong?', choices: [
        { id: 'lost', text: '€30. Maya’s write was overwritten, so €150 of tickets cost €70 (a lost update).', why: 'Right. The second write was computed from a stale read. One purchase vanished from the balance.' },
        { id: 'neg', text: '−€50, correctly reflecting both purchases.', why: 'That’s what *should* have happened (and then been refused). Each write ignored the other.' },
      ], correct: 'lost' } },
    { kicker: 'Failure', title: 'Two anomalies at once', body: ['This interleaving shows a **lost update** (Maya’s change overwritten) and broke an **invariant**: two purchases worth €150 were approved against €100. The database did exactly what each statement asked. Nothing told it the read and the write belonged together.'], timeline: { upTo: 6 }, changes: [{ kind: 'del', text: 'Wallet says €30 after €150 of purchases' }] },
    { kicker: 'Fix', title: 'Make the check part of the write', body: ['Option 1: one atomic statement, `UPDATE wallets SET balance = balance - 80 WHERE id = 7 AND balance >= 80`. If it changes 0 rows, refuse the purchase. Option 2: a transaction at a stronger **isolation level**, or a lock on the wallet row (`SELECT … FOR UPDATE`), so the second purchase waits for the first.'], timeline: { upTo: 6, focus: 0 } },
  ],
  worked: { title: 'isolation anomalies, side by side', blocks: [
    { type: 'table', head: ['Anomaly', 'What happens', 'Booking example'], rows: [['Dirty read', 'Read another transaction’s uncommitted write', 'See a hold that is later rolled back'], ['Lost update', 'Two read-modify-writes; one overwrites the other', 'Wallet balance above'], ['Non-repeatable read', 'Same row read twice gives different values', 'Price changes mid-checkout'], ['Write skew', 'Two transactions read overlapping data, write different rows, and together break a rule', 'Two managers each remove themselves from an on-call rota, leaving nobody'], ['Phantom', 'A re-run query returns new rows', '“Count free seats” changes during a transaction']] },
    { type: 'p', text: 'Databases offer isolation levels (read committed, repeatable read/snapshot, serializable) that prevent progressively more of these, at increasing cost in waiting or aborted transactions. Check what your database’s default actually prevents. Defaults differ, and names don’t always mean the same thing across databases.' },
    { type: 'code', lang: 'sql', code: "BEGIN;\nSELECT balance FROM wallets WHERE id = 7 FOR UPDATE;  -- locks the row until COMMIT\n-- application checks balance >= 80\nUPDATE wallets SET balance = balance - 80 WHERE id = 7;\nINSERT INTO purchases (wallet_id, amount) VALUES (7, 80);\nCOMMIT;  -- both changes become visible together, or neither does" },
  ] },
  checks: [
    { kind: 'choice', id: 'atomic', prompt: 'A purchase debits the wallet and then inserts a ticket row. The server crashes between the two. With a transaction, what does the database contain after restart?', choices: [
      { id: 'neither', text: 'Neither change.', why: 'Right. Atomicity: an uncommitted transaction is rolled back entirely.' },
      { id: 'debit', text: 'The debit but no ticket.', why: 'That’s exactly what atomicity prevents.' },
    ], correct: 'neither' },
    { kind: 'line', id: 'gap', prompt: 'Which line makes this purchase unsafe under concurrency? (`db` runs each statement separately, with no transaction.)', code: 'def buy(db, wallet_id, price):\n    balance = db.query("SELECT balance FROM wallets WHERE id = %s", wallet_id)\n    if balance < price:\n        return "insufficient"\n    db.execute("UPDATE wallets SET balance = %s WHERE id = %s", balance - price, wallet_id)\n    return "ok"', answer: [5], explain: 'It writes a value computed from an earlier read. Another purchase can change the balance in between. Writing `balance = balance - %s ... AND balance >= %s` makes the check and the change one step.', wrong: { 2: 'Reading is fine on its own. The danger is writing a value computed from it later.', 3: 'The check is right, but stale by the time line 5 runs.' } },
  ],
  exercise: { id: 'which', prompt: 'For the shared wallet, would you use a conditional UPDATE or SELECT … FOR UPDATE? One or two sentences.', checklist: ['Picks one with a reason.', 'Mentions the cost (waiting on a lock, or extra logic for 0-rows-updated).'], model: 'A conditional UPDATE (`... WHERE balance >= price`): one round trip, no lock held while the app thinks, and “0 rows changed” cleanly means “insufficient funds”. FOR UPDATE is better when the check needs several reads.' },
  next: { id: 'locking-mvcc', reason: 'Isolation has to be implemented somehow. Next: locks, optimistic checks, and multi-version snapshots.' },
};

export const lockingMvcc: GenericLesson = {
  id: 'locking-mvcc',
  area: 'Data systems',
  opening: 'A nightly report reads every booking for 10 minutes. Meanwhile, buyers keep booking. Should the report block every booking until it finishes? Should bookings break the report? Databases have three main answers.',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Idea', title: 'Pessimistic locking: wait your turn', body: ['A **lock** stops others from changing (or sometimes reading) a row until you’re done. It’s safe and simple, but whoever arrives second waits, and two transactions waiting on each other’s locks are **deadlocked**. The database detects that and aborts one of them.'],
      compare: { left: { title: 'Locking', points: ['`SELECT … FOR UPDATE` locks the wallet row', 'Partner’s purchase waits ~5 ms', 'No lost update'], tone: 'ok', verdict: 'correct, may wait' }, right: { title: 'Cost', points: ['Long transactions block others', 'Deadlocks possible'] } } },
    { kicker: 'Idea', title: 'Optimistic concurrency: check at the end', body: ['Assume conflicts are rare. Read a row with its **version number**, and when writing say “only if the version is still 7”. If someone changed it meanwhile, nothing is written and you retry.'],
      compare: { left: { title: 'Optimistic', points: ['Read balance = 100, version 7', '`UPDATE … SET balance = 20, version = 8 WHERE id = 7 AND version = 7`', 'Second writer: 0 rows → retry with fresh data'], tone: 'ok', verdict: 'no waiting, may retry' }, right: { title: 'Cost', points: ['Wasted work on conflict', 'Bad fit when many writers hit one row'] } } },
    { kicker: 'Idea', title: 'MVCC: readers get a snapshot', body: ['**Multi-version concurrency control** keeps old versions of rows. Each transaction reads a consistent **snapshot** as of when it started, while writers create new versions. Readers don’t block writers and writers don’t block readers.'],
      compare: { left: { title: 'Report (started 02:00)', points: ['Sees every booking as of 02:00', 'Never blocked', 'Never sees half of a later purchase'], tone: 'ok' }, right: { title: 'Bookings during the report', points: ['Create new row versions', 'Never wait for the report', 'Old versions cleaned up later (vacuum)'], tone: 'ok' } } },
    { kicker: 'Predict', title: 'Pick for a hot row', body: ['On sale day, 5,000 buyers a second try to decrement one row: “seats remaining for section A”.'],
      compare: { left: { title: 'Optimistic', points: ['Most writers find the version changed', 'Retry storms'] }, right: { title: 'Short lock / atomic update', points: ['`UPDATE … SET remaining = remaining - 1 WHERE remaining > 0`', 'Writers queue briefly'] } },
      predict: { id: 'hot', prompt: 'Which works better for this one heavily contended row?', choices: [
        { id: 'atomic', text: 'An atomic conditional update (a very short lock held inside the database).', why: 'Right. With heavy contention, optimistic retries waste most attempts. A short in-database update serialises cheaply. Even better: avoid one hot row by holding individual seats.' },
        { id: 'opt', text: 'Optimistic concurrency with retries.', why: 'When conflicts are the norm, most attempts fail and retry, multiplying load.' },
      ], correct: 'atomic' } },
  ],
  worked: { title: 'choosing between them', blocks: [
    { type: 'table', head: ['', 'Pessimistic lock', 'Optimistic (version check)', 'MVCC snapshot'], rows: [['Best when', 'Conflicts are likely and short', 'Conflicts are rare', 'Long reads alongside writes'], ['On conflict', 'Wait', 'Retry', 'Readers unaffected; write conflicts still need locks or checks'], ['Risk', 'Deadlocks, blocking', 'Retry storms under contention', 'Old versions pile up; write skew under snapshot isolation']] },
    { type: 'p', text: 'This site uses optimistic concurrency for your saved progress: each record carries the revision it was based on, and the server refuses a stale write. It then keeps both versions of a draft instead of retrying blindly. MVCC itself is how PostgreSQL and many others implement snapshot isolation.' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Two transactions each lock row A, then try to lock row B, in opposite orders. What happens?', choices: [
    { id: 'dead', text: 'Deadlock: each waits for the other, and the database aborts one.', why: 'Right. Locking rows in a consistent order (say, by id) prevents this.' },
    { id: 'fine', text: 'They take turns automatically.', why: 'Each holds what the other needs, so neither can proceed without outside help.' },
  ], correct: 'dead' }],
  exercise: { id: 'profile', prompt: 'Users rarely edit their profile from two devices at once. Locking or optimistic concurrency for profile edits, and why?', checklist: ['Chooses optimistic.', 'Notes conflicts are rare, so retries are rare and nobody waits.'], model: 'Optimistic: concurrent edits of one profile are rare, so a version check almost never fails, and when it does we can show both versions instead of making anyone wait on a lock.' },
  next: { id: 'replica-lag', reason: 'Concurrency inside one database is covered. Next: what happens when there are copies of it.' },
};

export const failover: GenericLesson = {
  id: 'failover',
  area: 'Data systems',
  opening: 'At 14:00:00 the leader database’s disk controller dies. Reads keep working from the follower, but every booking fails. How long until bookings work again, and could any confirmed booking disappear?',
  visual: { kind: 'timeline', unit: 's', lanes: [{ id: 'l', label: 'Old leader' }, { id: 'f', label: 'Follower' }, { id: 'app', label: 'App' }], events: [
    { t: 0, lane: 'l', label: 'write #1041 confirmed', tone: 'ok' },
    { t: 0.5, lane: 'l', label: 'dies', tone: 'fail' },
    { t: 1, lane: 'f', label: 'has up to #1040', tone: 'active' },
    { t: 10, lane: 'f', label: 'no heartbeat for 10 s', tone: 'active' },
    { t: 12, lane: 'f', label: 'promoted to leader', tone: 'ok' },
    { t: 14, lane: 'app', label: 'writes resume', tone: 'ok', to: { lane: 'f', t: 14.5 } },
  ] },
  steps: [
    { kicker: 'Problem', title: 'Followers keep reads alive, not writes', body: ['With asynchronous replication, the leader confirms a write and ships it to the follower a moment later. Then the leader dies. Reads still work from the follower. Writes have nowhere to go.'], timeline: { upTo: 2 } },
    { kicker: 'Watch', title: 'Detect the failure', body: ['How does anything know the leader is dead and not just slow? Usually the follower expects a **heartbeat** every second. Miss them for a timeout, here 10 s, and it’s declared dead. Too short a timeout causes false alarms. Too long means a longer outage.'], timeline: { upTo: 4 } },
    { kicker: 'Watch', title: 'Promote the follower', body: ['**Failover**: the most up-to-date follower is promoted to leader, and the app is pointed at it. Writes resume about 14 s after the crash. Managed databases automate these steps.'], timeline: { upTo: 6 }, changes: [{ kind: 'chg', text: 'Follower → leader at 12 s' }, { kind: 'add', text: 'Writes resume at 14 s' }] },
    { kicker: 'Predict', title: 'What happened to booking #1041?', body: ['The old leader confirmed #1041 at 0 s, but the follower only had up to #1040 when it was promoted.'], timeline: { upTo: 6, focus: 0 },
      predict: { id: 'lost', prompt: 'Booking #1041 was confirmed to the buyer. Is it in the new leader?', choices: [
        { id: 'no', text: 'No. It never reached the follower, so it’s lost.', why: 'Right. Asynchronous replication trades a small data-loss window for speed. The buyer holds a confirmation the system no longer has.' },
        { id: 'yes', text: 'Yes. Confirmed writes are always safe.', why: 'Only if the write was on durable storage that survives, or replicated before confirming. Here it was only on the dead leader.' },
      ], correct: 'no' } },
    { kicker: 'Failure', title: 'The worst case: split brain', body: ['What if the old leader wasn’t dead, just cut off from the network? When it comes back it may still think it’s the leader. Now two leaders accept writes, and the copies diverge. Preventing this needs fencing (shutting the old leader out) and a majority vote on who leads. That’s what [consensus](/learn/consensus) provides.'], timeline: { upTo: 6 } },
  ],
  worked: { title: 'how much can you lose, and how long are you down?', blocks: [
    { type: 'table', head: ['Replication', 'Data lost on leader crash', 'Write latency'], rows: [['Asynchronous', 'Writes not yet shipped (usually milliseconds, sometimes more)', 'Fast: no waiting'], ['Synchronous to one follower', 'None, if that follower survives', 'Slower: wait for the follower’s acknowledgement'], ['Semi-synchronous (one sync, others async)', 'None if the sync follower survives', 'One extra round trip']] },
    { type: 'formula', title: 'Outage length for writes', assumptions: ['Heartbeat timeout: 10 s', 'Promotion: 2 s', 'Clients reconnect: 2 s'], steps: ['10 + 2 + 2 = 14 s'], result: '≈ 14 seconds without writes', changed: 'Halve the timeout to 5 s and the outage drops to ≈ 9 s, but a 6-second network blip would now trigger an unnecessary failover.' },
  ] },
  checks: [
    { kind: 'choice', id: 'q1', prompt: 'To guarantee no confirmed booking is lost when the leader dies, what must happen before confirming?', choices: [
      { id: 'sync', text: 'The write reaches at least one follower (synchronous replication).', why: 'Right. Then a surviving copy has it, at the cost of waiting for the follower on every write.' },
      { id: 'faster', text: 'Use a faster disk on the leader.', why: 'A faster disk doesn’t help if the whole leader machine is lost.' },
    ], correct: 'sync' },
    { kind: 'numeric', id: 'out', prompt: 'Heartbeat timeout 30 s, promotion 5 s, client reconnection 5 s. How long are writes unavailable?', answer: 40, tolerance: 0.01, unit: 's', solution: ['30 + 5 + 5 = 40 s'] },
  ],
  exercise: { id: 'pay', prompt: 'For confirmed payments, would you accept asynchronous replication? One or two sentences.', checklist: ['Says no (or only with mitigation) because confirmed payments must not be lost.', 'Accepts slower writes as the cost.'], model: 'No: a lost confirmed payment means real money and an angry customer, so I would make at least one follower synchronous and accept a few milliseconds more per write.' },
  next: { id: 'sharding', reason: 'Copies give safety and read capacity. Next: splitting data when one leader can’t take all the writes.' },
};

export const sharding: GenericLesson = {
  id: 'sharding',
  area: 'Data systems',
  opening: 'Ticket data for every event worldwide no longer fits one database, and one leader can’t take every write. Split it across four databases. But split by what? One choice spreads load evenly. Another melts one machine the moment a superstar’s tour goes on sale.',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('router', 'service', 'Router', { sub: 'key → shard' }), n('s0', 'db', 'Shard 0', { value: '25%' }), n('s1', 'db', 'Shard 1', { value: '25%' }), n('s2', 'db', 'Shard 2', { value: '25%' }), n('s3', 'db', 'Shard 3', { value: '25%' })],
      edges: [e('router', 's0'), e('router', 's1'), e('router', 's2'), e('router', 's3')],
      ...layout(300, 420, {
        router: [{ x: 120, y: 150, w: 170 }, { x: 180, y: 50, w: 200 }],
        s0: [{ x: 520, y: 45, w: 170, h: 66 }, { x: 92, y: 230, w: 160 }],
        s1: [{ x: 520, y: 115, w: 170, h: 66 }, { x: 268, y: 230, w: 160 }],
        s2: [{ x: 520, y: 185, w: 170, h: 66 }, { x: 92, y: 360, w: 160 }],
        s3: [{ x: 520, y: 255, w: 170, h: 66 }, { x: 268, y: 360, w: 160 }],
      }),
    },
  },
  experiment: {
    step: 4, label: 'Superstar event share of traffic', min: 0, max: 80, stepSize: 5, initial: 40, unit: '%',
    compute: (hot) => {
      const rest = (100 - hot) / 4;
      const loads = [rest + hot, rest, rest, rest];
      const byEvent = loads.map((l) => `${Math.round(l)}%`);
      return { text: `Partition key **event_id**: shard 0 carries **${Math.round(loads[0])}%** of traffic while the others carry ${Math.round(rest)}% each. Partition key **seat_id** would spread the superstar’s seats across all four shards (≈25% each), but then “all seats for this event” must ask every shard.`, diagram: { values: { s0: byEvent[0], s1: byEvent[1], s2: byEvent[2], s3: byEvent[3] }, states: { s0: hot >= 30 ? 'fail' : 'active' }, tags: { s0: { text: hot >= 30 ? 'hot spot' : 'busier', tone: hot >= 30 ? 'fail' : 'changed' } } } };
    },
    assumptions: ['Four shards, partitioned by hash of event_id. One event gets the given share of all requests; other traffic is spread evenly.'],
  },
  steps: [
    { kicker: 'Idea', title: 'Split rows across databases', body: ['**Sharding** (partitioning) stores each row on one of several databases. A **partition key** decides which: hash the key, take the result modulo 4, get a shard. A router (or the client library) does this on every request.'], view: { values: { s0: '', s1: '', s2: '', s3: '' } } },
    { kicker: 'Watch', title: 'Partition by event', body: ['Choose `event_id` as the key. All seats of one event land on the same shard, so “free seats for event 9031” asks a single shard. That’s the hot access pattern served well.'], view: { states: { s2: 'focus' }, tokens: [{ from: 'router', to: 's2', label: 'event 9031', tone: 'request' }] }, changes: [{ kind: 'add', text: 'Partition key: event_id' }] },
    { kicker: 'Predict', title: 'A superstar goes on sale', body: ['One event suddenly gets 40% of all traffic in the world.'], view: { tokens: [{ from: 'router', to: 's0', label: 'superstar', tone: 'fail' }] },
      predict: { id: 'hot', prompt: 'With event_id as the partition key, where does that 40% go?', choices: [
        { id: 'one', text: 'All to one shard: a hot spot.', why: 'Right. Every seat of that event lives on one shard, which now carries 40% + its normal 15% while the others idle.' },
        { id: 'spread', text: 'Spread across all four shards.', why: 'Hashing spreads *different* keys. One very popular key still maps to one shard.' },
      ], correct: 'one' } },
    { kicker: 'Failure', title: 'One shard melts, three idle', body: ['A **hot spot** is a partition receiving far more than its share. Adding shards doesn’t help: the hot key still lands on one.'], view: { values: { s0: '55%', s1: '15%', s2: '15%', s3: '15%' }, states: { s0: 'fail' }, tags: { s0: { text: 'hot spot', tone: 'fail' } } } },
    { kicker: 'Try it', title: 'Change how popular the event is', body: ['Drag the superstar’s share. Then read the alternative: partition by `seat_id`, or split a known-hot event across extra sub-keys, and see what each costs.'] },
  ],
  worked: { title: 'choosing a partition key', blocks: [
    { type: 'table', head: ['Key', 'Benefit', 'Cost'], rows: [['event_id', 'Event queries hit one shard', 'Popular events become hot spots'], ['seat_id (hashed)', 'Load spreads evenly, even for hot events', '“All seats for event” queries every shard (scatter-gather)'], ['event_id + bucket (0–9) for hot events', 'Spreads a known-hot event over 10 shards', 'Reads must combine 10 buckets; app must know which events are hot'], ['buyer_id', '“My bookings” hits one shard', 'Seat availability spread everywhere']] },
    { type: 'p', text: 'There’s no universally right key. Pick the one that serves your hottest access pattern, then plan for hot keys explicitly. Rebalancing when you add shards is the next lesson’s problem: [Consistent hashing](/learn/consistent-hashing).' },
  ] },
  checks: [{ kind: 'choice', id: 'chat', prompt: 'A chat app shards messages by conversation_id. What’s the main risk?', choices: [
    { id: 'hot', text: 'A huge group chat (say a 100,000-member channel) becomes a hot spot.', why: 'Right. Same pattern as the superstar event.' },
    { id: 'scatter', text: 'Loading one conversation needs every shard.', why: 'No. All of one conversation’s messages share a key, so they live on one shard.' },
  ], correct: 'hot' }],
  exercise: { id: 'key', prompt: 'For a URL shortener (lookups by short code), which partition key would you choose and why?', checklist: ['Chooses the short code (hashed).', 'Notes lookups are by code, and codes spread evenly; a single viral link may still be hot (cache it).'], model: 'Hash of the short code: every lookup names exactly one code, so it hits one shard, and codes spread evenly; a single viral link could still be hot, which a cache in front absorbs.' },
  next: { id: 'consistent-hashing', reason: 'Sharding by hash works until you add a shard. Next: how not to move almost every key when you do.' },
};

export const consistentHashing: GenericLesson = {
  id: 'consistent-hashing',
  area: 'Data systems',
  opening: 'Your cache cluster has 4 servers, keys assigned by `hash(key) % 4`. Traffic grows, so you add a fifth. Suddenly almost every lookup misses and the database is flooded. Adding capacity caused an outage. Why?',
  visual: { kind: 'chart', xLabel: '', yLabel: 'keys that move (%)', chartKind: 'bar', yMax: 100, categories: ['modulo 4→5', 'ring 4→5'] },
  experiment: {
    step: 3, label: 'Servers before adding one', min: 2, max: 20, stepSize: 1, initial: 4, unit: 'servers',
    compute: (k) => {
      const mod = Math.round((1 - 1 / (k + 1)) * 100);
      const ring = Math.round((1 / (k + 1)) * 100);
      return { text: `Going from ${k} to ${k + 1} servers: modulo hashing moves about **${mod}%** of keys; a consistent-hash ring moves about **${ring}%**, only the keys the new server takes over.`, chart: { series: [{ name: 'values', points: [[0, mod], [1, ring]] }] } };
    },
    assumptions: ['Keys spread evenly; the ring uses enough virtual nodes per server to balance load. Percentages are the expected values.'],
  },
  steps: [
    { kicker: 'Problem', title: 'Modulo reshuffles almost everything', body: ['With `hash(key) % 4`, a key lands on server 3. With `% 5`, the same key usually lands somewhere else. Change N and the remainder changes for most keys: about 4 in 5 move from 4 to 5 servers. For a cache, a moved key is a miss.'], chart: { series: [{ name: 'values', points: [[0, 80]] }] } },
    { kicker: 'Idea', title: 'Put servers and keys on a circle', body: ['**Consistent hashing** hashes servers *and* keys onto the same circle of numbers. Each key belongs to the next server clockwise. Add a server and it takes over only the arc just before it. Every other key stays where it was.'], chart: { series: [{ name: 'values', points: [[0, 80], [1, 20]] }] }, code: { code: `class Ring${RING}`, highlight: [], caption: 'python/sdm/partitioning.py — a ring with virtual nodes, tested with pytest' }, changes: [{ kind: 'chg', text: 'Moved keys: ~80% → ~20%' }] },
    { kicker: 'Predict', title: 'Why virtual nodes?', body: ['With one point per server, the arcs are random lengths, and one server might own 40% of the circle. Each server is therefore placed many times (here 50 **virtual nodes**), which evens out the arcs.'], chart: { series: [{ name: 'values', points: [[0, 80], [1, 20]] }] },
      predict: { id: 'remove', prompt: 'One of 5 servers is removed from a ring. Which keys move?', choices: [
        { id: 'its', text: 'Only the keys it owned, spread to its neighbours on the ring.', why: 'Right. About 1/5 of keys. With virtual nodes, they spread over all remaining servers rather than dumping on one.' },
        { id: 'all', text: 'Most keys, as with modulo.', why: 'Other servers’ arcs don’t change, so their keys stay put.' },
      ], correct: 'its' } },
    { kicker: 'Try it', title: 'Scale the cluster', body: ['Drag the cluster size. With modulo, adding a server moves nearly everything however big the cluster is. With a ring, the bigger the cluster, the smaller the share that moves.'] },
  ],
  worked: { title: 'rebalancing in practice', blocks: [
    { type: 'p', text: 'Dynamo-style databases and many cache clients use consistent hashing so nodes can join and leave with minimal data movement. Others use a fixed number of partitions (say 1,024) and move whole partitions between nodes. That’s also cheap to rebalance, and easier to reason about.' },
    { type: 'table', head: ['Scheme', 'Adding a node moves', 'Notes'], rows: [['hash % N', '≈ (N)/(N+1) of keys', 'Simple; terrible for caches and stateful stores'], ['Consistent hashing + virtual nodes', '≈ 1/(N+1) of keys', 'Common in caches and Dynamo-style stores'], ['Fixed partitions (e.g. 1,024) assigned to nodes', 'Whole partitions, chosen deliberately', 'Common in databases; partition count fixed up front']] },
    { type: 'code', lang: 'python', code: py('sdm/partitioning.py'), caption: 'python/sdm/partitioning.py — the tests check ~80% vs ~20% movement on 5,000 keys' },
  ] },
  checks: [
    { kind: 'numeric', id: 'mod', prompt: 'With modulo hashing, roughly what percent of keys move when going from 9 to 10 servers?', answer: 90, tolerance: 0.05, unit: '%', solution: ['A key stays only if hash % 9 == hash % 10', 'That happens for about 1 in 10 keys', 'So about 90% move'] },
    { kind: 'numeric', id: 'ring', prompt: 'With a well-balanced ring, roughly what percent move when going from 9 to 10 servers?', answer: 10, tolerance: 0.1, unit: '%', solution: ['The new server takes about 1/10 of the circle', 'Only those keys move: ≈ 10%'] },
  ],
  exercise: { id: 'cache', prompt: 'Why does moving keys hurt more for a cache cluster than for a stateless web tier?', checklist: ['Moved keys become cache misses that hit the database.', 'A stateless tier has no per-key data, so any server can serve any request.'], model: 'Each moved key is a cache miss that falls through to the database, so moving most keys at once can flood it; a stateless web tier holds no per-key data, so rebalancing it costs nothing.' },
  next: { id: 'requirements', reason: 'That completes the data toolbox. Next: turning a vague product request into requirements you can design against.' },
};

export const DATA2 = [transactions, lockingMvcc, failover, sharding, consistentHashing];
