import type { GenericLesson } from '../lessonTypes';
import { e, layout, n } from './_kit';

export const insideARequest: GenericLesson = {
  id: 'inside-a-request',
  area: 'Foundations',
  opening: 'Maya tapped Reserve and the server saw her request about 110 ms later. The server itself spent 15 ms on it. Where did the other 95 ms go? Open the request up and time each layer.',
  visual: {
    kind: 'stack',
    layers: [
      { id: 'http', label: 'HTTP', detail: 'POST /holds  {"seat":"F12"}' },
      { id: 'tls', label: 'TLS', detail: 'encrypted, server identity checked' },
      { id: 'tcp', label: 'TCP', detail: 'ordered, lost pieces resent' },
      { id: 'ip', label: 'IP', detail: 'to 203.0.113.7' },
    ],
  },
  experiment: {
    step: 5,
    label: 'Round trip time',
    min: 5, max: 300, stepSize: 5, initial: 30, unit: 'ms',
    compute: (rtt) => {
      const total = 20 + rtt * 3 + 15;
      const reused = rtt + 15;
      return {
        text: `New connection: 20 (DNS) + ${rtt} (TCP) + ${rtt} (TLS) + ${rtt} (request and reply) + 15 (server) = **${total} ms**. Reusing an open connection: ${rtt} + 15 = **${reused} ms**.`,
        stack: { separation: 0.7, tones: { tcp: 'active', tls: 'active', http: 'active' } },
      };
    },
    assumptions: ['DNS answer 20 ms (not cached), TLS 1.3 (one round trip), server work 15 ms, no packet loss, response fits in one round trip.'],
  },
  steps: [
    {
      kicker: 'Idea', title: 'A message inside envelopes',
      body: ['Maya’s request is an **HTTP** message: a method (`POST`), a path (`/holds`), headers, and a JSON body. To cross the internet it is wrapped in three more layers, each with one job. Pull the layers apart to see them.'],
      stack: { separation: 0.8, focus: 'http' },
    },
    {
      kicker: 'Watch', title: 'Find the address: DNS, 20 ms',
      body: ['Computers route by numeric **IP address**, not by name. The phone first asks **DNS**, the internet’s directory, where `tickets.example` lives. The answer, `203.0.113.7`, comes back in about 20 ms and is cached, so the next request skips this step.'],
      stack: { separation: 0.6, focus: 'ip', tones: { ip: 'active' } },
      changes: [{ kind: 'add', text: 'Address known: 203.0.113.7 (+20 ms)' }],
    },
    {
      kicker: 'Watch', title: 'Open a connection: TCP, one round trip',
      body: ['**TCP** sets up a connection so data arrives complete and in order, resending any piece that gets lost. Setting it up takes a **round trip**: a message there and an answer back. Here that is 30 ms.'],
      stack: { separation: 0.6, focus: 'tcp', tones: { ip: 'ok', tcp: 'active' } },
      changes: [{ kind: 'add', text: 'TCP connection open (+30 ms, total 50)' }],
    },
    {
      kicker: 'Watch', title: 'Make it private: TLS, one more round trip',
      body: ['**TLS** encrypts everything above it and checks the server really is `tickets.example`. With TLS 1.3 that costs one more round trip: 30 ms. This is the S in HTTPS.'],
      stack: { separation: 0.6, focus: 'tls', tones: { ip: 'ok', tcp: 'ok', tls: 'active' } },
      changes: [{ kind: 'add', text: 'Encrypted channel (+30 ms, total 80)' }],
    },
    {
      kicker: 'Predict', title: 'Finally, the request itself',
      body: ['Now the HTTP request travels, the server spends 15 ms placing the hold, and the response comes back.'],
      stack: { separation: 0.6, focus: 'http', tones: { ip: 'ok', tcp: 'ok', tls: 'ok', http: 'active' } },
      predict: {
        id: 'total', prompt: 'Round trip 30 ms, server work 15 ms. Counting DNS, TCP and TLS, how long from tap to reply?',
        choices: [
          { id: '125', text: '125 ms', why: 'Right: 20 + 30 + 30 + 30 + 15. The server’s own work is 15 of those 125 ms.' },
          { id: '45', text: '45 ms', why: 'That counts only the request’s round trip and the server. Setting up a new connection adds DNS, TCP and TLS first.' },
          { id: '60', text: '60 ms', why: 'Each setup layer needs its own round trip, and DNS adds 20 ms on top.' },
        ],
        correct: '125',
      },
    },
    {
      kicker: 'Try it', title: 'Move the server farther away',
      body: ['Drag the round trip time. A user in the same city might see 5–10 ms. One on another continent might see 150–250 ms. The server’s 15 ms never changes. Distance multiplies every round trip.'],
      stack: { separation: 0.7 },
    },
  ],
  worked: {
    title: 'what a request looks like on the wire',
    blocks: [
      { type: 'code', lang: 'http', code: 'POST /holds HTTP/1.1\nHost: tickets.example\nContent-Type: application/json\nAuthorization: Bearer eyJhbGciOi...\n\n{"seat": "F12", "event": 9031}', caption: 'The HTTP request inside the TLS layer: method and path, headers, a blank line, then the body.' },
      { type: 'code', lang: 'http', code: 'HTTP/1.1 201 Created\nContent-Type: application/json\n\n{"hold_id": "h_81f2", "expires_at": "2026-11-20T20:10:00Z"}', caption: 'The response: a status code (201 means “created”), headers, body.' },
      { type: 'formula', title: 'Time to first response on a new connection', assumptions: ['DNS not cached: 20 ms', 'Round trip time (RTT): 30 ms', 'TLS 1.3: one round trip', 'Server work: 15 ms'], steps: ['DNS = 20 ms', 'TCP handshake = 1 × RTT = 30 ms', 'TLS handshake = 1 × RTT = 30 ms', 'Request + response = 1 × RTT + 15 = 45 ms', 'Total = 20 + 30 + 30 + 45 = 125 ms'], result: '125 ms, of which 15 ms is the server', changed: 'At RTT 200 ms (another continent): 20 + 200 + 200 + 215 = 635 ms. Same server, five times slower.' },
    ],
  },
  checks: [
    { kind: 'numeric', id: 'far', prompt: 'DNS is cached (0 ms), round trip is 100 ms, server work is 15 ms, new connection with TLS 1.3. Time from tap to reply?', answer: 315, tolerance: 0.02, unit: 'ms', solution: ['DNS: 0 ms (cached)', 'TCP: 100 ms', 'TLS: 100 ms', 'Request + reply: 100 + 15 = 115 ms', 'Total: 315 ms'] },
    { kind: 'choice', id: 'order', prompt: 'Which layer makes sure the pieces of the request arrive complete and in order?', choices: [
      { id: 'tcp', text: 'TCP', why: 'Right. It numbers the pieces, puts them back in order, and resends lost ones.' },
      { id: 'ip', text: 'IP', why: 'IP delivers individual packets with best effort. It doesn’t guarantee order or delivery.' },
      { id: 'tls', text: 'TLS', why: 'TLS provides privacy and identity, and relies on TCP for order.' },
    ], correct: 'tcp' },
  ],
  exercise: { id: 'reuse', prompt: 'Why do browsers and apps keep connections open between requests?', checklist: ['Names the setup cost (TCP and TLS round trips).', 'Says reuse pays that cost once instead of per request.'], model: 'Opening a connection costs a TCP and a TLS round trip before any data moves. Keeping it open pays that cost once, so later requests need only their own round trip.' },
  deeper: [
    { type: 'p', text: 'HTTP/2 sends many requests over one connection at once. HTTP/3 runs over QUIC on UDP, merging the transport and TLS handshakes into one round trip and avoiding TCP’s head-of-line blocking. Where a client has talked to the server before, it can sometimes send data in its very first flight (0-RTT), with replay caveats.' },
  ],
  next: { id: 'latency', reason: 'You can now add up one request’s time. Next: what happens across thousands of requests, and why the average hides the slowest ones.' },
};

