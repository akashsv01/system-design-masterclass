import type { GenericLesson } from '../lessonTypes';
import { py, pyLine } from './_kit';

const ALLOW = py('sdm/rate_limit.py', 'allow');
const BURN = py('sdm/slo.py', 'burn_rate');

export const rateLimiting: GenericLesson = {
  id: 'rate-limiting',
  area: 'Architecture and operations',
  opening: 'A reseller’s bot hits the hold endpoint 10,000 times a second to grab seats before fans can. Your servers stay up, just barely, but real fans get errors. How do you give everyone a fair share without blocking a fan who taps twice?',
  visual: { kind: 'chart', xLabel: 'seconds', yLabel: 'requests allowed per second', note: 'One client sending 20 requests/s against a bucket of 10 tokens refilled at 5/s.' },
  experiment: {
    step: 3, label: 'Bucket size (burst)', min: 1, max: 30, stepSize: 1, initial: 10, unit: 'tokens',
    compute: (cap) => {
      const rate = 5;
      const send = 20;
      let tokens = cap;
      const pts: [number, number][] = [];
      for (let s = 0; s <= 10; s++) {
        const allowed = Math.min(send, Math.floor(tokens));
        pts.push([s, allowed]);
        tokens = Math.min(cap, tokens - allowed + rate);
      }
      return { text: `First second: **${pts[0][1]}** allowed (the burst). After that: **${rate}/s**, the refill rate. A fan tapping twice fits easily in the burst; the bot is held to 5/s.`, chart: { series: [{ name: 'allowed', points: pts, tone: 'ok' }, { name: 'sent', points: pts.map(([x]) => [x, send] as [number, number]), tone: 'fail', dashed: true }] } };
    },
    assumptions: ['One client sends 20 requests every second; the bucket refills 5 tokens per second; capacity is the burst size.'],
  },
  steps: [
    { kicker: 'Idea', title: 'Limit each client, not just the total', body: ['A **rate limiter** caps how many requests one client (API key, user, IP) may make in a period. Over the limit, the server answers **429 Too Many Requests**, cheaply, before doing real work.'], chart: { series: [{ name: 'sent', points: Array.from({ length: 11 }, (_, s) => [s, 20] as [number, number]), tone: 'fail', dashed: true }] } },
    { kicker: 'Watch', title: 'Token bucket: a burst, then a steady rate', body: ['Each client has a bucket of tokens. Every request spends one, and tokens refill at a steady rate up to a maximum. A full bucket absorbs a short burst. Sustained traffic is held to the refill rate.'], chart: { series: [{ name: 'allowed', points: [[0, 10], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5]], tone: 'ok' }, { name: 'sent', points: Array.from({ length: 11 }, (_, s) => [s, 20] as [number, number]), tone: 'fail', dashed: true }] }, code: { code: ALLOW, highlight: [pyLine(ALLOW, 'self.tokens = min(')], caption: 'python/sdm/rate_limit.py — refill based on elapsed time, then spend one token' } },
    { kicker: 'Predict', title: 'Fixed windows have an edge problem', body: ['A simpler limiter counts requests per calendar minute: at most 10 per minute.'], chart: { series: [{ name: 'allowed', points: [[0, 10], [10, 5]], tone: 'ok' }] },
      predict: { id: 'edge', prompt: 'A client sends 10 requests at 0:59.9 and 10 more at 1:00.1. How many does a fixed-window limit of 10/minute allow?', choices: [
        { id: '20', text: 'All 20, within 0.2 seconds', why: 'Right. They fall in two different windows. Sliding windows or token buckets avoid this burst at the boundary.' },
        { id: '10', text: '10', why: 'The counter resets at 1:00:00, so the second ten count against a fresh window.' },
      ], correct: '20' } },
    { kicker: 'Try it', title: 'Tune the burst', body: ['Drag the bucket size. Bigger buckets are kinder to bursty humans and let bots grab more in their first second. The refill rate sets the long-run limit.'] },
    { kicker: 'Trade-off', title: 'Where to enforce it', body: ['Enforce at the edge or API gateway so rejected requests cost almost nothing. With many gateway servers, keep counters in a shared fast store (or accept approximate per-server limits). Tell clients when to retry with a `Retry-After` header.'], chart: { series: [{ name: 'allowed', points: [[0, 10], [1, 5], [10, 5]], tone: 'ok' }] } },
  ],
  worked: { title: 'algorithms compared', blocks: [
    { type: 'table', head: ['Algorithm', 'Bursts', 'Memory per client', 'Notes'], rows: [['Fixed window counter', 'Up to 2× at boundaries', '1 counter', 'Simplest'], ['Sliding window log', 'Exact', 'One timestamp per request', 'Precise, memory-heavy'], ['Sliding window counter', 'Approximately smooth', '2 counters', 'Good default for many APIs'], ['Token bucket', 'Up to bucket size', '2 numbers', 'Bursts allowed, average enforced']] },
    { type: 'code', lang: 'python', code: py('sdm/rate_limit.py'), caption: 'python/sdm/rate_limit.py — tested with pytest, including the fixed-window edge burst' },
    { type: 'p', text: 'The [distributed rate limiter case](/cases/case-rate-limiter) scales this across many servers.' },
  ] },
  checks: [{ kind: 'numeric', id: 'burst', prompt: 'A token bucket holds 20 tokens and refills 2 per second. A client that has been idle sends 100 requests at once. How many are allowed immediately?', answer: 20, tolerance: 0.01, unit: 'requests', solution: ['An idle client’s bucket is full: 20 tokens', 'Each request spends one', '20 allowed now; the rest get 429 until tokens refill at 2/s'] }],
  exercise: { id: 'key', prompt: 'Should the hold endpoint be rate-limited per IP address or per signed-in user? One or two sentences.', checklist: ['Prefers per user/account for signed-in actions.', 'Notes IP limits hurt shared networks (offices, mobile carriers) and bots rotate IPs.'], model: 'Per signed-in user: many fans can share one IP behind a mobile carrier or office, and bots rotate IPs anyway; keep a looser per-IP limit for unauthenticated endpoints.' },
  next: { id: 'observability', reason: 'Limits protect the system. Next: seeing what the system is actually doing.' },
};

