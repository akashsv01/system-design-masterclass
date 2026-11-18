# Resume notes

- **Branch:** `claude/gallant-johnson-2xsvdb`. Pushes work; verify `git rev-parse HEAD` = `origin/<branch>` after each push.
- **Decisions in force:** MASTER_PROMPT Amendments 1–4 (Python 3 for learner code, visual-first, small required exercises, full curriculum preserved). Lesson rules: `docs/LESSON_GUIDE.md`.

## Last verified (2026-11-18)
- `npm test`: 27 vitest tests. `npm run test:py`: 49 pytest tests. `npm run typecheck` / `npm run build`: pass.
- `npm run audit:content`: 0 errors. **123 topics: 63 verified, 60 planned.**
- e2e (`scripts/e2e.mjs`): 22/22 in three consecutive runs (server started with `AUTH_ATTEMPTS_PER_15MIN=1000`).
- Visual review (`scripts/review-lessons.cjs`, arrival-time layout checks at 1280×900 and iPhone 13): all 63 implemented lessons pass. Reviews 1–2 in `docs/DESIGN_REVIEW.md`.

## Built
- Slice lessons (custom): `src/ui/lessons/{FirstBooking,ReplicaLag,LruCache}.tsx`.
- Generic reader: `src/ui/lessons/GenericLesson.tsx` with visuals diagram / timeline / chart / compare / layer stack, optional experiment control, per-step Python reveal, practice (choice, numeric, order, line-pick, short answer).
- Activities: `src/ui/components/Exercise.tsx` (ShortAnswer, LinePick, FillBlank via Pyodide worker `public/py-worker.js`).
- Accounts and sync: `server/*`, `src/progress/*`. Progress page with mistake notebook, spaced revision, export/import.

## Placeholders (not built yet)
- `src/ui/pages/{CaseStudy,Patterns,Practice,Interview,Capstone,Coverage}.tsx`, `src/ui/labs/LabRouter.tsx`.
- Generic lessons authored for: start, bridges, foundations, data, distributed, architecture (`src/content/lessons/*.ts`).

## Known gaps / blockers
- Primary-source sites are blocked by the network policy, so every source is `checked: false`.
- No human review yet (`reviews.json` empty).

## Next acceptance criterion
1. LLD lessons (12) + pattern refactoring lessons (7) in Python, each passing audit + review at both sizes.
2. `/patterns` page: searchable reference of all 23 GoF patterns (custom lesson `gof-reference`).
3. Labs (9) with prediction, control, consequence, fresh problem, deterministic replay.
4. Case library: 17 HLD + 13 LLD cases (3 paired: booking, notifications, live updates) on the case format.
5. Practice, interview workspace (diagram, notes, estimates, hints, timer, rubric), capstone, coverage page.