export const processesThreads: GenericLesson = {
  id: 'processes-threads',
  area: 'Foundations',
  opening: 'A server has 4 CPU cores. A thousand people press Reserve in the same second. Each request needs 2 ms of CPU and then waits 48 ms for the database. How can 4 cores keep up?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [
        n('proc', 'server', 'Server process', { sub: 'one running program' }),
        n('mem', 'box', 'Shared memory', { sub: 'code, caches, connections' }),
        n('threads', 'box', 'Threads', { sub: 'each handles one request', stack: 3 }),
        n('cores', 'box', 'CPU cores', { sub: '4 run at once', stack: 4 }),
        n('db', 'db', 'Database', { sub: 'answers in 48 ms' }),
      ],
      edges: [e('proc', 'mem', 'owns'), e('proc', 'threads', 'runs'), e('threads', 'cores', 'need'), e('threads', 'db', 'wait on')],
      ...layout(340, 470, {
        proc: [{ x: 140, y: 80, w: 190 }, { x: 180, y: 45, w: 220 }],
        mem: [{ x: 140, y: 250, w: 200 }, { x: 92, y: 180, w: 164 }],
        threads: [{ x: 420, y: 165, w: 180 }, { x: 268, y: 180, w: 160 }],
        cores: [{ x: 690, y: 80, w: 170 }, { x: 92, y: 400, w: 164 }],
        db: [{ x: 690, y: 250, w: 170 }, { x: 268, y: 400, w: 160 }],
      }),
    },
  },
  experiment: {
    step: 4,
    label: 'Threads',
    min: 4, max: 200, stepSize: 4, initial: 4, unit: 'threads',
    compute: (t) => {
      const byThreads = t / 0.05;
      const byCpu = 4 / 0.002;
      const rps = Math.min(byThreads, byCpu);
      const limit = byThreads < byCpu ? 'threads (most are waiting on the database)' : 'CPU (all 4 cores busy)';
      return {
        text: `**${Math.round(rps).toLocaleString()} requests/s.** Limited by ${limit}. Each thread finishes one request per 50 ms = 20/s, so ${t} threads give ${Math.round(byThreads).toLocaleString()}/s. The cores cap out at 4 ÷ 0.002 s = 2,000/s.`,
        diagram: { values: { threads: `${t} threads` }, states: { cores: rps >= byCpu ? 'fail' : 'idle', threads: byThreads < byCpu ? 'active' : 'idle' }, tags: { cores: rps >= byCpu ? { text: '100% busy', tone: 'fail' } : { text: `${Math.round((rps * 0.002 / 4) * 100)}% busy`, tone: 'plain' } } },
      };
    },
    assumptions: ['Each request: 2 ms CPU, then 48 ms waiting on the database. Threads cost no CPU while waiting. No other limits.'],
  },
  steps: [
    { kicker: 'Idea', title: 'A process is a running program', body: ['When the server starts, the operating system creates a **process**: the program plus its own private memory. Other processes can’t touch that memory.'], view: { hide: ['threads', 'cores', 'db'] } },
    { kicker: 'Idea', title: 'Threads share the process', body: ['Inside the process run **threads**: independent sequences of steps that share the process’s memory. A common design gives each incoming request its own thread.'], view: { hide: ['cores', 'db'], states: { threads: 'focus' } }, changes: [{ kind: 'add', text: 'Threads inside the process' }] },
    { kicker: 'Watch', title: 'Most of the time, threads wait', body: ['A request needs the CPU for 2 ms, then waits 48 ms for the database. While it waits it needs no core at all, so another thread can use that core.'], view: { states: { db: 'active' }, tokens: [{ from: 'threads', to: 'db', label: 'query… 48 ms', tone: 'request' }] } },
    { kicker: 'Idea', title: 'Concurrency vs parallelism', body: ['**Parallelism** is doing things at the same instant: at most 4 here, one per core. **Concurrency** is having many things *in progress* at once, most of them waiting. A server with 100 threads on 4 cores is highly concurrent and 4-way parallel.'], view: { states: { cores: 'focus', threads: 'active' } } },
    { kicker: 'Try it', title: 'How many threads does it take?', body: ['Start at 4 threads, one per core, and add more. Watch which limit you hit first.'] },
  ],
  worked: { title: 'how many threads for 1,000 requests a second?', blocks: [
    { type: 'formula', title: 'Threads needed (Little’s law)', assumptions: ['1,000 requests/s arrive', 'Each request takes 50 ms end to end (2 ms CPU + 48 ms waiting)'], steps: ['In-flight requests = arrival rate × time each = 1,000 × 0.050 s', '= 50 requests in progress at any moment', 'So about 50 threads are busy at once', 'CPU load = 1,000 × 2 ms = 2,000 ms of CPU per second = 2 of the 4 cores'], result: '~50 threads; the CPU is half used', changed: 'If the database slows to 198 ms per query: 1,000 × 0.2 s = 200 threads, while CPU use stays at 2 cores. Slow dependencies cost threads, not CPU.' },
    { type: 'p', text: 'This is why a slow database can take a server down even when its CPU is mostly unused: every waiting request holds a thread, and the pool runs out.' },
  ] },
  checks: [
    { kind: 'numeric', id: 'threads', prompt: '400 requests/s arrive and each takes 100 ms end to end. About how many requests are in progress at once?', answer: 40, tolerance: 0.05, unit: 'requests', solution: ['in progress = rate × time', '= 400/s × 0.1 s', '= 40'] },
    { kind: 'choice', id: 'cp', prompt: 'A laptop with one core plays music while you type. Is that parallel?', choices: [
      { id: 'conc', text: 'No. It’s concurrent: the core switches between them quickly.', why: 'Right. With one core, only one thing runs at any instant. Fast switching makes both appear to progress.' },
      { id: 'par', text: 'Yes, both run at the same instant.', why: 'One core can execute one instruction stream at a time. That’s concurrency, not parallelism.' },
    ], correct: 'conc' },
  ],
  exercise: { id: 'slowdb', prompt: 'The database gets slower but the server’s CPU usage drops. Why might the server still start refusing requests?', checklist: ['Each waiting request holds a thread (or connection).', 'The thread pool or connection pool runs out even though the CPU is mostly unused.'], model: 'Each request now waits longer while holding a thread, so many more threads are busy waiting; when the pool is exhausted, new requests are refused even though the CPU has nothing to do.' },
  deeper: [{ type: 'p', text: 'Python has a Global Interpreter Lock (GIL) in its standard build: threads still help with waiting on I/O, but CPU-heavy Python code doesn’t run in parallel on threads. Event loops (`asyncio`) handle many waiting requests with few threads by switching at every `await`. Separate processes give true parallelism at the cost of not sharing memory.' }],
  next: { id: 'memory-disk', reason: 'Threads spend their lives waiting. Next: how long the things they wait on actually take.' },
};

