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
