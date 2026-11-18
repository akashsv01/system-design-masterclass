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
const app = createApp(db, { secureCookies: production && process.env.INSECURE_COOKIES !== '1' });

const dist = resolve('dist');
if (existsSync(dist)) {
  app.use('/assets/*', serveStatic({ root: './dist' }));
  app.use('/favicon.svg', serveStatic({ root: './dist' }));
  // Single-page app: every non-API route returns index.html so deep links work.
  const indexHtml = readFileSync(resolve(dist, 'index.html'), 'utf8');
  app.get('*', (c) => (c.req.path.startsWith('/api/') ? c.notFound() : c.html(indexHtml)));
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`System Design Masterclass listening on http://localhost:${info.port} (db: ${DB_PATH})`);
});