export const memoryDisk: GenericLesson = {
  id: 'memory-disk',
  area: 'Foundations',
  opening: 'Reading a seat’s status from memory takes about a tenth of a microsecond. Reading it from a spinning disk can take ten milliseconds. That’s 100,000 times longer. Most of system design is arranging work around gaps like that.',
  visual: { kind: 'chart', xLabel: '', yLabel: 'time per access (µs, log scale)', chartKind: 'bar', yLog: true, note: 'Log scale: each gridline is 10× the one below. Typical orders of magnitude, not benchmarks; your hardware will differ.', categories: ['memory', 'SSD read', 'same-DC round trip', 'disk seek', 'cross-ocean round trip'] },
  steps: [
    { kicker: 'Idea', title: 'Memory: fast and forgetful', body: ['**Memory (RAM)** holds what running programs use right now. Reading it takes around 0.1 µs (a microsecond is a millionth of a second). Turn the power off and it’s gone.'], chart: { series: [{ name: 'values', points: [[0, 0.1]] }] } },
    { kicker: 'Watch', title: 'SSDs: durable, about 1,000× slower', body: ['An **SSD** keeps data when the power goes off. A random read takes roughly 100 µs: a thousand memory reads.'], chart: { series: [{ name: 'values', points: [[0, 0.1], [1, 100]] }] }, changes: [{ kind: 'add', text: 'SSD read ≈ 100 µs' }] },
    { kicker: 'Watch', title: 'The network inside a data centre', body: ['Asking another machine in the same building and getting an answer takes around 500 µs. A database on another server is at least that far away.'], chart: { series: [{ name: 'values', points: [[0, 0.1], [1, 100], [2, 500]] }] } },
    { kicker: 'Predict', title: 'Spinning disks and oceans', body: ['A spinning hard disk must physically move its arm to the data, around 10 ms. A round trip across an ocean is about 150 ms.'], chart: { series: [{ name: 'values', points: [[0, 0.1], [1, 100], [2, 500], [3, 10000], [4, 150000]] }] },
      predict: { id: 'cache', prompt: 'A seat-map page needs 40 small reads. Which change helps most?', choices: [
        { id: 'mem', text: 'Keep a copy of the seat map in memory on the server.', why: 'Right. 40 × 0.1 µs is nothing, whereas 40 network round trips to the database is about 20 ms. That’s the case for caching, as long as the copy stays fresh enough.' },
        { id: 'cpu', text: 'Buy a faster CPU.', why: 'The CPU isn’t the bottleneck. The time goes to waiting on storage and the network.' },
      ], correct: 'mem' } },
    { kicker: 'Trade-off', title: 'Fast or safe: pick per piece of data', body: ['Memory is fast but lost on a crash, so anything that must survive (a confirmed booking) has to reach durable storage before you say “confirmed”. Things you can rebuild (a cached seat map) can live in memory.'], chart: { series: [{ name: 'values', points: [[0, 0.1], [1, 100], [2, 500], [3, 10000], [4, 150000]] }] } },
  ],
  worked: { title: 'the same numbers on a human scale', blocks: [
    { type: 'table', head: ['Operation', 'Typical time', 'If a memory read took 1 second'], rows: [
      ['Memory read', '0.1 µs', '1 second'], ['SSD random read', '~100 µs', '~17 minutes'], ['Round trip within a data centre', '~500 µs', '~1.4 hours'], ['Spinning disk seek', '~10 ms', '~1.2 days'], ['Round trip across an ocean', '~150 ms', '~17 days'],
    ] },
    { type: 'p', text: 'These are order-of-magnitude figures for intuition, not benchmarks. Real hardware varies by a factor of a few, but the ratios are what drive design: cache what you read often, batch what you write, and avoid round trips in loops.' },
  ] },
  checks: [{ kind: 'choice', id: 'loop', prompt: 'A page makes 100 database calls in a loop, each a same-data-centre round trip (~0.5 ms). What dominates its time?', choices: [
    { id: 'net', text: 'About 50 ms of round trips.', why: 'Right. 100 × 0.5 ms. One query that fetches all 100 rows at once would take a single round trip.' },
    { id: 'cpu', text: 'The CPU work to build the page.', why: 'Building the page takes microseconds, while the round trips add up to tens of milliseconds.' },
  ], correct: 'net' }],
  exercise: { id: 'durable', prompt: 'Why must a booking be written to durable storage before the app says “Confirmed”?', checklist: ['Memory is lost on a crash or restart.', 'Saying confirmed before it is durable can lose a promised booking.'], model: 'If it only exists in memory, a crash right after the reply loses it, and the buyer holds a confirmation the system no longer remembers.' },
  next: { id: 'tcp-udp', reason: 'Data also has to cross the network. Next: the two main ways to send it, and what each guarantees.' },
};

