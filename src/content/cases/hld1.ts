import { HLD_RUBRIC, type CaseStudy } from './_case';
import { e, layout, n } from '../lessons/_kit';

export const ticketBooking: CaseStudy = {
  id: 'case-ticket-booking',
  pairedWith: 'lld-booking',
  prompt: 'Design a ticketing system for concerts.',
  assumptions: ['3M bookings/month; on-sales spike to 50k hold attempts/min for one event.', 'Seats are individually assigned (no general admission in v1).', 'Holds last 10 minutes; payments go through an external provider.', 'A seat must never be sold twice.'],
  diagram: {
    nodes: [
      n('apps', 'client', 'Apps'), n('gw', 'lb', 'Gateway', { sub: 'auth, rate limit' }), n('catalog', 'service', 'Catalog', { sub: 'events, seat maps' }),
      n('booking', 'service', 'Booking', { sub: 'holds, orders' }), n('seatdb', 'db', 'Seat store', { sub: 'per-event partition' }), n('cache', 'cache', 'Seat-map cache'),
      n('pay', 'ext', 'Payment provider'), n('q', 'queue', 'Events', { sub: 'booking.confirmed' }), n('tix', 'service', 'Tickets + email'),
    ],
    edges: [e('apps', 'gw'), e('gw', 'catalog'), e('gw', 'booking'), e('catalog', 'cache'), e('booking', 'seatdb'), e('booking', 'pay', 'charge'), e('booking', 'q'), e('q', 'tix')],
    ...layout(380, 600, {
      apps: [{ x: 80, y: 190, w: 110 }, { x: 180, y: 35, w: 160 }],
      gw: [{ x: 240, y: 190, w: 150 }, { x: 180, y: 130, w: 200 }],
      catalog: [{ x: 440, y: 70, w: 160 }, { x: 92, y: 240, w: 160 }],
      cache: [{ x: 690, y: 70, w: 160 }, { x: 92, y: 350, w: 160 }],
      booking: [{ x: 440, y: 190, w: 160 }, { x: 268, y: 240, w: 160 }],
      seatdb: [{ x: 690, y: 190, w: 160 }, { x: 268, y: 350, w: 160 }],
      pay: [{ x: 440, y: 320, w: 170 }, { x: 92, y: 460, w: 160 }],
      q: [{ x: 610, y: 320, w: 150 }, { x: 268, y: 460, w: 160 }],
      tix: [{ x: 760, y: 320, w: 110 }, { x: 180, y: 560, w: 200 }],
    }),
  },
  stages: [
    { kind: 'clarify', title: 'What exactly must it do?', task: 'List the questions you’d ask before designing. Which answers change the architecture most?', hints: ['Think about seat assignment, holds, payment, and the busiest moment.', 'What happens if two buyers want the same seat?'], view: { hide: ['catalog', 'cache', 'booking', 'seatdb', 'pay', 'q', 'tix'] },
      reference: [{ type: 'list', items: ['Assigned seats or general admission? (assigned changes everything: per-seat state)', 'How long is a hold, and what if payment arrives after it expires?', 'Peak load: how many people hit one on-sale at once? (50k holds/min)', 'Must it never double-sell? (yes: correctness beats availability for holds)', 'Refunds, transfers, resale: in scope for v1? (no)'] }] },
    { kind: 'simple', title: 'Sketch the first design', task: 'Name the main parts and which one owns seat availability.', hints: ['Split read-heavy browsing from write-critical holding.', 'One part should own seat state; others ask it.'], view: { hide: ['q', 'tix', 'cache'], states: { booking: 'focus', seatdb: 'focus' } },
      reference: [{ type: 'p', text: 'Catalog serves events and seat maps (read-heavy, cacheable). **Booking owns seat state**: holds, orders, and the seat store. Payments are an external call. Confirmed bookings publish an event; tickets and emails are produced asynchronously from it.' }, { type: 'code', lang: 'http', code: 'POST /v1/holds {event_id, seat_id}  Idempotency-Key: …   → 201 {hold_id, expires_at} | 409 seat_unavailable\nPOST /v1/orders {hold_id, payment_token}                → 201 {order_id, status}' }] },
    { kind: 'critical-path', title: 'Make the hold correct', task: 'How does a hold guarantee one seat, one buyer, when 5,000 people tap the same seat in the same second?', hints: ['Recall the first lesson’s race.', 'Can the check and the write be one database operation?'], view: { states: { booking: 'active', seatdb: 'focus' }, dim: ['catalog', 'cache', 'pay', 'q', 'tix'], tags: { seatdb: { text: 'conditional write', tone: 'ok' } } },
      reference: [{ type: 'code', lang: 'sql', code: "UPDATE seats SET state = 'held', holder = $buyer, hold_expires_at = now() + interval '10 min'\nWHERE event_id = $event AND seat_id = $seat\n  AND (state = 'available' OR (state = 'held' AND hold_expires_at < now()));\n-- 1 row → hold succeeded; 0 rows → 409 seat_unavailable" }, { type: 'p', text: 'Partition seats by event so one event’s holds hit one database leader, which serialises writes per row cheaply. Expired holds are reclaimed by the same statement, so no sweeper is needed for correctness (a background job can tidy up).' }] },
    { kind: 'failure', title: 'The payment comes back late', task: 'A buyer’s payment succeeds at 10:11. Their hold expired at 10:10, and someone else now holds the seat. What should happen?', hints: ['Which step must never be lost: the money or the seat?', 'What’s the compensating action?'], view: { states: { pay: 'active', booking: 'fail' }, tags: { booking: { text: 'hold expired', tone: 'fail' } } },
      reference: [{ type: 'list', items: ['Confirm only with a conditional update: `… SET state = \'booked\' WHERE holder = $buyer AND state = \'held\' AND hold_expires_at > $paid_at`.', 'If it fails, **refund automatically** (idempotent by order id) and tell the buyer clearly. Never take money without a seat.', 'Reduce the window: authorise payment before the hold ends, capture after confirming; extend a hold by a minute when payment is in flight.', 'Duplicate confirmation (retried webhook): the order id makes confirmation idempotent.'] }] },
    { kind: 'change', title: 'New requirement: a fair queue', task: 'For the biggest on-sales, the business wants a virtual waiting room so people are let in in order. Where does it fit and what does it protect?', hints: ['What should happen before a buyer can even reach the hold endpoint?'], view: { states: { gw: 'focus' }, tags: { gw: { text: '+ waiting room', tone: 'changed' } } },
      reference: [{ type: 'p', text: 'Put a waiting room in front of the booking flow (at the gateway/edge). Visitors get a position token, and the room admits N per second, matching what holds can absorb. It turns an uncontrolled spike into steady load, adds fairness, and lets you reject bots before they touch seat state. Cost: another critical component, which must itself be highly available and cheap per visitor (static page plus a token service).' }] },
    { kind: 'compare', title: 'Lock seats in the database, or in a cache?', task: 'Some designs hold seats in Redis with a TTL instead of the database. When would you choose each?', hints: ['Which is the source of truth if they disagree?'],
      reference: [{ type: 'p', text: 'Database conditional writes are simplest and correct by construction; they scale per event with partitioning. A Redis hold (SET NX with TTL) is faster at extreme peaks, but now two stores must agree, and a Redis failover can lose holds. Choose Redis only with the database still enforcing the final booking.' }] },
  ],
  alternatives: [
    { name: 'Database conditional writes, partitioned by event', when: 'Default: correctness first, one source of truth', cost: 'Very hot events concentrate on one partition; needs a waiting room at extreme peaks' },
    { name: 'In-memory hold service (Redis) + DB confirmation', when: 'Holds at very high rates for a few huge events', cost: 'Two stores to reconcile; holds can be lost on failover' },
    { name: 'Per-event single-writer actor (one process owns an event)', when: 'Complex seat-selection logic per event', cost: 'Routing and failover of the owner process' },
  ],
  checks: [
    { kind: 'choice', id: 'q1', prompt: 'Which part should be the single owner of seat availability?', choices: [{ id: 'b', text: 'The booking service and its seat store', why: 'Right. Everyone else asks it.' }, { id: 'c', text: 'The seat-map cache', why: 'The cache is a copy for display; holds must use the source of truth.' }], correct: 'b' },
    { kind: 'choice', id: 'q2', prompt: 'Payment succeeded but the hold expired and the seat is gone. Best outcome?', choices: [{ id: 'r', text: 'Automatic idempotent refund and a clear message', why: 'Right. Never keep money without delivering the seat.' }, { id: 'k', text: 'Give the seat to the late payer anyway', why: 'That double-sells the seat to whoever holds it now.' }], correct: 'r' },
  ],
  rubric: HLD_RUBRIC({ requirements: 'Asks about assigned seats, hold length, late payment, and peak load before designing.', estimates: 'Derives peak hold rate and seat-map read rate; notices one event can dominate.', api: 'Defines hold and order endpoints with idempotency keys and a 409 for unavailable seats.', data: 'Seat rows partitioned by event with state, holder, expiry; orders reference holds.', path: 'Makes the hold a single conditional write; confirms with another conditional write.', failure: 'Handles late payment with an idempotent refund, retries, and peak protection (waiting room).' }),
};