export const observability: GenericLesson = {
  id: 'observability',
  area: 'Architecture and operations',
  opening: 'Users say checkout is slow. Your dashboard shows normal CPU everywhere. Where do you look? Logs, metrics and traces each answer a different question, and you usually need all three to find the culprit.',
  visual: { kind: 'timeline', unit: 'ms', note: 'Illustrative trace of one slow checkout request.', lanes: [{ id: 'gw', label: 'API gateway' }, { id: 'checkout', label: 'Checkout' }, { id: 'seats', label: 'Seat service' }, { id: 'pay', label: 'Payment provider' }], events: [
    { t: 0, lane: 'gw', label: 'request in', to: { lane: 'checkout', t: 5 } },
    { t: 10, lane: 'checkout', label: 'hold seat', to: { lane: 'seats', t: 12 } },
    { t: 40, lane: 'seats', label: 'held (28 ms)', tone: 'ok' },
    { t: 45, lane: 'checkout', label: 'charge card', to: { lane: 'pay', t: 50 } },
    { t: 1850, lane: 'pay', label: 'charged (1,800 ms!)', tone: 'fail' },
    { t: 1870, lane: 'gw', label: 'response out', tone: 'active' },
  ] },
  steps: [
    { kicker: 'Idea', title: 'Metrics: how much, how often', body: ['**Metrics** are numbers over time: requests per second, error rate, p99 latency per endpoint. They’re cheap to store and great for dashboards and alerts. They tell you *that* checkout p99 jumped from 400 ms to 1.9 s at 14:05, not why.'], timeline: { upTo: 0 } },
    { kicker: 'Idea', title: 'Traces: where the time went', body: ['A **trace** follows one request across services. Each hop records a **span** with start and end times, all sharing a trace id. This trace shows the seat hold took 28 ms and the payment call took 1,800 ms. Found it.'], timeline: { upTo: 6, focus: 4 }, changes: [{ kind: 'add', text: 'Payment span: 1,800 ms of 1,870 ms total' }] },
    { kicker: 'Idea', title: 'Logs: what exactly happened', body: ['**Logs** are timestamped records of events: “payment retried after 503, attempt 2, provider region eu-west-1”. Structured (JSON) logs that include the trace id let you jump from the slow span straight to the details.'], timeline: { upTo: 6, focus: 3 } },
    { kicker: 'Predict', title: 'Which do you check first?', body: ['An alert fires: checkout error rate is 4%.'], timeline: { upTo: 6 },
      predict: { id: 'order', prompt: 'What’s a sensible order of investigation?', choices: [
        { id: 'mtl', text: 'Metrics to see when and where errors rose → traces of failing requests to see which hop fails → logs for that hop to see why.', why: 'Right. Narrow from broad to specific: each tool hands you the key to the next.' },
        { id: 'logs', text: 'Search all logs for “error”.', why: 'On a busy system that returns millions of lines. Metrics and traces narrow it down first.' },
      ], correct: 'mtl' } },
  ],
  worked: { title: 'what to instrument first', blocks: [
    { type: 'list', items: ['For every service and endpoint: request **rate**, **errors**, and **duration** percentiles (the “RED” metrics).', 'For every resource: utilisation, saturation (queue lengths), errors.', 'Propagate a trace id through every call and log line. Sample traces (say 1%) plus *all* slow or failed ones.', 'Structured logs with consistent field names: `trace_id`, `user_id`, `order_id`. Never log passwords or full card numbers.'] },
    { type: 'p', text: 'You’ll read a trace yourself in the [request tracing lab](/labs/lab-request-tracing).' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Which tool best answers “which service made this particular request slow”?', choices: [
    { id: 'trace', text: 'A distributed trace', why: 'Right. It shows each hop’s duration for that one request.' },
    { id: 'metric', text: 'A CPU metric', why: 'CPU tells you about machines in aggregate, not about one request’s path.' },
  ], correct: 'trace' }],
  exercise: { id: 'id', prompt: 'Why include the trace id in every log line?', checklist: ['Links logs from many services to one request.', 'Lets you jump from a slow trace span to the exact logs.'], model: 'So you can pull every log line, from every service, for one specific request, starting from a slow span in its trace.' },
  next: { id: 'slos', reason: 'Observability shows what’s happening. Next: deciding what “good enough” is.' },
};

