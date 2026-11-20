import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const collabEditor: InterviewScript = {
  caseId: 'case-collab-editor',
  track: 'hld',
  doLine: 'Route edits from several people to one place, race two edits on one paragraph, then see what happens when the sync server goes offline',
  skills: ['concurrency', 'consistency', 'architecture', 'reliability'],
  brief: {
    interviewer: { name: 'Rosa', role: 'tech lead on the documents team' },
    intro: 'We are building a shared document editor, like the ones teams use for meeting notes. The hard part is that people type in the same document at the same moment.',
    users: 'Teams editing one document together, up to 50 people at once, on laptops and phones.',
    needs: ['Type and see everyone else’s changes within about 200 ms', 'See other people’s cursors', 'Reopen a document and see the latest text', 'Look back at earlier versions'],
    mustHold: ['Everyone ends up looking at the same text', 'An edit that was accepted is never silently lost', 'Typing is never blocked by a slow server'],
    constraints: ['Up to 50 simultaneous editors per document', 'Edits reach the others in about 200 ms', 'Full version history is kept', 'Editors may be offline for a while and reconnect'],
    outOfScope: ['Comments and suggestions', 'Permissions and sharing links', 'Rich formatting rules'],
    terms: [
      { term: 'operation', meaning: 'one small edit, such as “insert x at position 5”, sent instead of the whole document' },
      { term: 'conflict', meaning: 'two people changing the same thing from the same starting point' },
      { term: 'version', meaning: 'a counter on a paragraph, or on the whole document, that goes up with each accepted edit' },
      { term: 'snapshot', meaning: 'a saved copy of the whole document at one point in its history' },
    ],
    firstMove: 'Ana and Ben are editing the same document. Ana types a sentence. Show me the parts that carry her edit to Ben’s screen, then trace it.',
  },
  palette: [
    { type: 'app', kind: 'client', name: 'Editor app', blurb: 'The browser or phone editor. It shows the text at once and sends each edit as an operation.' },
    { type: 'router', kind: 'lb', name: 'Document router', blurb: 'Sends everyone who opens document D to the same session server.' },
    { type: 'session', kind: 'service', name: 'Document session', blurb: 'One server owns each open document: it orders edits, resolves conflicts and broadcasts the result.' },
    { type: 'oplog', kind: 'stream', name: 'Operation log', blurb: 'An ordered, permanent list of every accepted edit. History and recovery both come from it.' },
    { type: 'snaps', kind: 'db', name: 'Snapshot store', blurb: 'Saved copies of the whole document every so often, so opening it does not replay every edit.' },
    { type: 'presence', kind: 'cache', name: 'Cursor store', blurb: 'Short-lived cursor positions and “who is here”. Losing it only costs a moment of cursors.' },
    { type: 'snapper', kind: 'worker', name: 'Snapshot worker', blurb: 'Reads the log and writes a new snapshot every few hundred edits.' },
  ],
  verbs: ['sends request', 'reads from', 'writes to', 'reads and writes', 'publishes event', 'delivers to', 'calls'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'size', q: 'How many people edit one document at once?', a: 'Up to 50. Most documents have two or three, but a team meeting can reach 50.' },
          { id: 'latency', q: 'How quickly must others see an edit?', a: 'About 200 ms. Your own typing must show instantly, without waiting for the server.' },
          { id: 'offline', q: 'Can people edit offline?', a: 'Yes, for a while: on a train, for example. Their edits merge when they reconnect.' },
          { id: 'conflict', q: 'What if two people change the same sentence?', a: 'Both edits must survive and everyone must see the same result. Meaning-level clashes are for the people to sort out.' },
          { id: 'history', q: 'Do we keep earlier versions?', a: 'Yes. Full history, and opening a document must stay fast.' },
          { id: 'scope', q: 'Do comments, permissions or formatting matter here?', a: 'Not in this interview. Plain text edits only.' },
        ],
        assumptions: [
          { id: 'order', q: 'Who decides the order of simultaneous edits?', options: [
            { id: 'server', label: 'One server per document puts every edit in a single order', consequence: 'Simple and consistent. All editors of a document must reach the same server, and its failure needs a plan.' },
            { id: 'peers', label: 'Editors merge among themselves with no central order', consequence: 'Works offline and has no central server, but every character carries extra bookkeeping and the design is harder.' },
          ] },
          { id: 'conflict-rule', q: 'When two people save a change to the same paragraph from the same starting point, what happens?', options: [
            { id: 'merge', label: 'The server checks the version; the later one is rebased on top of the first', consequence: 'Nobody’s edit is lost, but the server needs a way to adjust the later edit.' },
            { id: 'last', label: 'The last save wins', consequence: 'Simplest, but the earlier person’s edit is silently thrown away.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers decide who puts simultaneous edits in order, and what happens to someone who was offline?',
        walkthrough: [
          { text: 'Up to 50 people on one document means one place can order that document’s edits.' },
          { text: 'Typing must feel instant, so the editor applies each edit locally first and sends it after.' },
          { text: 'Offline editing means edits are sent as small operations with a version, so they can be merged later.' },
          { text: 'History means keeping every operation, with snapshots so opening is still fast.' },
        ],
        solution: [{ type: 'list', items: ['Up to 50 editors; edits visible in about 200 ms.', 'Local typing is instant; merging happens after.', 'Offline edits merge on reconnect.', 'Full history kept; opening must stay fast.'] }],
        why: 'These answers decide where edits are ordered, what is stored, and what “conflict” has to mean. Everything else can wait.',
      },
      lessons: ['requirements', 'realtime-delivery'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts an edit touches and connect them. Then trace an edit through your own design.',
      question: 'Ana types a sentence. Which part decides the order of her edit and Ben’s, and how does it reach the others?',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-app', 'app', 'client', 'Editor app', 70, 220], ['s-session', 'session', 'service', 'Document session', 300, 220]], [['s-app', 's-session', 'sends request']]),
        traces: [
          { id: 'edit', label: 'Ana’s edit is saved', token: 'insert “hello” at 12', from: 'client', to: { type: ['oplog'] } },
          { id: 'open', label: 'Ben opens the document', token: 'GET /docs/D', from: 'client', to: { type: ['snaps'] }, read: true },
        ],
      },
      help: {
        hint: 'If Ana and Ben’s edits reached two different servers, who would decide which comes first? Give each document one owner.',
        walkthrough: [
          { text: 'The router sends every editor of document D to the same session server.', focus: ['app', 'router', 'session'] },
          { text: 'The session server puts edits in one order and appends each to the operation log.', focus: ['session', 'oplog'] },
          { text: 'It then broadcasts the accepted edit to the other editors; cursors go through a small cache.', focus: ['session', 'presence'] },
          { text: 'Snapshots, written by a worker from the log, make reopening fast.', focus: ['oplog', 'snapper', 'snaps'] },
        ],
        solution: [
          { type: 'p', text: '**One session per document.** The router maps document id to a session server. Every edit goes there, is put in order, appended to the operation log, and broadcast to the other editors. A worker snapshots the log so opening a document loads the last snapshot plus a few operations.' },
          { type: 'code', lang: 'json', code: '{ "doc": "D", "base_version": 41, "op": { "insert": "hello", "at": 12 } }\n→ { "version": 42 }' },
        ],
        why: 'A single owner per document gives one order that everyone shares, and the append-only log is both the history and the recovery source.',
      },
      lessons: ['realtime-delivery', 'logs-delivery', 'clocks-ordering'],
    },
    {
      id: 'concurrency', title: 'Two edits at once', intro: 'Ana and Ben edit the same paragraph at the same moment. Arrange their reads and writes, predict, then run it.',
      question: 'Both start from version 7 of the paragraph and both save. How many edits are accepted on top of version 7?',
      activity: {
        kind: 'timeline', names: ['Ana', 'Ben'], resource: 'Paragraph 3 (edits accepted at version 7)', initial: 1,
        read: 'loads version 7', write: 'saves her edit',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'Last writer wins', detail: 'Save the whole paragraph as the editor sees it. The later save replaces the earlier one.', code: "paragraph[3] = new_text   # no check of what it was based on" },
          { id: 'conditional', label: 'Version check', detail: 'Save only if the paragraph is still at the version the editor started from; otherwise rebase and retry.', code: "UPDATE paragraphs SET text = :t, version = version + 1\nWHERE id = 3 AND version = 7;\n-- 1 row → accepted; 0 rows → rebase on the new text, retry" },
          { id: 'lock', label: 'Lock the paragraph', detail: 'The first editor locks it; the second waits until the first has saved.', code: "SELECT text FROM paragraphs WHERE id = 3 FOR UPDATE;" },
        ],
        predict: { q: 'With “last writer wins” and this order, whose edit survives?', choices: [{ id: 'one', label: 'Only one person’s edit survives, silently' }, { id: 'both', label: 'Both edits survive' }, { id: 'none', label: 'Neither survives' }] },
      },
      help: {
        hint: 'What did Ben’s save assume about the paragraph, and was it still true when he saved?',
        walkthrough: [
          { text: 'Ana and Ben both load version 7.' },
          { text: 'Ana saves. The paragraph is now version 8 and contains her edit.' },
          { text: 'Ben saves text based on version 7. With last-writer-wins it replaces version 8, and Ana’s edit vanishes with no error.' },
          { text: 'With a version check, Ben’s save is refused because the paragraph is no longer at 7. His editor rebases his change on version 8 and tries again, so both survive.' },
        ],
        solution: [
          { type: 'p', text: '**Last writer wins** accepts both saves, and Ana’s edit is silently lost. A **version check** accepts exactly one save per version; the loser rebases onto the new text and retries, so both edits survive.' },
          { type: 'code', lang: 'python', code: "def save(doc, para, base_version, new_text):\n    if para.version != base_version:\n        return 'stale'          # caller rebases and retries\n    para.text, para.version = new_text, base_version + 1\n    return 'ok'" },
        ],
        why: '“An accepted edit is never silently lost” needs the check and the save to be one step, so a stale edit is refused instead of overwriting.',
      },
      lessons: ['concurrent-reservations', 'locking-mvcc', 'consistency-models'],
    },
    {
      id: 'outage', title: 'Sync server offline', intro: 'The interviewer changes one condition. Predict, run it on your design, then revise.',
      question: 'The document’s session server goes offline in the middle of a meeting. What do the editors see, and how does the document recover?',
      change: { announce: 'New condition: the session server for a busy document crashes and takes about a minute to be replaced.', rule: RULES.trace, alternate: { announce: 'New condition: the snapshot store is unavailable for ten minutes.', label: 'Replay with the snapshot store down' } },
      activity: {
        kind: 'trace', request: 'an edit from the editor to the saved document', from: ['app'], to: ['oplog', 'snaps'], failCandidates: ['session', 'snaps'],
        predict: { q: 'While that part is down, what does the editor do with a new edit?', choices: [{ id: 'error', label: 'The edit cannot be saved; the sync fails' }, { id: 'delayed', label: 'The edit is accepted now and saved later' }, { id: 'ok', label: 'Nothing changes' }] },
      },
      help: {
        hint: 'If the one owner of a document disappears, where is the document’s truth, and who can take over?',
        walkthrough: [
          { text: 'While the session server is down, edits cannot reach the log, so syncing stops.', focus: ['session', 'oplog'] },
          { text: 'The editor keeps showing and storing its own edits locally and resends them with their base versions.', focus: ['app'] },
          { text: 'A new session server for the document rebuilds its state from the last snapshot plus the log.', focus: ['oplog', 'snaps'] },
          { text: 'Resent edits are merged exactly like edits from someone who was offline.', focus: ['session'] },
        ],
        solution: [{ type: 'list', items: ['The log and snapshots hold the truth, not the session server’s memory.', 'The router starts a replacement session, which rebuilds from snapshot plus log.', 'Editors keep typing locally and resend on reconnect with their base version.', 'A snapshot outage slows opening but never loses edits, because the log has them.'] }],
        why: 'Because the session server holds no unique data, losing it costs a minute of syncing, not an edit.',
      },
      lessons: ['failover', 'availability', 'timeouts', 'logs-delivery'],
    },
  ],
  rules: [
    // Design
    { id: 'one-owner', stage: 'design', when: { all: [{ link: [{ type: 'app' }, { type: ['router', 'session'] }] }, { link: [{ type: 'session' }, { type: 'oplog' }], labels: ['writes to', 'publishes event', 'reads and writes'] }] }, ack: 'Edits go through {type:session}, which writes each one to {type:oplog}: one place decides the order.', strength: 'You gave each document one owner that orders every edit and records it.' },
    { id: 'no-log', stage: 'design', when: { lacks: { type: 'oplog' } }, coach: 'Edits need a permanent, ordered home. Add the Operation log and connect Document session to it.', gap: { text: 'No durable ordered record of edits existed.', fix: 'Append every accepted edit to an operation log; derive history and snapshots from it.', stage: 'design', lesson: 'logs-delivery' }, priority: 3 },
    { id: 'connect-path', stage: 'design', when: { all: [{ has: { type: 'oplog' } }, { not: { path: ['client', { type: 'oplog' }] } }] }, coach: 'Connect the path: Editor app → Document session → Operation log. Select a part, then “Connect to…”.', priority: 2 },
    { id: 'trace-now', stage: 'design', when: { all: [{ path: ['client', { type: 'oplog' }] }, { not: { result: 'trace:edit', is: ['ok', 'hit'] } }] }, coach: 'Press “Trace a request” to watch Ana’s edit travel through your design.', priority: 1 },
    { id: 'direct-db', stage: 'design', when: { link: ['client', { type: ['snaps', 'oplog'] }] }, priority: 9, ask: { text: 'The editor writes to {type:oplog} or {type:snaps} directly. If Ana and Ben both do it, who decides the order?', choices: [
      { id: 'service', label: 'A session server in between puts the edits in order', reply: 'Yes: someone has to see both edits to order them. That is the session server’s job.', verdict: 'sound' },
      { id: 'arrival', label: 'Whichever write arrives first', reply: 'Arrival order differs per replica and ignores what each person was looking at. That is how edits get lost.', verdict: 'risky' },
    ] }, gap: { text: 'Editors wrote to storage with nothing to order or merge their edits.', fix: 'Send every edit through a per-document session server.', stage: 'design', lesson: 'realtime-delivery' } },
    { id: 'many-sessions', stage: 'design', when: { count: { type: 'session' }, min: 2 }, priority: 8, ask: { text: 'You have several {type:session} servers. If Ana connects to one and Ben to another, who orders their edits?', choices: [
      { id: 'route', label: 'A router sends both to the same one by document id', reply: 'Yes: spread documents across servers, never one document across two.', verdict: 'sound' },
      { id: 'sync', label: 'The servers agree between themselves', reply: 'That can work but adds a consensus step on every keystroke. Routing by document is far simpler.', verdict: 'partial' },
      { id: 'either', label: 'It does not matter', reply: 'It does: two servers can each decide their own edit came first.', verdict: 'risky' },
    ] } },
    { id: 'cursors', stage: 'design', when: { has: { type: 'presence' } }, priority: 5, ask: { text: 'Cursor positions change many times a second. Should they go in the permanent {type:oplog}?', choices: [
      { id: 'no', label: 'No: keep them in a short-lived store; losing them costs only a moment', reply: 'Right. History is for content. Cursors are ephemeral and would bury the log.', verdict: 'sound' },
      { id: 'yes', label: 'Yes, so nothing is lost', reply: 'It would multiply log writes by many times and make history unreadable. Nothing important is in a cursor.', verdict: 'risky' },
    ] }, strength: 'You kept cursors out of the permanent log, so history stays about content.' },
    { id: 'snap-link', stage: 'design', when: { has: { type: 'snaps' } }, priority: 4, ask: { text: 'Your diagram cannot show it: how does opening a document with 100,000 edits stay fast?', choices: [
      { id: 'snapshot', label: 'Load the latest snapshot, then replay only edits after it', reply: 'Yes. Take a snapshot every few hundred edits, so replay is always short.', verdict: 'sound' },
      { id: 'replay', label: 'Replay every edit from the start', reply: 'Correct, but opening gets slower with every edit ever made.', verdict: 'risky' },
    ] }, strength: 'You planned snapshots so reopening a long document stays fast.' },
    { id: 'p2p-alt', stage: 'design', when: { all: [{ answer: 'assume:order', is: 'peers' }, { lacks: { type: 'session' } }] }, priority: 7, ack: 'You chose to merge among editors with no central server. That is a valid alternative.', ask: { text: 'With no central session, how do two editors end up with the same text?', choices: [
      { id: 'crdt', label: 'Each character has a unique id and a place that never changes, so edits can be applied in any order', reply: 'Yes, that is the idea behind CRDTs. The cost is extra data per character and cleaning up deleted ones.', verdict: 'sound' },
      { id: 'hope', label: 'They send each other the whole text and keep the newest', reply: 'That is last-writer-wins again, and edits disappear.', verdict: 'risky' },
    ] }, strength: 'You proposed a serverless merge design and could explain why it converges.' },
    // Concurrency
    { id: 'race-fixed', stage: 'concurrency', when: { result: 'concurrency', is: 'one' }, ack: 'Only one save was accepted on top of version 7, in every order you tried, and the other editor rebases.', strength: 'You made the save conditional on the version, so no edit is silently overwritten.' },
    { id: 'race-lost', stage: 'concurrency', when: { result: 'concurrency', is: 'oversold' }, priority: 6, ask: { text: 'Both saves were accepted on the same version, so one edit vanished. Which part has to make the check and the save one step?', choices: [
      { id: 'session', label: 'The session server, with a version check on every edit', reply: 'Yes: it is the single place that sees both edits. Switch the guard and run the same order again.', verdict: 'sound' },
      { id: 'editor', label: 'Each editor should check before saving', reply: 'Checking is not enough: Ben can check, Ana can save, and Ben can then save over her.', verdict: 'risky' },
    ] }, gap: { text: 'Saves overwrote each other, so one person’s edit was lost without any error.', fix: 'Accept an edit only if its base version is current; otherwise rebase and retry.', stage: 'concurrency', lesson: 'concurrent-reservations' } },
    { id: 'lock-ask', stage: 'concurrency', when: { has: { type: 'session' } }, priority: 5, ask: { text: 'A lock on the whole paragraph would also stop the lost edit. What is the downside while 50 people type?', choices: [
      { id: 'wait', label: 'People wait for each other, so typing stalls', reply: 'Yes: typing must never be blocked. A version check lets everyone type and fixes the rare clash afterwards.', verdict: 'sound' },
      { id: 'none', label: 'No downside', reply: 'A lock held while someone thinks, or loses signal, blocks everyone else on that paragraph.', verdict: 'risky' },
    ] } },
    // Outage
    { id: 'out-delayed', stage: 'outage', when: { result: 'outage', is: 'delayed' }, ack: 'Your design accepts the edit and the work waits in {kind:stream} or {kind:queue} until the part is back.', strength: 'Your design keeps a downstream outage from stopping typing.' },
    { id: 'out-error', stage: 'outage', when: { result: 'outage', is: 'error' }, priority: 6, ask: { text: 'With that part down, syncing fails. What should Ana’s editor do with the edits she keeps typing?', choices: [
      { id: 'local', label: 'Keep showing them, keep them on the device, and resend with their base versions on reconnect', reply: 'Yes: the same path serves an editor who was offline. The server merges them as it would any late edit.', verdict: 'sound' },
      { id: 'block', label: 'Freeze the document until the server is back', reply: 'Safe, but a one-minute outage becomes a one-minute work stoppage for 50 people.', verdict: 'partial' },
      { id: 'drop', label: 'Discard them; ask her to retype', reply: 'That breaks “an accepted edit is never lost”, and she had no way to know.', verdict: 'risky' },
    ] }, gap: { text: 'Nothing explained how edits survive a session server crash.', fix: 'Keep edits locally and resend with base versions; rebuild the session from snapshot plus log.', stage: 'outage', lesson: 'failover' } },
    { id: 'out-broken', stage: 'outage', when: { result: 'outage', is: 'broken' }, coach: 'There is no chain of arrows from the editor to that part yet. Add the arrows, then run it again.', priority: 4 },
    { id: 'out-rebuild', stage: 'outage', when: { has: { type: 'snaps' } }, priority: 5, ask: { text: 'A replacement session server starts with an empty memory. How does it know the document’s current text?', choices: [
      { id: 'log', label: 'It loads the last snapshot and replays the operation log after it', reply: 'Yes: the session is disposable because the log has everything.', verdict: 'sound' },
      { id: 'ask', label: 'It asks the editors for their copies', reply: 'Editors may differ or be offline. Use the log as the source of truth.', verdict: 'risky' },
    ] } },
  ],
  solution: {
    design: g([
      ['app', 'app', 'client', 'Editor app', 30, 220], ['router', 'router', 'lb', 'Document router', 170, 220], ['session', 'session', 'service', 'Document session', 320, 220],
      ['presence', 'presence', 'cache', 'Cursor store', 480, 70], ['oplog', 'oplog', 'stream', 'Operation log', 480, 220], ['snapper', 'snapper', 'worker', 'Snapshot worker', 480, 360], ['snaps', 'snaps', 'db', 'Snapshot store', 600, 290],
    ], [
      ['app', 'router', 'sends request'], ['router', 'session', 'sends request'], ['session', 'presence', 'reads and writes'], ['session', 'oplog', 'publishes event'],
      ['oplog', 'snapper', 'delivers to'], ['snapper', 'snaps', 'writes to'], ['session', 'snaps', 'reads from'],
    ]),
    why: {
      app: 'Applies each edit locally at once, sends it as an operation with its base version, and resends after a disconnect.',
      router: 'Maps document id to a session server, so every editor of a document meets in one place.',
      session: 'Owns the document while it is open: orders edits, rebases stale ones, appends to the log, broadcasts to the others.',
      presence: 'Holds cursors and “who is here”. Short-lived, so losing it costs only a moment.',
      oplog: 'The permanent, ordered record of every accepted edit: history, recovery and snapshots all come from it.',
      snapper: 'Reads the log and writes a snapshot every few hundred edits, off the typing path.',
      snaps: 'Saved copies of the whole document so opening loads one snapshot plus a few operations.',
    },
    alternatives: { session: { types: ['oplog'], tradeoff: 'Editors can merge among themselves with CRDTs and no central session, which suits offline-first use, but every character carries extra data and the log becomes the only coordination.' } },
    trace: { title: 'Ana’s edit reaches Ben', steps: [
      { from: 'app', to: 'router', text: 'Ana’s editor shows “hello” instantly, then sends {doc D, base version 41, insert “hello” at 12}.' },
      { from: 'router', to: 'session', text: 'The router sends it to the session server that owns document D.' },
      { from: 'session', to: 'oplog', text: 'The session checks the base version (rebasing if Ben edited meanwhile), appends it as version 42 and acknowledges Ana.' },
      { from: 'session', to: 'presence', text: 'Cursor movements go to the short-lived store, not the log.' },
      { from: 'oplog', to: 'snapper', text: 'Every few hundred versions the snapshot worker reads the log.' },
      { from: 'snapper', to: 'snaps', text: 'It writes a snapshot, so reopening loads it plus a few operations. Meanwhile the session broadcast version 42 to Ben and the other editors.' },
    ] },
    tradeoff: 'One session server per document gives a single order and a simple merge, but that server is a point to replace on failure; the log makes replacing it safe.',
    otherApproach: 'If offline editing or peer-to-peer sync matters more than central control, use a CRDT document: each character has a stable id, edits merge in any order, and there is no central transform.',
  },
};
