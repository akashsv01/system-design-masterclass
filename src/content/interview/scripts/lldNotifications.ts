import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';
import { py } from '../../lessons/_kit';

const st = (states: [string, string, number, number][], trans: [string, string, string][]) => ({
  comps: states.map(([id, label, x, y]) => ({ id, type: id, kind: 'state' as const, label, x, y })),
  links: trans.map(([from, to, label]) => ({ id: `${from}-${to}-${label}`, from, to, label })),
});

export const lldNotifications: InterviewScript = {
  caseId: 'lld-notifications',
  track: 'lld',
  doLine: 'Assign jobs to a Notifier and its channels, keep a queue healthy when one provider slows, then draw a message’s retry states',
  skills: ['object-design', 'reliability', 'state-machines'],
  brief: {
    interviewer: { name: 'Dana', role: 'engineer who owns the notification sender' },
    intro: 'The notification service is already designed. I want the code that actually sends: one notification, several channels, and providers that fail. Think in objects and states.',
    users: 'Other services that call notify(): ticketing, payments, account security. They need “tell this user” to work without caring how.',
    needs: ['Send a notification to each channel the user prefers (email, push, SMS)', 'Carry on with the other channels when one fails', 'Retry failed sends a few times, then give up'],
    mustHold: ['A retried notification never sends twice on a channel that already succeeded', 'One slow provider never delays the other channels', 'Every message ends as sent or failed; none is lost silently'],
    constraints: ['About 80 messages per second at peak', 'Each channel call takes about 40 ms; SMS can slow to 400 ms', 'At most 4 attempts per channel, with a delay between them'],
    outOfScope: ['Writing the message text', 'Quiet hours and unsubscribe rules'],
    terms: [
      { term: 'strategy', meaning: 'one job (here, delivering) behind a shared method, so channels can be swapped or added' },
      { term: 'backoff', meaning: 'waiting longer, or at least a fixed time, before retrying so a struggling provider can recover' },
      { term: 'circuit breaker', meaning: 'stop calling a provider that keeps failing for a while and fail fast instead' },
    ],
    firstMove: 'A ticket-confirmation notification has to go out by email and by push. Tell me which object owns each job, then walk me through sending it.',
  },
  palette: [
    { type: 'notifier', kind: 'class', name: 'Notifier', blurb: 'Takes a notification and sends it through each of the user’s channels.' },
    { type: 'channel', kind: 'iface', name: 'Channel', blurb: 'One call, send(user, message), which raises if the provider fails. The tested code uses a plain function for each channel.' },
    { type: 'email', kind: 'class', name: 'EmailChannel', blurb: 'A Channel that talks to the email provider.' },
    { type: 'push', kind: 'class', name: 'PushChannel', blurb: 'A Channel that talks to the push provider.' },
    { type: 'prefs', kind: 'class', name: 'Preferences', blurb: 'Which channels each user wants.' },
    { type: 'log', kind: 'class', name: 'DeliveryLog', blurb: 'Records (notification id, user, channel) once a send succeeds.' },
    { type: 'retry', kind: 'class', name: 'RetryPolicy', blurb: 'Decides how many attempts and how long to wait between them.' },
    { type: 'status', kind: 'enum', name: 'MessageStatus', blurb: 'queued, sending, sent, retrying, failed.' },
  ],
  verbs: ['has', 'uses', 'implements', 'creates'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Pin down what “sent” means before drawing objects.',
      question: 'Which rules would you confirm before writing a single class?',
      activity: { kind: 'clarify', questions: [
        { id: 'partial', q: 'Email succeeds and SMS fails. Is the notification sent?', a: 'Partly. Track each channel on its own. Only the failed channel is retried.' },
        { id: 'dup', q: 'What if the same notification is submitted twice?', a: 'Each (notification id, user, channel) may succeed at most once. Duplicates are skipped.' },
        { id: 'limit', q: 'How many attempts before we give up?', a: 'Four attempts per channel. After that the message is failed and someone is told.' },
        { id: 'order', q: 'Do channels depend on each other?', a: 'No. A slow SMS provider must not hold up email or push.' },
        { id: 'peak', q: 'How busy is it?', a: 'About 80 messages per second at peak. A normal channel call takes about 40 ms.' },
      ], assumptions: [
        { id: 'wait', q: 'How long between retries?', options: [
          { id: 'fixed', label: 'A fixed two minutes', consequence: 'Simple to explain and test; a recovering provider can still get a burst of retries at once.' },
          { id: 'growing', label: 'Longer each time (2, 4, 8 minutes)', consequence: 'Gentler on a struggling provider; the policy needs the attempt number.' },
        ] },
      ] },
      help: {
        hint: 'What does the second delivery attempt need to know so it does not resend by email?',
        walkthrough: [{ text: 'Status is per channel, not per notification.' }, { text: 'A (notification, user, channel) key is recorded after a success.' }, { text: 'Four attempts, then failed.' }],
        solution: [{ type: 'list', items: ['Per-channel status; the others carry on when one fails.', 'Key (id, user, channel) written after a success and checked before a send.', 'At most four attempts; then failed.', 'One slow provider must not slow the rest.'] }],
        why: 'These rules are the invariants the objects must keep; everything else is naming.',
      },
      lessons: ['contracts-invariants', 'idempotency'],
    },
    {
      id: 'roles', title: 'Who does what', intro: 'Give each job to one object, then walk through sending a ticket by email and push.',
      question: 'Which object owns each job, and who stops a retry from emailing twice?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'notifier', name: 'Notifier', blurb: 'Coordinates one notification.' },
          { id: 'channel', name: 'Channel', blurb: 'Delivers through one provider.' },
          { id: 'prefs', name: 'Preferences', blurb: 'user → channels.' },
          { id: 'log', name: 'DeliveryLog', blurb: 'What has already been sent.' },
          { id: 'retry', name: 'RetryPolicy', blurb: 'Attempts and waits.' },
        ],
        cards: [
          { id: 'where', text: 'Know which channels Ana wants', owner: 'prefs', why: 'It is her stored choice; nobody else owns that data.' },
          { id: 'loop', text: 'Try each channel and keep one failure from blocking the rest', owner: 'notifier', why: 'Only the coordinator sees all channels for one notification.' },
          { id: 'deliver', text: 'Call the email provider and raise if it fails', owner: 'channel', why: 'Provider details stay behind one interface.' },
          { id: 'dedupe', text: 'Remember that email already succeeded for this notification', owner: 'log', alt: ['notifier'], why: 'The log is the record; the notifier may keep it in memory in a first version but it must be durable in production.' },
          { id: 'again', text: 'Decide whether a fourth failure means give up', owner: 'retry', why: 'Attempt limits and waits are one rule that changes on its own schedule.' },
          { id: 'order', text: 'Check the log before each send', owner: 'notifier', alt: ['channel'], why: 'The notifier asks the log. A channel that checks for itself would repeat the check in every channel.' },
        ],
        walk: { title: 'Send a ticket by email and push', steps: [
          { prompt: 'Who looks up the channels for Ana?', owner: 'prefs', call: 'prefs.channels_for("ana")  # ["email", "push"]' },
          { prompt: 'Who goes through them one at a time?', owner: 'notifier', call: 'notifier.notify("n-91", "ana", "Your ticket")' },
          { prompt: 'Who checks whether email was already sent for n-91?', owner: 'log', call: '("n-91", "ana", "email") in log' },
          { prompt: 'Who calls the provider?', owner: 'channel', call: 'email.send("ana", "Your ticket")' },
        ] },
      },
      help: {
        hint: 'Put each job where the data it needs lives. Who knows what has already been sent?',
        walkthrough: [
          { text: 'Preferences knows the channels; Notifier loops over them.', focus: ['notifier', 'prefs'] },
          { text: 'Each Channel hides one provider behind send().', focus: ['channel', 'email', 'push'] },
          { text: 'DeliveryLog holds the key that prevents a duplicate email.', focus: ['log'] },
        ],
        solution: [
          { type: 'code', lang: 'python', code: py('sdm/cases/notifier.py', 'notify'), caption: 'python/sdm/cases/notifier.py — tested with pytest' },
          { type: 'p', text: 'The loop catches each failure, so push still goes out when email fails. The `sent` set is what a retry checks first.' },
        ],
        why: 'Channels are interchangeable behind one method, and the duplicate-send rule lives in one place.',
      },
      lessons: ['responsibilities', 'pattern-strategy', 'dependency-injection'],
    },
    {
      id: 'slow', title: 'One provider slows', intro: 'Between the sender and the SMS provider sits a queue of messages. Watch what a slow provider does to it.',
      question: 'The SMS provider slows from 40 ms to 400 ms for twenty seconds. Which policy keeps waits bounded?',
      activity: {
        kind: 'queue', what: 'SMS messages waiting for the provider', arrival: [20, 80, 160], workers: [1, 4, 10], serviceMs: 40,
        slow: { from: 15, to: 35, serviceMs: 400, what: 'The SMS provider answers 10× slower' }, timeoutS: 2,
        policies: [
          { id: 'wait', label: 'Keep waiting', detail: 'Every message stays queued until the provider catches up.' },
          { id: 'retry', label: 'Time out and retry at once', detail: 'A message that waits too long is sent again, while the first copy is still queued.' },
          { id: 'shed', label: 'Refuse what cannot start in time', detail: 'Messages that would wait too long are rejected fast; the caller can reschedule them.' },
          { id: 'breaker', label: 'Circuit breaker', detail: 'While the provider is slow, stop calling it and fail fast with a fallback.' },
        ],
      },
      help: {
        hint: 'During the slow period workers can finish about 10 per second, but 80 arrive. Where do the other 70 go?',
        walkthrough: [{ text: '4 workers × (1000 ÷ 400 ms) = 10 messages per second while slow; 80 arrive.' }, { text: 'Waiting makes the queue longer every second. Retrying adds more copies and makes it worse.' }, { text: 'Shedding or a breaker keeps the wait short by refusing work early.' }],
        solution: [{ type: 'p', text: 'Shed or break. Queued work for the slow channel is bounded, other channels are untouched, and the refused messages go back to the retry timer instead of waiting in a line they cannot clear.' }],
        why: 'Waiting forever turns a slow provider into a slow sender; fast refusal keeps the damage to one channel.',
      },
      lessons: ['backpressure', 'timeouts', 'retries'],
    },
    {
      id: 'states', title: 'Message states', intro: 'The interviewer changes one condition. Draw the states a message moves through, then run the clock.',
      question: 'Draw a message’s states and the events between them. The provider fails twice before it works: what does your machine do?',
      change: { announce: 'New condition: the push provider returns errors for a few minutes. A message must retry after a wait, not be dropped and not hammer the provider.', rule: RULES.states, alternate: { announce: 'Second twist: after the fourth failed attempt the message must stop retrying and be marked failed.', label: 'Add a give-up arrow' } },
      activity: {
        kind: 'states', entity: 'Message n-91 by push', initial: 'queued',
        states: [
          { key: 'queued', label: 'Queued', blurb: 'Waiting for a worker.' },
          { key: 'sending', label: 'Sending', blurb: 'A worker is calling the provider.' },
          { key: 'sent', label: 'Sent', blurb: 'The provider accepted it. Final.' },
          { key: 'retrying', label: 'Retrying', blurb: 'Failed; waiting out the backoff.' },
          { key: 'failed', label: 'Failed', blurb: 'Out of attempts. Final.' },
        ],
        events: [{ id: 'pick', label: 'pick up' }, { id: 'ok', label: 'provider ok' }, { id: 'error', label: 'provider error' }, { id: 'backoff', label: 'backoff over (2 min)' }, { id: 'give-up', label: 'give up' }],
        timer: { event: 'backoff', after: 2 },
        scenario: [
          { at: 0, event: 'pick', label: '10:00 a worker picks up n-91', expect: 'sending' },
          { at: 1, event: 'error', label: '10:01 the provider errors', expect: 'retrying' },
          { at: 4, event: 'error', label: '10:04 it errors again after the retry', expect: 'retrying' },
          { at: 7, event: 'ok', label: '10:07 the provider accepts it', expect: 'sent' },
        ],
        starter: st([['queued', 'Queued', 80, 220], ['sending', 'Sending', 270, 220]], [['queued', 'sending', 'pick']]),
      },
      help: {
        hint: 'After an error the message is not sending and not finished. What state holds it, and what event brings it back?',
        walkthrough: [
          { text: 'Queued → Sending when a worker picks it up.' },
          { text: 'Sending → Retrying on “provider error”.' },
          { text: 'Retrying → Sending on “backoff over”: a timed arrow that fires two minutes later.' },
          { text: 'Sending → Sent on “ok”; Retrying → Failed on “give up” after four attempts.' },
        ],
        solution: [
          { type: 'table', head: ['From', 'Event', 'To'], rows: [['Queued', 'pick up', 'Sending'], ['Sending', 'provider ok', 'Sent'], ['Sending', 'provider error', 'Retrying'], ['Retrying', 'backoff over', 'Sending'], ['Retrying', 'give up', 'Failed']] },
          { type: 'p', text: 'The attempt count is a counter on the message; the “give up” arrow is taken when the counter reaches four.' },
        ],
        why: 'The brief says retry a few times with a wait, then fail. That only exists in the design if arrows and a timer make it so.',
      },
      lessons: ['state-machines', 'pattern-state', 'retries'],
    },
  ],
  rules: [
    { id: 'roles-good', stage: 'roles', when: { result: 'roles', is: 'pass' }, ack: 'Each job sits with the object that owns its data.', strength: 'You gave each job to the object that owns its data: Preferences chooses channels, Notifier coordinates, Channel delivers, DeliveryLog remembers.' },
    { id: 'roles-gap', stage: 'roles', when: { result: 'roles', is: 'gaps' }, gap: { text: 'Some notification jobs sit with objects that lack the data for them.', fix: 'Reassign the cards marked “reconsider” and replay the walk.', stage: 'roles', lesson: 'responsibilities' } },
    { id: 'partial-ask', stage: 'roles', when: { result: 'roles', is: ['pass', 'gaps'] }, priority: 5, ask: { text: 'Email succeeded and push failed. The caller retries the whole notification. What stops a second email?', choices: [
      { id: 'key', label: 'A log keyed by (notification id, user, channel), checked before each send', reply: 'Yes. Retry only the failed channel; the key makes the retry safe to repeat.', verdict: 'sound' },
      { id: 'caller', label: 'The caller must only retry failed channels', reply: 'Callers get this wrong. The sender should keep the promise itself.', verdict: 'risky' },
      { id: 'provider', label: 'Ask the email provider to ignore duplicates', reply: 'A few providers offer this, but not all, and not for every channel. It helps; it should not be the only guard.', verdict: 'partial' },
    ] }, gap: { text: 'A retry could send the same notification twice on one channel.', fix: 'Record a key per (id, user, channel) after each success and check it before each send.', stage: 'roles', lesson: 'idempotency' } },
    { id: 'key-strength', when: { answer: 'partial-ask', is: 'key' }, strength: 'You made retries safe with a per-channel delivery key instead of trusting callers.' },
    { id: 'slow-bounded', stage: 'slow', when: { result: 'slow', is: ['shed:bounded', 'breaker:bounded'] }, ack: 'Waits stayed short, so email and push never noticed the slow SMS provider.', strength: 'You kept the queue bounded when one provider slowed, by refusing work early rather than waiting.' },
    { id: 'slow-wait', stage: 'slow', when: { result: 'slow', is: 'wait:unbounded' }, priority: 5, ask: { text: 'The queue just grew for twenty seconds and kept a long tail afterward. What would you change?', choices: [
      { id: 'shed', label: 'Refuse messages that cannot start in time and reschedule them', reply: 'Yes. A fast “try later” beats a slow failure. Try the shed policy.', verdict: 'sound' },
      { id: 'workers', label: 'Add workers', reply: 'Workers only help if the provider can take more calls. If it is the slow part, more workers just add load to it.', verdict: 'partial' },
      { id: 'bigger', label: 'Make the queue bigger', reply: 'A bigger queue only holds a longer delay.', verdict: 'risky' },
    ] }, gap: { text: 'A slow SMS provider built an unbounded queue.', fix: 'Shed or break when waits exceed the timeout, and put refused messages on the retry timer.', stage: 'slow', lesson: 'backpressure' } },
    { id: 'slow-retry', stage: 'slow', when: { result: 'slow', is: 'retry:unbounded' }, priority: 5, ask: { text: 'Retrying immediately made the queue worse. Why?', choices: [
      { id: 'copies', label: 'Each retry adds a copy while the original is still queued', reply: 'Yes: load grows exactly when the provider is weakest. Retry later, with a wait, and only if it is safe.', verdict: 'sound' },
      { id: 'timeout', label: 'The timeout was too short', reply: 'A longer timeout hides it for a while. The cause is more work arriving than the provider can finish.', verdict: 'partial' },
    ] }, gap: { text: 'Immediate retries piled extra copies on a slow provider.', fix: 'Retry after a backoff, and shed or break while the provider is slow.', stage: 'slow', lesson: 'retries' } },
    { id: 'slow-breaker', stage: 'slow', when: { result: 'slow', is: 'breaker:bounded' }, priority: 4, ask: { text: 'The breaker refused every SMS during the slow period, even the ones the provider could have handled. What do those messages do?', choices: [
      { id: 'park', label: 'Go to the retry timer and are sent after the breaker closes', reply: 'Yes. A breaker is only half a design; the refused work needs somewhere to wait.', verdict: 'sound' },
      { id: 'drop', label: 'They are dropped', reply: 'Then “none is lost silently” breaks.', verdict: 'risky' },
    ] } },
    { id: 'states-pass', stage: 'states', when: { result: 'states', is: 'pass' }, ack: 'Your machine retried after the wait and finished as sent.', strength: 'You drew a retrying state with a timed way back to sending, so a failed message waits instead of being lost or hammering the provider.' },
    { id: 'states-stuck', stage: 'states', when: { result: 'states', is: ['stuck', 'fail'] }, priority: 6, ask: { text: 'At 10:01 the provider erred and your machine had no arrow for it, or none back to sending. What should have happened?', choices: [
      { id: 'retrying', label: 'Sending → Retrying on error, then Retrying → Sending after the backoff', reply: 'Yes. Draw both and run the clock again.', verdict: 'sound' },
      { id: 'queued', label: 'Sending → Queued on error', reply: 'It works if the queue adds a delay, but then the queue must hold “not before” times. A distinct state shows the wait.', verdict: 'partial' },
      { id: 'failed', label: 'Sending → Failed on the first error', reply: 'Then one blip loses the message. The brief allows four attempts.', verdict: 'risky' },
    ] }, gap: { text: 'A failed send had nowhere to wait and come back from.', fix: 'Add Sending → Retrying on error and Retrying → Sending on the timed backoff.', stage: 'states', lesson: 'state-machines' } },
    { id: 'giveup', stage: 'states', when: { all: [{ result: 'states', is: 'pass' }, { lacks: { kind: 'state', name: 'failed' } }] }, priority: 4, ask: { text: 'Your machine retries forever if the provider never recovers. How do you make it stop?', choices: [
      { id: 'counter', label: 'Count attempts and take Retrying → Failed after four', reply: 'Yes. The diagram cannot show the counter; it lives in the message and must be tested.', verdict: 'sound' },
      { id: 'ttl', label: 'Give each message an expiry time', reply: 'Also valid, and it matches how users feel about stale notifications. Pick one and test it.', verdict: 'sound' },
      { id: 'none', label: 'It will recover eventually', reply: 'Sometimes it does not. A message that retries forever is lost without anyone knowing.', verdict: 'risky' },
    ] }, gap: { text: 'Messages could retry forever.', fix: 'Add a Failed state reached by “give up” after four attempts or an expiry.', stage: 'states', lesson: 'state-machines' } },
  ],
  solution: {
    design: {
      comps: [
        { id: 'prefs', type: 'prefs', kind: 'class', label: 'Preferences', x: 60, y: 90 },
        { id: 'notifier', type: 'notifier', kind: 'class', label: 'Notifier', x: 60, y: 230 },
        { id: 'log', type: 'log', kind: 'class', label: 'DeliveryLog', x: 60, y: 370 },
        { id: 'channel', type: 'channel', kind: 'iface', label: 'Channel', x: 290, y: 230 },
        { id: 'email', type: 'email', kind: 'class', label: 'EmailChannel', x: 500, y: 130 },
        { id: 'push', type: 'push', kind: 'class', label: 'PushChannel', x: 500, y: 300 },
        { id: 'retry', type: 'retry', kind: 'class', label: 'RetryPolicy', x: 290, y: 380 },
        { id: 'status', type: 'status', kind: 'enum', label: 'MessageStatus', x: 290, y: 80 },
      ],
      links: [
        { id: 'n-p', from: 'notifier', to: 'prefs', label: 'uses' }, { id: 'n-l', from: 'notifier', to: 'log', label: 'uses' }, { id: 'n-c', from: 'notifier', to: 'channel', label: 'uses' },
        { id: 'e-c', from: 'email', to: 'channel', label: 'implements' }, { id: 'p-c', from: 'push', to: 'channel', label: 'implements' },
        { id: 'n-r', from: 'notifier', to: 'retry', label: 'uses' }, { id: 'n-s', from: 'notifier', to: 'status', label: 'uses' },
      ],
    },
    why: {
      prefs: 'Owns each user’s channel choices; nothing else decides where to send.',
      notifier: 'Coordinates one notification: loops over channels, catches each failure, consults the log and the retry policy.',
      log: 'The record that makes retries safe: (notification id, user, channel) after a success.',
      channel: 'One method, send(user, message). New channels are new classes.',
      email: 'Talks to the email provider and raises on failure.',
      push: 'Talks to the push provider; its slowness is isolated here.',
      retry: 'Attempts and waits in one place, so changing backoff touches nothing else.',
      status: 'The fixed set of message states: queued, sending, sent, retrying, failed.',
    },
    alternatives: { log: { types: ['notifier'], tradeoff: 'Keeping a sent set inside Notifier is fine for a first version and tests, but it is lost on restart. A durable log is what survives retries.' } },
    trace: { title: 'Send a ticket by email and push', steps: [
      { from: 'notifier', to: 'prefs', text: 'channels_for("ana") returns ["email", "push"].' },
      { from: 'notifier', to: 'log', text: 'Is ("n-91", "ana", "email") already recorded? No.' },
      { from: 'notifier', to: 'email', text: 'send() succeeds; the key is recorded.' },
      { from: 'notifier', to: 'push', text: 'send() fails; status becomes retrying.' },
      { from: 'notifier', to: 'retry', text: 'Wait two minutes, then retry push only; email is skipped by the log.' },
    ] },
    tradeoff: 'Channels behind one interface keep each provider’s failure contained, but the sender now needs per-channel state and a durable log to be safe to retry.',
    otherApproach: 'At higher volume, publish one job per channel to its own queue so each provider scales and fails on its own; the Notifier then only fans out.',
  },
};
