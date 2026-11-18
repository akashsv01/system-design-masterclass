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
