/**
 * Deterministic simulations for the labs. Every function is pure: same inputs, same outputs,
 * so a lab can be replayed exactly. Randomness comes from a seeded generator.
 */

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil((p / 100) * s.length) - 1)];
}

/* ---------------- Load balancing under overload ---------------- */

export type LbPolicy = 'round-robin' | 'least-connections';

export interface LbResult {
  p50: number;
  p99: number;
  perServer: { served: number; p99: number }[];
  dropped: number;
}

/**
 * Discrete-time simulation (1 ms ticks) of servers that each process one request at a time
 * with a fixed service time; requests arrive at a steady rate with seeded jitter.
 */
export function simulateLb(opts: { arrivalsPerSec: number; serviceMs: number[]; policy: LbPolicy; seconds?: number; seed?: number; maxQueue?: number }): LbResult {
  const { arrivalsPerSec, serviceMs, policy } = opts;
  const seconds = opts.seconds ?? 10;
  const maxQueue = opts.maxQueue ?? 200;
  const r = rng(opts.seed ?? 7);
  const n = serviceMs.length;
  const queues: number[][] = Array.from({ length: n }, () => []); // arrival times
  const busyUntil = new Array(n).fill(0);
  const current: (number | null)[] = new Array(n).fill(null);
  const latencies: number[][] = Array.from({ length: n }, () => []);
  let dropped = 0;
  let rr = 0;
  let nextArrival = 0;
  const gap = 1000 / arrivalsPerSec;
  for (let t = 0; t < seconds * 1000; t++) {
    while (nextArrival <= t) {
      let target = 0;
      if (policy === 'round-robin') {
        target = rr++ % n;
      } else {
        let best = Infinity;
        for (let i = 0; i < n; i++) {
          const load = queues[i].length + (current[i] !== null ? 1 : 0);
          if (load < best) {
            best = load;
            target = i;
          }
        }
      }
      if (queues[target].length >= maxQueue) dropped++;
      else queues[target].push(nextArrival);
      nextArrival += gap * (0.5 + r());
    }
    for (let i = 0; i < n; i++) {
      if (current[i] !== null && busyUntil[i] <= t) {
        latencies[i].push(t - (current[i] as number));
        current[i] = null;
      }
      if (current[i] === null && queues[i].length) {
        current[i] = queues[i].shift()!;
        busyUntil[i] = t + serviceMs[i];
      }
    }
  }
  const all = latencies.flat();
  return {
    p50: percentile(all, 50),
    p99: percentile(all, 99),
    perServer: latencies.map((l) => ({ served: l.length, p99: percentile(l, 99) })),
    dropped,
  };
}

/* ---------------- Cache hit rate with skewed access ---------------- */

/** Zipf-like popularity: item k (1-based) is requested with weight 1/k^s. */
export function zipfWeights(items: number, s: number): number[] {
  const w = Array.from({ length: items }, (_, i) => 1 / Math.pow(i + 1, s));
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
}

/** Simulate an LRU cache of `size` over `requests` draws from the popularity distribution. */
export function simulateCacheHitRate(opts: { items: number; size: number; skew: number; requests?: number; seed?: number }): number {
  const { items, size, skew } = opts;
  const requests = opts.requests ?? 20000;
  const w = zipfWeights(items, skew);
  const cdf: number[] = [];
  w.reduce((acc, x, i) => (cdf[i] = acc + x), 0);
  const r = rng(opts.seed ?? 3);
  const cache = new Map<number, true>();
  let hits = 0;
  for (let i = 0; i < requests; i++) {
    const u = r();
    let lo = 0;
    let hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    const key = lo;
    if (cache.has(key)) {
      hits++;
      cache.delete(key);
      cache.set(key, true);
    } else {
      cache.set(key, true);
      if (cache.size > size) cache.delete(cache.keys().next().value as number);
    }
  }
  return hits / requests;
}

/** Requests that reach the database in the window after a hot key expires. */
export function stampede(readsPerSec: number, reloadMs: number, coalesce: boolean): number {
  return coalesce ? 1 : Math.max(1, Math.round((readsPerSec * reloadMs) / 1000));
}

/* ---------------- Partitioning and hot spots ---------------- */

export function shardLoads(opts: { shards: number; hotShare: number; key: 'event' | 'seat' | 'event+bucket'; buckets?: number }): number[] {
  const { shards, hotShare, key } = opts;
  const rest = (1 - hotShare) / shards;
  const loads = new Array(shards).fill(rest);
  if (key === 'event') loads[0] += hotShare;
  else if (key === 'seat') for (let i = 0; i < shards; i++) loads[i] += hotShare / shards;
  else {
    const b = Math.min(opts.buckets ?? 4, shards);
    for (let i = 0; i < b; i++) loads[i] += hotShare / b;
  }
  return loads.map((x) => Math.round(x * 1000) / 10);
}

