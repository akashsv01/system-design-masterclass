import type { GenericLesson } from '../lessonTypes';
import { e, layout, n, py } from './_kit';

const PCT = py('sdm/percentiles.py', 'percentile');
const FAN = py('sdm/percentiles.py', 'chance_any_slow');
const SERIAL = py('sdm/availability.py', 'serial');
const REDUNDANT = py('sdm/availability.py', 'redundant');

// 40 response-time samples (ms) with a long tail; sorted for the chart.
const SAMPLES = [38, 40, 41, 42, 43, 44, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 58, 60, 61, 63, 65, 67, 70, 72, 75, 78, 82, 86, 90, 96, 105, 120, 140, 180, 260, 420, 980];
const sortedPts = SAMPLES.map((v, i) => [Math.round(((i + 1) / SAMPLES.length) * 100), v] as [number, number]);
const mean = Math.round(SAMPLES.reduce((a, b) => a + b, 0) / SAMPLES.length);
const pct = (p: number) => SAMPLES[Math.max(1, Math.ceil((p / 100) * SAMPLES.length)) - 1];

export const realtimeDelivery: GenericLesson = {
  id: 'realtime-delivery',
  area: 'Foundations',
  opening: 'It’s the 89th minute and a goal goes in. 200,000 fans have the match page open. How quickly do their screens show 2–1, and how hard does the server work to make that happen?',
  visual: { kind: 'timeline', unit: 's', note: 'One fan polling every 5 seconds; the goal happens at 7 s.', lanes: [{ id: 'srv', label: 'Server' }, { id: 'app', label: 'Fan’s app' }], events: [
    { t: 0, lane: 'app', label: 'poll: any news?', to: { lane: 'srv', t: 0.3 } },
    { t: 5, lane: 'app', label: 'poll: any news?', to: { lane: 'srv', t: 5.3 } },
    { t: 7, lane: 'srv', label: 'GOAL 2–1', tone: 'active' },
    { t: 10, lane: 'app', label: 'poll → 2–1', tone: 'ok', to: { lane: 'srv', t: 10.3 } },
  ] },
  experiment: {
    step: 4, label: 'Poll every', min: 1, max: 30, stepSize: 1, initial: 5, unit: 's',
    compute: (s) => {
      const perMin = Math.round(200000 * (60 / s));
      return { text: `Average delay before a fan sees the goal: **${(s / 2).toFixed(1)} s** (worst case ${s} s). Server load: **${perMin.toLocaleString()} requests/minute**, nearly all answering “no news”. With SSE or WebSockets: delay ≈ one network trip, and requests only when something happens.`, timeline: { upTo: 4 } };
    },
    assumptions: ['200,000 open match pages, one goal at a random moment, polling requests answered instantly.'],
  },
  steps: [
    { kicker: 'Idea', title: 'Polling: ask again and again', body: ['The simplest approach is **polling**: the app asks “anything new?” every few seconds. Most answers are “no”.'], timeline: { upTo: 2 } },
    { kicker: 'Watch', title: 'The goal lands between polls', body: ['The goal happens at 7 s. Nobody asks until the 10 s poll, so the fan sees it 3 seconds late. On average the delay is half the polling interval.'], timeline: { upTo: 4 }, changes: [{ kind: 'chg', text: 'Fan sees the goal 3 s after it happened' }] },
    { kicker: 'Idea', title: 'Keep a line open instead', body: ['**Long polling**: the server holds each request open until there’s news, then answers. **Server-sent events (SSE)**: one long HTTP response the server keeps writing events into. **WebSockets**: a two-way connection either side can send on at any time. In all three, news travels as soon as it exists.'], timeline: { upTo: 4, focus: 2 } },
    { kicker: 'Predict', title: 'Which one for a live score?', body: ['Fans only *receive* updates. The only thing they send is the occasional emoji reaction, which can be a normal request.'], timeline: { upTo: 4 },
      predict: { id: 'pick', prompt: 'Score updates flow one way, server to fan. Which is the simplest good fit?', choices: [
        { id: 'sse', text: 'Server-sent events', why: 'Right. One-way push over plain HTTP, with automatic reconnection built into browsers. WebSockets also work, but give you two-way features you don’t need here.' },
        { id: 'poll', text: 'Polling every second', why: 'That works but costs 200,000 requests a second to say “no news”.' },
        { id: 'ws', text: 'WebSockets, always', why: 'They work, but two-way messaging adds complexity you don’t need for one-way updates. Pick it when clients send often too, as in chat or games.' },
      ], correct: 'sse' } },
    { kicker: 'Try it', title: 'Tune the polling interval', body: ['Make polling faster and watch the load. Make it slower and watch the delay. Push removes the trade-off, at the cost of keeping 200,000 connections open.'] },
  ],
  worked: { title: 'comparing the four', blocks: [
    { type: 'table', head: ['', 'Polling', 'Long polling', 'SSE', 'WebSocket'], rows: [
      ['Delay', 'interval ÷ 2 on average', '~1 trip', '~1 trip', '~1 trip'], ['Direction', 'client asks', 'client asks, server waits', 'server → client', 'both ways'], ['Server cost', 'many empty requests', 'one open request per client', 'one open connection per client', 'one open connection per client'], ['Reconnect', 'n/a', 're-request', 'built into browsers', 'app must handle'], ['Good for', 'rare, non-urgent updates', 'older clients', 'live scores, feeds, notifications', 'chat, games, collaboration'],
    ] },
    { type: 'p', text: 'Open connections aren’t free. Each one holds memory, and a server restart drops them all at once, so clients reconnect in a burst. You’ll design for that in the [live scores case](/cases/case-live-scores).' },
  ] },
  checks: [{ kind: 'numeric', id: 'load', prompt: '50,000 users poll every 10 seconds. How many requests per second does the server handle just for polling?', answer: 5000, tolerance: 0.02, unit: 'requests/s', solution: ['Each user: 1 request / 10 s = 0.1/s', '50,000 × 0.1 = 5,000 requests/s'] }],
  exercise: { id: 'chat', prompt: 'For a chat app where both sides send messages often, which would you pick and why?', checklist: ['Picks WebSockets (two-way).', 'Notes both sides send frequently, so a two-way channel avoids extra requests.'], model: 'WebSockets: both people send and receive often, so one two-way connection avoids opening a new request per message and delivers each message in about one network trip.' },
  next: { id: 'latency', reason: 'Delays add up. Next: measuring latency properly, and why the average lies.' },
};