export const slos: GenericLesson = {
  id: 'slos',
  area: 'Architecture and operations',
  opening: 'The team wants to ship a risky new checkout this week. The on-call engineer says the system has been flaky. Who’s right? An error budget turns that argument into arithmetic.',
  visual: { kind: 'chart', xLabel: 'day of the 30-day window', yLabel: 'error budget remaining (%)', note: 'SLO 99.9% of checkouts succeed over 30 days; 10 million checkouts per window.' },
  experiment: {
    step: 3, label: 'Current error rate', min: 0, max: 2, stepSize: 0.05, initial: 0.3, unit: '%',
    compute: (pct) => {
      const burn = (pct / 100) / 0.001;
      const daysLeft = burn > 0 ? 30 / burn : Infinity;
      const pts: [number, number][] = Array.from({ length: 31 }, (_, d) => [d, Math.max(0, Math.round(100 - (100 * d) / Math.max(daysLeft, 0.0001)))]);
      return { text: `Burn rate **${burn.toFixed(1)}×**: at this error rate the whole month’s budget lasts **${Number.isFinite(daysLeft) ? daysLeft.toFixed(1) + ' days' : 'forever'}**. ${burn > 1 ? 'Above 1× means you’ll miss the SLO if nothing changes.' : 'Below 1× means you’re within budget.'}`, chart: { series: [{ name: 'budget', points: pts, tone: burn > 1 ? 'fail' : 'ok' }] } };
    },
    assumptions: ['SLO 99.9% over 30 days. Error rate held constant from day 0.'],
  },
  steps: [
    { kicker: 'Idea', title: 'SLI: measure what users feel', body: ['A **service level indicator (SLI)** is a measured ratio of good events to all events, for example “checkouts that succeed within 2 s ÷ all checkouts”. Pick SLIs users would notice.'], chart: { series: [{ name: 'budget', points: [[0, 100]], tone: 'ok' }] } },
    { kicker: 'Idea', title: 'SLO: the target, and its budget', body: ['A **service level objective (SLO)** sets a target for the SLI: 99.9% over 30 days. Out of 10 million checkouts, 10,000 may fail. Those 10,000 are the **error budget**: permission to take risks.'], chart: { series: [{ name: 'budget', points: Array.from({ length: 31 }, (_, d) => [d, 100 - (d * 100) / 30] as [number, number]), tone: 'ok' }] }, changes: [{ kind: 'add', text: 'Error budget: 10,000 failed checkouts per 30 days' }] },
    { kicker: 'Predict', title: 'Spend it or save it?', body: ['It’s day 12 and the budget is 85% left. The team wants to ship the new checkout.'], chart: { series: [{ name: 'budget', points: [[0, 100], [12, 85]], tone: 'ok' }], marks: [{ x: 12, y: 85, label: 'day 12: 85% left' }] },
      predict: { id: 'ship', prompt: 'What does the error budget say about shipping?', choices: [
        { id: 'ship', text: 'Ship, carefully: there’s budget to spend on risk.', why: 'Right. Plenty of budget means the system is more reliable than promised, so trading some reliability for speed is the point. If the budget were nearly gone, you’d freeze risky changes and fix reliability.' },
        { id: 'never', text: 'Never ship risky changes.', why: 'Then you’d over-deliver reliability nobody asked for while shipping nothing. The budget exists to be spent wisely.' },
      ], correct: 'ship' } },
    { kicker: 'Try it', title: 'Change the error rate', body: ['Drag the current error rate. The **burn rate** says how fast you’re using the budget: 1× uses exactly the month’s budget, 10× would exhaust it in three days. Alerting on burn rate catches real problems without paging for every blip.'], code: { code: BURN, caption: 'python/sdm/slo.py' } },
  ],
  worked: { title: 'error budget arithmetic', blocks: [
    { type: 'formula', title: 'Budget and burn', assumptions: ['SLO 99.9% over 30 days', '10,000,000 checkouts per 30 days'], steps: ['Budget = (1 − 0.999) × 10,000,000 = 10,000 failures', 'An outage fails 2% of checkouts for 3 hours: 10M ÷ 720 h × 3 h × 0.02 ≈ 833 failures', 'Remaining = 10,000 − 833 = 9,167 (92%)'], result: 'That outage used about 8% of the month’s budget', changed: 'At 99.99% the budget is only 1,000, and the same outage would use 83% of it.' },
    { type: 'code', lang: 'python', code: py('sdm/slo.py'), caption: 'python/sdm/slo.py — tested with pytest' },
  ] },
  checks: [{ kind: 'numeric', id: 'budget', prompt: 'SLO 99.5% over a month with 2,000,000 requests. How many failed requests is the budget?', answer: 10000, tolerance: 0.01, unit: 'requests', solution: ['1 − 0.995 = 0.005', '0.005 × 2,000,000 = 10,000'] }],
  exercise: { id: 'why100', prompt: 'Why is 100% a bad SLO?', checklist: ['It leaves no budget for change: every deploy or failure breaks it.', 'Users can’t tell 99.99% from 100% (their own networks fail more), yet the cost rises steeply.'], model: 'It leaves zero room for any failure or risky change, so the team could never ship, and users can’t distinguish 99.99% from 100% because their own Wi-Fi and phones fail more often than that.' },
  next: { id: 'deployments', reason: 'Budgets decide when to take risk. Next: how to ship changes with as little risk as possible.' },
};

