import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const feed: InterviewScript = {
  caseId: 'case-feed',
  track: 'hld',
  doLine: 'Open a home feed through a cache, key feed entries by user, then keep fan-out workers from falling behind when a celebrity posts',
  skills: ['caching', 'data-modeling', 'capacity', 'architecture'],
  brief: {
    interviewer: { name: 'Jonas', role: 'engineer on the home-feed team' },
    intro: 'Our social app opens on the home feed: recent posts from the people you follow, newest first. Reading it is the most common thing anyone does in the app.',
    users: 'People who follow friends, brands and a few very famous accounts.',
    needs: ['Open the home feed and see the newest posts from followed accounts', 'Scroll back for older posts', 'Post something and see it in followers’ feeds within a few seconds'],
    mustHold: ['Opening the feed is fast (p99 under 300 ms)', 'Posting feels instant', 'A famous account’s post does not make everyone else’s feed late'],
    constraints: ['300 million users, 50 million active a day, about 10 feed opens each: roughly 6,000 a second on average', 'People follow about 200 accounts on average', 'A few accounts have 50 million followers', 'Followers may see a new post a few seconds late'],
    outOfScope: ['Ranking by predicted interest (feed is newest first)', 'Ads', 'Comments and likes'],
    terms: [
      { term: 'fan-out', meaning: 'copying one new post into the feed of each follower' },
      { term: 'fan-out on write', meaning: 'doing that copying when the post is made, so reads are cheap' },
      { term: 'merge at read time', meaning: 'looking up recent posts from followed accounts when the feed is opened' },
      { term: 'hydrate', meaning: 'turn a list of post ids into the full posts to show' },
    ],
    firstMove: 'A user opens the app. Place the parts that build their home feed, connect them, and trace “open the home feed” through your design.',
  },
  palette: [
    { type: 'app', kind: 'client', name: 'Phone app', blurb: 'Opens the feed, scrolls, and posts. It asks for a page of the feed at a time.' },
    { type: 'feedsvc', kind: 'service', name: 'Feed service', blurb: 'Answers “give me my feed”: gets a list of post ids, then fetches the posts to show.' },
    { type: 'feedcache', kind: 'cache', name: 'Feed cache', blurb: 'Fast per-user lists of recent post ids. Rebuildable if lost; may be a few seconds behind.' },
    { type: 'feedstore', kind: 'db', name: 'Feed store', blurb: 'A durable table of feed entries, one per (user, post), kept in a form that can be read by user.' },
    { type: 'postsvc', kind: 'service', name: 'Post service', blurb: 'Accepts a new post, stores it and starts spreading it to followers.' },
    { type: 'postsdb', kind: 'db', name: 'Posts store', blurb: 'The posts themselves: text, author, time. The source of truth for content.' },
    { type: 'graph', kind: 'db', name: 'Follow graph', blurb: 'Who follows whom. Answers “who are this author’s followers?”.' },
    { type: 'fanq', kind: 'queue', name: 'Fan-out queue', blurb: 'Holds “spread this post” jobs so posting returns at once.' },
    { type: 'fanout', kind: 'worker', name: 'Fan-out workers', blurb: 'Take a job, read the author’s followers and add the post id to each follower’s feed.' },
  ],
  verbs: ['sends request', 'reads from', 'writes to', 'reads and writes', 'publishes event', 'delivers to', 'invalidates'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'order', q: 'Is the feed ranked or newest first?', a: 'Newest first for now. Ranking by interest comes later.' },
          { id: 'reads', q: 'What is the read-to-write balance?', a: 'Reads dominate. About 6,000 feed opens a second on average; far fewer posts.' },
          { id: 'fresh', q: 'How fresh must a feed be?', a: 'A new post may take a few seconds to appear in followers’ feeds. The author must see their own post at once.' },
          { id: 'follows', q: 'How many accounts does someone follow, and how many followers does an account have?', a: 'About 200 follows on average. Most accounts have few followers; a handful have 50 million.' },
          { id: 'depth', q: 'How far back do people scroll?', a: 'Most never leave the first page. Some scroll a few hundred posts; beyond that, loading slowly is acceptable.' },
          { id: 'edit', q: 'Can posts be edited or deleted?', a: 'Yes, and a deleted post must disappear from feeds. That affects what you copy into each feed.' },
        ],
        assumptions: [
          { id: 'approach', q: 'When do you build a person’s feed?', options: [
            { id: 'write', label: 'When a post is made: add its id to every follower’s feed', consequence: 'Opening the feed is one cheap lookup. A post costs one write per follower, which is huge for famous accounts.' },
            { id: 'read', label: 'When the feed is opened: look up recent posts from all 200 accounts followed', consequence: 'Posting is cheap. Each open does about 200 lookups, at 6,000 opens a second.' },
          ] },
          { id: 'copy', q: 'What goes into a feed entry?', options: [
            { id: 'ids', label: 'Just the post id and time', consequence: 'Feeds stay small and edits and deletions need no rewriting, but opening must fetch the posts.' },
            { id: 'full', label: 'A full copy of the post', consequence: 'One fewer lookup per open, but every edit or delete must find and rewrite every copy.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers tell you how much work a read costs, and how much work a post costs?',
        walkthrough: [
          { text: 'Reads dominate, so spending effort at post time to make reads cheap pays off.' },
          { text: 'A few seconds of lag is allowed, so spreading a post can happen in the background.' },
          { text: 'Most people have few followers but a few have 50 million: the same plan cannot suit both.' },
          { text: 'Edits and deletes mean feeds should hold ids, not copies.' },
        ],
        solution: [{ type: 'list', items: ['Newest-first feed; reads ≫ posts (about 6,000 opens a second).', 'Followers may see a post a few seconds late; authors see it at once.', 'About 200 follows each, but a few accounts have 50 million followers.', 'Edits and deletes are possible, so feeds hold post ids.'] }],
        why: 'These answers set the balance between work at read time and at write time, and show that very large accounts need a different path.',
      },
      lessons: ['requirements', 'capacity-estimation'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts that build a feed and connect them. Then trace “open the home feed” through your own design.',
      question: 'A user opens the app. Which part answers, and where do the post ids come from?',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-app', 'app', 'client', 'Phone app', 70, 220], ['s-feed', 'feedsvc', 'service', 'Feed service', 300, 220]], [['s-app', 's-feed', 'sends request']]),
        traces: [
          { id: 'open', label: 'Open the home feed', token: 'GET /feed', from: 'client', to: { type: ['postsdb'] }, read: true },
          { id: 'post', label: 'Make a new post', token: 'POST /posts', from: 'client', to: { type: ['postsdb'] } },
        ],
      },
      help: {
        hint: 'Opening the feed happens thousands of times a second. What can you prepare earlier so that a read is one quick lookup?',
        walkthrough: [
          { text: 'The app asks Feed service for a page. Feed service reads the user’s list of post ids from the feed cache.', focus: ['app', 'feedsvc', 'cache'] },
          { text: 'It then fetches those posts from Posts store (hydrating) and returns them.', focus: ['feedsvc', 'postsdb'] },
          { text: 'A new post is stored once, then a queue hands “spread this post” to workers.', focus: ['postsvc', 'postsdb', 'fanq'] },
          { text: 'Workers read the author’s followers and add the post id to each follower’s cached list.', focus: ['fan', 'graph', 'cache'] },
        ],
        solution: [
          { type: 'p', text: '**Precompute the feed from ids.** Posting stores the post once and queues a fan-out job. Workers append its id to each follower’s list in Feed cache. Opening the feed reads that list and fetches the posts; a cache miss rebuilds the list from the follow graph.' },
          { type: 'code', lang: 'http', code: 'GET /v1/feed?cursor=…&limit=30\n→ 200 { posts: [ … ], next_cursor }' },
        ],
        why: 'Reads dominate, so doing the work at post time turns each open into one cache lookup. Storing ids keeps edits and deletions cheap.',
      },
      lessons: ['caching', 'cache-invalidation', 'queues'],
    },
    {
      id: 'data', title: 'Data model', intro: 'Feed entries are written once per follower, so the key you choose decides how much each read costs.',
      question: 'What do you key the feed entries on, and what does “everything by one author” cost?',
      activity: {
        kind: 'model',
        tables: [
          { id: 'feed_entries', name: 'feed_entries', fields: ['user_id', 'post_id', 'author_id', 'created_at'], links: [{ field: 'post_id', to: 'posts' }] },
          { id: 'posts', name: 'posts', fields: ['post_id', 'author_id', 'body', 'created_at', 'deleted'] },
        ],
        table: 'feed_entries', partitions: 16,
        first: { id: 'q1', text: 'Open the feed: the newest 30 entries for one user', filter: 'user_id', sort: 'created_at' },
        second: { id: 'q2', text: 'An author deletes their account: find every feed entry for their posts', filter: 'author_id' },
        tradeoffs: [
          { id: 'scatter-job', label: 'Key on user; scatter the clean-up as a background job', consequence: 'Opening a feed is one partition, sorted. The deletion scans all 16 partitions, which is fine for a rare job that is not user-facing.', verdict: 'sound' },
          { id: 'index', label: 'Key on user, plus an index on author', consequence: 'Deletion becomes one lookup. Every fan-out write (one per follower) also updates the index, which makes the busiest write path heavier.', verdict: 'partial' },
          { id: 'filter-read', label: 'Leave the entries; hide posts whose author is gone when reading', consequence: 'No scan at all: opening a feed fetches the posts anyway and skips any whose author is gone. Clean the entries up lazily later.', verdict: 'sound' },
          { id: 'key-author', label: 'Key on author instead', consequence: 'Deletion is fast, but opening a feed must ask the partitions of all 200 followed authors on every open.', verdict: 'risky' },
        ],
      },
      help: {
        hint: 'One query runs 6,000 times a second and the other almost never. Which one decides the key?',
        walkthrough: [
          { text: 'Opening the feed filters on user, so partition on user_id and sort by time: one partition, already ordered.', focus: ['cache'] },
          { text: 'Each user’s list is then read from one place, whichever user it is, so load spreads evenly.', focus: ['cache', 'feedsvc'] },
          { text: '“By one author” does not use that key, so it scatters or needs an index.', focus: ['postsdb'] },
          { text: 'Because it is rare, a background scan or lazy hiding is cheaper than taxing every fan-out write.', focus: ['postsdb', 'fan'] },
        ],
        solution: [{ type: 'p', text: 'Key feed entries on **user_id**, sorted by **created_at**. The rare author lookup is handled by hiding deleted posts at read time (the post row says deleted) and a background clean-up, not by an index that slows every fan-out write.' }],
        why: 'The key must match the hot read. Rare queries should not add cost to the busiest write path.',
      },
      lessons: ['access-patterns', 'sharding', 'indexes'],
    },
    {
      id: 'celebrity', title: 'Celebrity posts', intro: 'The interviewer changes one condition. Pick how fan-out reacts, run it, and compare.',
      question: 'An account with 50 million followers posts. Fan-out workers fall behind. Which policy keeps everyone else’s feed fresh?',
      change: { announce: 'New condition: an account with tens of millions of followers posts, and the feed cache writes slow to four times their usual time while the fan-out runs.', rule: RULES.queue },
      activity: {
        kind: 'queue', what: 'feed writes waiting for a fan-out worker',
        arrival: [5000, 15000, 25000], workers: [20, 40, 80], serviceMs: 2,
        slow: { from: 20, to: 40, serviceMs: 8, what: 'the feed cache takes four times longer to accept each write' },
        timeoutS: 2,
        policies: [
          { id: 'wait', label: 'Fan out to everyone, in order', detail: 'Every follower’s write waits its turn. Ordinary posts queue behind the celebrity’s millions of writes.' },
          { id: 'retry', label: 'Retry what times out', detail: 'A write that waits too long is sent again, and the old copy stays in the queue.' },
          { id: 'shed', label: 'Skip fan-out for huge accounts', detail: 'Above a follower threshold, don’t copy the post into each feed. Merge those authors’ recent posts when a feed is opened.' },
          { id: 'breaker', label: 'Pause inactive users’ fan-out', detail: 'While the backlog is old, stop writing to feeds of people who have not opened the app recently; rebuild theirs when they return.' },
        ],
      },
      help: {
        hint: 'Workers can finish about 20,000 writes a second when the cache is quick. What happens to a normal post that arrives behind 50 million writes?',
        walkthrough: [
          { text: 'Normal: 40 workers at 2 ms each finish about 20,000 writes a second, more than the arrivals.', focus: ['fan'] },
          { text: 'With the cache four times slower they finish about 5,000 a second, so the queue grows every second.', focus: ['fan', 'cache'] },
          { text: 'Retrying adds copies of writes that are already waiting, which makes the backlog worse.', focus: ['fanq'] },
          { text: 'The fix is to stop doing the unbounded work: skip fan-out for huge accounts and merge their posts at read time.', focus: ['feedsvc', 'postsdb'] },
        ],
        solution: [{ type: 'list', items: ['Choose a follower threshold (for example 100,000). Above it, do not fan out.', 'At read time, Feed service merges the user’s cached list with the recent posts of the few big accounts they follow.', 'Cache each big account’s recent posts once, so the merge is a few lookups.', 'Scale workers on queue age, and do inactive users’ feeds last.'] }],
        why: 'Fan-out cost grows with followers; skipping it for the largest accounts caps the work per post and keeps everyone else’s feed fresh.',
      },
      lessons: ['backpressure', 'queues', 'lab-queue-backlog', 'lab-hot-spots'],
    },
  ],
  rules: [
    // Design
    { id: 'cached-feed', stage: 'design', when: { link: [{ type: 'feedsvc' }, 'cache'], labels: ['reads from', 'reads and writes'] }, ack: '{type:feedsvc} reads the precomputed list from {kind:cache} first, so most opens never touch the posts store for a list.', strength: 'You served the feed from precomputed lists in {kind:cache}.' },
    { id: 'cache-hit', stage: 'design', when: { result: 'trace:open', is: 'hit' }, ack: 'Your trace stopped at {kind:cache}: the list of ids came from memory.', strength: 'You traced “open the home feed” and proved it can be answered from {kind:cache}.' },
    { id: 'no-posts', stage: 'design', when: { lacks: { type: 'postsdb' } }, coach: 'Posts need a home. Add Posts store and connect the services that read and write posts.', gap: { text: 'Posts had no single source of truth.', fix: 'Store each post once in Posts store; feeds hold only its id.', stage: 'design', lesson: 'caching' }, priority: 3 },
    { id: 'connect-path', stage: 'design', when: { all: [{ has: { type: 'postsdb' } }, { not: { path: ['client', { type: 'postsdb' }] } }] }, coach: 'Connect the path: Phone app → Feed service → Posts store. Select a part, then “Connect to…”.', priority: 2 },
    { id: 'trace-now', stage: 'design', when: { all: [{ path: ['client', { type: 'postsdb' }] }, { not: { result: 'trace:open', is: ['ok', 'hit'] } }] }, coach: 'Press “Trace a request” to watch “open the home feed” travel through your design.', priority: 1 },
    { id: 'no-cache', stage: 'design', when: { all: [{ result: 'trace:open', is: 'ok' }, { lacks: 'cache' }] }, priority: 8, ask: { text: 'Every feed open went all the way to the stores. At 6,000 opens a second, what protects them?', choices: [
      { id: 'cache', label: 'A cache of each user’s list of post ids', reply: 'Yes. Insert a cache on the read path and trace again. A miss can rebuild the list.', verdict: 'sound' },
      { id: 'read-merge', label: 'Merge recent posts from followed accounts at open time', reply: 'That is the pull approach: no copying at post time, but about 200 lookups per open. Fine for small apps; heavy at this size.', verdict: 'partial' },
      { id: 'servers', label: 'More Feed service servers', reply: 'More servers help the service, but all of them still ask the same stores.', verdict: 'partial' },
    ] }, gap: { text: 'Every feed open read the stores directly.', fix: 'Precompute each user’s list of post ids into a cache and read that.', stage: 'design', lesson: 'caching' } },
    { id: 'cache-stale', stage: 'design', when: { has: 'cache' }, priority: 6, ask: { text: 'A post was deleted. How does it stop showing up from {kind:cache}?', choices: [
      { id: 'hydrate', label: 'The cache holds ids; fetching the posts shows the post is deleted and it is skipped', reply: 'Yes: that is why feeds hold ids and not copies. No feed needs rewriting.', verdict: 'sound' },
      { id: 'purge', label: 'Find the post in every follower’s feed and remove it', reply: 'Works, but a famous account’s post sits in millions of feeds. Skip-on-read is cheaper.', verdict: 'partial' },
      { id: 'ignore', label: 'It expires after a while', reply: 'A deleted post staying visible for hours is the kind of thing users report.', verdict: 'risky' },
    ] } },
    { id: 'async-fanout', stage: 'design', when: { all: [{ link: [{ type: 'postsvc' }, 'queue'] }, { link: ['queue', 'worker'] }] }, ack: '{type:postsvc} stores the post and hands spreading it to {kind:queue}, so posting returns at once.', strength: 'You moved fan-out behind {kind:queue}, so posting stays fast however many followers there are.' },
    { id: 'sync-fanout', stage: 'design', when: { link: [{ type: 'postsvc' }, { type: ['feedcache', 'feedstore'] }] }, priority: 9, ask: { text: '{type:postsvc} writes into the feeds itself. An account with 50 million followers posts. What does the author wait for?', choices: [
      { id: 'queue', label: 'Nothing: hand it to a queue and workers', reply: 'Right. The post is stored; spreading it can take seconds, which the brief allows.', verdict: 'sound' },
      { id: 'all', label: 'All 50 million writes', reply: 'That could be minutes of waiting. Move spreading behind a queue.', verdict: 'risky' },
    ] }, gap: { text: 'Posting waited for every follower’s feed to be written.', fix: 'Return after storing the post and spread it from a queue.', stage: 'design', lesson: 'queues' } },
    { id: 'pull-alt', stage: 'design', when: { all: [{ answer: 'assume:approach', is: 'read' }, { lacks: { type: 'fanout' } }] }, priority: 7, ack: 'You chose to build the feed when it is opened. That is a valid alternative to the reference design.', ask: { text: 'Building at read time costs about 200 lookups per open. What keeps that affordable?', choices: [
      { id: 'cache-user', label: 'Cache each author’s recent posts, so the merge is 200 cheap lookups', reply: 'Yes: most of those authors are shared by many readers. It still costs more per read than a precomputed list.', verdict: 'sound' },
      { id: 'fast-db', label: 'A fast database', reply: 'A fast database still does 200 lookups times 6,000 opens a second: 1.2 million a second.', verdict: 'risky' },
    ] }, strength: 'You proposed building feeds at read time and could say what keeps it affordable.' },
    // Data
    { id: 'key-user', stage: 'data', when: { result: 'data:q1', is: 'one-partition' }, ack: 'Opening a feed reads one partition, already sorted by time.', strength: 'You keyed feed entries by user, so the hot read touches one partition.' },
    { id: 'key-wrong', stage: 'data', when: { result: 'data:q1', is: ['scatter', 'index'] }, priority: 8, ask: { text: 'Opening a feed now has to look in more than one partition. How often does that happen?', choices: [
      { id: 'always', label: 'On every open, thousands of times a second', reply: 'Then the key is wrong for the hot read. Key on user id and sort by time.', verdict: 'risky' },
      { id: 'cache', label: 'Rarely, because the cache answers first', reply: 'The cache helps, but every miss and every rebuild pays the scatter. Key the store for its main read.', verdict: 'partial' },
    ] }, gap: { text: 'The feed’s main read was not keyed.', fix: 'Partition feed entries on user id and sort by created_at.', stage: 'data', lesson: 'access-patterns' } },
    { id: 'author-scatter', stage: 'data', when: { result: 'data:q2', is: 'scatter' }, priority: 6, ask: { text: 'Finding an author’s entries asks all 16 partitions. When is that acceptable?', choices: [
      { id: 'rare', label: 'For a rare background job, such as clean-up after a deleted account', reply: 'Yes. A job that runs a few times a day does not need an index that taxes every fan-out write.', verdict: 'sound' },
      { id: 'screen', label: 'For something every user does', reply: 'Then it runs constantly at 16 reads each. Give it an index or a copy.', verdict: 'risky' },
    ] } },
    { id: 'author-index', stage: 'data', when: { result: 'data:q2', is: 'index' }, priority: 6, ask: { text: 'An index on author makes deletion quick. What does it cost?', choices: [
      { id: 'writes', label: 'Every fan-out write also updates the index', reply: 'Yes. Fan-out is the busiest write path, so you pay the index cost millions of times for a rare lookup.', verdict: 'sound' },
      { id: 'nothing', label: 'Nothing, indexes are free', reply: 'Each write must keep the index in step, and fan-out writes are the most numerous in the system.', verdict: 'risky' },
    ] } },
    { id: 'entry-size', stage: 'data', when: { answer: 'assume:copy', is: 'full' }, priority: 5, ask: { text: 'You chose to store a full copy of each post in every feed. An author edits a typo. What happens?', choices: [
      { id: 'rewrite', label: 'Every copy must be found and rewritten', reply: 'Yes, which is why feeds usually hold ids and fetch posts at read time.', verdict: 'partial' },
      { id: 'ids', label: 'Switch to ids and fetch the post', reply: 'Then one edit in Posts store is seen by every reader at once.', verdict: 'sound' },
    ] }, gap: { text: 'Feeds held full copies, so edits and deletes needed millions of rewrites.', fix: 'Store post ids in feeds and hydrate from Posts store.', stage: 'data', lesson: 'cache-invalidation' } },
    // Celebrity
    { id: 'cel-bounded', stage: 'celebrity', when: { result: 'celebrity', is: ['shed:bounded', 'breaker:bounded'] }, ack: 'With that policy the backlog stayed bounded while the celebrity’s post was spreading.', strength: 'You chose a policy that kept everyone else’s feed fresh during a huge post.' },
    { id: 'cel-wait', stage: 'celebrity', when: { result: 'celebrity', is: 'wait:unbounded' }, priority: 7, ask: { text: 'With “fan out to everyone”, the delay kept growing. Who feels it?', choices: [
      { id: 'everyone', label: 'Everyone: ordinary posts queue behind the celebrity’s writes', reply: 'Yes. One account’s post delays every other feed. Cap the work per post instead.', verdict: 'sound' },
      { id: 'few', label: 'Only the celebrity’s followers', reply: 'The queue is shared, so a normal post that arrives behind it waits too.', verdict: 'risky' },
    ] }, gap: { text: 'One very large account’s post delayed fan-out for everyone.', fix: 'Skip fan-out above a follower threshold and merge those authors at read time.', stage: 'celebrity', lesson: 'backpressure' } },
    { id: 'cel-retry', stage: 'celebrity', when: { result: 'celebrity', is: 'retry:unbounded' }, priority: 7, ask: { text: 'Retries made it worse: the old writes stayed in the queue and new copies joined. What makes a fan-out retry safe?', choices: [
      { id: 'idem', label: 'Adding a post id to a feed is idempotent: adding it twice changes nothing', reply: 'Yes. Retrying is safe for correctness, but it still adds load when the system is already behind.', verdict: 'partial' },
      { id: 'drop', label: 'Drop the old copy before retrying and back off', reply: 'Right: shed what is stale and retry later, rather than doubling the work.', verdict: 'sound' },
    ] } },
    { id: 'cel-merge', stage: 'celebrity', when: { result: 'celebrity', is: 'shed:bounded' }, priority: 6, ask: { text: 'You skip fan-out for big accounts. Where do their posts appear in a follower’s feed?', choices: [
      { id: 'merge', label: 'Feed service merges them into the list when the feed is opened', reply: 'Yes. Each big account’s recent posts are cached once, so the merge is a few lookups.', verdict: 'sound' },
      { id: 'never', label: 'They don’t appear until the next fan-out', reply: 'Then followers of famous accounts would never see them. The read path has to add them.', verdict: 'risky' },
    ] } },
    { id: 'cel-inactive', stage: 'celebrity', when: { result: 'celebrity', is: 'breaker:bounded' }, priority: 6, ask: { text: 'You paused fan-out to inactive users. What happens when one of them opens the app next week?', choices: [
      { id: 'rebuild', label: 'Their feed is rebuilt on that open from the follow graph and recent posts', reply: 'Yes: a slower first open for people who were away, in exchange for far less wasted writing.', verdict: 'sound' },
      { id: 'empty', label: 'Their feed is empty', reply: 'An empty feed on return is the worst first impression. Rebuild it.', verdict: 'risky' },
    ] } },
  ],
  solution: {
    design: g([
      ['app', 'app', 'client', 'Phone app', 30, 200], ['feedsvc', 'feedsvc', 'service', 'Feed service', 190, 130], ['cache', 'feedcache', 'cache', 'Feed cache', 360, 70],
      ['postsdb', 'postsdb', 'db', 'Posts store', 360, 200], ['postsvc', 'postsvc', 'service', 'Post service', 190, 300], ['fanq', 'fanq', 'queue', 'Fan-out queue', 360, 340],
      ['fan', 'fanout', 'worker', 'Fan-out workers', 530, 280], ['graph', 'graph', 'db', 'Follow graph', 530, 380],
    ], [
      ['app', 'feedsvc', 'sends request'], ['app', 'postsvc', 'sends request'], ['feedsvc', 'cache', 'reads from'], ['feedsvc', 'postsdb', 'reads from'],
      ['postsvc', 'postsdb', 'writes to'], ['postsvc', 'fanq', 'publishes event'], ['fanq', 'fan', 'delivers to'], ['fan', 'graph', 'reads from'], ['fan', 'cache', 'writes to'],
    ]),
    why: {
      app: 'Asks for a page of the feed and posts. The author’s own post is shown locally at once.',
      feedsvc: 'Reads the user’s list of post ids, merges in recent posts from huge accounts, and fetches the posts to show.',
      cache: 'Holds each user’s newest post ids. Fast, rebuildable, and a few seconds behind, which the brief allows.',
      postsdb: 'Source of truth for post content, so edits and deletions are seen by every reader at once.',
      postsvc: 'Stores the post once and returns, then hands spreading to a queue so posting feels instant.',
      fanq: 'Holds “spread this post” jobs, so a posting spike cannot slow the author or the readers.',
      fan: 'Reads the author’s followers and adds the post id to each follower’s list; skips huge accounts.',
      graph: 'Answers “who follows this author?”.',
    },
    alternatives: { cache: { types: ['feedstore'], tradeoff: 'A durable feed store keyed by user survives restarts without a rebuild, but is slower and costlier than memory for lists read thousands of times a second.' } },
    trace: { title: 'A user opens the home feed, and a friend posts', steps: [
      { from: 'app', to: 'feedsvc', text: 'The app asks for the first 30 posts: GET /feed.' },
      { from: 'feedsvc', to: 'cache', text: 'Feed service reads the user’s list of post ids from the cache. A hit means the stores never see this open.' },
      { from: 'feedsvc', to: 'postsdb', text: 'It fetches those 30 posts (skipping deleted ones) and returns them.' },
      { from: 'app', to: 'postsvc', text: 'Meanwhile a friend posts. The app sends POST /posts.' },
      { from: 'postsvc', to: 'postsdb', text: 'Post service stores the post once and tells the friend it worked.' },
      { from: 'postsvc', to: 'fanq', text: 'It queues a “spread this post” job.' },
      { from: 'fanq', to: 'fan', text: 'A worker takes the job.' },
      { from: 'fan', to: 'graph', text: 'It reads the friend’s followers (a few hundred).' },
      { from: 'fan', to: 'cache', text: 'It adds the post id to each follower’s list. Within seconds the next open shows it.' },
    ] },
    tradeoff: 'Fan-out on write makes the common read one lookup, but each post costs one write per follower; the price is paid by the write path, so huge accounts must be handled differently.',
    otherApproach: 'If most users follow few accounts or posts are rare, build the feed at read time (pull) and cache each author’s recent posts. Many real systems merge both: fan out for ordinary accounts, merge huge ones at read time.',
  },
};
