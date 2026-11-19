# System Design Masterclass — notes for Claude sessions

Start every session by reading, in order:
1. `docs/RESUME.md` — current branch, last verified work, known failures, next acceptance criterion.
2. `docs/MASTER_PROMPT.md` — the governing Revamp Brief (2026-11-19) plus reconciliation with the earlier spec
   (`docs/SPEC_2026-11-18.md`).
3. `docs/DESIGN.md` — reference observations and the design decisions they drive.
4. `docs/COVERAGE.md` — generated curriculum coverage report (`npm run coverage:report`).

Then run `git status` and `git log --oneline -15` and reconcile with RESUME.md before continuing.

Layout: `shared/` (client/server contracts), `server/` (Hono + node:sqlite API), `src/content/` (curriculum
manifest + lesson data), `src/sim/` (pure deterministic simulations), `src/assessment/`, `src/progress/`
(local-first store + sync), `src/ui/` (React rendering). Keep these separated.

Learner language: **Python 3 only** (MASTER_PROMPT Amendment 1). Learner code lives in `python/` and is verified with
pytest; the site imports those files as raw text so what learners read is what is tested. The site itself is TypeScript/React.

Rules: develop on the branch named in RESUME.md; commit and push after each verified increment and update
RESUME.md; never mark content "reviewed" — only a human reviewer can; never invent citations.
Verify: `npm test`, `(cd python && python3 -m pytest -q)`, `npm run typecheck`, `npm run build`, `npm run audit:content`, `npm run e2e`.
