# Master specification — System Design Masterclass

> **Governing brief: the Workbench Brief (2026-11-20) below, saved verbatim.** Earlier briefs are kept for history:
> the Revamp Brief in `docs/SPEC_2026-11-19.md` and the original specification with Amendments 1–4 in
> `docs/SPEC_2026-11-18.md`. Where compatible (curriculum breadth, Python 3 learner code, small required exercises,
> honest evidence and review status, public access, saved work), they still apply.
>
> Future sessions: read this, then `docs/RESUME.md`, then continue from the first unmet acceptance criterion.

---

## Workbench Brief (2026-11-20)

Revamp the existing System Design Masterclass in the GitHub repository `akashsv01/system-design-masterclass`. Start from the latest `main` branch, which contains the working application.

Deliver a complete UI and UX redesign with the judgment and finish of a senior product designer and frontend engineer shipping a customer-facing educational product. Implement the redesign across the homepage, course navigation, lesson reader, topic explorer, labs, practice, interviews, progress, and account flows. Run the application, use it as a learner, and refine the result in the browser.

The product direction is an interactive systems workbench. Someone who knows basic programming should be able to arrive, try an experiment, watch how a system behaves, and make a meaningful prediction within the first minute. From anywhere in the course, they should be able to open the topic navigator, expand a category, jump to another lesson, and return to their saved place.

### 1. TAKE OVER THE EXISTING APPLICATION

Fetch the latest `main` and record the baseline commit. Preserve uncommitted work if present. Read the repository instructions, current specification, design notes, curriculum manifest, source records, and resume notes. Run the app before making broad changes.

The existing product includes a booking scenario, visual lessons, Python examples, protocol-layer diagrams, quantitative lessons, simulations, a topic catalog, interview cases, practice, and progress tracking. Recent work introduced a question-led homepage, clarified the independence assumption in a latency exercise, and added fresh LRU eviction puzzles. Verify current behavior against the running branch. Older recordings may predate fixes.

Preserve the full curriculum, stable lesson IDs, deep links, public access, and existing learner data. Make substantial changes to visual composition, interaction design, and navigation wherever they improve the product. If stored progress needs a schema change, migrate it and verify that an existing learner can resume.

### 2. USE IMPECCABLE, FABLE, AND YOUR AVAILABLE DESIGN SKILLS

Inspect the UI/UX, frontend design, typography, animation, accessibility, responsive design, and browser-review skills available in this environment. Use Impeccable for design critique if installed. Determine which Fable capability is available and use it where it can improve the implementation. If either is unavailable, proceed with the strongest available tools.

Use design critique twice. First, inspect the current application and identify what makes it feel generic, crowded, repetitive, or difficult to navigate. Later, critique your own implementation in a running browser and fix what still feels unfinished.

Explore two distinct compositions for the homepage and lesson reader. Evaluate them against first-visit clarity, visual identity, reading comfort, mobile usability, and how naturally a learner moves between topics. Choose the stronger direction independently and implement it. Keep design documentation concise.

Study `https://designed-to-scale.vercel.app` if accessible. Open actual lessons and step through them. Study how much text appears at once, which diagram elements stay still, how changes are highlighted, where explanations sit, and how learners control the pace. Create original visuals, examples, and interactions. If access is blocked, record the limitation once and continue.

### 3. DESIGN FOR A COMPLETE BEGINNER

Assume learners understand variables, conditions, loops, and small functions. They may never have built a website, used SQL, drawn an architecture diagram, or heard of High-Level Design (HLD) or Low-Level Design (LLD).

Give first-time visitors one prominent action: “Start from scratch.” Clicking it should begin a real activity. Keep “Browse all topics” available for people who want to choose their own path. Teach HLD and LLD through an example before asking beginners to choose between them.

Organize the course by prerequisites and demonstrated skills. All content is self-paced and available from the beginning. There is no fixed 30-day or 45-day schedule, daily time requirement, or calendar-based unlocking. Roughly 45 days of sustained practice is an internal ambition for depth. Judge progress by what learners can explain, predict, diagnose, and design independently.