export const tcpUdp: GenericLesson = {
  id: 'tcp-udp',
  area: 'Foundations',
  opening: 'One packet of a video call gets lost. Should the network wait for it to be resent? For a file download, yes. For a live call, the resent packet would arrive too late to play. Two transport protocols make opposite choices.',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Idea', title: 'Data travels in packets', body: ['Data crosses the internet in small **packets**. Each can be delayed, reordered, or lost. The transport layer decides what to do about that.'],
      compare: { left: { title: 'TCP', points: ['Opens a connection first (one round trip)', 'Numbers every byte'] }, right: { title: 'UDP', points: ['No connection: just send', 'Each packet stands alone'] } } },
    { kicker: 'Watch', title: 'Packet 3 is lost', body: ['Packets 1, 2, 4, 5 arrive and packet 3 doesn’t.'],
      compare: { left: { title: 'TCP', points: ['Delivers 1, 2', 'Holds 4 and 5 back until 3 is resent', 'App sees 1 2 3 4 5, a little late'], verdict: 'complete and ordered, may stall', tone: 'plain' }, right: { title: 'UDP', points: ['Delivers 1, 2, 4, 5 as they arrive', 'Nobody resends 3', 'App decides what to do'], verdict: 'fast, may have gaps', tone: 'plain' } },
      changes: [{ kind: 'del', text: 'Packet 3 lost' }] },
    { kicker: 'Predict', title: 'Choose for a live call', body: ['Audio frames are 20 ms each. A resend takes a full round trip, say 80 ms.'],
      compare: { left: { title: 'TCP', points: ['Waits ~80 ms for frame 3', 'Frames 4, 5 wait too'] }, right: { title: 'UDP', points: ['Plays 4, 5 on time', 'Hides the missing 20 ms'] } },
      predict: { id: 'call', prompt: 'Which transport fits a live voice call better?', choices: [
        { id: 'udp', text: 'UDP', why: 'Right. A late frame is useless, and a 20 ms glitch beats an 80 ms freeze. Calls run on UDP-based protocols.' },
        { id: 'tcp', text: 'TCP', why: 'TCP’s resend would arrive after the moment to play it has passed, and it would stall the frames behind it.' },
      ], correct: 'udp' } },
    { kicker: 'Trade-off', title: 'Pick by what a late or missing piece costs', body: ['Use TCP when every byte matters: web pages, APIs, file transfers, database connections. Use UDP when freshness matters more than completeness: live audio and video, game state, DNS lookups (small, easy to just ask again).'],
      compare: { left: { title: 'TCP for', points: ['HTTP/1.1 and HTTP/2', 'Database connections', 'File downloads'], tone: 'ok' }, right: { title: 'UDP for', points: ['Voice and video calls', 'Multiplayer game updates', 'DNS, QUIC (HTTP/3)'], tone: 'ok' } } },
  ],
  worked: { title: 'what each guarantees', blocks: [
    { type: 'table', head: ['', 'TCP', 'UDP'], rows: [['Setup', 'Handshake, 1 round trip', 'None'], ['Delivery', 'Resends lost data', 'Best effort'], ['Order', 'Guaranteed', 'Not guaranteed'], ['Flow control', 'Slows down for slow receivers', 'None (app must care)'], ['Head-of-line blocking', 'Yes: one loss stalls later data', 'No']] },
    { type: 'p', text: 'HTTP/3 runs on QUIC, which is built on UDP but adds its own reliability per stream, so one lost packet stalls only the stream it belongs to.' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'A multiplayer game sends each player’s position 30 times a second. A packet is lost. What should happen?', choices: [
    { id: 'skip', text: 'Ignore it. The next update 33 ms later carries the newer position.', why: 'Right. Old positions are worthless once a newer one arrives.' },
    { id: 'resend', text: 'Resend it, so every position is shown.', why: 'By the time it arrives, two newer positions exist. Showing it would move the player backwards.' },
  ], correct: 'skip' }],
  exercise: { id: 'pick', prompt: 'A payments API must never lose a request. TCP or UDP, and why?', checklist: ['Chooses TCP.', 'Says lost or reordered bytes would corrupt the request.'], model: 'TCP: every byte of a payment request must arrive, in order. Waiting a little for a resend is far better than a corrupted request.' },
  next: { id: 'http-rest-rpc', reason: 'On top of TCP sits HTTP. Next: how to shape the requests themselves.' },
};

