# Resume notes

- **Branch:** `claude/dazzling-bohr-89a9c9` (revamp; based on `claude/gallant-johnson-2xsvdb` @ `5a80971`). After each
  push, verify `git rev-parse HEAD` = `git rev-parse origin/claude/dazzling-bohr-89a9c9`.
- **Governing brief:** Workbench Brief (2026-11-20) in `docs/MASTER_PROMPT.md`. Earlier: `docs/SPEC_2026-11-19.md`
  (Revamp Brief), `docs/SPEC_2026-11-18.md` (original + Amendments 1–4).
- **Workbench baseline:** `main` @ `ce05e7d` (2026-11-20). Critique #1 and measured find-and-return test:
  `docs/DESIGN_REVIEW.md` Review 6; captures `docs/screens/baseline-2026-11-20/`.

## Interview simulator (active, 2026-11-20) — brief in `docs/INTERVIEW_BRIEF_2026-11-20.md`
Baseline: `main` @ `ce05e7d` (unchanged since). Play-through of case-ticket-booking (HLD) and lld-parking-lot (LLD) at
1280 and 390 (captures in the session scratchpad, findings in `docs/DESIGN_REVIEW.md` Review 7).
- [x] Baseline play-through and findings
- [ ] Engine: script schema, design graph + undo, follow-up rules, sims (trace/failure, timeline, states, data model, queue, roles), tests
- [ ] Workspace builder (palette, drag, handles, tap “Connect to”, labelled direction, undo/redo, auto-arrange, keyboard list)
- [ ] Session shell (interviewer brief, clarify/assume, guided vs mock, help ladder, my design vs worked solution, debrief, mobile tabs, resume, v1 record migration)
- [ ] Exemplars end to end: case-ticket-booking (HLD) and lld-booking (LLD)
- [ ] Remaining 29 cases carried through; interview audit in `audit:content`
- [ ] Journeys in e2e (desktop + 390), a11y, screenshots, docs, push