export const deployments: GenericLesson = {
  id: 'deployments',
  area: 'Architecture and operations',
  opening: 'Version 2 of checkout passed every test. Ten minutes after full release, 5% of payments fail for users with one particular bank. How many users did it hit before anyone noticed, and how fast can you undo it?',
  visual: { kind: 'chart', xLabel: 'minutes since deploy started', yLabel: 'checkout error rate (%)', note: 'Illustrative canary: v2 has a bug affecting 5% of payments.' },
  steps: [
    { kicker: 'Idea', title: 'All at once: everyone gets the bug', body: ['Replace every server with v2 and 100% of users hit the bug immediately. The error rate jumps from 0.2% to 5%.'], chart: { series: [{ name: 'error rate', points: [[0, 0.2], [1, 5], [10, 5]], tone: 'fail' }], thresholds: [{ y: 1, label: 'alert at 1%' }] } },
    { kicker: 'Watch', title: 'Canary: try it on a few first', body: ['A **canary** sends v2 a small slice of traffic, say 5%, and compares its error rate and latency with v1. The overall error rate barely moves (0.2% → 0.44%), but the canary’s own rate is 5%, which is obviously bad.'], chart: { series: [{ name: 'v1', points: [[0, 0.2], [10, 0.2]], tone: 'ok', dashed: true }, { name: 'canary v2', points: [[0, 0.2], [1, 5], [3, 5]], tone: 'fail' }], thresholds: [{ y: 1, label: 'alert at 1%' }] }, changes: [{ kind: 'add', text: 'Canary: 5% of traffic on v2' }] },
    { kicker: 'Predict', title: 'The canary looks bad', body: ['Three minutes in, the canary’s error rate is 25× v1’s.'], chart: { series: [{ name: 'v1', points: [[0, 0.2], [10, 0.2]], tone: 'ok', dashed: true }, { name: 'canary v2', points: [[0, 0.2], [1, 5], [3, 5]], tone: 'fail' }], marks: [{ x: 3, y: 5, label: 'roll back?' }] },
      predict: { id: 'rb', prompt: 'What should happen, and how many users were affected?', choices: [
        { id: 'auto', text: 'Roll back the canary automatically; only the ~5% on the canary for 3 minutes saw errors.', why: 'Right. Blast radius ≈ 5% × 5% × 3 minutes of traffic, instead of 5% of everyone until someone noticed.' },
        { id: 'wait', text: 'Keep going: 5% of 5% is tiny.', why: 'It’s tiny *because* the canary is small. Proceeding would make it 5% of everyone.' },
      ], correct: 'auto' } },
    { kicker: 'Fix', title: 'Make rollback boring', body: ['Rollback must be one fast, rehearsed action: keep v1 ready (**blue-green** keeps a whole idle copy), make database changes backward compatible ([expand/contract](/learn/schema-evolution)), and put risky features behind **feature flags** you can switch off without redeploying.'], chart: { series: [{ name: 'error rate', points: [[0, 0.2], [1, 0.44], [3, 0.44], [4, 0.2], [10, 0.2]], tone: 'ok' }] } },
  ],
  worked: { title: 'deployment strategies', blocks: [{ type: 'table', head: ['Strategy', 'How', 'Blast radius', 'Rollback'], rows: [['All at once', 'Replace everything', 'Everyone', 'Redeploy old version (slow)'], ['Rolling', 'Replace servers in batches', 'Grows as it rolls', 'Roll back batches'], ['Blue-green', 'Full new copy, switch traffic', 'Everyone at switch', 'Switch back (instant)'], ['Canary', 'Small slice first, compare, then expand', 'Small', 'Drain the canary (instant)'], ['Feature flag', 'Code shipped dark, enabled gradually', 'As chosen', 'Turn the flag off']] }] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'v2 adds a new database column and v1 doesn’t know it. Is rolling back to v1 safe?', choices: [
    { id: 'yes', text: 'Yes, if the change was additive: v1 ignores the column.', why: 'Right. That’s why schema changes go first and stay backward compatible.' },
    { id: 'no', text: 'Never. Rollbacks can’t cross schema changes.', why: 'They can, if the change was additive. Destructive changes (dropping a column v1 needs) are what break rollback.' },
  ], correct: 'yes' }],
  exercise: { id: 'metric', prompt: 'Which two metrics would you compare between canary and baseline before promoting a checkout release?', checklist: ['Error rate (e.g. failed checkouts).', 'Latency percentile (p99), or a business metric like conversion.'], model: 'Checkout error rate and p99 latency (and ideally successful payments per minute), each compared between canary and baseline over the same period.' },
  next: { id: 'backups-dr', reason: 'Rollback fixes bad code. Next: recovering from lost or corrupted data.' },
};