export const notifications: CaseStudy = {
  id: 'case-notifications',
  pairedWith: 'lld-notifications',
  prompt: 'Design a notification system.',
  assumptions: ['Channels: email, SMS, push. 50M notifications/day, peaks of 20k/s when a big event announces.', 'Some notifications are critical (tickets), most are not (marketing).', 'Third-party providers deliver email/SMS/push and sometimes fail or throttle.'],
  diagram: {
    nodes: [n('src', 'service', 'Producers', { sub: 'booking, marketing' }), n('api', 'service', 'Notify API', { sub: 'validate, dedupe' }), n('prefs', 'db', 'Preferences', { sub: 'opt-outs, channels' }), n('q', 'queue', 'Queues', { sub: 'per channel + priority' }), n('workers', 'server', 'Channel workers', { stack: 3 }), n('prov', 'ext', 'Providers', { sub: 'email / SMS / push' }), n('log', 'db', 'Delivery log', { sub: 'status per message' })],
    edges: [e('src', 'api'), e('api', 'prefs'), e('api', 'q'), e('q', 'workers'), e('workers', 'prov'), e('workers', 'log')],
    ...layout(330, 560, {
      src: [{ x: 90, y: 165, w: 150 }, { x: 180, y: 35, w: 200 }],
      api: [{ x: 280, y: 165, w: 160 }, { x: 180, y: 130, w: 200 }],
      prefs: [{ x: 280, y: 290, w: 160 }, { x: 92, y: 240, w: 160 }],
      q: [{ x: 480, y: 165, w: 170 }, { x: 268, y: 240, w: 160 }],
      workers: [{ x: 690, y: 80, w: 170 }, { x: 180, y: 350, w: 200 }],
      prov: [{ x: 690, y: 200, w: 170 }, { x: 92, y: 470, w: 160 }],
      log: [{ x: 690, y: 300, w: 170 }, { x: 268, y: 470, w: 160 }],
    }),
  },
  stages: [
    { kind: 'clarify', title: 'Which notifications, how reliable?', task: 'What do you need to know about channels, volume and guarantees?', hints: ['Are all notifications equally important?', 'What happens if a user gets the same message twice?'], view: { hide: ['prefs', 'q', 'workers', 'prov', 'log'] },
      reference: [{ type: 'list', items: ['Channels and their providers; user preferences and opt-outs (legal requirement for marketing).', 'Priorities: a ticket must arrive; a promo can be delayed or dropped.', 'Volume and peaks (fan-out when one artist announces to 2M followers).', 'Delivery guarantee: at-least-once with deduplication; duplicates are annoying, losses are worse for tickets.'] }] },
    { kind: 'simple', title: 'Sketch the pipeline', task: 'Draw the path from “booking confirmed” to an email in someone’s inbox.', hints: ['Producers shouldn’t wait for providers.'], view: { hide: ['log'], states: { q: 'focus' } },
      reference: [{ type: 'p', text: 'Producers call a Notify API that validates, checks preferences, assigns an idempotency key, and enqueues per-channel messages. Channel workers pull from queues, render templates, and call providers. Separate queues per channel and per priority so marketing never delays tickets.' }] },
    { kind: 'critical-path', title: 'Fan-out to 2 million followers', task: 'An artist announces a tour to 2M followers. How do you turn one event into 2M messages without overwhelming anything?', hints: ['Expand in batches; respect provider rate limits.'], view: { states: { api: 'active', q: 'active' } },
      reference: [{ type: 'list', items: ['A fan-out job pages through followers (e.g. 10k per batch) and enqueues messages; it’s resumable from a cursor if it crashes.', 'Workers respect each provider’s rate limit (token bucket per provider), and the queue absorbs the rest.', 'Marketing fan-out runs on low-priority queues and can be slowed or paused under load.'] }] },
    { kind: 'failure', title: 'A provider fails half the time', task: 'The SMS provider returns errors for 50% of requests for ten minutes. What do workers do, and how do you avoid sending duplicates?', hints: ['Retry policy, circuit breaker, a second provider?', 'What if a send succeeded but the response was lost?'], view: { states: { prov: 'fail', workers: 'active' }, tags: { prov: { text: '50% errors', tone: 'fail' } } },
      reference: [{ type: 'list', items: ['Retry transient errors with exponential backoff and jitter; cap attempts; then dead-letter.', 'A circuit breaker stops hammering the failing provider and fails over to a secondary for critical messages.', 'Send with an idempotency key where providers support it; record each message’s status in the delivery log and skip messages already marked sent.', 'Partial delivery is normal: track status per channel (email sent, SMS failed) rather than one status per notification.'] }] },
    { kind: 'change', title: 'New requirement: quiet hours', task: 'Users may not receive non-critical notifications between 22:00 and 08:00 in their own time zone. Where does that logic live?', hints: ['At enqueue time or at send time?'], view: { states: { prefs: 'focus', workers: 'active' } },
      reference: [{ type: 'p', text: 'Check at send time in the worker (preferences can change after enqueue). Defer the message with a scheduled “not before” time rather than dropping it. Critical messages bypass quiet hours. Store the user’s time zone in preferences.' }] },
    { kind: 'compare', title: 'Queue per channel, or one queue?', task: 'Compare one shared queue with a queue per channel and priority.', hints: ['What happens when SMS is slow?'],
      reference: [{ type: 'p', text: 'One queue is simple but a slow channel blocks everything behind it (head-of-line blocking), and a marketing burst delays tickets. Per-channel, per-priority queues isolate failures and let you scale workers per channel, at the cost of more queues to operate.' }] },
  ],
  alternatives: [{ name: 'Per-channel, per-priority queues', when: 'Mixed criticality, several providers', cost: 'More queues and workers to run' }, { name: 'Single queue with priorities', when: 'Low volume, one channel', cost: 'Head-of-line blocking when one channel slows' }],
  checks: [
    { kind: 'choice', id: 'q1', prompt: 'A worker sent an email, then crashed before recording it. The message is redelivered. How do you avoid a duplicate?', choices: [{ id: 'k', text: 'Idempotency key per notification, checked against the delivery log (and passed to the provider when supported)', why: 'Right.' }, { id: 'n', text: 'Never retry', why: 'Then crashes lose critical messages.' }], correct: 'k' },
    { kind: 'choice', id: 'q2', prompt: 'Why separate queues for tickets and marketing?', choices: [{ id: 'iso', text: 'A marketing burst or slow channel must not delay tickets', why: 'Right: isolation by priority.' }, { id: 'cost', text: 'It’s cheaper', why: 'It’s more to run. The benefit is isolation.' }], correct: 'iso' },
  ],
  rubric: HLD_RUBRIC({ requirements: 'Separates critical from bulk; asks about preferences, opt-outs and peaks.', estimates: '50M/day ≈ 580/s average, 20k/s peaks; fan-out batch sizing.', api: 'Notify API with idempotency key, channel list, priority, template id.', data: 'Preferences per user; delivery log per message and channel.', path: 'Async pipeline with per-channel queues and rate-limited workers.', failure: 'Backoff, circuit breaker, failover provider, dedup, partial delivery tracked.' }),
};

