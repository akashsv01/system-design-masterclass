import type { GenericLesson } from '../lessonTypes';
import { e, layout, n, py, pyLine } from './_kit';

const HANDLE = py('sdm/queues.py', 'handle');

export const consensus: GenericLesson = {
  id: 'consensus',
  area: 'HLD and distributed systems',
  opening: 'Three servers manage the seat store. The leader goes quiet. If two followers each decide “I’m the leader now”, both accept writes and the data splits in two. How do three machines that can each crash or lose messages agree on exactly one leader?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('a', 'server', 'Node A', { value: 'leader · term 1' }), n('b', 'server', 'Node B', { value: 'follower · term 1' }), n('c', 'server', 'Node C', { value: 'follower · term 1' })],
      edges: [e('a', 'b'), e('a', 'c'), e('b', 'c')],
      ...layout(300, 400, {
        a: [{ x: 410, y: 70, w: 220 }, { x: 180, y: 50, w: 220 }],
        b: [{ x: 180, y: 240, w: 220 }, { x: 92, y: 330, w: 166 }],
        c: [{ x: 640, y: 240, w: 220 }, { x: 268, y: 330, w: 166 }],
      }),
    },
  },
  steps: [
    { kicker: 'Idea', title: 'One leader, chosen by majority', body: ['**Consensus** algorithms like **Raft** let a group agree on values despite crashes and lost messages. Raft first elects one **leader**. All writes go through it, and it copies them to the followers.'], view: { tokens: [{ from: 'a', to: 'b', label: 'heartbeat', tone: 'copy' }] } },
    { kicker: 'Watch', title: 'The leader goes silent', body: ['Node A crashes. Followers expect a heartbeat every ~100 ms. Each waits a **randomised** timeout, here B at 180 ms and C at 260 ms. The randomness makes it unlikely both start an election at once.'], view: { states: { a: 'fail' }, values: { a: 'silent' } }, changes: [{ kind: 'del', text: 'Leader A stops sending heartbeats' }] },
    { kicker: 'Watch', title: 'B asks for votes in a new term', body: ['B times out first. It increments the **term** to 2, votes for itself, and asks the others for votes. C hasn’t voted in term 2 yet and B’s log is at least as up to date as its own, so C says yes. Two of three votes is a **majority**: B is leader for term 2.'], view: { states: { a: 'fail', b: 'focus' }, values: { a: 'silent', b: 'leader · term 2', c: 'follower · term 2' }, tokens: [{ from: 'b', to: 'c', label: 'vote for me? (term 2)', tone: 'request' }] }, changes: [{ kind: 'add', text: 'B elected leader for term 2 (votes: B, C)' }] },
    { kicker: 'Predict', title: 'A comes back', body: ['Node A restarts, still believing it is leader of term 1, and tries to send a write to B.'], view: { states: { a: 'active', b: 'focus' }, values: { a: 'thinks: leader · term 1', b: 'leader · term 2', c: 'follower · term 2' }, tokens: [{ from: 'a', to: 'b', label: 'write (term 1)', tone: 'fail' }] },
      predict: { id: 'stale', prompt: 'What happens to A’s write stamped with term 1?', choices: [
        { id: 'reject', text: 'B rejects it: term 1 is older than term 2. A learns it is no longer leader and steps down.', why: 'Right. Terms act as a logical clock for leadership, so a stale leader can’t get a majority to accept anything.' },
        { id: 'accept', text: 'B accepts it, and now there are two leaders.', why: 'Raft prevents exactly this. Nodes reject messages from older terms, so A can never assemble a majority.' },
      ], correct: 'reject' } },
    { kicker: 'Idea', title: 'Committed means a majority has it', body: ['The leader appends each write to its log and replicates it. An entry from the leader’s current term is **committed** once a majority stores it. Only then is the client told “done”. Any future leader must win votes from a majority, so it will always have every committed entry.'], view: { values: { a: 'follower · term 2', b: 'leader · term 2', c: 'follower · term 2' }, states: { b: 'ok' }, tokens: [{ from: 'b', to: 'a', label: 'append #42', tone: 'copy' }] } },
  ],
  worked: { title: 'where consensus shows up', blocks: [
    { type: 'list', items: ['**Coordination services** (etcd, ZooKeeper, Consul) run consensus so other systems can store small critical facts: who is the leader, which config is current, who holds a lock.', 'Many databases replicate with Raft or Paxos internally (CockroachDB, TiKV, Spanner’s Paxos groups).', 'Leader election for your own service is usually done *through* such a service, with a lease that expires, rather than by implementing Raft yourself.'] },
    { type: 'table', head: ['Cluster size', 'Majority', 'Failures tolerated'], rows: [['3', '2', '1'], ['5', '3', '2'], ['7', '4', '3']] },
    { type: 'callout', tone: 'warn', title: 'Even-sized clusters waste a node', text: 'Four nodes need a majority of 3 and tolerate only 1 failure, the same as three nodes, with more coordination overhead.' },
  ] },
  checks: [
    { kind: 'numeric', id: 'tol', prompt: 'A Raft cluster has 5 nodes. How many can fail while it keeps accepting writes?', answer: 2, tolerance: 0.01, unit: 'nodes', solution: ['Majority of 5 = 3', 'It keeps working while 3 remain', '5 − 3 = 2 failures tolerated'] },
    { kind: 'choice', id: 'split', prompt: 'A 5-node cluster splits 2 | 3 by a network partition. Which side can elect a leader?', choices: [
      { id: '3', text: 'Only the side with 3 nodes', why: 'Right. Only it can form a majority. The 2-node side can’t commit anything, which prevents split brain.' },
      { id: 'both', text: 'Both sides', why: 'Each side would need 3 votes. Only one side has them.' },
    ], correct: '3' },
  ],
  exercise: { id: 'lock', prompt: 'Your nightly billing job must run on exactly one of three servers. How would you ensure that, in one or two sentences?', checklist: ['Uses leader election or a lease via a coordination service (etcd/ZooKeeper) or a database lock with expiry.', 'Mentions expiry/fencing so a crashed holder doesn’t block forever.'], model: 'Have the servers compete for a lease in a coordination service such as etcd; the holder runs the job and renews the lease, and if it dies the lease expires so another server can take over.' },
  next: { id: 'queues', reason: 'Consensus is one way to coordinate. Queues are another: they let parts of a system work at their own pace.' },
};

