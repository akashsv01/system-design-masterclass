# Batch: open-systems (open replacements for the systems books)

Read 2026-11-20 with curl from www.computer-networking.info, martinfowler.com, aosabook.org, sre.google and www.postgresql.org
(PostgreSQL pages are the current version, 19). Book entries (`kurose`, `releaseIt`, `fsa`, `sap`, `ddia1`–`ddia12`,
`dbInternals`, `dbInternalsDist`) stay `s()` as further reading; nothing here marks a book as read.

CNP3: the 4th-edition HTML chapters are on `4ed.computer-networking.info` and `beta.computer-networking.info`, which the proxy
refuses. The newest full text on `www.computer-networking.info` is the 2021 release PDF (3rd-edition draft,
`_downloads/…/CNP3-2021.pdf`, 7.67 MB, “Release 2021”), which is what was read. The entry URL is the site home page.

| Source (section) | Lesson claim | Result |
|---|---|---|
| CNP3 §2.3 Applications | Client sends a request, server acts and returns a response (`first-booking`) | Matches (client-server model: “clients send requests and servers perform actions and return responses”). |
| OSTEP Ch. 26 (already `v`) | A race condition: the result depends on the timing of two overlapping actions (`first-booking`) | Matches the existing `ostepThreads` note; attached to `first-booking`. |
| CNP3 §3.10 | IP delivers packets best effort, no order or delivery guarantee (`inside-a-request` check, `tcp-udp` step 1) | Matches (“does not guarantee the delivery … does not preserve sequence integrity”). |
| CNP3 §3.12, §3.12.1–3.12.2 | TCP opens with a handshake (one round trip), numbers every byte, resends lost data, holds 4 and 5 back until 3 arrives; flow control slows for slow receivers (`inside-a-request`, `tcp-udp`) | Matches: three-way handshake; each byte consumes one sequence number; out-of-sequence data waits in the receive buffer until it can be delivered in sequence; receive window (down to 0 blocks the sender). |
| CNP3 §3.11 | UDP: no connection, no delivery or order guarantee; used for DNS, games (player position), live voice/video that recover from loss themselves (`tcp-udp`) | Matches (games “use UDP to minimize the delay and can recover from losses”; interactive voice/video expect < ~200 ms). QUIC/HTTP/3 is not in this release. |
| CNP3 §2.5, §3.2 | Computers route by numeric address; DNS maps the name; answer cached for its TTL (`inside-a-request`) | Matches (resolvers cache answers; TTL “indicates for how long a client or a resolver can store the Resource Record inside its cache”). |
| CNP3 §3.8.3 | TLS 1.3 costs one round trip; TLS 1.2 page load needed ≥ 4 RTTs (`inside-a-request`) | Matches: “TLS 1.3 aimed at reducing this handshake to one round-trip-time”. |
| CNP3 §3.4 | Reusing an open connection avoids the TCP set-up per request (`inside-a-request` exercise) | Matches (persistent connections, RFC 2616). |
| CNP3 §3.5 | CDN: edges in many places, nearest edge answers, miss → fetch from origin and keep a copy (`cdn`) | Matches (reverse proxies near users cache the most-used files; DNS returns the geographically closest proxy; on a miss the proxy contacts the server). `Cache-Control`/`max-age`, versioned filenames and “never cache private responses” are not in CNP3 (only If-Modified-Since): unchecked here. |
| CNP3 §3.5; AOSA nginx §14.1, §14.4 | Reverse proxy ends TLS, absorbs slow clients, compresses, spreads requests across servers (`proxies-gateways`) | Matches: nginx offloads “concurrency, latency processing, SSL, static content, compression and caching, connections and requests throttling”; slow clients tie up server memory; load balancing across upstreams (round robin, ip-hash) and re-routing away from failed ones; CNP3: reverse proxies in front of servers cache and spread load. |
| AOSA distsys §1.3 Load Balancers | Load balancer removes unhealthy nodes (`proxies-gateways` service-discovery step) | Partly: health checks remove unresponsive nodes. **API gateway and service registry/discovery: not covered by any open source read** (book-only, `fsa`). |
| SRE book Ch. 19, Load Balancing Using DNS | DNS / anycast global routing shifts users to the healthy region (`multi-region`) | Matches with a qualifier: DNS picks a datacenter by location, capacity and health; anycast is used for the nameservers; resolvers cache for the TTL, which “sets a lower bound on how quickly DNS changes can be propagated”. **Fixed wording** (TTL caveat added). |
| SRE book Ch. 19, VIP | `hash % N` remaps almost everything when N changes; consistent hashing limits it (`consistent-hashing`) | Matches (per web2 batch); `sreLbFront` attached. |
| Fowler CircuitBreaker | Pair timeouts with a circuit breaker: after many failures stop calling the dependency for a while and fail fast (`timeouts`; notifications / urlShortener / lldNotifications scripts: fallback to cache) | Matches: trips at a failure threshold, then returns errors without calling; half-open trial after an interval; clients use fallbacks such as stale data or a queue. |
| Fowler CircuitBreaker; SRE Ch. 22 | Hung calls hold threads until the pool is exhausted and everything fails (cascading failure) (`timeouts`) | Matches (“run out of critical resources leading to cascading failures”). Bulkheads: no lesson claims them; not covered by these sources. |
| AOSA NoSQL §13.5.1 | “No answer yet” can mean slow, dead or lost reply; you can’t tell which (`timeouts`) | Matches (“no way to know whether the network is down or the server … is unavailable”). |
| SRE Workbook Ch. 16 | Canary: small slice, compare with baseline, roll back automatically; blast radius ≈ share × error rate (`deployments`) | Matches (5% canary at 20% errors ≈ 1% overall; compare canary vs control; pause and roll back). Lesson numbers (0.2% → 0.44%) are consistent arithmetic. |
| SRE Workbook Ch. 16 | Blue-green: whole idle copy, instant switch back; feature flags switch features off without redeploying (`deployments`) | Matches (rollback “a trivial reversal of the router change”, twice the resources; feature flags separate launches from binary releases). Rolling deploys: not described. |
| AOSA distsys §1.1 | Availability, performance, cost are quality goals that trade off (`availability`, `requirements`, `cost`) | Matches: the six principles “can be at odds with one another”; cost is total cost of ownership incl. developer time and operations (`cost`: “include people’s time”). |
| AOSA distsys §1.2 Redundancy | Redundant copies remove a single point of failure; failover to the healthy copy (`availability`) | Matches. The serial/parallel availability arithmetic and the independence caveat are maths, not from this source. |
| Primer (already `v`); AOSA distsys §1.2 example | Clarify functional scope, non-functional targets and constraints before designing (`requirements`) | Matches the Primer note (use cases, constraints, assumptions) and AOSA’s image-hosting requirement list. “Functional vs non-functional” vocabulary and “write them with numbers”: not stated; book-only (`sap`, `sdi1`). |
| AOSA distsys §1.2 Services | Split services scale and fail independently (`monolith-microservices`) | Matches (“allows each piece to scale independently”, “help isolate problems”). Independent deploys per team, modular monolith, data-ownership boundaries: not covered (book-only `fsa`; DDD Reference partly). |
| PostgreSQL §5.10 | Enforce tenant isolation centrally with row-level security (`multitenancy`) | Matches with a qualifier: policies apply before query conditions, default deny — but table owners and superusers bypass them unless FORCE ROW LEVEL SECURITY. Wording left (it only names the mechanism). Tenancy models table: book-only (`fsa`). |
| AOSA distsys §1.2 Partitions, §1.3 Load Balancers | Vertical vs horizontal scaling; per-server session state breaks when a request lands elsewhere; sticky sessions break on failover (`stateless-scaling`) | Matches (shopping-cart example; sticky sessions make automatic failover hard; shared-nothing app servers scale horizontally). Signed tokens: covered by `rfc7519` elsewhere, not here. |
| — | `hld-vs-lld` cites `fsa` | **Not backed by any open source read.** HLD/LLD as interview vocabulary is not in AOSA; nothing attached. |
| AOSA NoSQL §13.1.1, §13.2 | Denormalize to make a read one lookup; document stores keep related data together (`normalization`); database families (`data-models`) | Matches: “denormalization stores all of the data … one might want to look up at once in a single place”; key-value, key-data-structure, document, column-family, graph. Update anomaly / normal forms: book-only (`ddia2`). |
| AOSA NoSQL §13.4.1; AOSA distsys §1.2 | Rare, slow-tolerant questions (revenue per venue) run on a copy; let the system’s needs drive the design (`access-patterns`) | Matches in principle (aggregates “can be executed against the slave replicas”; “determine the system needs … then benchmark”). The access-pattern table method itself: book-only. |
| AOSA NoSQL §13.4, §13.4.5 | Sharding: a function of the key picks the shard; client or router computes it; range vs hash (`sharding`) | Matches. Hot spots: covered only for busy *ranges* (split them); one hot key staying on one shard under hashing is not stated — book-only (`ddia6`). |
| AOSA NoSQL §13.4.3 | Fixed number of partitions (more than servers) moved whole between nodes (`consistent-hashing` worked text) | Matches (Voldemort: partitions “usually larger than the number of servers”). Previously book-only. |
| PostgreSQL §26.2.5, §26.2.9 | Followers lag the leader (usually milliseconds); a writer reading a follower may see old data; read-your-writes by routing (`replica-lag`, Stale reads lab) | Matches (asynchronous by default, typically under one second; §26.2.9 describes exactly this inconsistency and a WAIT FOR LSN fix). Monotonic reads by pinning a user: book-only. |
| PostgreSQL §26.2.8 | Synchronous replication: “Saved” waits for the follower; stalls if it is down; nobody sees the old name afterwards (`replica-lag`) | Matches with a qualifier: `synchronous_commit = on` waits for the standby to *flush*; only `remote_apply` waits until reads there see it. **Fixed wording.** |
| PostgreSQL §26.2.8, §26.3 | Async loses confirmed-but-unshipped writes; sync to one follower loses none if it survives; heartbeat + timeout; promote follower; split brain needs fencing (`failover`, `multi-region`) | Matches: loss “proportional to the replication delay”; heartbeat between primary and standby; promote with `pg_ctl promote`; STONITH to stop two primaries. PostgreSQL leaves detection to external tools. |
| AOSA NoSQL §13.3.2 | Cross-region replica is asynchronous (`multi-region`) | Matches (“updates are streamed without confirmation” across WANs). Active-active conflicts and ~100 ms consensus latency: `spanner`/book-only. |
| PostgreSQL §25.3 | Snapshot + continuously archived WAL; replay to just before the mistake (point-in-time recovery) (`backups-dr`) | Matches (“right before the junior DBA dropped your main transaction table”). RPO/RTO definitions, separate account/region, restore drills: book-only / general practice. |
| Fowler ParallelChange | Expand/contract (also called parallel change); each step safe with neighbours (`schema-evolution`); new field vs `/v2` (`api-design`) | Matches (three phases; database refactorings follow it; alternative to explicit API versioning; finish the contract phase). The field-change compatibility table: book-only (`ddia4`). |
| PostgreSQL §7.6 | Large OFFSET is slow because skipped rows are still computed (`api-design`) | Matches. Offset drift under inserts: follows from the definition; cursor/keyset seek is not on this page. |
| AOSA distsys §1.3 Queues | Queue between caller and worker: reply immediately, worker takes work at its own pace, survives worker outages (`queues`) | Matches (acknowledgement then async processing; protection from outages with retries). Pub/sub fan-out: book-only (`ddia11`). |
| Fowler CQRS; Fowler Event Sourcing | Store every change as an event, replay for state, snapshots, audit, new read models from history; CQRS separate write/read models, eventually consistent; use where it pays (`cqrs-event-sourcing`) | Matches. Event versioning “forever” is only touched (Code Changes); projections lagging the log is stated as eventual consistency in the CQRS article. |

