# Design review log

Reviews here were done by the authoring agent from real browser screenshots (1280×900 and iPhone 13, 390×844)
and automated checks. **None of them is an independent human review**, and `src/content/reviews.json` stays empty
until a person reviews a lesson.

## Review 1 — first slice (2026-11-18)

**Question:** Can someone who knows only basic programming follow the animation, explain what changed, and predict
what happens next?

| Lesson | Follow the animation? | Explain what changed? | Predict next? | Evidence |
|---|---|---|---|---|
| first-booking (guided trace) | Mostly yes. Each Next moves one message along one edge, and the edge stays lit afterwards. | Yes. The database node keeps a `was: available` tag, and the caption's "What changed" list repeats it in words. | Yes. A prediction gates the race (step 8), and the race plays one event at a time. | Screens 1–12 at both sizes. e2e: prediction, race and draft persistence. |
| replica-lag (timeline) | Yes. The clock is the only thing that changes between steps 3 and 4, apart from the copy arriving. | Yes. "Leader: Sam → Alex" and a "behind" tag on the follower. | Yes. The prediction gates the read trace, and the experiment changes one input at a time. | Screens 1–5 at both sizes. |
| lru-cache (behaviour → code) | Yes. Items slide between fixed slots, and the evicted item fades out. | Yes. "A: least recent → most recent". | Yes. Predicting the eviction gates the reveal. | Screens 1–6 at both sizes. In-browser blank-fill passes and fails correctly (e2e). |

**Problems found and fixed in shared components:**
1. Message tokens rested on top of the node they arrived at, hiding its new value. Arriving tokens now fade out,
   and the edge they travelled stays highlighted (`Diagram`).
2. On phones the vertical diagrams were taller than needed, so the caption fell below the fold. Narrow layouts were
   recompacted (≈390 px tall). Each step change now brings the stage into view under the sticky header (`useStep`).
3. In replica-lag's narrow layout the copy edge between the two databases was ~10 px long, so the copy had no visible
   travel. Reframed as a triangle with a long vertical copy edge.
4. A tag above a top-row node collided with the clock. Tags now flip below the node when there's no room above.
5. "Next: <long name>" wrapped to three lines on phones. On phones the button now has two lines (a small "Next",
   then the name with ellipsis), and the step count shows as "3/12".
6. After answering a prediction, the trace played off screen on phones. Prediction answers now scroll the stage
   into view.
7. The server cached `index.html`, so after a rebuild it served HTML for missing chunks. It now reads it per request
   and returns 404 for missing assets.
8. The Python worker cached the learner's `blank` module, so a corrected answer still failed. The harness now drops
   all learner modules before each run.

**Open concerns for a human reviewer:**
- first-booking step 6 (code step) stacks a snippet, a choice question and a line pick. They appear one at a time,
  but the step is the busiest in the slice.
- Whether "race condition" (step 10) arrives too early for a complete beginner, or exactly when it is needed.

## Review 2: shared layout at real sizes (2026-11-18)

**Method:** live Playwright sessions at 1280×900 and iPhone 13 (390×844). I measured element positions on arrival at each
step (before interacting) and inspected viewport-sized screenshots, not full-page ones.

**Header in the middle of mobile captures:** this was a **screenshot artifact**. In a live browser the sticky header
always sat at 0–56 px. Full-page capture stitches the page and draws the sticky element at the scroll offset.

**Real problems found and fixed in shared components:**
1. The controls were often below the fold: at 1280×900 on most steps, and on phones after prediction questions. The
   control row is now sticky at the bottom of the viewport at every width.
2. On phones the header overflowed and pushed the menu button off screen. The brand text now hides below 440 px.
3. After some step changes the header reappeared over the stage, because the scroll logic measured a hidden header.
   Scrolling now reserves the header's full height. On lessons, the header also tucks away while scrolling down
   and returns on scroll up.
4. The caption body could sit under the sticky controls on desktop. The step-change scroll now brings the caption
   into view when needed.
5. Message tokens covered the label of the node they arrived at. They now stop at 82% of the edge, fade, and leave
   the edge lit.
6. Faint labels: sub-labels and edge labels moved from muted grey to ink-2, edge labels went from 13 to 14 px, and
   dimmed nodes went from 0.38 to 0.55 opacity.
7. Next labels were cut off on phones. They now show "Next" on one line and the step title (up to two lines) below.
8. Crowded charts on phones: series names move into a legend, category labels wrap, mark labels stay inside the
   plot, and axes use round ticks sized to the data (the latency axis went from 0–2k to 0–1.5k).
