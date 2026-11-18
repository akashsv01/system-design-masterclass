import { describe, it, expect } from 'vitest';
import { runReservation, confirmations, transition, type SeatState } from '../src/sim/booking';
import { stateAt, readProfile, staleFraction, WRITE_AT, fmtClock, T0 } from '../src/sim/replication';
import { runLru, LruCache, LRU_PY_LINES, linesFor } from '../src/sim/lru';
import { readFileSync } from 'node:fs';

describe('booking race', () => {
  const race = [
    { name: 'Maya', pressAt: 0 },
    { name: 'Leo', pressAt: 5 },
  ];
  it('check-then-write confirms both buyers when their reads interleave', () => {
    const ev = runReservation(race, 'check-then-write');
    expect(confirmations(ev)).toEqual(['Maya', 'Leo']);
    // Last write wins in storage even though Maya was told she has the seat.
    expect(ev[ev.length - 1].seat).toEqual({ status: 'booked', by: 'Leo' });
  });
  it('conditional write confirms exactly one buyer', () => {
    const ev = runReservation(race, 'conditional-write');
    expect(confirmations(ev)).toEqual(['Maya']);
    expect(ev.some((e) => e.kind === 'write-skipped' && e.actor === 'Leo')).toBe(true);
  });
  it('is deterministic', () => {
    expect(runReservation(race, 'check-then-write')).toEqual(runReservation(race, 'check-then-write'));
  });
  it('a buyer arriving after the write is told sold out even with check-then-write', () => {
    const ev = runReservation([{ name: 'Maya', pressAt: 0 }, { name: 'Leo', pressAt: 200 }], 'check-then-write');
    expect(confirmations(ev)).toEqual(['Maya']);
  });
});

describe('seat state machine', () => {
  const avail: SeatState = { status: 'available' };
  it('allows only one hold', () => {
    const a = transition(avail, { type: 'hold', buyer: 'Maya', now: 0, holdMs: 600_000 });
    expect(a.ok).toBe(true);
    const b = transition(a.next, { type: 'hold', buyer: 'Leo', now: 1, holdMs: 600_000 });
    expect(b.ok).toBe(false);
  });
  it('rejects late payment after the hold expired', () => {
    const h = transition(avail, { type: 'hold', buyer: 'Maya', now: 0, holdMs: 1000 }).next;
    const p = transition(h, { type: 'pay', buyer: 'Maya', now: 1500 });
    expect(p).toMatchObject({ ok: false, next: { status: 'available' } });
  });
  it('lets a new buyer hold once the old hold expired', () => {
    const h = transition(avail, { type: 'hold', buyer: 'Maya', now: 0, holdMs: 1000 }).next;
    expect(transition(h, { type: 'hold', buyer: 'Leo', now: 1001, holdMs: 1000 }).ok).toBe(true);
  });
});

describe('replication lag', () => {
  const cfg = { lagMs: 1500, strategy: 'follower' as const, stickyMs: 5000 };
  it('formats the lesson clock', () => {
    expect(fmtClock(T0 + 1000)).toBe('10:00:01');
  });
  it('the follower still says Sam at 10:00:01 and Alex at 10:00:02', () => {
    expect(stateAt(cfg, T0 + 1000)).toMatchObject({ leader: 'Alex', follower: 'Sam', copyInFlight: true });
    expect(stateAt(cfg, T0 + 2000)).toMatchObject({ leader: 'Alex', follower: 'Alex', copyInFlight: false });
  });
  it('reading your own write from the leader avoids the stale read', () => {
    expect(readProfile(cfg, T0 + 1000)).toEqual({ from: 'follower', value: 'Sam', stale: true });
    expect(readProfile({ ...cfg, strategy: 'leader-after-own-write' }, T0 + 1000)).toEqual({ from: 'leader', value: 'Alex', stale: false });
  });
  it('synchronous replication delays "Saved" by the lag and never shows stale data afterwards', () => {
    const s = stateAt({ ...cfg, strategy: 'synchronous' }, T0 + 1000);
    expect(s.savedAt).toBe(WRITE_AT + 1500);
    expect(staleFraction({ ...cfg, strategy: 'synchronous' })).toBe(0);
  });
  it('stale fraction grows with lag', () => {
    expect(staleFraction({ ...cfg, lagMs: 500 })).toBeLessThan(staleFraction({ ...cfg, lagMs: 2500 }));
  });
});

describe('LRU cache', () => {
  it('a read protects an item from eviction', () => {
    const steps = runLru(3, [
      { type: 'put', key: 'A', value: '1' },
      { type: 'put', key: 'B', value: '2' },
      { type: 'put', key: 'C', value: '3' },
      { type: 'get', key: 'A' },
      { type: 'put', key: 'D', value: '4' },
    ]);
    expect(steps[3].order).toEqual(['A', 'C', 'B']);
    expect(steps[4].evicted).toBe('B');
    expect(steps[4].order).toEqual(['D', 'A', 'C']);
  });
  it('updating an existing key does not evict', () => {
    const c = new LruCache(2);
    c.put('A', '1');
    c.put('B', '2');
    expect(c.put('A', '9')).toBeUndefined();
    expect(c.order()).toEqual(['A', 'B']);
  });
  it('a miss changes nothing', () => {
    const steps = runLru(2, [{ type: 'put', key: 'A', value: '1' }, { type: 'get', key: 'Z' }]);
    expect(steps[1]).toMatchObject({ hit: false, order: ['A'] });
  });
  it('every traced line id maps to exactly one place in the Python implementation', () => {
    const py = readFileSync('python/sdm/lru_cache.py', 'utf8');
    for (const [id, snip] of Object.entries(LRU_PY_LINES)) {
      expect(py.split(snip).length - 1, id).toBe(1);
      expect(linesFor(py, id).length, id).toBe(1);
    }
    const ids = new Set(Object.keys(LRU_PY_LINES));
    const steps = runLru(1, [{ type: 'put', key: 'A', value: '1' }, { type: 'get', key: 'A' }, { type: 'get', key: 'B' }, { type: 'put', key: 'A', value: '2' }, { type: 'put', key: 'B', value: '3' }]);
    for (const s of steps) for (const l of s.lines) expect(ids.has(l)).toBe(true);
  });
});
