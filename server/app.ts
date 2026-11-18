import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import type { DB } from './db.ts';
import {
  AttemptLimiter,
  createSession,
  createUser,
  deleteSession,
  findUserByEmail,
  userForSession,
  verifyPassword,
  type User,
} from './auth.ts';
import { push, pull, ValidationError } from './sync.ts';
import { pushSchema } from '../shared/progress.ts';

export const COOKIE = 'sdm_session';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
  displayName: z.string().trim().max(80).optional(),
});

type Env = { Variables: { user: User | null } };

export function createApp(db: DB, opts: { secureCookies: boolean; authAttemptsPer15Min?: number }) {
  const app = new Hono<Env>();
  // Login/registration attempts per IP (and per email for logins) in a 15-minute window.
  const limiter = new AttemptLimiter(opts.authAttemptsPer15Min ?? 10, 15 * 60_000);

  const cookieOpts = {
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure: opts.secureCookies,
    path: '/',
  };

  app.use('/api/*', async (c, next) => {
    // CSRF defence for cookie-authenticated writes: browsers cannot attach this
    // custom header cross-origin without a CORS preflight, which we never grant.
    if (c.req.method !== 'GET' && c.req.header('x-sdm-client') !== '1') {
      return c.json({ error: 'Missing client header' }, 400);
    }
    c.set('user', userForSession(db, getCookie(c, COOKIE)));
    c.header('Cache-Control', 'no-store');
    await next();
  });

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.get('/api/me', (c) => {
    const user = c.get('user');
    return c.json({ user });
  });

  app.post('/api/register', async (c) => {
    const parsed = credentials.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
    const ip = c.req.header('x-forwarded-for') ?? 'local';
    if (!limiter.allow(`reg:${ip}`)) return c.json({ error: 'Too many attempts. Try again in a few minutes.' }, 429);
    if (findUserByEmail(db, parsed.data.email)) return c.json({ error: 'An account with that email already exists.' }, 409);
    const user = createUser(db, parsed.data.email, parsed.data.password, parsed.data.displayName);
    const s = createSession(db, user.id);
    setCookie(c, COOKIE, s.token, { ...cookieOpts, expires: new Date(s.expiresAt) });
    return c.json({ user });
  });

  app.post('/api/login', async (c) => {
    const parsed = credentials.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Enter your email and password.' }, 400);
    const ip = c.req.header('x-forwarded-for') ?? 'local';
    if (!limiter.allow(`login:${ip}:${parsed.data.email}`)) {
      return c.json({ error: 'Too many attempts. Try again in a few minutes.' }, 429);
    }
    const row = findUserByEmail(db, parsed.data.email);
    if (!row || !verifyPassword(parsed.data.password, row.password_hash)) {
      return c.json({ error: 'That email and password do not match.' }, 401);
    }
    const s = createSession(db, row.id);
    setCookie(c, COOKIE, s.token, { ...cookieOpts, expires: new Date(s.expiresAt) });
    return c.json({ user: { id: row.id, email: row.email, displayName: row.display_name } });
  });

  app.post('/api/logout', (c) => {
    deleteSession(db, getCookie(c, COOKIE));
    deleteCookie(c, COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  app.get('/api/progress', (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Sign in to sync progress.' }, 401);
    const since = Number(c.req.query('since') ?? 0);
    return c.json(pull(db, user.id, Number.isFinite(since) && since >= 0 ? since : 0));
  });

  app.post('/api/progress', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Sign in to sync progress.' }, 401);
    const parsed = pushSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Invalid progress payload', issues: parsed.error.issues.slice(0, 5) }, 400);
    try {
      return c.json(push(db, user.id, parsed.data));
    } catch (e) {
      if (e instanceof ValidationError) return c.json({ error: e.message }, 413);
      throw e;
    }
  });

  return app;
}