export const liveScores: CaseStudy = {
  id: 'case-live-scores',
  pairedWith: 'lld-live-scores',
  prompt: 'Design live scores for a football app, with fan rooms where supporters chat during the match.',
  assumptions: ['5M concurrent viewers in a big match; score events are rare (a few per minute) but fan rooms are chatty.', 'Score feed comes from a data provider and occasionally sends duplicates, out-of-order events and corrections (a goal disallowed by VAR).', 'Clients are phones on flaky mobile networks.'],
  diagram: {
    nodes: [n('feed', 'ext', 'Score feed'), n('ingest', 'service', 'Ingest', { sub: 'dedupe, order, correct' }), n('log', 'queue', 'Match event log', { sub: 'per match, sequenced' }), n('state', 'db', 'Match state'), n('fanout', 'server', 'Push gateways', { stack: 3, sub: 'SSE / WebSocket' }), n('fans', 'client', 'Fans', { stack: 3 }), n('rooms', 'service', 'Fan rooms', { sub: 'chat, sharded by room' })],
    edges: [e('feed', 'ingest'), e('ingest', 'log'), e('log', 'state'), e('log', 'fanout'), e('fanout', 'fans'), e('fans', 'rooms')],
    ...layout(330, 560, {
      feed: [{ x: 80, y: 90, w: 130 }, { x: 180, y: 35, w: 170 }],
      ingest: [{ x: 260, y: 90, w: 170 }, { x: 180, y: 130, w: 210 }],
      log: [{ x: 470, y: 90, w: 190 }, { x: 180, y: 230, w: 220 }],
      state: [{ x: 470, y: 240, w: 160 }, { x: 92, y: 340, w: 160 }],
      fanout: [{ x: 700, y: 90, w: 170 }, { x: 268, y: 340, w: 160 }],
      fans: [{ x: 700, y: 240, w: 150 }, { x: 268, y: 460, w: 160 }],
      rooms: [{ x: 260, y: 260, w: 170 }, { x: 92, y: 460, w: 160 }],
    }),
  },
  stages: [
    { kind: 'clarify', title: 'How fresh, how many, how messy?', task: 'What do you need to know about latency, scale and the feed itself?', hints: ['What does the provider’s feed actually guarantee?'], view: { hide: ['state', 'fanout', 'fans', 'rooms', 'log'] },
      reference: [{ type: 'list', items: ['Target: a goal reaches phones within ~2 s.', 'Viewers: 5M concurrent in a final; rooms of up to 100k fans.', 'Feed quality: duplicates, out-of-order delivery, corrections (VAR).', 'Clients reconnect constantly on mobile networks and must catch up.'] }] },
    { kind: 'simple', title: 'From feed to phones', task: 'Sketch the path of one goal from the provider to 5 million phones.', hints: ['Push, not polling. One-way updates fit SSE.'], view: { hide: ['rooms'], states: { log: 'focus' } },
      reference: [{ type: 'p', text: 'Ingest normalises provider events into a per-match **event log** with sequence numbers. A projection keeps current match state. Push gateways hold SSE/WebSocket connections and forward new events for the matches each client follows.' }] },
    { kind: 'critical-path', title: 'Duplicates, order and corrections', task: 'The feed sends goal #3 twice, and later sends “goal #3 disallowed”. How does ingest keep the score right?', hints: ['Give every event an id and a sequence; corrections are events too.'], view: { states: { ingest: 'focus', log: 'active' }, tags: { ingest: { text: 'dedupe + sequence', tone: 'ok' } } },
      reference: [{ type: 'list', items: ['Dedupe by provider event id (idempotent ingest).', 'Assign a per-match sequence number in one place (the ingest partition for that match), so every client applies events in the same order.', 'Model corrections as new events (`GoalDisallowed(goal_id)`), never as edits: state is a fold over the log, and clients receive the correction like any other event.', 'The LLD of this processor is the [paired case](/cases/lld-live-scores).'] }] },
    { kind: 'failure', title: 'A million reconnects at half-time', task: 'A gateway restarts and 500k clients reconnect at once, each having missed some events. What do they get, and how do you avoid a stampede?', hints: ['Clients can tell you the last sequence they saw.'], view: { states: { fanout: 'fail', fans: 'active' } },
      reference: [{ type: 'list', items: ['Clients reconnect with `Last-Event-ID` (their last sequence); the gateway replays missing events from the log, or sends a snapshot if too far behind.', 'Clients reconnect with exponential backoff and jitter, so 500k don’t arrive in the same second.', 'Snapshots of match state are cached at the edge, so catch-up reads don’t hit the database.'] }] },
    { kind: 'change', title: 'New requirement: fan rooms', task: 'Each match gets fan rooms (up to 100k members) with live chat. How is this different from score pushes?', hints: ['Who writes? How many messages per second?'], view: { states: { rooms: 'focus' } },
      reference: [{ type: 'p', text: 'Scores are few writes and huge fan-out; chat is many writes from many users. Shard rooms across chat servers by room id; for very large rooms, sample or rate-limit what each client receives (no one can read 2,000 messages a second). Moderate and rate-limit senders. Keep chat separate from the score path so a chat flood can’t delay goals.' }] },
    { kind: 'compare', title: 'SSE or WebSockets?', task: 'Which would you choose for scores, and for rooms?', hints: ['Direction of traffic.'],
      reference: [{ type: 'p', text: 'Scores: SSE. One-way, plain HTTP, built-in reconnection with last event id. Rooms: WebSockets, since users send as well as receive. Running both is fine; or use WebSockets for everything to keep one connection per client.' }] },
  ],
  alternatives: [{ name: 'Per-match event log + SSE gateways', when: 'Ordered, replayable updates to many readers', cost: 'Gateway fleet holding millions of connections' }, { name: 'Polling a cached scoreboard', when: 'Smaller apps, 10–30 s freshness acceptable', cost: 'Staleness and wasted requests at scale' }],
  checks: [
    { kind: 'choice', id: 'q1', prompt: 'How should a VAR correction be represented?', choices: [{ id: 'ev', text: 'As a new event in the log (GoalDisallowed)', why: 'Right: history is preserved, every client applies it in order.' }, { id: 'edit', text: 'By editing the original goal event', why: 'Clients that already applied it would never learn it changed.' }], correct: 'ev' },
    { kind: 'choice', id: 'q2', prompt: 'A client reconnects after 30 seconds offline. What does it need?', choices: [{ id: 'replay', text: 'The events after its last sequence number (or a snapshot)', why: 'Right.' }, { id: 'all', text: 'Every event since kickoff', why: 'Wasteful; replay from where it left off.' }], correct: 'replay' },
  ],
  rubric: HLD_RUBRIC({ requirements: 'Pins down freshness target, viewer count, feed messiness and reconnect behaviour.', estimates: '5M connections → gateway count; events/min tiny; chat messages/s per room large.', api: 'Subscribe(match_id, last_seq) stream; room send/receive.', data: 'Per-match event log with sequence; projected match state; snapshots.', path: 'Ingest dedupes, sequences, corrects; gateways push.', failure: 'Reconnect with last id + jitter; snapshots; isolation of chat from scores.' }),
};

