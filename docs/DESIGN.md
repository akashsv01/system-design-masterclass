# Design notes

## 1. Reference study: designed-to-scale.vercel.app

**Access.** The first attempt (2026-11-18) failed: the environment's proxy refused the
tunnel (`CONNECT tunnel failed, response 403`; WebFetch reported `getaddrinfo ENOTFOUND
designed-to-scale.vercel.app`). After the host was added to the allowed domains, it loaded
(HTTP 200) and I studied it in headless Chromium (Playwright). I stepped through every
step of two real lessons, **How a Request Travels** (10 steps, `#/how-a-request-travels/N`)
and **Replication** (11 steps, `#/replication/N`). I took screenshots at 1280×900 and at
iPhone 13 width (390 px). I could not get into the Practice or Design Lab sections from a
scripted click, so these notes cover the lesson reader only.

### What I observed

**Before the animation starts**
- Step 1 is always a **Problem** step: one concrete pain point ("Users say the shop feels
  slow", "One database, doing everything") and a single **Key idea** box. The stage shows
  only the starting component or components (a laptop labelled "you", or one database).
  Nothing else is drawn yet.
- The page has a breadcrumb ("01. Foundations / Lesson 1 of 3"), the title, a one-line
  subtitle, and chips for duration, level, and step count.

**Text per step**
- Each step has a tag (PROBLEM / TECHNIQUE / SOLUTION / RECAP), a short heading, and **2–3
  short paragraphs** (about 40–90 words). After that comes at most **one callout** (Key
  idea / Good to know / Watch out) and a **"What changed"** list of 1–3 items marked
  `+` (added), `~` (changed), and `−` (removed or failed).
- The numbers are real and they add up across steps. DNS takes 20 ms. Two handshake round
  trips take 60 ms. The page is ready at 155 ms. A slow query pushes that to 540 ms, and a
  Sydney user waits 705 ms.

**What changes between steps, and what stays put**
- Components are added one at a time and **keep their positions** in the same isometric
  scene. When more components appear, the camera zooms out so they all fit.
- A **metrics strip** above the stage (DNS / Connect / Request / Download / Total, or
  CPU / Read capacity / Replica lag) fills in as values become known. The field that just
  changed gets a coloured left border.
- Small floating labels sit right on the diagram ("→ 203.0.113.7", "cached · 5 min",
  "name: Alice Lee · 2 s behind"). These do most of the work of pointing your eye.
- Later steps reuse the scene to tell a **case** ("Case: one slow query", "Case: a user in
  Sydney") rather than adding new components.

**How attention is directed**
- On-diagram labels, a coloured border on the changed metric, the "What changed" list,
  and colour-coded tokens (request = orange, response = green, handshake = outline).
- The animation seems to play when you enter a step and then stop. A Replay button
  re-runs it and a Pause button stops it. (Two screenshots taken 700 ms apart, about 2 s
  after entering a step, were identical.)

**Read, watch, predict, interact**
- Inside lessons the learner **reads and watches**. Their only actions are Back, Next,
  Replay, and Pause. I saw no prediction question, no adjustable control, and no
  free-text answer anywhere in the lesson reader.

**Controls and layout**
- Desktop uses three columns: course sidebar (≈220 px), stage (≈740 px), and step text
  (≈270 px) with Back and **"Next: <name of next step>"** at the bottom of the text column.
  A numbered step rail ("In this lesson") runs under the stage. A "You'll learn" checklist
  ticks itself as you go. Keyboard: ← → to step, R to replay, Space to pause.
- At 390 px it becomes one column: header → stage → step rail → Back/Next bar (pinned to
  the bottom of the viewport) → step text → "You'll learn". The diagram is scaled down to
  fit, so its labels come out at roughly **4–5 px** and can't be read. The step text sits
  *below* the stage and the rail, so on a phone you can't see a step's explanation and its
  diagram at the same time. The page scrolls to ≈1380 px per step.

## 2. Decisions for System Design Masterclass

These are my choices. Some follow the reference, some depart from it, and some come from
the product spec.

| # | Decision | Why |
|---|----------|-----|
| D1 | **Keep:** every lesson opens with a concrete problem. It shows only the starting components. | The reference's Problem → Technique → Solution arc gives the learner a reason to care before any machinery appears. |
| D2 | **Keep:** each step gets a short heading, ≤ 3 short paragraphs, at most one callout, and an optional "What changed" list with +/~/− **shapes as well as colour**. | This budget kept every reference step readable at a glance. The shapes keep meaning clear without colour. |
| D3 | **Keep:** stable node positions. A new component appears in a slot reserved from the start, so nothing jumps. The changed element is labelled directly on the diagram. | The reference uses this well. We go a step further and reserve the space up front, so we never need to zoom out. |
| D4 | **Change:** the default is a **single reading column**: title → opening → stage → active-step text → control row. No three-column layout and no permanent course sidebar inside a lesson. The course outline is one click away. | Spec §3. At reference desktop widths the stage, text and sidebar compete. One column keeps the diagram and its caption next to each other. |
| D5 | **Change:** on phones, the **step text sits directly under the diagram**, the control row comes right after the text, and diagrams **switch to a vertical layout** with full-size (≥ 13 px) labels. We never shrink a wide scene. | The reference's mobile diagram shrinks to ~4 px labels and splits the diagram from its explanation. |
| D6 | **Change:** lessons include **predict-then-observe moments**, **one meaningful control** (delay, load, cache size), and saved free-text or drawings. | The reference is watch-only. Our spec requires prediction, interaction, and assessment. |
| D7 | **Keep:** "Next: <next step name>" on the primary button. Keyboard ← → steps and R replays. | It tells the learner what's coming and costs no extra space. |
| D8 | **Keep and tighten:** real numbers that add up. Every formula shows its units and arithmetic, plus one example with a changed input. | Matches the reference's 20 + 60 + … = 155 ms story and spec §5. |
| D9 | **Change:** the animation is **driven by learner actions** ("Save Alex", "Reserve"). Auto-play is optional. The text, diagram, clock and values all come from **one simulation state** per step. | Spec §4. It also makes steps replayable and testable. |
| D10 | **Change:** the step rail is a compact "Step 3 of 7" with Back/Next/Replay. Every step's text stays available through an "Event history" disclosure instead of being on screen all the time. | Keeps the stage calm. History is there when you ask for it. |
| D11 | **Our own visual identity**: warm paper background, deep-ink blue primary, amber for "in flight / delayed", green for "confirmed", red for "failed", each paired with an icon or shape. Flat 2D diagrams (not isometric) in a readable sans/mono pairing. Light and dark themes. | Original identity. Flat diagrams keep labels large and easy to reflow for mobile. |

## 3. Visual system (implemented in `src/ui/styles.css`)

- Type: system UI sans for prose (17 px base, 1.6 line-height, max 66ch), monospace for values and code.
- Colour tokens: `--ink`, `--paper`, `--accent` (primary), `--active` (amber), `--ok` (green), `--fail` (red), `--muted`.
  Every state colour is paired with a shape or text: ● active, ✓ confirmed, ✕ failed, ⧗ delayed.
- Motion: tokens move along edges for 600–900 ms with ease-in-out. Under `prefers-reduced-motion`, tokens jump straight to their end state and only a highlight fades in.
- Focus: a 3 px accent outline with an offset on every interactive element.
- Spacing: an 8 px scale. The stage gets 24–32 px of breathing room. The caption sits 16 px under the stage, so it reads as part of the diagram.

## 4. Lesson formats in use

1. **Guided trace** (first-booking): the learner triggers each request and inspects stored values.
2. **Timeline experiment** (replica-lag): a clock, a prediction, an adjustable delay, deterministic replay.
3. **Behaviour → implementation** (lru-cache): operate the cache, predict which entry gets evicted, then see the map and linked list with synced Java lines.
4. **Generic stepped lesson** (most topics): data-driven steps over a stable diagram with prose, a worked example, a quiz, and an exercise.
