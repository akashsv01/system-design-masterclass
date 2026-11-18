/**
 * Learner progress model shared by the browser and the server.
 *
 * Progress is a flat set of records keyed by strings such as
 *   "step:replica-lag"         → number   (exact lesson step)
 *   "status:replica-lag"       → "started" | "studied" | "hinted" | "independent"
 *   "draft:first-booking:race" → { text, drawing }  (learner drafts and drawings)
 *   "sim:replica-lag"          → { delayMs }       (simulation inputs)
 *   "note:<id>", "bookmark:<id>", "quiz:<id>", "mistake:<id>", "review:<id>", "interview:<id>"
 *
 * Each record carries the server revision it was based on so the server can
 * detect concurrent edits (optimistic concurrency). Every push carries a
 * mutationId so a retried push is applied at most once (idempotency).
 */
import { z } from 'zod';

export const RECORD_KINDS = [
  'step', 'status', 'draft', 'sim', 'note', 'bookmark', 'quiz', 'mistake', 'review', 'interview', 'pref',
] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export const KEY_RE = /^(step|status|draft|sim|note|bookmark|quiz|mistake|review|interview|pref):[a-z0-9][a-z0-9:._@-]{0,160}$/;
export const MAX_VALUE_BYTES = 200_000;

export function kindOf(key: string): RecordKind {
  return key.slice(0, key.indexOf(':')) as RecordKind;
}

export const recordSchema = z.object({
  key: z.string().regex(KEY_RE),
  value: z.unknown(),
  /** Client wall-clock time of the last local edit (ms since epoch). Informational. */
  updatedAt: z.number().int().nonnegative(),
  /** Server revision this edit was based on; 0 when the record never reached the server. */
  baseRev: z.number().int().nonnegative(),
  deleted: z.boolean().optional(),
});
export type ProgressRecord = z.infer<typeof recordSchema>;

export const pushSchema = z.object({
  mutationId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  records: z.array(recordSchema).max(500),
});
export type PushRequest = z.infer<typeof pushSchema>;

export interface ServerRecord {
  key: string;
  value: unknown;
  rev: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface PushResult {
  /** Records as stored after the push (including any conflict copies created). */
  applied: ServerRecord[];
  /** Keys whose incoming edit conflicted with a newer server edit. */
  conflicts: { key: string; keptAs: string }[];
  cursor: number;
}

export interface PullResult {
  records: ServerRecord[];
  cursor: number;
}

/** Status ordering: later entries represent stronger evidence of skill. */
export const STATUS_ORDER = ['started', 'studied', 'hinted', 'independent'] as const;
export type LessonStatus = (typeof STATUS_ORDER)[number];

/**
 * Merge rule for two concurrent edits of the same record.
 * Returns { value } when the two can be combined safely, or null when the
 * learner's work would be lost by picking one (drafts, notes, interviews).
 */
export function mergeValues(key: string, server: unknown, incoming: unknown): { value: unknown } | null {
  const kind = kindOf(key);
  if (JSON.stringify(server) === JSON.stringify(incoming)) return { value: incoming };
  switch (kind) {
    case 'status': {
      const a = STATUS_ORDER.indexOf(server as LessonStatus);
      const b = STATUS_ORDER.indexOf(incoming as LessonStatus);
      return { value: a >= b ? server : incoming };
    }
    case 'step':
      // The most recent position wins; a step is cheap to redo.
      return { value: incoming };
    case 'bookmark':
    case 'sim':
    case 'pref':
      return { value: incoming };
    case 'quiz': {
      // Keep every attempt from both sides.
      const sa = (server as { attempts?: unknown[] })?.attempts ?? [];
      const ia = (incoming as { attempts?: unknown[] })?.attempts ?? [];
      const seen = new Set<string>();
      const attempts = [...sa, ...ia].filter((x) => {
        const k = JSON.stringify(x);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return { value: { ...(server as object), ...(incoming as object), attempts } };
    }
    case 'review': {
      const s = server as { reps?: number };
      const i = incoming as { reps?: number };
      return { value: (i?.reps ?? 0) >= (s?.reps ?? 0) ? incoming : server };
    }
    case 'mistake':
      return { value: incoming };
    default:
      return null; // draft, note, interview: preserve both versions
  }
}

export const EXPORT_FORMAT = 'system-design-masterclass/progress';
export const EXPORT_VERSION = 1;

export const exportSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.string(),
  records: z.array(
    z.object({
      key: z.string().regex(KEY_RE),
      value: z.unknown(),
      updatedAt: z.number().int().nonnegative(),
    }),
  ).max(5000),
});
export type ProgressExport = z.infer<typeof exportSchema>;

export function valueSize(v: unknown): number {
  return new TextEncoder().encode(JSON.stringify(v ?? null)).length;
}