9. Charts now carry notes for units, the log scale, and illustrative values.
10. Words vs picture: "One shard melts, three idle" contradicted a diagram showing 15% load on each other shard.
    Retitled "One shard overloaded, three with room to spare", and the body now states the numbers.
11. A crash at the practice step of cache-invalidation came from two activities sharing an id and therefore one
    saved record. The ids were fixed, the components hardened, and the content audit now fails on duplicate
    activity ids.

**Automated layout checks added** (`scripts/review-lessons.cjs`): controls fully visible, header not overlapping the
stage, Next label not truncated, app not crashed, no horizontal scroll, diagram text ≥ 12 px. All 51 implemented
lessons pass at both sizes.

**Test infrastructure:** e2e flakiness came from a race on the lazy-loaded lesson chunk and from the auth rate limiter
(working as designed) after repeated runs. The test now waits for the heading, and the limit is configurable
(`AUTH_ATTEMPTS_PER_15MIN`, default 10). e2e passed 22/22 in three consecutive runs.

## Review 3: full product audit (spec §12 step 5, 2026-11-18)

All of the following are automated checks plus the author's own screenshot inspection. None is an independent human review.

| Check | Result |
|---|---|
| Server tests (`npm test`) | 38/38: accounts, CSRF guard, rate limit, sync isolation, idempotent retries, conflict copies, merges, simulations, labs |
| Learner Python (`npm run test:py`) | 73/73: every snippet and worked design shown on the site, blank-fill answers plus a negative control |
| Typecheck and build | pass |
| Content audit (`npm run audit:content`) | 0 errors: prerequisites, cycles, orphans, duplicate ids/titles/routes, broken internal links, answer keys, duplicate activity ids, 23 GoF patterns, scope terms, step-title length |
| Coverage | 124/124 topics verified (rendered every step at 1280×900 and iPhone 13: no console errors, labels ≥ 12 px, controls visible, no header overlap, Next label not truncated, no horizontal scroll) |
| End-to-end (`scripts/e2e.mjs`) | 25/25: public deep link, guest refresh, guest→account migration incl. a drawing, second-browser resume, conflicting edits keep both, offline → pending → sync, account isolation, shared-device sign-out, in-browser Python pass/fail, interview persistence, capstone surprise step |
| Accessibility (`scripts/a11y.mjs`) | No serious or critical axe-core violations on 14 representative pages, light and dark. Keyboard-only: Tab reaches Next with visible focus; Enter and → advance |
| Determinism | Lab simulations are seeded and pure (equality tests in `tests/labs.test.ts`) |

**Fixed during this audit:** light-theme muted text was below 4.5:1 contrast (darkened the token). The diagram workspace shrank to 7 px labels on phones (it now sizes its canvas to its container).

**Outstanding:** sources unverified against primary texts (blocked domains), no human editorial review, no public deployment (owner authorisation needed).

## Review 4: revamp audit of the running product (2026-11-19)

**Method:** production build on `claude/gallant-johnson-2xsvdb` @ `5a80971`, served locally. Playwright at 1280×900
and iPhone 13 (390×844), viewport-sized captures unless noted. Before-screenshots: `docs/screens/before/`.
All findings below were reproduced live before any fix. Author review only, not independent human review.

### Brief findings, reproduced

