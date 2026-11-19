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