export const backupsDr: GenericLesson = {
  id: 'backups-dr',
  area: 'Architecture and operations',
  opening: 'A migration runs `UPDATE buyers SET email = NULL` without a WHERE. Replication faithfully copies the damage to every replica within a second. Replicas protect you from machines failing. What protects you from your own mistakes?',
  visual: { kind: 'timeline', unit: 'hours', note: 'Nightly snapshot at 02:00 plus a continuously archived write-ahead log.', lanes: [{ id: 'snap', label: 'Backups' }, { id: 'db', label: 'Database' }, { id: 'ops', label: 'Recovery' }], events: [
    { t: 2, lane: 'snap', label: 'nightly snapshot', tone: 'ok' },
    { t: 14, lane: 'db', label: 'bad migration 14:00', tone: 'fail' },
    { t: 14.5, lane: 'ops', label: 'noticed', tone: 'active' },
    { t: 15, lane: 'ops', label: 'restore snapshot + replay log to 13:59', tone: 'active' },
    { t: 16, lane: 'ops', label: 'service restored', tone: 'ok' },
  ] },
  steps: [
    { kicker: 'Problem', title: 'Replicas copy mistakes too', body: ['Replication copies every write, including the bad one. Within a second every copy has blank emails. You need a copy of the data **as it was before** the mistake.'], timeline: { upTo: 2 } },
    { kicker: 'Idea', title: 'Snapshot plus the log', body: ['Take a full **backup** (snapshot) nightly and archive the write-ahead log continuously. To recover, restore the snapshot and replay the log up to just before the mistake: **point-in-time recovery**.'], timeline: { upTo: 4 }, changes: [{ kind: 'add', text: 'Restore to 13:59, one minute before the bad migration' }] },
    { kicker: 'Idea', title: 'RPO and RTO', body: ['**RPO** (recovery point objective): how much data you can afford to lose, measured in time. **RTO** (recovery time objective): how long you can afford to be down. Here RPO ≈ 1 minute (the log replays to 13:59) and RTO ≈ 2 hours (noticed at 14:30, restored at 16:00).'], timeline: { upTo: 5 } },
    { kicker: 'Predict', title: 'The untested backup', body: ['Backups have run nightly for two years. Nobody has ever restored one.'], timeline: { upTo: 5 },
      predict: { id: 'test', prompt: 'How confident should you be that a restore will work, and how long it will take?', choices: [
        { id: 'not', text: 'Not confident: you know neither until you rehearse it.', why: 'Right. Backups fail silently: missing tables, expired credentials, restores that take 20 hours. Test restores regularly and time them, and that time is your real RTO.' },
        { id: 'very', text: 'Very: the job reports success every night.', why: '“Backup succeeded” means a file was written, not that it can be restored into a working database in time.' },
      ], correct: 'not' } },
  ],
  worked: { title: 'designing for RPO and RTO', blocks: [
    { type: 'table', head: ['Approach', 'RPO', 'RTO', 'Protects against'], rows: [['Nightly snapshot only', 'Up to 24 h', 'Hours', 'Disasters, mistakes (loses a day)'], ['Snapshot + archived log', 'Seconds to minutes', 'Hours (replay time)', 'Mistakes, with precise recovery'], ['Synchronous replica', '≈ 0', 'Minutes (failover)', 'Machine failure, but **not** mistakes'], ['Copies in another region/account', 'As above', 'Hours', 'Region loss, compromised account']] },
    { type: 'list', items: ['Keep backups in a separate account and region with deletion protection, so an attacker or a bad script can’t delete them along with production.', 'Rehearse restores on a schedule; alert if a restore test fails or exceeds the RTO.', 'Disaster recovery is a runbook people have practised, not a document nobody has opened.'] },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Which protects against an engineer accidentally deleting a table?', choices: [
    { id: 'pitr', text: 'Point-in-time recovery from backups', why: 'Right. Replicas would delete the table too.' },
    { id: 'rep', text: 'A synchronous replica', why: 'It copies the delete immediately. Great for hardware failure, useless for mistakes.' },
  ], correct: 'pitr' }],
  exercise: { id: 'rpo', prompt: 'The business says losing more than 5 minutes of bookings is unacceptable. What does that set, and what backup approach meets it?', checklist: ['It sets RPO = 5 minutes.', 'Needs continuous log archiving (or replication plus PITR), not nightly snapshots alone.'], model: 'It sets an RPO of 5 minutes, which nightly snapshots can’t meet; archive the write-ahead log continuously (and replicate it off-site) so you can restore to within seconds.' },
  next: { id: 'cost', reason: 'Every safeguard costs money. Next: reasoning about what a design will cost to run.' },
};

