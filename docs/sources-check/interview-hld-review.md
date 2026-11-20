# HLD interview scripts: fact-check review (2026-11-20)

Scope: 16 scripts in `src/content/interview/scripts/`. Method: every brief, clarify answer, stage hint/walkthrough/solution,
rule reply (verdict vs real risk), and worked solution was read against the matching case in `hld1.ts`/`hld2.ts`/`hld3.ts`.
Queue activities were run through `runQueue` for every policy at the default sliders (bounded/unbounded outcomes and the
capacity arithmetic in the text match); the states scenario in `scheduler.ts` was run through `runScenario` (passes, late
finish refused). Arithmetic checked: 50M/day = 580/s; 5M phones / 5 s = 1M req/s; 50M x 40 msgs/day = 23k/s; 10k x 500 / 10 s = 500k/s;
1M drivers / 4 s = 250k/s; 200k shoppers - 5,000 units = 195,000 refunds; year of 10 s points = 3.15M; hourly rollups = 8,760.
Validation: `check-interview-script.ts` 0 errors / 0 warnings on all 16; `tsc -b` clean for these files. No sources.ts entries
cover these topics, so claims were checked against standard documented behaviour (RFC 9110/6585/9309, Redis, PostgreSQL, HLS/CDN practice).

## Corrections

### notifications.ts
- Checked: volume math, queue capacity (4 x 100/s = 400; slow 100/s), at-least-once vs ack-after, dead-letter, SKIP-less claims, log-first reply.
- `breaker-alt` second-provider reply: "Make sure the idempotency key still prevents duplicates across providers." -> "One provider cannot recognise another's idempotency key, so your own delivery log must still stop a message going out twice." Why: a key sent to provider A is meaningless to provider B.

### liveScores.ts
- Checked: poll math (1M req/s), log/sequence design, Last-Event-ID (SSE) replay, VAR corrections as new events, data-key verdicts.
- `feed-direct` reply: "A repeated goal would show 2-0." -> "A repeated goal would count twice." Why: the 2-0 figure contradicted the trace's 2-1 score and was arbitrary.

### urlShortener.ts
- Checked: 40 writes/s, 4,000 reads/s, 62^7, 200k hot key, 409 on alias, conditional insert, 302 vs 301.
- Assumption `301`: "Browsers cache it forever ... cannot switch the link off" -> "may cache it indefinitely ... cannot reliably switch the link off". Why: 301 is cacheable (RFC 9110), not guaranteed forever.
- `invalidate` ttl reply: now notes that TTLs add across layers (edge + cache + browser), so "60 s alone" only meets a one-minute target if every copy expires within it. Why: stacked lifetimes can exceed the target.
- `wait-unbounded` workers reply: "makes it slower" -> "can make it slower" (a claim that depends on the database being saturated).

### rateLimiter.ts
- Checked: 429 + Retry-After (RFC 6585), limit / 50 fallback, fail open vs closed, atomic increment vs lock, 200k ops/s sizing.
- Lua snippet: `local n = redis.call("GET", key)` -> `local n = tonumber(redis.call("GET", key) or "0")`. Why: GET returns a string (or nil); comparing it with a number in Lua raises an error.
- `local-only` question: removed "a customer's 200,000 requests" (200k/s is the total across all customers, not one customer).
- `local-only` divide reply: "inaccurate when traffic is uneven, but the brief allows 10%" -> says uneven spread across gateways can exceed 10%, so check the load balancer spreads a key evenly.
- `hop-cost`: "well under a millisecond" -> "about a millisecond or less" (an in-datacentre Redis round trip is not guaranteed sub-millisecond; budget is 2 ms).

### chat.ts
- Checked: 23k msgs/s, 400 GB/day (~200 B/msg), seq-per-conversation ordering, client-id dedupe, store-before-ack, presence as hint, outbox/queue.
- `key-bad` choice "Every time anyone opens any chat" had verdict `risky` while its reply confirms it is the correct diagnosis -> `sound`.

### collabEditor.ts
- Checked: single session owner, version check vs LWW vs lock, snapshot + log recovery, cursors outside the log, CRDT description.
- Term `version`: "a counter on a paragraph" -> "on a paragraph, or on the whole document" (the stage uses paragraph versions, the trace/JSON use document versions).
- Trace: "Ben and the other 49 editors" -> "Ben and the other editors" (50 editors in total includes Ana).

### feed.ts
- Checked: 50M x 10 / 86,400 = ~6k/s, 200 lookups x 6,000 = 1.2M/s, queue arithmetic (40 x 500 = 20k; slow 5k), ids-not-copies, skip fan-out for huge accounts, deletes. Consistent with `hld2.ts` feed. No corrections.