export const urlShortener: CaseStudy = {
  id: 'case-url-shortener',
  prompt: 'Design a URL shortener.',
  assumptions: ['100M new links/month; reads are 100× writes; links never expire unless deleted.', 'Short codes 7 characters, base62.', 'Redirect latency p99 < 50 ms worldwide.'],
  diagram: {
    nodes: [n('user', 'client', 'Browser'), n('edge', 'cache', 'CDN / edge cache'), n('redir', 'service', 'Redirect service'), n('cache', 'cache', 'Code cache'), n('db', 'db', 'Links store', { sub: 'code → URL' }), n('create', 'service', 'Create API'), n('ids', 'box', 'ID generator')],
    edges: [e('user', 'edge'), e('edge', 'redir'), e('redir', 'cache'), e('redir', 'db'), e('create', 'ids'), e('create', 'db')],
    ...layout(320, 540, {
      user: [{ x: 80, y: 90, w: 120 }, { x: 180, y: 35, w: 160 }],
      edge: [{ x: 260, y: 90, w: 170 }, { x: 180, y: 130, w: 200 }],
      redir: [{ x: 470, y: 90, w: 170 }, { x: 180, y: 230, w: 200 }],
      cache: [{ x: 700, y: 50, w: 150 }, { x: 92, y: 340, w: 160 }],
      db: [{ x: 700, y: 170, w: 150 }, { x: 268, y: 340, w: 160 }],
      create: [{ x: 470, y: 250, w: 170 }, { x: 92, y: 460, w: 160 }],
      ids: [{ x: 700, y: 270, w: 150 }, { x: 268, y: 460, w: 160 }],
    }),
  },
  stages: [
    { kind: 'clarify', title: 'Scope and scale', task: 'What do you ask first?', hints: ['Custom aliases? Expiry? Analytics?'], view: { hide: ['edge', 'cache', 'create', 'ids'] }, reference: [{ type: 'list', items: ['Custom aliases (yes, optional), expiry (no), analytics (click counts, later).', 'Writes: 100M/month ≈ 40/s average; reads ≈ 4,000/s average, peaks far higher for viral links.', 'Storage: 100M × ~500 B ≈ 50 GB/month, ~600 GB/year.'] }] },
    { kind: 'simple', title: 'Create and redirect', task: 'Describe the create and redirect flows and the API.', hints: ['301 or 302?'], view: { hide: ['edge', 'cache'], states: { db: 'focus' } }, reference: [{ type: 'code', lang: 'http', code: 'POST /v1/links {url, alias?} → 201 {code: "aZ3kQ9x"}\nGET /aZ3kQ9x → 302 Location: https://…' }, { type: 'p', text: 'Use 302 if you need click analytics (browsers cache 301s and stop asking). Store `code → url` in a key-value store partitioned by code.' }] },
    { kind: 'critical-path', title: 'Generating unique codes', task: 'How do you generate 7-character codes without collisions at 40 writes/s (and bursts of 1,000/s)?', hints: ['Counter + base62, or random + check?'], view: { states: { ids: 'focus', create: 'active' } }, reference: [{ type: 'list', items: ['Option A: a distributed counter (ranges handed out to each server, e.g. 10,000 at a time) encoded in base62. No collisions, but codes are guessable in sequence.', 'Option B: random 7 base62 chars (62⁷ ≈ 3.5 trillion) with a conditional insert; retry on the rare collision. Unguessable.', 'Custom aliases: conditional insert; 409 if taken.'] }] },
    { kind: 'failure', title: 'One link goes viral', task: 'A link gets 200k clicks a second. What protects the store?', hints: ['Who could answer before the redirect service?'], view: { states: { edge: 'focus', cache: 'active' } }, reference: [{ type: 'p', text: 'Cache redirects at the CDN edge (with 302s, a short `Cache-Control: max-age` still works at the edge) and in an in-memory code cache. The hot key never reaches the database. Count clicks asynchronously (sampled logs or a stream), not with a database write per click.' }] },
    { kind: 'change', title: 'New requirement: delete abusive links fast', task: 'Trust & safety must disable a phishing link within a minute globally. What changes?', hints: ['Caches everywhere now hold the old redirect.'], reference: [{ type: 'p', text: 'Mark the link disabled in the store, then purge it from the CDN and the code cache (explicit invalidation). Keep edge TTLs short (e.g. 60 s) as a safety net, so even a missed purge expires within the target.' }] },
    { kind: 'compare', title: 'Counter or random codes?', task: 'Which code strategy would you pick, and why?', hints: ['Think about guessability and coordination.'], reference: [{ type: 'p', text: 'Random codes avoid coordination and are unguessable, at the cost of a rare retry. Counter ranges are collision-free and compact, but leak volume and allow enumeration. For a public shortener, random is usually preferred.' }] },
  ],
  alternatives: [{ name: 'Random base62 + conditional insert', when: 'Public service; unguessable codes', cost: 'Occasional retry; slightly larger codes for the same space' }, { name: 'Counter ranges + base62', when: 'Internal tool; shortest codes', cost: 'Guessable; range allocation service' }],
  checks: [
    { kind: 'choice', id: 'q1', prompt: 'Why might a shortener return 302 instead of 301?', choices: [{ id: 'a', text: 'So every click reaches the service and can be counted', why: 'Right: browsers cache 301 permanently.' }, { id: 'b', text: '302 is faster', why: 'Speed is similar; the difference is caching.' }], correct: 'a' },
    { kind: 'choice', id: 'q2', prompt: 'Where should a viral link’s redirect be answered?', choices: [{ id: 'edge', text: 'From the CDN edge / cache', why: 'Right.' }, { id: 'db', text: 'From the database each time', why: '200k reads/s on one key is a hot spot.' }], correct: 'edge' },
  ],
  rubric: HLD_RUBRIC({ requirements: 'Clarifies aliases, expiry, analytics and read/write ratio.', estimates: '~40 writes/s, ~4k reads/s average, ~600 GB/year.', api: 'POST create with optional alias; GET code → 302.', data: 'Key-value code → URL, partitioned by code.', path: 'Unique code generation without coordination bottleneck.', failure: 'Edge caching for hot links; async click counting; fast purge.' }),
};

