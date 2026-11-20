/**
 * Deterministic simulations behind the interview activities (brief §5–6). Each states its rule in plain
 * language (RULES) so an outcome can always be explained: the learner sees the rule next to the result.
 */
import { byId, type DesignGraph } from './graph';

export const RULES = {
  trace: 'A request moves along your arrows. A read stops at the first cache that has the data (a hit) and continues past it on a miss. It fails if a part on its synchronous path is offline. Work handed to a queue or event log is accepted there and waits until its consumer is back.',
  timeline: 'Each buyer decides using the value they read. A plain write trusts that read even if it is stale; a conditional write re-checks the value inside the write; a lock makes the second reader wait until the first has written.',
  states: 'An event changes the state only if your diagram has an arrow for that event from the current state. Otherwise the event is refused and the state stays where it was. A timed arrow fires on its own once its time has passed.',
  model: 'A query that filters on the partition key reads one partition. A query on another field needs an index on that field, or it has to ask every partition (a scatter-gather).',
  queue: 'Each second, new requests join the queue and workers finish what they can: workers × (1000 ÷ milliseconds per request). Whatever they cannot finish waits for the next second.',
} as const;

// ── Trace a request through the learner's own design, optionally with one part offline ────────────────

export interface TraceHop { from: string; to: string; label?: string; async: boolean; ok: boolean }
export interface TraceResult {
  hops: TraceHop[];
  outcome: 'ok' | 'hit' | 'error' | 'delayed' | 'broken';
  /** Index into the path where the request stopped (error) or was handed off (delayed). */
  at?: number;
  missing?: [string, string];
  explanation: string;
}

const ASYNC_KINDS = new Set(['queue', 'stream']);

export function traceRequest(g: DesignGraph, fullPath: string[], offline?: string | null, opts: { read?: boolean; miss?: boolean } = {}): TraceResult {
  const name = (id: string) => byId(g, id)?.label ?? 'a missing part';
  // A read is answered by the first cache on its way when the data is there.
  const cacheAt = opts.read && !opts.miss ? fullPath.findIndex((id, i) => i > 0 && i < fullPath.length - 1 && byId(g, id)?.kind === 'cache') : -1;
  const path = cacheAt > 0 ? fullPath.slice(0, cacheAt + 1) : fullPath;
  const hops: TraceHop[] = [];
  let asyncFrom = -1;
  for (let i = 0; i < path.length - 1; i++) {
    const l = g.links.find((x) => x.from === path[i] && x.to === path[i + 1]);
    if (!l) {
      return { hops, outcome: 'broken', missing: [path[i], path[i + 1]], at: i, explanation: `There is no arrow from ${name(path[i])} to ${name(path[i + 1])}, so the request cannot get there in your design.` };
    }
    if (asyncFrom < 0 && ASYNC_KINDS.has(byId(g, path[i])?.kind ?? '')) asyncFrom = i;
    hops.push({ from: path[i], to: path[i + 1], label: l.label, async: asyncFrom >= 0, ok: true });
  }
  const idx = offline ? path.indexOf(offline) : -1;
  if (idx < 0 && cacheAt > 0) return { hops, outcome: 'hit', at: cacheAt, explanation: `${name(path[cacheAt])} already has the data, so it answers after ${cacheAt} ${cacheAt === 1 ? 'hop' : 'hops'} and ${name(fullPath[fullPath.length - 1])} is not asked.` };
  if (idx < 0) return { hops, outcome: 'ok', explanation: offline ? `${name(offline)} is not on this request’s path, so the request is unaffected.` : `The request reaches ${name(path[path.length - 1])} after ${hops.length} ${hops.length === 1 ? 'hop' : 'hops'}.` };
  // Mark hops after the failure as not reached.
  hops.forEach((h, i) => { if (i >= idx) h.ok = false; });
  if (asyncFrom >= 0 && idx > asyncFrom) {
    hops.forEach((h, i) => { if (i < idx) h.ok = true; });
    return { hops, outcome: 'delayed', at: asyncFrom, explanation: `${name(path[asyncFrom])} accepted the work before ${name(offline!)}, so the customer gets a confirmation. The work waits in ${name(path[asyncFrom])} until ${name(offline!)} is back.` };
  }
  return { hops, outcome: 'error', at: idx, explanation: `${name(offline!)} is on the synchronous path, so the customer is still waiting on it and sees an error (or a timeout).` };
}

