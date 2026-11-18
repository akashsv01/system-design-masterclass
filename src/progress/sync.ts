import type { PullResult, PushResult } from '../../shared/progress';
import { ProgressStore } from './store';

export type SyncState =
  | { kind: 'local' } // guest: saved on this device only
  | { kind: 'saved' } // signed in: everything confirmed by the server
  | { kind: 'saving' }
  | { kind: 'pending'; count: number; reason: string } // will retry
  | { kind: 'error'; message: string };

export interface Fetcher {
  (input: string, init?: RequestInit): Promise<Response>;
}

const headers = { 'content-type': 'application/json', 'x-sdm-client': '1' };

function newMutationId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return 'm' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Pushes dirty records and pulls remote changes for a signed-in learner.
 * A batch's mutationId is persisted before sending, so if the tab closes or the
 * network drops mid-request, the next attempt re-sends the same id and the server
 * applies it at most once.
 */
export class SyncEngine {
  state: SyncState = { kind: 'saved' };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private again = false;
  private backoff = 1000;
  private listeners = new Set<() => void>();
  private stopped = false;
  onConflict?: (keys: { key: string; keptAs: string }[]) => void;
  onUnauthorized?: () => void;

  constructor(private store: ProgressStore, private fetcher: Fetcher = fetch.bind(globalThis)) {
    store.subscribe(() => this.schedule(600));
  }

  subscribe(l: () => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private setState(s: SyncState) {
    this.state = s;
    for (const l of this.listeners) l();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  schedule(delay = 0) {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    if (this.store.dirtyKeys().length) this.setState({ kind: 'saving' });
    this.timer = setTimeout(() => void this.run(), delay);
  }

  async flush(): Promise<boolean> {
    if (this.timer) clearTimeout(this.timer);
    await this.run();
    return this.store.dirtyKeys().length === 0;
  }

  async run(): Promise<void> {
    if (this.stopped) return;
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    try {
      await this.pushOnce();
      await this.pullOnce();
      this.backoff = 1000;
      const left = this.store.dirtyKeys().length;
      this.setState(left ? { kind: 'saving' } : { kind: 'saved' });
      if (left) this.again = true;
    } catch (e) {
      const count = this.store.dirtyKeys().length;
      if ((e as Error).message === 'unauthorized') {
        this.setState({ kind: 'error', message: 'Your session ended. Sign in again to keep syncing.' });
        this.onUnauthorized?.();
        return;
      }
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      this.setState({
        kind: 'pending',
        count,
        reason: offline ? 'You are offline. Changes are kept on this device and will sync when you reconnect.' : 'The server did not respond. Retrying.',
      });
      // Exponential backoff with jitter, capped at 30 s.
      const wait = Math.min(30_000, this.backoff) * (0.5 + Math.random() / 2);
      this.backoff = Math.min(30_000, this.backoff * 2);
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.run(), wait);
    } finally {
      this.running = false;
      if (this.again && !this.stopped) {
        this.again = false;
        this.schedule(200);
      }
    }
  }

  private async pushOnce() {
    let batch = this.store.pending;
    if (!batch) {
      const keys = this.store.dirtyKeys().slice(0, 400);
      if (!keys.length) return;
      const stamps: Record<string, number> = {};
      for (const k of keys) stamps[k] = this.store.raw(k)!.updatedAt;
      batch = { mutationId: newMutationId(), keys, stamps };
      this.store.setPending(batch);
    }
    const records = batch.keys
      .map((key) => {
        const r = this.store.raw(key);
        if (!r) return null;
        return { key, value: r.value, updatedAt: batch!.stamps[key] ?? r.updatedAt, baseRev: r.rev, ...(r.deleted ? { deleted: true } : {}) };
      })
      .filter(Boolean);
    const res = await this.fetcher('/api/progress', {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify({ mutationId: batch.mutationId, records }),
    });
    if (res.status === 401) throw new Error('unauthorized');
    if (res.status === 400 || res.status === 413) {
      // The batch can never succeed as-is; drop it so other work can sync, and report.
      this.store.setPending(null);
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? 'Rejected by server');
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = (await res.json()) as PushResult;
    this.store.confirm(batch, result.applied, 0);
    if (result.conflicts.length) this.onConflict?.(result.conflicts);
  }

  private async pullOnce() {
    const res = await this.fetcher(`/api/progress?since=${this.store.cursor}`, { credentials: 'same-origin' });
    if (res.status === 401) throw new Error('unauthorized');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as PullResult;
    this.store.applyRemote(body.records, body.cursor);
  }
}
