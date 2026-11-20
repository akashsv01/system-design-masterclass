import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const fileSync: InterviewScript = {
  caseId: 'case-file-sync',
  track: 'hld',
  doLine: 'Design file sync across a laptop and a phone, race two offline edits of one file, then keep saves safe when the metadata service is down',
  skills: ['architecture', 'consistency', 'concurrency', 'reliability'],
  brief: {
    interviewer: { name: 'Dana', role: 'engineering lead on the file-sync team' },
    intro: 'We build the “save a file here, open it there” feature. People edit on a laptop on a train, then pick up their phone. The worst bug report we can get is “my edit vanished”.',
    users: 'People with a laptop and a phone who keep documents, photos and design files in one synced folder.',
    needs: ['Save a file on one device and see it on the others within a few seconds', 'Keep editing offline and sync when the connection returns', 'Handle files up to 10 GB without re-uploading everything after a small edit'],
    mustHold: ['A saved version is never lost', 'Nobody’s edit is silently overwritten by someone else’s', 'The version list never points at file pieces that are not stored yet'],
    constraints: ['50 million users', 'Files up to 10 GB; most edits change a small part of the file', 'Files are cut into chunks of about 4 MB, each named by a hash of its content', 'Two devices may edit the same file while offline', 'Old versions are kept for 30 days'],
    outOfScope: ['Editing the same document live with another person', 'Sharing links and permissions', 'Search inside files'],
    terms: [
      { term: 'chunk', meaning: 'a piece of a file, about 4 MB. A big file is a list of chunks' },
      { term: 'content hash', meaning: 'a short fingerprint computed from a chunk’s bytes. The same bytes always give the same hash, so it works as the chunk’s name' },
      { term: 'metadata', meaning: 'the small facts about a file: its name, its versions, and the list of chunk hashes that make up each version' },
      { term: 'parent version', meaning: 'the version a device started editing from. A new version says “I come after v5”' },
      { term: 'conflicted copy', meaning: 'a second file saved beside the original when two edits collide, so both survive' },
    ],
    firstMove: 'Someone saves report.docx on their laptop and expects it on their phone a few seconds later. Draw what carries the file’s bytes and what carries the news that it changed, then trace that save through your design.',
  },
  palette: [
    { type: 'laptop', kind: 'client', name: 'Laptop', blurb: 'The sync app on a laptop. It watches the folder, cuts files into chunks and works offline.' },
    { type: 'phone', kind: 'client', name: 'Phone', blurb: 'The sync app on a phone. It hears about changes and fetches what it is missing.' },
    { type: 'upload', kind: 'service', name: 'Upload service', blurb: 'Receives chunks, checks their hashes and stores the ones that are new.' },
    { type: 'blocks', kind: 'storage', name: 'Chunk storage', blurb: 'Object storage holding every chunk, keyed by its content hash. Cheap and very durable.' },
    { type: 'commits', kind: 'queue', name: 'Commit queue', blurb: 'Holds “new version” requests, in order, until the metadata service takes them.' },
    { type: 'meta', kind: 'service', name: 'Metadata service', blurb: 'Decides whether a new version is accepted and records its chunk list.' },
    { type: 'metadb', kind: 'db', name: 'Metadata database', blurb: 'One row per file version: name, parent version, list of chunk hashes.' },
    { type: 'notify', kind: 'service', name: 'Change notifier', blurb: 'Tells a user’s other devices that something changed. It sends news, not files.' },
  ],
  verbs: ['sends request', 'writes to', 'reads from', 'reads and writes', 'publishes event', 'delivers to', 'calls'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'size', q: 'How big can a file be, and how big are typical edits?', a: 'Up to 10 GB. Most edits change a small part of the file: one paragraph in a long document.' },
          { id: 'offline', q: 'Can people edit while offline?', a: 'Yes. A laptop on a train keeps working, and its changes sync when it reconnects.' },
          { id: 'conflict', q: 'What if two devices edit the same file while offline?', a: 'Never lose either edit. One becomes the next version; the other is kept beside it as a conflicted copy.' },
          { id: 'speed', q: 'How soon must another device see a change?', a: 'A few seconds when everything is online. Slower is fine when something is down, as long as nothing is lost.' },
          { id: 'history', q: 'Do we keep old versions?', a: 'Yes, for 30 days, so people can go back.' },
          { id: 'live', q: 'Do two people edit the same document live?', a: 'Not in this design. Live co-editing is a separate product. Here a save is a whole new version.' },
        ],
        assumptions: [
          { id: 'chunking', q: 'How do you send a changed file?', options: [
            { id: 'whole', label: 'Upload the whole file every time', consequence: 'A one-word edit to a 1 GB file uploads 1 GB. Simple, but slow and costly for large files.' },
            { id: 'chunks', label: 'Cut it into chunks named by hash; upload only the chunks the server lacks', consequence: 'An edit that changes a small part uploads only the chunks it touches. You now need a list of chunk hashes per version.' },
          ] },
          { id: 'conflict', q: 'When two offline edits collide, what is the rule?', options: [
            { id: 'newest', label: 'The newest save wins', consequence: 'Simple, but the older edit disappears with no warning.' },
            { id: 'both', label: 'Keep both: one becomes the next version, the other a conflicted copy', consequence: 'Nothing is lost, but the commit must be able to tell that an edit started from an old version.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers change what you store, or how two devices’ changes meet?',
        walkthrough: [
          { text: 'Files up to 10 GB with small edits mean you should not send whole files each time.' },
          { text: 'Offline editing means two devices can make different changes to the same version.' },
          { text: '“Never lose either edit” turns that collision into a design requirement, not an error.' },
          { text: 'A few seconds of delay is fine, so news of a change can travel through a queue.' },
        ],
        solution: [{ type: 'list', items: ['Large files, small edits: send chunks, not whole files.', 'Offline edits happen, so two devices can edit the same version.', 'A collision keeps both edits (new version plus conflicted copy).', 'Seconds of delay are fine; lost edits are not.', 'No live co-editing: a save is a whole new version.'] }],
        why: 'These answers decide how files are stored (chunks), how versions are recorded (a list per version) and how a collision is handled (keep both). The rest can wait.',
      },
      lessons: ['requirements'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts a save touches and connect them. Then trace a save from the laptop to the phone through your own design.',
      question: 'Someone saves report.docx on the laptop. What carries the bytes, what carries the news, and how does the phone get the file?',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-laptop', 'laptop', 'client', 'Laptop', 60, 220], ['s-upload', 'upload', 'service', 'Upload service', 300, 220]], [['s-laptop', 's-upload', 'sends request']]),
        traces: [
          { id: 'upload', label: 'Upload a changed chunk', token: 'PUT chunk a41f…', from: { type: 'laptop' }, to: { type: 'blocks' } },
          { id: 'save', label: 'Save report.docx and tell the phone', token: 'save report.docx', from: { type: 'laptop' }, to: { type: 'phone' } },
        ],
      },
      help: {
        hint: 'Which part holds the file’s bytes, which holds the list of versions, and what must be true before a version may name a chunk?',
        walkthrough: [
          { text: 'The laptop cuts the file into chunks and sends the ones the server does not have to Upload service.', focus: ['laptop', 'upload'] },
          { text: 'Upload service stores each new chunk in Chunk storage, named by its hash.', focus: ['upload', 'blocks'] },
          { text: 'Only after every chunk is stored does the laptop’s “new version” request enter the Commit queue.', focus: ['commits'] },
          { text: 'Metadata service takes commits in order and records each new version in the Metadata database.', focus: ['meta', 'metadb'] },
          { text: 'Change notifier tells the phone that the file changed; the phone fetches the chunk list and any missing chunks.', focus: ['notify', 'phone', 'blocks'] },
        ],
        solution: [
          { type: 'p', text: '**Two paths, kept apart.** Bytes go laptop → Upload service → Chunk storage. The version list goes through the Commit queue to Metadata service and the Metadata database. The notifier carries only news; the phone then asks for the chunk list and fetches chunks it lacks.' },
          { type: 'code', lang: 'http', code: 'POST /v1/files/report.docx/versions\n{ "parent": 5, "chunks": ["a41f…", "9c02…", "77be…"] }\n→ 202 {commit_id}   (queued; commits are applied in order)\nWhen applied: version 6 is created, or 409 {current: 6} if the parent is no longer the latest' },
        ],
        why: 'Keeping bytes and metadata apart means big uploads never block the small, ordered decision about versions, and the order “chunks first, then version” stops a version naming a missing chunk.',
      },
      lessons: ['storage-engines', 'queues'],
    },
    {
      id: 'conflict', title: 'Two offline edits', intro: 'The laptop and the phone both edited report.docx offline, starting from v5. They reconnect almost together. Arrange their reads and writes, predict, then run it.',
      question: 'Both devices read v5 and each saves an edit. What happens to the second edit?',
      activity: {
        kind: 'timeline', names: ['Laptop', 'Phone'], resource: 'report.docx (room for one new version after v5)', initial: 1,
        read: 'reads that v5 is the latest', write: 'saves its edit as v6',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'Last writer wins', detail: 'The server trusts what each device saw. Both saves are accepted as v6, and the later one replaces the earlier.', code: "version = db.latest(file)          # both devices saw 5\ndb.save(file, version + 1, chunks)  # the second save overwrites v6" },
          { id: 'conditional', label: 'Version check', detail: 'A save names its parent. The server accepts it only if the parent is still the latest; otherwise the client keeps the edit as a conflicted copy.', code: "UPDATE files SET latest = 6, chunks = :chunks\nWHERE name = 'report.docx' AND latest = 5;\n-- 1 row: accepted as v6; 0 rows: 409, save a conflicted copy" },
          { id: 'lock', label: 'Lock the file', detail: 'The first device to open the file locks it. This needs a connection to take the lock, which an offline device does not have.', code: "SELECT latest FROM files WHERE name = 'report.docx' FOR UPDATE;" },
        ],
        predict: { q: 'With “last writer wins” and this order, what happens to the two edits?', choices: [{ id: 'one', label: 'One is accepted; the other is refused and kept as a conflicted copy' }, { id: 'both', label: 'Both are accepted as v6, so the later replaces the earlier' }, { id: 'none', label: 'Neither is accepted' }] },
      },
      help: {
        hint: 'What did the phone believe was the latest version, and was that still true when its save arrived?',
        walkthrough: [
          { text: 'The laptop reads: v5 is the latest.' },
          { text: 'The phone also reads v5, before the laptop’s save arrives.' },
          { text: 'The laptop saves v6. The phone then saves “v6” too, because its decision used a value that is no longer true.' },
          { text: 'Fix: make the check part of the save (a version check). The second save changes nothing and becomes a conflicted copy.' },
        ],
        solution: [
          { type: 'p', text: 'With last-writer-wins, **both** saves are accepted and the laptop’s edit is silently replaced. A version check accepts exactly one save in every order. The refused device keeps its edit as “report (conflicted copy from phone).docx”.' },
          { type: 'code', lang: 'python', code: 'def commit(db, name, parent, chunks):\n    changed = db.execute(\n        "UPDATE files SET latest = ?, chunks = ? WHERE name = ? AND latest = ?",\n        (parent + 1, chunks, name, parent)).rowcount\n    return changed == 1   # False: client saves a conflicted copy' },
        ],
        why: '“Nobody’s edit is silently overwritten” needs the parent check to be part of the write itself at the metadata store, because a device’s own view may be out of date.',
      },
      lessons: ['concurrent-reservations', 'transactions'],
    },
    {
      id: 'outage', title: 'Metadata service down', intro: 'The interviewer changes one condition. Predict, run it on your design, then revise.',
      question: 'The Metadata service is offline while a laptop saves a file. What does the person see, and what happens to the save?',
      change: { announce: 'New condition: the Metadata service is offline for ten minutes. The laptop has already uploaded its chunks and now tries to save the new version.', rule: RULES.trace, alternate: { announce: 'New condition: the Change notifier is down for ten minutes, so other devices are not told about new versions.', label: 'Replay with the notifier down' } },
      activity: {
        kind: 'trace', request: 'a saved file from the laptop to the metadata database', from: ['laptop'], to: ['metadb', 'phone'], failCandidates: ['meta', 'notify'],
        predict: { q: 'While the Metadata service is down, what does the person at the laptop see?', choices: [{ id: 'error', label: 'An error: the save did not work' }, { id: 'delayed', label: 'The save is accepted; the new version appears later' }, { id: 'ok', label: 'Nothing changes' }] },
      },
      help: {
        hint: 'Is the laptop waiting on the Metadata service, or has something else already accepted the work?',
        walkthrough: [
          { text: 'The chunks are already in Chunk storage, so no bytes are lost.', focus: ['upload', 'blocks'] },
          { text: 'The “new version” request is accepted by the Commit queue, which is still up.', focus: ['commits'] },
          { text: 'It waits there, in order, until Metadata service is back. Then each commit runs its parent check.', focus: ['commits', 'meta'] },
          { text: 'The phone sees the new version only after that, so other devices lag but nothing is lost.', focus: ['notify', 'phone'] },
        ],
        solution: [
          { type: 'list', items: ['Store chunks first, then put the commit in a **durable queue** so it survives the outage.', 'The laptop shows “saved, syncing”; it can keep editing.', 'When Metadata service returns it applies commits in order, each with its **parent check**, so two queued edits still become a version plus a conflicted copy.', 'Without the queue, the save would fail and the client would have to retry on its own.'] },
        ],
        why: '“A saved version is never lost” survives an outage when the commit waits somewhere durable and is still checked against its parent when applied.',
      },
      lessons: ['queues', 'availability', 'retries'],
    },
  ],
  rules: [
    // Design stage
    { id: 'fs-two-paths', stage: 'design', when: { all: [{ link: [{ type: 'upload' }, { type: 'blocks' }], labels: ['writes to', 'reads and writes'] }, { link: [{ type: 'meta' }, { type: 'metadb' }], labels: ['writes to', 'reads and writes'] }] }, ack: 'You keep file bytes in {type:blocks} and the version list in {type:metadb}.', strength: 'You separated file bytes ({type:blocks}) from the version list ({type:metadb}), so a large upload never blocks the version decision.' },
    { id: 'fs-no-blocks', stage: 'design', when: { lacks: { type: 'blocks' } }, coach: 'Chunks need a home. Add Chunk storage and connect Upload service to it.', gap: { text: 'There was no place to keep the file’s chunks.', fix: 'Add Chunk storage keyed by content hash, written by Upload service.', stage: 'design', lesson: 'storage-engines' }, priority: 3 },
    { id: 'fs-connect', stage: 'design', when: { all: [{ has: { type: 'blocks' } }, { not: { path: [{ type: 'laptop' }, { type: 'phone' }] } }] }, coach: 'Connect the whole path: laptop → Upload service → … → Metadata service → Change notifier → phone. Select a part, then “Connect to…”.', priority: 2 },
    { id: 'fs-trace-now', stage: 'design', when: { all: [{ path: [{ type: 'laptop' }, { type: 'phone' }] }, { not: { result: 'trace:save', is: 'ok' } }] }, coach: 'Press “Trace a request” and run “Save report.docx and tell the phone” to see it cross your design.', priority: 1 },
    { id: 'fs-trace-ok', stage: 'design', when: { result: 'trace:save', is: 'ok' }, ack: 'Your save travelled from the laptop to the phone along your arrows.' },
    { id: 'fs-direct-upload', stage: 'design', when: { link: ['client', 'storage'] }, priority: 9, ack: 'The laptop sends chunks straight to {kind:storage}. That is a real approach: the upload skips a hop.', ask: { text: 'With chunks going straight to {kind:storage}, what still has to happen before the file counts as saved?', choices: [
      { id: 'commit', label: 'Metadata service records the new version, only after every chunk is stored', reply: 'Yes. Direct upload moves bytes faster, but the version list is still what other devices read. That is a valid alternative to the reference design, with one fewer service in the upload path.', verdict: 'sound' },
      { id: 'stored', label: 'Nothing: once the chunks are in storage the file is saved', reply: 'Chunks alone are just loose pieces. No version names them, so no other device will ever ask for them.', verdict: 'risky' },
      { id: 'verify', label: 'Something must check the hash of each chunk first', reply: 'Good instinct: a chunk must really match its hash. Storage can verify it on upload, or Metadata service can check before it commits. You still need the commit step.', verdict: 'partial' },
    ] }, strength: 'You proposed direct-to-storage uploads and kept the metadata commit as the moment a file is saved.' },
    { id: 'fs-order', stage: 'design', when: { link: [{ type: 'upload' }, { type: 'commits' }] }, priority: 8, ask: { text: 'The arrow into {type:commits} does not show order. Which comes first: the last chunk reaching {type:blocks}, or the commit entering {type:commits}?', choices: [
      { id: 'chunks-first', label: 'Every chunk is stored first, then the commit is queued', reply: 'Right. A version may only name chunks that already exist, or a phone could be told to fetch something that is not there.', verdict: 'sound' },
      { id: 'commit-first', label: 'Queue the commit first so the news travels sooner', reply: 'The phone could be told about a version whose chunks are still uploading, and its fetch would fail.', verdict: 'risky' },
      { id: 'either', label: 'Either order; the phone retries until the chunks appear', reply: 'It would recover, but the metadata would be wrong for a while and a failed upload would leave a version pointing at nothing. Order the steps instead.', verdict: 'partial' },
    ] }, gap: { text: 'Nothing guaranteed chunks were stored before the version was recorded.', fix: 'Store every chunk first, then queue the commit.', stage: 'design', lesson: 'storage-engines' } },
    { id: 'fs-notify', stage: 'design', when: { link: [{ type: 'meta' }, { type: 'notify' }] }, priority: 6, ask: { text: 'The notifier has told the phone something changed. What should it send?', choices: [
      { id: 'news', label: 'Only “report.docx changed”; the phone then asks for the chunk list and fetches missing chunks', reply: 'Yes. News is tiny. The phone decides what it lacks, so retries and offline phones are easy.', verdict: 'sound' },
      { id: 'file', label: 'The whole file', reply: 'For a 10 GB file that is the cost we avoided with chunks, and the phone may already have most of it.', verdict: 'risky' },
      { id: 'poll', label: 'Nothing; the phone checks every ten minutes', reply: 'That misses “within a few seconds”. Polling can still be the fallback if the notifier fails.', verdict: 'partial' },
    ] }, strength: 'You sent news of a change, not the file, and let each device fetch only the chunks it lacks.' },
    { id: 'fs-parent', stage: 'design', when: { link: [{ type: 'meta' }, { type: 'metadb' }], labels: ['writes to', 'reads and writes'] }, priority: 7, ask: { text: 'An arrow into {type:metadb} does not show what happens when two commits arrive for one file. What should a commit carry so a stale one can be spotted?', choices: [
      { id: 'parent', label: 'The parent version the device started from', reply: 'Yes. If the parent is no longer the latest, someone else saved first. The next stage makes this a version check.', verdict: 'sound' },
      { id: 'clock', label: 'The time on the device’s clock', reply: 'Device clocks disagree, and an offline laptop’s clock can be minutes off. Versions need a number the server controls.', verdict: 'risky' },
      { id: 'nothing', label: 'Nothing; the database sorts it out', reply: 'A database accepts both writes unless you tell it what to check. Add the condition yourself.', verdict: 'risky' },
    ] } },
    { id: 'fs-no-queue', stage: 'design', when: { all: [{ has: { type: 'metadb' } }, { lacks: 'queue' }] }, coach: 'Think ahead: if Metadata service is down when a laptop saves, where does the “new version” request wait?', priority: 1 },
    // Conflict stage
    { id: 'fs-conflict-one', stage: 'conflict', when: { result: 'conflict', is: 'one' }, ack: 'Only one save became v6, in every order you tried. The other was refused instead of overwriting.', strength: 'You made the commit a version check, so a stale edit can never overwrite a newer one.' },
    { id: 'fs-conflict-copy', stage: 'conflict', when: { result: 'conflict', is: 'one' }, priority: 6, ask: { text: 'The phone’s save was refused. What does the person at the phone see?', choices: [
      { id: 'copy', label: 'Their edit saved beside the original as “report (conflicted copy from phone).docx”', reply: 'Yes. Both edits survive, and a person can compare them. No guesswork about whose edit matters.', verdict: 'sound' },
      { id: 'merge', label: 'The server merges the two edits automatically', reply: 'Works for plain text, not for a spreadsheet or a 10 GB video. Merging needs to know the file format, so keep both and let a person decide.', verdict: 'partial' },
      { id: 'discard', label: 'An error, and the edit is dropped', reply: 'That is the lost edit we promised never to cause.', verdict: 'risky' },
    ] } },
    { id: 'fs-conflict-lost', stage: 'conflict', when: { result: 'conflict', is: 'oversold' }, priority: 7, ask: { text: 'Both saves were accepted as v6, so one edit is gone with no warning. How should Metadata service stop that?', choices: [
      { id: 'parent', label: 'Accept a commit only if its parent is still the latest; keep the rest as conflicted copies', reply: 'Yes. The check and the write are one step at the metadata store, so exactly one wins. Switch the guard and run it again.', verdict: 'sound' },
      { id: 'lock', label: 'Lock the file so only one device edits at a time', reply: 'A lock needs a connection, and offline editing was a requirement. It also blocks the phone while the laptop is on a train.', verdict: 'partial' },
      { id: 'newest', label: 'Compare timestamps and keep the newest', reply: 'That is last-writer-wins with extra steps: the older edit still vanishes, and device clocks cannot be trusted.', verdict: 'risky' },
    ] }, gap: { text: 'Two offline edits both became the next version, so one was silently overwritten.', fix: 'Make the commit conditional on the parent version, and save refused edits as conflicted copies.', stage: 'conflict', lesson: 'concurrent-reservations' } },
    // Outage stage
    { id: 'fs-out-error', stage: 'outage', when: { result: 'outage', is: 'error' }, priority: 7, ask: { text: 'With Metadata service offline, the save fails even though the chunks are stored. What would let the save still count?', choices: [
      { id: 'queue', label: 'Put the commit in a durable queue that Metadata service drains when it is back', reply: 'Yes: the laptop is told “saved, syncing”, and nothing waits on the service that is down. Add the queue and run it again.', verdict: 'sound' },
      { id: 'retry', label: 'The laptop retries every second until it works', reply: 'It works eventually, but thousands of laptops retrying together can swamp the service the moment it returns. Add waits that grow, or a queue.', verdict: 'partial' },
      { id: 'later', label: 'Show an error and ask the person to save again later', reply: 'The file is safe on the laptop, but the person must remember to come back. A queue removes that chore.', verdict: 'partial' },
    ] }, gap: { text: 'A metadata outage made saves fail.', fix: 'Queue commits durably so a save is accepted even when Metadata service is down.', stage: 'outage', lesson: 'queues' } },
    { id: 'fs-out-delayed', stage: 'outage', when: { result: 'outage', is: 'delayed' }, ack: 'Your design accepted the commit in {kind:queue} and let it wait for the Metadata service.', strength: 'You kept saves working through a metadata outage by queuing commits behind the chunk upload.' },
    { id: 'fs-out-check', stage: 'outage', when: { result: 'outage', is: 'delayed' }, priority: 8, ask: { text: 'Two queued commits for report.docx both started from v5. When the service returns, how are they applied?', choices: [
      { id: 'checked', label: 'One at a time, in order, each with its parent check; the second becomes a conflicted copy', reply: 'Yes. Being queued does not exempt a commit from the rule. The check runs when it is applied.', verdict: 'sound' },
      { id: 'skip', label: 'Both are applied without checks, since the queue already accepted them', reply: 'Then the second silently replaces the first. Accepting work is not the same as applying it.', verdict: 'risky' },
      { id: 'drop', label: 'The second is dropped', reply: 'Dropping it loses an edit. Keep it as a conflicted copy.', verdict: 'risky' },
    ] } },
    { id: 'fs-out-notify', stage: 'outage', when: { result: 'outage', is: ['delayed', 'error'] }, priority: 3, coach: 'Try the other twist: use “Replay with the notifier down” and see who is affected when the change notifier is the part that fails.' },
    { id: 'fs-out-broken', stage: 'outage', when: { result: 'outage', is: 'broken' }, coach: 'There is no chain of arrows from the laptop to that part. Add the arrows, then run it again.', priority: 4 },
    { id: 'fs-checks', when: { answer: 'fs-parent', is: 'parent' }, strength: 'You made each commit carry its parent version, which is what lets the server notice a stale edit.' },
  ],
  solution: {
    design: g([
      ['laptop', 'laptop', 'client', 'Laptop', 40, 210], ['upload', 'upload', 'service', 'Upload service', 170, 210], ['blocks', 'blocks', 'storage', 'Chunk storage', 310, 70],
      ['commits', 'commits', 'queue', 'Commit queue', 310, 350], ['meta', 'meta', 'service', 'Metadata service', 440, 350], ['metadb', 'metadb', 'db', 'Metadata database', 580, 400],
      ['notify', 'notify', 'service', 'Change notifier', 570, 240], ['phone', 'phone', 'client', 'Phone', 590, 80],
    ], [
      ['laptop', 'upload', 'sends request'], ['upload', 'blocks', 'writes to'], ['upload', 'commits', 'publishes event'], ['commits', 'meta', 'delivers to'],
      ['meta', 'metadb', 'reads and writes'], ['meta', 'notify', 'calls'], ['notify', 'phone', 'calls'], ['phone', 'blocks', 'reads from'], ['phone', 'meta', 'sends request'],
    ]),
    why: {
      laptop: 'Cuts files into chunks, hashes them, and keeps working offline. It remembers which version each edit started from.',
      upload: 'Receives chunks, checks each hash and stores new ones. It queues the commit only after every chunk is stored.',
      blocks: 'Holds every chunk by content hash: identical chunks are stored once, and old versions cost little.',
      commits: 'Accepts “new version” requests durably and in order, so a save works even when Metadata service is down.',
      meta: 'Applies each commit with a parent-version check: one wins, the other becomes a conflicted copy.',
      metadb: 'Source of truth for file versions: name, parent, chunk list. Never names a chunk that is not stored.',
      notify: 'Sends small “changed” news to a user’s other devices. If it fails, devices catch up by asking.',
      phone: 'Hears the news, asks Metadata service for the chunk list, and fetches only the chunks it lacks.',
    },
    alternatives: { upload: { types: ['blocks'], tradeoff: 'Devices can upload straight to Chunk storage with a short-lived permission, saving a hop. You give up a central place to verify hashes and limit rates, so check chunks before the commit.' } },
    trace: { title: 'Laptop saves report.docx; the phone sees it', steps: [
      { from: 'laptop', to: 'upload', text: 'The laptop sends the two chunks the server lacks (a41f…, 9c02…). The other 40 are already stored.' },
      { from: 'upload', to: 'blocks', text: 'Upload service checks each hash and stores the chunks.' },
      { from: 'upload', to: 'commits', text: 'Only now does the laptop’s commit enter the queue: parent v5, chunk list of 42 hashes.' },
      { from: 'commits', to: 'meta', text: 'Metadata service takes the commit in order.' },
      { from: 'meta', to: 'metadb', text: 'UPDATE … WHERE latest = 5 changes one row: report.docx is now v6.' },
      { from: 'meta', to: 'notify', text: 'Metadata service tells the notifier that report.docx changed.' },
      { from: 'notify', to: 'phone', text: 'The phone hears “changed”, fetches the chunk list, then reads the two new chunks from storage.' },
    ] },
    tradeoff: 'Chunking with a version check keeps uploads small and edits safe, but you now manage chunk bookkeeping: counting which chunks any version still uses, and deleting the rest after 30 days.',
    otherApproach: 'For small files, whole-file upload with the same version check is simpler. For people editing the same document at the same time, use a live collaboration design instead of file versions.',
  },
};