export const latency: GenericLesson = {
  id: 'latency',
  area: 'Foundations',
  opening: 'The dashboard says checkout averages 80 ms. Support says customers keep complaining it hangs. Both are telling the truth. The average hides the slowest requests, and those are the ones people remember.',
  visual: { kind: 'chart', xLabel: 'percent of requests at or below →', yLabel: 'response time (ms)', note: 'Illustrative sample of 40 checkout requests, sorted fastest to slowest.' },
  experiment: {
    step: 4, label: 'Backend calls per page', min: 1, max: 100, stepSize: 1, initial: 1, unit: 'calls',
    compute: (k) => {
      const p = 1 - 0.99 ** k;
      const pts: [number, number][] = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((x) => [x, Math.round((1 - 0.99 ** x) * 100)]);
      return { text: `If each call is slow 1% of the time, a page waiting on all **${k}** calls is slow **${(p * 100).toFixed(1)}%** of the time.`, chart: { series: [{ name: 'chance page is slow (%)', points: pts, tone: 'fail' }], marks: [{ x: k, y: Math.round(p * 100), label: `${k} calls → ${(p * 100).toFixed(0)}%` }] } };
    },
    assumptions: ['Each backend call is independently slow 1% of the time (its p99), and the page waits for all of them.'],
  },
  steps: [
    { kicker: 'Idea', title: 'Line requests up from fastest to slowest', body: [`Here are 40 real-looking checkout times, sorted. Most take 40–90 ms. A few take far longer. The mean is ${mean} ms, a number that describes almost no actual request.`], chart: { series: [{ name: 'samples', points: sortedPts }], marks: [] } },
    { kicker: 'Idea', title: 'Percentiles describe what people feel', body: [`The **p50** (median) is the time half the requests beat: ${pct(50)} ms. The **p95** is the time 95% beat: ${pct(95)} ms. The **p99**: ${pct(99)} ms. The p99 tells you what your unluckiest regular users experience.`], chart: { series: [{ name: 'samples', points: sortedPts }], marks: [{ x: 50, y: pct(50), label: `p50 ${pct(50)} ms` }, { x: 95, y: pct(95), label: `p95 ${pct(95)} ms` }] }, code: { code: PCT, caption: 'python/sdm/percentiles.py — nearest-rank percentile, tested with pytest' } },
    { kicker: 'Predict', title: 'Does the tail matter?', body: ['“Only 1 in 100 requests is slow” sounds acceptable. But one page load can make many requests.'], chart: { series: [{ name: 'samples', points: sortedPts }], marks: [{ x: 99, y: pct(99), label: `p99 ${pct(99)} ms` }] },
      predict: { id: 'fanout', prompt: 'A page calls 100 backend services in parallel and waits for all of them. Each is slow 1% of the time. Roughly how often is the page slow?', choices: [
        { id: '1', text: 'About 1% of the time', why: 'That would be true for one call. With 100 calls, it’s enough for any one of them to be slow.' },
        { id: '63', text: 'About 63% of the time', why: 'Right. 1 − 0.99¹⁰⁰ ≈ 0.63. Fan-out turns rare tail latency into the common case.' },
        { id: '100', text: 'Every time', why: 'Close, but each call is fast 99% of the time, so sometimes all 100 are fast.' },
      ], correct: '63' } },
    { kicker: 'Failure', title: 'Fan-out makes the tail the norm', body: ['When a request waits for many others, its latency is set by the *slowest* of them. That’s why large systems care about p99 and p99.9, not averages.'], chart: { series: [{ name: 'chance page is slow (%)', points: [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((x) => [x, Math.round((1 - 0.99 ** x) * 100)] as [number, number]), tone: 'fail' }], marks: [{ x: 100, y: 63, label: '100 calls → 63%' }] } },
    { kicker: 'Try it', title: 'Change the fan-out', body: ['Drag the number of backend calls a page waits on.'], code: { code: FAN, caption: 'python/sdm/percentiles.py' } },
  ],
  worked: { title: 'computing percentiles from samples', blocks: [
    { type: 'formula', title: 'Nearest-rank p95 of 40 samples', assumptions: ['40 samples sorted from fastest to slowest'], steps: ['rank = ceil(0.95 × 40) = 38', `p95 = the 38th fastest sample = ${pct(95)} ms`], result: `p95 = ${pct(95)} ms; mean = ${mean} ms`, changed: `Remove the single 980 ms outlier and the mean drops by about 23 ms, while p50 and p95 barely move. Percentiles are robust to one extreme value. The mean isn’t.` },
    { type: 'p', text: 'Tools usually report percentiles over a time window (say, the last minute). Never average percentiles across servers: the mean of ten servers’ p99 values is not the fleet’s p99. Merge the raw distributions instead.' },
  ] },
  checks: [
    { kind: 'choice', id: 'slo', prompt: 'Which target best captures “checkout feels fast for nearly everyone”?', choices: [
      { id: 'p99', text: '99% of checkouts finish within 300 ms', why: 'Right. A tail percentile with a threshold describes nearly every user’s experience.' },
      { id: 'avg', text: 'Average checkout time below 100 ms', why: 'An average can look great while 1 in 20 users waits seconds.' },
    ], correct: 'p99' },
    { kind: 'numeric', id: 'fan', prompt: 'Each of 20 parallel calls is slow 1% of the time. What percent of pages are slow?', answer: 18.2, tolerance: 0.05, unit: '%', solution: ['P(all fast) = 0.99²⁰ ≈ 0.818', 'P(page slow) = 1 − 0.818 = 0.182 → 18.2%'] },
  ],
  exercise: { id: 'avg', prompt: 'Your manager wants to report average latency on the team dashboard. What would you suggest instead, in one or two sentences?', checklist: ['Suggests p50 plus a tail percentile (p95/p99).', 'Explains the average hides slow requests users notice.'], model: 'Show p50 for the typical request and p99 for the slow tail; the average is pulled around by outliers and hides the 1-in-100 experience users actually complain about.' },
  next: { id: 'throughput-bandwidth', reason: 'Latency is how long one request takes. Next: how many requests you can handle at once.' },
};

export const throughputBandwidth: GenericLesson = {
  id: 'throughput-bandwidth',
  area: 'Foundations',
  opening: 'Tickets for a big tour go on sale at 10:00. Last year’s server handled 1,500 requests a second fine. This year 2,000 arrive every second. Is “a bit busier” what happens, or does something break?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('clients', 'client', 'Buyers', { sub: 'arrivals/s', stack: 3 }), n('queue', 'queue', 'Waiting', { value: '0 queued' }), n('server', 'server', 'Server', { sub: '300 at once' }), n('db', 'db', 'Database')],
      edges: [e('clients', 'queue', 'arrive'), e('queue', 'server', 'start'), e('server', 'db')],
      ...layout(220, 470, {
        clients: [{ x: 100, y: 110, w: 150 }, { x: 180, y: 45, w: 200 }],
        queue: [{ x: 320, y: 110, w: 160 }, { x: 180, y: 165, w: 200 }],
        server: [{ x: 540, y: 110, w: 160 }, { x: 180, y: 290, w: 200 }],
        db: [{ x: 740, y: 110, w: 120 }, { x: 180, y: 410, w: 200 }],
      }),
    },
  },
  experiment: {
    step: 4, label: 'Arrivals', min: 500, max: 3000, stepSize: 100, initial: 1500, unit: 'req/s',
    compute: (rate) => {
      const cap = 300 / 0.15;
      const inFlight = rate * 0.15;
      if (rate <= cap) return { text: `In progress: ${rate.toLocaleString()} × 0.15 s = **${Math.round(inFlight)}** of 300 slots. Nothing waits. Throughput = **${rate.toLocaleString()}/s**.`, diagram: { values: { queue: '0 queued', clients: `${rate}/s` }, states: { server: inFlight > 270 ? 'active' : 'idle' } } };
      const growth = rate - cap;
      return { text: `Capacity is 300 ÷ 0.15 s = **2,000/s**. The extra ${growth.toLocaleString()}/s pile up: after one minute **${(growth * 60).toLocaleString()} requests are waiting**, and each new one waits longer. Throughput stays at 2,000/s. Latency grows without limit.`, diagram: { values: { queue: `+${growth.toLocaleString()}/s`, clients: `${rate}/s` }, states: { queue: 'fail', server: 'active' }, tags: { queue: { text: 'growing', tone: 'fail' } } } };
    },
    assumptions: ['Each request takes 150 ms, and the server holds at most 300 requests at once. Arrivals are steady. Waiting requests never give up.'],
  },
  steps: [
    { kicker: 'Idea', title: 'Three numbers, three meanings', body: ['**Latency** is how long one request takes: 150 ms. **Throughput** is how many requests finish per second. **Bandwidth** is how many bytes per second a link can carry, like the width of a pipe, not how much is flowing.'], view: { hide: ['queue'] } },
    { kicker: 'Idea', title: 'Little’s law links them', body: ['Requests in progress = arrival rate × time each spends inside. At 1,500/s and 150 ms, that’s 225 requests in progress at any moment. This is **Little’s law**, and it holds for any stable system: shops, queues, servers.'], view: { hide: ['queue'], values: { server: '225 in progress' }, states: { server: 'focus' } } },
    { kicker: 'Predict', title: 'The server can hold 300 at once', body: ['Its limit comes from threads and database connections: 300 requests in progress.'], view: { hide: ['queue'], values: { server: '300 max' } },
      predict: { id: 'cap', prompt: 'Each request takes 150 ms. What is the most this server can finish per second?', choices: [
        { id: '2000', text: '2,000/s', why: 'Right. 300 slots ÷ 0.15 s each = 2,000 per second. That’s its throughput ceiling.' },
        { id: '300', text: '300/s', why: '300 is how many it holds *at once*. Each slot frees up every 0.15 s, so it serves about 6.7 requests per second.' },
        { id: 'inf', text: 'No limit, as long as the CPU has room', why: 'The bottleneck is slots (threads and connections), not CPU.' },
      ], correct: '2000' } },
    { kicker: 'Failure', title: 'Past the limit, the queue only grows', body: ['At 2,000/s arriving and 2,000/s finishing, the server is exactly full. One more request per second and the waiting line grows forever. Throughput stays flat while latency climbs: the system looks “slow” and then “down”.'], view: { values: { queue: 'growing' }, states: { queue: 'fail', server: 'active' } } },
    { kicker: 'Try it', title: 'Change the arrival rate', body: ['Drag arrivals past 2,000/s. The bottleneck is the first resource to run out. Here it’s the 300 slots, and you could raise it with more servers, shorter requests, or by refusing some requests early.'] },
  ],
  worked: { title: 'checking a ticket drop', blocks: [
    { type: 'formula', title: 'Will 2,000 requests/s fit?', assumptions: ['Arrivals: 2,000/s', 'Time per request: 150 ms', 'Max in progress per server: 300'], steps: ['In progress needed = 2,000 × 0.15 = 300', 'One server holds 300, so it’s exactly at capacity', 'Plan to run at ~70%: 300 ÷ 0.7 ≈ 429 slots needed', '429 ÷ 300 = 1.43, so 2 servers'], result: 'Two servers, not one', changed: 'If the database slows requests to 300 ms, in progress doubles to 600, and you need 600 ÷ 0.7 ÷ 300 ≈ 3 servers. Slower is also less capacity.' },
    { type: 'code', lang: 'python', code: py('sdm/capacity.py', 'in_flight'), caption: 'python/sdm/capacity.py' },
  ] },
  checks: [
    { kind: 'numeric', id: 'little', prompt: 'An API receives 800 requests/s and each takes 250 ms. How many are in progress at once?', answer: 200, tolerance: 0.02, unit: 'requests', solution: ['800 × 0.25 = 200'] },
    { kind: 'choice', id: 'bw', prompt: 'A 1 Gbit/s link carries 100 Mbit/s of traffic. What is its bandwidth?', choices: [
      { id: '1g', text: '1 Gbit/s', why: 'Right. Bandwidth is capacity. 100 Mbit/s is the current throughput.' },
      { id: '100m', text: '100 Mbit/s', why: 'That’s how much is flowing right now (throughput), not how much the link could carry.' },
    ], correct: '1g' },
  ],
  exercise: { id: 'over', prompt: 'Why does latency shoot up, rather than rising gently, once arrivals exceed capacity?', checklist: ['Extra requests join a queue that keeps growing.', 'Each new request waits behind everyone already queued.'], model: 'Beyond capacity the surplus requests have nowhere to go, so the queue grows every second and each new arrival waits behind all of them, which makes latency climb without limit.' },
  next: { id: 'availability', reason: 'Capacity is about load. Next: what happens when parts fail, and what “99.9% available” really allows.' },
};