export const httpRestRpc: GenericLesson = {
  id: 'http-rest-rpc',
  area: 'Foundations',
  opening: 'The first booking app sent `POST /reserve`. It worked. But what happens when the phone loses signal and retries? And how does a new client know what other operations exist? How you shape requests decides how safely clients can use them.',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Idea', title: 'REST: resources plus standard methods', body: ['**REST** names things (*resources*) with URLs and acts on them with a small set of HTTP methods: `GET` reads, `POST` creates, `PUT` replaces, `PATCH` changes part, `DELETE` removes.'],
      compare: { left: { title: 'REST', points: ['`GET /events/9031/seats?status=free`', '`POST /holds`  `{"seat": "F12"}`', '`DELETE /holds/h_81f2`'] }, right: { title: 'What it means', points: ['List free seats', 'Create a hold', 'Release that hold'] } } },
    { kicker: 'Idea', title: 'RPC: call a function over the network', body: ['**RPC** (remote procedure call) exposes operations as named functions with typed arguments, like `HoldSeat(event, seat)`. gRPC is a popular framework for it.'],
      compare: { left: { title: 'REST', points: ['`POST /holds`', 'Status code + JSON'] }, right: { title: 'RPC', points: ['`BookingService.HoldSeat({event: 9031, seat: "F12"})`', 'Typed request and response, generated client code'] } } },
    { kicker: 'Predict', title: 'The retry problem', body: ['The phone sends “create a hold”, the connection drops before the reply arrives, and the app retries.'],
      compare: { left: { title: 'GET /holds/h_81f2', points: ['Read twice, nothing changes'], tone: 'ok', verdict: 'safe to retry' }, right: { title: 'POST /holds', points: ['Sent twice → maybe two holds'], tone: 'fail', verdict: 'needs protection' }, focus: 'right' },
      predict: { id: 'idem', prompt: 'Which methods does the HTTP standard define as *idempotent* (repeating them has the same effect as doing them once)?', choices: [
        { id: 'a', text: 'GET, PUT, DELETE', why: 'Right. `PUT /holds/h1` with the same body twice leaves the same state, and so does deleting twice. `POST` is not idempotent by definition, which is why retried POSTs need an idempotency key.' },
        { id: 'b', text: 'GET, POST', why: 'POST creates something new each time it’s processed, so repeating it can create two.' },
        { id: 'c', text: 'All of them', why: 'POST and PATCH aren’t guaranteed to be idempotent.' },
      ], correct: 'a' } },
    { kicker: 'Trade-off', title: 'When each fits', body: ['REST suits public APIs: browsers, caches and proxies understand it, and anyone can try it with `curl`. RPC suits service-to-service calls inside a company: strict types, generated clients, efficient binary encoding. Many systems use REST at the edge and RPC inside.'],
      compare: { left: { title: 'REST is good at', points: ['Public APIs, web clients', 'HTTP caching of GETs', 'Easy debugging'], tone: 'ok' }, right: { title: 'RPC is good at', points: ['Internal service calls', 'Strict contracts, codegen', 'Streaming, compact payloads'], tone: 'ok' } } },
  ],
  worked: { title: 'status codes worth knowing', blocks: [
    { type: 'table', head: ['Code', 'Meaning', 'Booking example'], rows: [['200 OK', 'Success with a body', 'GET a hold'], ['201 Created', 'A new resource exists', 'POST /holds succeeded'], ['400 Bad Request', 'The request is malformed', 'Seat id missing'], ['401 / 403', 'Not signed in / not allowed', 'Wrong account'], ['404 Not Found', 'No such resource', 'Unknown hold id'], ['409 Conflict', 'Conflicts with current state', 'Seat already held'], ['429 Too Many Requests', 'Slow down', 'Rate limit hit'], ['500 / 503', 'Server error / unavailable', 'Database down']] },
    { type: 'p', text: 'A 409 for “seat already held” tells the client exactly what happened. That beats a generic 500, which tells it nothing and invites a retry.' },
  ] },
  checks: [
    { kind: 'choice', id: 'code', prompt: 'Leo tries to hold F12 but Maya holds it. Which status code fits best?', choices: [
      { id: '409', text: '409 Conflict', why: 'Right. The request is valid, but it conflicts with the seat’s current state.' },
      { id: '500', text: '500 Internal Server Error', why: 'Nothing broke on the server. The answer is simply “no”.' },
      { id: '404', text: '404 Not Found', why: 'The seat exists. It just isn’t available.' },
    ], correct: '409' },
    { kind: 'choice', id: 'rest', prompt: 'Which is the more resource-oriented REST design for cancelling a hold?', choices: [
      { id: 'del', text: '`DELETE /holds/h_81f2`', why: 'Right. The hold is a resource and DELETE removes it. Repeating it is harmless.' },
      { id: 'post', text: '`POST /cancelHold?id=h_81f2`', why: 'That’s an RPC-style verb in a URL. It works, but loses the standard meaning (and idempotency) of DELETE.' },
    ], correct: 'del' },
  ],
  exercise: { id: 'choose', prompt: 'You are designing the booking service’s call to an internal pricing service, 5,000 times a second. REST or RPC, and why?', checklist: ['Chooses a style and gives a concrete reason (types/codegen/efficiency, or simplicity/tooling).', 'Notes the call is internal, so public-client compatibility matters less.'], model: 'RPC (e.g. gRPC): it’s internal, high-volume, and benefits from a strict typed contract and compact encoding; public-web friendliness doesn’t matter here.' },
  next: { id: 'realtime-delivery', reason: 'Request and response covers clients asking. Next: how a server pushes updates the client didn’t ask for.' },
};

export const FOUNDATIONS1 = [insideARequest, processesThreads, memoryDisk, tcpUdp, httpRestRpc];
