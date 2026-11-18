import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ProgressStore, type Namespace } from './store';
import { SyncEngine, type SyncState } from './sync';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
}

interface Ctx {
  store: ProgressStore;
  user: User | null;
  authReady: boolean;
  sync: SyncState;
  signIn(email: string, password: string, mode: 'login' | 'register'): Promise<string | null>;
  signOut(): Promise<{ ok: boolean; unsynced: number }>;
  retrySync(): void;
  conflicts: { key: string; keptAs: string }[];
}

const ProgressCtx = createContext<Ctx | null>(null);
const H = { 'content-type': 'application/json', 'x-sdm-client': '1' };

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [store, setStore] = useState(() => new ProgressStore('guest'));
  const engineRef = useRef<SyncEngine | null>(null);
  const [sync, setSync] = useState<SyncState>({ kind: 'local' });
  const [conflicts, setConflicts] = useState<{ key: string; keptAs: string }[]>([]);

  const attach = useCallback((u: User | null, migrateGuest: boolean) => {
    engineRef.current?.stop();
    engineRef.current = null;
    if (!u) {
      setStore(new ProgressStore('guest'));
      setSync({ kind: 'local' });
      return;
    }
    const ns: Namespace = `user:${u.id}`;
    const s = new ProgressStore(ns);
    if (migrateGuest) {
      // Preserve everything the learner did as a guest, including half-finished drawings.
      const guest = ProgressStore.load('guest');
      if (Object.keys(guest.records).length) {
        s.absorb(guest);
        ProgressStore.clear('guest');
      }
    }
    const engine = new SyncEngine(s);
    engine.subscribe(() => setSync(engine.state));
    engine.onConflict = (c) => setConflicts((prev) => [...prev, ...c]);
    engine.onUnauthorized = () => setUser(null);
    engineRef.current = engine;
    setStore(s);
    setSync({ kind: 'saving' });
    engine.schedule(0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .catch(() => ({ user: null }))
      .then((body: { user: User | null }) => {
        if (cancelled) return;
        setUser(body.user);
        // A returning signed-in learner may have guest work from before; keep it.
        attach(body.user, !!body.user);
        setAuthReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attach]);

  // Pull changes from other devices when the tab regains focus.
  useEffect(() => {
    const onFocus = () => engineRef.current?.schedule(0);
    const onOnline = () => engineRef.current?.schedule(0);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string, mode: 'login' | 'register') => {
      try {
        const res = await fetch(mode === 'login' ? '/api/login' : '/api/register', {
          method: 'POST',
          headers: H,
          credentials: 'same-origin',
          body: JSON.stringify({ email, password }),
        });
        const body = (await res.json().catch(() => ({}))) as { user?: User; error?: string };
        if (!res.ok || !body.user) return body.error ?? 'Something went wrong. Try again.';
        setUser(body.user);
        attach(body.user, true);
        return null;
      } catch {
        return 'Could not reach the server. Your work is still saved on this device.';
      }
    },
    [attach],
  );

  const signOut = useCallback(async () => {
    const engine = engineRef.current;
    let unsynced = 0;
    if (engine) {
      await engine.flush().catch(() => false);
      unsynced = store.dirtyKeys().length;
    }
    await fetch('/api/logout', { method: 'POST', headers: H, credentials: 'same-origin' }).catch(() => null);
    // Shared devices: remove the account's copy from this browser.
    if (store.ns !== 'guest') ProgressStore.clear(store.ns);
    setUser(null);
    setConflicts([]);
    attach(null, false);
    return { ok: unsynced === 0, unsynced };
  }, [attach, store]);

  const retrySync = useCallback(() => engineRef.current?.schedule(0), []);

  const value = useMemo<Ctx>(
    () => ({ store, user, authReady, sync, signIn, signOut, retrySync, conflicts }),
    [store, user, authReady, sync, signIn, signOut, retrySync, conflicts],
  );
  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>;
}

export function useProgress(): Ctx {
  const c = useContext(ProgressCtx);
  if (!c) throw new Error('useProgress outside provider');
  return c;
}

/** Subscribe to one record. Returns [value, setValue]. */
export function useRecord<T>(key: string, fallback: T): [T, (v: T) => void] {
  const { store } = useProgress();
  const getSnap = useCallback(() => JSON.stringify(store.get(key) ?? null), [store, key]);
  const snap = useSyncExternalStore(store.subscribe.bind(store), getSnap, getSnap);
  const value = (JSON.parse(snap) as T | null) ?? fallback;
  const set = useCallback((v: T) => store.set(key, v), [store, key]);
  return [value, set];
}

/** Re-render when any record with the prefix changes. */
export function useRecords(prefix: string): [string, unknown][] {
  const { store } = useProgress();
  const getSnap = useCallback(
    () => JSON.stringify(store.entries(prefix).map(([k, r]) => [k, r.value])),
    [store, prefix],
  );
  const snap = useSyncExternalStore(store.subscribe.bind(store), getSnap, getSnap);
  return JSON.parse(snap) as [string, unknown][];
}