// ── Two buyers on a timeline (check-then-act races) ────────────────────────────────────────────────

export type Guard = 'plain' | 'conditional' | 'lock';
export interface TLOp { actor: 0 | 1; kind: 'read' | 'write' }
export interface TLStep { actor: 0 | 1; kind: 'read' | 'write'; waited?: boolean; seen?: number; ok?: boolean; before: number; after: number; note: string }
export interface TLResult { steps: TLStep[]; wins: [boolean, boolean]; oversold: boolean; final: number }

/** Valid orders keep each actor's read before its write. */
export const validOrder = (order: TLOp[]) => [0, 1].every((a) => order.findIndex((o) => o.actor === a && o.kind === 'read') < order.findIndex((o) => o.actor === a && o.kind === 'write'));

export function runTimeline(order: TLOp[], guard: Guard, initial = 1, names: [string, string] = ['A', 'B']): TLResult {
  let value = initial;
  const seen: (number | undefined)[] = [undefined, undefined];
  const wins: [boolean, boolean] = [false, false];
  const steps: TLStep[] = [];
  let lockHolder: number | null = null;
  const waiting: TLOp[] = [];
  const queue = [...order];
  const exec = (op: TLOp, waited = false) => {
    const who = names[op.actor];
    if (op.kind === 'read') {
      if (guard === 'lock') lockHolder = op.actor;
      seen[op.actor] = value;
      steps.push({ ...op, waited, seen: value, before: value, after: value, note: `${who} reads: ${value} left${guard === 'lock' ? ' and locks the row' : ''}${waited ? ' (after waiting)' : ''}` });
      return;
    }
    const before = value;
    if (guard === 'conditional') {
      if (value >= 1) { value -= 1; wins[op.actor] = true; steps.push({ ...op, ok: true, before, after: value, note: `${who}’s conditional write: still ${before} left, so it succeeds` }); }
      else steps.push({ ...op, ok: false, before, after: value, note: `${who}’s conditional write: 0 left, so it changes nothing and is refused` });
      return;
    }
    const s = seen[op.actor] ?? value;
    if (s >= 1) { value = s - 1; wins[op.actor] = true; steps.push({ ...op, ok: true, before, after: value, note: `${who} writes ${s - 1}, based on the ${s} it read${before !== s ? ` (the real value was ${before})` : ''}` }); }
    else steps.push({ ...op, ok: false, before, after: value, note: `${who} read 0, so it doesn’t write` });
    if (guard === 'lock' && lockHolder === op.actor) lockHolder = null;
  };
  for (let guardN = 0; (queue.length || waiting.length) && guardN < 50; guardN++) {
    // A waiting reader proceeds as soon as the lock is free.
    if (waiting.length && lockHolder === null) { exec(waiting.shift()!, true); continue; }
    const op = queue.shift();
    if (!op) break;
    if (guard === 'lock' && op.kind === 'read' && lockHolder !== null && lockHolder !== op.actor) {
      steps.push({ ...op, waited: true, before: value, after: value, note: `${names[op.actor]} wants to read but ${names[lockHolder]} holds the lock, so ${names[op.actor]} waits` });
      waiting.push(op);
      continue;
    }
    if (guard === 'lock' && op.kind === 'write' && waiting.some((w) => w.actor === op.actor)) { queue.push(op); continue; }
    exec(op);
  }
  const winsCount = wins.filter(Boolean).length;
  return { steps, wins, oversold: winsCount > initial, final: value };
}

// ── State machines with a clock ──────────────────────────────────────────────────────────────────────

export interface Machine { states: { key: string; label: string }[]; trans: { from: string; to: string; event: string }[] }
export interface ScenarioEvent { at: number; event: string; label: string; expect?: string }
export interface StateStep { at: number; label: string; event: string; from: string; to: string; accepted: boolean; auto?: boolean; expect?: string; matches?: boolean }

/** Reads a state machine from a design graph whose comps are states (key = palette type or lower-cased label). */
export function machineFrom(g: DesignGraph): Machine {
  const key = (id: string) => { const c = byId(g, id); return c ? (c.type !== 'custom' ? c.type : c.label.trim().toLowerCase()) : id; };
  return {
    states: g.comps.filter((c) => c.kind === 'state').map((c) => ({ key: key(c.id), label: c.label })),
    trans: g.links.filter((l) => l.label).map((l) => ({ from: key(l.from), to: key(l.to), event: l.label! })),
  };
}