### autocomplete.ts
- Checked: trie/top-10 precompute, edge cache + debounce, queue math (20 x 500 = 10k; slow 2k), atomic index swap, stale-if-error. Consistent with `hld2.ts`.
- `live-sort` risky reply: "A fast sort of 300,000 names is milliseconds ... fits no 100 ms budget" -> "takes tens of milliseconds of CPU, and thousands of requests a second cannot keep up inside a 100 ms budget" (the old text was internally contradictory).

### fileSync.ts
- Checked: chunk/hash design, chunks-before-commit ordering, parent-version conditional commit, conflicted copy, lock needs a connection, durable commit queue, 30-day history.
- HTTP example showed a synchronous `201 | 409` although commits go through a queue -> now `202 {commit_id}` (queued, applied in order) followed by the applied outcome (version 6, or 409 `{current: 6}`).
- Assumption `chunks` consequence: "A small edit uploads one or two chunks" overclaimed (an insertion shifts fixed chunk boundaries; the case's compare stage says so) -> "An edit that changes a small part uploads only the chunks it touches."

### video.ts
- Checked: 500 h/min vs 1B h/day, immutable segments + `Cache-Control: public, max-age=31536000, immutable`, request collapsing/origin shield, per-quality ready, queue math (4 x 2 = 8/s; fault 2/s; +4/s for 20 s = 80; 8 workers: wait bounded, verified with `runQueue`), stale-copy-is-correct-copy. Consistent with `hld2.ts`. No corrections.

### payments.ts
- Checked: pending-as-unknown, same-key retry, conditional pending -> paid in the same transaction as ledger entries, unique event id as second net, recon, sync/async finality, double-entry. Consistent with `hld2.ts`. No corrections.
- Note (not changed, follows the case): "idempotency key per order" would make a retry with a new card after a genuine decline return the first (failed) result at most providers; a per-attempt key is the usual refinement.

### checkout.ts
- Checked: reserve-before-charge, conditional decrement SQL, 195,000 refunds figure, bucketed rows (10 x 500), outbox, durable queue + idempotent consumer, expiry on payment outage. Consistent with `hld2.ts`. No corrections.

### rideMatching.ts
- Checked: 250k updates/s, 15 s staleness filter, conditional available -> offered, expiry as conditional change, city partitioning, queue math (2 x 83 = ~170/s slow vs 400 arriving).
- `push` why: "keeps the ten-second clock out of the matcher" -> "The ten-second expiry is enforced in the trip store, never by the phone." Why: a push gateway only delivers; expiry has to live in the durable state.

### scheduler.ts
- Checked: `SKIP LOCKED` claim SQL (valid PostgreSQL), lease expiry state machine (run with `runScenario`: pass), fencing tokens, idempotency key, at-least-once.
- Lease walkthrough: "09:05 the lease runs out" now says the exercise counts five minutes from the claim (the trace elsewhere renews every 30 s, which would push expiry past 09:05).

### metrics.ts
- Checked: 500k points/s, 5M series, queue math (4 x 50 = 200/s slow vs 600), alerts read the log, histograms for percentiles (case), rollup sizes.
- `no-rollup` choice: "a few thousand rows" -> "about 8,760 rows" (hourly points in a year).
- Trace: "60 rows" made explicit as 60 one-minute rows for the series being charted (a metric spans many hosts).

### crawler.ts
- Checked: 1 req/s/site, per-site scheduling, robots cached up to a day (RFC 9309 cap), conditional dedupe, durable frontier, queue math (50 x 1/s = 50 vs 40; slow 50/6 = ~8). Consistent with `hld3.ts`.
- Term `robots.txt`: "which pages crawlers may visit and how fast" -> "..., and sometimes how slowly to go" (Crawl-delay is a non-standard extension, not part of RFC 9309).
- Per-site limits walkthrough contradicted the design (the scheduler already gives a site to one fetcher): now says capacity collapses only "with no cap per site", and that the one-fetcher-per-site rule plus timeout and pause keep a slow site to one fetcher.

## Left as is (judgement calls)
- Simulation labels in feed/crawler/autocomplete map the generic `shed`/`breaker` policies to domain actions (skip fan-out, pause inactive users, per-site pause). The sim only measures wait time, so the verdicts hold; the text describes the intended policy.
- notifications: "opt-outs by law" kept (true in many jurisdictions, e.g. CAN-SPAM, GDPR/PECR, TCPA) but unsourced.
