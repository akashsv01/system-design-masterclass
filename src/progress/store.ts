/**
 * Local-first progress store.
 *
 * Guests: records live in localStorage under "sdm:v1:guest" and never leave the device.
 * Signed in: records live under "sdm:v1:user:<id>" and sync to the server. Edits are
 * written locally first (so a refresh never loses work) and marked dirty until the
 * server confirms them.
 */
import { EXPORT_FORMAT, EXPORT_VERSION, exportSchema, type ProgressExport, KEY_RE } from '../../shared/progress';

export interface LocalRecord {
  value: unknown;
  updatedAt: number;
  /** Last server revision this device has seen (0 = never synced). */
  rev: number;
  dirty?: boolean;
  deleted?: boolean;
}

export interface PendingBatch {
  mutationId: string;
  keys: string[];
  /** updatedAt of each key when the batch was formed — used to tell if it was edited again. */
  stamps: Record<string, number>;
}

export interface StoreData {
  records: Record<string, LocalRecord>;
  cursor: number;
  pending?: PendingBatch | null;
}

const PREFIX = 'sdm:v1:';

export type Namespace = 'guest' | `user:${string}`;

function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeWrite(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

type Listener = () => void;

export class ProgressStore {
  private data: StoreData;
  private listeners = new Set<Listener>();
  persistOk = true;

  constructor(public ns: Namespace) {
    this.data = ProgressStore.load(ns);
  }

  static load(ns: Namespace): StoreData {
    const raw = safeRead(PREFIX + ns);
    if (!raw) return { records: {}, cursor: 0, pending: null };
    try {
      const parsed = JSON.parse(raw) as StoreData;
      return { records: parsed.records ?? {}, cursor: parsed.cursor ?? 0, pending: parsed.pending ?? null };
    } catch {
      return { records: {}, cursor: 0, pending: null };
    }
  }

  static clear(ns: Namespace) {
    safeRemove(PREFIX + ns);
  }

  private persist() {
    this.persistOk = safeWrite(PREFIX + this.ns, JSON.stringify(this.data));
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  get<T>(key: string): T | undefined {
    const r = this.data.records[key];
    return r && !r.deleted ? (r.value as T) : undefined;
  }

  keys(prefix = ''): string[] {
    return Object.keys(this.data.records).filter((k) => k.startsWith(prefix) && !this.data.records[k].deleted);
  }

  entries(prefix = ''): [string, LocalRecord][] {
    return Object.entries(this.data.records).filter(([k, r]) => k.startsWith(prefix) && !r.deleted);
  }

  set(key: string, value: unknown) {
    if (!KEY_RE.test(key)) throw new Error(`Invalid progress key: ${key}`);
    const prev = this.data.records[key];
    if (prev && !prev.deleted && JSON.stringify(prev.value) === JSON.stringify(value)) return;
    this.data.records[key] = { value, updatedAt: Date.now(), rev: prev?.rev ?? 0, dirty: true };
    this.persist();
    this.emit();
  }

  remove(key: string) {
    const prev = this.data.records[key];
    if (!prev) return;
    this.data.records[key] = { value: null, updatedAt: Date.now(), rev: prev.rev, dirty: true, deleted: true };
    this.persist();
    this.emit();
  }

  dirtyKeys(): string[] {
    return Object.keys(this.data.records).filter((k) => this.data.records[k].dirty);
  }

  raw(key: string): LocalRecord | undefined {
    return this.data.records[key];
  }

  get cursor() {
    return this.data.cursor;
  }

  get pending() {
    return this.data.pending ?? null;
  }

  setPending(p: PendingBatch | null) {
    this.data.pending = p;
    this.persist();
  }

  /** Mark records confirmed by the server, unless they were edited again meanwhile. */
  confirm(batch: PendingBatch, applied: { key: string; value: unknown; rev: number; updatedAt: number; deleted?: boolean }[], cursor: number) {
    for (const a of applied) {
      const local = this.data.records[a.key];
      const editedSince = local && batch.stamps[a.key] !== undefined && local.updatedAt !== batch.stamps[a.key];
      if (editedSince) {
        // Keep the newer local edit dirty, but base it on the revision we just wrote.
        local.rev = a.rev;
        continue;
      }
      if (a.deleted) {
        delete this.data.records[a.key];
      } else {
        this.data.records[a.key] = { value: a.value, updatedAt: a.updatedAt, rev: a.rev };
      }
    }
    // Keys in the batch that the server did not echo (should not happen) stay dirty.
    this.data.pending = null;
    this.data.cursor = Math.max(this.data.cursor, cursor);
    this.persist();
    this.emit();
  }

  /** Apply records pulled from the server. Local unsynced edits win locally until pushed. */
  applyRemote(records: { key: string; value: unknown; rev: number; updatedAt: number; deleted?: boolean }[], cursor: number) {
    let changed = false;
    for (const r of records) {
      const local = this.data.records[r.key];
      if (local?.dirty) continue;
      if (local && local.rev >= r.rev) continue;
      if (r.deleted) delete this.data.records[r.key];
      else this.data.records[r.key] = { value: r.value, updatedAt: r.updatedAt, rev: r.rev };
      changed = true;
    }
    this.data.cursor = Math.max(this.data.cursor, cursor);
    this.persist();
    if (changed) this.emit();
  }

  /** Copy guest records into this (account) store as unsynced edits. */
  absorb(other: StoreData) {
    for (const [key, rec] of Object.entries(other.records)) {
      if (rec.deleted) continue;
      const mine = this.data.records[key];
      if (mine && !mine.deleted && JSON.stringify(mine.value) === JSON.stringify(rec.value)) continue;
      // baseRev 0 tells the server "I never saw your version": it merges or keeps both.
      this.data.records[key] = { value: rec.value, updatedAt: rec.updatedAt, rev: mine?.dirty ? mine.rev : 0, dirty: true };
    }
    this.persist();
    this.emit();
  }

  snapshot(): StoreData {
    return JSON.parse(JSON.stringify(this.data)) as StoreData;
  }

  exportJson(): ProgressExport {
    return {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      records: this.entries().map(([key, r]) => ({ key, value: r.value, updatedAt: r.updatedAt })),
    };
  }

  /**
   * Import a validated export. Existing records are kept when they are newer;
   * drafts that differ are preserved side by side as "@imported" copies.
   */
  importJson(input: unknown): { imported: number; keptBoth: number } {
    const parsed = exportSchema.parse(input);
    let imported = 0;
    let keptBoth = 0;
    for (const rec of parsed.records) {
      const mine = this.data.records[rec.key];
      if (!mine || mine.deleted) {
        this.data.records[rec.key] = { value: rec.value, updatedAt: rec.updatedAt, rev: mine?.rev ?? 0, dirty: true };
        imported++;
        continue;
      }
      if (JSON.stringify(mine.value) === JSON.stringify(rec.value)) continue;
      const isWork = /^(draft|note|interview):/.test(rec.key);
      if (isWork) {
        const copy = `${rec.key}@imported`;
        this.data.records[copy] = { value: rec.value, updatedAt: rec.updatedAt, rev: 0, dirty: true };
        keptBoth++;
      } else if (rec.updatedAt > mine.updatedAt) {
        this.data.records[rec.key] = { value: rec.value, updatedAt: rec.updatedAt, rev: mine.rev, dirty: true };
        imported++;
      }
    }
    this.persist();
    this.emit();
    return { imported, keptBoth };
  }
}
