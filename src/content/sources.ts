/**
 * Source library. Each entry points to a book chapter, paper, RFC, or official document
 * that treats a topic in depth.
 *
 * `checked: false` means the pointer comes from the work's published table of contents or
 * well-known structure, but the specific claims in our lessons have NOT been verified against
 * the source text. Books are not accessible from the authoring environment, so book entries stay
 * unchecked. Entries built with `v()` were read on 2026-11-19 (see docs/SOURCES_AUDIT.md).
 * Never mark an entry checked without actually reading the cited section.
 */
import type { Source } from './types';

const s = (title: string, where?: string, url?: string): Source & { checked: boolean } => ({ title, where, url, checked: false });
/**
 * Verified: the cited section was read on 2026-11-19 and the lessons' claims compared with it. `note` says
 * what was confirmed. Details, including simplifications and what was not checked: docs/SOURCES_AUDIT.md.
 */
const v = (title: string, where: string, url: string, note: string): Source & { checked: boolean } => ({ title, where, url, note, checked: true });

export const SRC = {
  // Designing Data-Intensive Applications (Kleppmann, 1st ed., O'Reilly 2017)
  ddia1: s('Designing Data-Intensive Applications (Kleppmann)', 'Ch. 1, Reliable, Scalable, and Maintainable Applications'),
  ddia2: s('Designing Data-Intensive Applications (Kleppmann)', 'Ch. 2, Data Models and Query Languages'),
  ddia3: s('Designing Data-Intensive Applications (Kleppmann)', 'Ch. 3, Storage and Retrieval'),
  ddia4: s('Designing Data-Intensive Applications (Kleppmann)', 'Ch. 4, Encoding and Evolution'),
  ddia5: s('Designing Data-Intensive Applications (Kleppmann)', 'Ch. 5, Replication'),
  ddia6: s('Designing Data-Intensive Applications (Kleppmann)', 'Ch. 6, Partitioning'),
  ddia7: s('Designing Data-Intensive Applications (Kleppmann)', 'Ch. 7, Transactions'),
  ddia8: s('Designing Data-Intensive Applications (Kleppmann)', 'Ch. 8, The Trouble with Distributed Systems'),
  ddia9: s('Designing Data-Intensive Applications (Kleppmann)', 'Ch. 9, Consistency and Consensus'),
  ddia10: s('Designing Data-Intensive Applications (Kleppmann)', 'Ch. 10, Batch Processing'),
  ddia11: s('Designing Data-Intensive Applications (Kleppmann)', 'Ch. 11, Stream Processing'),
  ddia12: s('Designing Data-Intensive Applications (Kleppmann)', 'Ch. 12, The Future of Data Systems'),
  dbInternals: s('Database Internals (Petrov)', 'Part I, Storage Engines (B-Trees, log-structured storage)'),
  dbInternalsDist: s('Database Internals (Petrov)', 'Part II, Distributed Systems (failure detection, leader election, replication, consensus)'),
  vanSteen: s('Distributed Systems (van Steen & Tanenbaum)', 'Chapters on coordination, consistency and replication, fault tolerance', 'https://www.distributed-systems.net/'),
  mit6824: s('MIT 6.5840 (formerly 6.824) Distributed Systems, lecture notes and labs', undefined, 'https://pdos.csail.mit.edu/6.824/'),

  kurose: s('Computer Networking: A Top-Down Approach (Kurose & Ross)', 'Ch. 1–3: the Internet, application layer (HTTP, DNS), transport layer (TCP, UDP)'),
  ostepProc: v('Operating Systems: Three Easy Pieces', 'Ch. 4, The Abstraction: The Process (4.1)', 'https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-intro.pdf', 'a process is a running program; the memory it can address (its address space) is part of the process'),
  ostepThreads: v('Operating Systems: Three Easy Pieces', 'Ch. 26, Concurrency: An Introduction (26.3–26.4, shared counter)', 'https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf', 'two threads incrementing a shared counter give an indeterminate result: a race condition'),
  ostepLocks: v('Operating Systems: Three Easy Pieces', 'Ch. 28, Locks (28.1, the basic idea)', 'https://pages.cs.wisc.edu/~remzi/OSTEP/threads-locks.pdf', 'a lock around a critical section makes it execute as if it were a single atomic instruction; exactly one thread holds an acquired lock'),
  ostepBugs: v('Operating Systems: Three Easy Pieces', 'Ch. 32, Common Concurrency Problems (32.3, deadlock bugs: conditions and prevention)', 'https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf', 'deadlock needs mutual exclusion, hold-and-wait, no preemption and circular wait; a total order on lock acquisition prevents circular wait; trylock avoids waiting forever but can livelock'),
  ostepPersist: v('Operating Systems: Three Easy Pieces', 'Ch. 37, Hard Disk Drives (Fig. 37.5) and Ch. 44, Flash-based SSDs (44.4)', 'https://pages.cs.wisc.edu/~remzi/OSTEP/file-disks.pdf', 'disks and SSDs keep data when powered off; average disk seek 4–9 ms; raw flash read 25–75 µs (10s of µs). Memory and network latencies are not from this source'),

  rfc9110: v('RFC 9110: HTTP Semantics', 'Sec. 9.2.1 Safe Methods; Sec. 9.2.2 Idempotent Methods', 'https://www.rfc-editor.org/rfc/rfc9110', 'PUT, DELETE and safe methods are idempotent; POST is not defined as idempotent; clients should not retry non-idempotent requests automatically'),
  rfc9113: v('RFC 9113: HTTP/2', 'Sec. 1, Introduction', 'https://www.rfc-editor.org/rfc/rfc9113', 'HTTP/2 allows many requests interleaved on one connection over TCP; TCP head-of-line blocking is not addressed by HTTP/2'),
  rfc9114: v('RFC 9114: HTTP/3', 'Sec. 1.1–1.2, Introduction; Sec. 10.9, Early Data', 'https://www.rfc-editor.org/rfc/rfc9114', 'HTTP/3 maps HTTP onto QUIC (UDP); QUIC builds in TLS 1.3 and gives reliability per stream, so a lost packet no longer stalls every request; 0-RTT data is exposed to replay. The one-round-trip handshake figure is not stated in this RFC'),
  rfc9293: v('RFC 9293: Transmission Control Protocol (TCP)', 'Sec. 3.5, Establishing a Connection (three-way handshake, Figure 6)', 'https://www.rfc-editor.org/rfc/rfc9293', 'connection set-up is a three-way handshake'),
  rfc768: v('RFC 768: User Datagram Protocol', 'Introduction', 'https://www.rfc-editor.org/rfc/rfc768', 'UDP sends with minimum protocol mechanism; delivery and duplicate protection are not guaranteed; applications needing ordered reliable delivery should use TCP'),
  rfc8446: v('RFC 8446: TLS 1.3', 'Sec. 2, Protocol Overview (Figure 1, full handshake)', 'https://www.rfc-editor.org/rfc/rfc8446', 'the client sends application data after one round trip of handshake'),
  rfc1034: v('RFC 1034: Domain Names — Concepts and Facilities', 'Sec. 3.6, Resource Records (TTL)', 'https://www.rfc-editor.org/rfc/rfc1034', 'resolvers cache answers for at most their TTL'),
  rfc791: v('RFC 791: Internet Protocol', 'Sec. 1.2, Scope; Sec. 2.3, Function Description (Addressing)', 'https://www.rfc-editor.org/rfc/rfc791', 'IP delivers datagrams by fixed-length 32-bit address with no mechanisms for end-to-end reliability, flow control or sequencing'),
  rfc6455: v('RFC 6455: The WebSocket Protocol', 'Abstract and Sec. 1.1, Background', 'https://www.rfc-editor.org/rfc/rfc6455', 'two-way communication between client and server over one connection'),
  sse: s('HTML Living Standard: Server-sent events', undefined, 'https://html.spec.whatwg.org/multipage/server-sent-events.html'),
  mdnSse: v('MDN Web Docs', 'Using server-sent events', 'https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events', 'SSE is one-way, server to client; the browser reconnects after a lost connection'),
  rfc6749: v('RFC 6749: The OAuth 2.0 Authorization Framework', 'Sec. 1, Introduction; Sec. 1.3.1, Authorization Code', 'https://www.rfc-editor.org/rfc/rfc6749', 'the user grants a client an access token without sharing credentials; in the authorization code flow the token goes straight to the client, not through the user agent (unlike the implicit grant, which puts it in the URI fragment)'),
  rfc7519: v('RFC 7519: JSON Web Token (JWT)', 'Sec. 1, Introduction; Sec. 4.1.4, exp claim', 'https://www.rfc-editor.org/rfc/rfc7519', 'a JWT carries its claims and can be digitally signed (JWS); exp makes it unacceptable after a time. The RFC defines no revocation mechanism, so the lesson’s revocation point is general knowledge, not from this source'),
  oidc: s('OpenID Connect Core 1.0', undefined, 'https://openid.net/specs/openid-connect-core-1_0.html'),
  rfc6585: v('RFC 6585: Additional HTTP Status Codes', 'Sec. 4, 429 Too Many Requests', 'https://www.rfc-editor.org/rfc/rfc6585', '429 signals rate limiting and may carry Retry-After'),
  rfc8259: v('RFC 8259: The JSON Data Interchange Format', 'Sec. 1, Introduction; Sec. 3, Values', 'https://www.rfc-editor.org/rfc/rfc8259', 'objects are name/value pairs, arrays are ordered lists; values are strings, numbers, true, false, null, objects or arrays'),

  fsa: s('Fundamentals of Software Architecture (Richards & Ford)', 'Architecture characteristics; modular monolith and microservices styles'),
  sap: s('Software Architecture in Practice (Bass, Clements & Kazman)', 'Quality attributes: availability, performance, modifiability'),
  releaseIt: s('Release It! (Nygard)', 'Stability antipatterns and stability patterns: timeouts, circuit breaker, bulkheads'),
  sreSlo: v('Site Reliability Engineering (Google)', 'Ch. 4, Service Level Objectives (SLI and SLO definitions)', 'https://sre.google/sre-book/service-level-objectives/', 'an SLI is a measure of service; an SLO is a target for an SLI'),
  sreRisk: v('Site Reliability Engineering (Google)', 'Ch. 3, Embracing Risk: Motivation for Error Budgets', 'https://sre.google/sre-book/embracing-risk/', 'the error budget is the failure rate the SLO allows (1 − SLO)'),
  sreMonitoring: v('Site Reliability Engineering (Google)', 'Ch. 6, Monitoring Distributed Systems (four golden signals; Worrying About Your Tail)', 'https://sre.google/sre-book/monitoring-distributed-systems/', 'a mean hides the tail (100 ms mean can hide 1% of requests at 5 s); with several backends the 99th percentile of one becomes the median of the page; aggregate distributions, not averages. Traces and the RED/USE method names are not in this chapter'),
  sreOverload: v('Site Reliability Engineering (Google)', 'Ch. 21, Handling Overload (criticality, utilization signals, retries)', 'https://sre.google/sre-book/handling-overload/', 'under overload reject lower-criticality (sheddable) traffic first; retry budgets (about 10% per client) and retrying only at the layer above the rejecting one'),
  sreCascading: v('Site Reliability Engineering (Google)', 'Ch. 22, Addressing Cascading Failures (thread starvation, retries, deadlines)', 'https://sre.google/sre-book/addressing-cascading-failures/', 'overload exhausts threads and spreads as a cascading failure; retries multiply across layers; randomized exponential backoff, retry limits and budgets; set deadlines and propagate them. Circuit breakers are not in this chapter'),
  sreLbFront: s('Site Reliability Engineering (Google)', 'Load Balancing at the Frontend', 'https://sre.google/sre-book/load-balancing-frontend/'),
  sreLbDc: v('Site Reliability Engineering (Google)', 'Ch. 20, Load Balancing in the Datacenter (policies)', 'https://sre.google/sre-book/load-balancing-datacenter/', 'round robin can leave a 2x CPU spread (varying query cost, antagonistic neighbours); least-loaded steers away from slow tasks but counts only one client’s view and can sinkhole traffic to a task that fails fast. Power of two choices is not in this chapter'),
  sreWorkbookSlo: v('The Site Reliability Workbook (Google)', 'Ch. 2, Implementing SLOs (Why SLOs; SLI as good events over total events)', 'https://sre.google/workbook/implementing-slos/', 'an SLI is the ratio of good events to total events; 100% is the wrong target because change is the main source of outages and customers’ own chain of systems fails. Burn-rate alerting is not in this chapter'),
  ablRetries: v('Amazon Builders’ Library', 'Timeouts, retries, and backoff with jitter', 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/', 'capped exponential backoff, jitter, retries multiplying across layers, limiting retries locally'),
  ablIdempotent: v('Amazon Builders’ Library', 'Making retries safe with idempotent APIs', 'https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/', 'a unique client request token lets the service return an equivalent response to a repeated request'),
  ablBacklog: v('Amazon Builders’ Library', 'Avoiding insurmountable queue backlogs', 'https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/', 'a queue persists messages through outages but a backlog can raise recovery time; measure the age of messages; send backpressure upstream and prioritise or sideline work; Little’s law'),
  ablShedding: v('Amazon Builders’ Library', 'Using load shedding to avoid overload', 'https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/', 'an overloaded server rejects excess requests so it keeps goodput for those it accepts; triage by priority (e.g. crawler traffic below human traffic)'),
  ablCaching: v('Amazon Builders’ Library', 'Caching challenges and strategies', 'https://aws.amazon.com/builders-library/caching-challenges-and-strategies/', 'in-memory caches are inconsistent across a fleet and cold-start; external caches reduce coherence problems; TTL is the most common expiry and LRU the most common eviction; thundering herd is fixed by request coalescing. Delete-on-write, versioned keys and TTL jitter are not in this article'),
  ablLeader: v('Amazon Builders’ Library', 'Leader election in distributed systems', 'https://aws.amazon.com/builders-library/leader-election-in-distributed-systems/', 'leases are the most common election mechanism; no system can guarantee exactly one leader (zero or two during failures); a leader must be deposed before another is elected if at most one is required; RDBMS leader election is often manual'),
  ablShuffle: v('Amazon Builders’ Library', 'Workload isolation using shuffle-sharding', 'https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/', 'each customer gets a virtual shard of a few workers; a problem hits that shard but at most one worker of any other shard; the impact is a small fraction of the fleet'),

  gof: s('Design Patterns: Elements of Reusable Object-Oriented Software (Gamma, Helm, Johnson, Vlissides)', 'Pattern catalog: creational, structural, behavioral'),
  headFirst: s('Head First Design Patterns (Freeman & Robson)'),
  posd: s('A Philosophy of Software Design (Ousterhout)', 'Modules Should Be Deep; Information Hiding (and Leakage)'),
  refactoring: s('Refactoring, 2nd ed. (Fowler)', 'Bad smells in code; catalog of refactorings'),
  // Java-specific; kept only as optional further reading (Amendment 1).
  effJava: s('Effective Java, 3rd ed. (Bloch) — optional, Java-specific', 'Item 15 minimize accessibility; Item 17 minimize mutability; Item 18 favor composition over inheritance'),
  effJavaCreate: s('Effective Java, 3rd ed. (Bloch) — optional, Java-specific', 'Item 1 static factory methods; Item 2 builders'),
  ddd: s('Domain-Driven Design (Evans)', 'Part II: entities, value objects, aggregates, repositories'),
  poeaa: s('Patterns of Enterprise Application Architecture (Fowler)', 'Repository, Unit of Work, Identity Map, Optimistic Offline Lock'),

  sdi1: s('System Design Interview, Vol. 1 (Alex Xu)', 'used for interview scope'),
  sdi2: s('System Design Interview, Vol. 2 (Alex Xu & Sahn Lam)', 'used for interview scope'),
  primer: s('The System Design Primer (Donne Martin)', 'used for topic breadth', 'https://github.com/donnemartin/system-design-primer'),

  dynamo: v('DeCandia et al., “Dynamo: Amazon’s Highly Available Key-value Store”, SOSP 2007', 'Sec. 4.2 Partitioning (virtual nodes); Sec. 4.5 get() and put() (R + W > N); Sec. 6 (N, R, W configured per instance, common setting 3, 2, 2)', 'https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf', 'consistent hashing with virtual nodes; R + W > N gives a quorum-like system; N, R and W are tuned per application/instance, not per request'),
  raft: v('Ongaro & Ousterhout, “In Search of an Understandable Consensus Algorithm”, USENIX ATC 2014', 'Sec. 5.1–5.4 (terms, leader election, log replication, election restriction)', 'https://raft.github.io/raft.pdf', 'randomised election timeouts; stale terms rejected; commit on a majority; votes only for an up-to-date log'),
  mapreduce: v('Dean & Ghemawat, “MapReduce: Simplified Data Processing on Large Clusters”, OSDI 2004', 'Sec. 3.1 Execution Overview; Sec. 3.3 Fault Tolerance (semantics in the presence of failures)', 'https://static.googleusercontent.com/media/research.google.com/en//archive/mapreduce-osdi04.pdf', 'a batch job over a fixed set of input files, split into map tasks and reduce tasks; with deterministic map and reduce functions the output equals a sequential run, so a re-run gives the same result'),
  bigtable: v('Chang et al., “Bigtable: A Distributed Storage System for Structured Data”, OSDI 2006', 'Sec. 2 Data Model (rows, tablets); Sec. 5.3 Tablet Serving; Sec. 5.4 Compactions; Sec. 6 Bloom filters', 'https://static.googleusercontent.com/media/research.google.com/en//archive/bigtable-osdi06.pdf', 'rows kept in sorted key order and split into tablets spread over servers; a write goes to a commit log, then a sorted in-memory memtable; a full memtable becomes an immutable SSTable; compactions merge SSTables; Bloom filters cut disk reads'),
  spanner: v('Corbett et al., “Spanner: Google’s Globally-Distributed Database”, OSDI 2012', 'Sec. 1 Introduction; Sec. 2 Implementation (Paxos groups); Sec. 3 TrueTime; Sec. 4.1.2 Commit Wait', 'https://static.googleusercontent.com/media/research.google.com/en//archive/spanner-osdi2012.pdf', 'TrueTime exposes clock uncertainty (GPS and atomic-clock references) and Spanner waits out that uncertainty (commit wait) to give externally consistent timestamps; each tablet is replicated by a Paxos group'),
  gfs: v('Ghemawat, Gobioff & Leung, “The Google File System”, SOSP 2003', 'Sec. 2.3 Architecture; Sec. 2.5 Chunk Size; Sec. 3.2 Data Flow', 'https://static.googleusercontent.com/media/research.google.com/en//archive/gfs-sosp2003.pdf', 'files are split into chunks; one master holds only metadata (file-to-chunk mapping) while data-bearing traffic goes directly to chunkservers. GFS chunks are 64 MB and not content-addressed, so it does not back the case lesson’s ~4 MB content-hash chunks or its chunks-before-commit ordering'),
  karger: s('Karger et al., “Consistent Hashing and Random Trees”, STOC 1997'),
  lamport: s('Lamport, “Time, Clocks, and the Ordering of Events in a Distributed System”, CACM 1978'),
  gilbertLynch: s('Gilbert & Lynch, “Brewer’s Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services”, 2002'),
  sagas: s('Garcia-Molina & Salem, “Sagas”, SIGMOD 1987'),
  lsm: s('O’Neil et al., “The Log-Structured Merge-Tree (LSM-Tree)”, Acta Informatica 1996'),
  critique: s('Berenson et al., “A Critique of ANSI SQL Isolation Levels”, SIGMOD 1995'),

  pgIso: v('PostgreSQL documentation', 'Sec. 13.2, Transaction Isolation', 'https://www.postgresql.org/docs/current/transaction-iso.html', 'Read Committed is the default; PostgreSQL’s Repeatable Read also prevents phantom reads'),
  pgExplain: v('PostgreSQL documentation', 'Sec. 14.1, Using EXPLAIN', 'https://www.postgresql.org/docs/current/using-explain.html', 'EXPLAIN shows the planner’s plan as a tree of nodes (Seq Scan, Index Scan, Bitmap scans) with Filter and Index Cond lines; output shows cost and estimated rows, not “rows examined”'),
  pgIndexes: v('PostgreSQL documentation', 'Sec. 11.1, Introduction; Sec. 11.2.1, B-Tree; Sec. 11.3, Multicolumn Indexes', 'https://www.postgresql.org/docs/current/indexes.html', 'an index avoids scanning the whole table by walking a search tree, and adds overhead to data changes; a multicolumn B-tree is most efficient with constraints on its leading columns but can be used for any subset (PostgreSQL 18 adds skip scan)'),
  pgWal: v('PostgreSQL documentation', 'Sec. 28.3, Write-Ahead Logging (WAL)', 'https://www.postgresql.org/docs/current/wal-intro.html', 'changes are logged and flushed to permanent storage before data files are written; after a crash the log is replayed (REDO); the WAL is written sequentially so syncing it is cheaper than flushing data pages'),
  pgMvcc: v('PostgreSQL documentation', 'Sec. 13.1, Concurrency Control: Introduction', 'https://www.postgresql.org/docs/current/mvcc-intro.html', 'under MVCC, reading never blocks writing and writing never blocks reading'),
  pgLocking: v('PostgreSQL documentation', 'Sec. 13.3.2, Row-Level Locks; Sec. 13.3.4, Deadlocks', 'https://www.postgresql.org/docs/current/explicit-locking.html', 'SELECT FOR UPDATE blocks other writers and lockers of the row until the transaction ends; deadlocks are detected and one transaction aborted; locking in a consistent order avoids them; long-open transactions are discouraged'),
  pyThreading: v('Python documentation', 'threading — Lock objects; Using locks, conditions, and semaphores in the with statement', 'https://docs.python.org/3/library/threading.html', 'a Lock lets one thread hold it at a time; acquire(timeout=…) gives up after the timeout; `with lock:` acquires on entry and always releases on exit'),
  pyDataclasses: v('Python documentation', 'dataclasses — frozen instances; Post-init processing; default field values', 'https://docs.python.org/3/library/dataclasses.html', 'frozen=True makes assignment to fields raise FrozenInstanceError (it emulates immutability; Python has no truly immutable objects); the generated __init__ calls __post_init__'),
  pyProtocol: v('Python documentation', 'typing.Protocol (structural subtyping, PEP 544); glossary: duck-typing', 'https://docs.python.org/3/library/typing.html#typing.Protocol', 'a Protocol class is used by static type checkers for structural subtyping (static duck-typing): a class matches without inheriting from it'),
  pyDict: v('Python documentation', 'Mapping types — dict; glossary: hashable, dictionary', 'https://docs.python.org/3/library/stdtypes.html#mapping-types-dict', 'dict keys must be hashable (a hash value that never changes during its lifetime; mutable containers are not) because dicts use the hash value internally. The near-constant lookup time is not stated on this page (it links to the TimeComplexity wiki, not reachable)'),
  pyOrderedDict: v('Python documentation', 'collections.OrderedDict: move_to_end(), popitem()', 'https://docs.python.org/3/library/collections.html#collections.OrderedDict', 'move_to_end() moves a key to the end; popitem(last=False) removes in FIFO order'),
  pyMock: v('Python documentation', 'unittest.mock — introduction', 'https://docs.python.org/3/library/unittest.mock.html', 'Mock objects replace parts of the system under test, let you assert which methods were called and with what arguments, and can be given return values. The lessons use hand-written fakes and stubs and do not import unittest.mock'),
  pytest: s('pytest documentation', 'Get started; fixtures; monkeypatch', 'https://docs.pytest.org/en/stable/'),
  pyAbc: v('Python documentation', 'abc — abstractmethod', 'https://docs.python.org/3/library/abc.html', 'a class with an ABCMeta metaclass cannot be instantiated unless all its abstract methods are overridden'),
  pyEnum: v('Python documentation', 'enum — Support for enumerations', 'https://docs.python.org/3/library/enum.html', 'an enumeration is a set of symbolic names (members) bound to unique values'),
} as const;

export type SourceKey = keyof typeof SRC;