/* ---------------- Queue backlog ---------------- */

export function backlogSeries(opts: { arrive: number; process: number; burstSeconds: number; afterArrive: number; seconds: number }): { backlog: number[]; maxAgeSeconds: number } {
  const out: number[] = [];
  let b = 0;
  let maxAge = 0;
  for (let s = 0; s < opts.seconds; s++) {
    const a = s < opts.burstSeconds ? opts.arrive : opts.afterArrive;
    b = Math.max(0, b + a - opts.process);
    out.push(b);
    maxAge = Math.max(maxAge, b / opts.process);
  }
  return { backlog: out, maxAgeSeconds: Math.round(maxAge) };
}

/* ---------------- Payment retries ---------------- */

export interface RetryResult {
  attemptsPerSecond: number[];
  duplicateCharges: number;
  succeeded: number;
}

/**
 * Clients each make one payment at t=0. The provider is overloaded for `outageSeconds`: during it,
 * a fraction of calls *succeed but their reply is lost* (lostReplyRate) and the rest fail.
 * Clients retry up to `retries` times with the chosen backoff. Without an idempotency key, a retry
 * after a lost reply charges again.
 */
export function simulateRetries(opts: { clients: number; retries: number; backoff: 'none' | 'exponential' | 'exponential+jitter'; idempotencyKey: boolean; outageSeconds: number; lostReplyRate: number; seconds?: number; seed?: number }): RetryResult {
  const seconds = opts.seconds ?? 20;
  const r = rng(opts.seed ?? 11);
  const attempts = new Array(seconds).fill(0);
  let duplicates = 0;
  let succeeded = 0;
  for (let c = 0; c < opts.clients; c++) {
    let t = 0;
    let charged = false;
    for (let a = 0; a <= opts.retries; a++) {
      const second = Math.floor(t);
      if (second >= seconds) break;
      attempts[second]++;
      const inOutage = t < opts.outageSeconds;
      if (!inOutage) {
        if (charged && !opts.idempotencyKey) duplicates++;
        charged = true;
        succeeded++;
        break;
      }
      if (r() < opts.lostReplyRate) {
        // Charged, but the client never hears back.
        if (charged && !opts.idempotencyKey) duplicates++;
        charged = true;
      }
      const base = opts.backoff === 'none' ? 0.2 : Math.min(8, 0.5 * 2 ** a);
      t += opts.backoff === 'exponential+jitter' ? r() * base + 0.05 : base;
    }
  }
  return { attemptsPerSecond: attempts, duplicateCharges: duplicates, succeeded };
}

/* ---------------- Concurrent reservations ---------------- */

export type ReserveStrategy = 'check-then-write' | 'conditional-write';
type Step = { buyer: string; kind: 'read' | 'write' };

/** All interleavings of two buyers' steps (each buyer's own steps stay in order). */
export function interleavings(a: Step[], b: Step[]): Step[][] {
  if (!a.length) return [b];
  if (!b.length) return [a];
  return [...interleavings(a.slice(1), b).map((x) => [a[0], ...x]), ...interleavings(a, b.slice(1)).map((x) => [b[0], ...x])];
}

export function runInterleaving(order: Step[], strategy: ReserveStrategy): { confirmed: string[]; owner: string | null } {
  let owner: string | null = null;
  const sawFree: Record<string, boolean> = {};
  const confirmed: string[] = [];
  for (const s of order) {
    if (strategy === 'check-then-write') {
      if (s.kind === 'read') sawFree[s.buyer] = owner === null;
      else if (sawFree[s.buyer]) {
        owner = s.buyer;
        confirmed.push(s.buyer);
      }
    } else if (s.kind === 'write') {
      // UPDATE seats SET owner = buyer WHERE id = 'F12' AND owner IS NULL  → rows changed?
      if (owner === null) {
        owner = s.buyer;
        confirmed.push(s.buyer);
      }
    }
  }
  return { confirmed, owner };
}

export function reservationOutcomes(strategy: ReserveStrategy) {
  const steps = (buyer: string): Step[] => (strategy === 'check-then-write' ? [{ buyer, kind: 'read' }, { buyer, kind: 'write' }] : [{ buyer, kind: 'write' }]);
  const all = interleavings(steps('Maya'), steps('Leo'));
  const results = all.map((o) => ({ order: o, ...runInterleaving(o, strategy) }));
  return { total: results.length, doubleBooked: results.filter((x) => x.confirmed.length > 1).length, results };
}
