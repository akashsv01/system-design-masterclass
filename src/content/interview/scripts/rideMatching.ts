import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const rideMatching: InterviewScript = {
  caseId: 'case-ride-matching',
  track: 'hld',
  doLine: 'Place the parts that find a nearby driver, stop two matchers offering the same driver, then keep matching alive when location updates surge',
  skills: ['concurrency', 'architecture', 'capacity', 'reliability'],
  brief: {
    interviewer: { name: 'Marcus', role: 'engineering lead on the dispatch team' },
    intro: 'We run a ride-hailing app. When a rider taps Request, we have a few seconds to find a nearby free driver and offer them the trip. Drivers move all the time, and the worst bug we can ship is one driver sent two riders.',
    users: 'Riders requesting a trip, and drivers who receive and accept offers on their phones.',
    needs: ['A driver app that reports its position all day', 'A rider taps Request and a nearby available driver is offered the trip within about 5 seconds', 'The driver accepts or ignores the offer; an ignored offer moves on to someone else'],
    mustHold: ['A driver is never assigned two rides at once', 'A driver who has gone quiet is not offered trips', 'An offer that nobody answers does not block the rider or the driver forever'],
    constraints: ['1 million active drivers, each sending a location every 4 seconds (about 250,000 updates a second)', 'Up to 50,000 ride requests a minute at peak', 'Match within about 5 seconds', 'An offer lasts about 10 seconds'],
    outOfScope: ['Pricing and surge fares', 'Payments', 'Shared rides (pooling)', 'Turn-by-turn navigation'],
    terms: [
      { term: 'geo index', meaning: 'a lookup that splits the map into cells and lists the drivers currently in each cell, so “who is near here?” reads a few cells instead of every driver' },
      { term: 'offer', meaning: 'a trip proposed to one driver, who has about ten seconds to accept before it is withdrawn' },
      { term: 'matcher', meaning: 'the code that picks a driver for a ride request and makes the offer' },
      { term: 'conditional write', meaning: 'a change that only happens if the record still has the value you expect' },
    ],
    firstMove: 'A rider taps Request. Show me how the request reaches a driver, and which part knows which drivers are nearby and free.',
  },
  palette: [
    { type: 'rider-app', kind: 'client', name: 'Rider app', blurb: 'The rider’s phone. It sends Request and shows the driver once someone accepts.' },
    { type: 'driver-app', kind: 'client', name: 'Driver app', blurb: 'The driver’s phone. It reports a position every 4 seconds and shows offers.' },
    { type: 'location', kind: 'service', name: 'Location service', blurb: 'Receives the position pings from driver apps and files each driver under the right map cell.' },
    { type: 'geo', kind: 'cache', name: 'Geo index', blurb: 'In-memory map cells listing the drivers in each. Each ping overwrites the last one. Rebuilt from fresh pings after a restart.' },
    { type: 'matcher', kind: 'service', name: 'Matcher', blurb: 'Finds candidate drivers near a rider, ranks them, and offers the trip to one. One per city partition.' },
    { type: 'trips', kind: 'db', name: 'Driver + trip store', blurb: 'A database with a row per driver (available, offered, on a trip) and a row per trip.' },
    { type: 'push', kind: 'gateway', name: 'Push gateway', blurb: 'Delivers an offer to a driver’s phone, even when the app is in the background.' },
    { type: 'history', kind: 'stream', name: 'Location history', blurb: 'An ordered log of every ping, kept for analytics and replay. Nobody waits on it.' },
  ],
  verbs: ['sends request', 'reads from', 'writes to', 'reads and writes', 'publishes event', 'calls'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'quality', q: 'What is a good match: the nearest driver, or the fastest to arrive?', a: 'Fastest to arrive, by road. For version one, straight-line distance is an acceptable stand-in.' },
          { id: 'updates', q: 'How often do drivers report where they are, and how many are there?', a: 'Every 4 seconds, from about a million active drivers. That is roughly 250,000 updates a second, each replacing the last.' },
          { id: 'requests', q: 'How many ride requests do we handle?', a: 'Up to 50,000 a minute at peak, spread over many cities.' },
          { id: 'exclusive', q: 'Can a driver ever hold two offers or rides?', a: 'No. A driver has one offer or one ride at a time. That is the rule we cannot break.' },
          { id: 'ignored', q: 'What if a driver ignores an offer?', a: 'It expires after about ten seconds. The driver goes back to available and we offer the trip to the next candidate.' },
          { id: 'history', q: 'Do we need to keep old locations?', a: 'Only for analytics, a little later. Matching needs the latest position and nothing else.' },
        ],
        assumptions: [
          { id: 'live', q: 'Where do live driver positions live?', options: [
            { id: 'memory', label: 'In memory, in a geo-cell index, overwritten on every ping', consequence: 'Fast, and a restart only loses data that is four seconds old anyway. Rebuild from fresh pings.' },
            { id: 'database', label: 'In the same database as trips', consequence: 'You must absorb about 250,000 overwrites a second in a store built for durable records.' },
          ] },
          { id: 'offers', q: 'How many drivers get an offer at the same time?', options: [
            { id: 'one', label: 'One driver at a time, in ranked order', consequence: 'Simple and fair, but each ignored offer costs up to ten seconds, so a match can run past 5 seconds.' },
            { id: 'several', label: 'Two or three at once; the first to accept wins', consequence: 'Faster matches, but you must make sure only the first accept takes the trip, and the rest are withdrawn.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers change where the live positions are kept, and which ones create a rule you must never break?',
        walkthrough: [
          { text: '250,000 position updates a second, each replacing the last, shape where positions live.' },
          { text: '“One driver, one trip” is the rule everything else protects.' },
          { text: 'Ten-second offers mean an offer can lapse, so state has to return to available.' },
          { text: 'Fastest-to-arrive is ranking; for version one the nearby search is the hard part.' },
        ],
        solution: [{ type: 'list', items: ['Match by arrival time; straight-line distance is fine for version one.', '250,000 location updates a second, each replacing the previous one.', '50,000 requests a minute at peak.', 'A driver has at most one offer or ride at a time.', 'Offers expire after about ten seconds and return the driver to available.'] }],
        why: 'These answers decide where live positions are kept, where the exclusivity rule must be enforced, and what happens when an offer is ignored.',
      },
      lessons: ['requirements', 'capacity-estimation'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts a request touches and connect them. Then trace a request, and a driver’s location ping, through your own design.',
      question: 'A rider taps Request. Show me how a driver ends up with the offer, and which part knows who is nearby.',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-rider', 'rider-app', 'client', 'Rider app', 70, 100], ['s-match', 'matcher', 'service', 'Matcher', 300, 100]], [['s-rider', 's-match', 'sends request']]),
        traces: [
          { id: 'offer', label: 'A rider requests a trip and a driver is offered it', token: 'POST /trips (pickup 40.71,-74.00)', from: { type: 'rider-app' }, to: { type: 'driver-app' } },
          { id: 'ping', label: 'A driver’s location update arrives', token: 'PUT /drivers/D7/location', from: { type: 'driver-app' }, to: { type: 'geo' } },
        ],
      },
      help: {
        hint: 'Which part answers “which free drivers are near this point?” without looking at a million drivers one by one?',
        walkthrough: [
          { text: 'Driver apps send a ping every 4 seconds to the Location service, which files the driver under a map cell in the Geo index.', focus: ['driver', 'loc', 'geo'] },
          { text: 'A request goes from the Rider app to the Matcher, which reads the rider’s cell and the cells around it from the Geo index.', focus: ['rider', 'matcher', 'geo'] },
          { text: 'The Matcher marks the chosen driver as offered in the Driver + trip store, and only then asks the Push gateway to deliver the offer.', focus: ['matcher', 'trips', 'push'] },
          { text: 'Every ping also goes to the Location history log, off the matching path.', focus: ['loc', 'history'] },
        ],
        solution: [
          { type: 'p', text: '**The Geo index answers “who is near?”; the trip store decides “who is free.”** Pings overwrite positions in memory. The Matcher (one per city partition) reads nearby cells, ranks candidates, then changes the winner’s row from available to offered with a conditional write before sending the offer through the Push gateway.' },
          { type: 'code', lang: 'http', code: 'PUT /v1/drivers/D7/location {lat, lng, at}\nPOST /v1/trips {rider_id, pickup}   Idempotency-Key: …\n→ 202 {trip_id, status: "matching"}\nPOST /v1/offers/{offer_id}/accept   → 200 | 409 offer_expired' },
        ],
        why: 'Fast, throwaway location data and slower, durable driver and trip state live in different places, so each can be built for what it needs.',
      },
      lessons: ['sharding', 'realtime-delivery', 'first-booking'],
    },
    {
      id: 'race', title: 'Two matchers', intro: 'Matcher 1 and Matcher 2 both pick driver D7 for different riders a few milliseconds apart. Arrange their reads and writes, predict, then run it.',
      question: 'Both matchers see D7 as available and make an offer. How many riders end up with D7 offered?',
      activity: {
        kind: 'timeline', names: ['Matcher 1', 'Matcher 2'], resource: 'Driver D7 (free drivers)', initial: 1,
        read: 'checks D7 is available', write: 'marks D7 offered',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'Check, then write', detail: 'Read D7’s state; if it is available, write “offered”. Two separate steps.', code: "SELECT state FROM drivers WHERE id = 'D7';\n-- if available:\nUPDATE drivers SET state = 'offered', trip_id = :trip WHERE id = 'D7';" },
          { id: 'conditional', label: 'Conditional write', detail: 'One statement that only changes D7 if it is still available.', code: "UPDATE drivers SET state = 'offered', trip_id = :trip\nWHERE id = 'D7' AND state = 'available';\n-- 1 row changed → offered; 0 rows → try the next driver" },
          { id: 'lock', label: 'Lock the row', detail: 'The first matcher locks D7; the second waits until it has written.', code: "SELECT state FROM drivers WHERE id = 'D7' FOR UPDATE;" },
        ],
        predict: { q: 'With “check, then write” and this order, how many riders get D7 offered?', choices: [{ id: 'one', label: 'One of them' }, { id: 'both', label: 'Both of them' }, { id: 'none', label: 'Neither' }] },
      },
      help: {
        hint: 'What did Matcher 2 read, and was it still true when it wrote? This is the seat-hold race with a driver instead of a seat.',
        walkthrough: [
          { text: 'Matcher 1 reads: D7 is available.' },
          { text: 'Matcher 2 reads before Matcher 1 writes: D7 also looks available.' },
          { text: 'Matcher 1 writes “offered”. Matcher 2 writes “offered” too, based on a read that is no longer true.' },
          { text: 'Fix: make the check part of the write (conditional available → offered), so the second matcher changes nothing and moves to the next candidate.' },
        ],
        solution: [
          { type: 'p', text: 'With a plain check-then-write, **both** riders get D7 offered. A conditional write on D7’s row lets exactly one succeed in every order. The loser changes 0 rows and offers the trip to its next-best driver.' },
          { type: 'code', lang: 'python', code: "def offer(db, driver, trip):\n    changed = db.execute(\n        \"UPDATE drivers SET state='offered', trip_id=? WHERE id=? AND state='available'\",\n        (trip, driver)).rowcount\n    return changed == 1   # False → try the next candidate" },
        ],
        why: '“A driver is never assigned two rides” needs the check and the change to be one step at the source of truth. The geo index is a copy and can be a few seconds stale.',
      },
      lessons: ['concurrent-reservations', 'locking-mvcc', 'transactions'],
    },
    {
      id: 'surge', title: 'Updates surge', intro: 'The interviewer changes one condition. Predict, run it, then try the options.',
      question: 'Location updates double while the geo index slows down. What should the location path do so matching stays fast?',
      change: { announce: 'New condition: a stadium lets out and location updates double for 30 seconds, while the geo index gets three times slower at updating cells.', rule: RULES.queue },
      activity: {
        kind: 'queue', what: 'location updates waiting for one city’s geo index',
        arrival: [200, 400, 800], workers: [1, 2, 4], serviceMs: 4,
        slow: { from: 10, to: 40, serviceMs: 12, what: 'The geo index takes 12 ms per update instead of 4 ms while cells are rebuilt.' },
        timeoutS: 2,
        policies: [
          { id: 'wait', label: 'Queue every update and process them in order', detail: 'No update is dropped. Updates wait their turn, however long that takes.' },
          { id: 'retry', label: 'Callers retry updates that take too long', detail: 'A phone that gets no answer sends the same update again.' },
          { id: 'shed', label: 'Drop updates that cannot start within about 2 seconds', detail: 'The next ping from that driver is four seconds away and replaces this one anyway.' },
          { id: 'breaker', label: 'Skip updates while the index is slow, then resume', detail: 'Fast “try later”; the index catches up on fresh pings instead of a backlog.' },
        ],
      },
      help: {
        hint: 'Does a four-second-old position still matter when the next one is already on its way?',
        walkthrough: [
          { text: 'While the index is slow it handles about 170 updates a second against 400 arriving, so a queue builds.', focus: ['loc', 'geo'] },
          { text: 'Every queued update is older than the one behind it. Processing them in order spends time on positions that are already out of date.', focus: ['loc'] },
          { text: 'Dropping the oldest updates keeps the index close to current and keeps ride matching reading fresh cells.', focus: ['geo', 'matcher'] },
        ],
        solution: [
          { type: 'list', items: ['Drop (or coalesce) location updates that wait longer than about 2 seconds: only the latest position per driver matters.', 'Never retry location updates blindly: retries add load to a part that is already slow.', 'Keep ride requests and offers on a separate path so a surge of pings cannot delay them.', 'Treat positions older than about 15 seconds as unknown so a driver whose updates were dropped is not offered trips.'] },
        ],
        why: 'Location data is overwritten every 4 seconds, so shedding the stale ones loses almost nothing, while a growing backlog would make every match use old positions.',
      },
      lessons: ['backpressure', 'lab-queue-backlog', 'timeouts'],
    },
  ],
  rules: [
    // Design stage
    { id: 'owner', stage: 'design', when: { link: [{ type: 'matcher' }, { type: 'trips' }], labels: ['writes to', 'reads and writes'] }, ack: '{type:matcher} records offers in {type:trips}. Good: one place decides who is free.', strength: 'You made one place, {type:trips}, the record of whether a driver is free, with {type:matcher} writing it.' },
    { id: 'no-geo', stage: 'design', when: { lacks: { type: 'geo' } }, coach: 'Something has to answer “who is near this rider?” quickly. Add the Geo index and connect the Location service to it.', gap: { text: 'Nothing answered “who is nearby?” without scanning every driver.', fix: 'Add an in-memory geo index keyed by map cell, updated by the Location service and read by the Matcher.', stage: 'design', lesson: 'sharding' }, priority: 3 },
    { id: 'wire-ping', stage: 'design', when: { all: [{ has: { type: 'geo' } }, { not: { path: [{ type: 'driver-app' }, { type: 'geo' }] } }] }, coach: 'Connect the ping path: Driver app → Location service → Geo index.', priority: 2 },
    { id: 'wire-offer', stage: 'design', when: { all: [{ has: { type: 'matcher' } }, { not: { path: [{ type: 'rider-app' }, { type: 'driver-app' }] } }] }, coach: 'Connect the offer path from the Rider app through the Matcher and the Push gateway to the Driver app.', priority: 2 },
    { id: 'trace-now', stage: 'design', when: { all: [{ path: [{ type: 'rider-app' }, { type: 'driver-app' }] }, { not: { result: 'trace:offer', is: ['ok', 'hit'] } }] }, coach: 'Press “Trace a request” to watch a ride request travel through your design.', priority: 1 },
    { id: 'offer-ok', stage: 'design', when: { result: 'trace:offer', is: 'ok' }, ack: 'Your request reached {type:driver-app} through your own arrows.' },
    { id: 'ping-ok', stage: 'design', when: { result: 'trace:ping', is: ['ok', 'hit'] }, ack: 'A location ping reaches {type:geo} in your design.', strength: 'You traced a driver’s location update all the way into the geo index.' },
    { id: 'client-db', stage: 'design', when: { link: ['client', 'db'] }, priority: 9, ask: { text: 'An app talks to {kind:db} directly. Who checks that the driver is still free before an offer is made?', choices: [
      { id: 'service', label: 'A service in between owns the check', reply: 'Yes: apps cannot be trusted with the rule, and one place enforces it for every request.', verdict: 'sound' },
      { id: 'app', label: 'The app checks first, then writes', reply: 'Two apps can both see “free” before either writes. That is the race we run next.', verdict: 'risky' },
    ] }, gap: { text: 'An app wrote driver state directly.', fix: 'Route requests through the Matcher so one part owns the “available → offered” change.', stage: 'design', lesson: 'first-booking' } },
    { id: 'geo-db', stage: 'design', when: { link: [{ type: 'location' }, 'db'] }, priority: 8, ack: 'You are keeping live positions in {kind:db}. That can work, at a cost.', ask: { text: 'Every driver pings every 4 seconds: about 250,000 writes a second into {kind:db}. What keeps that workable?', choices: [
      { id: 'shard', label: 'A geo-capable database sharded by city, with writes held to the latest position only', reply: 'A valid alternative at moderate scale: you get queries for free, at the price of heavy write load on a durable store. At a million drivers most teams keep positions in memory instead.', verdict: 'partial' },
      { id: 'memory', label: 'Keep live positions in memory; the database holds trips and driver state', reply: 'Yes: positions are four seconds old at best, so durability is wasted on them. Replace this arrow with a geo index in memory.', verdict: 'sound' },
      { id: 'fine', label: 'Databases handle that fine', reply: '250,000 overwrites a second concentrate on the same rows all day. Plan for it explicitly.', verdict: 'risky' },
    ] }, gap: { text: 'Live positions were written to the durable database.', fix: 'Keep positions in an in-memory geo index and send history to a log.', stage: 'design', lesson: 'sharding' } },
    { id: 'matcher-geo', stage: 'design', when: { link: [{ type: 'matcher' }, { type: 'geo' }], labels: ['reads from', 'reads and writes'] }, ack: '{type:matcher} asks {type:geo} for candidates near the rider.', strength: 'The Matcher finds candidates in the geo index instead of scanning every driver.' },
    { id: 'offer-atomic', stage: 'design', when: { link: [{ type: 'matcher' }, { type: 'trips' }], labels: ['writes to', 'reads and writes'] }, priority: 7, ask: { text: 'Your arrow says {type:matcher} writes {type:trips}. It does not show whether that write checks the driver is still free. What does it do?', choices: [
      { id: 'conditional', label: 'Change available → offered only if the driver is still available', reply: 'Yes: the check and the change are one step. We will race two matchers to prove it.', verdict: 'sound' },
      { id: 'overwrite', label: 'Set the state to offered whatever it was', reply: 'Then two matchers can both “win” the same driver. The write must check first.', verdict: 'risky' },
      { id: 'lock', label: 'Lock the driver row, check, write, unlock', reply: 'That also works, as long as the lock never waits on a phone. Hold it only for the database write, never during the ten-second offer.', verdict: 'partial' },
    ] } },
    { id: 'stale-pos', stage: 'design', when: { has: { type: 'geo' } }, priority: 6, ask: { text: 'A driver’s phone loses signal. Their last position stays in {type:geo}. How do you avoid offering trips to a ghost?', choices: [
      { id: 'age', label: 'Ignore positions older than about 15 seconds', reply: 'Yes: no recent ping means “unknown”, so they drop out of candidate lists on their own.', verdict: 'sound' },
      { id: 'expiry', label: 'Rely on the offer expiring after ten seconds', reply: 'That works, but every candidate you pick costs the rider up to ten seconds. Filter the ghosts before you offer.', verdict: 'partial' },
      { id: 'never', label: 'Keep the last position until the driver signs out', reply: 'Phones lose signal all the time, so riders would keep being matched with drivers who cannot answer.', verdict: 'risky' },
    ] } },
    { id: 'partition', stage: 'design', when: { has: { type: 'matcher' } }, priority: 5, ask: { text: 'Fifty thousand requests a minute across many cities. How do you split the matching work?', choices: [
      { id: 'city', label: 'Partition by city (or map region): each partition has its own matcher and geo index', reply: 'Yes: drivers and riders in one city never need each other’s data, and contention stays local.', verdict: 'sound' },
      { id: 'global', label: 'One global matcher with more memory', reply: 'One process becomes the bottleneck and the single point of failure for every city.', verdict: 'risky' },
      { id: 'random', label: 'Spread requests randomly across matchers', reply: 'Any matcher then needs every driver’s position, and two matchers will fight over the same drivers more often.', verdict: 'partial' },
    ] } },
    { id: 'history', stage: 'design', when: { link: [{ type: 'location' }, 'stream'] }, ack: 'Pings are also logged to {kind:stream}, off the matching path.', strength: 'You sent location history to a log asynchronously, keeping analytics off the live path.' },
    // Race stage
    { id: 'race-fixed', stage: 'race', when: { result: 'race', is: 'one' }, ack: 'Only one rider got D7 in every order you tried.', strength: 'You made the offer one conditional step, so a driver can never be offered twice.' },
    { id: 'race-next', stage: 'race', when: { result: 'race', is: 'one' }, priority: 5, ask: { text: 'Matcher 2’s conditional write changed 0 rows. What should it do next?', choices: [
      { id: 'next', label: 'Offer the trip to its next-best candidate', reply: 'Yes: losing the race for one driver is normal. Move to the next candidate and keep the rider moving.', verdict: 'sound' },
      { id: 'fail', label: 'Tell the rider no drivers are available', reply: 'There are more drivers nearby; a lost race is not a reason to give up.', verdict: 'risky' },
      { id: 'again', label: 'Retry the same driver immediately', reply: 'D7 is taken, so the retry fails again. Pick someone else.', verdict: 'partial' },
    ] } },
    { id: 'race-oversold', stage: 'race', when: { result: 'race', is: 'oversold' }, priority: 5, ask: { text: 'Both riders got D7. Which part of your design must make the check and the write one step?', choices: [
      { id: 'db', label: 'The driver store, with a conditional write (or a row lock)', reply: 'Yes: the source of truth decides atomically. Switch the guard and run the same order again.', verdict: 'sound' },
      { id: 'geo', label: 'The geo index should hide drivers once they are offered', reply: 'The index is a copy that lags. It can reduce collisions but cannot be the final word.', verdict: 'risky' },
      { id: 'matcher', label: 'Each matcher checks twice', reply: 'Checking twice is still checking before writing. The check must be part of the write.', verdict: 'risky' },
    ] }, gap: { text: 'The offer was check-then-write, so two matchers could both win a driver.', fix: 'Use a conditional available → offered write (or a row lock) in the driver store and rerun the race.', stage: 'race', lesson: 'concurrent-reservations' } },
    { id: 'offer-expiry', stage: 'race', when: { result: 'race', is: 'one' }, priority: 4, ask: { text: 'D7 holds the offer and never answers. What puts D7 back on the market?', choices: [
      { id: 'timeout', label: 'After about ten seconds the offer expires: offered → available, and the rider moves on', reply: 'Yes: every temporary state needs an exit that does not depend on a phone. Make the expiry change conditional too, so a late “accept” cannot undo it.', verdict: 'sound' },
      { id: 'wait', label: 'Wait for the driver to answer', reply: 'A driver with a dead phone would be stuck offered, and the rider would wait forever.', verdict: 'risky' },
      { id: 'support', label: 'Support staff release stuck drivers by hand', reply: 'At 50,000 requests a minute you cannot do this by hand. Automate the expiry.', verdict: 'risky' },
    ] } },
    // Surge stage
    { id: 'surge-wait', stage: 'surge', when: { result: 'surge', is: ['wait:unbounded', 'retry:unbounded'] }, priority: 6, ask: { text: 'The queue of location updates kept growing. By the time an update is processed, it is far older than the driver’s next ping. What would you change?', choices: [
      { id: 'drop', label: 'Drop updates that waited too long: only the newest position per driver matters', reply: 'Yes: a stale position adds no value, and dropping it frees the index for fresh ones.', verdict: 'sound' },
      { id: 'scale', label: 'Add more index servers', reply: 'More capacity helps in the long run, but the surge is 30 seconds long. Shedding handles it without waiting for servers.', verdict: 'partial' },
      { id: 'wait', label: 'Keep every update; they all matter', reply: 'Only the latest position per driver matters. Older ones just delay the fresh ones.', verdict: 'risky' },
    ] }, gap: { text: 'During the surge the update queue grew without bound, so matching used old positions.', fix: 'Shed location updates that wait too long; keep ride requests on their own path.', stage: 'surge', lesson: 'backpressure' } },
    { id: 'surge-bounded', stage: 'surge', when: { result: 'surge', is: ['shed:bounded', 'breaker:bounded'] }, ack: 'The queue stayed short: positions stayed current.', strength: 'You protected the index from a surge by dropping stale location updates.' },
    { id: 'surge-which', stage: 'surge', when: { result: 'surge', is: ['shed:bounded', 'breaker:bounded'] }, priority: 4, ask: { text: 'Some drivers’ updates were dropped. Which ones should be dropped first?', choices: [
      { id: 'old', label: 'The oldest updates, and keep the latest position per driver', reply: 'Yes: the newest ping carries everything the old ones did.', verdict: 'sound' },
      { id: 'requests', label: 'Drop ride requests instead; they are fewer', reply: 'Requests are what riders are waiting for. Shed the data that is replaced in four seconds anyway.', verdict: 'risky' },
      { id: 'random', label: 'Drop at random', reply: 'That can drop a driver’s only recent update and keep an old one. Prefer to drop the oldest.', verdict: 'partial' },
    ] } },
    { id: 'surge-retry', stage: 'surge', when: { result: 'surge', is: 'retry:unbounded' }, priority: 5, coach: 'Retrying adds copies of updates to a part that is already behind. Try dropping stale updates instead.' },
  ],
  solution: {
    design: g([
      ['rider', 'rider-app', 'client', 'Rider app', 40, 110], ['matcher', 'matcher', 'service', 'Matcher', 230, 110], ['trips', 'trips', 'db', 'Driver + trip store', 420, 60], ['push', 'push', 'gateway', 'Push gateway', 420, 190],
      ['driver', 'driver-app', 'client', 'Driver app', 40, 330], ['loc', 'location', 'service', 'Location service', 230, 330], ['geo', 'geo', 'cache', 'Geo index', 420, 330], ['history', 'history', 'stream', 'Location history', 600, 390],
    ], [
      ['rider', 'matcher', 'sends request'], ['matcher', 'geo', 'reads from'], ['matcher', 'trips', 'reads and writes'], ['matcher', 'push', 'calls'], ['push', 'driver', 'sends request'],
      ['driver', 'matcher', 'sends request'], ['driver', 'loc', 'sends request'], ['loc', 'geo', 'writes to'], ['loc', 'history', 'publishes event'],
    ]),
    why: {
      rider: 'Sends Request and shows the driver once someone accepts.',
      matcher: 'Picks a candidate and makes the offer. One per city partition, so contention stays local.',
      trips: 'Source of truth for “is this driver free?”. Changed only by conditional writes.',
      push: 'Delivers the offer to the driver’s phone. The ten-second expiry is enforced in the trip store, never by the phone.',
      driver: 'Reports a position every 4 seconds and answers offers.',
      loc: 'Files each ping under a map cell and ignores stale ones. It never decides who is free.',
      geo: 'In-memory cells of drivers, overwritten on every ping. Fast, approximate, rebuilt after a restart.',
      history: 'Every ping, in order, for analytics. Nothing waits on it.',
    },
    alternatives: { geo: { types: ['trips'], tradeoff: 'A sharded geo-capable database can answer nearby queries and survive restarts, but absorbs 250,000 writes a second of data that is stale in four seconds.' } },
    trace: { title: 'A rider requests a trip and driver D7 is offered it', steps: [
      { from: 'rider', to: 'matcher', text: 'POST /trips with pickup coordinates and an idempotency key.' },
      { from: 'matcher', to: 'geo', text: 'Read the rider’s cell and its neighbours: drivers whose last ping is under 15 seconds old. Rank by distance.' },
      { from: 'matcher', to: 'trips', text: 'UPDATE drivers SET state = offered WHERE id = D7 AND state = available: 1 row changed, so D7 is ours.' },
      { from: 'matcher', to: 'push', text: 'Send the offer with a ten-second expiry.' },
      { from: 'push', to: 'driver', text: 'The offer appears on D7’s phone.' },
      { from: 'driver', to: 'matcher', text: 'D7 accepts. The Matcher changes offered → on-trip only if the offer is still live, otherwise answers 409.' },
    ] },
    tradeoff: 'Partitioning by city and keeping positions in memory makes matching fast and contention local, at the cost of rebuilding the index after a restart and approximate, slightly stale locations.',
    otherApproach: 'At small scale, one database with a geo index and a conditional write is simpler and good enough. Move positions to memory when location writes start to dominate the database.',
  },
};