| # | Brief finding | Reproduced? | What I saw |
|---|---|---|---|
| B1 | Booking race: event button and lesson navigation compete | **Yes** | Step 9 has an in-stage primary "Next event ▸" *and* a disabled primary "Play the race to the end" in the control row. Same pattern at step 2 ("Reserve seat F12" vs disabled "Press Reserve first"). |
| B2 | Rotated layer labels hard to read | **Yes** | Every plate's label and detail rotate with the plate (≈ 35° skew); the selected layer's name is rotated too; the top plate is clipped by the stage at 1280. Rotate buttons are unlabeled glyphs (⟲ ⟳). |
| B3 | Throughput slider is good cause-and-effect | Yes | The slider updates queue and text together. But the lesson's numbers contradict themselves (see A3). |
| B4 | Fan-out exercise lacks the independence assumption | **Yes** | The predict prompt and the 20-call numeric check omit "independently"; the assumption appears only on a later step's model note. No correlated counter-case. |
| B5 | LRU lab "New puzzle" flow | **Yes, broken** | The final step tells you to "press New puzzle below", but that button renders only after you answer a Yes / Not yet question, which is a confidence poll with no correct answer, stored as a quiz. The opening prediction is ungraded and has two choices (the answer and its reverse). |
| B6 | Notification cases show the worked design while asking for yours | **Yes** | The reference architecture diagram renders above every stage's "Write before you look" box. No independent mode. |
| B7 | Catalog descriptions are similar | **Yes** | All 17 HLD cases read "Work from an ambiguous prompt to a defended design: X." All 14 LLD cases read "Decide responsibilities, states and invariants for X; read the worked Python design…". The catalog is one 13,000 px list. |
| B8 | Mobile: crowded charts, cut-off action text, sticky-header overlap | **Partly** | In live viewports: no sticky-header overlap (full-page captures draw the sticky bar mid-page, an artifact). No cut-off action text in the control row. Real problems: the step caption sits below the fold on most phone steps, and the stage reserves space for hidden nodes, so step 1 is one small box in a ~500 px frame. |

### Additional problems found

| # | Problem | Severity |
|---|---|---|
| A1 | **Required predictions and actions can be skipped**: → key advances past a disabled Next (latency step 3, booking step 2), and the "Jump to" step buttons reach the race without a prediction. | High (breaks predict-then-observe) |
| A2 | **Evidence inflation**: a check answered wrong and then retried after the right answer was highlighted still raises the topic to "solved independently"; one correct check out of several is enough; ticking your own short-answer checklist, rating yourself "Strong" on a case rubric, or finishing an interview with all-Strong self-ratings all count as "solved independently". | High (brief §10) |
| A3 | Throughput lesson: opening asks whether 2,000 req/s breaks a server whose capacity (300 slots ÷ 0.15 s) is exactly 2,000/s; "Past the limit, the queue only grows" shows a growing queue at 2,000/s while saying the server is "exactly full". | Medium (inaccurate) |
| A4 | Desktop 1280×900: step 1 caption is hidden behind the sticky controls; the lesson title wraps to two lines at 66ch. | Medium |
| A5 | Node icons are Unicode glyphs (▯ ▣ ⛁ ⚡ ☰ ◆ ◎ ⇉) that read as missing-character boxes; theme and menu icons are ☾ ☰ glyphs. | Medium (finish) |
| A6 | Booking lesson breadcrumb says "Foundations" though it is in "Start here". | Low |
| A7 | Practice: "Nothing due right now" and "No gaps recorded yet" with no recommended activity; labs listed with their objectives only. | Medium (brief §4, §10) |
| A8 | Home shows the same 11-module list to first-time and returning learners; the returning card says "Pick up at step N" without naming the step. | Medium |
| A9 | Phone header sync chip reads "● · Sign in". | Low |

## Review 5: revamp verification (2026-11-19)

Automated checks plus the author's own inspection of screenshots and a recording. Not an independent human review.

| Check | Result |
|---|---|
| Unit and simulation tests (`npm test`) | 40/40 (adds deterministic LRU eviction puzzles) |
| Learner Python (`npm run test:py`) | 73/73 |
| Typecheck, build, content audit | pass; audit 0 errors (adds missing/duplicate catalog decision lines) |
| End-to-end (`scripts/e2e.mjs`, fresh DB) | **41/41**: adds step gating (→ key, step list), double-click on the race, LRU fresh cache states and separate confidence, independent case hides the reference, rubric ratings never mark solved, retry after a miss → solved with help |
| Accessibility (`scripts/a11y.mjs`) | 17 pages × light and dark: no serious/critical axe violations; keyboard-only walk with visible focus; reduced motion opens the layered view flat with ~0 ms transitions |
| Full-course layout review (`scripts/review-lessons.cjs`, every step, 1280×900 and iPhone 13) | 124 topics, 1,350 steps: no console errors, no blocked steps, no header overlap, no horizontal scroll, no diagram text under 12 px. 32 “Next label truncated” cases (31 phone, 1 desktop) → controls compacted, labels allowed 3 lines on phones / 2 on desktop → re-run of the 27 flagged topics: 300 steps, 0 issues |
| Recording (`docs/screens/after/transitions.webm`, 78 s, normal speed; frame sheets `frames-*.webp`) | Request tokens travel, rest short of the target, fade in ~0.4 s and leave the edge lit; the race advances one event per click; layers pull apart and turn with upright labels; the replica read and the 10:00:02 copy are in sync with the clock. **Found only in the recording:** after an in-step action (Reserve) the longer caption slid under the sticky controls at 1280×800, because keep-in-view ran only on step changes. Fixed (`keepInView()` after every primary action); measured afterwards: caption bottom 723 px, controls top 731 px. |