export const cost: GenericLesson = {
  id: 'cost',
  area: 'Architecture and operations',
  opening: 'Two designs for ticket PDFs both work. One stores them in the database, the other in object storage. At today’s traffic the bills look similar. At 10× traffic, one costs twelve times more. Which, and why?',
  visual: { kind: 'chart', xLabel: 'bookings per month (millions)', yLabel: 'monthly storage cost ($)', note: 'Illustrative unit prices: database storage $0.25/GB-month (×3 for replicas), object storage $0.023/GB-month. Real prices vary by provider.' },
  experiment: {
    step: 2, label: 'Bookings per month', min: 1, max: 30, stepSize: 1, initial: 3, unit: 'million',
    compute: (m) => {
      const gbPerMonth = m * 1e6 * 0.2 / 1000;
      const months = 12;
      const stored = gbPerMonth * months;
      const db = Math.round(stored * 0.25 * 3);
      const obj = Math.round(stored * 0.023);
      const pts = [1, 5, 10, 15, 20, 25, 30];
      return { text: `After a year: **${Math.round(stored).toLocaleString()} GB** of PDFs. Database (3 copies): **$${db.toLocaleString()}/month**. Object storage: **$${obj.toLocaleString()}/month**, about ${Math.round(db / Math.max(obj, 1))}× cheaper.`, chart: { series: [{ name: 'database', points: pts.map((x) => [x, Math.round(x * 1e6 * 0.2 / 1000 * 12 * 0.75)] as [number, number]), tone: 'fail' }, { name: 'object storage', points: pts.map((x) => [x, Math.round(x * 1e6 * 0.2 / 1000 * 12 * 0.023)] as [number, number]), tone: 'ok' }], marks: [{ x: m, y: db, label: `$${db.toLocaleString()}` }] } };
    },
    assumptions: ['Each PDF 200 KB; one year of PDFs kept; database storage replicated 3×. Request and transfer costs ignored.'],
  },
  steps: [
    { kicker: 'Idea', title: 'Find the dominant cost', body: ['Cost reasoning is capacity estimation with prices attached: estimate usage (servers, GB stored, GB transferred, requests) and multiply by unit prices. One line usually dominates the bill. Find it before optimising anything else.'], chart: { series: [{ name: 'database', points: [[1, 0]], tone: 'fail' }] } },
    { kicker: 'Predict', title: 'Where should 200 KB PDFs live?', body: ['3 million bookings a month, one 200 KB PDF each, kept for a year.'], chart: { series: [{ name: 'database', points: [1, 5, 10, 15, 20, 25, 30].map((x) => [x, Math.round(x * 1e6 * 0.2 / 1000 * 12 * 0.75)] as [number, number]), tone: 'fail' }, { name: 'object storage', points: [1, 5, 10, 15, 20, 25, 30].map((x) => [x, Math.round(x * 1e6 * 0.2 / 1000 * 12 * 0.023)] as [number, number]), tone: 'ok' }] },
      predict: { id: 'where', prompt: 'Which grows more slowly in cost as bookings grow?', choices: [
        { id: 'obj', text: 'Object storage', why: 'Right. It’s roughly 10–30× cheaper per GB and doesn’t need three replica copies on expensive disks. The database keeps a small pointer.' },
        { id: 'db', text: 'The database', why: 'Database storage is premium (fast disks, replicas, backups). Big immutable files are the worst use of it.' },
      ], correct: 'obj' } },
    { kicker: 'Try it', title: 'Grow the business', body: ['Drag bookings per month. Both lines grow linearly, but at very different slopes. At small scale the difference is pocket money. At large scale it decides the design.'] },
    { kicker: 'Trade-off', title: 'Cost is a design requirement', body: ['Cheaper isn’t always better: a managed database costs more than one you run yourself, but saves engineering time, and engineers are usually the largest cost. State the assumptions, compare designs at today’s scale and at 10×, and include people’s time.'], chart: { series: [{ name: 'database', points: [[1, 450], [30, 13500]], tone: 'fail' }, { name: 'object storage', points: [[1, 14], [30, 414]], tone: 'ok' }] } },
  ],
  worked: { title: 'a cost sketch for the booking platform', blocks: [
    { type: 'table', head: ['Item', 'Usage (estimate)', 'Unit price (illustrative)', 'Monthly'], rows: [['App servers', '4 × medium instances', '$70 each', '$280'], ['Database (primary + replica)', '2 × large instances', '$400 each', '$800'], ['Object storage (PDFs, 1 year)', '7,200 GB', '$0.023/GB', '$166'], ['CDN transfer', '20 TB', '$0.05/GB', '$1,000'], ['Total', '', '', '≈ $2,250']] },
    { type: 'p', text: 'Here CDN transfer dominates, so compressing images and caching longer would save more than shrinking the database. Unit prices are illustrative; check your provider’s current pricing before relying on any figure.' },
  ] },
  checks: [{ kind: 'numeric', id: 'gb', prompt: '5 million bookings a month, each with a 100 KB PDF. How many GB of PDFs accumulate per month?', answer: 500, tolerance: 0.02, unit: 'GB', solution: ['5,000,000 × 100 KB = 500,000,000 KB', '= 500,000 MB = 500 GB'] }],
  exercise: { id: 'dominant', prompt: 'Your bill shows data transfer out is 60% of the total. Name one design change that would reduce it.', checklist: ['Names a concrete change (compress, cache at CDN with longer TTLs, smaller images/formats, avoid cross-region traffic).', 'Ties it to reducing bytes transferred.'], model: 'Serve images in a modern compressed format through the CDN with long cache times, so fewer and smaller bytes leave the origin.' },
  next: { id: 'responsibilities', reason: 'That completes architecture and operations. Next: low-level design, the objects inside one service.' },
};

export const ARCHITECTURE2 = [rateLimiting, observability, slos, deployments, backupsDr, cost];
