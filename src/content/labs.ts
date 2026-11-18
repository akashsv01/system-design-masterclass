/**
 * Interactive labs (UI in src/ui/labs, simulations in src/sim/labs.ts, tests in tests/labs.test.ts).
 * Each lists its prediction, control, observable consequence and fresh problem for the coverage audit.
 */
export interface LabMeta {
  id: string;
  prediction: string;
  control: string;
  consequence: string;
  freshProblem: string;
}

const all: LabMeta[] = [
  { id: 'lab-request-tracing', prediction: 'Which fix saves the most time?', control: 'Toggle caching and parallel calls', consequence: 'Trace and total latency', freshProblem: 'Total of a new trace with parallel spans' },
  { id: 'lab-load-balancing', prediction: 'What happens to a slow server under round robin?', control: 'Arrival rate, slow server time, policy', consequence: 'Per-server p99, dropped requests', freshProblem: 'Total overload with equal servers' },
  { id: 'lab-cache', prediction: 'Hit rate of a 2.5% cache under skew', control: 'Cache size, skew, coalescing', consequence: 'Hit-rate curve, stampede size', freshProblem: 'Doubling cache under uniform access' },
  { id: 'lab-stale-reads', prediction: 'Share of stale reloads at 1.5 s lag', control: 'Lag and routing strategy', consequence: 'Stale-read curves per strategy', freshProblem: 'Leader window shorter than lag' },
  { id: 'lab-hot-spots', prediction: 'Does doubling shards fix a hot event?', control: 'Shards, hot share, partition key', consequence: 'Load per shard', freshProblem: 'Bucketed hot key load' },
  { id: 'lab-queue-backlog', prediction: 'Peak backlog during a rush', control: 'Worker rate, rush length', consequence: 'Backlog curve, oldest wait', freshProblem: 'Minimum worker rate for a 5-minute promise' },
  { id: 'lab-payment-retries', prediction: 'Duplicate charges without keys?', control: 'Retries, backoff, idempotency key', consequence: 'Attempts per second, duplicate charges', freshProblem: 'Keys with immediate retries' },
  { id: 'lab-lru', prediction: 'Final recency order of a sequence', control: 'Step through operations; new puzzles', consequence: 'Order after each operation', freshProblem: 'A newly generated sequence' },
  { id: 'concurrent-reservations', prediction: 'How many interleavings double-book?', control: 'Strategy: read-then-write vs conditional write', consequence: 'Outcome of every interleaving', freshProblem: 'Three buyers' },
];

export const LABS: Record<string, LabMeta> = Object.fromEntries(all.map((l) => [l.id, l]));