export const queues: GenericLesson = {
  id: 'queues',
  area: 'HLD and distributed systems',
  opening: 'After a booking, the app sends a ticket email, updates analytics and notifies the venue. Done inside the request, each slow step adds to the buyer’s wait, and if the email service is down, the booking fails. Does the buyer really need to wait for any of that?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('checkout', 'service', 'Checkout'), n('q', 'queue', 'Queue', { value: '0 waiting' }), n('email', 'server', 'Email worker'), n('topic', 'queue', 'Topic: booking.confirmed'), n('analytics', 'server', 'Analytics'), n('venue', 'server', 'Venue notifier')],
      edges: [e('checkout', 'q', 'send'), e('q', 'email', 'take'), e('checkout', 'topic', 'publish'), e('topic', 'analytics'), e('topic', 'venue')],
      ...layout(340, 520, {
        checkout: [{ x: 110, y: 170, w: 160 }, { x: 180, y: 40, w: 180 }],
        q: [{ x: 400, y: 70, w: 170 }, { x: 92, y: 170, w: 160 }],
        email: [{ x: 690, y: 70, w: 170 }, { x: 92, y: 300, w: 160 }],
        topic: [{ x: 400, y: 260, w: 230 }, { x: 268, y: 170, w: 170 }],
        analytics: [{ x: 700, y: 210, w: 160 }, { x: 268, y: 300, w: 160 }],
        venue: [{ x: 700, y: 300, w: 160 }, { x: 268, y: 430, w: 160 }],
      }),
    },
  },
  steps: [
    { kicker: 'Problem', title: 'Synchronous calls chain the failures', body: ['If checkout calls the email service directly and waits, checkout is only as fast and available as email. When email is down, bookings fail, even though the booking itself was fine.'], view: { hide: ['q', 'topic', 'analytics', 'venue'], states: { email: 'fail' } } },
    { kicker: 'Fix', title: 'Put a queue in between', body: ['Checkout drops a message, “send ticket email for order 91”, into a **queue** and replies to the buyer immediately. An email worker takes messages off the queue at its own pace. If the worker is down, messages wait. Nothing is lost and nobody is blocked.'], view: { hide: ['topic', 'analytics', 'venue'], values: { q: '1 waiting' }, tokens: [{ from: 'checkout', to: 'q', label: 'email order 91', tone: 'request' }] }, changes: [{ kind: 'add', text: 'Queue between checkout and email' }] },
    { kicker: 'Idea', title: 'Pub/sub: one event, many listeners', body: ['A queue hands each message to **one** worker. **Pub/sub** (a topic) delivers each event to **every** subscriber. Checkout publishes “booking confirmed” once, and analytics and the venue notifier each get their own copy. Adding a new subscriber needs no change to checkout.'], view: { values: { q: '0 waiting' }, tokens: [{ from: 'topic', to: 'analytics', label: 'booking 91', tone: 'copy' }, { from: 'topic', to: 'venue', label: 'booking 91', tone: 'copy' }] } },
    { kicker: 'Predict', title: 'What must stay synchronous?', body: ['Not everything can move to a queue.'], view: {},
      predict: { id: 'sync', prompt: 'Which step must finish *before* checkout tells the buyer “Confirmed”?', choices: [
        { id: 'seat', text: 'Marking the seat booked and recording the payment.', why: 'Right. That is the confirmation. Everything that merely reacts to it (email, analytics, venue) can follow asynchronously.' },
        { id: 'email', text: 'Sending the ticket email.', why: 'The buyer is happy to receive it seconds later, and an email outage shouldn’t block bookings.' },
      ], correct: 'seat' } },
    { kicker: 'Trade-off', title: 'What a queue costs', body: ['Work now happens *later*: emails arrive seconds after booking, and during an outage maybe minutes. You also gain things to watch (queue length, message age) and new failure modes: duplicates, poison messages, backlogs. The next lessons cover each.'], view: { values: { q: '1,240 waiting' }, states: { q: 'active' } } },
  ],
  worked: { title: 'queue vs topic, sync vs async', blocks: [
    { type: 'table', head: ['', 'Queue (point-to-point)', 'Topic (pub/sub)'], rows: [['Each message goes to', 'One consumer', 'Every subscriber'], ['Use for', 'Work to be done once (send email, resize image)', 'Facts others react to (booking confirmed)'], ['Adding a consumer', 'Shares the work', 'Gets its own copy of everything']] },
    { type: 'p', text: 'Rule of thumb: keep the steps that *define* the result synchronous, and make the steps that *react* to it asynchronous.' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'A new “loyalty points” service must react to every confirmed booking. With pub/sub, what changes in checkout?', choices: [
    { id: 'none', text: 'Nothing. Loyalty subscribes to the existing topic.', why: 'Right. Producers don’t know their subscribers. That’s the decoupling.' },
    { id: 'call', text: 'Checkout must add a call to loyalty.', why: 'That’s the synchronous coupling pub/sub removes.' },
  ], correct: 'none' }],
  exercise: { id: 'img', prompt: 'Users upload a venue photo that must be resized into 3 sizes. Would you resize inside the upload request or via a queue, and why?', checklist: ['Chooses a queue (resizing is slow and not needed for the upload to succeed).', 'Notes the cost: thumbnails appear a little later, and the UI must handle “processing”.'], model: 'Via a queue: store the original, reply immediately, and let workers produce the three sizes; the upload stays fast and resilient, at the cost of showing “processing” for a few seconds.' },
  next: { id: 'logs-delivery', reason: 'Messages can be lost or duplicated. Next: what delivery guarantees mean, and how logs make them manageable.' },
};

