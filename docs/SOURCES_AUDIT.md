# Source verification audit

Session: 2026-11-19 (revamp). Method: each primary text was downloaded, converted to plain text, and the passage
behind a specific lesson claim was read and compared with the lesson. Only sources read this way are marked
`checked: true` in `src/content/sources.ts` (built with `v()`, which also records what was confirmed).
A table of contents can identify a topic; it does not verify a mechanism, so book entries stay unchecked.

## Network access

The previous session could not reach any primary-source host. This session added a personal cloud environment,
**system-design-masterclass**, that allows: `www.rfc-editor.org`, `raft.github.io`, `sre.google`, `aws.amazon.com`,
`builder.aws.com` (the Builders' Library now redirects there), `docs.python.org`, `www.postgresql.org`,
`pages.cs.wisc.edu`, `www.allthingsdistributed.com`, `static.googleusercontent.com`, `pdos.csail.mit.edu`,
`developer.mozilla.org`, and the design reference `designed-to-scale.vercel.app`.

Still not reachable (not requested): `html.spec.whatwg.org` (SSE spec; MDN used instead), `github.com` for the
System Design Primer (proxy 403), `openid.net`, `www.distributed-systems.net`, `docs.pytest.org`.

## Verified claims

| Source (section) | Lesson claim | Result |
|---|---|---|
| RFC 9110 §9.2.1–9.2.2 | GET, PUT, DELETE are idempotent; POST needs an idempotency key to be retried safely (`http-rest-rpc`, `idempotency`, `retries`) | Matches. **Fixed wording:** “POST is not idempotent by definition” → “the standard doesn’t define POST as idempotent, so a client can’t assume a retry is harmless” (RFC: clients SHOULD NOT auto-retry non-idempotent methods). |
| RFC 6585 §4 | Rate-limited requests get 429, optionally with Retry-After (`rate-limiting`, `retries`) | Matches. |
| RFC 9293 §3.5 (Fig. 6) | TCP set-up costs one round trip before the client can send (`inside-a-request`) | Matches: three-way handshake; the client's data can follow its ACK after one round trip. |
| RFC 8446 §2 (Fig. 1) | TLS 1.3 adds one round trip (`inside-a-request`) | Matches: client application data after one round trip. |
| RFC 1034 §3.6 | A DNS answer is cached, so the next request skips the lookup (`inside-a-request`) | Matches with a qualifier. **Fixed wording:** “cached for as long as its time-to-live (TTL) allows”. |
| RFC 6455 Abstract, §1.1 | WebSockets are two-way (`realtime-delivery`) | Matches. |
| MDN, Using server-sent events | SSE is one-way, server to client; browsers reconnect automatically (`realtime-delivery`) | Matches (“one-way connection”; the browser waits the reconnection time and reconnects). |
| Raft paper §5.1–5.4.1 | Randomised election timeouts; a stale-term message is rejected; commit on a majority; votes only for a log at least as up to date (`consensus`) | Matches. Timeouts 180/260 ms lie in the paper’s example 150–300 ms interval. **Fixed wording:** commit rule now says “an entry from the leader’s current term” (§5.4.2 caveat). The 100 ms heartbeat is illustrative, not from the paper. |
| SRE book Ch. 4 | SLI = a measure; SLO = target for an SLI (`slos`) | Matches. |
| SRE book Ch. 3 | Error budget = the failure the SLO allows, 1 − SLO (`slos`) | Matches (99.999% SLO → 0.001% budget). |
| Builders’ Library: timeouts, retries, backoff with jitter | Capped exponential backoff, jitter, retries multiplying across layers, limit attempts (`retries`, `lab-payment-retries`) | Matches. |
| Builders’ Library: idempotent APIs | A unique client request token makes a repeated request return an equivalent result (`idempotency`) | Matches. |
| OSTEP Ch. 26 (26.3–26.4) | Two threads incrementing a shared counter lose updates: a race condition (`bridge-threads`, `concurrency-lld`) | Matches (expected 20,000,000; actual result indeterminate). |
| Dynamo §4.2, §4.5 | Consistent hashing with virtual nodes; R + W > N gives quorum-like behaviour, with sloppy-quorum caveats (`consistent-hashing`, `cap-quorums`) | Matches. |
| PostgreSQL §13.2 | Isolation levels; check what your database’s default prevents (`transactions`) | Matches: Read Committed is PostgreSQL’s default; its Repeatable Read also prevents phantom reads. |
| PostgreSQL §13.1 | With MVCC, readers and writers don’t block each other (`locking-mvcc`) | Matches. |
| Python docs, OrderedDict | `move_to_end` on use; `popitem(last=False)` evicts the oldest (`lru-cache`) | Matches (FIFO when `last=False`). |

## Not verified (honest status)

- **Books** (DDIA, Database Internals, van Steen & Tanenbaum, Kurose & Ross, Fundamentals of Software Architecture,
  Software Architecture in Practice, Release It!, Design Patterns, Head First, A Philosophy of Software Design,
  Refactoring, Effective Java, DDD, PoEAA, System Design Interview 1–2): not accessible from this environment.
  They remain pointers to where a topic is treated; the lessons’ claims were not checked against them.
- **Papers not read this session:** MapReduce, Bigtable, Spanner, GFS, Karger et al., Lamport 1978, Gilbert & Lynch,
  Sagas, LSM-tree, Critique of ANSI SQL Isolation Levels. The hosts for the Google papers are allowed; reading them
  is the next step for the batch/stream, storage-engine and consistency lessons.
- **Docs reachable but not yet compared:** other PostgreSQL pages (indexes, EXPLAIN, WAL, explicit locking), other
  Python pages (threading, dataclasses, typing.Protocol, abc, enum, unittest.mock), other SRE chapters (overload,
  cascading failures, load balancing, monitoring), other Builders’ Library articles (backlogs, load shedding,
  caching, leader election, shuffle sharding), RFCs 9113, 9114, 768, 791, 6749, 7519, 8259.
- Illustrative numbers in lessons and simulations (latencies, rates, lags) are model assumptions, labelled in each
  lesson’s “Model” note or chart note; they are not claims about any real system.

## Next action

Read the Google papers and the remaining reachable docs above, one lesson at a time, and mark each source with `v()`
only after its claims have been compared.

## 2026-11-20 verification pass

Five batches, each reading the primary text from an allowed host before marking `v()`. Full per-batch notes are kept in `docs/sources-check/`.

### Papers (MapReduce, Bigtable, GFS, Spanner, Dynamo)

PDFs read via static.googleusercontent.com (MapReduce, Bigtable, GFS, Spanner) and www.allthingsdistributed.com (Dynamo).
Not read: Karger 1997, Lamport 1978, Gilbert & Lynch, Sagas, LSM-tree, Critique of ANSI SQL (not on an allowed host); entries stay unchecked. Also added `bigtable` to the `storage-engines` topic’s sources in manifest.ts since the lesson’s LSM write path is taken from §5.3–5.4.

| Source (section) | Lesson claim | Result |
|---|---|---|
| Bigtable §2, §5.3 (`data-models`, data1.ts:135) | Wide-column stores organise rows by key and spread them over many machines; suit big data read by key ranges | Matches: rows kept in lexicographic key order; a row range (tablet) is the unit of distribution; short row-range reads touch few machines. |
| Bigtable §7 (`data-models`, data1.ts:136) | Wide-column suits massive write throughput | Matches: paper reports writes faster than random reads because each tablet server appends all writes to one commit log with group commit. The “sensor readings” example is the lesson’s own, not the paper’s. |
| Bigtable §5.3–5.4 (`storage-engines`, data1.ts:172–195) | WAL first, then sorted in-memory memtable; a full memtable is written out as an immutable sorted run (SSTable); reads check memtable then runs; compaction merges runs | Matches (commit log of redo records, memtable, SSTable “ordered immutable map”, minor and merging compactions). Qualifier: “the log can be trimmed” and “keeping only the newest value per key” are standard LSM behaviour; the paper states that a minor compaction shortens recovery log replay and that major compactions drop deleted data, not those exact phrases. Kept as is. |
| Bigtable §6 Bloom filters (`storage-engines`, data1.ts:190) | LSM reads are helped by Bloom filters | Matches (Bloom filters on SSTables reduce disk seeks). |
| Spanner §1, §3, §4.1.2 (`clocks-ordering`, distributed2.ts:193, 195) | Spanner bounds clock uncertainty with special hardware and waits it out; TrueTime gives global order consistent with real time, cost is special infrastructure and commit waits | Matches (GPS and atomic-clock masters; commit wait; external consistency; ~5 ms commit wait in §7). |
| Spanner §2 (`consensus`, distributed3.ts:34) | Spanner replicates with Paxos groups | Matches (each tablet has a Paxos state machine; replicas form a Paxos group). |
| MapReduce §3.1, §3.3, §2 (`batch-stream`, distributed3.ts:196) | MapReduce is a batch system over a bounded dataset; rerunning gives the same answer | Matches with a qualifier: the paper guarantees output equal to a sequential run only when map and reduce are deterministic. **Fixed wording** (distributed3.ts): “rerun it and, if its logic is deterministic, get the same answer”. “Minutes to hours” latency and the Spark/Kafka/Flink examples are not from this paper. |
| GFS §2.3, §3.2 (`case-file-sync`) | Bytes and metadata are kept on separate paths; a metadata service tracks which chunks make a file | Matches in principle: GFS master holds only metadata (file-to-chunk map), data-bearing traffic goes direct to chunkservers, and data flow is decoupled from control flow. Not covered: ~4 MB content-hash-named chunks (GFS uses 64 MB chunks, not content-addressed), content-defined chunking, and the chunks-before-commit ordering are the lesson’s own design, not GFS claims. Entry marked checked with that narrow note. |
| Dynamo §6 intro, §6.1 (`cap-quorums`, distributed2.ts:265) | “Dynamo-style stores let you tune R and W per request” | **Wrong as attributed.** The paper has N, R, W configured per instance / per application (common setting 3, 2, 2), not per request. **Fixed wording**: “let each application tune N, R and W (the Dynamo paper’s common setting is 3, 2, 2)”. |
| Dynamo §4.2 (`consistent-hashing`, data2.ts:190–191) | Dynamo-style stores use consistent hashing with virtual nodes | Matches (already checked; Dynamo entry extended with §6). |

### Specifications (RFCs, PostgreSQL, Python docs)

Read 2026-11-20 from www.rfc-editor.org, www.postgresql.org and docs.python.org (PostgreSQL pages are the current version, 18/19 devel nav).
## Not covered / left unchecked
- `rfc9113`/`rfc9114`/`rfc791`/`pyAbc`/`pyEnum`: `rfc791`, `pyAbc`, `pyEnum` appear in no manifest topic’s source list.

| Source (section) | Lesson claim | Result |
|---|---|---|
| RFC 8259 §1, §3 | JSON: braces hold named fields, brackets hold lists, values are strings, numbers, true/false/null (`bridge-json`) | Matches. “Old apps ignore unknown fields” and `json.loads` are not RFC 8259 claims (client behaviour; Python `json` docs, not read). |
| RFC 768 Introduction | UDP: no connection, delivery not guaranteed, no resend (`tcp-udp`) | Matches with a qualifier: the RFC says “delivery and duplicate protection are not guaranteed” and sends ordered reliable needs to TCP; ordering is implied, not stated. “Flow control: none” is an absence, not stated. |
| RFC 791 §1.2, §2.3 | Packets can be lost/reordered; routing is by numeric IP address (`tcp-udp`, `inside-a-request`) | Matches: fixed 32-bit addresses; no mechanisms for end-to-end reliability, flow control or sequencing. |
| RFC 9113 §1 | HTTP/2 sends many requests over one connection; runs over TCP; TCP head-of-line blocking remains (`inside-a-request`, `tcp-udp`) | Matches (“TCP head-of-line blocking is not addressed by this protocol”). |
| RFC 9114 §1.1–1.2, §10.9 | HTTP/3 runs over QUIC on UDP; loss stalls only the affected stream; 0-RTT has replay caveats (`inside-a-request`, `tcp-udp`) | Matches. **Fixed wording:** “merging the transport and TLS handshakes into one round trip” → “builds TLS 1.3 into the transport handshake” (the RFC says QUIC incorporates TLS 1.3 and improves setup latency but does not state “one round trip”; that figure is in the QUIC RFCs, not read). |
| RFC 6749 §1, §1.3.1 | OAuth lets a user grant an app an access token for an API without sharing the password; the authorization-code flow keeps the token off the browser (`authn-authz`) | Matches (token goes directly to the client, not through the user agent; implicit grant puts it in the URI fragment). ID tokens are OIDC, not this RFC. |
| RFC 7519 §1, §4.1.4 | A signed JWT carries identity itself, no lookup; hard to revoke before expiry (`authn-authz`) | Partly covered: claims + signature (JWS) and `exp` confirmed. The RFC defines no revocation, so “hard to revoke” is general knowledge, not from this source. |
| PostgreSQL §11.1, §11.2.1, §11.3 | An index is a sorted structure that turns a scan into a lookup; it costs writes; column order matters (`indexes`) | Matches. **Fixed wording:** “an index on (event_id, status) helps event_id alone, but not status only” → “much less effective … typically has to read most of the index” (docs: a multicolumn B-tree can be used for any subset of columns, most efficient on leading columns; PostgreSQL 18 adds skip scan). “Updated on each insert, update and delete” → “kept in sync … as rows are inserted, updated and deleted” (HOT updates can skip index changes). |
| PostgreSQL §14.1 Using EXPLAIN | EXPLAIN shows the plan: Seq Scan before, Index Scan after, Index Cond (`indexes`) | Matches. **Fixed caption:** real EXPLAIN shows cost and estimated rows, not “rows examined”; the lesson’s sample is labelled illustrative. |
| PostgreSQL §28.3 WAL | Log first, then change data; replay the log after a crash; sequential append (`storage-engines`) | Matches. **Fixed wording:** “once it’s there, a crash can’t lose it” → “once it has been flushed to disk” (docs: records must be flushed to permanent storage; asynchronous commit relaxes this). “Page splits, vacuum” for B-trees and the LSM side are not in this page. |
| PostgreSQL §13.3.2, §13.3.4 | FOR UPDATE locks a row; deadlocks are detected and one transaction is aborted; consistent lock order prevents them (`locking-mvcc`) | Matches. **Fixed wording:** “stops others from changing (or sometimes reading) a row” → “from changing a row, or from locking it themselves (e.g. SELECT … FOR UPDATE)” (plain SELECTs are never blocked by row locks). |
| PostgreSQL §13.2 / §24.1 (context) | MVCC snapshot “as of when it started”; old versions cleaned up by vacuum (`locking-mvcc`) | **Fixed wording:** PostgreSQL’s default Read Committed takes a new snapshot per statement; only Repeatable Read/Serializable keep the transaction-start snapshot. Vacuum removing dead row versions confirmed (§24.1). |
| Python threading (Lock objects; `with` statement) | `with self.lock:` runs the block one thread at a time and always releases; `acquire(timeout=…)` gives up (`bridge-threads`, `concurrency-lld`) | Matches (`with lock:` ≡ acquire + try/finally release). `with a, b:` acquiring in order is the language reference, `queue.Queue` is another module: not covered here. |
| Python dataclasses (frozen; `__post_init__`) | Frozen dataclass refuses assignment; `__post_init__` runs after fields are set; keyword args with defaults (`contracts-invariants`, `pattern-factory-builder`) | Matches. **Fixed wording:** docs say frozen “emulates” immutability (“not possible to create truly immutable Python objects”), so “makes an immutable class” → “makes instances read-only”, “can’t be modified” → “refuse changes to their fields”. |
| Python typing.Protocol; glossary duck-typing | Protocol writes down the promise for type checkers; Card/Wallet match without naming it (`bridge-interfaces`) | Matches (“structural subtyping (static duck-typing)”, used by static type checkers). |
| Python stdtypes dict; glossary hashable | Keys must not change after insertion (`bridge-maps`) | Matches (hash never changes during lifetime; unhashable mutable containers rejected). “Near-constant time” is not on this page (links to the TimeComplexity wiki, not reachable): unchecked. |
| Python unittest.mock intro | A mock records calls so you can assert on them; stubs return canned answers (`testing`, `dependency-injection`) | Matches the definition. The lessons use hand-written fakes/stubs and never import `unittest.mock`; `clock=time.time` defaults are not from this source. |
| Python abc.abstractmethod; enum | `ABC` + `@abstractmethod` force each state class to implement every action (`pattern-state`); `Enum` gives a fixed set of named states (`state-machines`) | Matches (abstract classes can’t be instantiated until all abstract methods are overridden; an enum is a set of symbolic names bound to unique values). Neither key is listed in `manifest.ts` for those lessons yet. |

### Operations (SRE books, Builders’ Library, OSTEP)

Method as in docs/SOURCES_AUDIT.md: each source downloaded, the passage behind each lesson claim read and compared.

| Source (section) | Lesson claim | Result |
|---|---|---|
| OSTEP Ch. 4 (4.1) | A process is a running program; its address space is part of it (`processes-threads`) | Matches. Isolation between processes is not stated in this chapter; not checked. |
| OSTEP Ch. 28 (28.1) | A lock makes a block run one thread at a time (`concurrency-lld`) | Matches (critical section executes as if a single atomic instruction; exactly one holder). |
| OSTEP Ch. 32 (32.3) | Deadlock = circular waiting; a global lock order prevents it; a timeout/try-lock avoids waiting forever (`concurrency-lld`) | Matches. OSTEP lists four conditions (mutual exclusion, hold-and-wait, no preemption, circular wait); total ordering breaks circular wait; trylock can livelock. Database row-lock deadlock claim is not in OSTEP. |
| OSTEP Ch. 37 (Fig. 37.5), Ch. 44 (44.4) | Disk keeps data when off; spinning disk seek about 10 ms; SSD read about 100 µs (`memory-disk`) | Matches as orders of magnitude: average seek 4–9 ms; raw flash read 25–75 µs. Memory 0.1 µs and network round trips are not covered by OSTEP (lesson labels them as order-of-magnitude figures). |
| SRE book Ch. 6 | Average hides the tail; fan-out makes one backend's p99 the page's typical time; aggregate distributions (`latency`) | Matches (100 ms mean can hide 1% of requests at 5 s). |
| SRE book Ch. 6 | Metrics for alerting/dashboards, logs as white-box data (`observability`) | Matches in part. Traces, "RED" and utilisation/saturation/errors naming are not in this chapter (the chapter has the four golden signals). Wording left as is; the lesson does not cite the chapter for them. |
| SRE book Ch. 21 | Shed low-value work to protect important work; retries budgeted (`backpressure`, `lab-load-balancing`) | Matches (criticality tiers, sheddable traffic rejected first; per-client retry budget about 10%). The lesson's 70% planning headroom is not from this source. |
| SRE book Ch. 22 | Slow dependency exhausts threads and spreads (cascading failure); retries multiply across layers; backoff with jitter; limit retries; deadlines propagated (`timeouts`, `retries`) | Matches. Chapter's example is 4 attempts per layer = 64; the lesson uses 3 attempts per layer = 27 (consistent). Circuit breaker is not in this chapter. |
| SRE book Ch. 20 | Round robin ignores slow servers; least connections steers away from them (`load-balancing`, `lab-load-balancing`) | Matches with a qualifier. **Fixed wording:** "Load follows capacity automatically" became "Load tends to follow capacity, though open connections are only a rough proxy for it"; the table's watch-out now notes that a server failing fast can look idle and attract traffic (sinkholing). Power of two choices is not in this chapter. |
| SRE book Ch. 19 (frontend LB) | Reverse proxies, API gateways, service discovery (`proxies-gateways`) | Not covered: the chapter is about DNS and VIP load balancing. Left unchecked. |
| SRE Workbook Ch. 2 | SLI = good events / total events; 100% is the wrong SLO (`slos`) | Matches. Burn-rate alerting is in a later workbook chapter, not this one. |
| Builders' Library: queue backlogs | A backlog grows when arrivals exceed processing; alert on message age; backpressure and sidelining; Little's law (`queues`, `backpressure`, `lab-queue-backlog`) | Matches. |
| Builders' Library: load shedding | Overloaded servers reject excess requests to keep goodput; prioritise (`backpressure`) | Matches. |
| Builders' Library: caching | Local caches inconsistent across a fleet and cold-start; shared cache reduces coherence problems; TTL and LRU most common; request coalescing fixes the stampede (`caching`, `cache-invalidation`, `lru-cache`, `lab-cache`) | Matches. Delete-on-write, versioned keys, TTL jitter, early refresh are not in this article (lesson states them as common practice, not as the article's claims). |
| Builders' Library: leader election | Leases are the common mechanism; coordination services (ZooKeeper, DynamoDB lock client); a deposed leader must stop (`consensus`, `failover`) | Matches with a qualifier. **Fixed wording (`failover`, split brain):** "a majority vote on who leads" became "one agreed answer on who leads, such as a majority vote or an expiring lease". The article also says exactly-one-leader cannot be guaranteed; zero or two leaders can occur during failures. |
| Builders' Library: shuffle sharding | Each tenant gets a small subset of servers so one bad tenant affects few (`multitenancy`) | Matches with a qualifier. **Fixed wording:** other tenants sharing some of its servers are only partly affected and survive if clients retry; the article does not say the assignment is random. |

### Interview scripts

All 31 interview scripts were fact-checked against their cases, the tested Python, and the simulations (re-run per activity). HLD: 23 corrections in 13 scripts (`docs/sources-check/interview-hld-review.md`). LLD: corrections in 9 of 13 scripts, including a states-activity defect that scored correct designs as stuck (`docs/sources-check/interview-lld-review.md`). These checks compare against standard documented behaviour; they are not human review.