export const rateLimiterCase: CaseStudy = {
  id: 'case-rate-limiter',
  prompt: 'Design a rate limiter for our public API.',
  assumptions: ['50 gateway servers; 200k requests/s total; limits per API key (e.g. 100 req/s with bursts of 200).', 'Limits should be roughly accurate (±10%) and add < 2 ms.', 'If the limiter itself fails, the API must stay up.'],
  diagram: {
    nodes: [n('clients', 'client', 'API clients', { stack: 3 }), n('gw', 'lb', 'Gateways', { stack: 3, sub: '50 servers' }), n('local', 'box', 'Local buckets', { sub: 'per gateway' }), n('redis', 'cache', 'Shared counters', { sub: 'Redis cluster' }), n('api', 'server', 'API servers'), n('cfg', 'db', 'Limit config')],
    edges: [e('clients', 'gw'), e('gw', 'local'), e('gw', 'redis', 'sync'), e('gw', 'api'), e('cfg', 'gw', 'push', { dashed: true })],
    ...layout(300, 480, {
      clients: [{ x: 90, y: 150, w: 140 }, { x: 180, y: 35, w: 180 }],
      gw: [{ x: 320, y: 150, w: 170 }, { x: 180, y: 140, w: 200 }],
      local: [{ x: 320, y: 270, w: 170 }, { x: 92, y: 260, w: 160 }],
      redis: [{ x: 600, y: 60, w: 180 }, { x: 268, y: 260, w: 160 }],
      api: [{ x: 600, y: 170, w: 180 }, { x: 92, y: 380, w: 160 }],
      cfg: [{ x: 600, y: 270, w: 180 }, { x: 268, y: 380, w: 160 }],
    }),
  },
  stages: [
    { kind: 'clarify', title: 'Limit what, how precisely?', task: 'What do you need to decide before choosing an algorithm?', hints: ['Per key, per IP, per endpoint? Hard or soft limit?'], view: { hide: ['local', 'redis', 'cfg'] }, reference: [{ type: 'list', items: ['Key: API key (per customer), with a looser per-IP limit for anonymous calls.', 'Algorithm: token bucket (bursts allowed, average enforced).', 'Accuracy vs latency: ±10% is acceptable; < 2 ms overhead.', 'Fail open: if the limiter is down, let traffic through (and alert).'] }] },
    { kind: 'simple', title: 'One gateway first', task: 'How does a single gateway enforce 100 req/s per key?', hints: ['What does a token bucket store?'], view: { hide: ['redis', 'cfg'], states: { local: 'focus' } }, reference: [{ type: 'p', text: 'A token bucket per key in memory: tokens and last-refill time. Each request refills by elapsed × rate, spends one token, or returns 429 with `Retry-After`. See the [rate limiting lesson](/learn/rate-limiting).' }] },
    { kind: 'critical-path', title: 'Fifty gateways, one limit', task: 'A customer’s requests are spread across 50 gateways. How do you enforce one shared limit?', hints: ['Central counter on every request, or local buckets synced periodically?'], view: { states: { redis: 'focus', gw: 'active' } }, reference: [{ type: 'list', items: ['Option A: every request does an atomic increment in a shared store (Redis + Lua script). Accurate; adds a network hop per request; the store must handle 200k ops/s.', 'Option B: each gateway gets a share of the limit and syncs usage every ~100 ms. Nearly free per request; slightly inaccurate at the edges.', 'Hybrid: local buckets for the fast path, periodic reconciliation through Redis.'] }] },
    { kind: 'failure', title: 'The counter store goes down', task: 'Redis is unreachable. What happens to API traffic?', hints: ['Fail open or fail closed?'], view: { states: { redis: 'fail' } }, reference: [{ type: 'p', text: 'Fail open to local-only limits (each gateway enforces limit ÷ N on its own) so the API stays up with approximate limiting. Alert. Failing closed would turn a limiter outage into a full API outage.' }] },
    { kind: 'change', title: 'New requirement: per-endpoint limits', task: 'Expensive endpoints (search) need tighter limits than cheap ones. What changes?', hints: ['What is the bucket key now?'], reference: [{ type: 'p', text: 'Key buckets by (api_key, endpoint class) with limits from config, pushed to gateways. Or charge different token costs per endpoint from one bucket (search costs 10 tokens). Same algorithm, different keys and costs.' }] },
    { kind: 'compare', title: 'Exact or approximate?', task: 'When is the extra network hop of exact counting worth it?', hints: ['What does a 10% overshoot cost?'], reference: [{ type: 'p', text: 'Exact shared counting matters when a limit protects money or a fragile dependency (e.g. paid quota). For protecting capacity, approximate local buckets are cheaper, faster and more resilient.' }] },
  ],
  alternatives: [{ name: 'Central atomic counters', when: 'Billing-grade accuracy', cost: 'Extra hop per request; counter store is critical' }, { name: 'Local buckets with periodic sync', when: 'Capacity protection, low latency', cost: '±N% overshoot' }],
  checks: [
    { kind: 'choice', id: 'q1', prompt: 'The limiter’s store is down. Recommended behaviour?', choices: [{ id: 'open', text: 'Fail open to local approximate limits and alert', why: 'Right.' }, { id: 'closed', text: 'Reject all requests', why: 'That makes the limiter a single point of failure for the whole API.' }], correct: 'open' },
    { kind: 'choice', id: 'q2', prompt: 'What HTTP response should a limited request get?', choices: [{ id: '429', text: '429 with Retry-After', why: 'Right.' }, { id: '500', text: '500', why: 'Nothing broke; the client is over its limit.' }], correct: '429' },
  ],
  rubric: HLD_RUBRIC({ requirements: 'Clarifies key, precision, latency budget and failure mode.', estimates: '200k req/s over 50 gateways = 4k/s each; store ops if centralised.', api: '429 + Retry-After + rate-limit headers.', data: 'Bucket state per key (tokens, timestamp); limit config.', path: 'Local fast path with shared reconciliation.', failure: 'Fail open; limiter never takes the API down.' }),
};