export const logsDelivery: GenericLesson = {
  id: 'logs-delivery',
  area: 'HLD and distributed systems',
  opening: 'The email worker takes message 91, sends the email, and crashes before telling the queue it’s done. The queue redelivers message 91 to another worker. Maya gets two ticket emails. Is that a bug in the queue, or the price of never losing one?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('p0', 'queue', 'Partition 0', { value: '… 88 89 90 91' }), n('p1', 'queue', 'Partition 1', { value: '… 40 41 42' }), n('w1', 'server', 'Worker 1', { sub: 'reads partition 0', value: 'offset 90' }), n('w2', 'server', 'Worker 2', { sub: 'reads partition 1', value: 'offset 42' })],
      edges: [e('p0', 'w1'), e('p1', 'w2')],
      ...layout(260, 400, {
        p0: [{ x: 230, y: 70, w: 250 }, { x: 92, y: 60, w: 166 }],
        p1: [{ x: 230, y: 190, w: 250 }, { x: 268, y: 60, w: 166 }],
        w1: [{ x: 640, y: 70, w: 220 }, { x: 92, y: 300, w: 166 }],
        w2: [{ x: 640, y: 190, w: 220 }, { x: 268, y: 300, w: 166 }],
      }),
    },
  },
  steps: [
    { kicker: 'Idea', title: 'A log keeps messages in order', body: ['A **log** (Kafka-style) is an append-only list of messages. It’s split into **partitions** for throughput, and each message gets an increasing number, its **offset**. Messages with the same key (say, order id) always go to the same partition, so their order is preserved.'], view: { hide: ['w1', 'w2'] } },
    { kicker: 'Watch', title: 'A consumer group shares the work', body: ['Workers in a **consumer group** split the partitions between them. Each worker remembers the offset it has processed up to, its **committed offset**. Add workers (up to the partition count) to go faster.'], view: { tokens: [{ from: 'p0', to: 'w1', label: 'message 91', tone: 'request' }] } },
    { kicker: 'Predict', title: 'Crash after sending, before committing', body: ['Worker 1 sends the email for message 91, then crashes before committing offset 91. Its replacement starts from the last committed offset, 90.'], view: { states: { w1: 'fail' }, values: { w1: 'crashed · committed 90' } },
      predict: { id: 'dup', prompt: 'What does the replacement worker do with message 91?', choices: [
        { id: 'again', text: 'Processes it again, so the email is sent twice.', why: 'Right. This is **at-least-once** delivery: nothing is lost, but duplicates happen. The consumer must handle them.' },
        { id: 'skip', text: 'Skips it, since it was already sent.', why: 'The log only knows offset 90 was committed. It can’t know the email went out.' },
      ], correct: 'again' } },
    { kicker: 'Fix', title: 'Make the effect idempotent', body: ['Commit first and you risk **at-most-once**: a crash loses the message. Commit after and you get **at-least-once**: a crash duplicates it. The practical answer is at-least-once delivery plus a consumer that **deduplicates** by message id, so the *effect* happens once.'], view: { states: { w1: 'ok' }, values: { w1: 'skip 91 (already sent)' } }, code: { code: HANDLE, highlight: [pyLine(HANDLE, 'if message_id in self.seen:')], caption: 'python/sdm/queues.py — dedup turns at-least-once delivery into an effectively-once effect', open: true } },
  ],
  worked: { title: 'delivery guarantees', blocks: [
    { type: 'table', head: ['Guarantee', 'How', 'Risk'], rows: [['At most once', 'Commit offset, then process', 'Crash loses messages'], ['At least once', 'Process, then commit offset', 'Crash duplicates messages'], ['Effectively once', 'At least once + idempotent/deduplicated processing (or transactional writes)', 'More design work; dedup store must be durable']] },
    { type: 'list', items: ['Order is guaranteed **within a partition**, not across them. Key messages so the ones that must stay ordered share a partition.', 'A message that always crashes the worker (**poison message**) blocks its partition. Retry a few times, then move it to a dead-letter queue for inspection.', 'Logs keep messages after they’re read, so a new consumer can replay history from offset 0.'] },
  ] },
  checks: [
    { kind: 'choice', id: 'order', prompt: 'Events “seat held” and “seat released” for F12 must be processed in order. How do you ensure that?', choices: [
      { id: 'key', text: 'Use the seat id as the message key, so both go to the same partition.', why: 'Right. Same key, same partition, preserved order.' },
      { id: 'more', text: 'Add more partitions.', why: 'More partitions means more parallelism, and no ordering across them.' },
    ], correct: 'key' },
    { kind: 'numeric', id: 'max', prompt: 'A topic has 6 partitions. What is the most consumers in one group that can be actively reading?', answer: 6, tolerance: 0.01, unit: 'consumers', solution: ['Each partition is read by one consumer in the group', 'Extra consumers sit idle', 'So at most 6'] },
  ],
  exercise: { id: 'ledger', prompt: 'A consumer adds €45 to a venue’s payout balance for each “booking paid” message. How do you stop duplicates from overpaying?', checklist: ['Records processed message/booking ids and skips repeats.', 'Does it atomically with the balance update (same transaction).'], model: 'Store each processed booking id in the same database transaction that updates the balance; a redelivered message finds its id already present and changes nothing.' },
  next: { id: 'backpressure', reason: 'Consumers can also fall behind. Next: what happens when messages arrive faster than they’re handled.' },
};

