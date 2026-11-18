# Master specification — System Design Masterclass

> This is the durable product specification, saved verbatim from the original request.
> Future sessions: read this, then `docs/RESUME.md`, then continue from the first unmet criterion.
>
> **Amendments by the product owner override the original text where they conflict.** See the end of this file.

Build “System Design Masterclass” in the GitHub repository `akashsv01/system-design-masterclass`.

Create a public, self-paced, interactive website where anyone who knows basic programming can learn system design from scratch, build practical HLD and LLD skills, and prepare for interviews. Implement the working product, original lessons, simulations, exercises, interview workspace, optional accounts, and saved progress.

The two most important product requirements are comprehensive coverage and clarity. Give learners access to a deep curriculum while keeping each individual learning moment calm, focused, and easy to follow.

## 1. WHO THE WEBSITE IS FOR

Assume the learner understands variables, conditions, loops, and small functions. They may never have built a website, queried a database, written Java, read an architecture diagram, or heard the terms High-Level Design (HLD) and Low-Level Design (LLD).

Give a first-time visitor one prominent action: “Start from scratch.” Open a real lesson immediately. Keep “Browse all topics” available as secondary navigation. Introduce HLD and LLD through examples before asking a beginner to choose related practice.

Keep the whole curriculum open to everyone. Guests can use every lesson, advanced topic, simulation, case study, solution, and mock interview. Signing in lets learners save their work to an account and continue across devices.

Choose the course structure yourself using prerequisites and learning objectives. There is no fixed day count, daily time requirement, or calendar-based unlocking. Use roughly 45 days of sustained practice as an internal design ambition: a motivated beginner returning regularly should find enough depth, guided practice, independent work, and feedback to develop strong design skills. Measure progress through what learners can demonstrate.

## 2. STUDY THE VISUAL AND TEACHING REFERENCE FIRST

Reference: https://designed-to-scale.vercel.app

Use a JavaScript-capable browser if available. Open actual lessons and step through them. The landing page alone is insufficient to evaluate how the reference teaches.

Study the details that affect comprehension:
- What does the learner see before the animation starts?
- How much explanation appears alongside one diagram?
- What changes between consecutive steps, and what stays in place?
- How does the page direct attention to the component that matters?
- When does the learner read, watch, predict, or interact?
- Where are the controls, and how does the layout behave on a narrow screen?

Record a short set of observations and the design decisions they inform in docs/DESIGN.md. Clearly distinguish what you observed from choices you are making for this product. If the interactive lessons are inaccessible, record that limitation and proceed using the visual specification below.

Use the reference’s teaching approach as inspiration for original animations, examples, writing, illustrations, and interface design.

## 3. DESIGN A CALM LESSON READER

Build a focused reading experience with one main idea and one visual focal point at a time. A learner should immediately understand where to look, what changed, and what to do next.

Use this default lesson composition:
- A clear title phrased around a real question.
- One short opening paragraph that gives the learner a reason to care.
- A spacious visual stage for the current diagram or experiment.
- A short explanation anchored to the active step, usually beneath the diagram.
- A compact row for Back, Next, Replay, and the current step where applicable.
- Deeper mechanics, source notes, and optional variations available when requested.

Start with a single reading column. Use a side-by-side layout only when seeing two things together materially helps, such as comparing two database values or matching one highlighted code line to an object changing state. Give a complex diagram its own width. Do not squeeze the animation, explanation, code editor, event log, quiz, curriculum sidebar, and glossary into competing panels.

Keep diagrams stable while stepping. Preserve node positions, labels, and the learner’s scroll position where practical. Highlight the one meaningful change. Use whitespace, type hierarchy, and proximity to show which caption belongs to which visual. Keep paragraphs at a comfortable reading width. Place labels directly on the relevant parts of a diagram and use a legend only when it earns the space.

On mobile, compose the lesson deliberately. Keep the diagram, active explanation, and primary control easy to reach together. Simplify or reframe crowded diagrams before shrinking labels. Check that sticky navigation never covers the content or Next button.

Give the product a coherent visual identity: legible typography, restrained color, consistent controls, generous spacing, and purposeful motion. Use color consistently for meanings such as active, delayed, failed, or confirmed, with a label or shape for each meaning. Support light and dark themes, visible keyboard focus, and reduced motion. Avoid decorative dashboards, repetitive cards, badge clutter, animated backgrounds, or oversized marketing sections that delay the first lesson.

## 4. CHOREOGRAPH ANIMATIONS TO EXPLAIN CAUSE AND EFFECT

