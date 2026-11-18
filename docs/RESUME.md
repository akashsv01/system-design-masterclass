# Resume notes

- **Branch:** `claude/gallant-johnson-2xsvdb` (push works; verify remote HEAD after each push)
- **Decisions in force:** Python 3 is the only learner language (MASTER_PROMPT Amendment 1). Learner code in `python/`, tested with pytest, imported by the site via `?raw`.
- **Last verified:**
  - Server account + sync API: 10 vitest tests pass (isolation, idempotent retry, conflict copies, merge, cursor).
  - Simulations: booking race, seat state machine, replication lag, LRU (16 vitest tests pass).
  - Python LRU (linked list + OrderedDict): 11 pytest tests pass.
  - Reference site studied in a browser; findings in docs/DESIGN.md.
- **Written, not yet run in a browser:** `src/progress/*` (store, sync, provider), `src/ui/components/{Diagram,Lesson,Draft}.tsx`, `src/ui/lessons/FirstBooking.tsx`, curriculum manifest + status computation.
- **Not started:** app shell/routes (`src/main.tsx`, `src/ui/App.tsx`), ReplicaLag + LRU lesson components, generic lesson reader, coverage report script, e2e script.
- **Known blockers:** primary-source sites (rfc-editor, postgresql.org, sre.google, AWS, OSTEP…) are blocked by the network policy, so sources are recorded as `checked: false` pointers.
- **Next acceptance criterion:** `npm run build` succeeds and `/learn/first-booking`, `/learn/replica-lag`, `/learn/lru-cache` render every step at 1280 px and 390 px with no console errors; guest progress survives refresh.