export const backpressure: GenericLesson = {
  id: 'backpressure',
  area: 'HLD and distributed systems',
  opening: 'On sale day, booking confirmations arrive at 2,000 a second. The email workers send 1,500 a second. The queue absorbs the difference without complaint, until someone notices that the latest ticket emails are 40 minutes late.',
  visual: { kind: 'chart', xLabel: 'minutes', yLabel: 'messages waiting', note: 'Illustrative on-sale: 2,000 messages/s arrive for 10 minutes, then 300/s.' },
  experiment: {
    step: 3, label: 'Workers send', min: 1000, max: 3000, stepSize: 100, initial: 1500, unit: 'emails/s',
    compute: (rate) => {
      const arrive = 2000;
      const minutes = 20;
      const pts: [number, number][] = [];
      let b = 0;
      for (let m = 0; m <= minutes; m++) {
        pts.push([m, Math.round(b)]);
        b = Math.max(0, b + (m < 10 ? arrive - rate : 300 - rate) * 60);
      }
      const peak = Math.max(...pts.map((p) => p[1]));
      const oldest = Math.round(peak / rate / 60);
      return { text: rate >= arrive ? `Workers keep up: no backlog builds.` : `Peak backlog **${peak.toLocaleString()}** messages after the 10-minute rush; the last email in line waits about **${oldest} min**. After the rush (300/s arriving) it drains at ${(rate - 300).toLocaleString()}/s.`, chart: { series: [{ name: 'backlog', points: pts, tone: rate >= arrive ? 'ok' : 'fail' }] } };
    },
    assumptions: ['2,000 messages/s arrive for 10 minutes, then 300/s. Workers process at a fixed rate.'],
  },
  steps: [
    { kicker: 'Problem', title: 'A queue hides an imbalance', body: ['With 2,000 in and 1,500 out each second, the backlog grows by 500 every second: 30,000 a minute. The queue keeps accepting, so nothing looks broken. Only the waiting time grows.'], chart: { series: [{ name: 'backlog', points: Array.from({ length: 11 }, (_, m) => [m, m * 30000] as [number, number]), tone: 'fail' }] } },
    { kicker: 'Predict', title: 'How long to catch up?', body: ['After 10 minutes the rush ends and arrivals drop to 300/s. The backlog is 300,000.'], chart: { series: [{ name: 'backlog', points: Array.from({ length: 11 }, (_, m) => [m, m * 30000] as [number, number]), tone: 'fail' }], marks: [{ x: 10, y: 300000, label: '300,000 waiting' }] },
      predict: { id: 'drain', prompt: 'Workers still send 1,500/s. How long until the backlog is gone?', choices: [
        { id: '4', text: 'About 4 minutes', why: 'Right. Spare capacity is 1,500 − 300 = 1,200/s, and 300,000 ÷ 1,200 = 250 s ≈ 4 minutes.' },
        { id: '3', text: 'About 3 minutes (300,000 ÷ 1,500)', why: 'New messages keep arriving at 300/s, so only the spare 1,200/s drains the backlog.' },
      ], correct: '4' } },
    { kicker: 'Idea', title: 'Backpressure: push back on the source', body: ['**Backpressure** means letting a slow consumer slow the producer down: a bounded queue that rejects or blocks when full, or rate limits upstream. Alternatively, **shed load**: drop or defer low-value work (marketing emails) to protect high-value work (tickets).'], chart: { series: [{ name: 'bounded queue', points: Array.from({ length: 11 }, (_, m) => [m, Math.min(m * 30000, 100000)] as [number, number]), tone: 'accent' }], thresholds: [{ y: 100000, label: 'queue limit' }] } },
    { kicker: 'Try it', title: 'Add workers', body: ['Drag the workers’ send rate. A backlog is fine if it drains quickly. One that grows forever needs more workers, faster processing, or less incoming work.'] },
  ],
  worked: { title: 'backlog arithmetic', blocks: [
    { type: 'formula', title: 'Growth and drain', assumptions: ['Arrivals λ = 2,000/s during the rush, 300/s after', 'Processing μ = 1,500/s', 'Rush lasts 600 s'], steps: ['Growth = (λ − μ) × t = 500 × 600 = 300,000 messages', 'Drain rate after = μ − λ_after = 1,500 − 300 = 1,200/s', 'Drain time = 300,000 ÷ 1,200 = 250 s'], result: 'Peak 300,000 waiting; ~4 minutes to drain; the longest wait belongs to the message that arrives as the rush ends: it queues behind 300,000 others, so 300,000 ÷ 1,500/s = 200 s (first in, first out)', changed: 'With μ = 1,900/s: growth 100 × 600 = 60,000, drain 60,000 ÷ 1,600 ≈ 38 s.' },
    { type: 'p', text: 'Alert on the **age of the oldest message** as well as queue length: it measures user-visible delay directly. Push this further in the [queue backlog lab](/labs/lab-queue-backlog).' },
    { type: 'code', lang: 'python', code: py('sdm/queues.py', 'drain_seconds'), caption: 'python/sdm/queues.py' },
  ] },
  checks: [{ kind: 'numeric', id: 'grow', prompt: 'Arrivals 800/s, processing 600/s. How big is the backlog after 5 minutes?', answer: 60000, tolerance: 0.02, unit: 'messages', solution: ['Growth per second = 800 − 600 = 200', '5 minutes = 300 s', '200 × 300 = 60,000'] }],
  exercise: { id: 'shed', prompt: 'During a backlog, ticket emails and marketing emails share one queue. What would you change, and why?', checklist: ['Separate queues or priorities so tickets aren’t stuck behind marketing.', 'Optionally shed or defer marketing during overload.'], model: 'Give ticket emails their own queue (or priority) so they never wait behind marketing, and pause marketing sends while the backlog is high.' },
  next: { id: 'batch-stream', reason: 'Queues move events. Next: computing results from streams of events, now or later.' },
};

