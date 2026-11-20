import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const rateLimiter: InterviewScript = {
  caseId: 'case-rate-limiter',
  track: 'hld',
  doLine: 'Place the limiter in front of a public API, race two requests at the limit and fix it with an atomic check, then take the counter store offline',
  skills: ['concurrency', 'reliability', 'architecture', 'consistency'],
  brief: {
    interviewer: { name: 'Elena', role: 'platform engineer who owns the API gateway' },
    intro: 'Our public API is used by thousands of customers. Every few weeks one of them has a bug, loops, and sends us far more requests than they should, and everyone else gets slow responses. We need a limiter that says “that is enough for now”.',
    users: 'API customers, each identified by an API key, and the engineers who run the API.',
    needs: ['Limit each API key to 100 requests a second, with short bursts up to 200', 'Tell a limited caller clearly how long to wait', 'Change a customer’s limit without redeploying'],
    mustHold: ['A key cannot exceed its limit by more than a small margin, even when requests arrive at the same moment on different servers', 'The limiter never makes a healthy API slow', 'If the limiter itself breaks, the API stays up'],
    constraints: ['50 gateway servers sharing 200,000 requests a second', 'Limits per API key, roughly accurate to within 10%', 'The limiter may add less than 2 ms to a request', 'Limited requests get HTTP 429 with a Retry-After header'],
    outOfScope: ['Billing and quotas per month', 'Detecting attacks by IP address', 'Dashboards'],
    terms: [
      { term: 'token bucket', meaning: 'a counter that refills at a steady rate and loses one for each request; an empty bucket means “too many”' },
      { term: 'atomic', meaning: 'done as one indivisible step, so no other request can slip in between the check and the change' },
      { term: 'fail open', meaning: 'when the limiter breaks, let requests through anyway' },
      { term: 'fail closed', meaning: 'when the limiter breaks, refuse requests' },
    ],
    firstMove: 'Keep it to one customer for now. They send 150 requests in one second and their limit is 100. Show me where the request is checked, where the count lives, and what the customer sees for the last 50.',
  },
  palette: [
    { type: 'api-client', kind: 'client', name: 'API client', blurb: 'A customer’s program calling our API with an API key.' },
    { type: 'gateway', kind: 'gateway', name: 'API gateway', blurb: 'The front door: one of 50 servers that checks the key and the limit before passing a request on.' },
    { type: 'local', kind: 'cache', name: 'Local buckets', blurb: 'Counters kept in each gateway’s own memory. Very fast; they do not see other gateways.' },
    { type: 'store', kind: 'cache', name: 'Shared counter store', blurb: 'One fast store (such as Redis) that all gateways use, so counts are shared.' },
    { type: 'api', kind: 'service', name: 'API servers', blurb: 'The real work. They only see requests the limiter allowed.' },
    { type: 'config', kind: 'db', name: 'Limit config', blurb: 'The limit and burst for each customer, changed by operators.' },
  ],
  verbs: ['sends request', 'reads and writes', 'reads from', 'writes to', 'calls'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'key', q: 'What do we limit by: key, IP, endpoint?', a: 'By API key, mainly. Per-endpoint limits may come later.' },
          { id: 'rate', q: 'What is the limit, and are bursts allowed?', a: '100 requests a second per key, with bursts up to 200 that average out.' },
          { id: 'accuracy', q: 'How exact must the count be?', a: 'Within about 10%. It protects capacity; it is not a billing meter.' },
          { id: 'latency', q: 'How much time may the check add?', a: 'Under 2 ms. It runs on every request.' },
          { id: 'servers', q: 'How many servers handle one customer?', a: 'Fifty gateways share the load, so one customer’s requests land on all of them.' },
          { id: 'failure', q: 'What if the limiter itself is down?', a: 'The API must keep working. A limiter outage may not become an API outage.' },
        ],
        assumptions: [
          { id: 'where', q: 'Where is the count kept?', options: [
            { id: 'central', label: 'One shared store that every gateway updates on each request', consequence: 'Accurate, but it adds a network hop per request and the store must take 200,000 operations a second.' },
            { id: 'local', label: 'Each gateway counts alone and syncs now and then', consequence: 'Almost free per request, but a customer can briefly exceed the limit across gateways.' },
          ] },
          { id: 'down', q: 'When the counter store is unreachable, what should happen?', options: [
            { id: 'open', label: 'Fail open: allow requests, with local limits', consequence: 'The API stays up with approximate limiting. You must alert, or nobody notices.' },
            { id: 'closed', label: 'Fail closed: refuse requests', consequence: 'Limits stay strict, but a limiter outage takes the whole API with it.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers tell you how exact the count must be, and what the limiter may cost?',
        walkthrough: [
          { text: 'Fifty gateways mean one customer’s count is spread across many machines.' },
          { text: '“Within 10%” and “under 2 ms” tell you how exact the count has to be and how much one check may cost.' },
          { text: 'Two requests at the same instant on different gateways are the dangerous case.' },
          { text: 'The API must stay up if the limiter breaks, which decides open versus closed.' },
        ],
        solution: [{ type: 'list', items: ['Limit per API key: 100 a second, bursts to 200.', 'About 10% accuracy; under 2 ms added.', '50 gateways share each customer.', 'A limiter outage must not become an API outage.'] }],
        why: 'These answers decide where the count lives, how exact it must be, and what the limiter does when it fails. The algorithm details can wait.',
      },
      lessons: ['requirements'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts on the path of an API request and connect them. Then trace a request through your own design.',
      question: 'Show me where an API request is checked. Where does the count live, and what does the API behind it see?',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-client', 'api-client', 'client', 'API client', 50, 220], ['s-gw', 'gateway', 'gateway', 'API gateway', 280, 220]], [['s-client', 's-gw', 'sends request']]),
        traces: [
          { id: 'check', label: 'An API request is checked by the limiter', token: 'GET /v1/items  key=k_4411', from: 'client', to: { type: ['store', 'local'] } },
          { id: 'serve', label: 'An allowed request reaches the API', token: 'GET /v1/items  key=k_4411', from: 'client', to: { type: ['api'] } },
        ],
      },
      help: {
        hint: 'If 50 gateways each count only their own requests, how much can one customer send before anyone says no?',
        walkthrough: [
          { text: 'Every request passes through a gateway, which is where the limit is checked, before the API sees it.', focus: ['client', 'gateway'] },
          { text: 'The gateway spends a token from a counter for the key: a small shared store, so all 50 gateways agree.', focus: ['gateway', 'store'] },
          { text: 'Limits come from config, pushed to the gateways, so they change without a redeploy.', focus: ['config', 'gateway'] },
          { text: 'Allowed requests continue to the API servers. A refused one gets 429 and Retry-After at the gateway.', focus: ['gateway', 'api'] },
        ],
        solution: [
          { type: 'p', text: '**Check at the gateway, count in a shared place.** Each gateway asks the counter store to spend a token for the API key; if none is left it answers 429 itself and the API never sees the request.' },
          { type: 'code', lang: 'http', code: 'HTTP/1.1 429 Too Many Requests\nRetry-After: 1\nX-RateLimit-Limit: 100\nX-RateLimit-Remaining: 0' },
        ],
        why: 'Checking at the front door protects everything behind it, and a shared counter gives all 50 gateways the same answer for the same key.',
      },
      lessons: ['rate-limiting', 'proxies-gateways'],
    },
    {
      id: 'race', title: 'Two requests at the limit', intro: 'A customer has used 9 of 10 requests in this window. Two requests arrive at almost the same moment on different gateways.',
      question: 'Both requests read the counter at 9 of 10 and both are allowed. How many requests were allowed past the limit, and how do you prevent it?',
      activity: {
        kind: 'timeline', names: ['Request A', 'Request B'], resource: 'Counter for key k_4411 (requests left in this window)', initial: 1,
        read: 'reads the counter', write: 'adds one to the counter',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'Read, then write', detail: 'Read the count; if it is below the limit, write count + 1. Two separate steps.', code: 'count = GET key\nif count < limit:\n    SET key count+1   # allowed' },
          { id: 'conditional', label: 'Atomic increment', detail: 'One step that adds one only if the count is still below the limit, and says whether it did.', code: '-- Redis Lua, runs as one step\nlocal n = tonumber(redis.call("GET", key) or "0")\nif n < limit then redis.call("INCR", key); return 1 end\nreturn 0' },
          { id: 'lock', label: 'Lock the counter', detail: 'The first reader locks the counter; the second waits until the first has written.', code: 'lock(key)\ncount = GET key; …; SET key count+1\nunlock(key)' },
        ],
        predict: { q: 'With “read, then write” and this order, how many of the two are allowed?', choices: [{ id: 'one', label: 'Only one of them' }, { id: 'both', label: 'Both, though only one was left' }, { id: 'none', label: 'Neither' }] },
      },
      help: {
        hint: 'What did Request B see when it read, and was it still true when B wrote?',
        walkthrough: [
          { text: 'Request A reads: 1 left.' },
          { text: 'Request B reads before A writes: it also sees 1 left.' },
          { text: 'A allows itself and writes. B allows itself too, because its decision used a number that is no longer true.' },
          { text: 'Fix: make the check and the increment one step (atomic), so the second request sees 0 left.' },
        ],
        solution: [
          { type: 'p', text: 'With read-then-write, **both** are allowed and the limit is passed by one. An atomic increment lets exactly one through in every order: the second sees the new count and is refused.' },
          { type: 'code', lang: 'python', code: "def allow(store, key, limit):\n    # one atomic step in the store: increment only while below the limit\n    return store.incr_if_below(key, limit)   # True → allowed, False → 429" },
        ],
        why: '“Cannot exceed the limit by more than a small margin” holds across 50 gateways only if the check and the change are one step in the shared store.',
      },
      lessons: ['concurrent-reservations', 'locking-mvcc', 'transactions'],
    },
    {
      id: 'outage', title: 'The counter store goes offline', intro: 'The interviewer changes one condition. Predict, run it on your design, then revise.',
      question: 'The shared counter store is unreachable. What does a customer see, and should the limiter fail open or fail closed?',
      change: { announce: 'New condition: the shared counter store becomes unreachable for five minutes, right in the middle of a busy afternoon.', rule: RULES.trace, alternate: { announce: 'New condition: one gateway loses its connection to the counter store, while the other 49 are fine.', label: 'Replay with a gateway down' } },
      activity: {
        kind: 'trace', request: 'an API request that must be checked against the counter store', from: ['api-client'], to: ['store'], failCandidates: ['store', 'gateway'],
        predict: { q: 'While the store is down, what does the customer see in your design?', choices: [{ id: 'error', label: 'An error: the request cannot be checked' }, { id: 'delayed', label: 'A normal reply; the check catches up later' }, { id: 'ok', label: 'Nothing changes' }] },
      },
      help: {
        hint: 'When the gateway cannot reach the store, what should it do with the request in its hand: refuse it or let it pass?',
        walkthrough: [
          { text: 'The gateway calls the store for every request. If the call fails, the gateway has to decide on its own.', focus: ['gateway', 'store'] },
          { text: 'Fail closed refuses everything: the limiter’s outage becomes an API outage.', focus: ['gateway', 'api'] },
          { text: 'Fail open falls back to each gateway’s own bucket, set to a share of the limit, so abuse is still bounded roughly.', focus: ['gateway', 'local'] },
          { text: 'Raise an alert either way, so people know limits are approximate.', focus: ['gateway'] },
        ],
        solution: [{ type: 'list', items: ['Give the store call a short timeout (a few milliseconds).', 'On failure, fall back to local buckets at limit ÷ 50 per gateway.', 'Alert, and recover to shared counts when the store returns.', 'Fail closed only where an overshoot costs more than an outage, for example login attempts.'] }],
        why: '“If the limiter breaks, the API stays up” needs an explicit fallback: without one, the limiter becomes the weakest part of the whole API.',
      },
      lessons: ['availability', 'timeouts', 'failover'],
    },
  ],
  rules: [
    // Design stage
    { id: 'shared-count', stage: 'design', when: { link: [{ type: 'gateway' }, { type: 'store' }], labels: ['reads and writes', 'writes to'] }, ack: '{type:gateway} spends tokens in {type:store}, so every gateway sees the same count for a key.', strength: 'You put the count in a shared store, so 50 gateways agree on one customer’s usage.' },
    { id: 'no-count', stage: 'design', when: { all: [{ lacks: { type: 'store' } }, { lacks: { type: 'local' } }] }, coach: 'Where does the count live? Add a place to keep it, then connect the gateway to it.', gap: { text: 'There was no place where the count was kept.', fix: 'Add a counter store (shared) or local buckets, and connect the gateway to it.', stage: 'design', lesson: 'rate-limiting' }, priority: 4 },
    { id: 'connect-path', stage: 'design', when: { all: [{ has: { type: 'api' } }, { not: { path: ['client', { type: 'api' }] } }] }, coach: 'Connect the path: API client → API gateway → API servers. Select a part, then “Connect to…”.', priority: 3 },
    { id: 'trace-now', stage: 'design', when: { all: [{ path: ['client', { type: ['store', 'local'] }] }, { not: { result: 'trace:check', is: ['ok', 'hit'] } }] }, coach: 'Press “Trace a request” to watch a request pass the limiter.', priority: 1 },
    { id: 'skip-gateway', stage: 'design', when: { link: ['client', 'service'] }, priority: 9, ask: { text: 'Your client sends requests straight to {kind:service}. Where is the limit checked?', choices: [
      { id: 'front', label: 'In a gateway in front, before the API does any work', reply: 'Yes. A refused request should cost almost nothing, so check at the door.', verdict: 'sound' },
      { id: 'inside', label: 'Inside each API server', reply: 'It works for one server. With many, each server counts only the requests it sees, and the checks cost API capacity.', verdict: 'partial' },
      { id: 'none', label: 'Nowhere; the servers are fast', reply: 'One looping customer can still use every server. Limit at the front.', verdict: 'risky' },
    ] }, gap: { text: 'Requests reached the API with no limit check in front.', fix: 'Check the limit at the gateway, before any API server does work.', stage: 'design', lesson: 'proxies-gateways' } },
    { id: 'local-only', stage: 'design', when: { all: [{ has: { type: 'local' } }, { lacks: { type: 'store' } }] }, priority: 8, ack: 'You count in each gateway’s own memory: a valid alternative to a shared store.', ask: { text: 'With only local buckets, a customer’s requests are spread over 50 gateways. If each gateway allows 100 a second, how much can the customer send?', choices: [
      { id: 'divide', label: 'Give each gateway limit ÷ 50, accepting uneven spread', reply: 'Good: this is how local-only works. It is inaccurate when a key’s traffic is uneven across gateways, so check that load is spread evenly; the brief allows about 10%.', verdict: 'sound' },
      { id: 'times', label: 'Up to 50 × 100 = 5,000 a second', reply: 'Yes, that is the risk if each gateway uses the full limit. Divide the limit, or sync usage.', verdict: 'partial' },
      { id: 'fine', label: 'It is fine, the API will cope', reply: 'The point of the limit is that it does not have to cope. Share the limit between gateways.', verdict: 'risky' },
    ] }, strength: 'You weighed local counting against a shared store and what it does to accuracy.' },
    { id: 'hybrid', stage: 'design', when: { all: [{ link: [{ type: 'gateway' }, { type: 'local' }] }, { link: [{ type: 'gateway' }, { type: 'store' }] }] }, ack: 'You use local buckets and a shared store together: a fast path with periodic reconciliation.', strength: 'You combined local buckets with a shared store, trading a little accuracy for speed and resilience.' },
    { id: 'atomic-unseen', stage: 'design', when: { link: [{ type: 'gateway' }, { type: 'store' }] }, priority: 6, ask: { text: 'An arrow from {type:gateway} to {type:store} shows that the gateway uses the counter. It does not show how two gateways updating the same key at once stay correct. What makes it correct?', choices: [
      { id: 'atomic', label: 'One atomic operation in the store: increment only if below the limit', reply: 'Yes. We will race two requests in a moment to see exactly why.', verdict: 'sound' },
      { id: 'read-write', label: 'The gateway reads the count, then writes the new one', reply: 'Two gateways can both read the same number. We will run that race next.', verdict: 'risky' },
      { id: 'one-gateway', label: 'Send each key to one gateway so nobody competes', reply: 'A valid alternative: sticky routing by key. It makes counts local, but hot keys overload one gateway and a gateway failure loses its counts.', verdict: 'partial' },
    ] } },
    { id: 'config-link', stage: 'design', when: { link: [{ type: 'config' }, { type: 'gateway' }] }, ack: '{type:config} supplies limits to {type:gateway}, so a limit can change without a deploy.', strength: 'You kept limits in config, so a customer’s limit changes without a redeploy.' },
    { id: 'no-config', stage: 'design', when: { all: [{ has: { type: 'store' } }, { lacks: { type: 'config' } }] }, coach: 'Where does each customer’s limit come from? Consider adding Limit config.', priority: 2 },
    { id: 'hop-cost', stage: 'design', when: { result: 'trace:check', is: 'ok' }, priority: 5, ask: { text: 'Every request now makes a call to {type:store}. At 200,000 requests a second and a 2 ms budget, what is the cost?', choices: [
      { id: 'fast', label: 'One short in-datacenter call costs about a millisecond or less, but the store must take 200,000 operations a second', reply: 'Right. Size and shard the store by key, and give the call a tight timeout.', verdict: 'sound' },
      { id: 'free', label: 'None, it is just a counter', reply: 'It is a network hop on every request. Budget for it, and for the store’s capacity.', verdict: 'risky' },
    ] } },
    // Race stage
    { id: 'race-fixed', stage: 'race', when: { result: 'race', is: 'one' }, ack: 'Only one request was allowed in every order you tried.', strength: 'You made the check and the increment one atomic step, so the limit holds across gateways.' },
    { id: 'race-over', stage: 'race', when: { result: 'race', is: 'oversold' }, priority: 5, ask: { text: 'Both were allowed with one slot left. Which part must make the check and the increment one step?', choices: [
      { id: 'store', label: 'The shared counter store, with an atomic operation', reply: 'Yes. Only the place that holds the count can make the decision safely. Switch the guard and run again.', verdict: 'sound' },
      { id: 'gateway', label: 'Each gateway should check twice', reply: 'Checking twice is still checking before changing. The check has to be part of the change.', verdict: 'risky' },
    ] }, gap: { text: 'The limiter read the count and then wrote it, so two requests could both pass at the limit.', fix: 'Do the check and the increment as one atomic operation in the counter store.', stage: 'race', lesson: 'concurrent-reservations' } },
    { id: 'race-lock', stage: 'race', when: { result: 'race', is: 'one' }, priority: 3, ask: { text: 'An atomic increment and a lock both gave one winner. Why do limiters prefer the atomic step?', choices: [
      { id: 'cost', label: 'A lock adds extra round trips and can block other requests while it is held', reply: 'Yes. The atomic step does the same job in one round trip and cannot be left locked by a crash.', verdict: 'sound' },
      { id: 'same', label: 'They are identical', reply: 'Same outcome, different cost. A lock held by a crashed gateway can block everyone behind it.', verdict: 'partial' },
    ] } },
    // Outage stage
    { id: 'outage-error', stage: 'outage', when: { result: 'outage', is: 'error' }, priority: 6, ask: { text: 'In your design the request failed when the counter store went down. What should the gateway do instead?', choices: [
      { id: 'open', label: 'Fail open to local buckets at limit ÷ 50, and alert', reply: 'Yes. The API stays up with approximate limits, and someone is told.', verdict: 'sound' },
      { id: 'closed', label: 'Fail closed and refuse requests', reply: 'Right for something like login attempts, where an overshoot is worse than downtime. For this API a limiter outage should not be an API outage.', verdict: 'partial' },
      { id: 'wait', label: 'Wait for the store to come back', reply: 'Requests pile up on the gateway and the whole API stalls. Give the call a short timeout and decide.', verdict: 'risky' },
    ] }, gap: { text: 'A counter store outage became an API outage.', fix: 'Time out the store call and fall back to local limits (fail open), with an alert.', stage: 'outage', lesson: 'availability' } },
    { id: 'outage-ok', stage: 'outage', when: { result: 'outage', is: ['ok', 'delayed'] }, ack: 'In your design requests still got through while the store was down.', strength: 'Your design keeps requests flowing when the counter store is offline.' },
    { id: 'outage-broken', stage: 'outage', when: { result: 'outage', is: 'broken' }, coach: 'There is no chain of arrows from the client to the counter store yet. Add the arrows, then run it again.', priority: 4 },
    { id: 'fallback-unseen', stage: 'outage', when: { has: { type: 'store' } }, priority: 5, ask: { text: 'The diagram shows a store the gateway depends on. It does not show what the gateway does when that store is slow rather than down. What should happen?', choices: [
      { id: 'timeout', label: 'A short timeout (a few milliseconds), then fall back to local limits', reply: 'Yes. A slow limiter hurts a healthy API as much as a dead one.', verdict: 'sound' },
      { id: 'long', label: 'Wait up to a second, in case it answers', reply: 'Every request now waits a second, against a 2 ms budget.', verdict: 'risky' },
      { id: 'skip', label: 'Skip the check for customers who are normally under their limit', reply: 'A cheaper, valid idea for very light users, but it needs usage history and it lets a newly buggy client through.', verdict: 'partial' },
    ] } },
    { id: 'open-answer', when: { answer: 'outage-error', is: 'open' }, strength: 'You chose to fail open with local limits and an alert, so a limiter outage does not take the API down.' },
    { id: 'open-assumed', when: { answer: 'assume:down', is: 'open' }, strength: 'You decided up front to fail open when the counter store is unreachable.' },
  ],
  solution: {
    design: g([
      ['client', 'api-client', 'client', 'API client', 20, 220], ['gateway', 'gateway', 'gateway', 'API gateway', 180, 220], ['local', 'local', 'cache', 'Local buckets', 340, 340],
      ['store', 'store', 'cache', 'Shared counter store', 340, 220], ['config', 'config', 'db', 'Limit config', 340, 80], ['api', 'api', 'service', 'API servers', 520, 220],
    ], [
      ['client', 'gateway', 'sends request'], ['gateway', 'store', 'reads and writes'], ['gateway', 'local', 'reads and writes'], ['config', 'gateway', 'calls'], ['gateway', 'api', 'sends request'],
    ]),
    why: {
      client: 'A customer’s program. It must handle 429 and wait for Retry-After.',
      gateway: 'Where the limit is checked, before any API server works. Answers 429 itself.',
      local: 'In-memory buckets per gateway: the fallback when the store is slow or down, set to limit ÷ 50.',
      store: 'Holds one counter per key. One atomic “increment if below the limit” per request, so 50 gateways agree.',
      config: 'Each customer’s limit and burst, pushed to gateways so it changes without a deploy.',
      api: 'Does the real work, and only sees allowed requests.',
    },
    alternatives: { store: { types: ['local'], tradeoff: 'Local buckets with periodic sync are nearly free per request and resilient, but a customer can overshoot by the sync gap across 50 gateways. Use them when ±10% is fine.' } },
    trace: { title: 'A request from key k_4411 is checked', steps: [
      { from: 'client', to: 'gateway', text: 'GET /v1/items with key k_4411 reaches one of the 50 gateways.' },
      { from: 'config', to: 'gateway', text: 'The gateway already holds k_4411’s limit: 100 a second, burst 200.' },
      { from: 'gateway', to: 'store', text: 'One atomic call: refill by elapsed time, spend a token if any. Time out after a few milliseconds.' },
      { from: 'gateway', to: 'local', text: 'If the call times out, use the local bucket at limit ÷ 50 (fail open) and raise an alert.' },
      { from: 'gateway', to: 'api', text: 'Allowed: forward the request. If no token was left, reply 429 with Retry-After and stop here.' },
    ] },
    tradeoff: 'A shared atomic counter is exact and simple, but it adds a hop to every request and the store becomes something the gateways depend on. Local buckets are cheaper and more resilient, but only approximately right.',
    otherApproach: 'If the limit protects money, such as a paid quota, keep the shared atomic counter and consider failing closed. If it only protects capacity, local buckets with periodic sync are enough.',
  },
};
