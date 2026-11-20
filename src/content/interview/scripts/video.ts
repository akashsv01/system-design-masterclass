import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const video: InterviewScript = {
  caseId: 'case-video',
  track: 'hld',
  doLine: 'Design video upload and playback, watch a transcoding queue back up behind a slow transcoder, then keep cached video playing when storage goes offline',
  skills: ['architecture', 'caching', 'capacity', 'reliability'],
  brief: {
    interviewer: { name: 'Mateo', role: 'staff engineer on the video platform team' },
    intro: 'We run a video site. Creators upload; many more people watch. A video that goes viral must not take our storage down, and a creator’s upload must never just disappear.',
    users: 'Creators who upload videos, and viewers who watch them on phones, laptops and TVs with very different connections.',
    needs: ['Creators upload a video and see it become watchable shortly after', 'Viewers press play and start watching within a couple of seconds', 'Playback adapts to the viewer’s connection, switching quality mid-video'],
    mustHold: ['An uploaded video is never lost', 'Playback keeps working for popular videos even when parts of the back end are down', 'One viral video cannot overload the storage that holds the originals'],
    constraints: ['500 hours of video uploaded every minute', '1 billion hours watched every day', 'A small share of videos gets most of the views; most are rarely watched', 'It is fine if a new video takes a few minutes to become watchable', 'Each video is cut into segments of a few seconds, in several qualities'],
    outOfScope: ['Live streaming', 'Recommendations and search', 'Comments and subscriptions'],
    terms: [
      { term: 'transcoding', meaning: 'converting an uploaded video into several sizes and qualities that phones and TVs can play' },
      { term: 'segment', meaning: 'a few seconds of video stored as its own small file, in one quality. Once written, a segment never changes' },
      { term: 'manifest', meaning: 'the list of a video’s segments in each quality. The player reads it first, then fetches segments' },
      { term: 'origin', meaning: 'the storage that holds the real files. Everything else holds copies' },
      { term: 'CDN', meaning: 'servers near viewers that keep copies of popular segments, so most requests never reach the origin' },
    ],
    firstMove: 'A viewer taps play. Show me where the video’s pieces come from, and what stops a million people watching the same video from hammering your storage. Then trace “watch a video” through your design.',
  },
  palette: [
    { type: 'creator', kind: 'client', name: 'Creator app', blurb: 'Where a creator uploads a video file.' },
    { type: 'viewer', kind: 'client', name: 'Video player', blurb: 'Plays a video: reads the manifest, then fetches segments and switches quality as the connection changes.' },
    { type: 'upload', kind: 'service', name: 'Upload service', blurb: 'Receives the original file, saves it and starts the processing.' },
    { type: 'jobs', kind: 'queue', name: 'Transcode queue', blurb: 'Holds “make this video playable” jobs until a transcoder is free.' },
    { type: 'transcode', kind: 'worker', name: 'Transcoder', blurb: 'Takes a job, cuts the video into segments and makes each quality. Slow, heavy work.' },
    { type: 'origin', kind: 'storage', name: 'Origin storage', blurb: 'Object storage holding the originals and every segment. Durable, but far from viewers.' },
    { type: 'edge', kind: 'cache', name: 'CDN edge cache', blurb: 'Servers near viewers holding copies of popular segments. A miss goes back to the origin.' },
    { type: 'catalog', kind: 'service', name: 'Video catalogue', blurb: 'Serves a video’s title and manifest so the player knows which segments to ask for.' },
    { type: 'metadb', kind: 'db', name: 'Video metadata', blurb: 'One row per video: owner, title, status (processing or ready), manifest location.' },
  ],
  verbs: ['sends request', 'writes to', 'reads from', 'reads and writes', 'publishes event', 'delivers to', 'invalidates', 'calls'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'scale', q: 'How does uploading compare with watching?', a: 'About 500 hours uploaded a minute, but 1 billion hours watched a day. Watching is far bigger than uploading.' },
          { id: 'skew', q: 'Are all videos watched equally?', a: 'No. A small share of videos gets most of the views; most are rarely watched.' },
          { id: 'delay', q: 'How soon after upload must a video be watchable?', a: 'A few minutes is fine. Creators see “processing” until it is ready.' },
          { id: 'quality', q: 'Does every viewer get the same quality?', a: 'No. The player picks a quality for its connection and can switch part-way through.' },
          { id: 'edit', q: 'Can a video be changed after it is published?', a: 'No. A change is a new upload. Once a segment is written it stays the same.' },
          { id: 'live', q: 'Do we need live streaming?', a: 'Not today. Uploaded videos only.' },
        ],
        assumptions: [
          { id: 'delivery', q: 'Where do viewers get segments from?', options: [
            { id: 'direct', label: 'Straight from our own storage', consequence: 'Every view hits the origin. A viral video concentrates millions of reads on a few files.' },
            { id: 'cdn', label: 'From a CDN near them, filled from storage on a miss', consequence: 'Most requests never reach storage. You must handle the first miss for a new segment.' },
          ] },
          { id: 'qualities', q: 'Which qualities do you make at upload?', options: [
            { id: 'all', label: 'Every quality for every video', consequence: 'Simple, but you spend compute and storage on videos nobody watches.' },
            { id: 'common', label: 'The common ones now; rare ones the first time someone asks', consequence: 'Cheaper for the long tail, but the first viewer of a rare quality waits.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers tell you where the load will be, and which parts of the work can wait?',
        walkthrough: [
          { text: 'Watching dwarfs uploading, so the read path decides the design.' },
          { text: 'A few videos get most views: copies near viewers will serve most requests.' },
          { text: 'Segments never change, so copies never go stale.' },
          { text: 'A few minutes of delay is fine, so transcoding can run later from a queue.' },
        ],
        solution: [{ type: 'list', items: ['Reads (1 billion hours a day) far outnumber uploads.', 'Popularity is skewed: cache the popular segments near viewers.', 'Segments never change, so caches need no invalidation.', 'Processing may take minutes: queue the transcoding.', 'Quality varies per viewer, so make several qualities per video.'] }],
        why: 'These answers decide that the read path is built around copies near the viewer, and that transcoding is background work that must not block uploads.',
      },
      lessons: ['requirements'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts for uploading and for watching, and connect them. Then trace “watch a video” through your own design.',
      question: 'A viewer taps play. Where do the segments come from, and what keeps a viral video from overloading your storage?',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-viewer', 'viewer', 'client', 'Video player', 60, 220], ['s-origin', 'origin', 'storage', 'Origin storage', 420, 220]], []),
        traces: [
          { id: 'watch', label: 'Watch a video (fetch one segment)', token: 'GET /seg/720p/0042', from: { type: 'viewer' }, to: { type: 'origin' }, read: true },
          { id: 'manifest', label: 'Start a video (fetch the manifest)', token: 'GET /videos/77/manifest', from: { type: 'viewer' }, to: { type: 'metadb' } },
          { id: 'upload', label: 'Upload a video', token: 'PUT original.mp4', from: { type: 'creator' }, to: { type: 'transcode' } },
        ],
      },
      help: {
        hint: 'If a million people watch the same segment, how many of those requests should reach Origin storage?',
        walkthrough: [
          { text: 'The player asks Video catalogue for the manifest: a small, per-video list of segments.', focus: ['viewer', 'catalog', 'metadb'] },
          { text: 'It then fetches segments from the CDN edge cache, which is close to the viewer.', focus: ['viewer', 'edge'] },
          { text: 'Only a miss goes on to Origin storage. Segments never change, so copies can live a long time.', focus: ['edge', 'origin'] },
          { text: 'Uploads take a different road: Upload service saves the original and queues a transcode job.', focus: ['creator', 'upload', 'jobs'] },
          { text: 'Transcoder takes jobs, writes segments to Origin storage and marks the video ready.', focus: ['transcode', 'origin', 'metadb'] },
        ],
        solution: [
          { type: 'p', text: '**Two roads.** Watching: player → manifest from Video catalogue → segments from the CDN edge cache → origin only on a miss. Uploading: Upload service saves the original, queues a job, and a Transcoder writes segments back to Origin storage.' },
          { type: 'code', lang: 'http', code: 'GET /videos/77/manifest        → list of segments per quality\nGET /seg/720p/0042.ts           → served by the edge; origin on a miss\nCache-Control: public, max-age=31536000, immutable' },
        ],
        why: 'The read path is the big one, so it goes through copies near the viewer. Because segments never change, the cache needs no invalidation, and the origin sees only first-time misses.',
      },
      lessons: ['cdn', 'caching', 'queues'],
    },
    {
      id: 'transcoding', title: 'Transcoding backlog', intro: 'A creator-heavy hour sends many videos at once, and then a transcoder fault makes every job take four times as long. Choose a policy and a worker count, run it, and watch the queue.',
      question: 'Uploads wait in the Transcode queue for a free transcoder. What keeps the wait from running away when the transcoders slow down?',
      activity: {
        kind: 'queue', what: 'ten-second pieces waiting to be transcoded', arrival: [2, 6, 12], workers: [1, 4, 8], serviceMs: 500,
        slow: { from: 20, to: 40, serviceMs: 2000, what: 'a transcoder fault makes each piece take four times as long' },
        timeoutS: 20,
        policies: [
          { id: 'wait', label: 'Keep every job and wait', detail: 'Accept every upload. Jobs wait their turn; creators see “processing” longer.' },
          { id: 'shed', label: 'Refuse new uploads when the wait is long', detail: 'Tell creators to try again later once the wait would pass the limit. Waits stay short, but some uploads are turned away.' },
          { id: 'retry', label: 'Creators retry when it is slow', detail: 'A creator who waits too long sends the upload again. The abandoned job stays in the queue.' },
        ],
      },
      help: {
        hint: 'During the fault, how many pieces arrive each second and how many can the transcoders finish? What happens to the difference?',
        walkthrough: [
          { text: 'Normally 4 transcoders finish 8 pieces a second and 6 arrive, so the queue stays empty.', focus: ['jobs', 'transcode'] },
          { text: 'During the fault they finish only 2 a second. The backlog grows by 4 every second for 20 seconds.', focus: ['transcode'] },
          { text: 'Retries make it worse: each abandoned job stays queued while a copy joins it.', focus: ['jobs'] },
          { text: 'More transcoders cut the wait without refusing anyone; refusing uploads keeps it short at a cost.', focus: ['jobs', 'transcode'] },
        ],
        solution: [
          { type: 'p', text: '**Keep the queue, and size the workers for the slow case.** With 8 transcoders the fault leaves 4 pieces a second of capacity against 6 arriving, so the backlog grows slowly and drains afterwards. If you cannot add workers, refusing uploads (or telling creators the wait) keeps waits bounded, at a visible cost. Retries make the backlog worse.' },
          { type: 'code', lang: 'pseudo', code: 'backlog grows by (arrivals − capacity) each second\nwait ≈ backlog ÷ capacity\n# 6 arriving, 2 finished a second → +4 per second' },
        ],
        why: 'A queue absorbs a burst, but it only helps if the workers can catch up. Sizing them for the slow case, or limiting what is accepted, is what keeps a creator’s wait bounded.',
      },
      lessons: ['lab-queue-backlog', 'backpressure', 'queues'],
    },
    {
      id: 'outage', title: 'Origin storage offline', intro: 'The interviewer changes one condition. Predict, run it on your design, then revise.',
      question: 'Origin storage goes offline. A viewer asks for a popular segment that the CDN already holds. What happens to their playback?',
      change: { announce: 'New condition: Origin storage is offline for twenty minutes. A viewer asks for a segment of a popular video that the CDN already holds.', rule: RULES.trace, alternate: { announce: 'New condition: Origin storage is still offline, and now the viewer asks for a segment that nobody has watched yet, so no CDN holds it.', label: 'Replay with a segment that is not cached' } },
      activity: {
        kind: 'trace', request: 'a segment request from the player', from: ['viewer'], to: ['edge', 'origin'], failCandidates: ['origin', 'origin'],
        predict: { q: 'With Origin storage offline, what does the viewer of a popular, cached segment see?', choices: [{ id: 'error', label: 'An error or buffering spinner' }, { id: 'delayed', label: 'The video plays; the rest catches up later' }, { id: 'ok', label: 'Nothing changes: the segment comes from the edge' }] },
      },
      help: {
        hint: 'Which part answers the request for a segment the CDN already holds, and is Origin storage on that path?',
        walkthrough: [
          { text: 'The player asks the CDN edge cache first.', focus: ['viewer', 'edge'] },
          { text: 'A cached segment is answered at the edge. Origin storage is never asked, so its outage is invisible.', focus: ['edge'] },
          { text: 'A segment the CDN does not hold is a miss: the edge must ask Origin storage, which is down, so that request fails.', focus: ['edge', 'origin'] },
          { text: 'Because most views go to a few popular videos, most viewers are unaffected.', focus: ['edge'] },
        ],
        solution: [
          { type: 'list', items: ['**Popular, cached segments keep playing:** the edge answers and never asks the origin.', '**Rarely watched or brand-new segments fail** until the origin returns, because only the origin has them.', 'Keep originals **replicated in a second place** so one outage is not a loss.', 'Give players a retry with a short wait, and give the edge a sensible “stale-if-error” setting where supported.'] },
        ],
        why: '“Playback keeps working for popular videos even when parts of the back end are down” holds because segments never change: a stale copy is a correct copy, so serving it during an outage is safe.',
      },
      lessons: ['cdn', 'availability'],
    },
  ],
  rules: [
    // Design stage
    { id: 'vd-hit', stage: 'design', when: { result: 'trace:watch', is: 'hit' }, ack: 'Your trace stopped at {kind:cache}: the origin was never asked for that segment.', strength: 'You put {kind:cache} between viewers and {kind:storage}, and traced a segment served without touching the origin.' },
    { id: 'vd-no-cache', stage: 'design', when: { all: [{ result: 'trace:watch', is: 'ok' }, { lacks: 'cache' }] }, priority: 9, ask: { text: 'Every segment request went all the way to {kind:storage}. A viral video could mean millions of requests a minute for the same files. What protects the origin?', choices: [
      { id: 'cdn', label: 'A CDN near viewers, holding copies of popular segments for a long time', reply: 'Yes. Segments never change, so a copy is always correct and nothing needs invalidating. Insert it in your watch path and trace again.', verdict: 'sound' },
      { id: 'servers', label: 'More servers in front of the origin', reply: 'More servers share the work, but each still reads the same files, from one place far from viewers.', verdict: 'partial' },
      { id: 'nothing', label: 'Nothing; object storage scales', reply: 'It scales storage, not distance or cost. Every view would still travel from the origin and be billed there.', verdict: 'risky' },
    ] }, gap: { text: 'Every view went to the origin; nothing absorbed the viral case.', fix: 'Put a CDN edge cache between viewers and Origin storage and let it hold segments for a long time.', stage: 'design', lesson: 'cdn' } },
    { id: 'vd-immutable', stage: 'design', when: { has: 'cache' }, priority: 7, ask: { text: 'Segments never change once written. What does that let {kind:cache} do?', choices: [
      { id: 'long', label: 'Keep copies for a very long time, with nothing to invalidate', reply: 'Yes. The only “update” is a new video with new segment names. The manifest, which can change when qualities are added, gets a short lifetime.', verdict: 'sound' },
      { id: 'short', label: 'Keep copies briefly so they stay fresh', reply: 'Fresh from what? The segment cannot change. A short lifetime just sends more requests to the origin.', verdict: 'partial' },
      { id: 'none', label: 'Cache nothing; the origin is always right', reply: 'It is right, and also the one place a viral video would overwhelm.', verdict: 'risky' },
    ] } },
    { id: 'vd-miss', stage: 'design', when: { link: ['cache', 'storage'] }, priority: 8, ask: { text: 'A brand-new video goes viral. A thousand viewers at one edge all miss on the same segment at the same moment. What should happen?', choices: [
      { id: 'collapse', label: 'The edge makes one request to the origin and gives the answer to all thousand', reply: 'Yes. That is request collapsing, often with a middle “shield” cache. One miss costs the origin one read, not a thousand.', verdict: 'sound' },
      { id: 'each', label: 'Each viewer’s request goes to the origin', reply: 'That is the stampede the CDN was meant to prevent. The first moments of a viral video are exactly when caches are empty.', verdict: 'risky' },
      { id: 'prewarm', label: 'Copy big releases to edges before they are announced', reply: 'Sensible for planned releases. You still need collapsing for the surprise that nobody predicted.', verdict: 'partial' },
    ] } },
    { id: 'vd-upload-queue', stage: 'design', when: { link: [{ type: 'upload' }, 'queue'] }, ack: 'Uploads hand work to {kind:queue}, so a creator is not waiting while a video is transcoded.', strength: 'You moved transcoding behind {kind:queue}, so uploads stay fast however long processing takes.' },
    { id: 'vd-sync-transcode', stage: 'design', when: { link: [{ type: 'upload' }, 'worker'] }, priority: 9, ask: { text: '{type:upload} calls {type:transcode} directly. A two-hour video takes minutes to transcode. What is the creator doing while it runs?', choices: [
      { id: 'queue', label: 'The upload finishes first; processing happens later from a queue, and the creator sees “processing”', reply: 'Yes. Saving the original and making it playable are different jobs with different speeds. Insert a queue between them.', verdict: 'sound' },
      { id: 'wait', label: 'Waiting for the transcode to finish', reply: 'Their connection must stay open for minutes, and a failure loses the whole upload. Separate saving from processing.', verdict: 'risky' },
      { id: 'short', label: 'Waiting, but it is only a few seconds', reply: 'For short clips, maybe. At 500 hours a minute, some videos will not be short.', verdict: 'partial' },
    ] }, gap: { text: 'Upload waited for transcoding to finish.', fix: 'Save the original, queue a transcode job, and show “processing” until it is ready.', stage: 'design', lesson: 'queues' } },
    { id: 'vd-storage-event', stage: 'design', when: { link: [{ type: 'origin' }, 'queue'] }, priority: 6, ack: 'Origin storage announces each new original to {kind:queue}. That is a real approach: storage events start the work without Upload service doing it.', ask: { text: 'If one of those announcements is lost, an original sits there and never gets transcoded. What catches it?', choices: [
      { id: 'sweep', label: 'A periodic sweep lists originals that have no segments yet and queues them', reply: 'Yes. Events are fast, the sweep is the safety net. That is a valid alternative to Upload service queuing the job, with an extra moving part.', verdict: 'sound' },
      { id: 'rare', label: 'Lost announcements are rare enough to ignore', reply: 'At 500 hours a minute, rare is still many creators a day with a video stuck on “processing”.', verdict: 'risky' },
      { id: 'both', label: 'Upload service also queues the job, and duplicates are ignored', reply: 'Works if jobs are safe to repeat. You then have two paths to keep in step.', verdict: 'partial' },
    ] }, strength: 'You triggered transcoding from storage events and planned a sweep for the ones that get lost.' },
    { id: 'vd-ready', stage: 'design', when: { link: [{ type: 'transcode' }, { type: 'metadb' }] }, priority: 5, ask: { text: 'An arrow from {type:transcode} to {type:metadb} does not show order. When should a video be marked “ready”?', choices: [
      { id: 'after', label: 'After every segment and the manifest are written to the origin', reply: 'Yes. A video marked ready too early gives viewers a manifest that names segments that are not there yet.', verdict: 'sound' },
      { id: 'before', label: 'As soon as the job starts', reply: 'Viewers would press play and hit missing segments.', verdict: 'risky' },
      { id: 'each', label: 'Per quality: mark each quality ready when its segments are done', reply: 'Also fine and gets the video playable sooner. The manifest then lists only qualities that are complete.', verdict: 'sound' },
    ] } },
    { id: 'vd-direct', stage: 'design', when: { link: ['client', 'storage'] }, coach: 'Viewers read straight from storage here. Think about what happens when a million of them want the same file; where could a copy near them sit?', priority: 2 },
    { id: 'vd-connect', stage: 'design', when: { all: [{ has: { type: 'viewer' } }, { not: { path: [{ type: 'viewer' }, { type: 'origin' }] } }] }, coach: 'Connect the watch path: Video player → … → Origin storage. Select a part, then “Connect to…”.', priority: 3 },
    { id: 'vd-trace-now', stage: 'design', when: { all: [{ path: [{ type: 'viewer' }, { type: 'origin' }] }, { not: { result: 'trace:watch', is: ['ok', 'hit'] } }] }, coach: 'Press “Trace a request” and run “Watch a video” to see where the segment comes from.', priority: 1 },
    // Transcoding stage
    { id: 'vd-q-wait-bad', stage: 'transcoding', when: { result: 'transcoding', is: 'wait:unbounded' }, priority: 7, ask: { text: 'Waiting kept every upload, but during the fault the longest wait grew past what creators will tolerate. What would you change first?', choices: [
      { id: 'workers', label: 'Add transcoders so capacity stays above arrivals even when each job is slower', reply: 'Yes. A queue can only absorb a burst the workers can later catch up on. Try more workers and run it again.', verdict: 'sound' },
      { id: 'faster', label: 'Make each transcode faster', reply: 'Worth doing, and the same arithmetic: it raises capacity. It cannot help if the fault slows every job anyway.', verdict: 'partial' },
      { id: 'bigger', label: 'Make the queue bigger', reply: 'A bigger queue only stores the backlog; it does not shorten the wait.', verdict: 'risky' },
    ] }, gap: { text: 'During a slow-transcoder fault the queue grew without bound.', fix: 'Size transcoders for the slow case, and show creators an honest “processing” status.', stage: 'transcoding', lesson: 'lab-queue-backlog' } },
    { id: 'vd-q-wait-ok', stage: 'transcoding', when: { result: 'transcoding', is: 'wait:bounded' }, ack: 'With that many transcoders, even the slow period left waits within the limit and nobody was turned away.', strength: 'You sized the transcoders so the queue stayed bounded through the fault without refusing uploads.' },
    { id: 'vd-q-shed', stage: 'transcoding', when: { result: 'transcoding', is: 'shed:bounded' }, priority: 6, ask: { text: 'Refusing uploads kept waits short, but some creators were turned away. Is that the right trade here?', choices: [
      { id: 'scale', label: 'Better to add workers and accept everything; refuse only if even that is not enough', reply: 'Yes. “Never lose an upload” argues for taking the video and being slow rather than turning creators away.', verdict: 'sound' },
      { id: 'fine', label: 'Yes, a clear “try later” is better than a long wait', reply: 'Defensible for a short fault, if the app keeps the file so the creator does not start over.', verdict: 'partial' },
      { id: 'silent', label: 'Drop the extra uploads without telling anyone', reply: 'That is a lost video. If you refuse, say so, and keep the file on the device.', verdict: 'risky' },
    ] } },
    { id: 'vd-q-retry', stage: 'transcoding', when: { result: 'transcoding', is: 'retry:unbounded' }, priority: 8, ask: { text: 'Creator retries made the backlog grow faster than before. Why?', choices: [
      { id: 'dupes', label: 'The abandoned jobs stay in the queue, and a copy is added, exactly when workers are slowest', reply: 'Yes. Retries add load when you can least afford it. Retry with growing waits, make jobs safe to repeat, and drop duplicates.', verdict: 'sound' },
      { id: 'good', label: 'It should not: retries help creators', reply: 'Each retry is more work for a system that is already behind. Retries need limits.', verdict: 'risky' },
    ] }, gap: { text: 'Retries piled duplicate jobs onto an already slow queue.', fix: 'Make transcode jobs safe to repeat, drop duplicates, and back off between retries.', stage: 'transcoding', lesson: 'backpressure' } },
    // Outage stage
    { id: 'vd-out-ok', stage: 'outage', when: { result: 'outage', is: 'ok' }, ack: 'Origin storage was not on that request’s path, so the cached segment played.', strength: 'Your CDN edge cache kept popular video playing while Origin storage was offline.' },
    { id: 'vd-out-limits', stage: 'outage', when: { result: 'outage', is: 'ok' }, priority: 7, ask: { text: 'Cached segments kept playing. Which viewers are still affected, and what protects the originals meanwhile?', choices: [
      { id: 'rare', label: 'Anyone asking for a segment no edge holds fails until the origin returns; originals are replicated elsewhere', reply: 'Yes. Be honest about the limit: the cache protects what it holds. Replicated originals mean an outage is not a loss.', verdict: 'sound' },
      { id: 'all-edges', label: 'Copy every video to every edge so nobody is affected', reply: 'That multiplies storage by the number of edges for videos almost nobody watches. Cache the popular ones.', verdict: 'risky' },
      { id: 'none', label: 'Nobody is affected', reply: 'Only the cached part of playback is. A new or rare video, and any miss, still needs the origin.', verdict: 'risky' },
    ] } },
    { id: 'vd-out-err-no-cache', stage: 'outage', when: { all: [{ result: 'outage', is: 'error' }, { lacks: 'cache' }] }, priority: 8, ask: { text: 'Without a cache in the path, every viewer needed the origin and playback stopped. What would let popular videos survive an origin outage?', choices: [
      { id: 'cdn', label: 'A CDN edge cache holding popular segments, serving copies without asking the origin', reply: 'Yes. Because segments never change, a stale copy is a correct copy. Add the cache and run it again.', verdict: 'sound' },
      { id: 'retry', label: 'Players retry until the origin returns', reply: 'Viewers still wait; retries from millions of players also pile onto the origin the moment it returns.', verdict: 'partial' },
      { id: 'apology', label: 'Show an apology page', reply: 'Honest, but the video was available. Keep copies near viewers.', verdict: 'risky' },
    ] }, gap: { text: 'An origin outage stopped all playback.', fix: 'Serve popular segments from CDN edge copies that do not need the origin.', stage: 'outage', lesson: 'cdn' } },
    { id: 'vd-out-miss', stage: 'outage', when: { all: [{ result: 'outage', is: 'error' }, { has: 'cache' }] }, ack: 'That request needed a segment {kind:cache} did not hold, so it had to ask the offline origin. Cached segments would still play.' },
    { id: 'vd-out-broken', stage: 'outage', when: { result: 'outage', is: 'broken' }, coach: 'There is no chain of arrows from the player to that part. Add the arrows, then run it again.', priority: 4 },
  ],
  solution: {
    design: g([
      ['creator', 'creator', 'client', 'Creator app', 40, 70], ['upload', 'upload', 'service', 'Upload service', 170, 70], ['jobs', 'jobs', 'queue', 'Transcode queue', 300, 70],
      ['transcode', 'transcode', 'worker', 'Transcoder', 430, 70], ['origin', 'origin', 'storage', 'Origin storage', 560, 200], ['edge', 'edge', 'cache', 'CDN edge cache', 400, 250],
      ['viewer', 'viewer', 'client', 'Video player', 40, 330], ['catalog', 'catalog', 'service', 'Video catalogue', 220, 400], ['metadb', 'metadb', 'db', 'Video metadata', 480, 400],
    ], [
      ['creator', 'upload', 'sends request'], ['upload', 'origin', 'writes to'], ['upload', 'jobs', 'publishes event'], ['jobs', 'transcode', 'delivers to'], ['transcode', 'origin', 'reads and writes'],
      ['transcode', 'metadb', 'writes to'], ['viewer', 'catalog', 'sends request'], ['catalog', 'metadb', 'reads from'], ['viewer', 'edge', 'sends request'], ['edge', 'origin', 'reads from'],
    ]),
    why: {
      creator: 'Sends the original; waits only for “received”, not for processing.',
      upload: 'Saves the original to Origin storage, then queues a job. Keeps uploads fast whatever processing costs.',
      jobs: 'Absorbs bursts of uploads and survives a slow or crashed transcoder: jobs wait and are retried.',
      transcode: 'Heavy work done in the background: cuts segments, makes qualities, writes them, then marks the video ready.',
      origin: 'Durable home of the originals and every segment. Read only on a CDN miss.',
      edge: 'Holds popular segments near viewers for a long time (segments never change). Collapses simultaneous misses into one origin read.',
      viewer: 'Reads the manifest, fetches segments from the edge and switches quality as its connection changes.',
      catalog: 'Serves titles and manifests; small, cacheable reads kept away from the segment path.',
      metadb: 'Source of truth for each video’s status and manifest. A video is “ready” only after its segments exist.',
    },
    alternatives: { jobs: { types: ['origin'], tradeoff: 'Storage can announce each new original and start the transcoding itself, so Upload service has one less job. Lost announcements then need a periodic sweep as a safety net.' } },
    trace: { title: 'A viewer watches a popular video', steps: [
      { from: 'viewer', to: 'catalog', text: 'GET /videos/77/manifest: the list of segments per quality.' },
      { from: 'catalog', to: 'metadb', text: 'Checks that video 77 is ready and returns the manifest location.' },
      { from: 'viewer', to: 'edge', text: 'The player starts with a low-quality segment for a fast start: GET /seg/360p/0001.' },
      { from: 'edge', to: 'origin', text: 'Only on a miss: the edge reads the segment from Origin storage once, keeps it for a year, and answers every later viewer itself.' },
      { from: 'viewer', to: 'edge', text: 'Measured bandwidth is good, so the player switches to 1080p segments from the same edge.' },
    ] },
    tradeoff: 'Edge copies make watching cheap and fast and survive an origin outage, but a miss for a rare or brand-new segment must still reach the origin, and every quality you pre-make costs transcoding and storage.',
    otherApproach: 'For a small catalogue, serving from one region’s storage behind a simple cache is enough. For live events, segments are short and created in real time, so the cache lifetime and the transcoding path change.',
  },
};
