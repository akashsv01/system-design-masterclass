# Resume notes

- **Branch:** `claude/dazzling-bohr-89a9c9` (revamp; based on `claude/gallant-johnson-2xsvdb` @ `5a80971`). After each
  push, verify `git rev-parse HEAD` = `git rev-parse origin/claude/dazzling-bohr-89a9c9`.
- **Governing brief:** Revamp Brief (2026-11-19) at the top of `docs/MASTER_PROMPT.md`. Earlier spec: `docs/SPEC_2026-11-18.md`.
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

## Last verified (this session)
- `npm test` 40/40 · `npm run test:py` 73 · typecheck · build · `npm run audit:content` 0 errors
- e2e 41/41 (`scripts/e2e.mjs`, fresh DB, `AUTH_ATTEMPTS_PER_15MIN=1000`)
- a11y: no serious/critical axe violations on 17 pages, light and dark; keyboard path; reduced-motion check
- Full-course layout review: see Review 5 in `docs/DESIGN_REVIEW.md`

## Known gaps
- No independent human editorial review (`src/content/reviews.json` empty).
- Books not accessible: their citations stay unchecked. Google papers and several docs are reachable but not yet read.
- No public deployment (needs owner authorisation). Dockerfile and README instructions exist.
- Production accounts/sync verified only in the local setup (SQLite, `INSECURE_COOKIES=1` over HTTP); HTTPS cookies,
  backups and multi-instance storage are documented but unverified.

## Next actions
1. Human editorial review, starting with first-booking, latency, lab-lru and case-notifications (record in `reviews.json`).
2. Read the remaining reachable sources in `docs/SOURCES_AUDIT.md` and mark each with `v()` only after comparison.
3. Owner-authorised deployment.
