import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const notifications: InterviewScript = {
  caseId: 'case-notifications',
  track: 'hld',
  doLine: 'Build the path from “booking confirmed” to an email, keep a slow SMS provider from backing up the queue, then replay it with a worker or provider offline',
  skills: ['messaging', 'reliability', 'capacity', 'architecture'],
  brief: {
    interviewer: { name: 'Marcus', role: 'engineering manager on the messaging platform team' },
    intro: 'Every team in the company wants to tell customers something: a ticket is ready, a payment failed, a tour was announced. Today each team calls an email or SMS provider itself, and when a provider has a bad hour, those teams have a bad hour too.',
    users: 'Customers who get email, SMS and push messages, and the product teams that send them.',
    needs: ['A team sends one notification request and does not wait for delivery', 'Users get messages on the channels they allow, and never after opting out', 'Support can see what happened to each message'],
    mustHold: ['A critical message (a ticket) is never lost, even if a provider is down for a while', 'The same message is not sent twice because of a retry', 'A marketing burst never delays a ticket'],
    constraints: ['50 million notifications a day, about 580 a second on average', 'Peaks of 20,000 a second when a big event is announced', 'Email, SMS and push all go through outside providers that sometimes slow down, throttle or fail'],
    outOfScope: ['Writing the message templates', 'Building the opt-out screen', 'Choosing between providers on price'],
    terms: [
      { term: 'provider', meaning: 'an outside company that actually delivers the email, SMS or push message' },
      { term: 'queue', meaning: 'a list of jobs that waits until a worker takes the next one, so the sender does not have to wait' },
      { term: 'idempotency key', meaning: 'an id sent with a request so that repeating the request does not repeat its effect' },
      { term: 'circuit breaker', meaning: 'a switch that stops calling a failing part for a while, so callers fail fast instead of piling up' },
    ],
    firstMove: 'Start with one message. Booking confirms a ticket and wants the customer emailed. Draw the parts between “booking confirmed” and the inbox, and tell me which of them the booking team has to wait for.',
  },
  palette: [
    { type: 'producer', kind: 'service', name: 'Booking service', blurb: 'A team’s service that needs a customer told something, here “booking confirmed”.' },
    { type: 'notify', kind: 'service', name: 'Notify API', blurb: 'The one front door: checks the request, applies preferences, assigns an idempotency key.' },
    { type: 'prefs', kind: 'db', name: 'Preferences store', blurb: 'Which channels each user allows, opt-outs and time zone.' },
    { type: 'queue', kind: 'queue', name: 'Message queue', blurb: 'Holds messages until a worker takes them. Can be split by channel and priority.' },
    { type: 'worker', kind: 'worker', name: 'Channel worker', blurb: 'Takes a message, renders it, calls the provider and records the result.' },
    { type: 'provider', kind: 'ext', name: 'Email / SMS provider', blurb: 'An outside company that delivers the message. Sometimes slow, throttled or down.' },
    { type: 'log', kind: 'db', name: 'Delivery log', blurb: 'One row per message and channel: queued, sent, failed. Support reads it.' },
    { type: 'dlq', kind: 'queue', name: 'Dead-letter queue', blurb: 'Where a message goes after too many failed attempts, so someone can look at it.' },
  ],
  verbs: ['sends request', 'reads from', 'writes to', 'publishes event', 'delivers to', 'calls', 'reads and writes'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'critical', q: 'Are all notifications equally important?', a: 'No. A ticket or a failed payment must arrive. A promo can be late or dropped under load.' },
          { id: 'volume', q: 'How many messages, and how spiky?', a: '50 million a day, about 580 a second on average. When a big artist announces a tour it jumps to 20,000 a second.' },
          { id: 'provider', q: 'How reliable are the providers?', a: 'Mostly fine. Sometimes they slow down or throttle us, and sometimes they time out after actually sending.' },
          { id: 'duplicates', q: 'What is worse, a duplicate or a missing message?', a: 'For tickets, missing is worse. A rare duplicate is tolerable but annoying, so we avoid it where we can.' },
          { id: 'optout', q: 'Do users have preferences or opt-outs?', a: 'Yes. Marketing messages must respect opt-outs by law. The preferences store holds them.' },
          { id: 'status', q: 'Does anyone need to see what happened to a message?', a: 'Yes. Support looks up a message and sees whether it was sent, failed or is still waiting.' },
        ],
        assumptions: [
          { id: 'priority', q: 'Do critical and marketing messages share one queue?', options: [
            { id: 'shared', label: 'One queue for everything', consequence: 'Simple, but a marketing burst or a slow SMS provider can delay tickets behind it.' },
            { id: 'split', label: 'Separate queues by channel and priority', consequence: 'Failures stay contained, at the cost of more queues and workers to run.' },
          ] },
          { id: 'guarantee', q: 'What delivery guarantee do you aim for?', options: [
            { id: 'once', label: 'At most once: never send twice, may lose some', consequence: 'Tickets can silently go missing when a worker crashes. Not acceptable here.' },
            { id: 'least', label: 'At least once, with duplicate protection', consequence: 'Retries are safe only if each message carries an idempotency key.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers change what you do when a provider is slow or a worker crashes?',
        walkthrough: [
          { text: 'Critical versus marketing tells you the two must not share a line.' },
          { text: 'The 20,000 a second peak tells you the sender cannot wait on the provider.' },
          { text: 'Providers that sometimes time out after sending tell you retries need an idempotency key.' },
          { text: 'Support’s need to see status tells you every message needs a record.' },
        ],
        solution: [{ type: 'list', items: ['Critical messages must arrive; marketing may be delayed.', 'Peak 20,000 a second against about 580 on average.', 'Providers slow down, throttle and sometimes send then time out.', 'Missing is worse than duplicate, so at least once with an idempotency key.', 'Preferences and a per-message status record are required.'] }],
        why: 'These answers decide where messages wait, how retries stay safe, and what has to be recorded. Template wording and pricing can wait.',
      },
      lessons: ['requirements'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts between “booking confirmed” and the inbox and connect them. Then trace a request through your own design.',
      question: 'Show me the path of one ticket email. Which parts does the booking team wait for, and which happen later?',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-prod', 'producer', 'service', 'Booking service', 70, 220], ['s-notify', 'notify', 'service', 'Notify API', 300, 220]], [['s-prod', 's-notify', 'sends request']]),
        traces: [
          { id: 'send', label: 'Send a ticket email', token: 'POST /notify ticket-ready', from: { type: ['producer'] }, to: { type: ['provider'] } },
        ],
      },
      help: {
        hint: 'If the provider takes ten seconds, which part should be waiting, and which should have already moved on?',
        walkthrough: [
          { text: 'Booking sends one request to Notify API and gets an answer as soon as the message is accepted.', focus: ['producer', 'notify'] },
          { text: 'Notify API checks preferences, then puts the message on a queue with an idempotency key.', focus: ['notify', 'prefs', 'queue'] },
          { text: 'A worker takes the message, calls the provider and writes the result to the delivery log.', focus: ['queue', 'worker', 'provider', 'log'] },
          { text: 'After too many failed attempts the message goes to a dead-letter queue instead of vanishing.', focus: ['worker', 'dlq'] },
        ],
        solution: [
          { type: 'p', text: '**The queue is the boundary.** Booking waits only for Notify API to accept the message. Workers deliver it later and record every attempt in the delivery log.' },
          { type: 'code', lang: 'http', code: 'POST /v1/notify {user, template, channels, priority}   Idempotency-Key: ticket-881\n→ 202 {notification_id} | 200 already_accepted' },
        ],
        why: 'Putting a queue between acceptance and delivery means a slow provider cannot slow the team that sent the message, and the log gives support an answer.',
      },
      lessons: ['queues', 'idempotency'],
    },
    {
      id: 'capacity', title: 'Provider slows down', intro: 'The SMS provider starts taking much longer per message. Pick how the system reacts, run it, and compare.',
      question: 'The SMS provider gets four times slower for 20 seconds. Which policy keeps waits bounded without losing what matters?',
      activity: {
        kind: 'queue', what: 'SMS messages waiting for a worker to send them',
        arrival: [100, 400, 800], workers: [2, 4, 8], serviceMs: 10,
        slow: { from: 20, to: 40, serviceMs: 40, what: 'the SMS provider answers four times slower' },
        timeoutS: 2,
        policies: [
          { id: 'wait', label: 'Keep waiting', detail: 'Messages queue up and workers keep sending at the provider’s pace.' },
          { id: 'retry', label: 'Retry on timeout', detail: 'A message that waits too long is sent again, and the old copy stays in the queue.' },
          { id: 'shed', label: 'Shed the oldest low-priority', detail: 'Messages that cannot start within the limit are dropped or deferred so the rest stay fresh.' },
          { id: 'breaker', label: 'Circuit breaker', detail: 'Stop calling the slow provider for a while; fail fast or use a fallback.' },
        ],
      },
      help: {
        hint: 'Workers can finish 400 a second when the provider is quick. How many can they finish when each call takes four times longer, and where do the other 300 a second go?',
        walkthrough: [
          { text: 'Normal: 4 workers at 10 ms each finish about 400 a second, which matches the arrivals.', focus: ['worker'] },
          { text: 'Slow: at 40 ms each they finish about 100 a second, so 300 a second pile up in the queue.', focus: ['queue', 'provider'] },
          { text: 'Waiting forever grows the delay without limit. Retrying adds copies of messages that are still waiting.', focus: ['queue'] },
          { text: 'Shedding low-priority messages or opening a breaker keeps the wait bounded; tickets stay on their own queue.', focus: ['queue', 'dlq'] },
        ],
        solution: [{ type: 'list', items: ['Keep critical and marketing on separate queues so marketing can be shed or paused.', 'Use a circuit breaker per provider so workers stop piling onto a slow one.', 'Retry with backoff and a cap, then dead-letter. Never retry in a tight loop.', 'Critical messages wait longer rather than being dropped; marketing is deferred or dropped.'] }],
        why: 'Capacity falls when the provider slows, so something must give: either waits grow without limit, or the system chooses what to delay. Choosing deliberately protects tickets.',
      },
      lessons: ['backpressure', 'retries', 'timeouts'],
    },
    {
      id: 'outage', title: 'A part goes offline', intro: 'The interviewer changes one condition. Predict, run it on your design, then revise.',
      question: 'A worker crashes right after the provider accepted a message, or the provider goes offline. What does the sender see, and what happens to the message?',
      change: { announce: 'New condition: the email provider is unreachable for ten minutes just as thousands of tickets are confirmed.', rule: RULES.trace, alternate: { announce: 'New condition: a channel worker crashes after the provider accepted a message but before it wrote the result to the log.', label: 'Replay with the worker down' } },
      activity: {
        kind: 'trace', request: 'a “booking confirmed” request from Booking service to the email provider', from: ['producer'], to: ['provider'], failCandidates: ['provider', 'worker', 'notify'],
        predict: { q: 'While that part is down, what does the Booking service see?', choices: [{ id: 'error', label: 'An error or a timeout' }, { id: 'delayed', label: 'An accepted request; the delivery happens later' }, { id: 'ok', label: 'Nothing changes' }] },
      },
      help: {
        hint: 'Is the booking team still waiting on that part, or did the queue already accept the message?',
        walkthrough: [
          { text: 'Notify API accepts the message and puts it on the queue before any provider is called.', focus: ['notify', 'queue'] },
          { text: 'If the provider is down, the message waits in the queue and the worker retries with backoff.', focus: ['queue', 'worker', 'provider'] },
          { text: 'If a worker crashes after sending, the queue redelivers the message. The idempotency key and the log stop a second send.', focus: ['worker', 'log'] },
          { text: 'If Notify API itself is down, the booking team does see an error: it is on the synchronous path.', focus: ['producer', 'notify'] },
        ],
        solution: [{ type: 'list', items: ['Provider offline: messages wait in the queue; the booking team sees an accepted request.', 'Worker crash: the queue redelivers; the worker checks the delivery log and the idempotency key before sending.', 'Notify API offline: the sender gets an error and retries with the same key. Run it as several copies.'] }],
        why: 'A critical message is never lost only if acceptance is durable before delivery is attempted, and a redelivered message cannot be sent twice.',
      },
      lessons: ['idempotency', 'failover'],
    },
  ],
  rules: [
    // Design stage
    { id: 'queue-boundary', stage: 'design', when: { all: [{ link: [{ type: 'notify' }, 'queue'] }, { link: ['queue', 'worker'] }] }, ack: '{type:notify} hands the message to {kind:queue} and a worker picks it up later. The sender does not wait for the provider.', strength: 'You put {kind:queue} between acceptance and delivery, so the sender never waits on a provider.' },
    { id: 'no-queue', stage: 'design', when: { lacks: 'queue' }, coach: 'Who waits while the provider takes its time? Add a queue between accepting a message and delivering it.', gap: { text: 'Delivery happened on the sender’s path, with no queue to absorb slow providers.', fix: 'Put a queue between Notify API and the workers, and let the sender return once the message is accepted.', stage: 'design', lesson: 'queues' }, priority: 4 },
    { id: 'direct-provider', stage: 'design', when: { link: [{ type: ['producer', 'notify'] }, { type: 'provider' }] }, priority: 9, ask: { text: '{type:producer} or {type:notify} calls {type:provider} directly. If the provider takes ten seconds, who is waiting?', choices: [
      { id: 'queue', label: 'Nobody should; put a queue and worker between them', reply: 'Yes. The sender returns once the message is accepted, and a worker deals with the slow provider.', verdict: 'sound' },
      { id: 'timeout', label: 'The sender, with a short timeout and one retry', reply: 'A timeout limits the pain but the message is still lost if both tries fail. A queue keeps it until a provider is back.', verdict: 'partial' },
      { id: 'fine', label: 'Providers are fast enough', reply: 'Until they are not. At 20,000 a second a slow provider ties up every sender thread.', verdict: 'risky' },
    ] }, gap: { text: 'The sender called the provider directly and would wait on every slow call.', fix: 'Route messages through a queue and a worker so the provider is never on the sender’s path.', stage: 'design', lesson: 'queues' } },
    { id: 'prefs-link', stage: 'design', when: { link: [{ type: 'notify' }, { type: 'prefs' }] }, ack: '{type:notify} checks {type:prefs} before queueing, so opted-out users never reach a worker.', strength: 'You checked preferences before queueing, so opt-outs are respected up front.' },
    { id: 'no-prefs', stage: 'design', when: { all: [{ has: 'queue' }, { lacks: { type: 'prefs' } }] }, coach: 'Marketing messages must respect opt-outs. Where do preferences live, and who checks them?', priority: 2 },
    { id: 'connect-path', stage: 'design', when: { all: [{ has: { type: 'provider' } }, { not: { path: [{ type: 'producer' }, { type: 'provider' }] } }] }, coach: 'Connect the path: Booking service → Notify API → queue → worker → provider. Select a part, then “Connect to…”.', priority: 3 },
    { id: 'trace-now', stage: 'design', when: { all: [{ path: [{ type: 'producer' }, { type: 'provider' }] }, { not: { result: 'trace:send', is: ['ok', 'hit'] } }] }, coach: 'Press “Trace a request” to watch one ticket email travel through your design.', priority: 1 },
    { id: 'log-link', stage: 'design', when: { link: [{ type: 'worker' }, { type: 'log' }], labels: ['writes to', 'reads and writes'] }, ack: '{type:worker} records each attempt in {type:log}, so support can see what happened.', ask: { text: 'Your worker calls the provider and writes to {type:log}. The diagram shows two arrows, not their order. If the worker crashes between them, what stops a second email?', choices: [
      { id: 'key', label: 'An idempotency key on the send, and the worker checks the log first', reply: 'Yes. The redelivered message finds “sent” in the log, or the provider recognises the key.', verdict: 'sound' },
      { id: 'log-first', label: 'Write “sent” to the log before calling the provider', reply: 'That avoids a duplicate but can lose the message: if the call fails after the write, the log says sent and nothing was. Better to record “sending” and confirm.', verdict: 'partial' },
      { id: 'rare', label: 'Crashes are rare, so ignore it', reply: 'At 50 million a day, a rare crash still happens every day. Plan for it.', verdict: 'risky' },
    ] }, strength: 'You recorded every delivery attempt in {type:log}, which is what support and safe retries both rely on.' },
    { id: 'no-log', stage: 'design', when: { all: [{ has: 'queue' }, { lacks: { type: 'log' } }] }, priority: 5, gap: { text: 'Nothing recorded what happened to each message.', fix: 'Add a delivery log written by the worker, with one row per message and channel.', stage: 'design', lesson: 'idempotency' } },
    { id: 'one-queue', stage: 'design', when: { all: [{ count: 'queue', max: 1 }, { answer: 'assume:priority', is: 'split' }] }, priority: 6, ask: { text: 'You said critical and marketing messages should be separate, but there is one {kind:queue} in your design. What does that give up?', choices: [
      { id: 'two', label: 'Add a queue per priority, so a marketing burst cannot sit in front of a ticket', reply: 'Right. The two lines can then be scaled and slowed independently.', verdict: 'sound' },
      { id: 'one-ok', label: 'One queue with priority tags is enough', reply: 'That is a valid alternative if the queue serves higher priorities first. The risk is a flood of low-priority work still filling it up, so cap it.', verdict: 'partial' },
      { id: 'same', label: 'Nothing; they can share', reply: 'A marketing burst of 2 million messages in front of a ticket is exactly the case to avoid.', verdict: 'risky' },
    ] } },
    { id: 'stream-alt', stage: 'design', when: { link: [{ type: 'notify' }, 'stream'] }, priority: 7, ack: 'You chose an event log instead of a queue. That is a valid alternative.', ask: { text: 'An event log keeps every message and lets many consumers read it. For this job, what do you give up compared with a queue?', choices: [
      { id: 'retry', label: 'Per-message retry and dead-lettering are more work to build', reply: 'Right. A log suits replay and several consumers; a queue gives you retries and dead-lettering for free.', verdict: 'sound' },
      { id: 'nothing', label: 'Nothing, it does the same', reply: 'It stores more, but one failing message can block a partition unless you build retry handling yourself.', verdict: 'partial' },
    ] } },
    // Capacity stage
    { id: 'wait-grows', stage: 'capacity', when: { result: 'capacity', is: 'wait:unbounded' }, priority: 6, ask: { text: 'With “keep waiting”, the delay kept growing while the provider was slow. Who gets the worst of it?', choices: [
      { id: 'all', label: 'Everyone, tickets included, because they share the line', reply: 'Yes. That is why critical messages need their own queue.', verdict: 'sound' },
      { id: 'marketing', label: 'Only marketing', reply: 'Only if marketing has its own queue. In one shared line, tickets wait behind it.', verdict: 'partial' },
    ] }, gap: { text: 'Waiting with no limit let the delay grow while the provider was slow.', fix: 'Bound the wait: split priorities, shed or defer low-priority messages, and use a circuit breaker.', stage: 'capacity', lesson: 'backpressure' } },
    { id: 'retry-storm', stage: 'capacity', when: { result: 'capacity', is: 'retry:unbounded' }, priority: 7, ask: { text: 'Retrying made it worse: the old copies stayed in the queue and new ones joined. What makes retries safe?', choices: [
      { id: 'backoff', label: 'Backoff with jitter, a retry cap, and a breaker so retries stop when the provider is down', reply: 'Yes. Retries help with brief faults and hurt with long ones, so they need limits.', verdict: 'sound' },
      { id: 'more', label: 'Retry faster', reply: 'Faster retries multiply the load on a provider that is already struggling.', verdict: 'risky' },
    ] }, gap: { text: 'Immediate retries added load to a slow provider and grew the queue.', fix: 'Retry with backoff and jitter, cap the attempts, then dead-letter.', stage: 'capacity', lesson: 'retries' } },
    { id: 'bounded-ok', stage: 'capacity', when: { result: 'capacity', is: ['shed:bounded', 'breaker:bounded'] }, ack: 'Your policy kept the longest wait within the limit.', ask: { text: 'That policy kept waits short by refusing or deferring some messages. Which ones should it be?', choices: [
      { id: 'low', label: 'Marketing first; tickets wait on their own queue and are never dropped', reply: 'Yes. Decide what to give up in advance, not while the queue is burning.', verdict: 'sound' },
      { id: 'oldest', label: 'Whatever is oldest', reply: 'Oldest-first may drop a ticket that has waited longest. Use priority first, age second.', verdict: 'partial' },
      { id: 'random', label: 'Whatever arrives next', reply: 'That drops tickets as readily as promos. Choose by priority.', verdict: 'risky' },
    ] }, strength: 'You bounded the delay when the provider slowed, and chose which messages could wait or be dropped.' },
    { id: 'breaker-alt', stage: 'capacity', when: { result: 'capacity', is: 'breaker:bounded' }, priority: 4, ask: { text: 'The breaker stopped calls to the slow provider. A breaker alone fails fast. What should happen to the messages it turns away?', choices: [
      { id: 'park', label: 'Keep them in the queue (or a retry queue) and try again when the breaker closes', reply: 'Yes. Critical messages are held, not dropped.', verdict: 'sound' },
      { id: 'second', label: 'Send critical ones through a second provider', reply: 'A good option for tickets, if you have a second contract. One provider cannot recognise another’s idempotency key, so your own delivery log must still stop a message going out twice.', verdict: 'sound' },
      { id: 'drop', label: 'Drop them', reply: 'Fine for a promo; for a ticket, that is a lost message.', verdict: 'risky' },
    ] } },
    // Outage stage
    { id: 'outage-delayed', stage: 'outage', when: { result: 'outage', is: 'delayed' }, ack: 'In your design the sender got an accepted request and the message waited in {kind:queue}.', strength: 'Your design keeps a downed provider or worker off the sender’s path: the message waits, the sender moves on.' },
    { id: 'outage-error', stage: 'outage', when: { result: 'outage', is: 'error' }, priority: 6, ask: { text: 'In your design the sender sees an error when that part goes down. Which part should the sender be waiting on at most?', choices: [
      { id: 'accept', label: 'Only the part that accepts and stores the message durably', reply: 'Yes. Once the message is safely in the queue, delivery can wait.', verdict: 'sound' },
      { id: 'provider', label: 'The provider, so the sender knows it was delivered', reply: 'Then every provider hiccup becomes a booking outage. Let the delivery log report the result later.', verdict: 'risky' },
    ] }, gap: { text: 'A part on the synchronous path took the sender down with it.', fix: 'Accept into a queue first; deliver and retry from workers.', stage: 'outage', lesson: 'failover' } },
    { id: 'outage-broken', stage: 'outage', when: { result: 'outage', is: 'broken' }, coach: 'There is no chain of arrows from Booking service to the provider yet. Add the arrows, then run it again.', priority: 4 },
    { id: 'outage-crash', stage: 'outage', when: { has: { type: 'worker' } }, priority: 5, ask: { text: 'The diagram shows a worker between the queue and the provider. It does not show what happens to a message a worker was holding when it crashed. What does?', choices: [
      { id: 'ack-after', label: 'The worker acknowledges the message only after it has recorded the send; unacknowledged messages are redelivered', reply: 'Yes. That is at-least-once delivery. Pair it with the idempotency key and a duplicate is harmless.', verdict: 'sound' },
      { id: 'ack-before', label: 'The worker acknowledges first, then sends', reply: 'A crash after the acknowledgement loses the message. That is at-most-once, which the brief rules out for tickets.', verdict: 'risky' },
      { id: 'retry-sender', label: 'The sender notices and sends it again', reply: 'The sender already moved on. Handle it inside the pipeline.', verdict: 'partial' },
    ] } },
    { id: 'key-answer', when: { answer: 'outage-crash', is: 'ack-after' }, strength: 'You acknowledged messages only after recording them, so a crash redelivers instead of losing.' },
  ],
  solution: {
    design: g([
      ['producer', 'producer', 'service', 'Booking service', 30, 220], ['notify', 'notify', 'service', 'Notify API', 180, 220], ['prefs', 'prefs', 'db', 'Preferences store', 180, 70],
      ['queue', 'queue', 'queue', 'Message queue', 340, 220], ['worker', 'worker', 'worker', 'Channel worker', 490, 220], ['provider', 'provider', 'ext', 'Email / SMS provider', 490, 70],
      ['log', 'log', 'db', 'Delivery log', 490, 370], ['dlq', 'dlq', 'queue', 'Dead-letter queue', 340, 370],
    ], [
      ['producer', 'notify', 'sends request'], ['notify', 'prefs', 'reads from'], ['notify', 'queue', 'publishes event'], ['queue', 'worker', 'delivers to'],
      ['worker', 'provider', 'calls'], ['worker', 'log', 'writes to'], ['worker', 'dlq', 'publishes event'],
    ]),
    why: {
      producer: 'The team that needs a customer told something. It waits only for acceptance.',
      notify: 'The front door: validates, checks preferences, assigns an idempotency key, enqueues.',
      prefs: 'Holds opt-outs and channels, so a marketing message never reaches a worker for an opted-out user.',
      queue: 'Durable boundary: accepted messages wait here through provider slowness or worker crashes. Split by channel and priority.',
      worker: 'Renders, rate-limits calls to the provider, retries with backoff, and records the result.',
      provider: 'External and unreliable: called with a timeout, an idempotency key and a circuit breaker.',
      log: 'One row per message and channel; lets support answer questions and lets a retry skip what was already sent.',
      dlq: 'Catches messages that failed too many times so they are inspected, not lost.',
    },
    alternatives: { queue: { types: ['queue'], tradeoff: 'An event log (replayable, several consumers) also works, but retry and dead-lettering per message become your job.' } },
    trace: { title: 'A ticket email, from confirmation to inbox', steps: [
      { from: 'producer', to: 'notify', text: 'POST /notify {user, template: ticket-ready, priority: critical} with Idempotency-Key ticket-881.' },
      { from: 'notify', to: 'prefs', text: 'The user allows email for tickets, so the message goes ahead.' },
      { from: 'notify', to: 'queue', text: 'Enqueue on the critical email queue and return 202. The booking team is done.' },
      { from: 'queue', to: 'worker', text: 'A worker takes the message. It stays invisible to others until acknowledged.' },
      { from: 'worker', to: 'provider', text: 'Send with the idempotency key and a timeout. Backoff with jitter on transient errors.' },
      { from: 'worker', to: 'log', text: 'Record “sent”, then acknowledge the message. After the attempt cap it goes to the dead-letter queue.' },
    ] },
    tradeoff: 'Accepting into a queue first means the sender is fast and no accepted message is lost, but delivery is no longer instant and the system must keep retries from sending twice.',
    otherApproach: 'For one channel at low volume, a single queue and one worker pool is simpler. Add a second provider and per-priority queues when tickets and promos start competing.',
  },
};