### Authoring tools (installed 2026-11-20; not site dependencies — nothing added to package.json)
| Tool | State | Notes |
|---|---|---|
| Figma plugin | Installed (`figma@synced` 2.2.211, skills load) | MCP `mcp.figma.com` refused by the environment network policy and needs the owner's Figma sign-in: connect Figma at claude.ai/customize/connectors, then start a new session. |
| Impeccable 4.10.0 | Skill + 5 agents copied to `.claude/` from the GitHub source (the installer's bundle host impeccable.style is unreachable); engine binary runs; design hook enabled locally (`.claude/settings.local.json`, not committed) | Use `.claude/skills/impeccable/scripts/impeccable detect --json --changed` and `shot`. |
| motion-design (richtabor/agent-skills) | `.claude/skills/motion-design` | Duration/easing tokens adopted in `styles.css`. |
| reference-to-motion (charlie947/motion-graphics-skills) | `.claude/skills/reference-to-motion` | Needs a reference recording; none supplied yet. |
| huashu-art-motion | `.claude/skills/huashu-art-motion` (26 MB, git-ignored; restore with `npx skills experimental_install`) | Used for storyboards (`docs/STORYBOARDS.md`); its renderer needs uv + ffmpeg. |
Skills installed mid-session load in the next session; this session applies them by reading their SKILL.md files.

## Workbench progress (2026-11-20) — paused after the outline model (`9cd02ad`)
- [x] Baseline run, newcomer find-and-return test, captures at 1280/820/390/360, critique #1 (design-critique skill + Fable reviewer; Impeccable not installed)
- [x] Reference navigation study; two compositions (home, reader) explored and chosen
- [~] Category → Module → Lesson outline in the manifest (done, audited); navigator (sidebar, drawer, search, memory, resume); prev/next lesson
- [ ] Homepage experiment carried into lesson 1; previews; mobile composition
- [ ] Reader/identity pass; quantitative lesson, lab, independent case; labs/practice/interview/progress; critique #2
- [ ] Verification (navigation acceptance test, e2e, a11y, widths, themes, motion), docs, push
- **Cloud environment:** personal environment `system-design-masterclass` (allows primary-source hosts and the design
  reference; setup script `npm ci`, unproven until a fresh session starts on it). The Default environment still only
  allows the design reference.

## Revamp status (2026-11-19)

Done and verified (details in `docs/DESIGN_REVIEW.md` Reviews 4–5):
- Audit of the running product; all brief findings reproduced live (Review 4) with before-screenshots in `docs/screens/before/`.
- Reference re-study (`docs/DESIGN.md` §1b) → decisions D12–D18.
- Design system: tokens (light/dark), self-hosted Inter / Source Serif 4 / JetBrains Mono, SVG icon set, full
  interaction states, segmented controls, metrics strip / lab readouts, placeholders, upright layer view.
- Reader: one primary action in the control row, `reachable` gating (Next, → key, step list), click lock per action
  family, step list, caption entrance keyed by step with a stable live region, page fade-in, scroll to top on navigation.
- Misleading/broken items fixed: fan-out independence (+ correlated case); throughput overload numbers; LRU lab
  (graded eviction puzzles from stated cache states, fresh states, confidence separate); cases guided vs independent
  (reference hidden until the learner saves); booking race single primary action; layer labels upright; replica-lag
  benchmark (write 10:00:00, copy 10:00:02, learner chooses the copy at 10:00:01); payment-retry readout; availability
  opening; backpressure longest wait; LB rounding.
- Evidence model (`src/progress/evidence.ts`): first-attempt outcomes per required check, revision rounds,
  self-assessment under `self:` (rubrics, short answers, confidence, interviews never raise a status).
- Screens: Home (first visit / return visit), Topics (search, module chips, 124 audited “You decide” lines),
  Practice (one recommendation + reason), Progress (can-do, notebook, schedule, self-assessment apart), Interview picker.
- Paired cases: “who guarantees what” tables checked against the tested Python.
- Sources: 17 cited sections read and marked with `v()`; three wordings fixed (`docs/SOURCES_AUDIT.md`). Coverage
  report separates implementation / technical verification / source verification / human review.
- Every worked formula and numeric check re-derived by hand.

## Last verified (this session, final build)
- `npm test` 40/40 · `npm run test:py` 73/73 · typecheck · build · `npm run audit:content` 0 errors
- e2e 41/41 (`scripts/e2e.mjs`, fresh DB, `AUTH_ATTEMPTS_PER_15MIN=1000`)
- a11y: 17 pages, light and dark, no serious/critical axe violations; keyboard path; reduced motion
- Full-course layout review: 124 topics / 1,350 steps at 1280×900 and iPhone 13; the 27 topics flagged for a truncated
  Next label re-run after the fix with 0 issues (`src/content/verification.json`)
- Recording `docs/screens/after/transitions.webm` (+ frame sheets) watched at normal speed; one issue found and fixed
  (caption hidden after an in-step action). Before/after index: `docs/DESIGN_REVIEW.md` Review 5.

## Known gaps
- No independent human editorial review (`src/content/reviews.json` empty).
- Books not accessible: their citations stay unchecked. Google papers and several docs are reachable but not yet read.
- No public deployment (needs owner authorisation). Dockerfile and README instructions exist.
- Production accounts/sync verified only in the local setup (SQLite, `INSECURE_COOKIES=1` over HTTP); HTTPS cookies,
  backups and multi-instance storage are documented but unverified.
- Mobile checks used Chromium's iPhone 13 emulation, not Safari on a real device.
- The new environment's setup script (`npm ci`) is unproven until a fresh session starts on that environment.

## Next actions
1. Human editorial review, starting with first-booking, latency, lab-lru and case-notifications (record in `reviews.json`).
2. Read the remaining reachable sources in `docs/SOURCES_AUDIT.md` and mark each with `v()` only after comparison.
3. Owner-authorised deployment.