export const chat: CaseStudy = {
  id: 'case-chat',
  prompt: 'Design a chat app.',
  assumptions: ['50M daily users, 1:1 and group chats (up to 500 members).', 'Messages delivered in order within a conversation; online delivery < 500 ms.', 'History kept forever; multi-device.'],
  diagram: {
    nodes: [n('clients', 'client', 'Phones', { stack: 3 }), n('gw', 'server', 'Connection gateways', { stack: 3, sub: 'WebSocket' }), n('chat', 'service', 'Chat service', { sub: 'sequence, store, fan out' }), n('store', 'db', 'Message store', { sub: 'by conversation' }), n('presence', 'cache', 'Presence / routing', { sub: 'user → gateway' }), n('push', 'ext', 'Mobile push')],
    edges: [e('clients', 'gw'), e('gw', 'chat'), e('chat', 'store'), e('chat', 'presence'), e('chat', 'push', 'offline')],
    ...layout(300, 480, {
      clients: [{ x: 90, y: 150, w: 130 }, { x: 180, y: 35, w: 170 }],
      gw: [{ x: 300, y: 150, w: 190 }, { x: 180, y: 140, w: 220 }],
      chat: [{ x: 540, y: 150, w: 190 }, { x: 180, y: 250, w: 220 }],
      store: [{ x: 760, y: 60, w: 110 }, { x: 70, y: 380, w: 124 }],
      presence: [{ x: 760, y: 160, w: 110 }, { x: 180, y: 380, w: 92 }],
      push: [{ x: 760, y: 260, w: 110 }, { x: 290, y: 380, w: 124 }],
    }),
  },
  stages: [
    { kind: 'clarify', title: 'What kind of chat?', task: 'Which requirements decide the design?', hints: ['Group size, ordering, history, multi-device.'], view: { hide: ['store', 'presence', 'push'] }, reference: [{ type: 'list', items: ['1:1 and groups up to 500; ordering within a conversation; read receipts later.', '50M DAU × ~40 messages/day ≈ 2B messages/day ≈ 23k/s average.', 'History forever: ~2B × 200 B ≈ 400 GB/day.'] }] },
    { kind: 'simple', title: 'Send and receive', task: 'Trace a message from Maya’s phone to Leo’s.', hints: ['Persistent connections; who knows which gateway Leo is on?'], view: { states: { chat: 'focus' } }, reference: [{ type: 'p', text: 'Maya’s phone sends over its WebSocket to a gateway. The chat service assigns the next sequence number for the conversation, stores the message, looks up Leo’s gateway in the presence store, and forwards it. If Leo is offline, send a mobile push; he fetches history on reconnect.' }] },
    { kind: 'critical-path', title: 'Ordering', task: 'How does everyone in a group see messages in the same order?', hints: ['Phone clocks can’t be trusted.'], view: { states: { chat: 'focus', store: 'active' } }, reference: [{ type: 'p', text: 'Route each conversation to one partition (by conversation id) that assigns increasing sequence numbers. Clients display by sequence, not by device timestamp. See [Clocks and ordering](/learn/clocks-ordering).' }] },
    { kind: 'failure', title: 'Flaky networks', task: 'A message is sent, the phone loses signal before the acknowledgement. The app resends. What prevents a duplicate?', hints: ['Client-generated id.'], view: { states: { clients: 'active' } }, reference: [{ type: 'p', text: 'Each message carries a client-generated id; the chat service deduplicates on (conversation, client id) and returns the already-assigned sequence. On reconnect, clients ask for messages after the last sequence they have.' }] },
    { kind: 'change', title: 'New requirement: 100k-member channels', task: 'Broadcast channels with 100k members. What breaks?', hints: ['Fan-out on write to 100k inboxes per message?'], reference: [{ type: 'p', text: 'Fan-out to each member’s connection per message is heavy. For big channels, store once and let clients pull (or receive a lightweight “new messages” nudge), batch delivery, and rate-limit posters. Treat it like the live-scores fan-out rather than small-group chat.' }] },
    { kind: 'compare', title: 'Store by conversation or by user inbox?', task: 'Compare storing messages per conversation with copying into each recipient’s inbox.', hints: ['Read pattern vs write cost.'], reference: [{ type: 'p', text: 'Per-conversation storage writes once and reads by conversation (great for groups). Per-user inboxes make “all my unread” cheap but multiply writes by group size. Small groups can do either; large groups favour per-conversation.' }] },
  ],
  alternatives: [{ name: 'Per-conversation log + presence routing', when: 'Groups, ordered history', cost: 'Must look up gateways; hot big groups' }, { name: 'Per-user inbox fan-out', when: 'Mostly 1:1, cheap unread counts', cost: 'Write amplification in groups' }],
  checks: [
    { kind: 'choice', id: 'q1', prompt: 'What orders messages in a conversation?', choices: [{ id: 'seq', text: 'A sequence number assigned by the conversation’s partition', why: 'Right.' }, { id: 'ts', text: 'The sender’s phone clock', why: 'Phone clocks drift and can be wrong by minutes.' }], correct: 'seq' },
    { kind: 'choice', id: 'q2', prompt: 'How do you avoid duplicates from resends?', choices: [{ id: 'id', text: 'Client message id, deduplicated by the server', why: 'Right.' }, { id: 'none', text: 'Disable resends', why: 'Then lost acknowledgements lose messages.' }], correct: 'id' },
  ],
  rubric: HLD_RUBRIC({ requirements: 'Group size, ordering, history, offline delivery.', estimates: '~23k msgs/s average; storage per day; connections per gateway.', api: 'WebSocket send/receive with client message ids; history fetch after sequence.', data: 'Messages by conversation with sequence; presence map.', path: 'Gateway → chat service (sequence, store) → recipient gateway or push.', failure: 'Dedup, reconnect catch-up, gateway restarts, big-channel fan-out.' }),
};

export const HLD_CASES_1 = [ticketBooking, notifications, liveScores, urlShortener, rateLimiterCase, chat];