export const availability: GenericLesson = {
  id: 'availability',
  area: 'Foundations',
  opening: 'Each part of your booking system is up 99.9% of the time. So the system is 99.9% available, right? Not quite. Chain three such parts together and you lose about two hours more downtime a month than you planned for.',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('lb', 'lb', 'Load balancer', { value: '99.9%' }), n('app', 'server', 'App server', { value: '99.9%' }), n('db', 'db', 'Database', { value: '99.9%' }), n('total', 'box', 'Whole path', { value: '?' })],
      edges: [e('lb', 'app'), e('app', 'db')],
      ...layout(250, 470, {
        lb: [{ x: 110, y: 90, w: 170 }, { x: 180, y: 45, w: 200 }],
        app: [{ x: 410, y: 90, w: 170 }, { x: 180, y: 160, w: 200 }],
        db: [{ x: 710, y: 90, w: 170 }, { x: 180, y: 275, w: 200 }],
        total: [{ x: 410, y: 200, w: 220 }, { x: 180, y: 410, w: 220 }],
      }),
    },
  },
  experiment: {
    step: 3, label: 'App server copies', min: 1, max: 4, stepSize: 1, initial: 1, unit: 'copies',
    compute: (k) => {
      const app = 1 - (1 - 0.999) ** k;
      const total = 0.999 * app * 0.999;
      const down = (1 - total) * 30 * 24 * 60;
      return { text: `App tier: 1 − 0.001^${k} = ${(app * 100).toFixed(k > 1 ? 5 : 1)}%. Whole path: **${(total * 100).toFixed(3)}%** ≈ **${down.toFixed(0)} minutes down per month**. The load balancer and database, with one copy each, now dominate.`, diagram: { values: { app: `${(app * 100).toFixed(k > 1 ? 4 : 1)}%`, total: `${(total * 100).toFixed(3)}%` }, subs: { app: `×${k}` }, states: { lb: k > 1 ? 'fail' : 'idle', db: k > 1 ? 'fail' : 'idle' }, tags: k > 1 ? { db: { text: 'single copy', tone: 'fail' }, lb: { text: 'single copy', tone: 'fail' } } : {} } };
    },
    assumptions: ['Failures are independent. A request needs the load balancer, one healthy app server, and the database. A 30-day month.'],
  },
  steps: [
    { kicker: 'Idea', title: 'Availability is a fraction of time', body: ['**Availability** is the share of time a service works. 99.9% (“three nines”) allows 43 minutes of downtime in a 30-day month. 99.99% allows about 4 minutes.'], view: { hide: ['app', 'db', 'total'], states: { lb: 'focus' } } },
    { kicker: 'Predict', title: 'Three parts in a row', body: ['A booking needs all three parts at once. If any one is down, the booking fails.'], view: { hide: ['total'] },
      predict: { id: 'serial', prompt: 'Each part is up 99.9% of the time, independently. How available is the whole path?', choices: [
        { id: '997', text: 'About 99.7%', why: 'Right. 0.999 × 0.999 × 0.999 ≈ 0.997, roughly 130 minutes of downtime a month instead of 43.' },
        { id: '999', text: '99.9%', why: 'Each part can fail at a different time, and any single failure breaks the path. The downtimes add up.' },
      ], correct: '997' } },
    { kicker: 'Watch', title: 'Chains multiply', body: ['Multiply the availabilities of parts a request needs: the whole is always worse than its weakest link. Every extra dependency in the critical path costs nines.'], view: { values: { total: '99.7%' }, states: { total: 'fail' }, tags: { total: { text: '~130 min/month down', tone: 'fail' } } }, code: { code: SERIAL, caption: 'python/sdm/availability.py' } },
    { kicker: 'Try it', title: 'Add copies of one part', body: ['Run more app servers. The tier is down only when every copy is down at the same time. Watch what dominates once the app tier is redundant.'], code: { code: REDUNDANT, caption: 'python/sdm/availability.py — valid only if copies fail independently' } },
  ],
  worked: { title: 'downtime budgets', blocks: [
    { type: 'table', head: ['Availability', 'Downtime per 30 days', 'Per year'], rows: [['99%', '7.2 hours', '3.65 days'], ['99.9%', '43.2 minutes', '8.8 hours'], ['99.95%', '21.6 minutes', '4.4 hours'], ['99.99%', '4.3 minutes', '53 minutes'], ['99.999%', '26 seconds', '5.3 minutes']] },
    { type: 'formula', title: 'Two app servers behind a load balancer, one database', assumptions: ['Each component 99.9%, failures independent'], steps: ['App tier = 1 − (0.001)² = 0.999999', 'Path = 0.999 × 0.999999 × 0.999 ≈ 0.998', 'Downtime ≈ 0.002 × 43,200 min ≈ 86 min/month'], result: '≈ 99.8%: better, but the single load balancer and database now dominate', changed: 'Make the database redundant too (failover replica): ≈ 0.999 × 0.999999 × 0.999999 ≈ 99.9%.' },
    { type: 'callout', tone: 'warn', title: 'Where the formula stops being true', text: 'Redundancy only multiplies away downtime when failures are **independent**. Two servers in the same rack, on the same bad deploy, or behind the same expired certificate fail together.' },
  ] },
  checks: [
    { kind: 'numeric', id: 'down', prompt: 'A service is 99.95% available. How many minutes of downtime does that allow in a 30-day month?', answer: 21.6, tolerance: 0.03, unit: 'minutes', solution: ['30 × 24 × 60 = 43,200 minutes', '0.0005 × 43,200 = 21.6 minutes'] },
    { kind: 'choice', id: 'indep', prompt: 'Two app servers run the same new release, which crashes on start-up. What does redundancy buy you here?', choices: [
      { id: 'nothing', text: 'Nothing: both fail for the same reason at the same time.', why: 'Right. Correlated failures defeat redundancy. Staged rollouts exist for this reason.' },
      { id: 'lots', text: 'Two copies make it 99.9999% available.', why: 'Only if failures are independent. A shared bad release isn’t.' },
    ], correct: 'nothing' },
  ],
  exercise: { id: 'cut', prompt: 'Your checkout path calls five services in a row, each 99.9%. Suggest one design change to improve availability and say what it costs.', checklist: ['Removes a dependency from the critical path, makes it asynchronous, or adds redundancy.', 'Names a cost (complexity, eventual consistency, money).'], model: 'Move non-essential calls like sending the receipt email out of the request path and onto a queue. Checkout then depends on fewer services, at the cost of the email arriving a little later and a queue to operate.' },
  next: { id: 'capacity-estimation', reason: 'You can now reason about load and failure. Next: estimating how much capacity a design needs before you build it.' },
};