export const batchStream: GenericLesson = {
  id: 'batch-stream',
  area: 'HLD and distributed systems',
  opening: 'The promoter wants “tickets sold per minute”. A phone on a train buys a ticket at 20:00:58, loses signal, and the event reaches you at 20:01:20. Which minute does it count in, and when can you say the 20:00 minute is final?',
  visual: { kind: 'timeline', unit: 's after 20:00:00', lanes: [{ id: 'evt', label: 'Event time' }, { id: 'proc', label: 'Arrival time' }, { id: 'wm', label: 'Watermark' }], events: [
    { t: 30, lane: 'evt', label: 'sale A', to: { lane: 'proc', t: 31 } },
    { t: 58, lane: 'evt', label: 'sale B (train)', tone: 'active', to: { lane: 'proc', t: 80 } },
    { t: 70, lane: 'wm', label: 'watermark 20:00:50' },
    { t: 90, lane: 'wm', label: 'watermark 20:01:05 → close 20:00 window', tone: 'ok' },
  ] },
  steps: [
    { kicker: 'Idea', title: 'Batch: compute later over everything', body: ['**Batch processing** runs over a complete, bounded dataset, say last night’s sales, and produces a result: revenue per venue. It’s simple and repeatable: rerun it and get the same answer. Its results are hours old.'], timeline: { upTo: 0 } },
    { kicker: 'Idea', title: 'Stream: compute continuously', body: ['**Stream processing** updates results as events arrive: sales per minute, live. The data never “ends”, so you group events into **windows** (each minute) and must decide when a window is done.'], timeline: { upTo: 1 } },
    { kicker: 'Watch', title: 'Event time vs arrival time', body: ['Sale B happened at 20:00:58 (**event time**) but arrived at 20:01:20 (**processing time**). Counting by arrival would put it in the wrong minute. Correct counts group by event time, carried inside the event.'], timeline: { upTo: 2 }, changes: [{ kind: 'add', text: 'Sale B: event 20:00:58, arrived 20:01:20' }] },
    { kicker: 'Predict', title: 'When is the 20:00 minute final?', body: ['A **watermark** is the processor’s estimate that “events older than T have probably all arrived”. It trails real time by an allowed lateness.'], timeline: { upTo: 4 },
      predict: { id: 'wm', prompt: 'The 20:00 window closes when the watermark passes 20:01:00. An event stamped 20:00:40 arrives after that. What should happen?', choices: [
        { id: 'late', text: 'It’s late: update the result if the window allows corrections, or send it to a late-data path.', why: 'Right. Watermarks trade completeness for timeliness. Late data needs an explicit policy.' },
        { id: 'next', text: 'Count it in the current minute instead.', why: 'That silently moves a sale into the wrong minute: correct total, wrong breakdown.' },
      ], correct: 'late' } },
  ],
  worked: { title: 'batch and stream side by side', blocks: [
    { type: 'table', head: ['', 'Batch', 'Stream'], rows: [['Input', 'Bounded: yesterday’s files', 'Unbounded: events as they come'], ['Latency', 'Minutes to hours', 'Seconds'], ['Correctness', 'Easy: everything has arrived', 'Needs event time, windows, watermarks, late-data policy'], ['Reprocessing', 'Rerun the job', 'Replay the log from an offset'], ['Examples', 'MapReduce, Spark batch, nightly SQL', 'Kafka Streams, Flink, Spark Structured Streaming']] },
    { type: 'p', text: 'Many teams run both: a stream for a fast approximate dashboard, and a nightly batch job that recomputes exact numbers from the full log and corrects the record.' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Which should drive “sales per minute” buckets?', choices: [
    { id: 'event', text: 'The time the sale happened (event time)', why: 'Right. Arrival time depends on network delays and would misplace late events.' },
    { id: 'arrival', text: 'The time the event reached the processor', why: 'A phone that reconnects late would shift its sale into the wrong minute.' },
  ], correct: 'event' }],
  exercise: { id: 'lateness', prompt: 'What does a longer allowed lateness buy you, and what does it cost?', checklist: ['Buys: more late events counted correctly.', 'Costs: results finalised later, and more state held in memory.'], model: 'More late events land in the right window, but each window is finalised later and the processor must keep more open windows in memory.' },
  next: { id: 'distributed-transactions', reason: 'Streams react to events. Next: keeping several services consistent when one step of a multi-step operation fails.' },
};

