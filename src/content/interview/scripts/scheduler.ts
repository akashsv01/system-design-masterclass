import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});
const st = (states: [string, string, number, number][], trans: [string, string, string][]) => ({
  comps: states.map(([id, label, x, y]) => ({ id, type: id, kind: 'state' as const, label, x, y })),
  links: trans.map(([from, to, label]) => ({ id: `${from}-${to}-${label}`, from, to, label })),
});

export const scheduler: InterviewScript = {
  caseId: 'case-scheduler',
  track: 'hld',
  doLine: 'Design a job scheduler: run a job due at 09:00 on a worker, recover from a crashed worker with a lease, then make a repeated run safe',
  skills: ['reliability', 'state-machines', 'messaging', 'architecture'],
  brief: {
    interviewer: { name: 'Dana', role: 'platform engineer who owns our internal scheduler' },
    intro: 'Teams across the company ask us to run things later: send this email at 09:00, rebuild that report every night. Today a single server does it, and when it dies, jobs silently do not run.',
    users: 'Engineers on other teams who schedule jobs through an API, and the jobs’ downstream effects (emails, reports, clean-ups).',
    needs: ['Schedule a job to run once at a time, or on a repeating schedule', 'Each job runs on a worker at (about) its time', 'See whether a job is scheduled, running, done or failed'],
    mustHold: ['A due job is never silently skipped', 'A job whose worker crashes still runs', 'A job’s effect happens once, even if the job itself runs twice'],
    constraints: ['10 million scheduled jobs', 'Up to 20,000 jobs due in a single second at peaks (for example, 09:00)', 'Jobs should start within a few seconds of their time', 'Workers can crash at any moment, including halfway through a job'],
    outOfScope: ['Time-zone and daylight-saving rules for repeating schedules', 'Job priorities and fair sharing between teams', 'Writing the jobs themselves'],
    terms: [
      { term: 'lease', meaning: 'a claim on a job that expires unless the worker keeps renewing it; if the worker dies, the claim runs out and someone else can take the job' },
      { term: 'heartbeat', meaning: 'a small repeated message from a worker saying “still working on it”, which renews its lease' },
      { term: 'at-least-once', meaning: 'a job may run more than once but is never skipped' },
      { term: 'idempotent', meaning: 'safe to repeat: doing it twice has the same effect as doing it once' },
    ],
    firstMove: 'Jobs are stored with the time they are due. Show me how a job due at 09:00 gets from storage to a worker, and which part decides it is time.',
  },
  palette: [
    { type: 'owner', kind: 'client', name: 'Calling team', blurb: 'Another team’s service. It asks the scheduler to run a job at a time.' },
    { type: 'api', kind: 'service', name: 'Scheduler API', blurb: 'Accepts new jobs and answers status questions. Stores nothing itself.' },
    { type: 'jobs', kind: 'db', name: 'Job store', blurb: 'One row per job: due time, state (scheduled, running, done, failed), attempts. Indexed by due time.' },
    { type: 'poller', kind: 'scheduler', name: 'Due-job poller', blurb: 'Repeatedly looks for jobs whose time has come and claims them. Each poller handles one slice of the jobs.' },
    { type: 'ready', kind: 'queue', name: 'Ready queue', blurb: 'Holds claimed jobs until a worker is free.' },
    { type: 'workers', kind: 'worker', name: 'Workers', blurb: 'Take a job from the queue, take a lease, do the work and report the result. They can crash.' },
    { type: 'leases', kind: 'db', name: 'Lease store', blurb: 'Records which worker holds which job and when its lease expires.' },
    { type: 'target', kind: 'ext', name: 'Target service', blurb: 'What the job acts on, such as an email provider. Not owned by the scheduler.' },
    { type: 'dead', kind: 'queue', name: 'Dead-letter queue', blurb: 'Holds jobs that failed too many times so a person can look at them.' },
  ],
  verbs: ['sends request', 'reads from', 'writes to', 'reads and writes', 'publishes event', 'delivers to', 'triggers', 'calls'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'precision', q: 'How exact must start times be?', a: 'Within a few seconds. A job due at 09:00 starting at 09:00:03 is fine.' },
          { id: 'peak', q: 'How many jobs are due at once?', a: 'Up to 20,000 in a single second at busy moments such as 09:00, out of 10 million scheduled jobs.' },
          { id: 'crash', q: 'Can a worker crash while running a job?', a: 'Yes, at any moment. The job must still run, and nobody should have to notice.' },
          { id: 'once', q: 'Must every job run exactly once?', a: 'Its effect should happen once. We accept that the job may be run again after a crash, so jobs have to be safe to repeat.' },
          { id: 'retries', q: 'What happens when a job keeps failing?', a: 'Retry a few times with delays, then park it as failed so a person can look.' },
          { id: 'scope', q: 'Are repeating schedules and time zones in scope?', a: 'Not today. A job runs at one time. We will add repeating schedules later.' },
        ],
        assumptions: [
          { id: 'delivery', q: 'What do you promise when a worker crashes mid-job?', options: [
            { id: 'at-least-once', label: 'The job runs again, so it may run twice. Jobs must be idempotent', consequence: 'Nothing is skipped, but every job’s effect needs a guard against a repeat.' },
            { id: 'at-most-once', label: 'The job is never repeated, so a crashed job may not finish', consequence: 'No duplicate effects, but a crash can silently lose a job, which breaks a must-hold.' },
          ] },
          { id: 'late', q: 'After an outage, what happens to jobs whose time has passed?', options: [
            { id: 'catch-up', label: 'Run them as soon as we are back', consequence: 'Nothing is lost, but a burst of late jobs follows the outage.' },
            { id: 'skip', label: 'Skip anything more than a few minutes late', consequence: 'No burst, but some jobs never run, which must be visible and the owner told.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers tell you what to promise when a worker dies mid-job?',
        walkthrough: [
          { text: 'Crashes can happen at any moment, so some job will be interrupted: you need a way to notice and rerun it.' },
          { text: 'Rerunning means a job can run twice, so the effect must be safe to repeat.' },
          { text: '20,000 jobs due in one second means finding due jobs cannot scan all 10 million.' },
          { text: 'A few seconds of lateness is fine, so polling for due jobs is acceptable.' },
        ],
        solution: [{ type: 'list', items: ['Start times within a few seconds.', '10 million jobs; up to 20,000 due in one second.', 'Workers crash at any moment; the job must still run.', 'The effect happens once; the job may run twice.', 'Repeated failures go to a failed state for a person to inspect.'] }],
        why: 'These answers decide how due jobs are found, what a crash means for a job, and why every job must be safe to repeat.',
      },
      lessons: ['requirements', 'queues'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts between “schedule a job” and “a worker runs it”, and connect them. Then trace a job through your own design.',
      question: 'Show me how a job due at 09:00 gets to a worker. Which part notices it is time, and where is that remembered?',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-owner', 'owner', 'client', 'Calling team', 60, 200], ['s-api', 'api', 'service', 'Scheduler API', 300, 200]], [['s-owner', 's-api', 'sends request']]),
        traces: [
          { id: 'create', label: 'A team schedules a job for 09:00', token: 'POST /jobs {run_at: 09:00}', from: { type: 'owner' }, to: { type: 'jobs' } },
          { id: 'run', label: 'A job due at 09:00 runs on a worker', token: 'job 4172 due 09:00', from: { type: 'poller' }, to: { type: 'workers' } },
        ],
      },
      help: {
        hint: 'What looks at the Job store every moment, and what stops two pollers claiming the same job?',
        walkthrough: [
          { text: 'The Scheduler API writes each new job to the Job store with its due time.', focus: ['owner', 'api', 'jobs'] },
          { text: 'Pollers look for jobs whose due time has passed and claim them in one step, so no two pollers claim the same job.', focus: ['poller', 'jobs'] },
          { text: 'Claimed jobs go to the Ready queue; workers take them one at a time.', focus: ['poller', 'ready', 'workers'] },
          { text: 'A worker takes a lease in the Lease store, does the work against the target and records the result.', focus: ['workers', 'leases', 'target'] },
        ],
        solution: [
          { type: 'p', text: '**The Job store is the source of truth; pollers turn “due” into “ready.”** Each poller claims a slice of due jobs with one conditional update (scheduled → claimed). Claimed jobs go to the Ready queue. A worker holds a lease while it works.' },
          { type: 'code', lang: 'sql', code: "UPDATE jobs SET state = 'claimed', claimed_by = :poller\nWHERE id IN (\n  SELECT id FROM jobs\n  WHERE state = 'scheduled' AND run_at <= now() AND shard = :mine\n  ORDER BY run_at LIMIT 500\n  FOR UPDATE SKIP LOCKED\n)\nRETURNING id;" },
        ],
        why: 'One durable record of every job plus an atomic claim means no due job is missed or claimed twice; the queue absorbs the 20,000-a-second burst.',
      },
      lessons: ['queues', 'consensus', 'logs-delivery'],
    },
    {
      id: 'lease', title: 'Job states', intro: 'A job moves through states, and a lease runs out on its own. Place the states, name each arrow with its event, then advance the clock.',
      question: 'Draw a job’s states and events. What happens to a job whose worker crashes at 09:01?',
      activity: {
        kind: 'states', entity: 'Job 4172', initial: 'scheduled',
        states: [
          { key: 'scheduled', label: 'Scheduled', blurb: 'Waiting for its time, or for another worker after a crash.' },
          { key: 'running', label: 'Running', blurb: 'A worker holds the lease and is working on it.' },
          { key: 'done', label: 'Done', blurb: 'Finished and recorded. Final.' },
          { key: 'failed', label: 'Failed', blurb: 'Gave up after repeated errors. Needs a person.' },
        ],
        events: [{ id: 'claim', label: 'a worker takes the job' }, { id: 'finish', label: 'the worker finishes' }, { id: 'error', label: 'the work fails too often' }, { id: 'expire', label: 'lease expires (5 min)' }],
        timer: { event: 'expire', after: 5 },
        scenario: [
          { at: 0, event: 'claim', label: '09:00 Worker A takes the job', expect: 'running' },
          { at: 7, event: 'claim', label: '09:07 Worker B takes the job (A crashed at 09:01)', expect: 'running' },
          { at: 9, event: 'finish', label: '09:09 Worker B finishes', expect: 'done' },
          { at: 12, event: 'finish', label: '09:12 Worker A wakes up and reports finish' },
        ],
        starter: st([['scheduled', 'Scheduled', 90, 220], ['running', 'Running', 330, 220]], [['scheduled', 'running', 'claim']]),
      },
      help: {
        hint: 'Worker A never reports back. Which arrow brings the job from Running back so Worker B can take it, and what triggers it?',
        walkthrough: [
          { text: '09:00 Worker A takes the job: Scheduled → Running, with a lease that lasts five minutes.' },
          { text: '09:01 Worker A crashes. Nothing happens at 09:01; the job just sits in Running with a lease that stops being renewed.' },
          { text: '09:05 the lease runs out (this exercise counts five minutes from the claim). Only an arrow you draw can move it: Running → Scheduled on “lease expires”.' },
          { text: '09:07 Worker B takes the job and finishes at 09:09. A late “finish” from Worker A at 09:12 finds the job already Done and is refused.' },
        ],
        solution: [
          { type: 'p', text: 'Add **Running → Scheduled** on “lease expires”, **Running → Done** on “finish”, and **Running → Failed** on repeated errors. A lease that has to be renewed turns a silent crash into an ordinary timed event.' },
          { type: 'code', lang: 'python', code: "def claim(db, job, worker, now, lease_s=300):\n    changed = db.execute(\n        \"UPDATE jobs SET state='running', owner=?, lease_until=? \"\n        \"WHERE id=? AND (state='scheduled' OR (state='running' AND lease_until < ?))\",\n        (worker, now + lease_s, job, now)).rowcount\n    return changed == 1" },
        ],
        why: '“A job whose worker crashes still runs” needs a way to notice a silent crash. A lease that expires on its own does that without anyone having to detect the crash.',
      },
      lessons: ['state-machines', 'timeouts', 'clocks-ordering'],
    },
    {
      id: 'rerun', title: 'Run again', intro: 'The interviewer changes one condition. Predict, run it on your design, then revise.',
      question: 'A worker sends the 09:00 email, then crashes before it records that the job is done. The lease expires and the job runs again. How do you avoid sending the email twice?',
      change: { announce: 'New condition: a worker finishes the work but crashes before it tells the scheduler. Its lease runs out and the job runs a second time.', rule: RULES.trace, alternate: { announce: 'New condition: the Target service stops answering for five minutes.', label: 'Replay with the target service down' } },
      activity: {
        kind: 'trace', request: 'a job from the poller through a worker to the target service', from: ['poller'], to: ['workers', 'target'], failCandidates: ['workers', 'target'],
        predict: { q: 'While that part is down, what does the calling team see?', choices: [{ id: 'error', label: 'The job fails and the team sees an error' }, { id: 'delayed', label: 'The job waits and runs when the part is back' }, { id: 'ok', label: 'Nothing changes' }] },
      },
      help: {
        hint: 'The scheduler cannot tell whether the crashed worker did the work. What can the target service tell it?',
        walkthrough: [
          { text: 'The worker called the target and the email was sent, but the “done” was never recorded.', focus: ['workers', 'target'] },
          { text: 'The lease expires, so the job returns to Scheduled and Worker B runs it again.', focus: ['leases', 'jobs'] },
          { text: 'If Worker B sends the same job id with every call, the target can recognise the repeat and return the first result instead of sending again.', focus: ['target'] },
          { text: 'So the scheduler gives each run the job id as an idempotency key, and the job’s code passes it to the target.', focus: ['workers'] },
        ],
        solution: [
          { type: 'list', items: ['The job’s effect carries an **idempotency key** (the job id plus the scheduled time), so a repeat is recognised.', 'Record “done” and the effect together where possible, or let the target remember the key.', 'Never mark a job done before the work: a crash then loses the job.', 'If the target is down, the job waits in the queue or retries with backoff; after several attempts it moves to the dead-letter queue.'] },
        ],
        why: 'The scheduler can promise “never skipped” but not “never repeated”. Idempotency at the target is what turns a repeat into a harmless no-op.',
      },
      lessons: ['idempotency', 'retries', 'logs-delivery'],
    },
  ],
  rules: [
    // Design stage
    { id: 'store-owner', stage: 'design', when: { link: [{ type: 'api' }, { type: 'jobs' }], labels: ['writes to', 'reads and writes'] }, ack: '{type:api} records each job in {type:jobs}, so a job survives any server restart.', strength: 'Every job is written to a durable store before anything else, so no restart can lose it.' },
    { id: 'no-store', stage: 'design', when: { lacks: { type: 'jobs' } }, coach: 'Jobs must survive a crash. Add the Job store and connect the Scheduler API to it.', gap: { text: 'No durable record of scheduled jobs.', fix: 'Add a Job store, indexed by due time, as the single source of truth.', stage: 'design', lesson: 'queues' }, priority: 3 },
    { id: 'wire-poll', stage: 'design', when: { all: [{ has: { type: 'jobs' } }, { not: { path: [{ type: 'poller' }, { type: 'workers' }] } }] }, coach: 'Connect the run path: Due-job poller → Ready queue → Workers. The poller also needs to read the Job store.', priority: 2 },
    { id: 'trace-now', stage: 'design', when: { all: [{ path: [{ type: 'poller' }, { type: 'workers' }] }, { not: { result: 'trace:run', is: ['ok', 'hit'] } }] }, coach: 'Press “Trace a request” to watch a due job travel from the poller to a worker.', priority: 1 },
    { id: 'poller-store', stage: 'design', when: { link: [{ type: 'poller' }, { type: 'jobs' }], labels: ['reads and writes', 'writes to'] }, ack: '{type:poller} claims due jobs in {type:jobs} rather than only reading them.', strength: 'Pollers claim jobs with a write, so two pollers can’t pick up the same job.' },
    { id: 'poller-read-only', stage: 'design', when: { link: [{ type: 'poller' }, { type: 'jobs' }], labels: ['reads from'] }, priority: 9, ask: { text: 'Your poller only reads {type:jobs}. Two pollers read the same due job at 09:00. What stops both sending it to workers?', choices: [
      { id: 'claim', label: 'Each poller claims jobs with a conditional update (scheduled → claimed)', reply: 'Yes: claiming is a write that only one poller can win, like holding a seat. Change the arrow to “reads and writes”.', verdict: 'sound' },
      { id: 'slice', label: 'Each poller owns a separate slice of jobs, so they never overlap', reply: 'That also works while the slices stay stable. If a poller dies, its slice needs someone to take over, and a claim still protects the handover.', verdict: 'partial' },
      { id: 'dedupe', label: 'Workers drop duplicates when they see them', reply: 'Workers would then each have to know about every job already seen. Prevent the duplicate where the job is claimed.', verdict: 'risky' },
    ] }, gap: { text: 'Two pollers could both pick up the same due job.', fix: 'Make claiming a conditional write on the Job store.', stage: 'design', lesson: 'queues' } },
    { id: 'client-db', stage: 'design', when: { link: ['client', 'db'] }, priority: 8, ask: { text: 'A client writes to {kind:db} directly. Who checks that the job is valid, and who owns the schedule?', choices: [
      { id: 'api', label: 'The Scheduler API validates and owns every write', reply: 'Yes: one front door means one place for checks, limits and audit.', verdict: 'sound' },
      { id: 'direct', label: 'Teams write their own rows', reply: 'Then every team needs to know the table layout, and a bad row can break the poller for everyone.', verdict: 'risky' },
    ] } },
    { id: 'queue-between', stage: 'design', when: { link: [{ type: 'poller' }, 'queue'] }, ack: '{type:poller} hands jobs to {kind:queue}, so a burst of due jobs waits in line instead of overloading workers.', strength: 'You decoupled finding due jobs from running them with a queue, absorbing the 09:00 burst.' },
    { id: 'poll-direct', stage: 'design', when: { link: [{ type: 'poller' }, 'worker'] }, priority: 7, ask: { text: 'Your poller calls workers directly. At 09:00, 20,000 jobs are due in a second and only some workers are free. What happens to the rest?', choices: [
      { id: 'queue', label: 'Put a queue between the poller and the workers', reply: 'Yes: the burst waits in the queue and workers take jobs as they are free.', verdict: 'sound' },
      { id: 'drop', label: 'The poller retries until a worker is free', reply: 'A busy poller then stops claiming other jobs. A queue is a better place to wait.', verdict: 'partial' },
      { id: 'more', label: 'Run enough workers for the whole peak', reply: 'That works but pays for 20,000 workers all day to cover one second.', verdict: 'risky' },
    ] } },
    { id: 'lease-where', stage: 'design', when: { has: { type: 'workers' } }, priority: 6, ask: { text: 'A worker crashes halfway through a job. Your arrows don’t show how anything notices. What does?', choices: [
      { id: 'lease', label: 'The worker holds a lease it must renew; when it expires, the job becomes available again', reply: 'Yes: the crash notices itself by silence. Add a lease (in the Lease store or the job row) and show workers writing to it.', verdict: 'sound' },
      { id: 'ping', label: 'A monitor pings each worker and reassigns its jobs when one stops answering', reply: 'That works, but now the monitor must be reliable and must not reassign a job from a worker that is only slow.', verdict: 'partial' },
      { id: 'human', label: 'Someone notices the job did not finish', reply: 'At 20,000 jobs a second nobody will. The system has to notice on its own.', verdict: 'risky' },
    ] }, gap: { text: 'Nothing noticed a crashed worker’s job.', fix: 'Give each running job a lease that the worker renews and that expires on its own.', stage: 'lease', lesson: 'timeouts' } },
    { id: 'lease-store', stage: 'design', when: { link: [{ type: 'workers' }, { type: 'leases' }], labels: ['writes to', 'reads and writes'] }, ack: '{type:workers} renew their leases in {type:leases}.', strength: 'Workers renew a lease, so a silent crash turns into an expiry the system can act on.' },
    { id: 'in-store', stage: 'design', when: { all: [{ lacks: { type: 'leases' } }, { has: { type: 'workers' } }, { link: [{ type: 'workers' }, { type: 'jobs' }], labels: ['writes to', 'reads and writes'] }] }, ack: 'You keep the lease in {type:jobs} itself. That is a valid alternative: one fewer store, at the cost of heartbeat writes on the busiest table.', ask: { text: 'Heartbeats from every running job now write to {type:jobs}. What keeps those writes from slowing the poller that reads it?', choices: [
      { id: 'separate', label: 'Heartbeat less often, or move leases to their own store as volume grows', reply: 'Yes: keep the choice open. One table is simple until heartbeats compete with claims.', verdict: 'sound' },
      { id: 'same', label: 'Nothing; it is the same table', reply: 'Heartbeats write constantly while pollers need fast claims on the same rows. Watch for that contention.', verdict: 'risky' },
    ] } },
    // States stage
    { id: 'lease-pass', stage: 'lease', when: { result: 'lease', is: 'pass' }, ack: 'Your job got rerun by Worker B at 09:07, and Worker A’s late report was refused.', strength: 'You modelled a lease expiry, so a crashed worker’s job returns to the queue by itself.' },
    { id: 'lease-stuck', stage: 'lease', when: { result: 'lease', is: 'stuck' }, priority: 6, ask: { text: 'At 09:07 Worker B could not take the job because it was still Running. What is missing from your diagram?', choices: [
      { id: 'expire', label: 'An arrow from Running back to Scheduled on “lease expires”', reply: 'Yes: without it a crashed worker’s job stays Running forever. Add it and run again.', verdict: 'sound' },
      { id: 'claim', label: 'Let a second worker take a Running job whenever it likes', reply: 'Then two workers can run the job while the first is healthy. Only an expired lease should free it.', verdict: 'risky' },
      { id: 'monitor', label: 'A person resets stuck jobs', reply: 'Jobs would wait for a person at 3am. Make the expiry automatic.', verdict: 'risky' },
    ] }, gap: { text: 'A crashed worker’s job stayed Running forever in your state diagram.', fix: 'Add Running → Scheduled on a lease expiry.', stage: 'lease', lesson: 'state-machines' } },
    { id: 'lease-late', stage: 'lease', when: { result: 'lease', is: 'pass' }, priority: 4, ask: { text: 'Worker A wakes up at 09:12, still believing it owns the job, and tries to write its result. What stops it overwriting Worker B’s?', choices: [
      { id: 'token', label: 'Every claim has a number; the store refuses a write from an older claim', reply: 'Yes: a fencing token turns a stale worker into a harmless one.', verdict: 'sound' },
      { id: 'trust', label: 'Worker A will notice its lease expired and stop', reply: 'A paused worker cannot notice anything until it wakes up, and by then it may already be writing.', verdict: 'risky' },
      { id: 'ignore', label: 'The last writer wins', reply: 'Then a stale result can replace a correct one. Check the claim on every write.', verdict: 'risky' },
    ] } },
    { id: 'lease-fail', stage: 'lease', when: { result: 'lease', is: 'fail' }, coach: 'The scenario ended in a different state than expected. Follow each step on your diagram and check every arrow’s event name.', priority: 4 },
    // Rerun stage
    { id: 'rerun-delayed', stage: 'rerun', when: { result: 'rerun', is: 'delayed' }, ack: 'In your design the job waits in {kind:queue} until the failed part is back.', strength: 'Your design lets a job wait out an outage instead of failing the caller.' },
    { id: 'rerun-idem', stage: 'rerun', when: { result: 'rerun', is: ['error', 'delayed', 'ok'] }, priority: 7, ask: { text: 'The first run sent the email, then crashed. The second run is about to send it again. What makes the repeat harmless?', choices: [
      { id: 'key', label: 'Send the job id with every call so the target recognises a repeat', reply: 'Yes: an idempotency key per job turns a second run into “already done”.', verdict: 'sound' },
      { id: 'mark-first', label: 'Mark the job done before doing the work', reply: 'Then a crash after marking loses the job: it never runs. Rerunning safely is better than risking a skip.', verdict: 'risky' },
      { id: 'exactly', label: 'Make the scheduler guarantee exactly-once runs', reply: 'A scheduler cannot know whether a crashed worker finished. The target has to cope with repeats.', verdict: 'risky' },
      { id: 'check', label: 'Ask the target whether the email went out before sending', reply: 'That works if the target can answer, but a check and a send are two steps, so it needs a key to be safe.', verdict: 'partial' },
    ] }, gap: { text: 'A rerun after a crash could repeat the job’s effect.', fix: 'Pass an idempotency key (job id and scheduled time) to the target so a rerun is a no-op.', stage: 'rerun', lesson: 'idempotency' } },
    { id: 'rerun-key', when: { answer: 'rerun-idem', is: 'key' }, strength: 'You made reruns harmless with an idempotency key rather than trying to prevent them.' },
    { id: 'rerun-retries', stage: 'rerun', when: { has: { type: 'dead' } }, ack: 'Jobs that keep failing end up in {type:dead}, where a person can see them.', strength: 'You gave repeatedly failing jobs a dead-letter queue instead of retrying forever.' },
    { id: 'rerun-broken', stage: 'rerun', when: { result: 'rerun', is: 'broken' }, coach: 'There’s no chain of arrows from the poller to that part yet. Add the arrows, then run it again.', priority: 4 },
  ],
  solution: {
    design: g([
      ['owner', 'owner', 'client', 'Calling team', 40, 110], ['api', 'api', 'service', 'Scheduler API', 170, 110], ['jobs', 'jobs', 'db', 'Job store', 300, 110],
      ['poller', 'poller', 'scheduler', 'Due-job poller', 300, 300], ['ready', 'ready', 'queue', 'Ready queue', 440, 300], ['workers', 'workers', 'worker', 'Workers', 580, 300],
      ['leases', 'leases', 'db', 'Lease store', 580, 170], ['target', 'target', 'ext', 'Target service', 580, 410],
    ], [
      ['owner', 'api', 'sends request'], ['api', 'jobs', 'writes to'], ['poller', 'jobs', 'reads and writes'], ['poller', 'ready', 'publishes event'], ['ready', 'workers', 'delivers to'],
      ['workers', 'leases', 'reads and writes'], ['workers', 'target', 'calls'], ['workers', 'jobs', 'writes to'],
    ]),
    why: {
      owner: 'Asks for a job at a time and checks its status. Never talks to storage directly.',
      api: 'Validates jobs and writes them to the Job store; the only front door.',
      jobs: 'Source of truth: every job with its due time and state, indexed by due time.',
      poller: 'Claims due jobs with a conditional update, one slice per poller, and hands them to the queue.',
      ready: 'Absorbs the 09:00 burst of 20,000 jobs and lets workers take them as they are free.',
      workers: 'Take a lease, do the work with an idempotency key and record the result. They may crash.',
      leases: 'Who holds each job and until when. A lease that stops being renewed frees the job.',
      target: 'What the job acts on. It recognises a repeated job id and does not repeat the effect.',
    },
    alternatives: { leases: { types: ['jobs'], tradeoff: 'Keeping the lease in the job row removes a store, but every heartbeat then writes to the table that pollers claim from; separate when heartbeats compete with claims.' } },
    trace: { title: 'A job due at 09:00 runs, and a crashed worker’s job runs again', steps: [
      { from: 'poller', to: 'jobs', text: 'Claim up to 500 jobs with run_at ≤ now in this poller’s slice: scheduled → claimed.' },
      { from: 'poller', to: 'ready', text: 'Publish the claimed job ids to the Ready queue.' },
      { from: 'ready', to: 'workers', text: 'Worker A takes job 4172.' },
      { from: 'workers', to: 'leases', text: 'A takes a five-minute lease with claim number 7 and renews it every 30 seconds.' },
      { from: 'workers', to: 'target', text: 'Send the 09:00 email with key job-4172-0900. Then A crashes before recording it.' },
      { from: 'workers', to: 'jobs', text: 'Five minutes later the lease has expired. Worker B takes the job (claim 8), repeats the call with the same key, the target answers “already sent”, and B records done. A’s late write (claim 7) is refused.' },
    ] },
    tradeoff: 'Database polling with claims and leases is simple and durable, and it scales to tens of thousands of jobs a second with sliced pollers, but jobs are only as accurate as the poll interval and every job must be safe to repeat.',
    otherApproach: 'For sub-second precision or hundreds of thousands of jobs a second, load the next few minutes of jobs into an in-memory timer per partition and fire from there, keeping the database for durability and for rebuilding after a crash.',
  },
};