Storyboard each flagship animation before implementing it. For every step, specify what the learner already knows, what event occurs, which state changes, and what the learner should notice.

Use learner-controlled progression by default. Give the learner time to read. Move a request when it is sent, update a value when it is written, and show the reply when it returns. Keep unrelated components still. Reveal complexity as it becomes relevant. Use automatic playback as an optional control.

Use this original replica-lag lesson as the quality benchmark:

Title: “Why does my profile still show my old name?”

Opening: “You changed your name from Sam to Alex. A moment later, your profile says Sam again. Follow the update to see how both screens can be telling the truth.”

Step 1: Show two stored values, both “Sam.” Introduce the database that accepts updates and the database that receives a copy. Keep the diagram still long enough to read it.

Step 2: The learner selects “Save Alex.” Animate one write to the first database. Its value changes to “Alex.” The second value visibly remains “Sam.”

Step 3: Pause at 10:00:01. Ask one question: “If the profile reads from the second database now, which name appears?” Let the learner choose and then trace that single read.

Step 4: Advance to 10:00:02. Animate the delayed update reaching the second database. Only now introduce the term “replication lag.”

Step 5: Let the learner change the delay and replay. Ask how the app could ensure that a person immediately sees their own update, and explain the cost of the chosen strategy.

Keep only the current step’s explanation in the main reading area. Offer the event history separately. The text, diagram, clock, and displayed values must derive from the same underlying simulation state.

Apply the same discipline to LLD. When teaching LRU eviction, first show three items and their recency order. Let a read visibly move one item. Ask which item the next insertion evicts. Introduce the map and linked-list implementation in the following view, after the learner understands the behavior.

## 5. WRITE WITH THE EDITORIAL STANDARD OF A WELL-CRAFTED STARTUP PRODUCT

The website should feel written by engineers and edited by someone who cares about the reader. Write original, concise prose with a recognizable teaching voice. Use familiar examples, precise verbs, actual values, and natural transitions.

Open with “Two buyers see one seat left. Who gets it?” or “Your payment timed out. Should the app try again?” Skip generic introductions such as “In today’s digital world,” “Let’s dive into,” or “This powerful concept is essential for scalable systems.” Remove filler praise, repetitive summaries, vague claims, and unnecessary text that announces what the interface already shows.

Choose the format that teaches the subject best. A consistency lesson may need a timeline. A design-pattern lesson may need a change request. An incident lesson may begin with a graph and three competing explanations. Maintain a consistent quality standard while giving lessons distinct structures.

At first use, explain each unfamiliar term in context. For a formula, include assumptions, units, arithmetic, and one changed-input example. For a design decision, identify the benefit, cost, and circumstances that would change the answer. Use analogies carefully and explain where they stop being accurate.

Give every substantive lesson an editorial pass. Read it as a first-time learner. Remove duplicate sentences, unexplained jumps, generic questions, and unnecessary panels. Verify that the interaction teaches something the prose alone could not show as clearly. Keep editorial review status honest; automated checks do not constitute independent human review.

## 6. BUILD THE FIRST LEARNER JOURNEY

Begin with two people using different phones to reserve the last seat at an event.

Start with one buyer. Let the learner press Reserve, follow the request, inspect the stored seat value before and after, and see the confirmation return. Introduce client, server, database, request, and response as each becomes relevant.

Then introduce the second buyer. Pause when both buyers appear to see an available seat. Ask what could happen. Let the learner save a drawing or explanation. Return to this scenario later when they can solve and test it.

Use the same feature to explain:
- HLD: which parts the booking system needs, which part owns seat availability, and how the parts communicate.
- LLD: which states a seat can enter, what a hold means, and which rule prevents two confirmed bookings.

End with one recommended next lesson and a concrete reason for it. On a later visit, “Continue learning” should reopen the unfinished activity.

## 7. MAKE CURRICULUM COVERAGE VERIFIABLE

Create a structured curriculum manifest before bulk-authoring content. For each topic record its prerequisites, learning objective, sources, lesson route, worked example, exercise, assessment, and status. Generate a readable coverage report.

A completed topic must include a substantive original explanation, an inspectable worked example, and an exercise that checks its objective. Track planned, partial, implemented, technically verified, and independently reviewed material accurately. Check for missing prerequisites, broken links, orphan lessons, duplicate material, and topics without assessments.

Build the following scope and expand it when source comparison reveals meaningful gaps:

Foundations and networking:
Processes, threads, concurrency, parallelism, memory, disk, networks, DNS, IP, TCP, UDP, TLS, HTTP, REST, RPC, polling, SSE, WebSockets, latency, percentiles, throughput, bandwidth, availability, bottlenecks, capacity estimation, peak load, stateful/stateless services, and vertical/horizontal scaling.

