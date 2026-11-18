# Lesson design guide

This is how we build every lesson, lab and case study. It turns the product spec (`MASTER_PROMPT.md`, including
Amendments 1–4) and the reference study (`DESIGN.md`) into concrete rules. The shared components in
`src/ui/components/` enforce most of it. This page covers the judgement calls they can't make for you.

## 1. One focal point per step

- Phrase the lesson title as a real question ("Why does my profile still show my old name?").
- Each step: one short heading, at most three short paragraphs, at most one callout, and an optional
  "What changed" list (+ added, ~ changed, − removed/failed). Shapes carry the meaning as well as colour.
- Put the explanation **directly under the visual it describes** (the `Caption` component). Never put it in a side
  panel that competes with the stage.
- Deeper mechanics, the full Python file, sources and variations go behind `More` disclosures. Show them only
  when the learner asks.
- One column by default. Use side by side only when comparing two things *is* the lesson (two designs, a code line
  next to the state it changes). The `compare` visual and `.impl-grid` stack on phones.

## 2. Motion explains a change

- When the learner presses Next, keep every familiar element where it was. Nodes have fixed slots in both layouts.
  Nodes that are not relevant yet render as `ghost`: invisible, but holding their space.
- Animate only the event that matters: a request moves when it is sent, a value updates when it is written, a reply
  returns when it is sent back.
- **Leave the result visible.** When a message token arrives, it fades so the node's new value can be read, but
  the edge it travelled along stays highlighted for that step. The node keeps a `was: …` tag. Back steps back, and
  Replay (R) re-runs the step's motion.
- The learner drives progress. Auto-play is optional (the replica-lag clock has Play). Long sequences use an
  in-stage "Next event" button.
- Text, diagram, clock and values are all computed from one simulation state (`src/sim/*`). Never hand-write a
  value in a caption that the diagram also shows.

### Layout guarantees (enforced by shared components)
- The control row (`Controls`) is sticky at the bottom of the viewport at every width, so Back / Replay / Next
  stay reachable while the learner reads.
- On a step change, `useStep` scrolls only when needed: when the stage is hidden under the header, or when the
  caption would sit under the controls. It always reserves the header's full height.
- On phones the header slides away while scrolling down through a lesson and returns on scroll up. Navigation
  stays out of the lesson.
- Arriving message tokens stop short of the target node (never covering its label), fade, and leave their edge lit.
- On phones the Next button shows "Next" on one line and the upcoming step's title (up to two lines) below it.
  It never truncates mid-word.

## 3. Depth only where it clarifies

| Use | When | Component |
|---|---|---|
| Crisp 2D | flows, request paths, timelines, comparisons (most lessons) | `Diagram`, `Timeline`, `Compare` |
| Subtle layering | many similar things behind one name: replicas, shards, consumer groups, a server pool | `Diagram` with `depth="layered"` or `stack: n` on a node |
| Interactive 3D (rotate / separate / look inside) | the learning question is about *structure in layers*: protocol layers in a request, B-tree pages and levels, LSM levels, a process with its threads and memory | `LayerStack` |

Every 3D or layered view has a readable flat fallback. Under reduced motion, or when the learner chooses "Flat
view", `LayerStack` becomes a labelled vertical list. Never put essential information only in the 3D view.

## 4. Pick the format per topic

Navigation and controls stay the same everywhere (`Controls`: Back · Replay · Step n of N · Next: <name>). The
visual changes to suit the idea:

- **Guided trace** (first-booking): the learner triggers each request and inspects stored values.
- **Timeline experiment** (replica-lag): a clock, a prediction, one meaningful control, deterministic replay.
- **Behaviour → code** (lru-cache): operate it, predict it, then reveal the Python lines that did it.
- **Comparison** (normalization, sync vs async, two partition keys): two designs side by side under stated assumptions.
- **Chart** (latency percentiles, backlog growth, error budget burn): one chart, one input to change.
- **Layer stack** (inside-a-request, storage engines): separate and rotate layers to see what wraps what.
- **One illustration** when a picture says it once and motion would add nothing.

Record the chosen format and the reason in the lesson's storyboard (`docs/STORYBOARDS.md`) before building it.

### Small screens get their own layout
- Diagrams: provide a `narrow` layout. Don't shrink the wide one. Keep labels ≥ 12 px and keep sub-labels in the
  ink-2 colour, not faint grey.
- Charts: on phones, series names move into a legend under the chart. Category labels wrap to two lines, mark
  labels stay inside the plot, and axes use round tick values.
- Timelines: below 560 px they become a vertical, time-ordered list.
- 3D layer stacks: always offer "Flat view", and default to flat under reduced motion.

## 5. Writing

- Sound like a thoughtful engineer explaining to a smart newcomer. Ask specific questions. Use concrete values
  ("40 ms per hop", "2,000 messages/s in, 1,500 out"). Use precise verbs: *reads*, *writes*, *retries*, *evicts*.
- Explain each new term the first time it appears, in context, in plain words.
- Every formula comes with its assumptions, units, the arithmetic, and one example with a changed input.
- Every design decision states its benefit, its cost, and what would change the answer.
- Banned: "In today's digital world", "Let's dive into", "powerful", "essential for scalable systems", praise
  filler, recap paragraphs that repeat the step, and text announcing what the UI already shows.
- Give the learner something to notice or predict at least every two or three steps.
- **Words must match the picture.** If the heading says “idle”, the diagram must not show traffic. Read the
  title, the visual and the caption together and fix whichever disagrees.
- Every chart states its units on the axes. Unusual scales (log) and illustrative numbers are explained in the
  chart's `note`, which is shown under it.

## 6. Exercises (Amendments 3–4)

Required exercises are small: **predict**, **pick the line** that explains a behaviour or contains a mistake,
**fill one blank**, **change a line**, **choose between two designs**, or **explain in one or two sentences**.
Worked code is supplied (collapsed, or in `python/`, tested with pytest). Python appears only where it adds
understanding, introduced at the step where it helps, usually 3–15 lines.

## 7. Review at real sizes

Run `node scripts/review-lessons.cjs <base> <outDir> <lesson…>` and look at the screenshots at 1280×900 and
390 px (iPhone 13). For every step, ask:

1. Can a beginner tell **where to look**? Is there exactly one focal point?
2. Can they tell **what changed**, and is the result still visible after the motion?
3. Do they know **what to do next** (the Next label, or the action that gates it)?
4. On a phone, are the diagram, its caption and the primary control reachable together, without scrolling back and
   forth? Diagram labels must be at least 12 px. There must be no horizontal page scroll, and the sticky header must
   never cover the stage or the Next button.

The script measures each step **on arrival** (before interacting) and flags: controls not fully visible, header
overlapping the stage, a truncated Next label, horizontal scroll, and diagram text under 12 px. Screenshots are
viewport-sized, not full-page. Full-page captures draw the sticky header in the middle of the page, which is an
artifact, not what learners see.

If the answer requires scanning several panels, simplify the view. Don't add more explanation.
