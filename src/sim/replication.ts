/**
 * Leader → follower replication with lag (deterministic).
 *
 * Model assumptions (shown to learners):
 * - Two databases: the leader accepts writes; the follower receives a copy of each write
 *   `lagMs` after the leader applies it (asynchronous replication).
 * - The profile page reads according to a routing strategy.
 * - Network time between app and database is ignored so the lag is the only delay in view.
 * - The clock starts at 10:00:00.000, when the learner's save of "Alex" reaches the leader (the brief's benchmark:
 *   primary at 10:00:00, replica at 10:00:02 with the lesson's 2 s lag).
 */

export type ReadStrategy = 'follower' | 'leader-after-own-write' | 'synchronous';

export interface ReplicaConfig {
  lagMs: number;
  strategy: ReadStrategy;
  /** How long reads go to the leader after a user's own write (leader-after-own-write). */
  stickyMs: number;
}

export interface ReplicaEvent {
  t: number;
  text: string;
}

export const T0 = 10 * 3600_000; // 10:00:00.000 in ms since midnight
export const WRITE_AT = T0;

export function fmtClock(t: number, withMs = false): string {
  const h = Math.floor(t / 3600_000);
  const m = Math.floor((t % 3600_000) / 60_000);
  const s = Math.floor((t % 60_000) / 1000);
  const ms = t % 1000;
  const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return withMs ? `${base}.${String(ms).padStart(3, '0')}` : base;
}

export interface ReplicaState {
  t: number;
  leader: string;
  follower: string;
  /** The write has been applied on the leader but not yet on the follower. */
  copyInFlight: boolean;
  /** Time the follower receives the copy. */
  copyArrivesAt: number;
  /** When the app tells the user "Saved" (later under synchronous replication). */
  savedAt: number;
  events: ReplicaEvent[];
}

export function stateAt(cfg: ReplicaConfig, t: number, wrote = true): ReplicaState {
  const copyArrivesAt = WRITE_AT + cfg.lagMs;
  const savedAt = cfg.strategy === 'synchronous' ? copyArrivesAt : WRITE_AT;
  const events: ReplicaEvent[] = [];
  let leader = 'Sam';
  let follower = 'Sam';
  if (wrote && t >= WRITE_AT) {
    leader = 'Alex';
    events.push({ t: WRITE_AT, text: 'Leader applies the write: name = "Alex".' });
    if (cfg.strategy === 'synchronous') events.push({ t: WRITE_AT, text: 'Leader waits for the follower before replying.' });
  }
  if (wrote && t >= copyArrivesAt) {
    follower = 'Alex';
    events.push({ t: copyArrivesAt, text: `Follower applies the copy (${cfg.lagMs} ms after the leader).` });
  }
  if (wrote && t >= savedAt) {
    events.push({ t: savedAt, text: `App shows “Saved” to the user${cfg.strategy === 'synchronous' ? ` after ${cfg.lagMs} ms` : ''}.` });
  }
  events.sort((a, b) => a.t - b.t);
  return {
    t,
    leader,
    follower,
    copyInFlight: wrote && t >= WRITE_AT && t < copyArrivesAt,
    copyArrivesAt,
    savedAt,
    events,
  };
}

export interface ReadResult {
  from: 'leader' | 'follower';
  value: string;
  stale: boolean;
}

/** What a profile read at time t returns for the user who made the write. */
export function readProfile(cfg: ReplicaConfig, t: number, ownWrite = true): ReadResult {
  const s = stateAt(cfg, t);
  let from: 'leader' | 'follower' = 'follower';
  if (cfg.strategy === 'leader-after-own-write' && ownWrite && t >= WRITE_AT && t < WRITE_AT + cfg.stickyMs) from = 'leader';
  if (cfg.strategy === 'synchronous') from = 'follower';
  const value = from === 'leader' ? s.leader : s.follower;
  return { from, value, stale: value !== s.leader };
}

/** Fraction of reads (sampled every 100 ms over [WRITE_AT, WRITE_AT + windowMs)) that show the old name. */
export function staleFraction(cfg: ReplicaConfig, windowMs = 3000, ownWrite = true): number {
  let stale = 0;
  let n = 0;
  for (let t = WRITE_AT; t < WRITE_AT + windowMs; t += 100) {
    if (cfg.strategy === 'synchronous' && t < stateAt(cfg, t).savedAt) continue; // user still waiting for "Saved"
    n++;
    if (readProfile(cfg, t, ownWrite).stale) stale++;
  }
  return n ? stale / n : 0;
}
