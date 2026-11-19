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

## 1b. Reference re-study (2026-11-19)

**Access.** Reachable this session (HTTP 200). I stepped through every step of **Latency & Throughput**
(10 steps) and **HLD & LLD** (8 steps) in headless Chromium at 1280×900 and iPhone 13 (390 px). The site now has
40 lessons in 9 sections, plus Practice, Design Lab and Cheatsheets tabs. As in the first study, scripted clicks on
Practice and Design Lab did not change the view, so these notes again cover only the lesson reader.

### What changed since the first study, and what I observed

- **Step text lives in a right-hand column** (≈ 270 px) beside the stage at desktop: tag (PROBLEM / SOLUTION …),
  heading, 2 short paragraphs (≈ 60–110 words), one callout ("Watch out", "Good to know"), then **What changed**
  as before→after values: "Users 7,000 → 9,600", "Utilization 70% → 96%", "p99 latency 600 ms → 4.2 s". Back and
  "Next: <step name>" sit at the bottom of that column with a keyboard hint row (← → step · R replay · Space pause).
- **A metrics strip** (p50, p99, throughput, utilization) sits on top of the stage. Changed metrics get a red left
  border. The strip and the "What changed" list carry the same numbers, so the eye can check one against the other.
- **An inset chart** ("latency vs. how busy") sits in a corner of the stage and marks the current operating point
  (96%) on the hockey-stick curve. The main scene shows the queue; the inset shows *why* it matters.
- **Stability:** the scene keeps every object in place between steps; the user crowd grows, the queue of dots
  lengthens, one badge (96%) changes. In HLD & LLD, step 4 zooms into one service: the rest of the system is
  removed ("− The rest of the system") and the inside appears as new parts in the same plane.
- **A labelled step rail** under the stage ("1 Two numbers · 2 Busier · 3 Hockey stick …") lets you see the arc
  and jump.
- **Phone (390 px):** one column — header, metrics strip (horizontally scrolling; the 4th metric is cut off),
  stage, legend (cut off: "slow re…"), rail, then a pinned Back / Next bar. The step's explanation is **below the
  fold**; to read it you scroll away from the stage. Labels on the isometric scene are ≈ 6–8 px.
- **Interaction:** still watch-only. Replay and Pause only; no prediction, no learner-controlled input, no answer.

### Decisions this re-study drives (D12–D18)

| # | Decision | Why |
|---|----------|-----|
| D12 | **Keep the explanation in view with the visual** at every width. Single column stays the default (brief §4), but the stage is height-capped so stage + caption + controls fit a 900 px laptop screen, and step changes scroll the stage to just under the header. | The reference solves this with a side column at desktop and fails at it on phones. We solve it the same way at all widths. |
| D13 | **"What changed" shows before → after values** where a value changed (`F12: available → booked · Maya`, `p99 600 ms → 4.2 s`), derived from the same simulation state as the diagram. | The reference's best device for "what should I notice?". |
| D14 | **Metrics strip** for quantitative lessons and labs: 2–4 named values above the visual, the changed one marked by a left rule *and* a "changed" label for non-colour readers. On phones it wraps to two rows instead of scrolling sideways. | Reference clips the strip on phones. |
| D15 | **One primary action per moment.** When the step needs an action (Reserve, Next event, Send request), the control row's primary button *is* that action; once its outcome is visible the button becomes "Next: <step>". No second competing primary inside the stage. | The reference has one action (Next). Our steps also have in-stage actions, which previously competed with a disabled Next. |
| D16 | **Upright labels in layered views.** The 3D stack draws plates in perspective but every label is drawn upright beside its plate with a leader line; the selected layer's name and explanation are always upright. | Rotated plate text was hard to read (ours and the reference's isometric labels). |
| D17 | **Placeholders, not empty stages.** Parts not yet introduced are drawn as dashed outlines with a "?" so the stage never shows one small box in a large empty frame, and nothing moves when the part is introduced. | Brief §4: recompose stages that hold a single small object. |
| D18 | **A labelled step list** is available under the controls ("Steps" disclosure) instead of a permanent rail, so the arc is visible on request without adding a third panel. | Keeps the calm single column while giving the reference's sense of where you are. |

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