Data systems:
Access patterns, schemas, relationships, normalization and denormalization, SQL, query plans, indexes, relational, document, key-value, wide-column, graph, search, time-series and object storage; B-trees, LSM trees, write-ahead logs, compaction, transactions, isolation anomalies, locking, MVCC, replication, failover, sharding, partition keys, hot spots, consistent hashing, and rebalancing.

HLD and distributed systems:
Requirements, constraints, API contracts, pagination, versioning, proxies, gateways, service discovery, load balancing, CDNs, cache placement, eviction, invalidation, stampedes, timeouts, partial failure, retries, backoff, jitter, idempotency, deduplication, ordering, clocks, consistency models, CAP during partitions, quorum assumptions, leader election, consensus, Raft intuition, coordination, queues, pub/sub, logs, consumer groups, delivery guarantees, backpressure, batch and stream processing, event time, watermarks, distributed transactions, sagas, outbox, CQRS, and event sourcing.

Architecture and operations:
Modular monoliths, microservices, service boundaries, synchronous and asynchronous communication, schema evolution, multitenancy, multi-region design, authentication, authorization, sessions, OAuth/OIDC fundamentals, encryption, privacy, rate limiting, observability, logs, metrics, traces, SLIs, SLOs, error budgets, deployments, rollback, backups, restore testing, disaster recovery, RPO/RTO, and cost reasoning.

LLD and machine coding:
Responsibilities, interfaces, abstraction, encapsulation, polymorphism, inheritance, composition, cohesion, coupling, SOLID, contracts, invariants, immutability, validation, error handling, entities, value objects, repositories, dependency injection, UML class/sequence/state diagrams, state machines, resource lifecycle, refactoring, tests, test doubles, synchronization, races, and deadlocks. Cover all 23 Gang of Four patterns in a searchable reference. Teach commonly useful patterns through concrete refactoring exercises.

Use language-neutral explanations and pseudocode first, Java for the principal LLD implementations, and tested Python comparisons where useful. **[Superseded by Amendment 1: Python 3 is the only learner language.]** Include bridge lessons for prerequisites such as SQL, JSON, threads, maps, linked lists, and interfaces.

## 8. COMPLETE CASE STUDIES AND LABS

HLD cases: URL shortener, distributed rate limiter, notifications, chat, social feed, autocomplete, file storage and sync, video streaming, ticket booking, payments, inventory and checkout, ride matching, metrics ingestion, distributed scheduler, web crawler, collaborative editor, and live scores with fan rooms.

LLD cases: parking lot, elevator controller, vending machine, library, expense sharing, logger, notifications, LRU cache, rate limiter, scheduler, booking system, shopping cart, and board game.

Build each case around decisions. Begin with an ambiguous prompt. Let the learner clarify scope, propose a simple design, inspect a critical path, investigate a failure, and respond to a changed requirement. Compare defensible alternatives under explicit assumptions.

Create at least three paired HLD/LLD cases:
- Booking: service and storage boundaries, seat holds, expiry, competing buyers, duplicate confirmation, and late payment.
- Notifications: fan-out, delivery channels, retry policies, deduplication, and partial delivery failure.
- Live updates: ingestion, ordering, duplicate events, corrections, and client reconnection.

Flagship interactive labs must cover request tracing, overload and load balancing, cache behavior, stale reads, partitioning and hot spots, queue backlog, payment retries, LRU operations, and concurrent reservations. Give learners a prediction, a meaningful control, an observable consequence, and a fresh problem. Support deterministic replay. Label units and model assumptions.

## 9. GROUND THE COURSE IN MAJOR SOURCES

Use major books, original papers, official documentation, and published engineering accounts to identify and verify topics:
- Designing Data-Intensive Applications; Database Internals; Distributed Systems by van Steen and Tanenbaum; MIT distributed systems materials.
- Computer Networking: A Top-Down Approach; Operating Systems: Three Easy Pieces; applicable IETF RFCs.
- Fundamentals of Software Architecture; Software Architecture in Practice; Release It!; Google’s Site Reliability Engineering and The Site Reliability Workbook; Amazon Builders’ Library.
- Design Patterns by Gamma and colleagues; Head First Design Patterns; A Philosophy of Software Design; Refactoring; Effective Java; Domain-Driven Design; Patterns of Enterprise Application Architecture.
- System Design Interview volumes 1 and 2 and the System Design Primer for interview scope and problem breadth.
- Original papers including Dynamo, Raft, MapReduce, Bigtable, Spanner, and the Google File System.
- Official technology documentation and documented production accounts from engineering teams.

