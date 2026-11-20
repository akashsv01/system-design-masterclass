import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const autocomplete: InterviewScript = {
  caseId: 'case-autocomplete',
  track: 'hld',
  doLine: 'Return suggestions for a typed prefix through an edge cache, tame keystroke traffic and a slow ranking service, then fall back when suggestions go offline',
  skills: ['caching', 'capacity', 'reliability', 'architecture'],
  brief: {
    interviewer: { name: 'Mei', role: 'engineer on the search team' },
    intro: 'Our search box suggests artists and venues as people type. It has to feel instant: if suggestions lag, people stop looking at them.',
    users: 'People searching for artists and venues on the web and phone apps.',
    needs: ['Type a few letters and see up to ten matching names', 'See the most popular matches first', 'Keep typing without the suggestions flickering or lagging'],
    mustHold: ['Suggestions appear within 100 ms of a keystroke', 'The search box still works if suggestions are unavailable', 'A new day’s ranking never causes a gap while it is loaded'],
    constraints: ['About 5 million artists and venues', 'Up to 10,000 suggestion requests a second at peak, because every keystroke can send one', 'Top 10 by popularity; the ranking is rebuilt daily', 'Latency target 100 ms'],
    outOfScope: ['Typo correction', 'Personalised suggestions', 'Full search results'],
    terms: [
      { term: 'prefix', meaning: 'the first letters of a name, such as “ri” for Rihanna' },
      { term: 'debounce', meaning: 'waiting until the user pauses typing briefly before sending a request' },
      { term: 'edge cache', meaning: 'a cache close to users that answers common requests without reaching our servers' },
      { term: 'fallback', meaning: 'a simpler answer used when the normal one is unavailable' },
    ],
    firstMove: 'Someone types “ri” in the search box. Place the parts that answer, connect them, and trace “typing a prefix” through your design.',
  },
  palette: [
    { type: 'box', kind: 'client', name: 'Search box', blurb: 'The input on the web or phone. It sends the prefix as the user types.' },
    { type: 'edge', kind: 'cache', name: 'Edge cache', blurb: 'Close to users. Remembers the answer for popular prefixes for a few minutes.' },
    { type: 'suggest', kind: 'service', name: 'Suggest service', blurb: 'Holds the ranked index in memory and returns the top ten for a prefix in microseconds.' },
    { type: 'ranker', kind: 'service', name: 'Ranking service', blurb: 'Optional: adds a live “trending” boost to the top matches. Slower than the index.' },
    { type: 'index', kind: 'storage', name: 'Index files', blurb: 'Versioned files holding each day’s ranked index. Servers load a new one in the background.' },
    { type: 'builder', kind: 'worker', name: 'Daily index builder', blurb: 'A batch job that turns last day’s searches and sales into a new ranked index.' },
    { type: 'logs', kind: 'db', name: 'Query logs', blurb: 'Records of what people searched and bought; the popularity signal.' },
    { type: 'catalog', kind: 'db', name: 'Artist catalog', blurb: 'The list of artist and venue names that suggestions are drawn from.' },
  ],
  verbs: ['sends request', 'reads from', 'writes to', 'reads and writes', 'calls', 'delivers to', 'invalidates'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'speed', q: 'How fast must suggestions appear?', a: 'Within 100 ms of a keystroke, or people have already typed the next letter.' },
          { id: 'rank', q: 'How are suggestions ranked?', a: 'By popularity: searches and ticket sales. The top ten per prefix.' },
          { id: 'fresh', q: 'How fresh must the ranking be?', a: 'Daily is fine. A live trending boost is a possible later feature.' },
          { id: 'size', q: 'How many names, and how much traffic?', a: 'About 5 million names. Up to 10,000 requests a second at peak, because each keystroke can send one.' },
          { id: 'typo', q: 'Do we fix typos or personalise?', a: 'Not now. Prefix matching on names only.' },
          { id: 'down', q: 'What if suggestions break?', a: 'The search box must still work; people can type a full name and press search.' },
        ],
        assumptions: [
          { id: 'structure', q: 'How does Suggest service find the top ten for a prefix?', options: [
            { id: 'precomputed', label: 'The top ten for every prefix is worked out in advance and stored', consequence: 'A lookup is a walk down the letters with no sorting. Memory use grows with the number of prefixes.' },
            { id: 'live', label: 'Find all matching names and sort them by popularity on each request', consequence: 'Less memory, but short prefixes like “r” match hundreds of thousands of names, sorted on every keystroke.' },
          ] },
          { id: 'load', q: 'How do you handle one request per keystroke?', options: [
            { id: 'reduce', label: 'Send fewer: debounce on the phone and cache common prefixes', consequence: 'Far fewer requests reach servers; typing feels a touch less live by about 100 ms.' },
            { id: 'absorb', label: 'Send them all and add servers', consequence: 'Simple on the phone, but you pay to answer requests the user has already typed past.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers tell you how fast a lookup must be, how many there will be, and what happens if the service is not there?',
        walkthrough: [
          { text: '100 ms leaves no room for scanning or sorting at request time.' },
          { text: 'Daily freshness means the index can be built offline and loaded as a unit.' },
          { text: '10,000 requests a second from keystrokes suggests sending fewer requests, not only answering them faster.' },
          { text: 'The search box must work without suggestions, so they are an enhancement, not a dependency.' },
        ],
        solution: [{ type: 'list', items: ['100 ms per keystroke; top ten by popularity.', 'Ranking rebuilt daily; trending later.', 'About 5 million names, 10,000 requests a second at peak.', 'Suggestions are optional: the box works without them.'] }],
        why: 'These answers decide whether to precompute, where to cache, how to reduce traffic and how to fail gracefully.',
      },
      lessons: ['requirements', 'latency', 'capacity-estimation'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts that answer a typed prefix and connect them. Then trace a request through your own design.',
      question: 'Someone types “ri”. Which part answers, and what does the common case avoid doing?',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-box', 'box', 'client', 'Search box', 70, 220], ['s-suggest', 'suggest', 'service', 'Suggest service', 300, 220]], [['s-box', 's-suggest', 'sends request']]),
        traces: [
          { id: 'type', label: 'Type “ri” and get suggestions', token: 'GET /suggest?q=ri', from: 'client', to: { type: ['suggest'] }, read: true },
          { id: 'trend', label: 'Type a name that is trending right now', token: 'GET /suggest?q=ta', from: 'client', to: { type: ['ranker'] }, read: true },
        ],
      },
      help: {
        hint: 'Most people type the same short prefixes. What can answer those before they ever reach your servers?',
        walkthrough: [
          { text: 'The search box sends the prefix; an edge cache answers popular prefixes without reaching Suggest service.', focus: ['box', 'edge'] },
          { text: 'On a miss, Suggest service looks up the prefix in its in-memory index and returns the stored top ten.', focus: ['edge', 'suggest'] },
          { text: 'Every night a builder reads search and sales logs and the catalog, and writes a new versioned index file.', focus: ['builder', 'logs', 'catalog', 'indexstore'] },
          { text: 'Suggest service loads the new file in the background and switches over at once.', focus: ['suggest', 'indexstore'] },
        ],
        solution: [
          { type: 'p', text: '**Precompute, then cache.** A nightly job builds an index where every prefix already stores its top ten. Suggest service holds it in memory, so a lookup is a walk down the letters with no sorting. An edge cache in front answers the commonest prefixes, so most keystrokes never reach it.' },
          { type: 'code', lang: 'http', code: 'GET /v1/suggest?q=ri&limit=10\n→ 200 ["Rihanna", "Rilo Kiley", "Rio Arena", …]   Cache-Control: max-age=300' },
        ],
        why: 'Precomputing makes a lookup cheap enough for 100 ms, and caching removes most of the traffic from the service altogether.',
      },
      lessons: ['caching', 'cdn', 'cache-invalidation'],
    },
    {
      id: 'capacity', title: 'Keystroke traffic', intro: 'Every keystroke can send a request. Choose how much arrives and how the ranking service is protected when it slows down.',
      question: 'The ranking service gets five times slower for twenty seconds. Which policy keeps suggestions inside their time limit?',
      activity: {
        kind: 'queue', what: 'suggestion requests waiting for the ranking service',
        arrival: [2000, 8000, 15000], workers: [10, 20, 40], serviceMs: 2,
        slow: { from: 20, to: 40, serviceMs: 10, what: 'the ranking service takes five times longer for each request' },
        timeoutS: 0.5,
        policies: [
          { id: 'wait', label: 'Keep waiting', detail: 'Every request waits its turn for the ranking service, however long that takes.' },
          { id: 'retry', label: 'Retry on timeout', detail: 'A request that waits too long is sent again, and the old copy stays in the queue.' },
          { id: 'shed', label: 'Drop stale keystrokes', detail: 'A request that cannot start soon is dropped: the user has typed another letter, and only the newest prefix matters.' },
          { id: 'breaker', label: 'Skip ranking while it is slow', detail: 'Stop calling the ranking service for a while and return the plain index result.' },
        ],
      },
      help: {
        hint: 'Workers finish about 10,000 requests a second when ranking is quick. What does the arrival rate do to that, and which requests are still worth answering?',
        walkthrough: [
          { text: 'Normal: 20 workers at 2 ms each finish about 10,000 a second, which covers 8,000 arrivals.', focus: ['ranker'] },
          { text: 'Five times slower, they finish only 2,000 a second, so thousands wait each second and the delay keeps growing.', focus: ['ranker', 'suggest'] },
          { text: 'Fewer arrivals help most: debouncing and the edge cache cut what reaches the service.', focus: ['box', 'edge'] },
          { text: 'For what remains, a request for an old prefix is worthless, and the trending boost is optional, so drop or skip.', focus: ['suggest', 'ranker'] },
        ],
        solution: [{ type: 'list', items: ['Debounce on the client (about 100 ms) and cancel in-flight requests when the user types on.', 'Cache popular prefixes at the edge.', 'Put a time limit on the ranking call; if it is slow, skip it and return the plain index result.', 'Drop requests for prefixes the user has already typed past.'] }],
        why: 'The best protection is to stop sending requests that no longer matter; the second best is to make the optional slow part skippable.',
      },
      lessons: ['backpressure', 'timeouts', 'rate-limiting', 'lab-queue-backlog'],
    },
    {
      id: 'outage', title: 'Suggestions offline', intro: 'The interviewer changes one condition. Predict, run it on your design, then revise.',
      question: 'The suggestion service goes offline. What does someone typing in the search box see, and what should they see?',
      change: { announce: 'New condition: Suggest service stops answering for two minutes after a bad deploy.', rule: RULES.trace, alternate: { announce: 'New condition: the ranking service stops answering.', label: 'Replay with the ranking service down' } },
      activity: {
        kind: 'trace', request: 'a suggestion request from the search box', from: ['box'], to: ['suggest', 'ranker'], failCandidates: ['suggest', 'ranker'],
        predict: { q: 'While that part is down, what does the search box show?', choices: [{ id: 'error', label: 'An error, or suggestions that never arrive' }, { id: 'delayed', label: 'The request waits and is answered later' }, { id: 'ok', label: 'Nothing changes' }] },
      },
      help: {
        hint: 'Suggestions are a convenience. Should their failure be able to stop someone searching?',
        walkthrough: [
          { text: 'A request on the synchronous path to the failed part cannot be answered, so it errors or times out.', focus: ['box', 'suggest'] },
          { text: 'The edge cache can still answer popular prefixes it already holds.', focus: ['edge'] },
          { text: 'The search box gives up after a short timeout and shows no suggestions, but typing and searching still work.', focus: ['box'] },
          { text: 'If only the ranking service is down, Suggest service skips the boost and returns the plain index result.', focus: ['suggest', 'ranker'] },
        ],
        solution: [{ type: 'list', items: ['Short client timeout (about 150 ms), then hide the dropdown quietly; never block typing.', 'Let the edge cache serve stale popular prefixes during the outage.', 'Treat the ranking service as optional: skip it on timeout.', 'Roll back the bad deploy; the old index version is still loaded.'] }],
        why: 'Suggestions are an enhancement. Failing quietly keeps the search box working, which is the part of the brief that must hold.',
      },
      lessons: ['timeouts', 'availability', 'retries', 'caching'],
    },
  ],
  rules: [
    // Design
    { id: 'edge-first', stage: 'design', when: { link: [{ type: 'edge' }, { type: 'suggest' }] }, ack: '{type:edge} sits in front of {type:suggest}, so popular prefixes never reach it.', strength: 'You put {type:edge} in front of {type:suggest} to answer common prefixes.' },
    { id: 'cache-hit', stage: 'design', when: { result: 'trace:type', is: 'hit' }, ack: 'Your trace stopped at {kind:cache}: the service was never asked for that prefix.', strength: 'You traced “typing a prefix” and proved the cache answers it before the service.' },
    { id: 'no-suggest', stage: 'design', when: { lacks: { type: 'suggest' } }, coach: 'Something has to hold the ranked names. Add Suggest service and connect the search box to it.', gap: { text: 'Nothing held the ranked index.', fix: 'Add Suggest service with the top ten stored for each prefix.', stage: 'design', lesson: 'caching' }, priority: 3 },
    { id: 'connect-path', stage: 'design', when: { all: [{ has: { type: 'suggest' } }, { not: { path: ['client', { type: 'suggest' }] } }] }, coach: 'Connect the path: Search box → Suggest service. Select a part, then “Connect to…”.', priority: 2 },
    { id: 'trace-now', stage: 'design', when: { all: [{ path: ['client', { type: 'suggest' }] }, { not: { result: 'trace:type', is: ['ok', 'hit'] } }] }, coach: 'Press “Trace a request” to watch “ri” travel through your design.', priority: 1 },
    { id: 'no-cache', stage: 'design', when: { all: [{ result: 'trace:type', is: 'ok' }, { lacks: 'cache' }] }, priority: 8, ask: { text: 'Every keystroke reached {type:suggest}. At 10,000 requests a second, what takes the load off?', choices: [
      { id: 'edge', label: 'A cache in front for popular prefixes', reply: 'Yes. Short prefixes are few and hot, so a small cache answers most of them. Insert it and trace again.', verdict: 'sound' },
      { id: 'debounce', label: 'Send fewer requests from the box', reply: 'Also sound and cheapest: wait for a short pause, and cancel requests the user has typed past. Do both.', verdict: 'sound' },
      { id: 'servers', label: 'More Suggest service servers', reply: 'That works, but you pay to answer many requests the user has already typed past.', verdict: 'partial' },
    ] }, gap: { text: 'Every keystroke reached the suggestion service.', fix: 'Add an edge cache for popular prefixes and debounce on the client.', stage: 'design', lesson: 'caching' } },
    { id: 'cache-stale', stage: 'design', when: { has: 'cache' }, priority: 6, ask: { text: 'A new day’s index is loaded and a band’s rank changes. How long may {kind:cache} serve the old answer?', choices: [
      { id: 'ttl', label: 'A few minutes: the ranking only changes daily', reply: 'Yes. A short expiry is simpler than invalidating every cached prefix, and nobody notices a few minutes.', verdict: 'sound' },
      { id: 'never', label: 'Never: invalidate every prefix on each deploy', reply: 'That empties the cache just when load arrives, as every keystroke misses at once.', verdict: 'risky' },
      { id: 'forever', label: 'Until it is evicted', reply: 'Yesterday’s ranking could be served for days. Give entries an expiry.', verdict: 'risky' },
    ] } },
    { id: 'build-offline', stage: 'design', when: { link: [{ type: 'builder' }, { type: ['suggest', 'index'] }] }, ack: 'The index is built offline by {type:builder}, away from the request path.', strength: 'You built the ranking offline, so serving stays fast and the build can take hours.' },
    { id: 'live-sort', stage: 'design', when: { answer: 'assume:structure', is: 'live' }, priority: 7, ask: { text: 'You chose to sort matches on each request. A user types “r”. How many names match?', choices: [
      { id: 'precompute', label: 'Hundreds of thousands: store the top ten per prefix ahead of time', reply: 'Right. Memory is cheap compared with sorting 300,000 names on every keystroke.', verdict: 'sound' },
      { id: 'limit', label: 'Hundreds of thousands, but a fast sort handles it', reply: 'A fast sort of 300,000 names is milliseconds, thousands of times a second. It fits no 100 ms budget at peak.', verdict: 'risky' },
    ] }, gap: { text: 'Matches were sorted on every request.', fix: 'Precompute the top ten for each prefix when the index is built.', stage: 'design', lesson: 'caching' } },
    { id: 'engine-alt', stage: 'design', when: { link: [{ type: 'suggest' }, 'search'] }, priority: 7, ack: 'You use a search index instead of a custom in-memory index. That is a valid alternative.', ask: { text: 'What do you give up compared with a precomputed in-memory index?', choices: [
      { id: 'latency', label: 'Some latency and per-query cost, but you gain filtering and typo tolerance', reply: 'Yes. A search engine suits richer features. Keep a cache in front to protect its latency.', verdict: 'sound' },
      { id: 'nothing', label: 'Nothing', reply: 'Each request does real work in the engine, which costs more at 10,000 a second than a lookup in memory.', verdict: 'partial' },
    ] }, strength: 'You proposed a search engine for suggestions and could name the trade-off.' },
    { id: 'atomic-swap', stage: 'design', when: { has: { type: 'index' } }, priority: 5, ask: { text: 'Your diagram cannot show it: how does a server move to a new day’s index without a gap?', choices: [
      { id: 'swap', label: 'Load the new version beside the old one, then switch', reply: 'Yes. The old version keeps answering until the new one is ready, and rollback is switching back.', verdict: 'sound' },
      { id: 'replace', label: 'Stop, load the new file, restart', reply: 'That leaves a gap of seconds or more, and every server restarts together unless staggered.', verdict: 'risky' },
    ] } },
    // Capacity
    { id: 'cap-bounded', stage: 'capacity', when: { result: 'capacity', is: ['shed:bounded', 'breaker:bounded'] }, ack: 'With that policy the delay stayed short while the ranking service was slow.', strength: 'You kept waits bounded when a dependency slowed down.' },
    { id: 'cap-wait', stage: 'capacity', when: { result: 'capacity', is: 'wait:unbounded' }, priority: 6, ask: { text: 'With “keep waiting”, the delay kept growing. Does a suggestion that arrives ten seconds late help anyone?', choices: [
      { id: 'no', label: 'No: the user has typed on, so late answers are useless', reply: 'Right. Waiting in a line that grows is worse than answering fewer requests quickly.', verdict: 'sound' },
      { id: 'yes', label: 'Yes, eventually everyone gets an answer', reply: 'The answer is for a prefix they typed past. Work on it competes with the live ones.', verdict: 'risky' },
    ] }, gap: { text: 'The suggestion queue grew without limit when ranking slowed.', fix: 'Drop stale keystrokes or skip the ranking call while it is slow.', stage: 'capacity', lesson: 'backpressure' } },
    { id: 'cap-retry', stage: 'capacity', when: { result: 'capacity', is: 'retry:unbounded' }, priority: 7, ask: { text: 'Retrying made it worse. Each retry is a duplicate of a request still waiting. What would make retries safe?', choices: [
      { id: 'cancel', label: 'Cancel the old request, add a short back-off, and stop after one retry', reply: 'Yes: retries multiply load exactly when the system is least able to take it, so cap them.', verdict: 'sound' },
      { id: 'more', label: 'Retry more often so users get an answer sooner', reply: 'That is the retry storm. More attempts means a longer queue and later answers.', verdict: 'risky' },
    ] } },
    { id: 'cap-breaker', stage: 'capacity', when: { result: 'capacity', is: 'breaker:bounded' }, priority: 5, ask: { text: 'You skip ranking while it is slow. What do users get instead?', choices: [
      { id: 'plain', label: 'The plain index result, without the trending boost', reply: 'Yes: slightly less fresh, but on time. The daily ranking is a good answer on its own.', verdict: 'sound' },
      { id: 'blank', label: 'No suggestions', reply: 'Safe, but an optional boost shouldn’t be able to switch off the main feature.', verdict: 'partial' },
    ] } },
    { id: 'cap-debounce', stage: 'capacity', when: { answer: 'assume:load', is: 'absorb' }, priority: 5, ask: { text: 'You chose to absorb every keystroke. A person types a ten-letter name in one second. How many requests did that make?', choices: [
      { id: 'ten', label: 'Ten, nine of them for prefixes they had already typed past', reply: 'Right. Debounce and cancel, so only the prefix they pause on is sent.', verdict: 'sound' },
      { id: 'one', label: 'One', reply: 'Without debouncing it is one per keystroke, ten here, nine of them wasted.', verdict: 'risky' },
    ] }, gap: { text: 'Every keystroke became a request.', fix: 'Debounce on the client and cancel requests for old prefixes.', stage: 'capacity', lesson: 'rate-limiting' } },
    // Outage
    { id: 'out-delayed', stage: 'outage', when: { result: 'outage', is: 'delayed' }, ack: 'Your design hands the request to {kind:queue} or {kind:stream}, so it waits for the part to return.', ask: { text: 'For a suggestion request, is waiting for the part to come back the right behaviour?', choices: [
      { id: 'no', label: 'No: a suggestion for an old prefix is useless; fail fast and hide the dropdown', reply: 'Yes. Queues suit work that must happen. Suggestions are worthless if they are late.', verdict: 'sound' },
      { id: 'yes', label: 'Yes: nothing should be lost', reply: 'Nothing is lost by dropping a suggestion: the user simply types on.', verdict: 'risky' },
    ] } },
    { id: 'out-error', stage: 'outage', when: { result: 'outage', is: 'error' }, priority: 6, ask: { text: 'With that part down, the request fails. What should the search box do?', choices: [
      { id: 'quiet', label: 'Time out quickly, hide suggestions, and keep typing and search working', reply: 'Yes: suggestions are a convenience, so their failure must not touch the main feature.', verdict: 'sound' },
      { id: 'retry', label: 'Keep retrying every keystroke until it answers', reply: 'During an outage that sends the failing part a flood. Back off and stay quiet.', verdict: 'risky' },
      { id: 'error', label: 'Show an error message', reply: 'Acceptable if brief, but an error pop-up while someone is typing a search is more disruptive than no dropdown.', verdict: 'partial' },
    ] }, gap: { text: 'An outage in suggestions could disrupt the search box.', fix: 'Use a short timeout, hide suggestions on failure, and serve stale cached prefixes.', stage: 'outage', lesson: 'availability' } },
    { id: 'out-broken', stage: 'outage', when: { result: 'outage', is: 'broken' }, coach: 'There is no chain of arrows from the search box to that part yet. Add the arrows, then run it again.', priority: 4 },
    { id: 'out-stale', stage: 'outage', when: { has: 'cache' }, priority: 5, ask: { text: 'The service is down but {kind:cache} still holds popular prefixes whose time limit just ran out. What should it do?', choices: [
      { id: 'stale', label: 'Serve the expired answer while the service is down', reply: 'Yes: a day-old ranking is far better than nothing for “ri”. This is “stale if error”.', verdict: 'sound' },
      { id: 'drop', label: 'Drop them; expired means expired', reply: 'Then the cache stops helping exactly when it is needed most.', verdict: 'partial' },
    ] }, strength: 'You let the cache serve stale popular prefixes during an outage.' },
  ],
  solution: {
    design: g([
      ['box', 'box', 'client', 'Search box', 30, 220], ['edge', 'edge', 'cache', 'Edge cache', 170, 220], ['suggest', 'suggest', 'service', 'Suggest service', 320, 220],
      ['ranker', 'ranker', 'service', 'Ranking service', 480, 100], ['indexstore', 'index', 'storage', 'Index files', 480, 260], ['builder', 'builder', 'worker', 'Daily index builder', 320, 380],
      ['logs', 'logs', 'db', 'Query logs', 500, 350], ['catalog', 'catalog', 'db', 'Artist catalog', 500, 420],
    ], [
      ['box', 'edge', 'sends request'], ['edge', 'suggest', 'sends request'], ['suggest', 'ranker', 'calls'], ['suggest', 'indexstore', 'reads from'],
      ['builder', 'indexstore', 'writes to'], ['builder', 'logs', 'reads from'], ['builder', 'catalog', 'reads from'],
    ]),
    why: {
      box: 'Debounces keystrokes, cancels requests for old prefixes, and hides suggestions quietly if they fail.',
      edge: 'Answers popular prefixes for a few minutes, and can serve stale ones during an outage.',
      suggest: 'Holds the ranked index in memory with the top ten per prefix, so a lookup needs no sorting.',
      ranker: 'Optional live trending boost with a short time limit; skipped when slow or down.',
      indexstore: 'Versioned files for each day’s index, so servers can load a new one and roll back to an old one.',
      builder: 'Builds the new day’s ranked index offline, away from the request path.',
      logs: 'The popularity signal: what people searched and bought.',
      catalog: 'The names that suggestions are drawn from.',
    },
    alternatives: { suggest: { types: ['search'], tradeoff: 'A search engine with a completion feature gives typo tolerance and filters with less code, at a higher cost per request and less control over ranking.' } },
    trace: { title: 'Typing “ri” in the search box', steps: [
      { from: 'box', to: 'edge', text: 'After a 100 ms pause, the box sends GET /suggest?q=ri.' },
      { from: 'edge', to: 'suggest', text: 'On a miss, the edge cache forwards the request. (On a hit, it answers and this step never happens.)' },
      { from: 'suggest', to: 'indexstore', text: 'Suggest service already holds the day’s index, loaded from the latest index file; it walks r → i and reads the stored top ten.' },
      { from: 'suggest', to: 'ranker', text: 'It asks Ranking service for a trending boost with a 30 ms limit; on timeout it returns the plain list.' },
      { from: 'builder', to: 'indexstore', text: 'Overnight, the builder reads logs and the catalog and writes tomorrow’s index file. Servers load it in the background and switch at once.' },
    ] },
    tradeoff: 'Precomputing top ten per prefix makes lookups instant at the price of memory and a daily build; fresh changes such as trending must come through a separate small layer.',
    otherApproach: 'If you need typo tolerance, filters or frequent changes, use a search engine’s completion feature and accept higher cost per request, keeping the edge cache in front.',
  },
};
