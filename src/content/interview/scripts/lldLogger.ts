import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';
import { py } from '../../lessons/_kit';

export const lldLogger: InterviewScript = {
  caseId: 'lld-logger',
  track: 'lld',
  doLine: 'Give each logging job to an object, choose what to do when the disk slows and the log buffer fills, then add a destination without touching callers',
  skills: ['object-design', 'capacity', 'concurrency'],
  brief: {
    interviewer: { name: 'Dana', role: 'engineer who maintains the shared logging library' },
    intro: 'Every service in the company calls our logger thousands of times a second. I want to see which objects make up a logging library, and what it does when it is the thing that falls behind.',
    users: 'Other code: request handlers in many services, calling the logger from many threads at once.',
    needs: ['Log a message with a level and a few fields such as seat=F12', 'Write each line to one or more destinations, such as the console and a file', 'Skip messages below a configured level cheaply'],
    mustHold: ['Lines from different threads never interleave', 'A hidden level costs almost nothing (no formatting)', 'Slow logging never takes down the request it is describing'],
    constraints: ['Levels DEBUG < INFO < WARNING < ERROR', 'About 800 lines a second per process, many threads', 'A destination may be slow: a disk can fall to a quarter of its speed for half a minute', 'Callers must not change when a destination is added'],
    outOfScope: ['Searching or storing logs centrally', 'Log rotation and retention'],
    terms: [
      { term: 'sink', meaning: 'a destination that accepts finished lines, such as the console or a file' },
      { term: 'level filter', meaning: 'the check that drops a message whose level is below the configured minimum' },
      { term: 'backpressure', meaning: 'the effect of a slow consumer on the producers that feed it, such as request threads waiting on a disk' },
    ],
    firstMove: 'A handler logs an ERROR and it must reach both the console and a file. Tell me which object checks the level, which formats the line, and which writes it.',
  },
  palette: [
    { type: 'logger', kind: 'class', name: 'Logger', blurb: 'Called by application code: filters by level, formats once, hands lines to sinks.' },
    { type: 'level', kind: 'enum', name: 'Level', blurb: 'DEBUG, INFO, WARNING, ERROR, in order.' },
    { type: 'sink', kind: 'iface', name: 'Sink', blurb: 'The promise write(line); every destination keeps it.' },
    { type: 'file-sink', kind: 'class', name: 'FileSink', blurb: 'Appends lines to a file.' },
    { type: 'console-sink', kind: 'class', name: 'ConsoleSink', blurb: 'Prints lines to standard output.' },
    { type: 'async-sink', kind: 'class', name: 'AsyncSink', blurb: 'Wraps another sink with a bounded buffer and a background writer.' },
    { type: 'caller', kind: 'class', name: 'RequestHandler', blurb: 'Application code that calls log() while serving a request.' },
  ],
  verbs: ['uses', 'has many', 'implements'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Settle the rules before drawing classes.',
      question: 'Which rules would you confirm before writing a class?',
      activity: { kind: 'clarify', questions: [
        { id: 'levels', q: 'What levels exist and what is the default?', a: 'DEBUG < INFO < WARNING < ERROR. The default minimum is INFO.' },
        { id: 'dest', q: 'Where do lines go?', a: 'To one or more destinations at once, such as the console and a file. Callers do not choose; configuration does.' },
        { id: 'threads', q: 'Is the logger called from many threads?', a: 'Yes. A single line must never be mixed with another thread’s line.' },
        { id: 'fields', q: 'Are messages plain text?', a: 'A message plus key=value fields, such as seat=F12, formatted into one line.' },
        { id: 'slow', q: 'What if a destination is slow?', a: 'Logging must not stall a request. We will decide the policy for a full buffer together.' },
      ], assumptions: [
        { id: 'lost', q: 'If the logger must lose something, which lines may it lose?', options: [
          { id: 'debug', label: 'Low-level lines first: keep ERROR and WARNING', consequence: 'Needs a policy that looks at the level when the buffer is full.' },
          { id: 'none', label: 'None: every line must be written', consequence: 'Then a slow disk must slow the callers, which breaks “never take down the request”.' },
        ] },
      ] },
      help: {
        hint: 'What should happen to a DEBUG line when nobody asked to see DEBUG?',
        walkthrough: [{ text: 'Levels are ordered; lines below the minimum are dropped before formatting.' }, { text: 'One line goes to every configured destination.' }, { text: 'Threads share the logger, so a write is one uninterrupted step.' }, { text: 'A slow destination needs a policy, because logging cannot stall a request.' }],
        solution: [{ type: 'list', items: ['Filter by level first; format only what survives.', 'Fan out to every destination.', 'Lines never interleave.', 'A policy for a full buffer, decided in the capacity stage.'] }],
        why: 'These rules shape the objects: who filters, who formats, who writes, and what happens when writing is slow.',
      },
      lessons: ['contracts-invariants', 'concurrency-lld'],
    },
    {
      id: 'roles', title: 'Who does what', intro: 'Give each job to one object, then follow one ERROR line to its destinations.',
      question: 'Which object owns each job, and who knows how to write to a file?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'caller', name: 'RequestHandler', blurb: 'Application code calling log().' },
          { id: 'logger', name: 'Logger', blurb: 'log(level, message, **fields).' },
          { id: 'sink', name: 'Sink', blurb: 'write(line) — one per destination.' },
          { id: 'file-sink', name: 'FileSink', blurb: 'Appends to a file.' },
        ],
        cards: [
          { id: 'level', text: 'Decide that a DEBUG line is below the minimum and drop it before formatting', owner: 'logger', why: 'The logger knows the configured level and can stop work early.' },
          { id: 'format', text: 'Turn message and fields into one line, once', owner: 'logger', alt: ['sink'], why: 'Formatting once in the logger avoids repeating it per destination; a formatter per sink is valid if destinations need different formats.' },
          { id: 'order', text: 'Stop two threads’ lines from interleaving', owner: 'logger', why: 'The logger sees every destination and holds the lock around the whole fan-out.' },
          { id: 'file', text: 'Open the file and append a line', owner: 'file-sink', why: 'Only this destination knows files exist.' },
          { id: 'what', text: 'Choose what to say and at which level', owner: 'caller', why: 'The application knows what happened; the library should not guess.' },
          { id: 'contract', text: 'Promise that every destination accepts write(line)', owner: 'sink', why: 'The interface lets the logger treat all destinations the same.' },
        ],
        walk: { title: 'Log an ERROR to the file and the console', steps: [
          { prompt: 'Who decides this is worth logging and at which level?', owner: 'caller', call: 'logger.log("ERROR", "payment failed", seat="F12")' },
          { prompt: 'Who checks ERROR against the minimum level and builds the line?', owner: 'logger', call: 'line = "ERROR payment failed seat=F12"' },
          { prompt: 'Who is promised write(line) by every destination?', owner: 'sink', call: 'for sink in self.sinks: sink.write(line)' },
          { prompt: 'Who actually appends to the file?', owner: 'file-sink', call: 'file.write(line + "\\n")' },
        ] },
      },
      help: {
        hint: 'Which object can change without the callers noticing?',
        walkthrough: [
          { text: 'The logger filters, formats and locks; callers only name a level and a message.', focus: ['logger', 'level'] },
          { text: 'Every destination hides behind the same interface.', focus: ['sink'] },
          { text: 'FileSink and ConsoleSink each know one thing: how to write.', focus: ['file', 'console'] },
        ],
        solution: [
          { type: 'code', lang: 'python', code: py('sdm/cases/logger.py', 'Logger'), caption: 'python/sdm/cases/logger.py — tested with pytest' },
          { type: 'p', text: 'The level check comes first, so a hidden DEBUG line costs one comparison. The lock covers the whole fan-out, so lines never interleave.' },
        ],
        why: 'Each rule (cheap hidden levels, no interleaving, pluggable outputs) sits with the object that has the data to enforce it.',
      },
      lessons: ['responsibilities', 'cohesion-coupling', 'pattern-strategy'],
    },
    {
      id: 'capacity', title: 'A slow disk', intro: 'The interviewer changes one condition. Predict, run it, revise.',
      question: 'The file sink’s disk slows to a quarter of its speed for 30 seconds. What should the logger do when its buffer fills?',
      change: { announce: 'New condition: at 10:00 the disk behind FileSink slows to a quarter of its speed for half a minute, while request threads keep logging 800 lines a second.', rule: RULES.queue },
      activity: {
        kind: 'queue', what: 'log lines waiting for the file writer',
        arrival: [100, 800, 2000], workers: [1, 1, 4], serviceMs: 1,
        slow: { from: 10, to: 40, serviceMs: 4, what: 'the disk slows to a quarter of its speed' },
        timeoutS: 2,
        policies: [
          { id: 'wait', label: 'Block: callers wait for room', detail: 'Every request thread that logs waits for the writer. Nothing is lost, but request latency follows the disk.' },
          { id: 'shed', label: 'Drop: refuse lines past a limit', detail: 'The buffer holds about two seconds of lines; newer lines beyond that are dropped (ideally DEBUG first), so callers never wait.' },
          { id: 'breaker', label: 'Fall back: stop using the slow disk', detail: 'While the disk is slow, skip it and keep ERROR lines on the console; resume when it recovers.' },
        ],
      },
      help: {
        hint: 'What matters more here: a request thread that never waits, or every DEBUG line being kept?',
        walkthrough: [
          { text: 'Lines arrive at 800 a second; the slowed disk finishes 250 a second, so about 550 lines a second pile up.' },
          { text: 'If callers wait, the pile becomes request latency: the log slows the service it describes.' },
          { text: 'A bounded buffer plus a drop rule keeps callers fast and loses the least important lines.', focus: ['async'] },
        ],
        solution: [
          { type: 'p', text: 'Put an AsyncSink in front of the file: log() enqueues and returns; a background thread writes. Bound the queue (about two seconds of lines) and, when it is full, drop DEBUG and INFO first and keep WARNING and ERROR. Count what was dropped and log the count once the disk recovers.' },
        ],
        why: 'The brief says logging must never take down the request, so the buffer must be bounded and a full buffer must never block callers.',
      },
      lessons: ['backpressure', 'queues', 'pattern-decorator'],
    },
    {
      id: 'destination', title: 'A new destination', intro: 'A team wants ERROR lines sent to a remote log service. Decide which objects change.',
      question: 'Which object owns each job when a remote destination is added, and which code does not change at all?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'caller', name: 'RequestHandler', blurb: 'Calls log() in hundreds of places.' },
          { id: 'logger', name: 'Logger', blurb: 'Filters, formats, fans out.' },
          { id: 'sink', name: 'Sink', blurb: 'write(line)' },
          { id: 'remote', name: 'RemoteSink', blurb: 'New: sends lines to the log service.' },
          { id: 'async', name: 'AsyncSink', blurb: 'Buffers a slow sink.' },
        ],
        cards: [
          { id: 'call', text: 'Call log("ERROR", …) in the checkout code', owner: 'caller', why: 'Callers already use the Logger’s interface; adding a destination must not change a single call.' },
          { id: 'send', text: 'Know how to send a line over the network to the service', owner: 'remote', why: 'Network details belong to the one class that writes remotely.' },
          { id: 'accept', text: 'Accept the remote destination like any other', owner: 'sink', why: 'Because RemoteSink keeps the write(line) promise, the logger needs no new code path.' },
          { id: 'buffer', text: 'Keep a slow network from stalling request threads', owner: 'async', alt: ['remote'], why: 'Wrapping the remote sink in the same buffer used for the file reuses the policy; RemoteSink could buffer itself, at the cost of repeating it.' },
          { id: 'fanout', text: 'Send each line to the new destination as well', owner: 'logger', why: 'The logger already loops over its list of sinks; the only change is adding one to the list when it is built.' },
        ],
        walk: { title: 'ERROR reaches the console, the file and the remote service', steps: [
          { prompt: 'Whose code is unchanged?', owner: 'caller', call: 'logger.log("ERROR", "payment failed", seat="F12")' },
          { prompt: 'Who loops over every destination?', owner: 'logger', call: 'for sink in self.sinks: sink.write(line)' },
          { prompt: 'Who protects the request from a slow network?', owner: 'async', call: 'queue.put_nowait(line)' },
          { prompt: 'Who does the network call?', owner: 'remote', call: 'http.post(url, line)' },
        ] },
      },
      help: {
        hint: 'If you add a class and edit a list but change no caller, you are on the right track.',
        walkthrough: [
          { text: 'RemoteSink implements Sink, so the logger treats it like FileSink.', focus: ['sink', 'file'] },
          { text: 'Wrap it in AsyncSink so the earlier buffer policy applies to it too.', focus: ['async'] },
          { text: 'Add it to the logger’s list of sinks where the logger is built; nothing else changes.', focus: ['logger'] },
        ],
        solution: [{ type: 'p', text: 'Write RemoteSink with write(line), wrap it in AsyncSink, and add it to the Logger’s sink list at start-up. No caller, no filter, no formatter changes. This is the Decorator idea: the wrapper keeps the same interface as what it wraps.' }],
        why: 'A single stable interface (Sink) lets destinations vary without any caller knowing.',
      },
      lessons: ['pattern-decorator', 'pattern-observer', 'dependency-injection'],
    },
  ],
  rules: [
    { id: 'roles-coach', stage: 'roles', when: { all: [] }, coach: 'Follow one line: who is called first, who drops or keeps it, who writes it. Each answer is a different object.' },
    { id: 'roles-good', stage: 'roles', when: { result: 'roles', is: 'pass' }, ack: 'The logger filters, formats and locks; each sink only writes.', strength: 'You kept destinations behind one interface and gave filtering and formatting to the Logger.' },
    { id: 'roles-gap', stage: 'roles', when: { result: 'roles', is: 'gaps' }, priority: 4, gap: { text: 'Some jobs were given to objects that do not own the data they need.', fix: 'Reassign the cards marked “reconsider” and follow the ERROR line again.', stage: 'roles', lesson: 'responsibilities' } },
    { id: 'fmt-where', stage: 'roles', when: { result: 'roles', is: 'pass' }, priority: 4, ask: { text: 'You format the line in the Logger. Another valid design gives each sink its own formatter. What does each choice cost?', choices: [
      { id: 'once', label: 'Format once in the Logger: cheaper, but every destination gets the same text', reply: 'Right. That is the common case, and one formatted line is also easy to test.', verdict: 'sound' },
      { id: 'each', label: 'A formatter per sink: JSON for the file, plain text for the console, at the cost of formatting more than once', reply: 'Also sound. You pay extra work per line, so keep the level check first.', verdict: 'sound' },
      { id: 'caller', label: 'Let callers format their own lines', reply: 'Then every caller formats even hidden DEBUG lines, and formats drift apart.', verdict: 'risky' },
    ] } },
    { id: 'lock-where', stage: 'roles', when: { result: 'roles', is: 'pass' }, priority: 3, ask: { text: 'The lock keeps lines from interleaving. A slow sink holds it while it writes. What does that do to the other threads?', choices: [
      { id: 'wait', label: 'They all wait behind the slow sink, which is why the next stage adds a buffer', reply: 'Yes. A simple lock is correct but ties every caller to the slowest destination.', verdict: 'sound' },
      { id: 'fine', label: 'Nothing, the lock is fast', reply: 'The lock is fast only if the work inside it is. A disk write inside the lock is not.', verdict: 'risky' },
    ] } },
    { id: 'cap-bounded', stage: 'capacity', when: { result: 'capacity', is: ['shed:bounded', 'breaker:bounded'] }, ack: 'With that policy the buffer stayed bounded while the disk was slow.', strength: 'You chose a policy that bounds the buffer, so a slow disk cannot slow the requests.' },
    { id: 'cap-wait', stage: 'capacity', when: { result: 'capacity', is: 'wait:unbounded' }, priority: 6, ask: { text: 'With blocking, waits kept growing for the whole slow period. Request threads were stuck behind the disk. What is the cost of that?', choices: [
      { id: 'latency', label: 'Request latency now follows the disk, so logging slows the service it describes', reply: 'Yes. Blocking is right only if losing a line is worse than a slow request, which the brief says it is not.', verdict: 'sound' },
      { id: 'none', label: 'None, nothing is lost', reply: 'Nothing is lost in the log, but the requests that were stuck may have timed out. That is the loss.', verdict: 'risky' },
    ] }, gap: { text: 'Blocking callers on a slow disk makes every request wait for the log.', fix: 'Bound the buffer and drop low-level lines when it is full.', stage: 'capacity', lesson: 'backpressure' } },
    { id: 'cap-drop', stage: 'capacity', when: { result: 'capacity', is: 'shed:bounded' }, priority: 5, ask: { text: 'Dropping keeps callers fast. Which lines should be dropped first, and how will anyone know it happened?', choices: [
      { id: 'level', label: 'DEBUG and INFO first, keep ERROR, and count the drops and report them after recovery', reply: 'Yes. A silent drop is its own incident, so make the loss visible.', verdict: 'sound' },
      { id: 'newest', label: 'Always drop the newest line, with no record', reply: 'The newest line may be the ERROR you needed, and nobody would know lines were lost.', verdict: 'risky' },
      { id: 'sample', label: 'Keep one in ten lines of every level while the buffer is full', reply: 'Sampling is valid for high-volume DEBUG and INFO, but keep every ERROR; a sampled error is a missing error.', verdict: 'partial' },
    ] } },
    { id: 'cap-fallback', stage: 'capacity', when: { result: 'capacity', is: 'breaker:bounded' }, priority: 4, ask: { text: 'Falling back to the console avoids the slow disk entirely. What does the diagram not show that you must decide?', choices: [
      { id: 'recover', label: 'How the logger notices the disk is healthy again, and what happens to lines written in the meantime', reply: 'Yes. A fallback needs a way back and a statement about what was skipped.', verdict: 'sound' },
      { id: 'nothing', label: 'Nothing, it switches back by itself', reply: 'Something has to detect recovery, such as a periodic test write.', verdict: 'risky' },
    ] } },
    { id: 'dest-ok', stage: 'destination', when: { result: 'destination', is: 'pass' }, ack: 'The new destination arrived as one class and a longer sink list; no caller changed.', strength: 'You added a destination by implementing the Sink interface, so no existing caller changed.' },
    { id: 'dest-gap', stage: 'destination', when: { result: 'destination', is: 'gaps' }, priority: 4, gap: { text: 'Adding a destination touched code that should not need to change.', fix: 'Keep the Logger’s loop over Sink and add the new class behind the interface.', stage: 'destination', lesson: 'pattern-decorator' } },
    { id: 'dest-wrap', stage: 'destination', when: { result: 'destination', is: 'pass' }, priority: 3, ask: { text: 'RemoteSink fails for ten seconds and write() raises an exception. The Logger loops over every sink. What should happen to the file and console writes?', choices: [
      { id: 'isolate', label: 'Catch the failure per sink, so the others still write and the failure is counted', reply: 'Yes. One broken destination must not silence the rest, and the failure should not reach the request.', verdict: 'sound' },
      { id: 'raise', label: 'Let it raise, the caller will handle it', reply: 'Then a log call can fail a request, and the file and console writes after it are skipped.', verdict: 'risky' },
      { id: 'retry', label: 'Retry the remote write inside the loop until it works', reply: 'That blocks every other line behind it. Retry in the background buffer, not the caller’s thread.', verdict: 'partial' },
    ] } },
    { id: 'isolate-strength', when: { answer: 'dest-wrap', is: 'isolate' }, strength: 'You isolated sink failures so one broken destination cannot silence the others or fail a request.' },
  ],
  solution: {
    design: {
      comps: [
        { id: 'caller', type: 'caller', kind: 'class', label: 'RequestHandler', x: 70, y: 200 },
        { id: 'logger', type: 'logger', kind: 'class', label: 'Logger', x: 250, y: 200 },
        { id: 'level', type: 'level', kind: 'enum', label: 'Level', x: 250, y: 380 },
        { id: 'sink', type: 'sink', kind: 'iface', label: 'Sink', x: 430, y: 200 },
        { id: 'console', type: 'console-sink', kind: 'class', label: 'ConsoleSink', x: 590, y: 80 },
        { id: 'async', type: 'async-sink', kind: 'class', label: 'AsyncSink', x: 590, y: 220 },
        { id: 'file', type: 'file-sink', kind: 'class', label: 'FileSink', x: 590, y: 360 },
      ],
      links: [
        { id: 'c-l', from: 'caller', to: 'logger', label: 'uses' }, { id: 'l-lv', from: 'logger', to: 'level', label: 'uses' },
        { id: 'l-s', from: 'logger', to: 'sink', label: 'has many' }, { id: 'con-s', from: 'console', to: 'sink', label: 'implements' },
        { id: 'a-s', from: 'async', to: 'sink', label: 'implements' }, { id: 'f-s', from: 'file', to: 'sink', label: 'implements' },
        { id: 'a-f', from: 'async', to: 'file', label: 'uses' },
      ],
    },
    why: {
      caller: 'Names what happened and its level; knows nothing about destinations.',
      logger: 'Checks the level first, formats once, and writes to each sink under a lock.',
      level: 'Ordered levels, so “below the minimum” is one comparison.',
      sink: 'The one promise every destination keeps: write(line).',
      console: 'Prints lines; fast, so it needs no buffer.',
      async: 'Wraps a slow sink with a bounded buffer and a background writer; drops low levels when full.',
      file: 'Appends lines to a file; the slow destination behind the buffer.',
    },
    alternatives: {
      async: { types: ['file-sink'], tradeoff: 'FileSink could buffer itself, which is simpler for one destination but repeats the buffer logic for every slow sink.' },
    },
    trace: { title: 'Log an ERROR to the console and the file', steps: [
      { from: 'caller', to: 'logger', text: 'log("ERROR", "payment failed", seat="F12").' },
      { from: 'logger', to: 'level', text: 'ERROR is not below the minimum, so the line is built once: "ERROR payment failed seat=F12".' },
      { from: 'logger', to: 'console', text: 'Under the lock, the console sink prints the line.' },
      { from: 'logger', to: 'async', text: 'The async sink puts the line in its bounded buffer and returns at once.' },
      { from: 'async', to: 'file', text: 'The background writer appends the line to the file, at the disk’s own speed.' },
    ] },
    tradeoff: 'A bounded buffer keeps request threads fast but can drop lines; blocking loses nothing but ties request latency to the slowest destination.',
    otherApproach: 'For very high volume, sample DEBUG and INFO at the source or use a structured, batched shipper to a central service; for a small tool, a single synchronous sink with one lock is enough.',
  },
};
