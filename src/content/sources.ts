/**
 * Source library. Each entry points to a book chapter, paper, RFC, or official document
 * that treats a topic in depth.
 *
 * `checked: false` means the pointer comes from the work's published table of contents or
 * well-known structure, but the specific claims in our lessons have NOT been re-verified
 * against the source text in a session with access to it. (In the authoring environment,
 * primary-source domains were blocked by the network policy.) Never flip this to true
 * without actually reading the cited section.
 */
import type { Source } from './types';

const s = (title: string, where?: string, url?: string): Source & { checked: boolean } => ({ title, where, url, checked: false });

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
  ostepProc: s('Operating Systems: Three Easy Pieces', 'The Abstraction: The Process', 'https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-intro.pdf'),
  ostepThreads: s('Operating Systems: Three Easy Pieces', 'Concurrency: An Introduction', 'https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf'),
  ostepLocks: s('Operating Systems: Three Easy Pieces', 'Locks', 'https://pages.cs.wisc.edu/~remzi/OSTEP/threads-locks.pdf'),
  ostepBugs: s('Operating Systems: Three Easy Pieces', 'Common Concurrency Problems (deadlock)', 'https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf'),
  ostepPersist: s('Operating Systems: Three Easy Pieces', 'Persistence: Hard Disk Drives, Flash-based SSDs', 'https://pages.cs.wisc.edu/~remzi/OSTEP/'),

  rfc9110: s('RFC 9110: HTTP Semantics', 'Sec. 9 (methods; 9.2.2 idempotent methods), Sec. 15 (status codes)', 'https://www.rfc-editor.org/rfc/rfc9110'),
  rfc9113: s('RFC 9113: HTTP/2', undefined, 'https://www.rfc-editor.org/rfc/rfc9113'),
  rfc9114: s('RFC 9114: HTTP/3', undefined, 'https://www.rfc-editor.org/rfc/rfc9114'),
  rfc9293: s('RFC 9293: Transmission Control Protocol (TCP)', undefined, 'https://www.rfc-editor.org/rfc/rfc9293'),
  rfc768: s('RFC 768: User Datagram Protocol', undefined, 'https://www.rfc-editor.org/rfc/rfc768'),
  rfc8446: s('RFC 8446: TLS 1.3', undefined, 'https://www.rfc-editor.org/rfc/rfc8446'),
  rfc1034: s('RFC 1034: Domain Names — Concepts and Facilities', undefined, 'https://www.rfc-editor.org/rfc/rfc1034'),
  rfc791: s('RFC 791: Internet Protocol', undefined, 'https://www.rfc-editor.org/rfc/rfc791'),
  rfc6455: s('RFC 6455: The WebSocket Protocol', undefined, 'https://www.rfc-editor.org/rfc/rfc6455'),
  sse: s('HTML Living Standard: Server-sent events', undefined, 'https://html.spec.whatwg.org/multipage/server-sent-events.html'),
  rfc6749: s('RFC 6749: The OAuth 2.0 Authorization Framework', undefined, 'https://www.rfc-editor.org/rfc/rfc6749'),
  rfc7519: s('RFC 7519: JSON Web Token (JWT)', undefined, 'https://www.rfc-editor.org/rfc/rfc7519'),
  oidc: s('OpenID Connect Core 1.0', undefined, 'https://openid.net/specs/openid-connect-core-1_0.html'),
  rfc6585: s('RFC 6585: Additional HTTP Status Codes', 'Sec. 4, 429 Too Many Requests', 'https://www.rfc-editor.org/rfc/rfc6585'),
  rfc8259: s('RFC 8259: The JSON Data Interchange Format', undefined, 'https://www.rfc-editor.org/rfc/rfc8259'),

  fsa: s('Fundamentals of Software Architecture (Richards & Ford)', 'Architecture characteristics; modular monolith and microservices styles'),
  sap: s('Software Architecture in Practice (Bass, Clements & Kazman)', 'Quality attributes: availability, performance, modifiability'),
  releaseIt: s('Release It! (Nygard)', 'Stability antipatterns and stability patterns: timeouts, circuit breaker, bulkheads'),
  sreSlo: s('Site Reliability Engineering (Google)', 'Service Level Objectives', 'https://sre.google/sre-book/service-level-objectives/'),
  sreRisk: s('Site Reliability Engineering (Google)', 'Embracing Risk (error budgets)', 'https://sre.google/sre-book/embracing-risk/'),
  sreMonitoring: s('Site Reliability Engineering (Google)', 'Monitoring Distributed Systems', 'https://sre.google/sre-book/monitoring-distributed-systems/'),
  sreOverload: s('Site Reliability Engineering (Google)', 'Handling Overload', 'https://sre.google/sre-book/handling-overload/'),
  sreCascading: s('Site Reliability Engineering (Google)', 'Addressing Cascading Failures', 'https://sre.google/sre-book/addressing-cascading-failures/'),
  sreLbFront: s('Site Reliability Engineering (Google)', 'Load Balancing at the Frontend', 'https://sre.google/sre-book/load-balancing-frontend/'),
  sreLbDc: s('Site Reliability Engineering (Google)', 'Load Balancing in the Datacenter', 'https://sre.google/sre-book/load-balancing-datacenter/'),
  sreWorkbookSlo: s('The Site Reliability Workbook (Google)', 'Implementing SLOs', 'https://sre.google/workbook/implementing-slos/'),
  ablRetries: s('Amazon Builders’ Library', 'Timeouts, retries, and backoff with jitter', 'https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/'),
  ablIdempotent: s('Amazon Builders’ Library', 'Making retries safe with idempotent APIs', 'https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/'),
  ablBacklog: s('Amazon Builders’ Library', 'Avoiding insurmountable queue backlogs', 'https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/'),
  ablShedding: s('Amazon Builders’ Library', 'Using load shedding to avoid overload', 'https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/'),
  ablCaching: s('Amazon Builders’ Library', 'Caching challenges and strategies', 'https://aws.amazon.com/builders-library/caching-challenges-and-strategies/'),
  ablLeader: s('Amazon Builders’ Library', 'Leader election in distributed systems', 'https://aws.amazon.com/builders-library/leader-election-in-distributed-systems/'),
  ablShuffle: s('Amazon Builders’ Library', 'Workload isolation using shuffle-sharding', 'https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/'),

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

  dynamo: s('DeCandia et al., “Dynamo: Amazon’s Highly Available Key-value Store”, SOSP 2007'),
  raft: s('Ongaro & Ousterhout, “In Search of an Understandable Consensus Algorithm”, USENIX ATC 2014', undefined, 'https://raft.github.io/'),
  mapreduce: s('Dean & Ghemawat, “MapReduce: Simplified Data Processing on Large Clusters”, OSDI 2004'),
  bigtable: s('Chang et al., “Bigtable: A Distributed Storage System for Structured Data”, OSDI 2006'),
  spanner: s('Corbett et al., “Spanner: Google’s Globally-Distributed Database”, OSDI 2012'),
  gfs: s('Ghemawat, Gobioff & Leung, “The Google File System”, SOSP 2003'),
  karger: s('Karger et al., “Consistent Hashing and Random Trees”, STOC 1997'),
  lamport: s('Lamport, “Time, Clocks, and the Ordering of Events in a Distributed System”, CACM 1978'),
  gilbertLynch: s('Gilbert & Lynch, “Brewer’s Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services”, 2002'),
  sagas: s('Garcia-Molina & Salem, “Sagas”, SIGMOD 1987'),
  lsm: s('O’Neil et al., “The Log-Structured Merge-Tree (LSM-Tree)”, Acta Informatica 1996'),
  critique: s('Berenson et al., “A Critique of ANSI SQL Isolation Levels”, SIGMOD 1995'),

  pgIso: s('PostgreSQL documentation', 'Transaction Isolation', 'https://www.postgresql.org/docs/current/transaction-iso.html'),
  pgExplain: s('PostgreSQL documentation', 'Using EXPLAIN', 'https://www.postgresql.org/docs/current/using-explain.html'),
  pgIndexes: s('PostgreSQL documentation', 'Indexes', 'https://www.postgresql.org/docs/current/indexes.html'),
  pgWal: s('PostgreSQL documentation', 'Write-Ahead Logging (WAL)', 'https://www.postgresql.org/docs/current/wal-intro.html'),
  pgMvcc: s('PostgreSQL documentation', 'Concurrency Control: Introduction', 'https://www.postgresql.org/docs/current/mvcc-intro.html'),
  pgLocking: s('PostgreSQL documentation', 'Explicit Locking', 'https://www.postgresql.org/docs/current/explicit-locking.html'),
  pyThreading: s('Python documentation', 'threading — Thread-based parallelism (Lock, Condition)', 'https://docs.python.org/3/library/threading.html'),
  pyDataclasses: s('Python documentation', 'dataclasses — Data Classes (frozen instances, field validation in __post_init__)', 'https://docs.python.org/3/library/dataclasses.html'),
  pyProtocol: s('Python documentation', 'typing.Protocol and structural subtyping (PEP 544)', 'https://docs.python.org/3/library/typing.html#typing.Protocol'),
  pyDict: s('Python documentation', 'Mapping types — dict', 'https://docs.python.org/3/library/stdtypes.html#mapping-types-dict'),
  pyOrderedDict: s('Python documentation', 'collections.OrderedDict (move_to_end, popitem)', 'https://docs.python.org/3/library/collections.html#collections.OrderedDict'),
  pyMock: s('Python documentation', 'unittest.mock — mock object library', 'https://docs.python.org/3/library/unittest.mock.html'),
  pytest: s('pytest documentation', 'Get started; fixtures; monkeypatch', 'https://docs.pytest.org/en/stable/'),
  pyAbc: s('Python documentation', 'abc — Abstract Base Classes', 'https://docs.python.org/3/library/abc.html'),
  pyEnum: s('Python documentation', 'enum — Support for enumerations', 'https://docs.python.org/3/library/enum.html'),
} as const;

export type SourceKey = keyof typeof SRC;
