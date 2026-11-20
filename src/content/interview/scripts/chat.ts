import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const chat: InterviewScript = {
  caseId: 'case-chat',
  track: 'hld',
  doLine: 'Send a message to a friend, key messages by conversation and sequence, then see what happens when the friend’s phone is unreachable',
  skills: ['messaging', 'data-modeling', 'reliability', 'architecture'],
  brief: {
    interviewer: { name: 'Dana', role: 'engineer on the messaging team' },
    intro: 'We are building a chat app. People expect a message to show up on a friend’s phone almost at once, in the right order, and to still be there years later.',
    users: 'People chatting in one-to-one conversations and in groups of up to 500, on one or several devices each.',
    needs: ['Send a message to a friend or a group', 'See new messages within half a second when both people are online', 'Scroll back through the whole history of a conversation', 'Get a notification when the app is closed'],
    mustHold: ['Everyone in a conversation sees messages in the same order', 'A message that was acknowledged is never lost', 'A resend after a flaky connection never shows up twice'],
    constraints: ['50 million daily users, about 40 messages each a day: roughly 23,000 messages a second on average', 'Online delivery under 500 ms', 'History is kept forever, about 400 GB a day', 'Groups of up to 500 members'],
    outOfScope: ['Voice and video calls', 'Read receipts and typing indicators', 'End-to-end encryption'],
    terms: [
      { term: 'sequence number', meaning: 'a counter per conversation: message 1, 2, 3 … It gives one agreed order, which phone clocks cannot' },
      { term: 'presence', meaning: 'knowing whether a user is connected right now and through which server' },
      { term: 'push notification', meaning: 'a message sent through Apple or Google that wakes a closed app' },
      { term: 'idempotent', meaning: 'safe to repeat: doing it twice has the same effect as doing it once' },
    ],
    firstMove: 'Maya sends “running late” to her friend Leo. Place the parts the message travels through, from Maya’s phone until it is stored and on its way to Leo, then trace it.',
  },
  palette: [
    { type: 'phone', kind: 'client', name: 'Chat app', blurb: 'The phone app. It keeps a connection open, sends messages and shows them in order.' },
    { type: 'gateway', kind: 'gateway', name: 'Connection gateway', blurb: 'Holds the open connections of many phones and passes their messages inwards.' },
    { type: 'chat', kind: 'service', name: 'Chat service', blurb: 'Your code: gives each message the next sequence number, stores it, and decides how to deliver it.' },
    { type: 'msgdb', kind: 'db', name: 'Message store', blurb: 'A database of every message, split across many machines by a key you choose.' },
    { type: 'presence', kind: 'cache', name: 'Presence store', blurb: 'A fast table of which gateway each online user is connected to. It can be slightly out of date.' },
    { type: 'outbox', kind: 'queue', name: 'Delivery queue', blurb: 'Holds “deliver this message to this user” jobs until a worker takes them.' },
    { type: 'deliver', kind: 'worker', name: 'Delivery worker', blurb: 'Takes a delivery job and pushes it over the open connection, or to a notification if the user is away.' },
    { type: 'push', kind: 'ext', name: 'Mobile push', blurb: 'Apple’s and Google’s notification services. Outside your control; sometimes slow or down.' },
  ],
  verbs: ['sends request', 'reads from', 'writes to', 'reads and writes', 'publishes event', 'delivers to', 'calls'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'groups', q: 'How big can a conversation get?', a: 'One-to-one chats and groups of up to 500 people. Bigger broadcast channels are a later project.' },
          { id: 'order', q: 'Does order matter?', a: 'Yes, inside one conversation. Everyone must see the same order. Across different conversations it does not matter.' },
          { id: 'volume', q: 'How many messages?', a: 'About 50 million people a day send around 40 messages each: roughly 23,000 a second on average, with an evening peak.' },
          { id: 'history', q: 'How long do we keep messages?', a: 'Forever. About 400 GB of new messages every day.' },
          { id: 'devices', q: 'Can one person use several devices?', a: 'Yes. A phone and a laptop must both get every message and show the same history.' },
          { id: 'offline', q: 'What if the friend is offline?', a: 'The message must wait and arrive when they return. If the app is closed, send a push notification.' },
        ],
        assumptions: [
          { id: 'order', q: 'How do you decide the order of messages in a conversation?', options: [
            { id: 'seq', label: 'The server gives each message the next number in its conversation', consequence: 'One place per conversation hands out numbers, so every device agrees. Messages for one conversation must reach the same owner.' },
            { id: 'clock', label: 'Sort by the time on the sender’s phone', consequence: 'Phone clocks drift by seconds or minutes, so two people can see different orders or a reply before its question.' },
          ] },
          { id: 'resend', q: 'The app loses signal before the “sent” acknowledgement arrives. It resends. What stops a duplicate?', options: [
            { id: 'client-id', label: 'The app puts an id on every message; the server ignores one it has seen', consequence: 'Resends are safe, but the server must remember recent ids per conversation.' },
            { id: 'no-retry', label: 'Never resend; show an error', consequence: 'No duplicates, but a lost acknowledgement looks like a lost message and users retype it.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers change how messages are ordered, stored, or delivered to someone who is not there?',
        walkthrough: [
          { text: 'Ordering is needed only inside one conversation, so each conversation can have its own owner.' },
          { text: 'History forever at 400 GB a day means storage must be split across many machines.' },
          { text: 'Several devices and offline friends mean delivery cannot depend on a live connection alone.' },
          { text: 'A resend after a lost acknowledgement means every message needs an id the server can recognise.' },
        ],
        solution: [{ type: 'list', items: ['Order matters per conversation, not globally.', 'Groups up to 500; history forever; about 23,000 messages a second.', 'Several devices per person; offline friends receive later.', 'Resends must not create duplicates.'] }],
        why: 'These answers decide the key you store messages by, how you order them, and what happens when the recipient is away. The rest is detail.',
      },
      lessons: ['requirements', 'capacity-estimation'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts a message touches and connect them. Then trace a message through your own design.',
      question: 'Maya taps send. Which part gives the message its place in the conversation, and which part delivers it to Leo?',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-phone', 'phone', 'client', 'Chat app', 70, 220], ['s-gateway', 'gateway', 'gateway', 'Connection gateway', 300, 220]], [['s-phone', 's-gateway', 'sends request']]),
        traces: [
          { id: 'send', label: 'Send “running late” to a friend', token: 'send message', from: 'client', to: { type: ['msgdb'] } },
          { id: 'notify', label: 'Reach a friend who has the app closed', token: 'notify user', from: 'client', to: { type: ['push'] } },
        ],
      },
      help: {
        hint: 'If two people in one group send at the same moment, which single part decides which message is number 41 and which is 42?',
        walkthrough: [
          { text: 'Maya’s phone holds one open connection to a gateway; the gateway passes the message to Chat service.', focus: ['phone', 'gateway', 'chat'] },
          { text: 'Chat service gives the message the next sequence number for its conversation and stores it before acknowledging.', focus: ['chat', 'msgdb'] },
          { text: 'Chat service looks up where Leo is connected, then hands a delivery job to a queue.', focus: ['chat', 'presence', 'outbox'] },
          { text: 'A worker pushes it over Leo’s connection, or sends a mobile push if he is away.', focus: ['deliver', 'gateway', 'push'] },
        ],
        solution: [
          { type: 'p', text: '**Chat service owns order.** It stores the message in Message store under (conversation, next sequence number), acknowledges Maya, then queues one delivery job per recipient. A worker delivers it over the open connection, or through mobile push when the user is away.' },
          { type: 'code', lang: 'json', code: '{ "conversation": "c42", "client_msg_id": "maya-7f3a", "body": "running late" }\n→ { "seq": 118, "status": "stored" }' },
        ],
        why: 'Storing before acknowledging keeps “an acknowledged message is never lost”; one owner of numbering keeps order; the queue keeps delivery trouble off the sender.',
      },
      lessons: ['realtime-delivery', 'clocks-ordering', 'queues', 'idempotency'],
    },
    {
      id: 'data', title: 'Data model', intro: 'Messages are the biggest data you have. Choose the key that decides which machine holds each one, then see what each question costs.',
      question: 'What do you key the messages table on, and what does “everything this user has sent” cost?',
      activity: {
        kind: 'model',
        tables: [{ id: 'messages', name: 'messages', fields: ['conversation_id', 'seq', 'sender_id', 'client_msg_id', 'body', 'sent_at'] }],
        table: 'messages', partitions: 16,
        first: { id: 'q1', text: 'Open a conversation: load its latest 50 messages in order', filter: 'conversation_id', sort: 'seq' },
        second: { id: 'q2', text: 'Show everything one user has ever sent, across all conversations', filter: 'sender_id', sort: 'sent_at' },
        tradeoffs: [
          { id: 'key-conv', label: 'Key on conversation, sorted by sequence; scatter the rare “sent by user” search', consequence: 'Opening a chat is one partition and already ordered. The rare search asks every partition, which is acceptable if it is rare.', verdict: 'partial' },
          { id: 'index', label: 'Key on conversation, plus an index on sender', consequence: 'The sender search becomes one lookup. Every message written also updates the index: 23,000 extra writes a second.', verdict: 'sound' },
          { id: 'copy', label: 'Keep a second table keyed by sender, written asynchronously', consequence: 'The sender search is one partition. Each message is written twice, and the copy can lag behind.', verdict: 'sound' },
          { id: 'key-user', label: 'Key on sender instead', consequence: 'The sender search is fast, but opening a group chat now gathers messages from up to 500 senders on many machines.', verdict: 'risky' },
        ],
      },
      help: {
        hint: 'One question runs on every screen open; the other maybe once a week. Which one picks the key?',
        walkthrough: [
          { text: 'Opening a conversation is the hot read, so partition on conversation id and sort by sequence.', focus: ['msgdb'] },
          { text: 'A group’s messages then sit together, in order, on one partition.', focus: ['msgdb', 'chat'] },
          { text: '“Everything a user sent” does not use that key, so it either asks every partition or needs an index or a copy.', focus: ['msgdb'] },
          { text: 'Choose by how often it runs: a rare search can scatter; a frequent one deserves an index.', focus: ['msgdb'] },
        ],
        solution: [{ type: 'p', text: 'Key messages on **conversation_id**, sorted by **seq**. Opening a chat reads one partition. For “sent by a user”, add an index on `sender_id` if the feature is used often, or let it scatter if it is a rare support tool.' }],
        why: 'The key should match the most frequent read. The other question is answered with an index or a scatter, chosen by how often it runs and what it costs on every write.',
      },
      lessons: ['access-patterns', 'sharding', 'indexes', 'data-models'],
    },
    {
      id: 'offline', title: 'Friend unreachable', intro: 'The interviewer changes one condition. Predict, run it on your design, then revise.',
      question: 'Leo’s phone has no signal and the push service is not answering. Does Maya’s message wait, or does it fail?',
      change: { announce: 'New condition: the mobile push service stops answering for ten minutes while many people have their apps closed.', rule: RULES.trace, alternate: { announce: 'New condition: the message store goes down for two minutes.', label: 'Replay with the message store down' } },
      activity: {
        kind: 'trace', request: 'a message from Maya’s phone to a friend who is away', from: ['phone'], to: ['push', 'msgdb'], failCandidates: ['push', 'msgdb'],
        predict: { q: 'While that part is down, what does Maya see?', choices: [{ id: 'error', label: 'An error: the message could not be sent' }, { id: 'delayed', label: 'The message shows as sent; delivery happens later' }, { id: 'ok', label: 'Nothing changes' }] },
      },
      help: {
        hint: 'Is Maya waiting on that part? Should she be? Which of the two failures may wait, and which may not?',
        walkthrough: [
          { text: 'Delivery can wait: the message is already stored, and a queue holds the job until push is back.', focus: ['outbox', 'deliver', 'push'] },
          { text: 'If Chat service called push directly, Maya would wait on an outside company and might see an error.', focus: ['chat', 'push'] },
          { text: 'Storing cannot wait: an acknowledgement before the write would break “never lost”, so a store outage must show an error.', focus: ['chat', 'msgdb'] },
          { text: 'When Leo reconnects he asks for everything after the last sequence he has.', focus: ['gateway', 'msgdb'] },
        ],
        solution: [{ type: 'list', items: ['Store first, acknowledge second, deliver third.', 'Hand delivery to a queue; a push outage delays notifications but never fails the send.', 'On reconnect, the app asks for messages after its last sequence number.', 'If the store itself is down, refuse the send honestly instead of acknowledging.'] }],
        why: 'Delivery problems should delay, not fail, because the message is already safe. Storage problems must fail loudly because the promise “never lost” depends on it.',
      },
      lessons: ['queues', 'timeouts', 'availability', 'retries'],
    },
  ],
  rules: [
    // Design
    { id: 'seq-owner', stage: 'design', when: { link: [{ type: 'chat' }, { type: 'msgdb' }], labels: ['writes to', 'reads and writes'] }, ack: '{type:chat} writes to {type:msgdb} itself, so one place decides the order of messages.', strength: 'You gave message order a single owner: {type:chat} numbers and stores every message.' },
    { id: 'no-store', stage: 'design', when: { lacks: { type: 'msgdb' } }, coach: 'Messages need a durable home. Add Message store and connect Chat service to it.', gap: { text: 'There was no durable store for messages.', fix: 'Add Message store and write each message there before acknowledging the sender.', stage: 'design', lesson: 'first-booking' }, priority: 3 },
    { id: 'connect-path', stage: 'design', when: { all: [{ has: { type: 'msgdb' } }, { not: { path: ['client', { type: 'msgdb' }] } }] }, coach: 'Connect the path: Chat app → Connection gateway → Chat service → Message store. Select a part, then “Connect to…”.', priority: 2 },
    { id: 'trace-now', stage: 'design', when: { all: [{ path: ['client', { type: 'msgdb' }] }, { not: { result: 'trace:send', is: ['ok', 'hit'] } }] }, coach: 'Press “Trace a request” to watch “running late” travel through your design.', priority: 1 },
    { id: 'client-db', stage: 'design', when: { link: ['client', 'db'] }, priority: 9, ask: { text: 'The app talks to {kind:db} directly. Who gives a message its sequence number?', choices: [
      { id: 'service', label: 'A service in between numbers every message', reply: 'Yes: numbering needs one owner per conversation, and a phone cannot be trusted with it.', verdict: 'sound' },
      { id: 'phone', label: 'The phone picks the number', reply: 'Two phones in one group would pick the same number. The server must hand them out.', verdict: 'risky' },
      { id: 'db', label: 'The database auto-increments it', reply: 'That works if one machine holds the whole conversation. You would still want a service for sign-in, membership and delivery.', verdict: 'partial' },
    ] }, gap: { text: 'Phones wrote straight to the database.', fix: 'Route every message through Chat service, which numbers it and checks membership.', stage: 'design', lesson: 'realtime-delivery' } },
    { id: 'push-direct', stage: 'design', when: { link: [{ type: 'chat' }, { type: 'push' }] }, priority: 8, ask: { text: '{type:chat} calls {type:push} itself. If push takes ten seconds to answer, who is waiting?', choices: [
      { id: 'queue', label: 'Nobody should be: hand delivery to a queue and a worker', reply: 'Right. The send is already stored; delivery can lag without Maya noticing.', verdict: 'sound' },
      { id: 'async', label: 'Call push without waiting for the reply', reply: 'That keeps Maya moving, but if the call fails nothing remembers to retry. A queue remembers.', verdict: 'partial' },
      { id: 'wait', label: 'Maya waits; it is rare', reply: 'It is rare only until push has a bad evening, which is when most people use chat.', verdict: 'risky' },
    ] } },
    { id: 'presence-stale', stage: 'design', when: { has: { type: 'presence' } }, priority: 6, ask: { text: '{type:presence} says Leo is online, but he just walked into a tunnel. What happens to the message?', choices: [
      { id: 'stored', label: 'It is already stored; Leo’s app asks for missed messages when it reconnects', reply: 'Yes: presence only chooses the fast path. The stored message and the “after sequence N” fetch are what guarantee delivery.', verdict: 'sound' },
      { id: 'trust', label: 'Trust presence; the message is delivered', reply: 'Presence is a hint that can be seconds old. Treating it as truth loses messages.', verdict: 'risky' },
      { id: 'ack', label: 'Wait for Leo’s device to confirm, then fall back to push', reply: 'Also sound: a delivery acknowledgement with a timeout, then push. It adds a state to track per message.', verdict: 'sound' },
    ] }, strength: 'You treated presence as a hint and kept stored messages as the guarantee.' },
    { id: 'queue-boundary', stage: 'design', when: { all: [{ link: [{ type: 'chat' }, 'queue'] }, { link: ['queue', 'worker'] }] }, ack: '{type:chat} stores the message, then hands delivery to {kind:queue}. A slow delivery cannot slow the sender.', strength: 'You separated storing a message from delivering it with {kind:queue}.' },
    { id: 'log-alt', stage: 'design', when: { link: [{ type: 'chat' }, 'stream'] }, priority: 7, ack: 'You chose an event log instead of a queue. That is a valid alternative.', ask: { text: 'An event log keeps messages and lets many consumers read at their own pace. What does it cost compared with a queue?', choices: [
      { id: 'cursor', label: 'Each consumer must remember its own position', reply: 'Yes, and that fits chat well: a device’s position is just its last sequence number.', verdict: 'sound' },
      { id: 'free', label: 'Nothing; it is strictly better', reply: 'It is more to run, and per-user delivery jobs fit a plain queue more simply.', verdict: 'partial' },
    ] } },
    { id: 'clock-order', stage: 'design', when: { answer: 'assume:order', is: 'clock' }, priority: 7, ask: { text: 'You chose to sort by the sender’s phone clock. Leo’s phone is two minutes fast. What does the group see?', choices: [
      { id: 'seq', label: 'Replies can appear before the question. Switch to server sequence numbers', reply: 'Right. Keep the time for display only; order by the sequence number Chat service assigns.', verdict: 'sound' },
      { id: 'sync', label: 'Ask phones to sync their clocks', reply: 'You cannot force that, and clocks still differ by milliseconds, enough to reorder a fast exchange.', verdict: 'risky' },
    ] }, gap: { text: 'Message order depended on phone clocks.', fix: 'Number messages per conversation on the server and sort by that number.', stage: 'design', lesson: 'clocks-ordering' } },
    { id: 'id-dedupe', stage: 'design', when: { answer: 'assume:resend', is: 'client-id' }, strength: 'You made resends safe by giving every message an id the server can recognise.', ack: 'Where do you keep the ids you have seen, and for how long? Chat service must check them before it stores.' },
    // Data
    { id: 'key-good', stage: 'data', when: { result: 'data:q1', is: 'one-partition' }, ack: 'Opening a conversation reads one partition, already sorted.', strength: 'You keyed messages so the most common read touches one partition.' },
    { id: 'key-bad', stage: 'data', when: { result: 'data:q1', is: ['scatter', 'index'] }, priority: 8, ask: { text: 'Opening a conversation now has to ask more than one place. How often does that happen?', choices: [
      { id: 'always', label: 'Every time anyone opens any chat', reply: 'Then it is the wrong key. The hottest read should read one partition. Try conversation id.', verdict: 'risky' },
      { id: 'rare', label: 'Rarely', reply: 'It is the opposite: opening a chat is the most common action in the app.', verdict: 'risky' },
    ] }, gap: { text: 'The most common read, opening a conversation, was not keyed.', fix: 'Partition messages on conversation id and sort by sequence.', stage: 'data', lesson: 'access-patterns' } },
    { id: 'sender-scatter', stage: 'data', when: { result: 'data:q2', is: 'scatter' }, priority: 6, ask: { text: '“Everything this user sent” now asks all 16 partitions. When is that acceptable?', choices: [
      { id: 'rare', label: 'If it is a rare tool, such as support or data export', reply: 'Yes: a scatter that runs a few times a day costs less than an index that taxes every message.', verdict: 'sound' },
      { id: 'screen', label: 'If it powers a screen every user opens', reply: 'Then it runs constantly and each run costs 16 reads. Give it an index or a copy.', verdict: 'risky' },
    ] } },
    { id: 'sender-index', stage: 'data', when: { result: 'data:q2', is: 'index' }, priority: 6, ask: { text: 'The index makes the sender search one lookup. What does it cost on the write path?', choices: [
      { id: 'writes', label: 'Every message written also updates the index', reply: 'Yes: at 23,000 messages a second that is 23,000 more writes. Worth it only if the search is used often.', verdict: 'sound' },
      { id: 'none', label: 'Nothing', reply: 'Indexes are not free: each write has to maintain them.', verdict: 'risky' },
    ] } },
    { id: 'big-group', stage: 'data', when: { has: { type: 'msgdb' } }, priority: 5, ask: { text: 'Your diagram cannot show it, so tell me: in a 500-member group, do you store one copy of each message or one per member?', choices: [
      { id: 'one', label: 'One copy, keyed by conversation', reply: 'Yes: one write however large the group. Each member remembers only how far they have read.', verdict: 'sound' },
      { id: 'each', label: 'A copy in every member’s inbox', reply: 'That makes “my unread” cheap but multiplies every write by up to 500. It suits small groups only.', verdict: 'partial' },
    ] } },
    // Offline
    { id: 'off-delayed', stage: 'offline', when: { result: 'offline', is: 'delayed' }, ack: 'The send succeeded and delivery waits in {kind:queue} until the part is back.', strength: 'Your design keeps a slow delivery path off the sender’s path.' },
    { id: 'off-error', stage: 'offline', when: { result: 'offline', is: 'error' }, priority: 6, ask: { text: 'With that part down, Maya sees an error. Which would you accept?', choices: [
      { id: 'store', label: 'An error because the message could not be stored', reply: 'Correct: refusing is better than an acknowledgement for a message that is not saved. The app should keep it and retry.', verdict: 'sound' },
      { id: 'push', label: 'An error because push is down', reply: 'The message is already stored, so push trouble should delay delivery, not fail the send. Put a queue between them.', verdict: 'risky' },
    ] }, gap: { text: 'A delivery outage could fail a send that was already stored.', fix: 'Hand delivery to a queue and a worker so the sender never waits for push.', stage: 'offline', lesson: 'queues' } },
    { id: 'off-broken', stage: 'offline', when: { result: 'offline', is: 'broken' }, coach: 'There is no chain of arrows from the app to that part yet. Add the arrows, then run it again.', priority: 4 },
    { id: 'off-reconnect', stage: 'offline', when: { has: { type: 'deliver' } }, priority: 5, ask: { text: 'Leo reconnects after an hour with 30 missed messages. How does his app know what to fetch?', choices: [
      { id: 'after-seq', label: 'It asks for everything after the last sequence number it has', reply: 'Yes: one cheap range read on one partition, and it works for every device he owns.', verdict: 'sound' },
      { id: 'all', label: 'It downloads the whole conversation again', reply: 'Correct but wasteful with history kept forever. Use the sequence number as a bookmark.', verdict: 'partial' },
      { id: 'push-all', label: 'The server pushes each missed message as a separate notification', reply: 'Notifications are hints, not storage, and phones drop them. Fetch from the store instead.', verdict: 'risky' },
    ] } },
  ],
  solution: {
    design: g([
      ['phone', 'phone', 'client', 'Chat app', 30, 200], ['gateway', 'gateway', 'gateway', 'Connection gateway', 170, 200], ['chat', 'chat', 'service', 'Chat service', 320, 200],
      ['msgdb', 'msgdb', 'db', 'Message store', 480, 70], ['presence', 'presence', 'cache', 'Presence store', 480, 170], ['outbox', 'outbox', 'queue', 'Delivery queue', 480, 280],
      ['deliver', 'deliver', 'worker', 'Delivery worker', 560, 360], ['push', 'push', 'ext', 'Mobile push', 340, 380],
    ], [
      ['phone', 'gateway', 'sends request'], ['gateway', 'chat', 'sends request'], ['chat', 'msgdb', 'reads and writes'], ['chat', 'presence', 'reads from'],
      ['chat', 'outbox', 'publishes event'], ['outbox', 'deliver', 'delivers to'], ['deliver', 'gateway', 'calls'], ['deliver', 'push', 'calls'],
    ]),
    why: {
      phone: 'Sends messages with a client-generated id, shows them by sequence number, and asks for “after sequence N” when it reconnects.',
      gateway: 'Keeps the open connections so messages can be pushed to a phone without it asking.',
      chat: 'The single owner of order: numbers each message per conversation, deduplicates resends, stores, then queues delivery.',
      msgdb: 'Source of truth, keyed by conversation and sorted by sequence, so opening a chat reads one partition.',
      presence: 'A fast hint of which gateway holds each user. It may be stale, so it only chooses the fast path.',
      outbox: 'Holds delivery jobs so a slow or missing recipient never blocks the sender.',
      deliver: 'Pushes over the open connection if the user is online, otherwise asks for a notification, and retries.',
      push: 'Wakes a closed app. An outside service: it can lag or fail, so it sits behind the queue.',
    },
    alternatives: { outbox: { types: ['stream'], tradeoff: 'An event log keeps messages and lets every device read from its own position, at the cost of tracking positions.' } },
    trace: { title: 'Maya sends “running late” to Leo', steps: [
      { from: 'phone', to: 'gateway', text: 'Maya’s app sends {conversation c42, client id maya-7f3a, “running late”} over its open connection.' },
      { from: 'gateway', to: 'chat', text: 'The gateway forwards it to Chat service, which finds the conversation’s owner.' },
      { from: 'chat', to: 'msgdb', text: 'Chat service assigns sequence 118, stores the message (a repeated client id returns 118 again), and acknowledges Maya.' },
      { from: 'chat', to: 'presence', text: 'It looks up where Leo is connected: gateway 7, or nowhere.' },
      { from: 'chat', to: 'outbox', text: 'It queues one delivery job for Leo.' },
      { from: 'outbox', to: 'deliver', text: 'A worker takes the job.' },
      { from: 'deliver', to: 'gateway', text: 'Leo is online: the worker pushes message 118 over his open connection. If not, it calls Mobile push, and Leo fetches “after 117” on reconnect.' },
    ] },
    tradeoff: 'One owner per conversation makes ordering and duplicates easy, but a very busy conversation sits on one machine; that is fine for groups of 500, not for channels of 100,000.',
    otherApproach: 'For huge channels, store each message once and let clients pull or receive a small “new messages” nudge instead of fanning out a delivery job per member.',
  },
};