Use accessible tables of contents to identify scope and accessible primary material to verify technical claims. Cite specific chapters, papers, sections, or documentation pages when verified. Do not invent citations, benchmark results, or details about a company’s architecture. Distinguish published facts, hypothetical designs, and simulation assumptions. Present sources in a quiet expandable section. A learner should be able to complete the course without owning a book.

## 10. PUBLIC ACCESS, ACCOUNTS, AND SAVED WORK

Guests can work through the entire product. Save their progress locally across refreshes and return visits. Communicate clearly when work exists only on the current device.

Implement optional authentication and real per-user server persistence. Signed-in learners can save exact lesson steps, simulation inputs, notes, bookmarks, diagrams, code drafts, quiz attempts, mock interviews, mistakes, and revision progress. Restore that work across devices.

If someone signs in halfway through a drawing, preserve the drawing. Merge compatible guest and account progress. For conflicting drafts, preserve both or let the learner choose. Make retries safe. Display accurate save, sync, pending, and failure states. Enforce ownership server-side. Add validated, versioned export and import.

Verify public deep links, guest refresh, guest-to-account migration, second-browser resume, private account isolation, shared-device sign-out, and interrupted saves. If production credentials are unavailable, implement and test the flow in a supported local environment and document the remaining configuration.

## 11. INTERVIEW PRACTICE AND READINESS

Offer guided practice, independent exercises, and optional timed HLD/LLD interviews. Provide a clean diagram workspace, notes, estimates, progressive hints, changing requirements, coding exercises, and worked alternatives. Give the learner space to attempt the problem before revealing guidance.

Evaluate HLD through requirements, estimates, APIs, data models, critical paths, failure reasoning, and communication. Evaluate LLD through responsibilities, interfaces, invariants, correctness, tests, and adaptability. Use objective checks where possible and transparent rubrics for open-ended judgment.

Distinguish “studied,” “solved with hints,” and “solved independently.” Provide a mistake notebook, spaced revision, and fresh exercises addressing observed gaps. End the recommended route with an unfamiliar capstone and a surprise requirement. Compare the learner’s initial design with the capstone and explain which skills their work demonstrates. Core functionality must work without a paid AI API.

## 12. DELIVERY, QUALITY CONTROL, AND RESUMPTION

Inspect the repository first. It may be empty. Preserve existing work and use the writable branch assigned by the cloud environment. Choose a maintainable TypeScript/React stack with real account storage. Separate curriculum content, simulation logic, UI rendering, assessment, and learner progress.

Save this specification in docs/MASTER_PROMPT.md. Create a concise CLAUDE.md that directs future sessions to the specification, design notes, coverage report, and docs/RESUME.md. Maintain verified setup, testing, build, and deployment instructions in the README.

Build and inspect a representative slice before expanding the curriculum:
1. Implement the opening booking lesson, the replica-lag experiment, and one LLD lesson. These must demonstrate three distinct teaching formats.
2. Open them in a browser on desktop and at a narrow mobile width. Step through every state. Inspect screenshots for competing focal points, cramped side-by-side panels, tiny labels, awkward wrapping, excessive scrolling between a diagram and its explanation, and controls obscuring content. Fix the underlying layouts.
3. Verify one end-to-end learner journey: open a public lesson, predict an outcome, run the experiment, save a draft, refresh, sign in, and resume the saved work.
4. Use the verified interaction and editorial patterns to complete the curriculum, case library, interview workspace, and capstone. Continue independently after the first slice.
5. Audit the full product against the coverage manifest. Verify builds, links, code examples, deterministic simulations, accessible navigation, account isolation, and key mobile flows. Record actual results and outstanding gaps.

After each meaningful increment, update docs/RESUME.md with the current branch, last verified work, unfinished files, known failures, and the exact next acceptance criterion. Commit coherent changes and push to the authorized working branch. Distinguish local commits from confirmed remote checkpoints. Checkpoint frequently because a usage interruption may arrive without warning.

On every resumed session, read the durable instructions, inspect Git status and recent commits, reconcile the notes with the actual implementation, and continue from the first unmet criterion. Re-pasting this prompt into a partially completed repository must resume the project.

When the host supports automatic continuation after a usage reset, use it. As soon as execution resumes, continue from the checkpoint without requiring the specification again. Respect subscription limits and leave paid overage disabled. If the host ends the session, the pushed repository must contain enough information for a fresh session to recover. Report an automatic restart only when the host confirms one.

Prepare a deployable application. Obtain explicit authorization before purchasing services or publishing publicly.

