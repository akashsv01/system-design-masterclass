import { describe, it, expect, beforeEach } from 'vitest';
import { openDb, type DB } from '../server/db';
import { createApp } from '../server/app';

let db: DB;
let app: ReturnType<typeof createApp>;

const H = { 'content-type': 'application/json', 'x-sdm-client': '1' };

async function register(email: string) {
  const res = await app.request('/api/register', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ email, password: 'correct horse' }),
  });
  expect(res.status).toBe(200);
  const cookie = res.headers.get('set-cookie')!.split(';')[0];
  return cookie;
}

async function pushAs(cookie: string, body: unknown) {
  return app.request('/api/progress', { method: 'POST', headers: { ...H, cookie }, body: JSON.stringify(body) });
}

async function pullAs(cookie: string, since = 0) {
  const res = await app.request(`/api/progress?since=${since}`, { headers: { cookie } });
  return res.json() as Promise<{ records: { key: string; value: unknown; rev: number }[]; cursor: number }>;
}

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp(db, { secureCookies: false });
});

describe('accounts', () => {
  it('rejects writes without the client header (CSRF guard)', async () => {
    const res = await app.request('/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', password: 'correct horse' }),
    });
    expect(res.status).toBe(400);
  });

  it('logs in with the right password only', async () => {
    await register('a@example.com');
    const bad = await app.request('/api/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'a@example.com', password: 'wrong password' }) });
    expect(bad.status).toBe(401);
    const good = await app.request('/api/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'A@example.com', password: 'correct horse' }) });
    expect(good.status).toBe(200);
  });

  it('signing out invalidates the session server-side', async () => {
    const cookie = await register('a@example.com');
    await app.request('/api/logout', { method: 'POST', headers: { ...H, cookie } });
    const res = await app.request('/api/progress', { headers: { cookie } });
    expect(res.status).toBe(401);
  });
});

describe('progress sync', () => {
  it('keeps each account private', async () => {
    const alice = await register('alice@example.com');
    const bob = await register('bob@example.com');
    await pushAs(alice, { mutationId: 'm-alice-0001', records: [{ key: 'note:secret', value: 'alice only', updatedAt: 1, baseRev: 0 }] });
    const bobView = await pullAs(bob);
    expect(bobView.records).toHaveLength(0);
    const aliceView = await pullAs(alice);
    expect(aliceView.records.map((r) => r.value)).toEqual(['alice only']);
  });

  it('requires a session', async () => {
    const res = await pushAs('', { mutationId: 'm-anon-00001', records: [] });
    expect(res.status).toBe(401);
  });

  it('applies a retried push only once', async () => {
    const c = await register('a@example.com');
    const body = { mutationId: 'm-retry-0001', records: [{ key: 'step:replica-lag', value: 3, updatedAt: 1, baseRev: 0 }] };
    const first = await (await pushAs(c, body)).json();
    const second = await (await pushAs(c, body)).json();
    expect(second).toEqual(first);
    const view = await pullAs(c);
    expect(view.records[0].rev).toBe(1);
  });

  it('preserves both drafts when two devices edit the same drawing', async () => {
    const c = await register('a@example.com');
    await pushAs(c, { mutationId: 'm-dev-a-001', records: [{ key: 'draft:first-booking:race', value: { text: 'v1' }, updatedAt: 1, baseRev: 0 }] });
    // Device A edits based on rev 1.
    await pushAs(c, { mutationId: 'm-dev-a-002', records: [{ key: 'draft:first-booking:race', value: { text: 'from A' }, updatedAt: 2, baseRev: 1 }] });
    // Device B still thinks rev 1 is current.
    const res = await (await pushAs(c, { mutationId: 'm-dev-b-001', records: [{ key: 'draft:first-booking:race', value: { text: 'from B' }, updatedAt: 3, baseRev: 1 }] })).json();
    expect(res.conflicts).toEqual([{ key: 'draft:first-booking:race', keptAs: 'draft:first-booking:race@conflict-1' }]);
    const view = await pullAs(c);
    const byKey = Object.fromEntries(view.records.map((r) => [r.key, r.value]));
    expect(byKey['draft:first-booking:race']).toEqual({ text: 'from A' });
    expect(byKey['draft:first-booking:race@conflict-1']).toEqual({ text: 'from B' });
  });

  it('merges compatible concurrent edits (status keeps the strongest evidence)', async () => {
    const c = await register('a@example.com');
    await pushAs(c, { mutationId: 'm-st-00001', records: [{ key: 'status:lru-cache', value: 'independent', updatedAt: 1, baseRev: 0 }] });
    await pushAs(c, { mutationId: 'm-st-00002', records: [{ key: 'status:lru-cache', value: 'studied', updatedAt: 2, baseRev: 0 }] });
    const view = await pullAs(c);
    expect(view.records.find((r) => r.key === 'status:lru-cache')!.value).toBe('independent');
  });

  it('pulls incrementally with a cursor', async () => {
    const c = await register('a@example.com');
    await pushAs(c, { mutationId: 'm-cur-00001', records: [{ key: 'step:a', value: 1, updatedAt: 1, baseRev: 0 }] });
    const first = await pullAs(c);
    await pushAs(c, { mutationId: 'm-cur-00002', records: [{ key: 'step:b', value: 2, updatedAt: 2, baseRev: 0 }] });
    const next = await pullAs(c, first.cursor);
    expect(next.records.map((r) => r.key)).toEqual(['step:b']);
  });

  it('rejects malformed keys', async () => {
    const c = await register('a@example.com');
    const res = await pushAs(c, { mutationId: 'm-bad-00001', records: [{ key: '../etc', value: 1, updatedAt: 1, baseRev: 0 }] });
    expect(res.status).toBe(400);
  });
});