Guests can access every lesson, lab, solution, case study, and mock interview. Save guest work locally. Optional accounts provide private backup and cross-device continuation.

### 4. BUILD A DISTINCTIVE FRONT PAGE

Give the homepage a composition of its own. Within the first screen, visitors should understand what the product teaches, experience what makes it distinctive, and know what to do next.

The existing question “Two people tap Reserve on the last seat. Who gets it?” is a strong starting point. Follow it with a short invitation that preserves the surprise. Give the learner a compact visual experiment: two buyers, one seat, and a meaningful action or prediction. If they enter the first lesson afterward, carry their action forward instead of repeating the introduction.

Make the illustration understandable before the learner knows any system diagram conventions. Label important components clearly. Use mystery around the outcome rather than around what a dashed box represents.

Below the opening, give visitors a few real previews of the product’s range: trace a request, investigate a failure, and defend a design choice. Link each preview to its actual activity. Keep copy concise and specific.

Compose the mobile homepage separately. Keep the question, visual, and primary action within easy reach. For returning learners, make the exact unfinished activity the primary action, with its title and a clear label such as “Continue at step 4.”

### 5. REPLACE LONG-PAGE TOPIC BROWSING WITH AN EXPANDABLE COURSE NAVIGATOR

This is a core redesign requirement. Finding a topic must not require scrolling through the entire syllabus, returning to the homepage, or remembering where a lesson sits in a long list.

Build one shared, hierarchical course outline for both the topic explorer and lesson pages. Use the curriculum manifest as its source of truth:

Category → Module → Lesson

For example, a learner should be able to select:

Data Systems → Caching → Cache invalidation

Interaction:
- On first visit, show a compact set of clearly named top-level categories.
- Clicking a category expands its modules in place. Clicking a module reveals its lessons. Clicking a lesson opens its existing deep link.
- Expanding or collapsing a category is a browsing action. It must not navigate away from the current lesson, reset an experiment, or move the reading page.
- When a lesson opens, automatically expand its ancestors and visibly identify the current lesson. Keep completion status visually distinct from the current selection.
- Remember the learner’s expanded sections and the outline’s scroll position. Keep every lesson publicly accessible. Use prerequisites as guidance.
- Keep search in a consistent location. Search across lessons even when their branches are collapsed. Show the full path for each result, open the result directly, and reveal its branch in the outline. Clearing search should restore the previous browsing context where practical.

Desktop:
- Put the outline in a collapsible left sidebar on lesson and topic pages. Keep it within reach while the learner reads.
- Let the outline scroll independently. Opening a long module must not move the diagram, explanation, or reading position.
- Give dense diagrams enough width. Let learners collapse the sidebar and reopen it with one clearly labeled control.
- Keep the active lesson visible when reopening the navigator.

Mobile:
- Use a consistently placed, clearly labeled “Topics” button that opens the same outline in a drawer.
- Make expand controls and lesson rows comfortably tappable. Selecting a lesson closes the drawer and opens the selected activity.
- Opening and dismissing the drawer without choosing a lesson should return the learner to the exact current step and reading position.
- Reopening the drawer should reveal the current lesson. Support keyboard use, sensible focus handling, Escape to close, and reduced motion.

Inside lessons, retain “Previous lesson” and “Next lesson” for learners following the recommended sequence. Make those controls clearly distinguishable from steps within a simulation. A small breadcrumb can communicate location without duplicating the whole outline.

Navigation acceptance test: start halfway through a lesson, open Topics, expand a different category and module, jump to a lesson, then return to the original activity. Verify on desktop and phone that the original step and work are restored. Also test opening a deep link, searching for a lesson in a collapsed branch, and dismissing the mobile drawer without navigating.

### 6. ESTABLISH A COHERENT VISUAL IDENTITY

