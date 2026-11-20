import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';
import { py } from '../../lessons/_kit';

const st = (states: [string, string, number, number][], trans: [string, string, string][]) => ({
  comps: states.map(([id, label, x, y]) => ({ id, type: id, kind: 'state' as const, label, x, y })),
  links: trans.map(([from, to, label]) => ({ id: `${from}-${to}-${label}`, from, to, label })),
});

export const lldScheduler: InterviewScript = {
  caseId: 'lld-scheduler',
  track: 'lld',
  doLine: 'Draw a task’s life with a retry timer, give each job to an object, then stop two worker threads from running the same due task',
  skills: ['state-machines', 'object-design', 'concurrency'],
  brief: {
    interviewer: { name: 'Tomas', role: 'engineer on the platform team that maintains the in-process scheduler' },
    intro: 'Teams schedule small jobs inside one service: send a reminder at 10:00, refresh a report every hour. I want the objects and states inside that scheduler, not a distributed job system.',
    users: 'Other code in the same process: feature code that schedules tasks, and a pool of worker threads that run them.',
    needs: ['Run each task once its due time has come, earliest first', 'Retry a task that raises, waiting longer each time', 'Report what happened to every task'],
    mustHold: ['A task never runs before its due time', 'A task is in exactly one state at a time', 'A due task is run by exactly one worker at a time', 'One failing task never stops the others'],
    constraints: ['Up to 10,000 pending tasks', 'At most 3 retries, waiting 2 minutes, then 4, then 8', 'Several worker threads take tasks from the same scheduler', 'Time comes from an injected clock, so tests control it'],
    outOfScope: ['Surviving a process restart (tasks live in memory)', 'Running tasks on other machines (that was the distributed scheduler case)'],
    terms: [
      { term: 'backoff', meaning: 'waiting longer after each failed attempt before trying again' },
      { term: 'claim', meaning: 'marking a task as taken so no other worker takes it' },
      { term: 'injected clock', meaning: 'a clock passed into the scheduler, so tests can set the time themselves' },
    ],
    firstMove: 'A task is due at 10:00, fails at 10:01, and should be retried two minutes later. Draw its states and the events between them, then advance the clock and show me where it is at 10:04.',
  },
  palette: [
    { type: 'task-scheduler', kind: 'class', name: 'TaskScheduler', blurb: 'Keeps pending tasks ordered by due time and hands out the next due one.' },
    { type: 'task', kind: 'class', name: 'Task', blurb: 'One job: what to run, when it is due, its state and attempt count.' },
    { type: 'status', kind: 'enum', name: 'TaskState', blurb: 'Scheduled, running, retrying, done or failed.' },
    { type: 'task-worker', kind: 'class', name: 'Worker', blurb: 'Runs one task, catches an exception and reports the outcome.' },
    { type: 'clock', kind: 'iface', name: 'Clock', blurb: 'Supplies the current time; tests use a fake they advance.' },
    { type: 'retry', kind: 'class', name: 'RetryPolicy', blurb: 'Says how long to wait before attempt n and when to give up.' },
  ],
  verbs: ['uses', 'has many', 'creates'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Settle the rules before the classes.',
      question: 'Which rules would you confirm before drawing anything?',
      activity: { kind: 'clarify', questions: [
        { id: 'ties', q: 'Two tasks are due at the same moment. Which goes first?', a: 'The one scheduled first. Insertion order breaks ties.' },
        { id: 'fail', q: 'What happens when a task raises an exception?', a: 'Record the failure, keep running other tasks, and retry up to 3 times with 2, 4 and 8 minute waits.' },
        { id: 'late', q: 'If the service was busy and a task is an hour overdue, what then?', a: 'Run it as soon as a worker is free. It is never skipped.' },
        { id: 'workers', q: 'How many threads run tasks?', a: 'Several. They all take work from the same scheduler.' },
        { id: 'time', q: 'Who decides what time it is?', a: 'An injected clock. Tests move it forward by hand.' },
      ], assumptions: [
        { id: 'poll', q: 'How do workers learn that something is due?', options: [
          { id: 'poll', label: 'They ask the scheduler every second', consequence: 'Simple, but a task can start up to a second late.' },
          { id: 'wake', label: 'They sleep until the earliest due time and are woken early if a sooner task arrives', consequence: 'Precise, but you need a condition variable and more care in tests.' },
        ] },
      ] },
      help: {
        hint: 'What should happen to a task that failed at 10:01?',
        walkthrough: [{ text: 'Tasks run in due-time order; ties keep insertion order.' }, { text: 'A failure is recorded and the scheduler carries on.' }, { text: 'Retries wait 2, 4, 8 minutes, then the task is failed.' }, { text: 'Workers share one scheduler, so taking a task must be safe.' }],
        solution: [{ type: 'list', items: ['Order: due time, then insertion order.', 'Failure: catch per task; retry after 2, 4, 8 minutes; then failed.', 'Overdue tasks still run.', 'Claiming a task is one atomic step.'] }],
        why: 'These rules decide the states and the invariants; classes only carry them.',
      },
      lessons: ['state-machines', 'contracts-invariants'],
    },
    {
      id: 'states', title: 'A task’s life', intro: 'Place the states, name each arrow with its event, then advance the clock to see the retry timer fire.',
      question: 'Draw a task’s states and events. What state is it in at 10:04 when the second attempt succeeds?',
      activity: {
        kind: 'states', entity: 'Task “send-reminder”', initial: 'scheduled',
        states: [
          { key: 'scheduled', label: 'Scheduled', blurb: 'Waiting for its due time.' },
          { key: 'running', label: 'Running', blurb: 'A worker is executing it.' },
          { key: 'retrying', label: 'Retrying', blurb: 'Failed, waiting out its backoff.' },
          { key: 'done', label: 'Done', blurb: 'Succeeded. Final.' },
          { key: 'failed', label: 'Failed', blurb: 'Out of retries. Final.' },
        ],
        events: [{ id: 'start', label: 'start (due)' }, { id: 'succeed', label: 'succeed' }, { id: 'fail', label: 'fail' }, { id: 'retry', label: 'retry (2 min)' }, { id: 'give-up', label: 'give up' }],
        timer: { event: 'retry', after: 2 },
        scenario: [
          { at: 0, event: 'start', label: '10:00 the task is due and a worker starts it', expect: 'running' },
          { at: 1, event: 'fail', label: '10:01 the task raises', expect: 'retrying' },
          { at: 4, event: 'succeed', label: '10:04 the second attempt succeeds', expect: 'done' },
        ],
        starter: st([['scheduled', 'Scheduled', 80, 220], ['running', 'Running', 280, 220]], [['scheduled', 'running', 'start']]),
      },
      help: {
        hint: 'At 10:03 nobody calls anything, yet the task must run again. Which arrow makes that happen?',
        walkthrough: [
          { text: '10:00 due: Scheduled → Running on “start”.' },
          { text: '10:01 it raises: Running → Retrying on “fail”.' },
          { text: '10:03 two minutes pass: Retrying → Running on “retry”. This arrow is timed, so only the clock can take it.' },
          { text: '10:04 it succeeds: Running → Done.' },
        ],
        solution: [
          { type: 'table', head: ['From', 'Event', 'To'], rows: [['Scheduled', 'start', 'Running'], ['Running', 'succeed', 'Done'], ['Running', 'fail', 'Retrying'], ['Retrying', 'retry (after backoff)', 'Running'], ['Running', 'give up (3 retries used)', 'Failed']] },
          { type: 'p', text: 'Without Retrying → Running, a failed task waits forever and the 10:04 success is refused.' },
        ],
        why: 'The brief promises retries; that promise exists only if a timed transition brings the task back.',
      },
      lessons: ['state-machines', 'pattern-state', 'retries'],
    },
    {
      id: 'roles', title: 'Who does what', intro: 'Give each job to one object, then walk a due task through them.',
      question: 'Which object owns each job, and who catches the exception when a task raises?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'scheduler', name: 'TaskScheduler', blurb: 'Pending tasks in due order.' },
          { id: 'task', name: 'Task', blurb: 'What to run, due time, state, attempts.' },
          { id: 'worker', name: 'Worker', blurb: 'Runs one task.' },
          { id: 'clock', name: 'Clock', blurb: 'The current time.' },
        ],
        cards: [
          { id: 'order', text: 'Keep pending tasks ordered by due time, ties by insertion order', owner: 'scheduler', why: 'Only the scheduler sees every pending task.' },
          { id: 'now', text: 'Say what time it is', owner: 'clock', why: 'An injected clock makes time controllable in tests.' },
          { id: 'claim', text: 'Pick the next due task and mark it running in one step', owner: 'scheduler', why: 'Choosing and claiming must be one step, and the scheduler owns the lock around its queue.' },
          { id: 'run', text: 'Run the task’s function and catch an exception', owner: 'worker', why: 'Running is the worker’s job; catching here means one bad task cannot stop the loop.' },
          { id: 'backoff', text: 'Compute the next due time after a failure (2, 4, 8 minutes)', owner: 'task', alt: ['scheduler'], why: 'The attempt count lives on the task, so it can compute its own next due time; the scheduler may own a retry policy instead.' },
          { id: 'record', text: 'Remember attempts and the last error', owner: 'task', why: 'These facts belong to the task, not to whichever worker ran it.' },
        ],
        walk: { title: 'A task due at 10:00 runs', steps: [
          { prompt: 'Who tells us it is 10:00?', owner: 'clock', call: 'clock() → 600.0' },
          { prompt: 'Who finds the earliest due task and claims it?', owner: 'scheduler', call: 'scheduler.take_due(now)' },
          { prompt: 'Who executes the function and catches errors?', owner: 'worker', call: 'worker.run(task)' },
          { prompt: 'Who records the attempt and the next due time if it failed?', owner: 'task', call: 'task.attempts += 1' },
        ] },
      },
      help: {
        hint: 'Put each job next to the data it reads.',
        walkthrough: [
          { text: 'The scheduler holds every pending task, so it orders and claims.', focus: ['scheduler'] },
          { text: 'The worker runs a function and handles its exception.', focus: ['worker'] },
          { text: 'The task remembers its own attempts and next due time.', focus: ['task', 'retry'] },
        ],
        solution: [
          { type: 'code', lang: 'python', code: py('sdm/cases/task_scheduler.py', 'TaskScheduler'), caption: 'python/sdm/cases/task_scheduler.py — tested with pytest' },
          { type: 'p', text: 'The heap keeps the earliest due task on top; the sequence number keeps ties in insertion order. Add a try/except around task() and the failure no longer stalls the loop.' },
        ],
        why: 'Each invariant (never early, ties in order, one bad task is contained) is kept by the object that owns the data.',
      },
      lessons: ['responsibilities', 'cohesion-coupling', 'dependency-injection'],
    },
    {
      id: 'workers', title: 'Two workers', intro: 'The interviewer changes one condition. Predict, run it, revise.',
      question: 'Two worker threads look at the queue at the same instant and both see the same due task. Can both run it?',
      change: { announce: 'New condition: the scheduler now has several worker threads. Worker 1 and Worker 2 both ask for the next task at 10:00 and both see “send-reminder” is due.', rule: RULES.timeline },
      activity: {
        kind: 'timeline', names: ['Worker 1', 'Worker 2'], resource: 'Task “send-reminder” (unclaimed runs left)', initial: 1,
        read: 'sees it is due and unclaimed', write: 'claims it and runs it',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'Look, then claim in a second step', detail: 'Each worker trusts what it saw, even if the other has claimed the task since.', code: 'task = heap[0]\nif task.due <= now:\n    heappop(heap)   # another worker may already have taken it\n    task.run()' },
          { id: 'conditional', label: 'Conditional claim: only if still unclaimed', detail: 'The claim re-checks inside one step: it succeeds only if the task is still scheduled.', code: "UPDATE tasks SET state='running'\nWHERE id=:id AND state='scheduled'" },
          { id: 'lock', label: 'A lock around pick and claim', detail: 'The second worker waits, then sees the task already running.', code: 'with self._lock:\n    task = heappop(heap)\n    task.state = RUNNING' },
        ],
        predict: { q: 'With no guard, how many workers run “send-reminder”?', choices: [{ id: 'one', label: 'One' }, { id: 'both', label: 'Both' }, { id: 'none', label: 'Neither' }] },
      },
      help: {
        hint: 'What stops the second worker from taking a task the first worker already holds?',
        walkthrough: [
          { text: 'Both workers read “due and unclaimed”.' },
          { text: 'Both claim it and both run it, so the reminder is sent twice.' },
          { text: 'Make picking and claiming one step, so the second worker sees “running” and moves on.', focus: ['scheduler', 'status'] },
        ],
        solution: [{ type: 'p', text: 'Take the task and mark it running inside one lock in the scheduler (or, if tasks live in a shared store, a conditional update that succeeds only while the task is still scheduled). The loser gets nothing and asks again for the next task.' }],
        why: '“One worker per due task” is an invariant of the scheduler, so the scheduler must enforce the claim.',
      },
      lessons: ['concurrency-lld', 'testing'],
    },
  ],
  rules: [
    { id: 'retry-missing', stage: 'states', when: { result: 'states', is: 'stuck' }, priority: 6, ask: { text: 'At 10:04 the second attempt could not succeed, because your task was not running. What should have happened at 10:03?', choices: [
      { id: 'timer', label: 'Retrying → Running on “retry”, two minutes after the failure', reply: 'Yes. Draw the timed arrow and advance the clock again.', verdict: 'sound' },
      { id: 'manual', label: 'Someone calls start again by hand', reply: 'Then retries depend on a caller remembering. The scheduler should own the backoff.', verdict: 'risky' },
    ] }, gap: { text: 'A failed task never came back, so retries were never enforced.', fix: 'Add Retrying → Running on “retry” (timed) and replay the clock.', stage: 'states', lesson: 'state-machines' } },
    { id: 'states-ok', stage: 'states', when: { result: 'states', is: 'pass' }, ack: 'Your machine retried the task on the timer and ended in Done at 10:04.', strength: 'Your task state machine brought a failed task back by a timed arrow, so retries do not rely on a caller.' },
    { id: 'states-coach', stage: 'states', when: { all: [] }, coach: 'Start with the happy path: Scheduled → Running → Done. Then ask what happens to a task that raises.' },
    { id: 'final-states', stage: 'states', when: { result: 'states', is: 'pass' }, priority: 4, ask: { text: 'Retrying → Running repeats forever in your diagram unless something stops it. Where does the “three retries” limit live?', choices: [
      { id: 'guard', label: 'A guard on the transition: back to Running only while attempts < 3, otherwise give up to Failed', reply: 'Right. The limit is a rule of the transition, so the Task or RetryPolicy checks it and the diagram needs a Failed state.', verdict: 'sound' },
      { id: 'caller', label: 'In whatever code schedules the task', reply: 'Then different callers could use different limits and the scheduler cannot promise three.', verdict: 'risky' },
      { id: 'none', label: 'It does not need one, failures are rare', reply: 'A task that always raises would retry forever and take a worker each time.', verdict: 'risky' },
    ] } },
    { id: 'guard-strength', when: { answer: 'final-states', is: 'guard' }, strength: 'You put the retry limit on the transition, so a task that always fails ends in Failed.' },
    { id: 'roles-good', stage: 'roles', when: { result: 'roles', is: 'pass' }, ack: 'Ordering and claiming sit in the scheduler, running in the worker and attempts in the task.', strength: 'You put each responsibility where its data lives (TaskScheduler orders, Worker runs, Task remembers).' },
    { id: 'roles-gap', stage: 'roles', when: { result: 'roles', is: 'gaps' }, priority: 4, gap: { text: 'Some jobs were given to objects that do not own the data they need.', fix: 'Reassign the cards marked “reconsider” and walk the due task again.', stage: 'roles', lesson: 'responsibilities' } },
    { id: 'roles-catch', stage: 'roles', when: { result: 'roles', is: 'pass' }, priority: 3, ask: { text: 'You catch the exception in the worker. Another valid design catches it inside the scheduler loop. What is the difference?', choices: [
      { id: 'worker', label: 'In the worker, each worker survives and reports; the scheduler stays simple', reply: 'Yes. It also lets different workers log differently. The scheduler only sees the outcome.', verdict: 'sound' },
      { id: 'loop', label: 'In the scheduler loop, one place handles every failure the same way', reply: 'Also valid for a single-threaded scheduler. With many workers you would need the catch in each worker thread anyway.', verdict: 'partial' },
      { id: 'neither', label: 'Neither, let the exception crash the thread', reply: 'A crashed worker stops running tasks, and the task would stay stuck in Running.', verdict: 'risky' },
    ] } },
    { id: 'workers-fixed', stage: 'workers', when: { result: 'workers', is: 'one' }, ack: 'With the claim as one step, only one worker ran the task.', strength: 'You made picking and claiming one step, so a due task runs exactly once.' },
    { id: 'workers-over', stage: 'workers', when: { result: 'workers', is: 'oversold' }, priority: 6, ask: { text: 'Both workers ran “send-reminder”. Where must the claim happen?', choices: [
      { id: 'claim', label: 'Inside the scheduler, as one lock or one conditional claim', reply: 'Yes. Apply the guard and run the same order again.', verdict: 'sound' },
      { id: 'dedupe', label: 'Let both run it and make the task idempotent', reply: 'That can work for safe tasks, and is worth having too, but the scheduler still wastes work and cannot promise one run.', verdict: 'partial' },
      { id: 'stagger', label: 'Start Worker 2 a few milliseconds later', reply: 'Timing luck is not a guarantee.', verdict: 'risky' },
    ] }, gap: { text: 'Two workers could run the same due task.', fix: 'Pick and claim under one lock, or with a conditional claim, and rerun.', stage: 'workers', lesson: 'concurrency-lld' } },
    { id: 'workers-crash', stage: 'workers', when: { result: 'workers', is: 'one' }, priority: 3, ask: { text: 'The timeline shows the claim. It does not show what happens if Worker 1 claims the task and then crashes. What should the design say?', choices: [
      { id: 'lease', label: 'Claims expire: if a running task is not finished by a deadline, it returns to Scheduled', reply: 'Yes. A claim with a deadline stops a crashed worker from holding a task forever.', verdict: 'sound' },
      { id: 'never', label: 'Nothing. The claim is permanent', reply: 'Then the task never runs again and nobody notices.', verdict: 'risky' },
    ] } },
  ],
  solution: {
    design: {
      comps: [
        { id: 'clock', type: 'clock', kind: 'iface', label: 'Clock', x: 90, y: 110 },
        { id: 'scheduler', type: 'task-scheduler', kind: 'class', label: 'TaskScheduler', x: 300, y: 200 },
        { id: 'worker', type: 'task-worker', kind: 'class', label: 'Worker', x: 540, y: 110 },
        { id: 'task', type: 'task', kind: 'class', label: 'Task', x: 540, y: 290 },
        { id: 'status', type: 'status', kind: 'enum', label: 'TaskState', x: 330, y: 380 },
        { id: 'retry', type: 'retry', kind: 'class', label: 'RetryPolicy', x: 90, y: 320 },
      ],
      links: [
        { id: 's-c', from: 'scheduler', to: 'clock', label: 'uses' }, { id: 's-t', from: 'scheduler', to: 'task', label: 'has many' },
        { id: 's-w', from: 'scheduler', to: 'worker', label: 'uses' }, { id: 't-st', from: 'task', to: 'status', label: 'uses' },
        { id: 't-r', from: 'task', to: 'retry', label: 'uses' },
      ],
    },
    why: {
      clock: 'An interface so tests advance time instead of waiting.',
      scheduler: 'Orders pending tasks, claims the next due one under a lock, and puts retries back.',
      worker: 'Runs one task, catches its exception and reports success or failure.',
      task: 'Holds the function, due time, state and attempt count.',
      status: 'Scheduled, running, retrying, done, failed: the only states a task can be in.',
      retry: 'Backoff of 2, 4 and 8 minutes and the limit of three, in one place.',
    },
    alternatives: {
      retry: { types: ['task'], tradeoff: 'Putting the backoff arithmetic on the Task is simpler for one policy; a separate RetryPolicy helps when tasks need different policies.' },
    },
    trace: { title: 'A task due at 10:00 runs and fails once', steps: [
      { from: 'scheduler', to: 'clock', text: 'now = clock(): 10:00.' },
      { from: 'scheduler', to: 'task', text: 'Under the lock, take the earliest task with due <= now and mark it running. Another worker now sees it as running.' },
      { from: 'scheduler', to: 'worker', text: 'worker.run(task): the function is called inside try/except.' },
      { from: 'worker', to: 'task', text: 'It raises: attempts becomes 1 and the task moves Running → Retrying.' },
      { from: 'task', to: 'retry', text: 'The policy says wait 2 minutes, so the task is due again at 10:03.' },
      { from: 'task', to: 'status', text: 'At 10:03 the scheduler claims it again: Retrying → Running.' },
    ] },
    tradeoff: 'A heap and one lock are simple and fast for thousands of tasks; one lock makes every worker queue to claim, which is fine because claiming takes microseconds.',
    otherApproach: 'If tasks must survive a restart or run on many machines, keep them in a database or queue and claim with a conditional update, as in the distributed scheduler case.',
  },
};
