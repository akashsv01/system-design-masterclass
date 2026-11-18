# Resume notes

- **Branch:** `claude/gallant-johnson-2xsvdb`. Pushes work; verify `git rev-parse HEAD` = `origin/<branch>` after each push.
- **Decisions in force:** MASTER_PROMPT Amendments 1–4 (Python 3 for learner code, visual-first, small required exercises, full curriculum preserved). Lesson rules: `docs/LESSON_GUIDE.md`.

## Last verified (2026-11-18)
- `npm test`: 26 vitest tests (server accounts/sync/isolation/idempotency/conflicts; simulations).
- `npm run test:py`: 18 pytest tests (LRU both versions, booking, read routing, blank-fill answers + negative control).
- `npm run typecheck`, `npm run build`: pass.
- `npm run audit:content`: 0 errors. 123 topics: 3 verified, 0 implemented, 120 planned (honest computed status).
- `node scripts/e2e.mjs`: 22/22 (deep link, guest refresh, guest→account migration incl. drawing, second-browser resume, conflict keeps both, offline→pending→sync, account isolation, shared-device sign-out, in-browser Python blank pass/fail).
- `node scripts/review-lessons.cjs … --write-verification`: first-booking, replica-lag, lru-cache verified at 1280 px and 390 px. Design review in `docs/DESIGN_REVIEW.md`.

## Built
- Slice lessons (custom): `src/ui/lessons/{FirstBooking,ReplicaLag,LruCache}.tsx`.
- Generic reader: `src/ui/lessons/GenericLesson.tsx` with visuals diagram / timeline / chart / compare / layer stack, optional experiment control, per-step Python reveal, practice (choice, numeric, order, line-pick, short answer).
- Activities: `src/ui/components/Exercise.tsx` (ShortAnswer, LinePick, FillBlank via Pyodide worker `public/py-worker.js`).
- Accounts and sync: `server/*`, `src/progress/*`. Progress page with mistake notebook, spaced revision, export/import.

## Placeholders (not built yet)
- `src/ui/pages/{CaseStudy,Patterns,Practice,Interview,Capstone,Coverage}.tsx`, `src/ui/labs/LabRouter.tsx`.
- No generic lessons authored yet (`src/content/lessons/index.ts` is empty).

## Known gaps / blockers
- Primary-source sites are blocked by the network policy, so every source is `checked: false`.
- No human review yet (`reviews.json` empty).

## Next acceptance criterion
Author generic lessons in recommended-route order (start → bridges → foundations → data → distributed → architecture → LLD), each with a chosen visual format, worked example, checks and a short exercise. Each must pass `audit:content` and `review-lessons.cjs --write-verification` at both sizes. Then build Labs, Cases (with three paired HLD/LLD cases), Patterns reference (23 GoF), Practice/Interview workspace, Capstone, Coverage page.