## Per-topic coverage for DDIA / Database Internals topics

“Covered” = every substantive claim has a `v()` source (from this batch or the specs, papers, papers2, ops, web2 batches).

| Topic | Covered by | Claims still backed only by books |
|---|---|---|
| `first-booking` (ddia7) | `cnp3`, `ostepThreads` | — |
| `bridge-sql` (ddia2) | `pgIndexes` (specs batch notes it makes no index claim) | SQL basics themselves (not read against a source) |
| `memory-disk` (ddia3) | `ostepPersist` | memory and network latency figures (labelled order-of-magnitude) |
| `latency` (ddia1) | `sreMonitoring` | — |
| `throughput-bandwidth` (ddia1) | `sreOverload`, `ablBacklog` (Little’s law) | latency/throughput/bandwidth definitions; 70% planning headroom |
| `capacity-estimation` (ddia1, sdi1) | — | all (arithmetic method; peak factor) |
| `stateless-scaling` (ddia1) | `aosaDistsys` | — |
| `access-patterns` (ddia2) | `aosaNosql`, `aosaDistsys` (principle) | the access-pattern table method |
| `normalization` (ddia2) | `aosaNosql` (denormalization) | normalization/update anomaly |
| `indexes` (ddia3) | `pgIndexes`, `pgExplain` | — |
| `data-models` (ddia2) | `bigtable`, `dynamo`, `aosaNosql` | search, time-series, object-storage families |
| `storage-engines` (ddia3, dbInternals) | `pgWal`, `lsm`, `bigtable` | B-tree page splits / vacuum (specs batch) |
| `transactions`, `locking-mvcc` (ddia7) | `critique`, `pgIso`, `pgMvcc`, `pgLocking` | — |
| `replica-lag` (ddia5) | `pgHa` | monotonic reads by pinning |
| `failover` (ddia5) | `ablLeader`, `pgHa` | — |
| `sharding` (ddia6) | `aosaNosql`, `aosaDistsys` | single hot key under hashing; key+bucket splitting |
| `consistent-hashing` (ddia6) | `karger`, `dynamo`, `sreLbFront`, `aosaNosql` | — |
| `api-design` (ddia4) | `rfc9110`, `pgLimit`, `fowlerParallel` | cursor pagination mechanics |
| `caching` (ddia1) | `ablCaching` | delete-on-write, versioned keys, TTL jitter (ops batch) |
| `timeouts` (ddia8) | `sreCascading`, `ablRetries`, `fowlerBreaker`, `aosaNosql` | “many libraries default to wait forever” (`requests` default not read) |
| `clocks-ordering` (ddia8) | `lamport`, `spanner` | NTP, backward clock jumps |
| `consistency-models` (ddia9) | `vanSteen` | — |
| `cap-quorums` (ddia9) | `gilbertLynch`, `dynamo` | — |
| `consensus` (ddia9) | `raft`, `mit6824`, `ablLeader` | — |
| `queues` (ddia11) | `ablBacklog`, `aosaDistsys` | pub/sub fan-out |
| `logs-delivery` (ddia11) | — | **all**: partitions, offsets, consumer groups, at-least/at-most-once, poison messages (kafka.apache.org is blocked) |
| `batch-stream` (ddia10, ddia11) | `mapreduce` | event time, watermarks |
| `distributed-transactions` (ddia9) | `sagas` | outbox pattern |
| `cqrs-event-sourcing` (ddia11, ddia12) | `fowlerCqrs`, `fowlerEs` | — |
| `schema-evolution` (ddia4) | `fowlerParallel` | compatibility table (optional fields, enums) |
| `multi-region` (ddia5) | `sreLbFront`, `pgHa`, `aosaNosql`, `spanner` | active-active conflict handling; home-region design |
| `backups-dr` (ddia5) | `pgPitr` | RPO/RTO, off-site copies, restore drills |
| labs: Stale reads (ddia5), Partitioning (ddia6), Concurrent reservations (ddia7) | `pgHa`; —; `pgIso` | hot-spot lab: as `sharding` |

`dbInternalsDist` is cited by no topic.

## Entry and manifest changes
- New `v()` entries: `cnp3`, `fowlerBreaker`, `sreCanary`, `aosaDistsys`, `aosaNosql`, `aosaNginx`, `pgHa`, `pgPitr`, `pgRls`, `pgLimit`, `fowlerParallel`, `fowlerCqrs`, `fowlerEs`.
- `sreLbFront`: removed from `proxies-gateways`; added to `multi-region` and `consistent-hashing` (kept on `load-balancing`).
- Wording: `src/content/lessons/architecture1.ts:129` (multi-region, DNS TTL caveat); `src/ui/lessons/ReplicaLag.tsx:258` (synchronous = waits until applied).
