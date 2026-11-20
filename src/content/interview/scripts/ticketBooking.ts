import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const ticketBooking: InterviewScript = {
  caseId: 'case-ticket-booking',
  track: 'hld',
  doLine: 'Place the parts behind “Reserve”, race two buyers for the last seat, then keep a payment timeout from charging twice',
  skills: ['concurrency', 'architecture', 'reliability', 'caching'],
  brief: {
    interviewer: { name: 'Priya', role: 'staff engineer on the ticketing team' },
    intro: 'We sell concert tickets on phones. Big artists sell out in minutes, and our worst support tickets are people charged for a seat someone else got.',
    users: 'Fans buying tickets for assigned seats on the phone app.',
    needs: ['Browse an event and see which seats are free', 'Reserve a specific seat, which holds it for them for ten minutes', 'Pay inside the hold and get the ticket by email'],
    mustHold: ['A seat is never sold twice', 'Nobody is charged without getting a seat (late payments are refunded automatically)', 'The seat map may lag a few seconds; a hold must not'],
    constraints: ['3 million bookings a month', 'At a big on-sale, up to 50,000 hold attempts in one minute, mostly for one event', 'Holds last 10 minutes', 'Payments go through an external provider that sometimes times out'],
    outOfScope: ['Refunds on request, transfers and resale', 'General-admission tickets', 'Pricing'],
    terms: [
      { term: 'hold', meaning: 'a temporary reservation that keeps one seat for one buyer for ten minutes' },
      { term: 'on-sale', meaning: 'the moment tickets for an event are released, when traffic spikes' },
      { term: 'source of truth', meaning: 'the one place whose answer wins when copies disagree' },
      { term: 'idempotency key', meaning: 'an id sent with a request so that repeating the request does not repeat its effect' },
    ],
    firstMove: 'Two people can try to reserve the last seat at the same time. A reservation holds the seat for ten minutes. Only one person can complete the purchase. Show me what happens after someone taps Reserve.',
  },
  palette: [
    { type: 'app', kind: 'client', name: 'Ticket app', blurb: 'The fan’s phone app. It shows the seat map and sends Reserve and Pay.' },
    { type: 'booking', kind: 'service', name: 'Booking service', blurb: 'Your code for holds and orders: checks a seat, holds it, confirms it.' },
    { type: 'seat-db', kind: 'db', name: 'Seat store', blurb: 'A database table with one row per seat: state, holder, hold expiry.' },
    { type: 'catalog', kind: 'service', name: 'Catalog service', blurb: 'Serves events and seat maps for browsing. Read-heavy.' },
    { type: 'seat-cache', kind: 'cache', name: 'Seat-map cache', blurb: 'A fast copy of each event’s seat map. It can be a few seconds old.' },
    { type: 'payment', kind: 'ext', name: 'Payment provider', blurb: 'An outside company that charges cards. Usually replies in 2 s; sometimes times out.' },
    { type: 'events', kind: 'queue', name: 'Event queue', blurb: 'Holds “booking confirmed” messages until a worker takes them.' },
    { type: 'tickets', kind: 'worker', name: 'Ticket + email worker', blurb: 'Makes the ticket and sends the email after a booking is confirmed.' },
    { type: 'waiting-room', kind: 'gateway', name: 'Waiting room', blurb: 'Lets fans in a few thousand at a time during an on-sale.' },
  ],
  verbs: ['sends request', 'reads from', 'writes to', 'reads and writes', 'invalidates', 'calls', 'publishes event', 'delivers to'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'assigned', q: 'Are seats assigned, or is it general admission?', a: 'Assigned. Every seat has its own row in the map: F12 is F12.' },
          { id: 'peak', q: 'How busy does it get?', a: 'Quiet most of the time. At a big on-sale, up to 50,000 people try to hold seats in one minute, mostly for one event.' },
          { id: 'stale', q: 'Can the seat map be slightly out of date?', a: 'Yes, by a few seconds. The hold itself must be exact.' },
          { id: 'payment', q: 'Who handles payment, and how reliable is it?', a: 'An external provider. It usually replies in under two seconds, but sometimes it times out.' },
          { id: 'expiry', q: 'What happens when a hold runs out?', a: 'After ten minutes the seat goes back on sale. Paying after that must not take the seat from whoever holds it now; we refund instead.' },
          { id: 'scope', q: 'Do refunds, transfers or resale matter here?', a: 'Not today. Only automatic refunds when a payment arrives too late.' },
        ],
        assumptions: [
          { id: 'waiting', q: 'At an on-sale, do fans reach booking directly, or wait in line first?', options: [
            { id: 'direct', label: 'Straight through; the database sorts out contention', consequence: 'Your hold must stay correct under 50,000 attempts a minute on one event.' },
            { id: 'room', label: 'A virtual waiting room lets them in a few thousand at a time', consequence: 'Booking sees a steady flow, but the waiting room itself must stay up.' },
          ] },
          { id: 'pay', q: 'When is the card charged?', options: [
            { id: 'in-hold', label: 'Once, when the buyer taps Pay inside the hold', consequence: 'A payment can finish after the hold expires, so you need an automatic refund.' },
            { id: 'authorise', label: 'Authorise when holding, capture when confirming', consequence: 'Fewer late payments, more calls to the provider.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers would change where seat state lives, or how hard one moment of traffic hits it?',
        walkthrough: [
          { text: 'Assigned seats mean each seat has its own state to protect: that drives everything else.' },
          { text: 'The on-sale peak tells you the hold path must survive one very hot event.' },
          { text: 'Stale-map tolerance tells you browsing can use copies; holding cannot.' },
          { text: 'A provider that times out tells you payment needs retries that never charge twice.' },
        ],
        solution: [{ type: 'list', items: ['Assigned seats (per-seat state).', 'Peak: 50,000 holds/minute on one event.', 'The seat map may be seconds stale; the hold may not.', 'Payment is external and can time out.', 'Late payments are refunded, never given someone else’s seat.'] }],
        why: 'These are the answers that decide where seat state lives, what may be cached, and how payment failures are handled. Everything else can wait.',
      },
      lessons: ['requirements'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts a Reserve tap touches and connect them. Then trace a request through your own design.',
      question: 'Show me what happens after someone taps Reserve. Which part decides whether the seat is still free?',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-app', 'app', 'client', 'Ticket app', 70, 220], ['s-booking', 'booking', 'service', 'Booking service', 300, 220]], [['s-app', 's-booking', 'sends request']]),
        traces: [
          { id: 'view', label: 'View the seat map', token: 'GET /events/42/seats', from: 'client', to: { type: ['seat-db'] }, read: true },
          { id: 'reserve', label: 'Reserve seat F12', token: 'POST /holds F12', from: 'client', to: { type: ['seat-db'] } },
        ],
      },
      help: {
        hint: 'If two parts could both mark F12 as held, which one wins? Give seat state exactly one owner.',
        walkthrough: [
          { text: 'The app sends Reserve to Booking service; it never touches the database itself.', focus: ['app', 'booking'] },
          { text: 'Booking service is the only part that writes seat rows in Seat store.', focus: ['booking', 'seatdb'] },
          { text: 'Browsing goes to Catalog, which reads a cached seat map that may be a few seconds old.', focus: ['catalog', 'cache'] },
          { text: 'Payment is a call to an outside provider; tickets and emails happen later, from a queue.', focus: ['payment', 'events', 'tickets'] },
        ],
        solution: [
          { type: 'p', text: '**Booking service owns seat state.** The app sends `POST /holds`; Booking performs one conditional write on the seat row in Seat store. Catalog serves seat maps from a cache that Booking invalidates when a seat changes. Confirmed bookings publish an event; a worker makes tickets and sends email.' },
          { type: 'code', lang: 'http', code: 'POST /v1/holds {event_id, seat_id}   Idempotency-Key: …\n→ 201 {hold_id, expires_at} | 409 seat_unavailable' },
        ],
        why: 'One owner for seat state is what makes “never sell a seat twice” checkable; the cache serves the stale-tolerant map without ever deciding a hold.',
      },
      lessons: ['first-booking', 'caching', 'cache-invalidation'],
    },
    {
      id: 'race', title: 'Two buyers', intro: 'Ana and Ben tap Reserve on F12 a few milliseconds apart. Arrange their reads and writes, predict, then run it.',
      question: 'Ana and Ben both see F12 free and tap Reserve at once. How many of them are told “held”?',
      activity: {
        kind: 'timeline', names: ['Ana', 'Ben'], resource: 'Seat F12 (seats left)', initial: 1,
        read: 'checks F12', write: 'marks F12 held',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'Check, then write', detail: 'Read the seat; if it is free, write “held”. Two separate steps.', code: "SELECT state FROM seats WHERE id = 'F12';\n-- if available:\nUPDATE seats SET state = 'held', holder = :buyer WHERE id = 'F12';" },
          { id: 'conditional', label: 'Conditional write', detail: 'One statement that only changes the row if it is still free.', code: "UPDATE seats SET state = 'held', holder = :buyer\nWHERE id = 'F12' AND state = 'available';\n-- 1 row changed → held; 0 rows → 409" },
          { id: 'lock', label: 'Lock the row', detail: 'The first reader locks F12; the second waits until the first has written.', code: "SELECT state FROM seats WHERE id = 'F12' FOR UPDATE;" },
        ],
        predict: { q: 'With “check, then write” and this order, how many are told “held”?', choices: [{ id: 'one', label: 'One of them' }, { id: 'both', label: 'Both of them' }, { id: 'none', label: 'Neither' }] },
      },
      help: {
        hint: 'What did Ben read, and was it still true when he wrote?',
        walkthrough: [
          { text: 'Ana reads: 1 seat left.' },
          { text: 'Ben reads before Ana writes: he also sees 1 seat left.' },
          { text: 'Ana writes “held”. Ben writes “held” too, because his decision used a value that is no longer true.' },
          { text: 'Fix: make the check part of the write (conditional), or make Ben wait (lock).' },
        ],
        solution: [
          { type: 'p', text: 'With a plain check-then-write, **both** are told “held”. A conditional write lets exactly one succeed in every order: the second statement changes 0 rows and Booking returns 409.' },
          { type: 'code', lang: 'python', code: "def hold(db, seat, buyer):\n    changed = db.execute(\n        \"UPDATE seats SET state='held', holder=? WHERE id=? AND state='available'\",\n        (buyer, seat)).rowcount\n    return changed == 1   # False → 409 seat_unavailable" },
        ],
        why: '“A seat is never sold twice” needs the check and the change to be one step at the source of truth; any copy or earlier read can be stale.',
      },
      lessons: ['concurrent-reservations', 'transactions', 'locking-mvcc'],
    },
    {
      id: 'payment', title: 'Payment times out', intro: 'The interviewer changes one condition. Predict, run it on your design, then revise.',
      question: 'The payment provider charges Ana’s card but its reply never arrives. What does Ana see, and how do you avoid charging her twice?',
      change: { announce: 'New condition: the payment provider stops replying for 30 seconds during the on-sale. Some charges succeed but their replies are lost.', rule: RULES.trace, alternate: { announce: 'New condition: the ticket-and-email worker crashes for ten minutes right after the on-sale starts.', label: 'Replay with the email worker down' } },
      activity: {
        kind: 'trace', request: 'a Pay request from the ticket app to the payment provider', from: ['app'], to: ['payment', 'tickets'], failCandidates: ['payment', 'tickets'],
        predict: { q: 'While that part is down, what does the buyer see?', choices: [{ id: 'error', label: 'An error or a spinner that times out' }, { id: 'delayed', label: 'A confirmation; the rest happens later' }, { id: 'ok', label: 'Nothing changes' }] },
      },
      help: {
        hint: 'Is the buyer waiting on that part when it goes quiet? And if Booking retries, how does the provider know it is the same payment?',
        walkthrough: [
          { text: 'Booking calls the provider while Ana waits, so a silent provider means Ana waits and then sees a timeout.', focus: ['booking', 'payment'] },
          { text: 'The charge may still have happened. Booking retries with the same idempotency key, so the provider returns the first result instead of charging again.', focus: ['payment'] },
          { text: 'Emails come from a queue, so a crashed email worker delays tickets but never fails the purchase.', focus: ['events', 'tickets'] },
        ],
        solution: [
          { type: 'list', items: ['Call the provider with a timeout and an **idempotency key per order**; retry with the same key.', 'If the hold expired before the payment is confirmed, **refund automatically** (also idempotent by order id).', 'Keep emails and tickets behind the event queue so they can lag without failing a purchase.'] },
        ],
        why: '“Nobody is charged without getting a seat” survives a lost reply only if retries cannot create a second charge and late successes are refunded.',
      },
      lessons: ['timeouts', 'retries', 'idempotency', 'lab-payment-retries'],
    },
  ],
  rules: [
    // Design stage
    { id: 'owner', stage: 'design', when: { link: [{ type: 'booking' }, { type: 'seat-db' }], labels: ['writes to', 'reads and writes'] }, ack: '{type:booking} is the only part that writes seats. Good: one owner.', strength: 'You gave seat state a single owner: {type:booking} writes {type:seat-db}.' },
    { id: 'no-store', stage: 'design', when: { lacks: { type: 'seat-db' } }, coach: 'Seats need a home. Add Seat store and connect Booking service to it.', gap: { text: 'No single place owned seat state.', fix: 'Add a Seat store and make Booking service its only writer.', stage: 'design', lesson: 'first-booking' }, priority: 3 },
    { id: 'connect-store', stage: 'design', when: { all: [{ has: { type: 'seat-db' } }, { not: { path: ['client', { type: 'seat-db' }] } }] }, coach: 'Connect the path: Ticket app → Booking service → Seat store. Select a part, then “Connect to…”.' , priority: 2 },
    { id: 'trace-now', stage: 'design', when: { all: [{ path: ['client', { type: 'seat-db' }] }, { not: { result: 'trace:view', is: ['ok', 'hit'] } }] }, coach: 'Now press “Trace a request” to watch a seat-map view travel through your design.', priority: 1 },
    { id: 'client-db', stage: 'design', when: { link: ['client', 'db'] }, priority: 9, ask: { text: 'Your app writes to {kind:db} directly. Who checks that the seat is still free before it is held?', choices: [
      { id: 'service', label: 'A service in between owns the check', reply: 'Yes: the app is not trusted with the rule, and every hold goes through one place you control.', verdict: 'sound' },
      { id: 'app', label: 'The app checks first, then writes', reply: 'Two apps can both check “free” before either writes. That is the race we will run next.', verdict: 'risky' },
      { id: 'db', label: 'The database checks in one conditional write', reply: 'That makes the write safe. You would still want a service for sign-in, limits and the rules around holds.', verdict: 'partial' },
    ] }, gap: { text: 'The app wrote to the database directly.', fix: 'Route Reserve through Booking service so one place owns the rule.', stage: 'design', lesson: 'first-booking' } },
    { id: 'two-writers', stage: 'design', when: { link: [{ type: 'catalog' }, { type: 'seat-db' }], labels: ['writes to', 'reads and writes'] }, priority: 8, ask: { text: '{type:catalog} also writes to {type:seat-db}. If it and {type:booking} disagree about F12, who wins?', choices: [
      { id: 'booking', label: 'Only Booking should write seats; Catalog only reads', reply: 'Right: one writer means one answer. Change Catalog’s arrow to “reads from”.', verdict: 'sound' },
      { id: 'last', label: 'Whoever writes last', reply: '“Last write wins” is how a seat ends up held by one buyer and shown to another.', verdict: 'risky' },
    ] } },
    { id: 'protect-db', stage: 'design', when: { all: [{ result: 'trace:view', is: 'ok' }, { lacks: 'cache' }] }, priority: 7, ask: { text: 'Every seat-map view went all the way to {type:seat-db}. At the on-sale, 50,000 people refresh the map each minute. What protects it?', choices: [
      { id: 'cache', label: 'A cache for the seat map, a few seconds stale at most', reply: 'Good: the brief allows a slightly stale map, and holds still check Seat store. Try inserting a cache into your read path and trace again.', verdict: 'sound' },
      { id: 'servers', label: 'More Booking service servers', reply: 'More servers help the service, but every one of them still reads the same database.', verdict: 'partial' },
      { id: 'nothing', label: 'Nothing; databases are fast', reply: 'One hot event’s map, refreshed by everyone, concentrates on one set of rows. Plan for it.', verdict: 'risky' },
    ] } },
    { id: 'cache-hit', stage: 'design', when: { result: 'trace:view', is: 'hit' }, ack: 'Your trace stopped at {kind:cache}: the database was never asked for that view.', strength: 'You took the seat-map reads off the database with {kind:cache}, and traced it to prove it.' },
    { id: 'cache-stale', stage: 'design', when: { has: 'cache' }, priority: 6, ask: { text: 'A seat was just held. How does {kind:cache} stop the map showing it as free?', choices: [
      { id: 'invalidate', label: '{type:booking} deletes that event’s cached map when it writes', reply: 'Yes: invalidate on write. Draw it as an arrow from Booking service to the cache labelled “invalidates”.', verdict: 'sound' },
      { id: 'ttl', label: 'Entries expire after a few seconds; holds still check Seat store', reply: 'Also fine here: the brief allows a few seconds of staleness, and a stale map can never cause a double sale because the hold re-checks the source of truth.', verdict: 'sound' },
      { id: 'hold-cache', label: 'Holds read the cache too', reply: 'Then two buyers can both see “free” in a stale copy. The hold must check Seat store.', verdict: 'risky' },
    ] } },
    { id: 'cache-holds', stage: 'design', when: { link: [{ type: 'booking' }, 'cache'], labels: ['writes to', 'reads and writes'] }, priority: 9, ack: 'You’re keeping holds in {kind:cache}. That is a real approach: holds with an expiry in an in-memory store are very fast at huge peaks.', ask: { text: 'If {kind:cache} restarts and loses its holds, what stops F12 being sold twice?', choices: [
      { id: 'db-confirms', label: '{type:seat-db} still confirms the booking with a conditional write', reply: 'Exactly. The cache makes holds fast; the database keeps the final say. That is a valid alternative to the reference design, at the cost of two stores to keep in step.', verdict: 'sound' },
      { id: 'rare', label: 'Restarts are rare enough to ignore', reply: 'A restart during an on-sale is exactly when it hurts. Keep the database as the final word.', verdict: 'risky' },
    ] }, strength: 'You proposed fast holds in {kind:cache} with the database as the final authority — a valid alternative design.' },
    { id: 'events', stage: 'design', when: { link: [{ type: 'booking' }, 'queue'] }, ack: 'Tickets and emails come after the booking through {kind:queue}, so a slow email can’t slow a purchase.', strength: 'You moved tickets and email behind {kind:queue}, off the purchase path.' },
    { id: 'room-missing', stage: 'design', when: { all: [{ answer: 'assume:waiting', is: 'room' }, { lacks: { type: 'waiting-room' } }] }, priority: 5, ask: { text: 'You assumed a waiting room. Where does it sit in your design?', choices: [
      { id: 'front', label: 'In front of Booking service, before any hold is tried', reply: 'Right: it turns the spike into a steady flow before seat state is touched. Add it from the palette.', verdict: 'sound' },
      { id: 'behind', label: 'Between Booking service and Seat store', reply: 'By then the spike has already reached your service. Put it at the front door.', verdict: 'risky' },
    ] } },
    // Race stage
    { id: 'race-fixed', stage: 'race', when: { result: 'race', is: 'one' }, ack: 'Only one buyer was told “held”, in every order you tried.', strength: 'You made the hold a single conditional step, so exactly one buyer wins.' },
    { id: 'race-oversold', stage: 'race', when: { result: 'race', is: 'oversold' }, priority: 5, ask: { text: 'Both were told “held”. Which part of your design must make the check and the write one step?', choices: [
      { id: 'db', label: 'Seat store, with a conditional write (or a row lock)', reply: 'Yes: the source of truth makes the decision atomically. Switch the guard and run the same order again.', verdict: 'sound' },
      { id: 'app', label: 'The app should check twice', reply: 'Checking twice is still checking before writing. The check has to be part of the write.', verdict: 'risky' },
    ] }, gap: { text: 'The hold was check-then-write, so two buyers could both win.', fix: 'Use a conditional write (or a row lock) in Seat store and rerun the race.', stage: 'race', lesson: 'concurrent-reservations' } },
    // Payment stage
    { id: 'pay-sync', stage: 'payment', when: { result: 'payment', is: 'error' }, priority: 6, ask: { text: 'The provider charged the card but its reply was lost. {type:booking} retries. How do you avoid charging Ana twice?', choices: [
      { id: 'key', label: 'Send the same idempotency key on the retry', reply: 'Yes: the provider recognises the key and returns the first result instead of charging again.', verdict: 'sound' },
      { id: 'no-retry', label: 'Don’t retry; ask Ana to try again', reply: 'Then Ana may be charged with no seat and no record. Retry safely instead.', verdict: 'partial' },
      { id: 'new', label: 'Retry as a new request', reply: 'A new request is a new charge. That is the double charge we are trying to prevent.', verdict: 'risky' },
    ] }, gap: { text: 'A lost payment reply could lead to a second charge.', fix: 'Retry payments with the same idempotency key, and refund automatically if the hold expired.', stage: 'payment', lesson: 'idempotency' } },
    { id: 'pay-async', stage: 'payment', when: { result: 'payment', is: 'delayed' }, ack: 'In your design the buyer gets a confirmation while the slow part catches up from {kind:queue}.', strength: 'Your design keeps a slow downstream part off the buyer’s path.' },
    { id: 'pay-key', when: { answer: 'pay-sync', is: 'key' }, strength: 'You retried payments with an idempotency key, so a lost reply can’t charge twice.' },
    { id: 'pay-broken', stage: 'payment', when: { result: 'payment', is: 'broken' }, coach: 'There’s no chain of arrows from the app to that part yet. Add the arrows, then run it again.', priority: 4 },
  ],
  solution: {
    design: g([
      ['app', 'app', 'client', 'Ticket app', 40, 220], ['booking', 'booking', 'service', 'Booking service', 230, 260], ['catalog', 'catalog', 'service', 'Catalog service', 230, 90],
      ['cache', 'seat-cache', 'cache', 'Seat-map cache', 420, 70], ['seatdb', 'seat-db', 'db', 'Seat store', 420, 230], ['payment', 'payment', 'ext', 'Payment provider', 420, 380],
      ['events', 'events', 'queue', 'Event queue', 600, 250], ['tickets', 'tickets', 'worker', 'Ticket + email worker', 600, 400],
    ], [
      ['app', 'catalog', 'sends request'], ['app', 'booking', 'sends request'], ['catalog', 'cache', 'reads from'], ['catalog', 'seatdb', 'reads from'], ['booking', 'seatdb', 'reads and writes'],
      ['booking', 'cache', 'invalidates'], ['booking', 'payment', 'calls'], ['booking', 'events', 'publishes event'], ['events', 'tickets', 'delivers to'],
    ]),
    why: {
      app: 'Sends Reserve and Pay; never decides availability.',
      booking: 'The single owner of seat state: holds, confirmations, refunds.',
      catalog: 'Serves browsing so the hold path stays quiet.',
      cache: 'Serves the seat map in milliseconds; may be a few seconds stale, which the brief allows.',
      seatdb: 'Source of truth: one row per seat, changed only by conditional writes.',
      payment: 'External: called with a timeout and an idempotency key per order.',
      events: 'Holds “booking confirmed” so tickets and email never slow a purchase.',
      tickets: 'Makes tickets and sends email, retrying safely on its own.',
    },
    alternatives: { seatdb: { types: ['seat-cache'], tradeoff: 'Holding seats in an in-memory store with an expiry is faster at extreme peaks, but two stores must agree; keep the database as the final word on bookings.' } },
    trace: { title: 'Ana reserves F12, then pays', steps: [
      { from: 'app', to: 'booking', text: 'POST /holds {event 42, seat F12} with an idempotency key.' },
      { from: 'booking', to: 'seatdb', text: 'UPDATE … WHERE seat = F12 AND state = available → 1 row: Ana holds F12 until 10:10.' },
      { from: 'booking', to: 'cache', text: 'Invalidate event 42’s seat map so browsers see F12 as held within seconds.' },
      { from: 'booking', to: 'payment', text: 'Charge with key order-881. A lost reply is retried with the same key.' },
      { from: 'booking', to: 'events', text: 'Confirm F12 for Ana (conditional on her hold), then publish booking.confirmed.' },
      { from: 'events', to: 'tickets', text: 'The worker makes the ticket and emails Ana, retrying until it succeeds.' },
    ] },
    tradeoff: 'Conditional writes on one database are simple and correct, but one huge event concentrates on one partition; a waiting room in front turns that spike into a steady flow.',
    otherApproach: 'If a few events sell hundreds of thousands of seats at once, hold seats in an in-memory store with expiry (or one process per event) and keep the database’s conditional write for the final booking.',
  },
};