export const distributedTransactions: GenericLesson = {
  id: 'distributed-transactions',
  area: 'HLD and distributed systems',
  opening: 'Checkout must do three things in three services: hold the seat, charge the card, issue the ticket. The charge succeeds. Issuing the ticket fails. You can’t wrap three services in one database transaction. Now what?',
  visual: { kind: 'timeline', unit: 'step', lanes: [{ id: 'seats', label: 'Seat service' }, { id: 'pay', label: 'Payment service' }, { id: 'tix', label: 'Ticket service' }], events: [
    { t: 1, lane: 'seats', label: 'hold F12 ✓', tone: 'ok' },
    { t: 2, lane: 'pay', label: 'charge €45 ✓', tone: 'ok' },
    { t: 3, lane: 'tix', label: 'issue ticket ✕', tone: 'fail' },
    { t: 4, lane: 'pay', label: 'refund €45 (compensate)', tone: 'active' },
    { t: 5, lane: 'seats', label: 'release F12 (compensate)', tone: 'active' },
  ] },
  steps: [
    { kicker: 'Problem', title: 'Each service has its own database', body: ['A single database can roll back a failed transaction. Across services, each step commits in its own database. If step 3 fails, steps 1 and 2 have already happened.'], timeline: { upTo: 3 } },
    { kicker: 'Idea', title: 'Two-phase commit: everyone agrees first', body: ['**Two-phase commit (2PC)**: a coordinator asks every participant “can you commit?”, and only if all say yes tells them “commit”. It gives atomicity, but participants hold locks while waiting, and if the coordinator dies at the wrong moment they can be stuck. It’s rarely used across independently owned services.'], timeline: { upTo: 3 } },
    { kicker: 'Fix', title: 'A saga: steps plus compensations', body: ['A **saga** runs each step as its own local transaction. Every step has a **compensating action** that semantically undoes it: refund the charge, release the seat. When a step fails, the saga runs the compensations for the completed steps in reverse order.'], timeline: { upTo: 5 }, changes: [{ kind: 'chg', text: 'Refund issued, seat released' }] },
    { kicker: 'Predict', title: 'Publishing reliably: the outbox', body: ['The seat service updates its database *and* must publish “seat held” to a queue. The database commit succeeds, then the service crashes before publishing.'], timeline: { upTo: 5, focus: 0 },
      predict: { id: 'outbox', prompt: 'How do you make sure the event is published if and only if the database change committed?', choices: [
        { id: 'outbox', text: 'Write the event into an “outbox” table in the same transaction; a relay publishes rows from the outbox afterwards.', why: 'Right. One local transaction covers both, and the relay retries until published (consumers deduplicate). This is the **outbox pattern**.' },
        { id: 'both', text: 'Publish first, then commit the database.', why: 'If the commit then fails, you’ve announced something that never happened.' },
      ], correct: 'outbox' } },
    { kicker: 'Trade-off', title: 'What sagas give up', body: ['Sagas aren’t isolated: between steps, others can see the in-between state (a seat held and a card charged, with no ticket yet). Compensations must be designed per step, and some actions can’t be undone. An email can’t be unsent, so do those last.'], timeline: { upTo: 5 } },
  ],
  worked: { title: 'designing the checkout saga', blocks: [
    { type: 'table', head: ['Step', 'Action', 'Compensation'], rows: [['1', 'Hold seat (expires in 10 min)', 'Release hold (or let it expire)'], ['2', 'Charge card (idempotency key = order id)', 'Refund (idempotent by order id)'], ['3', 'Issue ticket', 'Void ticket'], ['4', 'Send email (last: can’t be undone)', 'Send a correction email']] },
    { type: 'list', items: ['Order steps so the hard-to-undo ones come last.', 'Make every action and compensation idempotent, since they’ll be retried.', 'Store saga state durably (which steps completed), so a crashed orchestrator can resume.', 'Late payment after the hold expired? That’s a case the saga must handle explicitly: refund, or re-hold if the seat is still free. See the [booking case](/cases/case-ticket-booking).'] },
  ] },
  checks: [{ kind: 'order', id: 'comp', prompt: 'Steps 1 (hold seat) and 2 (charge) succeeded, step 3 (issue ticket) failed. Put the saga’s recovery in order.', items: ['Detect step 3 failed', 'Refund the charge (undo step 2)', 'Release the seat (undo step 1)', 'Tell the buyer checkout failed and they weren’t charged'], explain: 'Compensate completed steps in reverse order, then report the outcome.' }],
  exercise: { id: 'order', prompt: 'Why should “send confirmation email” be the last step of the checkout saga?', checklist: ['An email can’t be unsent (no clean compensation).', 'Doing it last avoids telling buyers about bookings that are later rolled back.'], model: 'Because it can’t be undone: if it ran earlier and a later step failed, the buyer would hold a confirmation for a booking we then reversed.' },
  next: { id: 'cqrs-event-sourcing', reason: 'Sagas coordinate writes. Next: separating how you write from how you read, and keeping the full history.' },
};

