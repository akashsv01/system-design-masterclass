import { useEffect, useRef, useState } from 'react';
import { useProgress } from '../../progress/ProgressProvider';

export function AccountDialog({ onClose }: { onClose: () => void }) {
  const { user, signIn, signOut, sync, retrySync, store } = useProgress();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const guestCount = store.ns === 'guest' ? store.keys().length : 0;

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="acct-title" ref={ref}>
        {user ? (
          <>
            <h2 id="acct-title">Your account</h2>
            <p>Signed in as <strong>{user.email}</strong>.</p>
            <p className="notice">
              {sync.kind === 'saved' && '✓ Everything is saved to your account.'}
              {sync.kind === 'saving' && 'Saving your latest changes…'}
              {sync.kind === 'pending' && `⧗ ${sync.reason}`}
              {sync.kind === 'error' && `✕ ${sync.message}`}
            </p>
            {(sync.kind === 'pending' || sync.kind === 'error') && <button className="btn btn-small" onClick={retrySync}>Retry now</button>}
            {notice && <p className="notice warn">{notice}</p>}
            <div className="toolbar" style={{ marginTop: 16 }}>
              <button
                className="btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await signOut();
                  setBusy(false);
                  if (!r.ok) setNotice(`${r.unsynced} change(s) had not reached the server and were removed from this device.`);
                  else onClose();
                }}
              >
                Sign out of this device
              </button>
              <button className="btn btn-quiet" onClick={onClose}>Close</button>
            </div>
            <p className="muted" style={{ fontSize: 14 }}>Signing out removes your account’s copy from this browser, so the next person using it starts fresh.</p>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              const err = await signIn(email, password, mode);
              setBusy(false);
              if (err) setError(err);
              else onClose();
            }}
          >
            <h2 id="acct-title">{mode === 'login' ? 'Sign in' : 'Create an account'}</h2>
            <p className="muted" style={{ fontSize: 15 }}>
              You don’t need an account to use anything here. Your progress is saved on this device. Sign in to keep it across devices.
              {guestCount > 0 && <> Your {guestCount} saved item(s) on this device will be added to your account.</>}
            </p>
            <label className="field"><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="field">
              <span>Password</span>
              <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <p className="notice err" role="alert">{error}</p>}
            <div className="toolbar">
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
              <button className="btn btn-quiet" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
                {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