export const capacityEstimation: GenericLesson = {
  id: 'capacity-estimation',
  area: 'Foundations',
  opening: 'Sales says “a few million bookings a month”. How many servers is that? How much storage? Two minutes of arithmetic, with the assumptions written down, beats guessing and beats a week of benchmarking at this stage.',
  visual: { kind: 'chart', xLabel: 'hour of day', yLabel: 'requests per second', note: 'Illustrative daily traffic shape with an on-sale spike at 20:00.' },
  experiment: {
    step: 3, label: 'Peak factor', min: 2, max: 100, stepSize: 1, initial: 20, unit: '× average',
    compute: (f) => {
      const avg = 3_000_000 * 10 / 30 / 86_400;
      const peak = avg * f;
      const servers = Math.ceil(peak / (800 * 0.7));
      return { text: `Average ≈ **${avg.toFixed(1)} req/s**. Peak = ${avg.toFixed(1)} × ${f} ≈ **${Math.round(peak).toLocaleString()} req/s** → **${servers} server${servers > 1 ? 's' : ''}** at 800 req/s each, run at 70%.`, chart: { series: [{ name: 'traffic', points: Array.from({ length: 24 }, (_, h) => [h, h === 20 ? Math.round(peak) : Math.round(avg * (0.4 + 0.8 * Math.sin(Math.PI * Math.max(0, h - 6) / 18)))] as [number, number]) }], marks: [{ x: 20, y: Math.round(peak), label: `peak ${Math.round(peak).toLocaleString()}/s` }] } };
    },
    assumptions: ['3 million bookings/month, 10 requests per booking, 30-day month, 800 requests/s per server (measured), plan for 70% utilisation.'],
  },
  steps: [
    { kicker: 'Idea', title: 'Start from what you know', body: ['Write the assumptions down first: **3 million bookings a month**, each about **10 requests** (browse, hold, pay, confirm). That’s 30 million requests a month.'], chart: { series: [{ name: 'traffic', points: [[0, 0]] }] } },
    { kicker: 'Watch', title: 'Average requests per second', body: ['30,000,000 ÷ 30 days ÷ 86,400 seconds per day ≈ **11.6 requests/s**. Tiny. Averages always look tiny.'], chart: { series: [{ name: 'traffic', points: Array.from({ length: 24 }, (_, h) => [h, 11.6] as [number, number]) }] }, changes: [{ kind: 'add', text: 'Average: 11.6 requests/s' }] },
    { kicker: 'Predict', title: 'But traffic isn’t flat', body: ['Ticket sales spike when a popular show goes on sale. The peak can be tens of times the average.'], chart: { series: [{ name: 'traffic', points: Array.from({ length: 24 }, (_, h) => [h, h === 20 ? 232 : Math.round(11.6 * (0.4 + 0.8 * Math.sin(Math.PI * Math.max(0, h - 6) / 18)))] as [number, number]) }], marks: [{ x: 20, y: 232, label: 'on-sale spike' }] },
      predict: { id: 'size', prompt: 'Which number should decide how many servers you run?', choices: [
        { id: 'peak', text: 'The peak', why: 'Right. Capacity has to cover the busiest minute, or that’s exactly when the system falls over.' },
        { id: 'avg', text: 'The average', why: 'Sized for the average, the system is overloaded at every spike, and the spikes are when people are trying to buy.' },
      ], correct: 'peak' } },
    { kicker: 'Try it', title: 'Change the peak factor', body: ['A local theatre might see 5× average at peak. A stadium tour on-sale might see 100×. The server count follows the peak.'] },
  ],
  worked: { title: 'a full estimate: requests, storage, bandwidth', blocks: [
    { type: 'formula', title: 'Requests', assumptions: ['3,000,000 bookings/month', '10 requests per booking', 'Peak = 20 × average', 'One server handles 800 req/s (measured); run at 70%'], steps: ['Monthly = 3M × 10 = 30M requests', 'Average = 30M ÷ (30 × 86,400 s) ≈ 11.6 req/s', 'Peak = 11.6 × 20 ≈ 232 req/s', 'Servers = ceil(232 ÷ (800 × 0.7)) = ceil(0.41) = 1'], result: '1 server handles the load; run 2 so one can fail', changed: 'At a 100× peak: 1,160 req/s → ceil(1,160 ÷ 560) = 3 servers (4 with a spare).' },
    { type: 'formula', title: 'Storage', assumptions: ['One booking record ≈ 1 KB (ids, seat, buyer, price, timestamps)', 'Keep 5 years'], steps: ['Per month = 3M × 1 KB = 3 GB', 'Per year = 36 GB', '5 years = 180 GB'], result: '≈ 180 GB: fits on one database server', changed: 'Store a 200 KB PDF ticket per booking in the database and it’s 3M × 200 KB = 600 GB/month. That belongs in object storage instead.' },
    { type: 'code', lang: 'python', code: py('sdm/capacity.py'), caption: 'python/sdm/capacity.py — tested with pytest' },
  ] },
  checks: [
    { kind: 'numeric', id: 'avg', prompt: 'A service gets 43.2 million requests per day. What is the average per second?', answer: 500, tolerance: 0.02, unit: 'req/s', solution: ['43,200,000 ÷ 86,400 = 500 req/s'] },
    { kind: 'numeric', id: 'servers', prompt: 'Peak is 4,000 req/s. One server handles 1,000 req/s and you run servers at 70%. How many servers?', answer: 6, tolerance: 0.01, unit: 'servers', solution: ['Usable per server = 1,000 × 0.7 = 700', '4,000 ÷ 700 = 5.7 → round up to 6'] },
  ],
  exercise: { id: 'assume', prompt: 'Why write the assumptions down before the arithmetic?', checklist: ['Others can challenge or correct a specific assumption.', 'When an assumption changes, you can redo the estimate quickly.'], model: 'So anyone can see and challenge each input (is 10 requests per booking right?), and when one changes you can rerun the arithmetic instead of starting over.' },
  next: { id: 'stateless-scaling', reason: 'When one server isn’t enough, you add more. Next: what has to be true for that to work.' },
};