export const cqrsEventSourcing: GenericLesson = {
  id: 'cqrs-event-sourcing',
  area: 'HLD and distributed systems',
  opening: 'A buyer disputes a charge: “I cancelled that seat!” Your bookings table only says F12 is booked. It stores the current state, not how it got there. What if the system stored every change, and computed the current state from them?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('cmd', 'service', 'Commands', { sub: 'hold, pay, cancel' }), n('log', 'queue', 'Event log', { value: 'held · paid · cancelled' }), n('state', 'db', 'Current state', { sub: 'projection' }), n('search', 'db', 'Search view', { sub: 'projection' }), n('report', 'db', 'Revenue report', { sub: 'projection' })],
      edges: [e('cmd', 'log', 'append'), e('log', 'state', 'replay'), e('log', 'search'), e('log', 'report')],
      ...layout(330, 500, {
        cmd: [{ x: 110, y: 165, w: 170 }, { x: 180, y: 40, w: 200 }],
        log: [{ x: 380, y: 165, w: 240 }, { x: 180, y: 160, w: 260 }],
        state: [{ x: 700, y: 60, w: 180 }, { x: 70, y: 330, w: 120 }],
        search: [{ x: 700, y: 165, w: 180 }, { x: 180, y: 430, w: 140 }],
        report: [{ x: 700, y: 270, w: 180 }, { x: 290, y: 330, w: 130 }],
      }),
    },
  },
  steps: [
    { kicker: 'Idea', title: 'Store events, not just state', body: ['**Event sourcing** stores every change as an immutable event, “F12 held by Maya at 20:00:03”, in an append-only log. Current state is computed by replaying the events. Nothing is overwritten, so the history is the record.'], view: { hide: ['search', 'report'], tokens: [{ from: 'cmd', to: 'log', label: 'SeatHeld(F12, Maya)', tone: 'request' }] } },
    { kicker: 'Watch', title: 'Answer the dispute', body: ['Replay F12’s events: held at 20:00:03, paid at 20:01:10, cancellation requested at 20:05:00, cancellation rejected (past the cut-off). The dispute is settled from the record, not from memory.'], view: { hide: ['search', 'report'], values: { log: 'held · paid · cancel ✕' }, states: { log: 'focus' } }, changes: [{ kind: 'add', text: 'Full history of F12 available' }] },
    { kicker: 'Idea', title: 'CQRS: separate write and read models', body: ['**CQRS** (command query responsibility segregation) splits the model that handles changes from the models that serve reads. The event log feeds several **projections**: current seat state, a search index, a revenue report, each shaped for its own queries.'], view: { tokens: [{ from: 'log', to: 'search', label: 'event', tone: 'copy' }, { from: 'log', to: 'report', label: 'event', tone: 'copy' }] } },
    { kicker: 'Predict', title: 'A new report next quarter', body: ['Finance asks for “cancellations per venue per week, since launch”.'], view: { states: { report: 'active' } },
      predict: { id: 'new', prompt: 'With event sourcing, how do you build it?', choices: [
        { id: 'replay', text: 'Write a new projection and replay the log from the beginning.', why: 'Right. All history is there, so a new read model can be built after the fact.' },
        { id: 'cant', text: 'You can’t: that data was never stored.', why: 'That’s the problem with state-only tables. With events, every cancellation is in the log.' },
      ], correct: 'replay' } },
    { kicker: 'Trade-off', title: 'What it costs', body: ['Projections are **eventually consistent**: they lag the log slightly. Event formats live forever, so changing them needs versioning. Replaying years of events can be slow, so systems take snapshots. Use it where history and audit matter, not for every table.'], view: {} },
  ],
  worked: { title: 'state table vs event log', blocks: [
    { type: 'table', head: ['', 'State table', 'Event sourced'], rows: [['Stores', 'Latest value', 'Every change'], ['Audit / disputes', 'Needs a separate audit log', 'Built in'], ['New read models', 'Only from current data', 'Replay all history'], ['Reads', 'Direct', 'From projections (eventually consistent)'], ['Complexity', 'Low', 'Higher: versioning, snapshots, projections']] },
    { type: 'code', lang: 'python', code: 'def seat_state(events):\n    state = "available"\n    for ev in events:                       # replay in order\n        if ev["type"] == "held":\n            state = "held"\n        elif ev["type"] == "paid":\n            state = "booked"\n        elif ev["type"] in ("released", "refunded"):\n            state = "available"\n    return state\n\nseat_state([{"type": "held"}, {"type": "paid"}])   # "booked"', caption: 'Current state is a fold over the events.' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'A projection lags the event log by 2 seconds. A buyer pays and immediately opens “My tickets”, which reads a projection. What might they see?', choices: [
    { id: 'old', text: 'Their ticket missing for up to 2 seconds.', why: 'Right. Projections are eventually consistent. Read-your-writes techniques (or a “processing…” state) cover the gap.' },
    { id: 'err', text: 'An error.', why: 'The projection is just behind. It will catch up.' },
  ], correct: 'old' }],
  exercise: { id: 'when', prompt: 'Name one part of the booking system where event sourcing earns its cost, and one where it doesn’t.', checklist: ['Earns it: payments/booking history (audit, disputes).', 'Doesn’t: e.g. user display preferences or cached seat maps.'], model: 'Worth it for payments and booking lifecycle, where disputes and audits need the full history; not worth it for something like a user’s display preferences, where only the latest value matters.' },
  next: { id: 'monolith-microservices', reason: 'You’ve met the distributed toolbox. Next: deciding how to split a system into services at all.' },
};

export const DISTRIBUTED3 = [consensus, queues, logsDelivery, backpressure, batchStream, distributedTransactions, cqrsEventSourcing];
