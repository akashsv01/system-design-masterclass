# System Design Masterclass

A free, self-paced, interactive course for learning system design from scratch. You step through visual lessons,
make predictions, run small experiments, and practise HLD and LLD for interviews. Everything is public. Signing in
is optional and syncs your saved work across devices.

- Product specification: [`docs/MASTER_PROMPT.md`](docs/MASTER_PROMPT.md) (including amendments)
- Design notes and reference study: [`docs/DESIGN.md`](docs/DESIGN.md), lesson rules: [`docs/LESSON_GUIDE.md`](docs/LESSON_GUIDE.md)
- Curriculum coverage: [`docs/COVERAGE.md`](docs/COVERAGE.md) (generated)
- Where work stands: [`docs/RESUME.md`](docs/RESUME.md)

## Stack

- **Web:** React 18 + TypeScript + Vite, React Router. Lessons are TS modules. Simulations are pure functions in
  `src/sim/`.
- **Server:** Node 22 (≥ 22.13), Hono, SQLite through the built-in `node:sqlite`. It handles email/password
  accounts (scrypt), HTTP-only session cookies, and per-user progress sync with optimistic concurrency and
  idempotent pushes.
- **Learner code:** Python 3 in `python/`, tested with pytest. The site imports those files directly. Learners'
  fill-in-the-blank answers run in the browser with self-hosted Pyodide (no third-party CDN).

## Setup

```bash
npm install
```

Python checks need Python 3.11+ and pytest (`pip install pytest`).

## Develop

```bash
npm run dev
```

This runs the API on :8787 and Vite on :5173 (which proxies `/api`). Open http://localhost:5173.

## Test

```bash
npm test                 # vitest: server (accounts, sync, isolation) + simulations
npm run test:py          # pytest: learner code, snippets, blank-fill answers
npm run typecheck
npm run build
```

End-to-end journeys and visual review need a running production server:

```bash
npm run build && PORT=8787 DATABASE_PATH=data/e2e.db NODE_ENV=production INSECURE_COOKIES=1 npx tsx server/index.ts
```

```bash
node scripts/e2e.mjs http://localhost:8787
```

```bash
node scripts/review-lessons.cjs http://localhost:8787 screenshots-local
```

`e2e.mjs` covers the public deep link, guest refresh, guest-to-account migration (including a drawing),
second-browser resume, conflicting edits, offline/pending/reconnect, account isolation, shared-device sign-out,
and in-browser Python checks.

## Run in production

```bash
npm ci && npm run build
NODE_ENV=production PORT=8787 DATABASE_PATH=/var/lib/sdm/masterclass.db npx tsx server/index.ts
```

- Serve over HTTPS. Cookies are `Secure` in production unless `INSECURE_COOKIES=1`, which is for local testing only.
- `DATABASE_PATH` must be on persistent storage. Back it up, for example with `sqlite3 masterclass.db ".backup ..."`
  on a schedule.
- One process is enough for modest traffic. To run several, move storage to a shared database first, because
  SQLite is single-node.
- A `Dockerfile` is included. No public deployment has been made: that needs the owner's authorisation.