### Before and after

| Before (`docs/screens/before/`) | After (`docs/screens/after/`) | What changed |
|---|---|---|
| `desk-home` | `desk-home`, `desk-home-returning`, `phone-home` | A concrete first question with the scenario drawn; returning learners get the exact step |
| `desk-first-booking-01`, `phone-first-booking-02` | same names, `desk-first-booking-race` | Placeholders instead of an empty stage; one primary action; caption kept in view |
| `desk-inside-a-request-02`, `phone-inside-a-request-03` | same names, `reduced-desk-inside-a-request-02` | Upright labels with leader lines; flat list under reduced motion |
| `phone-latency-03b` | `desk-latency-03` | Independence stated in the question; correlated case explained |
| `desk-throughput-bandwidth-04` | same name | Overload numbers consistent (2,400/s against a 2,000/s ceiling) |
| `desk-case-notifications` | same name, `desk-case-notifications-independent` | Guided vs independent; reference hidden until the learner saves |
| `desk-practice` | `desk-practice`, `desk-progress`, `desk-topics`, `phone-topics` | One recommendation with a reason; evidence vs self-assessment; decision lines |
| — | `desk-lab-lru`, `desk-lab-payment-retries`, `dark-phone-lab-load-balancing` | Lab readouts; graded fresh cache states |
| — | `desk-interview-session` | Sketch and notes side by side |

### Not verified
- Independent human editorial review (none yet).
- Production deployment: HTTPS cookies, persistent storage and backups (local setup only).
- Real devices: all mobile checks used Chromium's iPhone 13 emulation, not Safari on iOS.

## Review 6: Workbench brief, critique #1 of the baseline (2026-11-20, `main` @ `ce05e7d`)

Tools: the `design:design-critique` skill (Impeccable is not installed in this environment or its plugin catalog),
plus an independent critique by a Fable model reviewer working only from the screenshots in
`docs/screens/baseline-2026-11-20/` (1280, 820, 390 and 360 px). The two agreed on every major point.

**Newcomer find-and-return test (measured).** Midway through `caching` (step 3), the only route to another lesson is
the header's Topics link → a separate catalog page **11,723 px tall on desktop, 22,330 px on a phone**; “cache
invalidation” sits 3,895 / 7,535 px down. Back×2 restores the step (stored) but not the reading position on the phone
(scrollY 284 → 0). No previous/next lesson, no outline, no “return to where I was”.

| Area | Finding | Severity |
|---|---|---|
| Home | On phones the whole first screen is text: no visual, nothing to try. On desktop the teaser looks interactive but isn’t, and relies on a dashed “?” convention. The first prediction is several clicks in. | High |
| Navigation | No in-lesson navigator; a breadcrumb that doesn’t read as a link; one 124-row catalog page with 12 filter chips (five rows of chips on a phone); no resume entry anywhere outside Home. | High |
| Reader | Sparse stages (three small boxes in a ~930×400 frame); two right edges (stage 930 px, text 710 px); passive “Watch” steps; translucent sticky bar shows body text through it; the question (title) scrolls away. | High |
| Lab | Controls, readouts and chart are the strongest screen, but the experiment explanation sits below the chart, values sit far from their sliders, and the page opens mid-panel. | Medium |
| Practice / Progress / Interview | Newcomers meet rules paragraphs, dashed empty boxes and five identical “Start” rows; export/import outweighs learning on Progress. | Medium |
| Identity | Pleasant but generic course site; the distinctive asset (components with live mono state) is confined to cards. | Medium |
| Accessibility | Small mid-grey wayfinding text (breadcrumb, step count, tags); status dots colour-only and two similar blues; 34–36 px chips and row buttons. | Medium |

**Priorities taken into the redesign:** (1) a tappable prediction in the home hero, carried into lesson 1;
(2) one Category → Module → Lesson navigator (sidebar / drawer) with search and a resume entry; (3) a stage-first
workbench reader that keeps question, visual, explanation and action together; (4) an opaque, compact step bar;
(5) accordion catalog with progress counts; (6) useful first-run states for Practice, Progress and Interview;
(7) status shown by shape and label, larger wayfinding text.