Treat the current warm palette, serif headlines, and blue controls as a starting point. Choose a deliberate visual direction and carry it through the entire product. Give the homepage, reader, catalog, lab, and interview workspace layouts appropriate to their different jobs.

Use clear type hierarchy, comfortable line lengths, readable numerical labels, consistent spacing, and purposeful color. Keep diagram labels and connections legible in both light and dark themes. Pair meaningful colors with labels, shapes, or icons.

Give complex diagrams room. Recompose sparse stages so a tiny object does not float in a vast empty frame. Avoid giving every paragraph, action, or topic its own bordered card. Use whitespace and proximity to communicate relationships.

Design the ordinary details carefully: hover, keyboard focus, pressed, selected, disabled, loading, error, and success states; opening and closing the navigator; expanding a snippet; submitting a prediction; and returning to saved work. Preserve focus and reading position when controls change state.

### 7. MAKE THE LESSON READER THE SIGNATURE EXPERIENCE

At every step, a beginner should be able to answer:
- What question am I investigating?
- What changed?
- What can I do next?

Keep the active question, visual, immediate explanation, and primary action together. Default to a focused reading layout. Use side-by-side views when they help someone compare two values, connect a Python line to an object changing state, or inspect a before-and-after result. Reveal implementation details, event history, sources, and deeper analysis progressively.

Give each moment one obvious primary action. Prefer event-specific labels such as “Reserve this seat,” “Send the request,” “Delay the replica,” or “Choose the item to evict.” If the learner must make a prediction first, explain that beside the input. Eliminate situations where two equally prominent Next buttons appear to advance different things.

Finish lessons deliberately. Explain the consequence of the learner’s answer. Offer a fresh transfer question when appropriate, then recommend one next lesson and explain why it follows. The topic navigator remains available for anyone who wants a different route.

### 8. MAKE ANIMATION EXPLAIN CAUSE AND EFFECT

For each flagship interaction, identify the event, the affected state, and the one thing the learner should notice. Keep unrelated objects stable. Animate the event, update the relevant value, and leave the result visible long enough to inspect.

Use request paths for communication, timelines for ordering, queues for backlog, tables for stored values, state diagrams for lifecycle rules, and synchronized code/object views for LLD. Use 3D or layered views when pulling apart, rotating, or inspecting depth reveals a useful relationship. Keep essential text upright and readable. Offer a flat or reduced-motion equivalent.

Drive the diagram, caption, clock, values, metrics, and event history from the same simulation state. Verify deterministic replay, reverse stepping, reset, rapid clicks, and interrupted transitions. Avoid losing a learner’s result when they open the navigator or inspect an explanation.

### 9. TEACH WITH ORIGINAL, PRECISE WRITING

Start with a familiar question and a small example. Introduce terminology when it helps the learner name something they have observed. Define unfamiliar words inline and offer short prerequisite bridges for topics such as JSON, SQL, threads, interfaces, maps, and linked lists.

For example, a user changes their display name from Sam to Alex. The primary database accepts the write at 10:00:00. A replica receives it at 10:00:02. At 10:00:01, let the learner choose which database serves the profile page and predict the name displayed. Show both values. Then introduce replica lag and ask what guaranteeing an immediate read of a user’s own update would cost.

Apply that level of clarity throughout:
- Explain what each important box stores or does and what each arrow carries.
- For quantitative topics, show units, assumptions, arithmetic, and how changing one input changes the result.
- For design patterns, begin with working code and a change request that makes the design decision meaningful.
- State the assumptions behind technical guarantees. Show a counterexample when an assumption changes.
- Use language that matches the actual simulation. If a shard serves 15% of requests, describe its load accurately.
- Edit out generic introductions, repetitive instructions, empty praise, and headings that add no information.

A short comparison, trace, or counterexample can be better than another multi-step animation. Choose the teaching format that makes each concept easiest to understand.

### 10. KEEP LEARNER-FACING PYTHON LIGHTWEIGHT