export const statelessScaling: GenericLesson = {
  id: 'stateless-scaling',
  area: 'Foundations',
  opening: 'You add a second server to handle the on-sale rush. Within minutes, users report being logged out at random. Nothing is broken. Each server is fine. So why are people losing their logins?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('user', 'client', 'Maya'), n('lb', 'lb', 'Load balancer'), n('s1', 'server', 'Server 1', { value: 'session: Maya' }), n('s2', 'server', 'Server 2', { value: 'no sessions' }), n('store', 'db', 'Session store', { sub: 'shared' })],
      edges: [e('user', 'lb'), e('lb', 's1'), e('lb', 's2'), e('s1', 'store', undefined, { dashed: true }), e('s2', 'store', undefined, { dashed: true })],
      ...layout(330, 470, {
        user: [{ x: 90, y: 165, w: 130 }, { x: 180, y: 40, w: 160 }],
        lb: [{ x: 300, y: 165, w: 170 }, { x: 180, y: 145, w: 190 }],
        s1: [{ x: 540, y: 75, w: 190 }, { x: 92, y: 275, w: 166 }],
        s2: [{ x: 540, y: 255, w: 190 }, { x: 268, y: 275, w: 166 }],
        store: [{ x: 750, y: 165, w: 120 }, { x: 180, y: 410, w: 200 }],
      }),
    },
  },
  steps: [
    { kicker: 'Idea', title: 'Two ways to grow', body: ['**Vertical scaling** means a bigger machine: more cores, more memory. It’s simple, but there’s a ceiling and it stays one point of failure. **Horizontal scaling** means more machines behind a **load balancer** that spreads requests between them.'], view: { hide: ['s2', 'store'], values: { s1: '' } } },
    { kicker: 'Watch', title: 'Server 1 remembers Maya', body: ['Maya logs in. Server 1 keeps her session in its own memory. That makes it a **stateful** server: it holds data other requests depend on.'], view: { hide: ['store'], states: { s1: 'focus' }, tokens: [{ from: 'lb', to: 's1', label: 'log in', tone: 'request' }] } },
    { kicker: 'Predict', title: 'Her next request goes to server 2', body: ['The load balancer sends each request to whichever server is least busy.'], view: { hide: ['store'], tokens: [{ from: 'lb', to: 's2', label: 'GET /my-tickets', tone: 'request' }] },
      predict: { id: 'lost', prompt: 'What does server 2 do with Maya’s request?', choices: [
        { id: 'out', text: 'Treats her as logged out: it has no session for her.', why: 'Right. Server 2’s memory doesn’t contain Maya’s session. State trapped in one server breaks horizontal scaling.' },
        { id: 'ok', text: 'Serves her tickets normally.', why: 'Server 2 never saw her log in, and servers don’t share memory.' },
      ], correct: 'out' } },
    { kicker: 'Fix', title: 'Move the state out', body: ['Make servers **stateless**: store sessions in a shared store, or in a signed token the client sends with every request. Now any server can handle any request, so you can add, remove or restart servers freely.'], view: { values: { s1: 'stateless', s2: 'stateless' }, states: { store: 'focus' }, tokens: [{ from: 's2', to: 'store', label: 'session?', tone: 'request' }] }, changes: [{ kind: 'add', text: 'Sessions in a shared store' }, { kind: 'chg', text: 'Servers keep no per-user state' }] },
    { kicker: 'Trade-off', title: 'What you paid for it', body: ['Every request now checks the session store, which adds a fast network hop and a new dependency that must stay up. “Sticky sessions” (always route Maya to server 1) avoid that but break when server 1 restarts. The usual answer: stateless servers plus a fast, replicated session store or signed tokens.'], view: { values: { s1: 'stateless', s2: 'stateless' } } },
  ],
  worked: { title: 'what “stateless” does and doesn’t mean', blocks: [
    { type: 'p', text: 'Stateless doesn’t mean there’s no state. It means the state lives somewhere shared and durable (a database, a cache, a token), not inside one server’s memory between requests. Caches inside a server are fine as long as losing them only makes things slower, not wrong.' },
    { type: 'table', head: ['Approach', 'Benefit', 'Cost'], rows: [['Sticky sessions', 'No extra lookup', 'Users lose sessions when a server dies; uneven load'], ['Shared session store', 'Any server works; revoke sessions centrally', 'Extra hop per request; store must be highly available'], ['Signed token (e.g. JWT)', 'No lookup at all', 'Hard to revoke before expiry; token size grows']] },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Which server-side data is fine to keep only in one server’s memory?', choices: [
    { id: 'cache', text: 'A cache of venue names that can be reloaded from the database.', why: 'Right. Losing it only costs a reload; nothing becomes wrong.' },
    { id: 'cart', text: 'The contents of a user’s cart.', why: 'If the next request lands elsewhere, or this server restarts, the cart vanishes.' },
  ], correct: 'cache' }],
  exercise: { id: 'why', prompt: 'Why does a stateless service make autoscaling easy?', checklist: ['Any server can handle any request.', 'Servers can be added or removed without losing user data.'], model: 'Because no request depends on a particular server, new servers can take traffic immediately and old ones can be removed at any moment without losing anyone’s session.' },
  next: { id: 'access-patterns', reason: 'The state moved into shared storage, so storage now matters a lot. Next: designing data around the questions the app asks.' },
};

export const FOUNDATIONS2 = [realtimeDelivery, latency, throughputBandwidth, availability, capacityEstimation, statelessScaling];
