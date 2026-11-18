import type { DB } from './db.ts';
import { tx } from './db.ts';
import {
  mergeValues,
  valueSize,
  MAX_VALUE_BYTES,
  type PushRequest,
  type PushResult,
  type PullResult,
  type ServerRecord,
} from '../shared/progress.ts';

interface Row {
  key: string;
  value_json: string;
  rev: number;
  seq: number;
  updated_at: number;
  deleted: number;
}

const toRecord = (r: Row): ServerRecord => ({
  key: r.key,
  value: JSON.parse(r.value_json),
  rev: r.rev,
  updatedAt: r.updated_at,
  ...(r.deleted ? { deleted: true } : {}),
});

function nextSeq(db: DB, userId: string): number {
  db.prepare('UPDATE user_seq SET seq = seq + 1 WHERE user_id = ?').run(userId);
  return (db.prepare('SELECT seq FROM user_seq WHERE user_id = ?').get(userId) as { seq: number }).seq;
}

function currentSeq(db: DB, userId: string): number {
  return ((db.prepare('SELECT seq FROM user_seq WHERE user_id = ?').get(userId) as { seq: number } | undefined)?.seq) ?? 0;
}

export class ValidationError extends Error {}

/**
 * Apply a batch of learner edits for one user.
 *
 * - Every query is scoped by userId taken from the session, never from the body.
 * - A repeated mutationId returns the stored result without re-applying (safe retries).
 * - An edit based on an outdated revision is merged when the record kind allows it;
 *   otherwise the incoming version is kept as a sibling "...@conflict-<n>" record so
 *   no learner work is lost and the client can ask which one to keep.
 */
export function push(db: DB, userId: string, req: PushRequest): PushResult {
  for (const r of req.records) {
    if (valueSize(r.value) > MAX_VALUE_BYTES) throw new ValidationError(`Record ${r.key} is too large`);
  }
  return tx(db, () => {
    const prior = db
      .prepare('SELECT result_json FROM mutations WHERE user_id = ? AND mutation_id = ?')
      .get(userId, req.mutationId) as { result_json: string } | undefined;
    if (prior) return JSON.parse(prior.result_json) as PushResult;

    const getRow = db.prepare('SELECT * FROM records WHERE user_id = ? AND key = ?');
    const upsert = db.prepare(
      `INSERT INTO records (user_id, key, value_json, rev, seq, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, key) DO UPDATE SET value_json = excluded.value_json, rev = excluded.rev,
         seq = excluded.seq, updated_at = excluded.updated_at, deleted = excluded.deleted`,
    );
    const applied: ServerRecord[] = [];
    const conflicts: PushResult['conflicts'] = [];

    const write = (key: string, value: unknown, rev: number, updatedAt: number, deleted: boolean) => {
      const seq = nextSeq(db, userId);
      upsert.run(userId, key, JSON.stringify(value ?? null), rev, seq, updatedAt, deleted ? 1 : 0);
      applied.push({ key, value, rev, updatedAt, ...(deleted ? { deleted: true } : {}) });
    };

    for (const rec of req.records) {
      const existing = getRow.get(userId, rec.key) as Row | undefined;
      if (!existing) {
        write(rec.key, rec.value, 1, rec.updatedAt, !!rec.deleted);
        continue;
      }
      if (rec.baseRev === existing.rev) {
        write(rec.key, rec.value, existing.rev + 1, rec.updatedAt, !!rec.deleted);
        continue;
      }
      // Concurrent edit: the record changed on the server since the client last saw it.
      const serverValue = JSON.parse(existing.value_json);
      if (existing.deleted || rec.deleted) {
        // Deleting vs editing: keep the edit (never silently drop work).
        const keep = rec.deleted ? serverValue : rec.value;
        write(rec.key, keep, existing.rev + 1, Math.max(rec.updatedAt, existing.updated_at), false);
        continue;
      }
      const merged = mergeValues(rec.key, serverValue, rec.value);
      if (merged) {
        write(rec.key, merged.value, existing.rev + 1, Math.max(rec.updatedAt, existing.updated_at), false);
      } else {
        let n = 1;
        while (getRow.get(userId, `${rec.key}@conflict-${n}`)) n++;
        const keptAs = `${rec.key}@conflict-${n}`;
        write(keptAs, rec.value, 1, rec.updatedAt, false);
        conflicts.push({ key: rec.key, keptAs });
        applied.push(toRecord(existing));
      }
    }
    const result: PushResult = { applied, conflicts, cursor: currentSeq(db, userId) };
    db.prepare('INSERT INTO mutations (user_id, mutation_id, result_json, created_at) VALUES (?, ?, ?, ?)').run(
      userId,
      req.mutationId,
      JSON.stringify(result),
      Date.now(),
    );
    return result;
  });
}

export function pull(db: DB, userId: string, since: number): PullResult {
  const rows = db
    .prepare('SELECT * FROM records WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT 2000')
    .all(userId, since) as unknown as Row[];
  const cursor = rows.length === 2000 ? rows[rows.length - 1].seq : currentSeq(db, userId);
  return { records: rows.map(toRecord), cursor };
}

export function pruneMutations(db: DB, olderThanMs = 7 * 86400_000) {
  db.prepare('DELETE FROM mutations WHERE created_at < ?').run(Date.now() - olderThanMs);
}