Use Python 3 wherever a code example helps. The application itself can retain its existing implementation stack.

Provide concise worked snippets. Most required exercises should ask learners to predict an output, identify one line, fill a condition, change one value, select an outcome, or explain a trade-off in one or two sentences. Put longer tested implementations behind optional disclosure.

Maintain full conceptual depth. A learner can demonstrate LRU understanding by predicting the eviction victim after a read changes recency. They can demonstrate concurrency understanding by identifying a broken invariant in an event trace. Heavy implementation assignments are unnecessary for the core learning path.

### 11. PRESERVE AND AUDIT COMPREHENSIVE COVERAGE

Use the existing curriculum manifest and repository specification as the detailed inventory. Map each substantive topic to its category, module, prerequisites, learning objective, route, worked example, exercise, and assessment. Keep the outline, search results, coverage report, and lesson content synchronized.

Audit these areas:
- Foundations and networking: request lifecycles, processes, threads, memory, disk, concurrency, parallelism, DNS, IP, TCP, UDP, TLS, HTTP, REST, RPC, polling, SSE, WebSockets, capacity estimation, latency, percentiles, throughput, bandwidth, availability, scaling, and bottlenecks.
- Data systems: access patterns, schemas, normalization, indexes, query plans, relational and nonrelational stores, search, graphs, time-series and object storage, B-trees, LSM trees, logs, compaction, transactions, isolation, locking, MVCC, replication, failover, partitioning, consistent hashing, hot spots, and rebalancing.
- HLD and distributed systems: requirements, APIs, pagination, versioning, proxies, gateways, discovery, load balancing, CDNs, caching, invalidation, eviction, stampedes, partial failures, retries, backoff, jitter, idempotency, deduplication, ordering, clocks, consistency models, CAP during partitions, quorums, leader election, consensus, Raft intuition, queues, pub/sub, logs, consumer groups, delivery guarantees, backpressure, batch and stream processing, event time, watermarks, distributed transactions, sagas, outbox, CQRS, and event sourcing.
- Architecture and operations: monoliths, microservices, service boundaries, communication patterns, schema evolution, multitenancy, multi-region design, authentication, authorization, sessions, OAuth/OIDC fundamentals, privacy, encryption, rate limiting, observability, SLIs/SLOs, error budgets, deployments, rollback, backups, restore testing, disaster recovery, RPO/RTO, and cost.
- LLD: responsibilities, interfaces, abstraction, encapsulation, polymorphism, inheritance, composition, cohesion, coupling, SOLID, contracts, invariants, validation, immutability, entities, value objects, repositories, dependency injection, UML class/sequence/state diagrams, resource lifecycle, refactoring, testing, synchronization, races, deadlocks, and a searchable reference for all 23 Gang of Four patterns.

Preserve all existing HLD and LLD cases and the original planned inventory. HLD coverage includes URL shortening, rate limiting, notifications, chat, feeds, autocomplete, file sync, streaming, booking, payments, inventory and checkout, ride matching, metrics ingestion, scheduling, crawling, collaborative editing, and live updates. LLD coverage includes parking, elevators, vending, libraries, expense sharing, logging, notifications, caches, rate limiters, schedulers, reservations, carts, and board games.

Keep at least three paired HLD/LLD cases: ticket booking and seat holds; notifications and delivery policies; and live updates with ordering and deduplication. Show which component enforces each guarantee. Include a failure and a requirement that changes the preferred design.

Mark a substantive topic complete only when learners can study the mechanism, inspect a worked example, and attempt an aligned exercise. Track implementation, technical verification, source verification, and independent editorial review separately.

### 12. IMPROVE LABS, PRACTICE, INTERVIEWS, AND PROGRESS

Labs: make the input, current state, and outcome easy to compare. Give learners a prediction, meaningful control, observable consequence, and fresh problem. Verify that every instruction naming a button or input matches a real, visible control in that state.

