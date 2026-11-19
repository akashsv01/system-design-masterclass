# Resume notes

- **Branch:** `claude/dazzling-bohr-89a9c9` (revamp, based on `claude/gallant-johnson-2xsvdb` @ `5a80971`). Verify `git rev-parse HEAD` = `origin/<branch>` after each push.
- **Governing brief:** Revamp Brief (2026-11-19) at the top of `docs/MASTER_PROMPT.md`. Earlier spec: `docs/SPEC_2026-11-18.md`.

## Revamp progress (2026-11-19)
- [x] Audit of running product (desktop + mobile), brief findings reproduced → `docs/DESIGN_REVIEW.md` Review 4
- [x] Reference re-study → `docs/DESIGN.md` §1b, decisions D12–D18
- [x] Fix misleading exercises / broken flows: fan-out independence + correlated case; throughput 2,400/s; LRU lab (graded eviction puzzles, fresh cache states, confidence separate); cases guided vs independent; booking race one primary action; upright layer labels; replica-lag copy choice at 10:00:01 (write 10:00:00, copy 10:00:02)
- [x] Design system: tokens, self-hosted fonts (Inter / Source Serif 4 / JetBrains Mono), SVG icon set, buttons/segmented/choices states, placeholders, metrics strip
- [x] Screens: Home (first visit: question + teaser + Start from scratch; return: exact step), Topics (search, module chips, 124 unique “You decide” lines in `src/content/decisions.ts`, audited), Practice (one recommendation + reason, useful empty states), Progress (can-do from evidence, notebook, schedule, self-assessment apart), Interview picker
- [x] One primary action in the control row; `reachable` gating (keys, step list, Next); click lock
- [x] Evidence model (`src/progress/evidence.ts`): first-attempt outcomes, required checks per topic, revision rounds, self-assessment under `self:`; capstone has 2 graded transfer checks
- [x] e2e 41/41 (`scripts/e2e.mjs`): adds gating, double-click, LRU fresh states, confidence separate, independent case hides reference, rubric never marks solved, retry → hinted
- [ ] Curriculum + sources audit
- [ ] Final verification (tests, e2e, a11y, screenshots, recording)
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
