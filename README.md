# System Design Masterclass

A free, self-paced, interactive course for learning system design from scratch. You step through visual lessons,
make predictions, run small experiments, and practise HLD and LLD for interviews. Everything is public. Signing in
is optional and syncs your saved work across devices.

- Product specification: [`docs/MASTER_PROMPT.md`](docs/MASTER_PROMPT.md) (the governing Revamp Brief, plus the earlier spec in [`docs/SPEC_2026-11-18.md`](docs/SPEC_2026-11-18.md))
- Design notes and reference study: [`docs/DESIGN.md`](docs/DESIGN.md), lesson rules: [`docs/LESSON_GUIDE.md`](docs/LESSON_GUIDE.md)
- Curriculum coverage: [`docs/COVERAGE.md`](docs/COVERAGE.md) (generated); source checks: [`docs/SOURCES_AUDIT.md`](docs/SOURCES_AUDIT.md)
- Where work stands: [`docs/RESUME.md`](docs/RESUME.md)

## What's inside

- 124 topics across foundations, data systems, distributed systems, architecture and operations, LLD, and design
  patterns, all open without sign-in. Each catalog entry names the decision it helps you practise.
- A calm lesson reader: one visual and its explanation at a time, one primary action per moment (the control row
  performs “Reserve”, “Next event”, “Save Alex”…), predictions that must be answered before moving on, a labelled step
  list, upright labels in layered views, and dashed placeholders for parts not introduced yet.
- 9 labs with deterministic simulations and a readout of what each control changes; graded fresh problems; confidence
  recorded separately from skill.
- 31 case studies (17 HLD, 14 LLD; booking, notifications and live scores paired with “who guarantees what”), each in a
  guided walkthrough or an independent attempt with the reference hidden until you save your answer; a searchable
  reference of all 23 GoF patterns; a mock-interview workspace; a capstone with graded transfer checks.
- Honest progress: “solved independently” means every graded check in a topic was right first time with no hint,
  reveal or retry. Rubric ratings and confidence are self-assessment and never count as solved. Mistake notebook,
  spaced revision rounds, and one recommended next activity with a reason.
- Saved progress on the device or synced to an account: steps, drafts, sketches, quiz attempts, interviews, evidence,
  self-assessment, and export/import.

## Stack

- **Web:** React 18 + TypeScript + Vite, React Router. Lessons are TS modules. Simulations are pure functions in
  `src/sim/`. Fonts (Inter, Source Serif 4, JetBrains Mono) are self-hosted from npm; icons are an in-repo SVG set.
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
npm run build && PORT=8787 DATABASE_PATH=data/e2e.db NODE_ENV=production INSECURE_COOKIES=1 AUTH_ATTEMPTS_PER_15MIN=1000 npx tsx server/index.ts
```

```bash
node scripts/e2e.mjs http://localhost:8787
```

```bash
node scripts/review-lessons.cjs http://localhost:8787 screenshots-local
```

`e2e.mjs` covers the public deep link, step gating (keys, step list, double clicks), guest refresh, guest-to-account
migration (including a drawing), second-browser resume, conflicting edits, offline/pending/reconnect, account
isolation, shared-device sign-out, in-browser Python checks, LRU fresh problems, independent case mode, and the
evidence rules (retry after a miss → solved with help; rubric ratings never count).

```bash
node scripts/a11y.mjs http://localhost:8787
```

axe-core on 17 pages in light and dark, a keyboard-only walk, and a reduced-motion check.

```bash
NO_SHOTS=1 node scripts/review-lessons.cjs http://localhost:8787 /tmp/review first-booking labs/lab-lru cases/case-notifications
```

Walks every step of the given topics at desktop and phone sizes, doing each step's required action, and flags
console errors, hidden controls, header overlap, truncated labels, horizontal scroll and diagram text under 12 px.
Without `NO_SHOTS` it also saves screenshots.

## Source verification

Lesson claims are checked against primary texts only where a session can reach them. The cloud environment
`system-design-masterclass` allows the RFC editor, the Raft site, the SRE book, the Builders' Library, Python and
PostgreSQL docs, OSTEP, the Dynamo paper, Google research PDFs, MIT 6.5840 and MDN. Entries read this way are marked
with `v()` in `src/content/sources.ts`; see `docs/SOURCES_AUDIT.md` for what was checked and what was not.

## Run in production

```bash
npm ci && npm run build
NODE_ENV=production PORT=8787 DATABASE_PATH=/var/lib/sdm/masterclass.db npx tsx server/index.ts
```

- Sign-in and registration are rate-limited to 10 attempts per 15 minutes per IP by default (`AUTH_ATTEMPTS_PER_15MIN`). Raise it only for local test runs, which register many accounts.
- Serve over HTTPS. Cookies are `Secure` in production unless `INSECURE_COOKIES=1`, which is for local testing only.
- `DATABASE_PATH` must be on persistent storage. Back it up, for example with `sqlite3 masterclass.db ".backup ..."`
  on a schedule.
- One process is enough for modest traffic. To run several, move storage to a shared database first, because
  SQLite is single-node.
- A `Dockerfile` is included. No public deployment has been made: that needs the owner's authorisation.