Practice: recommend one useful exercise and explain why. Give first-time learners an immediate action. Introduce revision queues and mistake history when there is relevant activity. Describe what decisions learners will practice.

Interviews: provide guided walkthroughs and independent attempts. In independent mode, save the learner’s decision or sketch before revealing the reference architecture. Introduce a changed requirement or failure and ask what they would revise. Accept multiple defensible designs and use transparent rubrics.

Progress: distinguish studied, solved with help, and solved independently. Confidence surveys and self-ratings should remain separate from objectively demonstrated outcomes. End the recommended route with an unfamiliar capstone and compare it with an early saved design using concrete evidence of improvement.

### 13. VERIFY SOURCES, ACCOUNTS, AND SAVED WORK

Maintain the existing source inventory. Use major books, original papers, official documentation, and documented engineering accounts to check scope and accuracy. Preserve references including Designing Data-Intensive Applications, Database Internals, Distributed Systems, Computer Networking: A Top-Down Approach, Operating Systems: Three Easy Pieces, Fundamentals of Software Architecture, Software Architecture in Practice, Release It!, Google’s SRE books, Amazon Builders’ Library, Design Patterns, Head First Design Patterns, A Philosophy of Software Design, Refactoring, Domain-Driven Design, Patterns of Enterprise Application Architecture, and System Design Interview volumes 1 and 2.

Write original lessons. Cite specific material when verified. Keep blocked or unverified claims in the editorial backlog. Distinguish production facts, hypothetical architectures, and simulation assumptions. Essential instruction must be available inside the website.

Preserve guest work across refreshes and signed-in work across devices. Save the unfinished lesson step, experiment inputs, notes, diagrams, drafts, mistakes, and interview attempts. Make save states clear. Preserve guest work during sign-in, handle conflicts without silently overwriting drafts, make retries safe, and enforce ownership on the server. Preserve validated export/import.

Test a guest starting a lesson, switching topics, returning, refreshing, signing in, retaining the draft, and resuming from another browser. Verify account isolation, shared-device sign-out, interrupted saves, and existing-data compatibility. If production credentials are unavailable, verify the supported local flow and document the limitation.

### 14. IMPLEMENT, POLISH, AND RESUME AUTONOMOUSLY

Capture the baseline homepage, course navigation, lesson reader, catalog, practice, and interview screens. Implement the new homepage, expandable navigator, and complete journey to the learner’s first meaningful prediction first. Verify those together because they establish the product’s design and interaction standard.

Apply that standard to a quantitative lesson, an interactive lab, and an independent case. Critique the running results using available design skills, then carry the improvements across the full product without pausing for routine approvals.

Check desktop, tablet, 360px and 390px phone widths, light and dark themes, keyboard use, reduced motion, touch controls, long labels, loading states, empty states, scrolling, drawer behavior, interrupted transitions, and saved drafts. Capture before-and-after screenshots at matching widths and a short recording of key transitions where supported. Watch the recording at normal speed and fix problems apparent in motion.

Run the relevant tests, content audits, and production build. Verify the navigation acceptance test, learner journeys, simulation correctness, source status, short Python examples, and saved progress. Report only checks that actually ran.

Save this specification in `docs/MASTER_PROMPT.md`. Maintain concise design decisions, coverage records, and `docs/RESUME.md`. Commit coherent increments and push to the authorized working branch. Record the latest verified commit, outstanding issues, and precise next action. Clearly distinguish local commits from confirmed remote checkpoints.

On session resume, inspect the current branch, actual files, and durable instructions. Preserve partial work and continue from the first unmet acceptance criterion. Use supported host continuation when available, respect usage limits, and keep paid overage disabled. Prepare a deployable build; obtain explicit authorization before purchases or public deployment.

Finish with the branch and commit, key design changes, verification evidence, and honest remaining gaps. Begin now by opening the latest main, testing how a newcomer currently finds a lesson and returns to it, and redesigning that journey in the actual product.
