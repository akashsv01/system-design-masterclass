# Resume notes

- **Branch:** `claude/gallant-johnson-2xsvdb`. Pushes work; verify `git rev-parse HEAD` = `origin/<branch>` after each push.
- **Decisions in force:** MASTER_PROMPT Amendments 1–4 (Python 3 learner code, visual-first, small required exercises, full curriculum preserved). Lesson rules: `docs/LESSON_GUIDE.md` (step titles ≤ 40 chars, chart notes for units/illustrative data, narrow layouts).

## State (2026-11-18)
- **Curriculum:** 124 topics; all have explanation, worked example, exercise, assessment (0 planned). Status is computed (`src/content/curriculum.ts`); "verified" only via `scripts/review-lessons.cjs --write-verification`; "reviewed" only by humans (`src/content/reviews.json`, empty).
- **Content:** 3 custom lessons + 85 generic lessons (`src/content/lessons/*.ts`), 9 labs (`src/ui/labs/Labs.tsx`, sims in `src/sim/labs.ts`), 31 cases (17 HLD + 14 LLD; paired: booking, notifications, live scores) in `src/content/cases/`, GoF reference (23) at `/patterns`, capstone at `/capstone/capstone`.
- **Practice:** `/practice` (revision due, fresh exercises for gaps), `/interview` (workspace, timer, hints, changed requirement, rubric), `/progress` (mistake notebook, spaced revision, export/import), `/coverage`.
- **Accounts/sync:** `server/*` (Hono + node:sqlite), `src/progress/*`.

## Last verified
- `npm test` 38 vitest · `npm run test:py` 73 pytest · typecheck · build · `npm run audit:content` 0 errors.
- e2e 22/22 ×3 runs (server needs `AUTH_ATTEMPTS_PER_15MIN=1000` for repeated runs).
- Visual review: 70 topics verified at 1280×900 and iPhone 13 (arrival-time checks). New labs/cases/patterns/LLD2 review in progress at time of writing.

## Known gaps
- Primary-source sites blocked → all sources `checked: false`.
- No human editorial review yet.
- No public deployment (needs owner authorisation); Dockerfile + README instructions exist.

## Next acceptance criteria
1. Finish verification of labs, cases, patterns, LLD2 lessons; fix any layout issues found.
2. e2e: interview workspace persistence (add box → reload → still there) and capstone flow.
3. Full audit pass (Step 5 of the spec): links, code examples, determinism, accessibility (keyboard path through a lesson, axe-style checks), account isolation, mobile flows; record results in `docs/DESIGN_REVIEW.md`.
