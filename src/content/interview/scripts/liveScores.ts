import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const liveScores: InterviewScript = {
  caseId: 'case-live-scores',
  track: 'hld',
  doLine: 'Build the path that gets a goal from the data feed to millions of phones, key the match event log, then replay it with the push part offline',
  skills: ['architecture', 'data-modeling', 'reliability', 'messaging'],
  brief: {
    interviewer: { name: 'Dana', role: 'tech lead on a football app' },
    intro: 'Our app shows live scores. On a cup final, five million people watch at once, and the first thing they ask is whether the goal they just heard about is on their phone yet.',
    users: 'Fans following matches on phones, often on mobile networks that drop and reconnect.',
    needs: ['See a goal or card on the phone within about two seconds', 'Open the app mid-match and see the current score and recent events', 'Come back after a dropped connection and catch up on what was missed'],
    mustHold: ['Every phone ends up with the same score, in the same event order', 'A correction (a goal disallowed by VAR) reaches phones that already showed the goal', 'The same event from the feed twice does not count as two goals'],
    constraints: ['5 million concurrent viewers in a big match', 'Score events are rare: a few a minute per match', 'The data provider’s feed sometimes sends duplicates and out-of-order events', 'Goal on phones within about 2 seconds'],
    outOfScope: ['Fan chat rooms', 'Betting odds', 'Video'],
    terms: [
      { term: 'event log', meaning: 'an ordered list of what happened in a match, where each event has a number that only goes up' },
      { term: 'sequence number', meaning: 'the position of an event within one match: 1, 2, 3 …' },
      { term: 'push', meaning: 'the server sends an update over an open connection, instead of the phone asking again and again' },
      { term: 'snapshot', meaning: 'the current state of a match in one piece (score, minute, last events), so a phone does not have to replay everything' },
    ],
    firstMove: 'Follow one goal. The data provider sends us “goal, minute 63”. Show me the parts between that message and a fan’s phone, and where the order of events is decided.',
  },
  palette: [
    { type: 'feed', kind: 'ext', name: 'Data provider feed', blurb: 'The outside company that reports match events. It may repeat or reorder them.' },
    { type: 'ingest', kind: 'service', name: 'Ingest service', blurb: 'Removes duplicates, puts events in order and numbers them per match.' },
    { type: 'eventlog', kind: 'stream', name: 'Match event log', blurb: 'An ordered, replayable list of events per match. Readers remember their position.' },
    { type: 'state', kind: 'db', name: 'Match state store', blurb: 'The current score and minute of each match, built from the log.' },
    { type: 'snapshots', kind: 'cache', name: 'Snapshot cache', blurb: 'A fast copy of each match’s current state for phones that just opened or reconnected.' },
    { type: 'push', kind: 'gateway', name: 'Push gateway', blurb: 'Holds open connections to phones and forwards new events to the ones following a match.' },
    { type: 'fans', kind: 'client', name: 'Fans’ phones', blurb: 'The app. It shows the score and remembers the last event number it saw.' },
    { type: 'poller', kind: 'service', name: 'Scoreboard API', blurb: 'Answers “what is the score now?” requests from phones that poll.' },
  ],
  verbs: ['sends request', 'publishes event', 'delivers to', 'reads from', 'writes to', 'reads and writes', 'calls'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'fresh', q: 'How fast must a goal reach a phone?', a: 'About two seconds. A fan hearing the cheer before seeing the score is the complaint we get.' },
          { id: 'scale', q: 'How many people, and how many events?', a: 'Five million watching one match at the peak, but only a few events a minute per match.' },
          { id: 'feed', q: 'How clean is the data provider’s feed?', a: 'Not very. It repeats events, sometimes sends them out of order, and later corrects them, like a goal ruled out by VAR.' },
          { id: 'network', q: 'What about phones on poor networks?', a: 'They drop and reconnect all the time, and must catch up on what they missed without starting over.' },
          { id: 'history', q: 'Do we need the full history of a match?', a: 'Yes. We replay it for catch-up, and keep it so corrections can be applied and audited.' },
          { id: 'rooms', q: 'Do chat rooms matter in this interview?', a: 'Not now. They run separately so a chat flood cannot slow a goal.' },
        ],
        assumptions: [
          { id: 'delivery', q: 'How do phones get updates?', options: [
            { id: 'poll', label: 'They ask for the score every few seconds', consequence: 'Simple, but 5 million phones asking every 5 seconds is 1 million requests a second for a few events a minute.' },
            { id: 'push', label: 'The server pushes events over an open connection', consequence: 'Fresh and cheap per event, but a gateway fleet must hold millions of connections and handle reconnects.' },
          ] },
          { id: 'correction', q: 'How is a VAR correction recorded?', options: [
            { id: 'edit', label: 'Edit the original goal event', consequence: 'Phones that already applied the goal never learn it changed.' },
            { id: 'newevent', label: 'Add a new “goal disallowed” event', consequence: 'History is kept and every phone applies the correction in order.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers tell you how events must be ordered, and what a phone needs when it reconnects?',
        walkthrough: [
          { text: 'A two-second target and 5 million viewers rule out phones asking over and over.' },
          { text: 'A messy feed means events need dedupe and a single place that numbers them.' },
          { text: 'Dropping networks mean a phone must be able to say “I saw up to event 41”.' },
          { text: 'Corrections mean history is kept and corrections are events too.' },
        ],
        solution: [{ type: 'list', items: ['Goal on phones within about 2 seconds.', '5 million viewers, a few events a minute per match.', 'Feed repeats, reorders and corrects.', 'Phones reconnect constantly and must catch up.', 'History is kept; corrections are new events.'] }],
        why: 'These answers decide that updates are pushed from an ordered, replayable log, and that the log needs one place that numbers events.',
      },
      lessons: ['requirements'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts a goal passes through and connect them. Then trace a goal from the feed to a phone.',
      question: 'Show me the parts between the provider’s “goal” message and a fan’s phone. Where is the order of events decided?',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-feed', 'feed', 'ext', 'Data provider feed', 50, 220], ['s-ingest', 'ingest', 'service', 'Ingest service', 280, 220]], [['s-feed', 's-ingest', 'calls']]),
        traces: [
          { id: 'goal', label: 'A goal reaches phones', token: 'goal #3 min 63', from: { type: ['feed'] }, to: { type: ['fans'] } },
        ],
      },
      help: {
        hint: 'If the provider sends goal #3 twice, which one part sees every event for that match and can decide its order?',
        walkthrough: [
          { text: 'The feed sends events to Ingest, which removes duplicates and gives each event the next number for its match.', focus: ['feed', 'ingest'] },
          { text: 'Ingest appends the event to the match event log. That log is the source of truth.', focus: ['ingest', 'eventlog'] },
          { text: 'A projection reads the log to keep current state; push gateways read it to forward new events.', focus: ['eventlog', 'state', 'push'] },
          { text: 'Gateways hold the open connections to phones and send each event to those following that match.', focus: ['push', 'fans'] },
        ],
        solution: [
          { type: 'p', text: '**The event log is the spine.** Ingest numbers events per match and appends them. State and push gateways are both readers of the same log, so every phone sees the same events in the same order.' },
          { type: 'code', lang: 'http', code: 'GET /v1/matches/9/events?after=41   (Accept: text/event-stream)\n→ id: 42  data: {"type":"goal","minute":63}' },
        ],
        why: 'One place numbers events, so all readers agree on order. Pushing from the log gives two-second freshness without 1 million polls a second.',
      },
      lessons: ['realtime-delivery', 'queues', 'caching'],
    },
    {
      id: 'data', title: 'Event log key', intro: 'The event log is a table. Choose its key, then run two queries and see what each one costs.',
      question: 'How do you key the match event log so a phone can ask for “events after number N for match M”, and what does a second query cost?',
      activity: {
        kind: 'model',
        tables: [
          { id: 'events', name: 'match_events', fields: ['match_id', 'seq', 'kind', 'player', 'payload'] },
        ],
        table: 'events',
        partitions: 16,
        first: { id: 'q1', text: 'Events after sequence 41 for match 9, oldest first (a phone catching up)', filter: 'match_id', sort: 'seq' },
        second: { id: 'q2', text: 'Every goal one player scored this season, across all matches (a stats page)', filter: 'player' },
        tradeoffs: [
          { id: 'copy', label: 'Keep a second copy of goals keyed by player', consequence: 'The stats page reads one partition. Every goal is now written twice, and the two copies can briefly disagree.', verdict: 'sound' },
          { id: 'index', label: 'Add an index on player', consequence: 'The stats page uses the index. Every write also updates the index, a small cost at a few events a minute.', verdict: 'sound' },
          { id: 'scatter', label: 'Accept the scatter for a rare stats page', consequence: 'Fine if the page is visited rarely or cached. Every visit asks all partitions and merges.', verdict: 'partial' },
          { id: 'rekey', label: 'Re-key the log by player', consequence: 'The stats page is fast, but the phone catch-up query now scatters, on the path that matters most.', verdict: 'risky' },
        ],
      },
      help: {
        hint: 'Which query runs millions of times during a match, and which runs now and then? Key for the first one.',
        walkthrough: [
          { text: 'Catch-up filters on match and wants events in order, so partition by match_id and sort by seq.', focus: ['eventlog'] },
          { text: 'That puts all of one match’s events together: one partition, already sorted.', focus: ['eventlog', 'state'] },
          { text: 'A query by player does not use the key, so it must ask every partition or use an index or a copy.', focus: ['state'] },
          { text: 'Choose based on how often that second query runs and how stale a copy may be.', focus: ['state'] },
        ],
        solution: [{ type: 'list', items: ['Partition key `match_id`, sort key `seq`.', 'Catch-up: one partition, rows already in order.', 'Per-player stats: an index, or a derived table fed from the same log.', 'Never re-key the log to suit a rare query.'] }],
        why: 'The hot, latency-sensitive query decides the key. Rare queries get an index or a derived copy so they never slow the main path.',
      },
      lessons: ['sharding', 'indexes', 'access-patterns'],
    },
    {
      id: 'outage', title: 'Push goes offline', intro: 'The interviewer changes one condition. Predict, run it on your design, then revise.',
      question: 'The push gateways go down for a minute right after a goal. What does the provider’s feed see, what happens to the goal, and what do phones get when they come back?',
      change: { announce: 'New condition: all push gateways restart for one minute during the match, then half a million phones reconnect at once.', rule: RULES.trace, alternate: { announce: 'New condition: the ingest service is offline for one minute during a goal.', label: 'Replay with ingest down' } },
      activity: {
        kind: 'trace', request: 'a goal event from the data provider to a fan’s phone', from: ['feed'], to: ['fans'], failCandidates: ['push', 'ingest', 'eventlog'],
        predict: { q: 'While that part is down, what happens to the goal?', choices: [{ id: 'error', label: 'It is refused or lost on the way' }, { id: 'delayed', label: 'It is recorded and reaches phones later' }, { id: 'ok', label: 'Nothing changes' }] },
      },
      help: {
        hint: 'Where does the goal first get written down? Anything after that point can be replayed.',
        walkthrough: [
          { text: 'The goal is appended to the event log before any gateway sees it.', focus: ['ingest', 'eventlog'] },
          { text: 'If gateways are down, the goal waits in the log. Nothing is lost.', focus: ['eventlog', 'push'] },
          { text: 'Phones reconnect with the last number they saw, and the gateway replays the events after it from the log.', focus: ['push', 'fans'] },
          { text: 'Phones back off with jitter, so half a million do not arrive in the same second.', focus: ['fans', 'snapshots'] },
        ],
        solution: [{ type: 'list', items: ['The log accepts the goal first, so a push outage delays delivery but loses nothing.', 'Reconnect with `Last-Event-ID`; the gateway replays from the log or sends a snapshot if the phone is far behind.', 'Backoff with jitter on the phone, and a snapshot cache so catch-up reads do not hit the database.', 'If ingest is down, the feed’s own retry, or a replay from the provider, fills the gap; ingest dedupes.'] }],
        why: '“Every phone ends up with the same score” holds after an outage only if the log is the source of truth and phones can ask for events after a number.',
      },
      lessons: ['realtime-delivery', 'failover', 'backpressure'],
    },
  ],
  rules: [
    // Design stage
    { id: 'log-spine', stage: 'design', when: { all: [{ link: [{ type: 'ingest' }, 'stream'] }, { link: ['stream', { type: ['push', 'state'] }] }] }, ack: '{type:ingest} appends to {kind:stream}, and the other parts read from it. One place decides the order.', strength: 'You made one event log the source of truth, so every reader sees the same events in the same order.' },
    { id: 'no-log', stage: 'design', when: { lacks: 'stream' }, coach: 'Where do events wait, in order, so a phone that missed some can ask again? Add an event log after Ingest.', gap: { text: 'There was no ordered, replayable log, so a reconnecting phone had nothing to catch up from.', fix: 'Append every event to a per-match event log with sequence numbers, and let gateways read from it.', stage: 'design', lesson: 'queues' }, priority: 4 },
    { id: 'connect-path', stage: 'design', when: { all: [{ has: { type: 'fans' } }, { not: { path: [{ type: 'feed' }, { type: 'fans' }] } }] }, coach: 'Connect the path: feed → Ingest → event log → push gateway → phones. Select a part, then “Connect to…”.', priority: 3 },
    { id: 'trace-now', stage: 'design', when: { all: [{ path: [{ type: 'feed' }, { type: 'fans' }] }, { not: { result: 'trace:goal', is: ['ok', 'hit'] } }] }, coach: 'Press “Trace a request” to watch one goal travel from the feed to a phone.', priority: 1 },
    { id: 'feed-direct', stage: 'design', when: { link: [{ type: 'feed' }, { type: ['push', 'fans', 'state'] }] }, priority: 9, ask: { text: 'The feed sends events straight to {type:push} or {type:state}. The feed repeats and reorders events. Who fixes that?', choices: [
      { id: 'ingest', label: 'An ingest step that dedupes and numbers events before anything else sees them', reply: 'Yes. One place decides the order, so no reader has to guess.', verdict: 'sound' },
      { id: 'each', label: 'Each gateway cleans up what it receives', reply: 'Two gateways can then disagree on order, and a phone switching gateways sees events jump.', verdict: 'risky' },
      { id: 'trust', label: 'Trust the provider', reply: 'The brief says it does not behave. A repeated goal would count twice.', verdict: 'risky' },
    ] }, gap: { text: 'Raw feed events reached readers with no one deduping or ordering them.', fix: 'Add Ingest to dedupe by event id and assign per-match sequence numbers.', stage: 'design', lesson: 'queues' } },
    { id: 'poll-alt', stage: 'design', when: { link: [{ type: 'fans' }, { type: 'poller' }] }, priority: 8, ack: 'You have phones asking {type:poller} for the score. That is a valid alternative to push.', ask: { text: 'With 5 million phones asking every 5 seconds, how many requests a second hit {type:poller}, and what keeps that affordable?', choices: [
      { id: 'cache', label: 'About a million a second; serve a cached scoreboard and accept a few seconds of staleness', reply: 'A fair trade if “within five seconds” is acceptable. The brief wants two, so push fits better; polling suits smaller apps.', verdict: 'partial' },
      { id: 'push', label: 'Too many; switch to push for live matches', reply: 'Yes. A few events a minute does not justify a million requests a second.', verdict: 'sound' },
      { id: 'db', label: 'The database can take it', reply: 'A million reads a second on a handful of hot rows is a hot spot, not a database workload.', verdict: 'risky' },
    ] }, strength: 'You considered polling as an alternative and weighed its request volume against push.' },
    { id: 'snapshot-use', stage: 'design', when: { link: [{ type: 'push' }, { type: 'snapshots' }] }, ack: '{type:push} can read {type:snapshots} when a phone is far behind, instead of replaying everything.', strength: 'You kept snapshots in {kind:cache} so a reconnecting phone does not replay a whole match.' },
    { id: 'push-reconnect', stage: 'design', when: { link: [{ type: 'push' }, { type: 'fans' }] }, priority: 5, ask: { text: 'The arrow from {type:push} to {type:fans} shows events flowing out. It does not show what a phone gets after its connection drops for 30 seconds. What should it do?', choices: [
      { id: 'lastseq', label: 'Reconnect saying the last sequence it saw; the gateway replays the events after it', reply: 'Yes. That is how every phone ends up with the same events in the same order.', verdict: 'sound' },
      { id: 'all', label: 'Reconnect and receive the whole match again', reply: 'It works, but wastes bandwidth and re-applies events. Ask from where you left off, or take a snapshot.', verdict: 'partial' },
      { id: 'nothing', label: 'Wait for the next event', reply: 'The goal that happened while it was offline would never show up.', verdict: 'risky' },
    ] } },
    { id: 'client-log', stage: 'design', when: { link: [{ type: 'fans' }, 'stream'] }, priority: 7, ask: { text: 'Phones read the event log directly. With 5 million phones, what does that do to the log?', choices: [
      { id: 'gateway', label: 'Put gateways between them, so the log is read by a few gateways, not millions of phones', reply: 'Yes. Gateways fan out one read to many connections.', verdict: 'sound' },
      { id: 'scale', label: 'Scale the log to take millions of readers', reply: 'You can, but a gateway tier is cheaper and lets you hold the connections.', verdict: 'partial' },
    ] } },
    // Data stage
    { id: 'key-good', stage: 'data', when: { all: [{ result: 'data:q1', is: 'one-partition' }, { not: { result: 'data:q2', is: 'one-partition' } }] }, ack: 'Catch-up reads one partition, already in order.', strength: 'You keyed the log by match and sequence, so catch-up reads one partition in order.' },
    { id: 'key-bad', stage: 'data', when: { result: 'data:q1', is: ['scatter', 'index'] }, priority: 6, ask: { text: 'The catch-up query had to scatter or use an index. It runs millions of times in a match. Which key makes it a single read?', choices: [
      { id: 'match', label: 'Partition by match_id and sort by seq', reply: 'Yes: the match is the unit people follow, and seq gives you the order for free.', verdict: 'sound' },
      { id: 'seq', label: 'Partition by seq', reply: 'Event 42 of every match lands together, and one match’s events are spread everywhere.', verdict: 'risky' },
    ] }, gap: { text: 'The catch-up query was not a single read on your key.', fix: 'Partition the event log by match_id with seq as the sort key.', stage: 'data', lesson: 'sharding' } },
    { id: 'q2-scatter', stage: 'data', when: { result: 'data:q2', is: 'scatter' }, priority: 4, ask: { text: 'The per-player query asked every partition. Is that acceptable here?', choices: [
      { id: 'rare', label: 'Yes, if the stats page is rare or cached', reply: 'A fair judgment: do not pay on every write for a read that is infrequent.', verdict: 'sound' },
      { id: 'fix', label: 'No; add an index or a derived table', reply: 'Also reasonable if the page is popular. Each write now does a little more work.', verdict: 'sound' },
      { id: 'rekey', label: 'No; re-key the whole log by player', reply: 'That would make the hot catch-up query scatter instead.', verdict: 'risky' },
    ] } },
    { id: 'trade-rekey', stage: 'data', when: { result: 'data:tradeoff', is: 'rekey' }, priority: 5, gap: { text: 'You moved the key to suit a rare query and made the main one slower.', fix: 'Keep the log keyed by match and serve the player query from an index or a derived copy.', stage: 'data', lesson: 'access-patterns' } },
    { id: 'trade-ok', stage: 'data', when: { result: 'data:tradeoff', is: ['copy', 'index'] }, ack: 'Your fix for the second query leaves the first one untouched.', strength: 'You served the second query with an index or copy instead of bending the main key.' },
    // Outage stage
    { id: 'outage-delayed', stage: 'outage', when: { result: 'outage', is: 'delayed' }, ack: 'In your design the goal was recorded in {kind:stream} first, so a downed part delays delivery but loses nothing.', strength: 'Your design records events in a log before any delivery, so an outage delays phones but never loses a goal.' },
    { id: 'outage-error', stage: 'outage', when: { result: 'outage', is: 'error' }, priority: 6, ask: { text: 'In your design the goal was refused on the way. What would let the feed’s message be accepted even while a downstream part is down?', choices: [
      { id: 'log-first', label: 'Write it to the log first; everything after reads from the log', reply: 'Yes. Accepting is cheap and durable; delivery can wait.', verdict: 'sound' },
      { id: 'retry', label: 'The provider retries until we are back', reply: 'That helps for a short gap, but the goal then arrives late and out of order. Also keep our own durable log.', verdict: 'partial' },
    ] }, gap: { text: 'A part before the log took the goal down with it.', fix: 'Accept events into the log first and let gateways and state read from it.', stage: 'outage', lesson: 'failover' } },
    { id: 'outage-broken', stage: 'outage', when: { result: 'outage', is: 'broken' }, coach: 'There is no chain of arrows from the feed to the phones yet. Add the arrows, then run it again.', priority: 4 },
    { id: 'stampede', stage: 'outage', when: { result: 'outage', is: ['delayed', 'ok'] }, priority: 5, ask: { text: 'Half a million phones reconnect in the same second. What stops them from taking the gateways down again?', choices: [
      { id: 'jitter', label: 'Phones back off with a random delay, and the snapshot cache answers catch-up reads', reply: 'Yes. Spread the arrivals, and make each cheap.', verdict: 'sound' },
      { id: 'scale', label: 'Run enough gateways to take them all at once', reply: 'That wastes money for a rare minute, and still hits the database. Spread them out.', verdict: 'partial' },
      { id: 'nothing', label: 'Nothing; they will sort themselves out', reply: 'A synchronized reconnect is a stampede. It can knock the fleet over a second time.', verdict: 'risky' },
    ] }, gap: { text: 'Nothing spread out the reconnecting phones.', fix: 'Reconnect with exponential backoff and jitter, and serve catch-up from cached snapshots.', stage: 'outage', lesson: 'backpressure' } },
    { id: 'stampede-ok', when: { answer: 'stampede', is: 'jitter' }, strength: 'You spread out reconnects with jitter and cached snapshots.' },
  ],
  solution: {
    design: g([
      ['feed', 'feed', 'ext', 'Data provider feed', 20, 220], ['ingest', 'ingest', 'service', 'Ingest service', 150, 220], ['eventlog', 'eventlog', 'stream', 'Match event log', 290, 220],
      ['state', 'state', 'db', 'Match state store', 290, 70], ['snapshots', 'snapshots', 'cache', 'Snapshot cache', 430, 70], ['push', 'push', 'gateway', 'Push gateway', 430, 220], ['fans', 'fans', 'client', 'Fans’ phones', 560, 220],
    ], [
      ['feed', 'ingest', 'calls'], ['ingest', 'eventlog', 'publishes event'], ['eventlog', 'state', 'delivers to'], ['state', 'snapshots', 'writes to'],
      ['eventlog', 'push', 'delivers to'], ['push', 'snapshots', 'reads from'], ['push', 'fans', 'delivers to'],
    ]),
    why: {
      feed: 'External and messy: repeats, reorders and corrects events.',
      ingest: 'Dedupes by provider event id and assigns the next sequence number per match, in one place.',
      eventlog: 'Source of truth: events per match in order, replayable. Corrections are new events.',
      state: 'The current score, built by reading the log, for phones that open mid-match.',
      snapshots: 'A cached copy of each match’s state, so reconnects and new viewers do not hit the database.',
      push: 'Holds the open connections, forwards new events, and replays from a phone’s last sequence number.',
      fans: 'Remembers the last sequence number seen and reconnects with backoff and jitter.',
    },
    alternatives: { push: { types: ['poller'], tradeoff: 'Polling a cached scoreboard is simpler and works if five or ten seconds of delay is fine, but costs a lot of requests at 5 million viewers.' } },
    trace: { title: 'Goal #3 reaches a phone', steps: [
      { from: 'feed', to: 'ingest', text: 'The feed sends “goal, minute 63, id g-771”. If it sends g-771 again, Ingest drops it.' },
      { from: 'ingest', to: 'eventlog', text: 'Ingest gives it sequence 42 for match 9 and appends it to the log.' },
      { from: 'eventlog', to: 'state', text: 'The projection updates the score to 2–1.' },
      { from: 'state', to: 'snapshots', text: 'The snapshot for match 9 is refreshed, so a new viewer sees 2–1 immediately.' },
      { from: 'eventlog', to: 'push', text: 'Push gateways read event 42 and find the connections following match 9.' },
      { from: 'push', to: 'fans', text: 'Each phone receives “id: 42 goal”. If it was offline, it reconnects with Last-Event-ID 41 and gets 42 next.' },
    ] },
    tradeoff: 'A numbered, replayable log gives every phone the same events in the same order and makes outages harmless, but it needs a gateway fleet that holds millions of connections and a plan for reconnect spikes.',
    otherApproach: 'For a small app where ten seconds of delay is fine, a cached scoreboard that phones poll is far simpler. Move to push when freshness or request volume makes polling too expensive.',
  },
};
