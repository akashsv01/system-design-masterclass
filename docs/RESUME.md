# Resume notes

- **Branch:** `claude/gallant-johnson-2xsvdb`. Pushes work; verify `git rev-parse HEAD` = `origin/<branch>` after each push.
- **Decisions in force:** MASTER_PROMPT Amendments 1–4 (Python 3 learner code, visual-first, small required exercises, full curriculum preserved). Lesson rules: `docs/LESSON_GUIDE.md` (step titles ≤ 40 chars, chart notes for units/illustrative data, narrow layouts).

## State (2026-11-18)
- **Curriculum:** 124 topics; all have explanation, worked example, exercise, assessment (0 planned). Status is computed (`src/content/curriculum.ts`); "verified" only via `scripts/review-lessons.cjs --write-verification`; "reviewed" only by humans (`src/content/reviews.json`, empty).
- **Content:** 3 custom lessons + 85 generic lessons (`src/content/lessons/*.ts`), 9 labs (`src/ui/labs/Labs.tsx`, sims in `src/sim/labs.ts`), 31 cases (17 HLD + 14 LLD; paired: booking, notifications, live scores) in `src/content/cases/`, GoF reference (23) at `/patterns`, capstone at `/capstone/capstone`.
- **Practice:** `/practice` (revision due, fresh exercises for gaps), `/interview` (workspace, timer, hints, changed requirement, rubric), `/progress` (mistake notebook, spaced revision, export/import), `/coverage`.
- **Accounts/sync:** `server/*` (Hono + node:sqlite), `src/progress/*`.

## Last verified
- `npm test` 38 · `npm run test:py` 73 · typecheck · build · `npm run audit:content` 0 errors · **124/124 topics verified** (both sizes).
- e2e 25/25 (server needs `AUTH_ATTEMPTS_PER_15MIN=1000` for repeated runs) · a11y: no serious/critical axe violations, keyboard path OK. Full audit in `docs/DESIGN_REVIEW.md` (Review 3).

## Known gaps
- Primary-source sites blocked → all sources `checked: false`.
- No human editorial review yet.
- No public deployment (needs owner authorisation); Dockerfile + README instructions exist.

## Next acceptance criteria
1. Human editorial review of lessons (record in `src/content/reviews.json`), starting with the first-booking journey.
2. Verify sources against primary texts once those domains are reachable; set `checked: true` only after reading.
3. Owner-authorised deployment (Dockerfile ready); configure HTTPS, persistent `DATABASE_PATH`, backups.
4. Ongoing: deepen weaker lessons found in review; add more fresh problems per lab.
