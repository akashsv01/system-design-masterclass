import { describe, it, expect } from 'vitest';
import { simulateLb, simulateCacheHitRate, stampede, shardLoads, backlogSeries, simulateRetries, reservationOutcomes, rng } from '../src/sim/labs';

describe('labs are deterministic', () => {
  it('seeded rng repeats', () => {
    const a = rng(5), b = rng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('load balancer simulation repeats exactly', () => {
    const o = { arrivalsPerSec: 50, serviceMs: [50, 50, 150], policy: 'round-robin' as const };
    expect(simulateLb(o)).toEqual(simulateLb(o));
  });
});

describe('load balancing', () => {
  it('least connections beats round robin when one server is slow', () => {
    const base = { arrivalsPerSec: 45, serviceMs: [50, 50, 150] };
    const rr = simulateLb({ ...base, policy: 'round-robin' });
    const lc = simulateLb({ ...base, policy: 'least-connections' });
    expect(lc.p99).toBeLessThan(rr.p99);
    expect(lc.perServer[2].served).toBeLessThan(rr.perServer[2].served);
  });
  it('overload grows latency or drops requests', () => {
    const ok = simulateLb({ arrivalsPerSec: 30, serviceMs: [50, 50, 50], policy: 'least-connections' });
    const over = simulateLb({ arrivalsPerSec: 80, serviceMs: [50, 50, 50], policy: 'least-connections' });
    expect(over.p99 > ok.p99 * 5 || over.dropped > 0).toBe(true);
  });
});

describe('cache', () => {
  it('bigger cache and more skew raise hit rate', () => {
    const small = simulateCacheHitRate({ items: 1000, size: 10, skew: 1 });
    const big = simulateCacheHitRate({ items: 1000, size: 200, skew: 1 });
    const flat = simulateCacheHitRate({ items: 1000, size: 200, skew: 0.2 });
    expect(big).toBeGreaterThan(small);
    expect(big).toBeGreaterThan(flat);
  });
  it('coalescing turns a stampede into one reload', () => {
    expect(stampede(20000, 8, false)).toBe(160);
    expect(stampede(20000, 8, true)).toBe(1);
  });
});

describe('partitioning', () => {
  it('event key concentrates a hot event; seat key spreads it', () => {
    expect(shardLoads({ shards: 4, hotShare: 0.4, key: 'event' })).toEqual([55, 15, 15, 15]);
    expect(shardLoads({ shards: 4, hotShare: 0.4, key: 'seat' })).toEqual([25, 25, 25, 25]);
  });
});

describe('queues', () => {
  it('backlog grows during a burst and drains after', () => {
    const r = backlogSeries({ arrive: 2000, process: 1500, burstSeconds: 600, afterArrive: 300, seconds: 900 });
    expect(Math.max(...r.backlog)).toBe(300000);
    expect(r.backlog[899]).toBe(0);
  });
});

describe('payment retries', () => {
  it('idempotency keys remove duplicate charges', () => {
    const base = { clients: 1000, retries: 3, backoff: 'exponential+jitter' as const, outageSeconds: 3, lostReplyRate: 0.3 };
    expect(simulateRetries({ ...base, idempotencyKey: false }).duplicateCharges).toBeGreaterThan(0);
    expect(simulateRetries({ ...base, idempotencyKey: true }).duplicateCharges).toBe(0);
  });
  it('immediate retries concentrate load in the first seconds', () => {
    const base = { clients: 1000, retries: 3, idempotencyKey: true, outageSeconds: 3, lostReplyRate: 0 };
    const now = simulateRetries({ ...base, backoff: 'none' });
    const jit = simulateRetries({ ...base, backoff: 'exponential+jitter' });
    expect(now.attemptsPerSecond[0]).toBeGreaterThan(jit.attemptsPerSecond[0]);
  });
});

describe('concurrent reservations', () => {
  it('check-then-write double-books in some interleavings; conditional write never does', () => {
    const naive = reservationOutcomes('check-then-write');
    const fixed = reservationOutcomes('conditional-write');
    expect(naive.total).toBe(6);
    expect(naive.doubleBooked).toBe(4);
    expect(fixed.doubleBooked).toBe(0);
  });
});

import { evictionPuzzle } from '../src/sim/lru';
describe('LRU eviction puzzles', () => {
  it('are deterministic per seed and always evict exactly one key that was cached', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const a = evictionPuzzle(seed);
      expect(evictionPuzzle(seed)).toEqual(a);
      expect(a.start).toHaveLength(3);
      expect(a.start).toContain(a.evicted);
      expect(a.trace[a.trace.length - 1].order).not.toContain(a.evicted);
      expect(a.ops[0].type).toBe('get');
    }
  });
  it('often differ from the naive "last at the start" answer, so recency matters', () => {
    let differs = 0;
    for (let seed = 1; seed <= 200; seed++) if (evictionPuzzle(seed).evicted !== evictionPuzzle(seed).naive) differs++;
    expect(differs).toBeGreaterThan(80);
  });
});