/** Runs timestamped events; a transition whose event is `timer.event` fires by itself `timer.after` minutes after entering its source state. */
export function runScenario(m: Machine, initial: string, events: ScenarioEvent[], timer?: { event: string; after: number }): StateStep[] {
  let state = initial;
  let entered = 0;
  const out: StateStep[] = [];
  const fireTimer = (until: number) => {
    if (!timer) return;
    for (let guard = 0; guard < 5; guard++) {
      const t = m.trans.find((x) => x.from === state && x.event === timer.event);
      if (!t || entered + timer.after > until) return;
      out.push({ at: entered + timer.after, label: `${timer.after} minutes pass`, event: timer.event, from: state, to: t.to, accepted: true, auto: true });
      entered += timer.after;
      state = t.to;
    }
  };
  for (const ev of events) {
    fireTimer(ev.at);
    const t = m.trans.find((x) => x.from === state && x.event === ev.event);
    const step: StateStep = { at: ev.at, label: ev.label, event: ev.event, from: state, to: t ? t.to : state, accepted: !!t, expect: ev.expect };
    if (t) { state = t.to; entered = ev.at; }
    step.matches = ev.expect ? ev.expect === state : undefined;
    out.push(step);
  }
  return out;
}

// ── Data model: which partitions does a query touch? ─────────────────────────────────────────────────

export interface KeyChoice { partition: string; sort?: string; indexes: string[] }
export interface ModelQuery { id: string; text: string; filter: string; sort?: string }
export interface QueryPlan { plan: 'one-partition' | 'index' | 'scatter'; partitions: number; sorted: boolean; note: string }

export function planQuery(key: KeyChoice, q: ModelQuery, partitions = 16): QueryPlan {
  const sorted = !q.sort || q.sort === key.sort;
  const sortNote = q.sort ? (sorted ? ` Rows come back already sorted by ${q.sort}.` : ` They must then be sorted by ${q.sort} after reading.`) : '';
  if (q.filter === key.partition) return { plan: 'one-partition', partitions: 1, sorted, note: `Filters on the partition key (${key.partition}), so it reads one partition.${sortNote}` };
  if (key.indexes.includes(q.filter)) return { plan: 'index', partitions: 1, sorted: false, note: `Uses the index on ${q.filter}: one extra lookup, and every write now also updates the index.` };
  return { plan: 'scatter', partitions, sorted: false, note: `Nothing is keyed on ${q.filter}, so it asks all ${partitions} partitions and merges the answers.` };
}

// ── Capacity: a queue in front of workers, and a dependency that slows down ──────────────────────────

export type Policy = 'wait' | 'retry' | 'shed' | 'breaker';
export interface QueueParams {
  arrival: number; workers: number; serviceMs: number;
  /** Seconds [from, to) during which each request takes `serviceMs` instead (a slow dependency). */
  slow?: { from: number; to: number; serviceMs: number };
  policy: Policy;
  /** Seconds a caller waits before giving up (retry, shed). */
  timeoutS?: number;
  seconds?: number;
}
export interface QueuePoint { t: number; queue: number; served: number; failed: number; waitS: number }
export interface QueueResult { series: QueuePoint[]; maxQueue: number; maxWaitS: number; failed: number; served: number; endQueue: number }

export function runQueue(p: QueueParams): QueueResult {
  const seconds = p.seconds ?? 60;
  const timeout = p.timeoutS ?? 2;
  let queue = 0;
  let retries = 0;
  let failed = 0;
  let served = 0;
  const series: QueuePoint[] = [];
  for (let t = 0; t < seconds; t++) {
    const slow = p.slow && t >= p.slow.from && t < p.slow.to;
    const ms = slow ? p.slow!.serviceMs : p.serviceMs;
    let capacity = (p.workers * 1000) / ms;
    let failNow = 0;
    let arrivals = p.arrival + retries;
    retries = 0;
    if (p.policy === 'breaker' && slow && ms >= p.serviceMs * 2) {
      // Breaker open: requests that need the slow dependency get a fast fallback instead of waiting.
      failNow += arrivals;
      arrivals = 0;
      capacity = (p.workers * 1000) / p.serviceMs;
    }
    queue += arrivals;
    const done = Math.min(queue, capacity);
    queue -= done;
    served += done;
    const waitBefore = capacity > 0 ? queue / capacity : Infinity;
    if (p.policy === 'retry' && waitBefore > timeout) {
      // Callers give up and send the request again; the abandoned copies are still in the queue.
      retries = Math.max(0, queue - capacity * timeout);
    }
    if (p.policy === 'shed' && waitBefore > timeout) {
      // Refuse what could not start within the timeout: those callers get a fast "try later" instead of a slow failure.
      const keep = capacity * timeout;
      failNow += queue - keep;
      queue = keep;
    }
    const wait = capacity > 0 ? queue / capacity : Infinity;
    failed += failNow;
    series.push({ t, queue: Math.round(queue), served: Math.round(done), failed: Math.round(failNow), waitS: Math.round(Math.min(wait, 999) * 10) / 10 });
  }
  return { series, maxQueue: Math.max(...series.map((s) => s.queue)), maxWaitS: Math.max(...series.map((s) => s.waitS)), failed: Math.round(failed), served: Math.round(served), endQueue: Math.round(queue) };
}

