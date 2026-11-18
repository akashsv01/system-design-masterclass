import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDb } from './db.ts';
import { createApp } from './app.ts';
import { pruneMutations } from './sync.ts';

const PORT = Number(process.env.PORT ?? 8787);
const DB_PATH = process.env.DATABASE_PATH ?? resolve('data/masterclass.db');
const production = process.env.NODE_ENV === 'production';

const db = openDb(DB_PATH);
pruneMutations(db);
const app = createApp(db, {
  secureCookies: production && process.env.INSECURE_COOKIES !== '1',
  authAttemptsPer15Min: process.env.AUTH_ATTEMPTS_PER_15MIN ? Number(process.env.AUTH_ATTEMPTS_PER_15MIN) : undefined,
});

const dist = resolve('dist');
if (existsSync(dist)) {
  // Hashed build assets can be cached forever; everything else (worker, Pyodide runtime) revalidates.
  app.use('/assets/*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
  });
  app.use('*', async (c, next) => (c.req.path.startsWith('/api/') ? next() : serveStatic({ root: './dist' })(c, next)));
  // Single-page app: every non-API, non-file route returns index.html so deep links work.
  // Read per request so a rebuild never serves an index that points at deleted chunks.
  app.get('*', (c) => {
    const path = c.req.path;
    if (path.startsWith('/api/') || path.startsWith('/assets/') || path.startsWith('/pyodide/') || /\.[a-z0-9]+$/i.test(path)) return c.notFound();
    c.header('Cache-Control', 'no-cache');
    return c.html(readFileSync(resolve(dist, 'index.html'), 'utf8'));
  });
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`System Design Masterclass listening on http://localhost:${info.port} (db: ${DB_PATH})`);
});
