# System Design Masterclass — notes for Claude sessions

Start every session by reading, in order:
0. `docs/DESIGN_MOTION_INSTRUCTIONS_2026-11-20.md` — standing project-wide design and motion instructions (verbatim).
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

## Design and motion conventions (inherit these; from the 2026-11-20 project-wide instructions)
- One identity everywhere: tokens in `src/ui/styles.css` (`--paper/--surface/--ink/--accent/--active/--ok/--fail`, light + dark),
  Inter for UI, Source Serif 4 for headings and the interviewer's question, JetBrains Mono for values and readouts.
  Colour always has a second signal (label, icon or shape): selected = ring + name in the toolbar; direction = arrowhead;
  success = check + word; failure = cross/dashed + word. Visible focus ring on every control.
- Each screen has a job: home = discovery (one real interaction, “Start learning”, curriculum, “Continue at …”);
  lesson reader = concentration (one question, one visual focus, explanation beside it); interview/practice canvas = room to build.
- Motion tokens (motion-design skill): `--dur-1` 120 ms (press, hover, small feedback), `--dur-2` 180 ms (popovers,
  chips, panels entering), `--dur-3` 240 ms (drawers, sheets), `--ease-out` `cubic-bezier(.165,.84,.44,1)` for enters,
  exits ~25% faster; `--ease-in-out` `cubic-bezier(.645,.045,.355,1)` for on-screen moves. Repeated actions (add, connect,
  expand, step) stay ≤ 180 ms. Teaching motion (a request crossing services, a queue growing, two operations racing) runs
  600–900 ms per beat, is driven by one simulation state, and is always learner-controlled: pause, step, replay, change
  the input. Under `prefers-reduced-motion` nothing travels: show the end state, highlight what changed, label it.
- Storyboard explanatory sequences first (`docs/STORYBOARDS.md`, huashu-art-motion shot-list style), then build them as
  live scenes the learner can edit and replay — never as video.
- Every screen designs its loading, empty, error and resume states. Guests can do everything; say where work is saved
  (“on this device” vs “synced”) and what signing in adds. Returning learners land on their exact step / exercise / design.
- Authoring tools (not site dependencies): Figma (file “SDM — Interview simulator workspace”, key in docs/RESUME.md),
  Impeccable (`.claude/skills/impeccable/scripts/impeccable detect --json --changed`, `shot`), motion-design,
  reference-to-motion, huashu-art-motion (`.claude/skills/`). Review implemented screens at 1280 and 390 px.