// ── Responsibilities: which object owns which job ───────────────────────────────────────────────────

export interface RoleCard { id: string; text: string; owner: string; alt?: string[]; why: string }
export type RoleVerdict = 'right' | 'alt' | 'wrong' | 'open';
export function checkRoles(cards: RoleCard[], assigned: Record<string, string | undefined>): Record<string, RoleVerdict> {
  return Object.fromEntries(cards.map((c) => {
    const a = assigned[c.id];
    return [c.id, !a ? 'open' : a === c.owner ? 'right' : c.alt?.includes(a) ? 'alt' : 'wrong'];
  }));
}

// ── Planning a traced request through the learner's design (cache-aside or read-through) ─────────────

export interface Hop { from: string; to: string; note: string; back?: boolean }
export interface TracePlan { hops: Hop[]; outcome: 'ok' | 'hit' | 'broken'; answeredBy?: string; cache?: string; explanation: string; missing?: boolean }

/**
 * A request from `path[0]` to `path[last]` along the learner's arrows. For a read, a cache the request passes
 * through (read-through) or that a part on the way reads from (cache-aside) is asked first: on a hit it answers
 * and the request goes no further; on a miss the request continues to the source of truth.
 */
export function planTrace(g: DesignGraph, path: string[] | null, opts: { read?: boolean; miss?: boolean } = {}): TracePlan {
  const name = (id: string) => byId(g, id)?.label ?? '?';
  if (!path || path.length < 2) return { hops: [], outcome: 'broken', missing: true, explanation: 'There is no chain of arrows from where the request starts to where it needs to go yet.' };
  const hops: Hop[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    const isCache = (id: string) => byId(g, id)?.kind === 'cache';
    if (opts.read && isCache(to) && i + 1 < path.length - 1) {
      // Read-through: the request passes through the cache.
      if (!opts.miss) {
        hops.push({ from, to, note: `${name(to)} has the data` });
        return { hops, outcome: 'hit', answeredBy: to, cache: to, explanation: `${name(to)} answers after ${hops.length} ${hops.length === 1 ? 'hop' : 'hops'}; ${name(path[path.length - 1])} is not asked.` };
      }
      hops.push({ from, to, note: `${name(to)} doesn’t have it (miss)` });
      continue;
    }
    // Cache-aside: this part reads from a cache that is not on the main path.
    const aside = opts.read ? g.links.find((l) => l.from === from && isCache(l.to) && !path.includes(l.to)) : undefined;
    if (aside) {
      if (!opts.miss) {
        hops.push({ from, to: aside.to, note: `${name(aside.to)} has the data` });
        return { hops, outcome: 'hit', answeredBy: aside.to, cache: aside.to, explanation: `${name(from)} asks ${name(aside.to)} first and gets the answer; ${name(path[path.length - 1])} is not asked.` };
      }
      hops.push({ from, to: aside.to, note: `${name(aside.to)} doesn’t have it (miss)` });
    }
    hops.push({ from, to, note: i === path.length - 2 ? `${name(to)} answers` : `${name(to)} handles it` });
  }
  const cache = hops.find((h) => byId(g, h.to)?.kind === 'cache')?.to;
  return { hops, outcome: 'ok', answeredBy: path[path.length - 1], cache, explanation: `The request reaches ${name(path[path.length - 1])} after ${hops.length} ${hops.length === 1 ? 'hop' : 'hops'}${cache ? ` (${name(cache)} missed first)` : ''}.` };
}
