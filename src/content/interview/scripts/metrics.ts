import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const metrics: InterviewScript = {
  caseId: 'case-metrics',
  track: 'hld',
  doLine: 'Design a metrics pipeline: carry a latency sample to a dashboard, choose a time-series key, then survive an ingest spike while storage slows',
  skills: ['data-modeling', 'architecture', 'capacity', 'messaging'],
  brief: {
    interviewer: { name: 'Lena', role: 'site reliability engineer on the observability team' },
    intro: 'Every server we run reports numbers: latency, errors, memory. Engineers watch them on dashboards, and alerts page us when they go wrong. The pipeline has to keep up exactly when things are going wrong.',
    users: 'Engineers who watch dashboards and receive alerts, and the servers that report the numbers.',
    needs: ['Servers report measurements (latency, error counts, memory) every 10 seconds', 'Dashboards show a metric over the last hour in under a second', 'Alerts fire within a minute of a problem', 'Old data stays available at lower detail for a year'],
    mustHold: ['A dashboard query never needs to scan raw points for a long range', 'An alert is not delayed because storage is slow', 'A spike of incoming data must not take down dashboards'],
    constraints: ['10,000 servers × 500 metrics every 10 seconds, about 500,000 points a second', 'Raw points kept 15 days, 1-minute rollups 90 days, 1-hour rollups 1 year', 'Dashboards over the last hour load in under 1 second', 'Alerts within 1 minute'],
    outOfScope: ['Logs and traces', 'Writing the alert rules', 'User accounts and dashboards’ look and feel'],
    terms: [
      { term: 'time series', meaning: 'the values of one metric on one host, in time order, such as web-17’s request latency every 10 seconds' },
      { term: 'data point', meaning: 'one measurement: metric, host, time and value' },
      { term: 'rollup', meaning: 'a pre-computed summary (average, maximum, count) of points over a minute or an hour, so long-range queries read far fewer rows' },
      { term: 'time bucket', meaning: 'a fixed slice of time, such as one minute, used to group points' },
    ],
    firstMove: 'A server measures its request latency. Show me how that number reaches a dashboard, and which part keeps it until someone looks.',
  },
  palette: [
    { type: 'agent', kind: 'client', name: 'Host agent', blurb: 'Runs on every server. Collects numbers, batches them and sends a batch every 10 seconds.' },
    { type: 'ingest', kind: 'service', name: 'Ingest service', blurb: 'Receives batches, checks them and appends them to the buffer. Does no storage work itself.' },
    { type: 'buffer', kind: 'stream', name: 'Buffer log', blurb: 'An ordered log that holds incoming batches so storage can read them at its own pace.' },
    { type: 'writer', kind: 'worker', name: 'Storage writer', blurb: 'Reads batches from the buffer and writes them into the time-series store in large chunks.' },
    { type: 'tsdb', kind: 'db', name: 'Time-series store', blurb: 'A database built for points in time order: compressed, append-friendly, split into partitions.' },
    { type: 'rollup', kind: 'worker', name: 'Rollup job', blurb: 'In the background, turns raw points into per-minute and per-hour summaries.' },
    { type: 'query', kind: 'service', name: 'Query service', blurb: 'Answers dashboard queries and picks the coarsest resolution that fits the time range.' },
    { type: 'dashboard', kind: 'client', name: 'Dashboard', blurb: 'The page engineers look at. It asks for a metric over a time range.' },
    { type: 'alerts', kind: 'service', name: 'Alert evaluator', blurb: 'Checks fresh data against alert rules and pages someone when a rule trips.' },
  ],
  verbs: ['sends request', 'reads from', 'writes to', 'reads and writes', 'publishes event', 'delivers to'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'volume', q: 'How many servers and metrics, and how often?', a: '10,000 servers, 500 metrics each, every 10 seconds. About 500,000 points a second.' },
          { id: 'queries', q: 'What do people ask of the data?', a: 'Mostly one metric over a time range (“checkout latency, last hour”), sometimes everything one host reports during an incident.' },
          { id: 'retention', q: 'How long do we keep data, and at what detail?', a: 'Raw points 15 days, 1-minute rollups 90 days, 1-hour rollups one year.' },
          { id: 'alerts', q: 'How fast must alerts fire?', a: 'Within one minute of the data arriving, even when storage is struggling.' },
          { id: 'loss', q: 'Is it acceptable to lose a few points?', a: 'A few points during an overload, yes: we would rather lose some than slow everything. Losing an alert, no.' },
          { id: 'series', q: 'How many distinct time series are there?', a: 'About 5 million: 10,000 servers times 500 metrics. A developer adding a label like user id could multiply that, so we cap labels.' },
        ],
        assumptions: [
          { id: 'collect', q: 'Do agents push their numbers, or does the system pull them?', options: [
            { id: 'push', label: 'Agents push a batch every 10 seconds', consequence: 'Works from anywhere and for short-lived jobs, but you must handle bursts when many agents send together.' },
            { id: 'pull', label: 'A collector scrapes each server every 10 seconds', consequence: 'You control the load and notice a dead server immediately, but the collector must reach every server and know which exist.' },
          ] },
          { id: 'rollup-when', q: 'When are rollups computed?', options: [
            { id: 'background', label: 'In the background, after the raw points land', consequence: 'Cheap and simple; the newest minute may not have a rollup yet, so recent queries read raw points.' },
            { id: 'streaming', label: 'On the way in, as points arrive', consequence: 'Rollups are ready at once, but the write path does more work for every point.' },
          ] },
        ],
      },
      help: {
        hint: 'Which numbers decide how much you write, and which decide how you must organise what you read?',
        walkthrough: [
          { text: '500,000 points a second is a write problem: one by one inserts would not keep up, so points arrive in batches.' },
          { text: '“One metric over a time range” is the common read; how you key the data must make that cheap.' },
          { text: 'A year of detail is too many points to scan, which is why rollups exist.' },
          { text: 'Alerts must not depend on storage speed, so they read from the stream, not the store.' },
        ],
        solution: [{ type: 'list', items: ['About 500,000 points a second, about 5 million series.', 'Common read: one metric over a time range; sometimes one host’s metrics.', 'Three retention tiers: raw 15 days, minute rollups 90 days, hourly rollups one year.', 'Alerts within one minute, independent of storage speed.', 'A few lost points under overload are acceptable; a lost alert is not.'] }],
        why: 'These answers decide how points are written (batched), how data is keyed (metric and time), and why alerts and rollups hang off the stream rather than the store.',
      },
      lessons: ['requirements', 'capacity-estimation'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts a measurement passes through and connect them. Then trace a sample to storage and a dashboard read from storage.',
      question: 'A server measures its latency. Show me how that number reaches a dashboard, and where it waits when storage is busy.',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-agent', 'agent', 'client', 'Host agent', 70, 200], ['s-ingest', 'ingest', 'service', 'Ingest service', 300, 200]], [['s-agent', 's-ingest', 'sends request']]),
        traces: [
          { id: 'sample', label: 'A server’s latency sample reaches the store', token: 'web-17 latency_ms 212', from: { type: 'agent' }, to: { type: 'tsdb' } },
          { id: 'view', label: 'A dashboard loads the last hour of a metric', token: 'GET /query?metric=latency&range=1h', from: { type: 'dashboard' }, to: { type: 'tsdb' }, read: true },
        ],
      },
      help: {
        hint: 'If storage stalls for a minute, where do the 500,000 points a second wait, and who reads them besides storage?',
        walkthrough: [
          { text: 'Agents batch points and send them to the Ingest service, which only checks them and appends them to the Buffer log.', focus: ['agent', 'ingest', 'buffer'] },
          { text: 'The Storage writer reads from the Buffer log at its own pace and writes large chunks to the Time-series store.', focus: ['buffer', 'writer', 'tsdb'] },
          { text: 'The Alert evaluator reads the same log, so a slow store never delays an alert.', focus: ['buffer', 'alerts'] },
          { text: 'Dashboards ask the Query service, which reads from the store, using rollups for long ranges.', focus: ['dash', 'query', 'tsdb', 'rollup'] },
        ],
        solution: [
          { type: 'p', text: '**The buffer log separates arriving from storing.** Ingest only appends; a writer drains the log into the store in big batches; alerts read the log directly; a background job builds rollups. Dashboards read through a query service.' },
          { type: 'code', lang: 'http', code: 'POST /v1/points   [{metric, host, t, value}, … up to 1,000]\n→ 202 accepted\nGET /v1/query?metric=latency&host=*&from=…&to=…&step=1m' },
        ],
        why: 'With a log between ingest and storage, a slow store delays only the dashboards’ newest data, while the points and the alerts keep flowing.',
      },
      lessons: ['batch-stream', 'logs-delivery', 'queues'],
    },
    {
      id: 'data', title: 'Data model', intro: 'Choose how points are keyed in the store. Test two real queries and see which partitions each one touches.',
      question: 'How do you key the points so “one metric over the last hour” is cheap? Then what happens to “every metric for one host”?',
      activity: {
        kind: 'model',
        tables: [{ id: 'points', name: 'points', fields: ['metric', 'host', 'bucket', 'value'] }],
        table: 'points', partitions: 16,
        first: { id: 'q1', text: 'Checkout latency for the last hour, in time order', filter: 'metric', sort: 'bucket' },
        second: { id: 'q2', text: 'Every metric reported by host web-17 in the last 5 minutes', filter: 'host' },
        tradeoffs: [
          { id: 'index-host', label: 'Add an index on host (kept only for recent data)', consequence: 'Host drill-downs read a small index instead of all partitions. Every point now writes twice, so the index must stay small and recent.', verdict: 'sound' },
          { id: 'second-copy', label: 'Write each point a second time, keyed by host', consequence: 'Fast for both queries, but you pay double storage and double write load at 500,000 points a second.', verdict: 'partial' },
          { id: 'scatter', label: 'Accept the scatter for host views and limit how often they run', consequence: 'Fine if host views are rare and capped. During an incident everybody opens them at once, so protect the store.', verdict: 'partial' },
          { id: 'host-key', label: 'Key everything by host instead', consequence: 'Host views become cheap, but every “one metric over time” dashboard, the common query, now scatters across every partition.', verdict: 'risky' },
        ],
      },
      help: {
        hint: 'Which query is far more common, and which field would put all its rows in one partition, already in time order?',
        walkthrough: [
          { text: 'Most reads are one metric over a time range, so partition by metric and sort by time bucket: one partition, already in order.' },
          { text: '“Every metric for one host” filters on host, which is not the partition key, so it asks every partition.' },
          { text: 'You can add an index on host, but each of 500,000 points a second then writes twice.' },
          { text: 'Keep the index to recent data (incidents look at the last few minutes), or accept scatter for the rare host view.' },
        ],
        solution: [
          { type: 'list', items: ['**Partition key: metric. Sort key: time bucket.** One metric over a range reads one partition, in order.', 'A host view filters on host: it scatters unless you add an index (cost: one more write per point).', 'Keep a host index only for recent data, or rate-limit scatter queries.', 'Rollups use the same key at coarser buckets, so long ranges read very few rows.'] },
        ],
        why: 'The key should favour the most common read. Costs that remain for the less common read are visible, and you choose them on purpose.',
      },
      lessons: ['data-models', 'access-patterns', 'indexes'],
    },
    {
      id: 'spike', title: 'Spike', intro: 'The interviewer changes one condition. Predict, run it, then try the options.',
      question: 'Points arrive twice as fast while the store slows down. What should the pipeline do so alerts and dashboards keep working?',
      change: { announce: 'New condition: a deploy makes every agent send twice as much data for 30 seconds, and at the same time the time-series store takes four times longer per write while it compacts.', rule: RULES.queue },
      activity: {
        kind: 'queue', what: 'batches waiting for the storage writer',
        arrival: [300, 600, 1200], workers: [2, 4, 8], serviceMs: 5,
        slow: { from: 10, to: 40, serviceMs: 20, what: 'The time-series store takes 20 ms per batch instead of 5 ms while it compacts.' },
        timeoutS: 2,
        policies: [
          { id: 'wait', label: 'Buffer everything and write it in order', detail: 'Nothing is dropped. The backlog is written whenever storage allows.' },
          { id: 'retry', label: 'Agents resend batches that are not acknowledged in time', detail: 'Agents treat slowness as failure and send again.' },
          { id: 'shed', label: 'Drop or down-sample low-priority metrics once the backlog is too long', detail: 'Keep alert-critical metrics whole and thin out the rest.' },
          { id: 'breaker', label: 'Stop writing to the slow store and keep the points in the log to catch up', detail: 'Reads stay fast; the store is spared. Fresh dashboard data lags until storage recovers.' },
        ],
      },
      help: {
        hint: 'Which consumer must stay fast whatever storage does, and which data can you afford to thin out?',
        walkthrough: [
          { text: 'During the slow period the store handles about 200 batches a second against 600 arriving, so the backlog grows.', focus: ['writer', 'tsdb'] },
          { text: 'The Buffer log holds the surplus, so ingest keeps accepting and the alert evaluator keeps reading fresh points.', focus: ['ingest', 'buffer', 'alerts'] },
          { text: 'If the backlog is still too long, thin out low-priority metrics rather than slowing everything, as the brief allows.', focus: ['writer'] },
          { text: 'Agents must not blindly resend: retries add load while the store is struggling.', focus: ['agent', 'ingest'] },
        ],
        solution: [
          { type: 'list', items: ['The buffer log absorbs the burst; alerts read from it, not the store.', 'If the backlog passes a limit, **sample or drop low-priority metrics** and keep alert-critical ones whole.', 'Agents back off with jitter instead of retrying instantly.', 'Add storage writers only if the surge is long; the log buys the time to decide.'] },
        ],
        why: 'The brief accepts a few lost points but not delayed alerts. Shedding the cheap data and protecting the alert path meets both.',
      },
      lessons: ['backpressure', 'lab-queue-backlog', 'retries'],
    },
  ],
  rules: [
    // Design stage
    { id: 'buffered', stage: 'design', when: { link: [{ type: 'ingest' }, 'stream'], labels: ['publishes event', 'writes to'] }, ack: '{type:ingest} appends to {kind:stream} instead of writing storage itself.', strength: 'You put a log between ingest and storage, so a slow store can’t push back onto the agents.' },
    { id: 'no-buffer', stage: 'design', when: { lacks: 'stream' }, coach: 'Think about a spike: where do the points wait if storage slows down? Consider adding the Buffer log between Ingest and storage.', gap: { text: 'Incoming points had nowhere to wait when storage slowed down.', fix: 'Add a buffer log between ingest and the store.', stage: 'design', lesson: 'logs-delivery' }, priority: 3 },
    { id: 'wire-write', stage: 'design', when: { all: [{ has: { type: 'tsdb' } }, { not: { path: [{ type: 'agent' }, { type: 'tsdb' }] } }] }, coach: 'Connect the write path: Host agent → Ingest service → Buffer log → Storage writer → Time-series store.', priority: 2 },
    { id: 'wire-read', stage: 'design', when: { all: [{ has: { type: 'tsdb' } }, { has: { type: 'dashboard' } }, { not: { path: [{ type: 'dashboard' }, { type: 'tsdb' }] } }] }, coach: 'Connect the read path: Dashboard → Query service → Time-series store.', priority: 2 },
    { id: 'trace-now', stage: 'design', when: { all: [{ path: [{ type: 'agent' }, { type: 'tsdb' }] }, { not: { result: 'trace:sample', is: ['ok', 'hit'] } }] }, coach: 'Press “Trace a request” to follow a latency sample into the store.', priority: 1 },
    { id: 'sample-ok', stage: 'design', when: { result: 'trace:sample', is: 'ok' }, ack: 'A sample made it from {type:agent} to {type:tsdb} through your own arrows.' },
    { id: 'direct-write', stage: 'design', when: { link: [{ type: 'ingest' }, { type: 'tsdb' }], labels: ['writes to', 'reads and writes'] }, priority: 9, ask: { text: '{type:ingest} writes straight into {type:tsdb}. A deploy doubles the traffic and the store slows down. Where do the points go?', choices: [
      { id: 'log', label: 'Into a buffer log, drained by a writer at storage’s pace', reply: 'Yes: the log absorbs the burst, ingest stays fast, and alerts can read the log. Insert one between them.', verdict: 'sound' },
      { id: 'scale', label: 'Add more ingest servers', reply: 'More ingest servers just push more load at the same slow store.', verdict: 'risky' },
      { id: 'reject', label: 'Reject batches when the store is slow and let agents retry', reply: 'That works as a last resort, but agents retrying increases the load, and rejected points are gone if agents are short on memory.', verdict: 'partial' },
    ] }, gap: { text: 'Ingest wrote straight into the store, so a slow store would stall every agent.', fix: 'Append to a buffer log and let a writer drain it into the store.', stage: 'design', lesson: 'logs-delivery' } },
    { id: 'alerts-source', stage: 'design', when: { has: { type: 'alerts' } }, priority: 8, ask: { text: 'The alert evaluator needs fresh data within a minute. Where does it read from?', choices: [
      { id: 'log', label: 'The buffer log, as points arrive', reply: 'Yes: it sees every point as soon as it is accepted, even when the store is behind.', verdict: 'sound' },
      { id: 'store', label: 'Queries to the time-series store every few seconds', reply: 'That works while the store is healthy. When the store slows down, exactly when you need alerts, the alerts are late too.', verdict: 'partial' },
      { id: 'agents', label: 'Straight from the agents', reply: 'Then you build a second ingest path to every server. Read from the log you already have.', verdict: 'risky' },
    ] }, strength: 'You gave alerts their own path from the stream, so a slow store can’t delay an alert.' },
    { id: 'alerts-log', stage: 'design', when: { link: [{ type: 'stream' }, { type: 'alerts' }], labels: ['delivers to'] }, ack: '{type:alerts} reads fresh points from {kind:stream}, independent of storage.' },
    { id: 'rollups', stage: 'design', when: { has: { type: 'rollup' } }, ack: 'You added {type:rollup}: long ranges can read summaries instead of raw points.', strength: 'Rollups keep year-long dashboard queries fast.' },
    { id: 'no-rollup', stage: 'design', when: { all: [{ has: { type: 'tsdb' } }, { lacks: { type: 'rollup' } }] }, priority: 7, ask: { text: 'A dashboard asks for one metric’s daily average over a year. What does {type:tsdb} read?', choices: [
      { id: 'rollup', label: 'Pre-computed hourly summaries, about 8,760 rows', reply: 'Yes: that is a rollup. Add a job that builds them in the background.', verdict: 'sound' },
      { id: 'raw', label: 'Every raw point for the year', reply: 'A year of one metric on one host is about 3 million points. Scanning that for every chart is too slow.', verdict: 'risky' },
      { id: 'cache', label: 'Cache the answer after the first time', reply: 'It helps the second viewer but not the first, and every new range misses. Pre-compute instead.', verdict: 'partial' },
    ] }, gap: { text: 'Long-range queries would have scanned raw points.', fix: 'Add a rollup job that writes per-minute and per-hour summaries, and query the coarsest that fits.', stage: 'design', lesson: 'data-models' } },
    { id: 'push-alt', stage: 'design', when: { answer: 'assume:collect', is: 'pull' }, priority: 5, ask: { text: 'You assumed a collector pulls from each server. Where is it in your design?', choices: [
      { id: 'in-place', label: 'It replaces the agents’ push: the Ingest service fetches from each host', reply: 'A valid alternative: you control the rate and see dead hosts at once. The cost is that ingest must know every host and reach it. The rest of the design is the same.', verdict: 'sound' },
      { id: 'both', label: 'Both: agents push, a collector also pulls', reply: 'Two ways in for the same points means duplicates to reconcile. Pick one path per source.', verdict: 'risky' },
    ] } },
    { id: 'what-write', stage: 'design', when: { link: [{ type: 'writer' }, { type: 'tsdb' }], labels: ['writes to', 'reads and writes'] }, priority: 6, ask: { text: 'Your arrow says the writer writes to the store. Does that tell us how many points go in each write?', choices: [
      { id: 'batch', label: 'Large batches, such as thousands of points per write', reply: 'Yes: 500,000 single-row writes a second would swamp most stores. Batching is what makes the rate possible.', verdict: 'sound' },
      { id: 'single', label: 'One point per write', reply: 'At 500,000 a second each write carries fixed overhead that dominates. Batch them.', verdict: 'risky' },
    ] } },
    // Data model stage
    { id: 'm-q1', stage: 'data', when: { result: 'data:q1', is: 'one-partition' }, ack: 'Your key reads one metric over time from a single partition, in order.', strength: 'You keyed points by metric and time, so the common dashboard query reads one partition in order.' },
    { id: 'm-q1-bad', stage: 'data', when: { result: 'data:q1', is: ['scatter', 'index'] }, priority: 6, coach: 'The dashboard’s main query asks every partition. Try partitioning by the field it filters on, and sorting by time.', gap: { text: 'The most common query, one metric over time, did not read a single partition.', fix: 'Partition by metric and sort by time bucket.', stage: 'data', lesson: 'access-patterns' } },
    { id: 'm-q2-scatter', stage: 'data', when: { result: 'data:q2', is: 'scatter' }, priority: 5, ask: { text: 'Every metric for one host asks all 16 partitions. During an incident fifty engineers open host views. What do you do?', choices: [
      { id: 'recent-index', label: 'Index hosts for recent data only', reply: 'Yes: incidents look at the last few minutes, so a small, recent index serves them without doubling storage.', verdict: 'sound' },
      { id: 'limit', label: 'Rate-limit host views and accept the scatter', reply: 'Reasonable for a rare query. Decide what happens to the fifty-first engineer.', verdict: 'partial' },
      { id: 'nothing', label: 'Nothing: it’s one query', reply: 'Fifty engineers times sixteen partitions is 800 reads, at the moment the store is least healthy.', verdict: 'risky' },
    ] } },
    { id: 'm-q2-index', stage: 'data', when: { result: 'data:q2', is: 'index' }, ack: 'You added an index on host: host views now use it instead of asking every partition.' },
    { id: 'm-index-cost', stage: 'data', when: { result: 'data:q2', is: 'index' }, priority: 4, ask: { text: 'Each point now writes to the table and to the host index. At 500,000 points a second, what do you watch?', choices: [
      { id: 'write-load', label: 'Write load and index size; keep the index to recent data', reply: 'Yes: an index is not free. Every write now does more work, so keep it as small as the question needs.', verdict: 'sound' },
      { id: 'free', label: 'Nothing; indexes are free', reply: 'Each index adds work to every write. At this rate that is a visible cost.', verdict: 'risky' },
    ] } },
    { id: 'm-q2-one', stage: 'data', when: { result: 'data:q2', is: 'one-partition' }, priority: 4, ask: { text: 'Your key makes the host query cheap. What does that do to “one metric over the last hour”?', choices: [
      { id: 'scatters', label: 'It now asks every partition, and that is the common query', reply: 'Yes: you moved the cost to the read that matters most. Compare the two queries before you commit.', verdict: 'partial' },
      { id: 'same', label: 'Nothing changes', reply: 'The metric query now filters on a field that is not the partition key. Test query 1 again.', verdict: 'risky' },
    ] }, gap: { text: 'The key favoured the rarer query over the dashboard’s main one.', fix: 'Key by metric and time; handle host views with an index or a rate limit.', stage: 'data', lesson: 'access-patterns' } },
    { id: 'm-trade-sound', stage: 'data', when: { result: 'data:tradeoff', is: ['index-host', 'second-copy'] }, strength: 'You named the cost of serving host views, rather than ignoring the second query.' },
    // Spike stage
    { id: 'sp-unbounded', stage: 'spike', when: { result: 'spike', is: ['wait:unbounded', 'retry:unbounded'] }, priority: 6, ask: { text: 'The backlog kept growing and fresh dashboards fell far behind. What would you protect first?', choices: [
      { id: 'alerts', label: 'Alerts: they read the log directly and stay fresh; thin out low-priority metrics', reply: 'Yes: the brief accepts lost points but not late alerts. Decide which metrics are low-priority before the incident.', verdict: 'sound' },
      { id: 'all', label: 'Every point equally; nothing may be dropped', reply: 'The brief allows a few lost points. A backlog of everything delays the points that matter most.', verdict: 'risky' },
      { id: 'scale', label: 'Add more storage writers', reply: 'More writers pointed at the same slow store make it slower. Scaling the store is the longer fix.', verdict: 'partial' },
    ] }, gap: { text: 'The backlog grew without bound during the spike, so everything arrived late.', fix: 'Shed or sample low-priority metrics and keep alerts on the log.', stage: 'spike', lesson: 'backpressure' } },
    { id: 'sp-bounded', stage: 'spike', when: { result: 'spike', is: ['shed:bounded', 'breaker:bounded'] }, ack: 'The backlog stayed short, so new data kept arriving on time.', strength: 'You protected the pipeline from a spike by shedding or pausing writes instead of letting the backlog run away.' },
    { id: 'sp-retry', stage: 'spike', when: { result: 'spike', is: 'retry:unbounded' }, priority: 5, coach: 'Agents that resend slow batches add load while the store is already behind. Try shedding or pausing writes instead.' },
    { id: 'sp-which', stage: 'spike', when: { result: 'spike', is: 'shed:bounded' }, priority: 4, ask: { text: 'You dropped points to keep up. Which ones go first?', choices: [
      { id: 'low-priority', label: 'High-volume, low-priority metrics; keep alert-critical metrics whole', reply: 'Yes: choose in advance which metrics are cheap to thin out.', verdict: 'sound' },
      { id: 'random', label: 'Random points from every metric', reply: 'That makes every chart gappy, including the ones that drive alerts. Protect the critical metrics first.', verdict: 'partial' },
      { id: 'newest', label: 'The newest points', reply: 'The newest points are the ones alerts are about. Drop the least valuable, not the freshest.', verdict: 'risky' },
    ] } },
  ],
  solution: {
    design: g([
      ['agent', 'agent', 'client', 'Host agent', 40, 150], ['ingest', 'ingest', 'service', 'Ingest service', 160, 150], ['buffer', 'buffer', 'stream', 'Buffer log', 280, 150],
      ['writer', 'writer', 'worker', 'Storage writer', 400, 80], ['alerts', 'alerts', 'service', 'Alert evaluator', 400, 230], ['tsdb', 'tsdb', 'db', 'Time-series store', 540, 80],
      ['rollup', 'rollup', 'worker', 'Rollup job', 540, 190], ['query', 'query', 'service', 'Query service', 400, 360], ['dash', 'dashboard', 'client', 'Dashboard', 250, 360],
    ], [
      ['agent', 'ingest', 'sends request'], ['ingest', 'buffer', 'publishes event'], ['buffer', 'writer', 'delivers to'], ['buffer', 'alerts', 'delivers to'], ['writer', 'tsdb', 'writes to'],
      ['rollup', 'tsdb', 'reads and writes'], ['dash', 'query', 'sends request'], ['query', 'tsdb', 'reads from'],
    ]),
    why: {
      agent: 'Collects the server’s numbers and sends a batch every 10 seconds, backing off when told to.',
      ingest: 'Checks batches and appends them to the log. Does no storage work, so it stays fast.',
      buffer: 'Holds incoming batches so storage can drain at its own pace and alerts can read fresh data.',
      writer: 'Writes large batches into the store, keyed by metric and time bucket.',
      alerts: 'Evaluates rules on fresh points from the log, so slow storage can’t delay an alert.',
      tsdb: 'Compressed, time-ordered points, partitioned by metric and sorted by time bucket.',
      rollup: 'Builds per-minute and per-hour summaries in the background so long ranges read few rows.',
      query: 'Picks the coarsest resolution that fits the range and reads one partition per metric.',
      dash: 'Asks for one metric over a range; never talks to storage directly.',
    },
    alternatives: { buffer: { types: ['queue'], tradeoff: 'A plain queue works if each point is consumed once, but alerts and the writer both need to read the same points, which a replayable log does without extra copies.' } },
    trace: { title: 'web-17’s latency sample reaches a dashboard', steps: [
      { from: 'agent', to: 'ingest', text: 'web-17 sends a batch of 500 points: metric, host, time and value for each.' },
      { from: 'ingest', to: 'buffer', text: 'Validate and append the batch to the log; reply 202 to the agent.' },
      { from: 'buffer', to: 'alerts', text: 'The alert evaluator reads the batch within seconds and checks “latency above 500 ms for 3 minutes”.' },
      { from: 'buffer', to: 'writer', text: 'The writer reads the same batch and groups points by metric and one-minute bucket.' },
      { from: 'writer', to: 'tsdb', text: 'One write per partition appends the points, sorted by time bucket.' },
      { from: 'dash', to: 'query', text: 'An engineer opens “checkout latency, last hour”; the query asks for step = 1 minute.' },
      { from: 'query', to: 'tsdb', text: 'One partition (metric = checkout latency), already in time order: 60 one-minute rows for the series being charted.' },
    ] },
    tradeoff: 'Keying by metric and time makes the common dashboard query cheap and keeps writes append-friendly, but queries by host need an extra index or a scatter across partitions.',
    otherApproach: 'For a small fleet, a single time-series database with built-in rollups and no separate log is simpler. Add the buffer when bursts or independent consumers (alerts, analytics) appear.',
  },
};