Begin by inspecting the repository and saving the durable specification. Then build the first playable lesson. The first design review should answer a concrete question: can someone who knows only basic programming follow the animation, explain what changed, and successfully predict what happens next?


---

## Amendments

### Amendment 1 (2026-11-18) — Python 3 is the learner language

Python 3 is the primary and only required language for learners. This applies to all LLD lessons, design
patterns, machine-coding exercises, interview problems, starter code, worked solutions, and tests.

- Assume learners know basic programming; introduce each unfamiliar Python feature (classes, `@dataclass`,
  type hints, `Protocol`/ABCs, `enum.Enum`, `with`/locks, `threading`, decorators, `collections.OrderedDict`,
  exceptions, generators) in context where it first appears.
- Rewrite any Java examples as idiomatic Python. Prefer the simplest idiomatic form first and introduce
  heavier structure only when the problem needs it. Example: teach Strategy by first passing a pricing
  *function* into a checkout function; introduce a class-based strategy later only when the pricing rule
  needs its own state.
- Verify runnable examples and exercise solutions with **pytest** (see `python/` in the repository).
- The website itself continues to use TypeScript/React. This decision concerns the language learners read
  and write. Java-specific sources (e.g. Effective Java) may remain as optional further reading only.

### Amendment 2 (2026-11-18) — Visual-first, Python only where it helps

Clarifies Amendment 1:

- Python 3 replaces Java for **all learner-facing code**. The website's implementation stack (TypeScript/React,
  Node server) is unchanged.
- The course stays **visual-first**. Show short, readable Python snippets (roughly 3–15 lines) only when they help
  explain a concept, and introduce each one at the step where it becomes relevant — never a full file dumped
  beside a diagram. Full listings are available on request (collapsed) or in `python/`.
- In hands-on LLD and machine-coding exercises, learners **write and test Python in the browser**. Starter code
  and tests come from `python/`; the same tests run with real pytest in CI/local (`cd python && python3 -m pytest`).
  **[Narrowed by Amendment 3: hands-on coding is limited to filling one blank in a complete snippet.]**

### Amendment 3 (2026-11-18) — Lightweight exercises

Exercises are short and focused. Supersedes requirements for full-class implementations and long
machine-coding assignments (§7 "exercise", §8 LLD cases, §11 "coding exercises").

Learner activities are limited to:
1. **Predict** what happens next (then watch it happen).
2. **Spot the mistake** — or "which line explains it?" — by selecting a line in a short snippet.
3. **Choose between two designs** under stated assumptions.
4. **Explain a trade-off in one or two sentences**, then compare with a model answer and a short checklist.
5. **Fill one blank** in an otherwise complete snippet (e.g. a single condition), checked by running tests.

Use short Python snippets wherever code makes an idea clearer, with the relevant line highlighted. Example: in
the seat-booking lesson, show the completed `reserve` function and highlight `if seat.is_reserved:`; the learner
clicks Reserve twice and answers "What does the second buyer see, and which line explains it?". A later exercise
leaves that one condition blank.

Keep useful worked code available to read or expand (collapsed by default; full files in `python/`, tested with
pytest). LLD case studies and interviews use the same activity types: decisions, invariants, a highlighted
snippet, a fill-in, a changed requirement — not a full implementation.

### Amendment 4 (2026-11-18) — Scope of the language and exercise changes (consolidates 1–3)

Amendments 1–3 change **only** (a) the language of learner-facing code and (b) the size of *required* coding
exercises. Everything else in the original specification stands:

- **Full curriculum preserved.** Every planned topic, bridge lesson, lab, HLD and LLD case study, design pattern,
  production trade-off, and interview-preparation feature remains in scope. Shortening an exercise must never
  reduce topic coverage or technical depth.
- **Visual teaching first.** One idea at a time, a spacious diagram, a short explanation tied to the current step,
  learner-controlled animation. Learners predict an outcome, change an input, and see what happens. Code and deeper
  detail are revealed when they help. Pages stay calm.
- **Python 3 wherever Java would have appeared.** Short, readable snippets where useful; worked code is supplied
  (collapsed or in `python/`, tested with pytest).
- **Required exercises are small:** predict an output, fill in one condition, change a line, spot the line that
  explains a behaviour, choose between two designs, or explain a decision in one or two sentences. Example: the LRU
  lesson animates a read changing recency order, asks which item is evicted next, then reveals the responsible
  Python lines. Learners understand the mechanism without implementing the whole cache.
- Self-paced structure, public access, optional sign-in, saved progress, and source-verification requirements are
  unchanged.
