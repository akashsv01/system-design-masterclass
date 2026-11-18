/**
 * Scope terms from MASTER_PROMPT §7–8. The coverage audit fails if a term is not named in some
 * topic's title, short label or `covers` list. Add terms when source comparison reveals gaps.
 */
export const SCOPE: Record<string, string[]> = {
  foundations: [
    'processes', 'threads', 'concurrency', 'parallelism', 'memory', 'disk', 'networks', 'DNS', 'IP', 'TCP', 'UDP', 'TLS', 'HTTP',
    'REST', 'RPC', 'polling', 'SSE', 'WebSockets', 'latency', 'percentiles', 'throughput', 'bandwidth', 'availability',
    'bottlenecks', 'capacity estimation', 'peak load', 'stateful/stateless', 'vertical scaling', 'horizontal scaling',
  ],
  data: [
    'access patterns', 'schemas', 'relationships', 'normalization', 'denormalization', 'SQL', 'query plans', 'indexes',
    'relational', 'document', 'key-value', 'wide-column', 'graph', 'search', 'time-series', 'object storage', 'B-trees',
    'LSM trees', 'write-ahead logs', 'compaction', 'transactions', 'isolation anomalies', 'locking', 'MVCC', 'replication',
    'failover', 'sharding', 'partition keys', 'hot spots', 'consistent hashing', 'rebalancing',
  ],
  distributed: [
    'requirements', 'constraints', 'API contracts', 'pagination', 'versioning', 'proxies', 'gateways', 'service discovery',
    'load balancing', 'CDNs', 'cache placement', 'eviction', 'invalidation', 'stampedes', 'timeouts', 'partial failure',
    'retries', 'backoff', 'jitter', 'idempotency', 'deduplication', 'ordering', 'clocks', 'consistency models',
    'CAP during partitions', 'quorum', 'leader election', 'consensus', 'Raft', 'coordination', 'queues', 'pub/sub', 'logs',
    'consumer groups', 'delivery guarantees', 'backpressure', 'batch processing', 'stream processing', 'event time',
    'watermarks', 'distributed transactions', 'sagas', 'outbox', 'CQRS', 'event sourcing',
  ],
  architecture: [
    'modular monoliths', 'microservices', 'service boundaries', 'synchronous and asynchronous communication',
    'schema evolution', 'multitenancy', 'multi-region', 'authentication', 'authorization', 'sessions', 'OAuth/OIDC',
    'encryption', 'privacy', 'rate limiting', 'observability', 'metrics', 'traces', 'SLIs', 'SLOs', 'error budgets',
    'deployments', 'rollback', 'backups', 'restore testing', 'disaster recovery', 'RPO/RTO', 'cost reasoning',
  ],
  lld: [
    'responsibilities', 'interfaces', 'abstraction', 'encapsulation', 'polymorphism', 'inheritance', 'composition',
    'cohesion', 'coupling', 'SOLID', 'contracts', 'invariants', 'immutability', 'validation', 'error handling', 'entities',
    'value objects', 'repositories', 'dependency injection', 'UML', 'state machines', 'resource lifecycle', 'refactoring',
    'tests', 'test doubles', 'synchronization', 'races', 'deadlocks', 'Gang of Four patterns',
  ],
  bridges: ['SQL', 'JSON', 'threads', 'maps', 'linked lists', 'interfaces'],
  'hld cases': [
    'URL shortener', 'rate limiter', 'notification', 'chat', 'social feed', 'autocomplete', 'file storage and sync',
    'video streaming', 'ticket booking', 'payment', 'inventory and checkout', 'ride matching', 'metrics ingestion',
    'job scheduler', 'web crawler', 'collaborative editor', 'live scores',
  ],
  'lld cases': [
    'parking lot', 'elevator', 'vending machine', 'library', 'expense sharing', 'logger', 'notification service', 'LRU cache',
    'rate limiter (LLD)', 'task scheduler', 'seat booking', 'shopping cart', 'board game', 'live score event processor',
  ],
  labs: [
    'request tracing', 'overload and load balancing', 'cache behaviour', 'stale reads', 'partitioning and hot spots',
    'queue backlog', 'payment retries', 'LRU operations', 'concurrent reservations',
  ],
};
