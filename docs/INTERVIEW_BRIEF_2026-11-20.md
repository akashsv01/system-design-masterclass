# Interview Simulator Brief (2026-11-20) — saved verbatim

> Active brief for the Interview Practice revamp. It was received while the Workbench Brief (`docs/MASTER_PROMPT.md`)
> was in progress; the Workbench navigator work is paused at the outline model (commit `9cd02ad`) and resumes after
> this. Progress and the next unfinished task are in `docs/RESUME.md`.

---

Revamp the Interview Practice feature of System Design Masterclass into a polished, visual interview simulator for both high-level design (HLD) and low-level design (LLD). Implement the upgrade in the existing repository and verify the experience end to end.

Repository: https://github.com/akashsv01/system-design-masterclass
Start from the latest main branch and inspect the current implementation before making changes.

1. Understand the product and the learner

System Design Masterclass is a self-paced, visual learning product for anyone who knows basic programming and is new to system design. The course teaches through step-by-step diagrams, plain-English explanations, and small Python snippets where code helps. Interview Practice is where learners apply those ideas to unfamiliar problems and learn to explain their decisions.

The existing interview experience is a good foundation. Play through an HLD case and an LLD case first. Identify what already works, including case content, navigation, feedback, and saved progress. Build on those strengths. Use the available Impeccable, Fable, frontend design, accessibility, and interaction-design skills where they fit. Make routine product and implementation decisions independently.

2. Give the interviewer responsibility for the brief

Every case should open with a believable interviewer explaining the problem. Tell the learner who they are designing for, what those users need to do, what must work correctly, and which constraints matter. Clarify what is outside the scope when it helps narrow the task. Define unfamiliar terms the first time they appear.

Give the learner a concrete first move. For example, a ticket-booking interview might begin:

“Two people can try to reserve the last seat at the same time. A reservation holds the seat for ten minutes. Only one person can complete the purchase. Show me what happens after someone taps Reserve.”

The interviewer supplied the requirements. The learner still owns the design. Let them ask clarifying questions and get answers consistent with the brief. Where the brief genuinely leaves a choice open, let the learner make an assumption and carry it through the interview. Keep “View brief” available throughout without losing their place or draft.

3. Offer a guided practice session and a realistic mock

In guided practice, introduce each stage in one or two sentences, offer an optional starter design, and coach the learner as they work. Let a complete beginner enter a case and make a meaningful first edit without sitting through a tutorial.

In mock interviews, give the brief, let the learner lead, and have the interviewer follow up on their decisions. Save most coaching for the debrief. Make the timer optional and keep help accessible in both modes.

On the case picker, show what the learner will actually do. “Design checkout and handle a payment timeout” is more informative than “Advanced HLD problem.” Let people browse by HLD, LLD, and skill, and give returning learners an obvious way to resume an unfinished case.

4. Let learners build their answers directly

Make the visual workspace the main way to express a design. A learner should be able to place an app server, add a database, connect them, and discuss the result without typing a paragraph or learning a diagramming tool.

• Start with a small, case-relevant component picker. Use clear names, recognizable shapes, and short descriptions on demand. Make additional components searchable and support custom labels.
• On desktop, support drag-and-drop placement and connecting components by their handles. Also support a simpler path on every device: select a component, choose “Connect to,” and select the destination. On touchscreens, make this tap-based path easy to discover.
• Show the direction of each connection. Offer relevant labels such as “reads from,” “sends request,” and “publishes event.” Allow editing, reconnecting, deleting, undo, redo, and auto-arrange. Keep the most common actions visible and reveal the others when relevant.
• Provide a keyboard-accessible way to add and connect items. Offer a readable list of components and relationships so the same task can be completed without precise pointer movement.
• Preserve the learner’s editable work when they open the brief, ask for help, switch views, or resume later.

Treat the design as an interview answer. When the learner chooses “Discuss my design,” use the actual components, connections, labels, and decisions they supplied. If they already connected a cache to the application, a useful follow-up is “A product’s price just changed. How does your design keep shoppers from seeing the old price?” If an arrow is ambiguous, let them clarify its meaning with a quick choice. Reserve typing for short explanations where hearing the learner’s reasoning adds value.

5. Give different interviews genuinely different activities

Keep navigation and editing controls familiar. Choose the main activity around the engineering decision each case teaches. Apply this principle across the existing case library. These examples illustrate the intended variety:

• Service architecture — In a delivery system, connect the services that handle an order, trace it from checkout to dispatch, and explore what the customer sees if dispatch goes offline.
• Low-level design — In a seat-reservation case, build the states of a seat, label the allowed transitions, and advance the clock to see what happens when a hold expires. In an object-design case, assign responsibilities to objects and walk through one interaction.
• Concurrency — Arrange two buyers’ reads and writes on a timeline. Predict the outcome, replay the sequence, and change the design so only one purchase succeeds.
• Data modeling — Connect records, select a key, and test whether the model can answer a concrete query. Introduce a second query that exposes a trade-off.
• Capacity and reliability — Adjust traffic or worker count, watch a queue grow or drain, and decide what should happen when a dependency slows down.

Give each stage one main interaction and one clear question. Use short Python snippets only where a few lines reveal a rule more clearly than a diagram. Keep coding exercises lightweight. Let learners demonstrate understanding by making a change, tracing an outcome, or explaining a choice in a sentence or two.

6. Make the interviewer respond to the learner’s decisions

Ask one meaningful question at a time. Acknowledge what the learner has already addressed. Choose follow-ups based on their design, their stated assumptions, and the requirements of the case. Accept different sound approaches. A simple architecture that meets the brief deserves a fair assessment.

At the right moment, introduce one changed condition. A payment succeeded but the reply timed out. A popular event sends most requests to one shard. A worker crashes after processing a message. Let the learner predict what their design will do, run a step-through where the case supports it, and revise their answer. Tie the outcome to an explicit rule in the simulation so the learner can understand why it happened.

If the workspace cannot determine something from the diagram, ask. For example, an arrow into a database does not establish that a write is atomic. Avoid grading invisible assumptions. Design the core experience around authored briefs, case rules, follow-ups, and worked solutions so it remains usable when an external AI service is unavailable.

7. Make getting unstuck part of the experience

Keep “I’m stuck” and “Show solution” easy to find at every substantive stage. Let the learner choose how much help they want. They may open the complete answer immediately.

• Hint — Ask a focused question that directs attention to the important decision.
• Walkthrough — Reveal the relevant sequence one step at a time, with a short explanation beside the current step.
• Stage solution — Show a worked answer to the question at hand and explain why it satisfies the brief.
• Full case solution — Show a coherent end-to-end design, trace a realistic request or interaction, discuss its main trade-off, and explain when another approach would make sense.

Preserve the learner’s work. Let them switch between “My design” and “Worked solution,” including on mobile. Highlight one consequential difference at a time. Where the designs are both valid, explain the trade-off. After help, offer “Try this step again” and “Continue with this design.” If the learner adopts a change, use that updated design in later questions. Record assisted stages privately so the learner can revisit them independently.

8. Give the workspace a finished product design

Make the first screen communicate three things at a glance: what the interviewer is asking, where the learner can act, and how to get help. Give the active diagram or exercise the most room. Keep the brief within reach, and reveal supporting detail as needed. On mobile, let the learner move between the brief, workspace, and feedback while preserving each view’s state.

Use deliberate typography, readable diagram labels, generous spacing, and color with a consistent purpose. Show selection, direction, success, and failure through labels or shapes as well as color. Make focus states visible. Test both light and dark themes if the product supports them.

Use motion to explain cause and effect. Animate a request traveling along the learner’s connection, a seat changing state, or a queue building up. Let the learner pause, step through, and replay consequential sequences. Respect reduced-motion settings. Favor a clear 2D diagram for editing. Use depth only when it makes a relationship easier to understand. Keep transitions quick and preserve the learner’s orientation when panels open or the interviewer responds.

9. End with feedback worth returning to

Ground the debrief in the attempt. Show one strong decision, the most consequential gap, and one concrete improvement. Refer to the actual design or interview stage as evidence. Where appropriate, let the learner jump directly back to that moment, apply a change, and replay the scenario.

Link to the relevant course lesson for concepts the learner struggled with. Offer three useful next actions when applicable: retry the difficult stage, replay the same case with a changed constraint, or attempt another case that tests the same skill in a different setting. Keep cases, hints, and worked solutions available to guests. Integrate signed-in saving and resuming with the existing progress system.

10. Verify the experience before calling it complete

Implement the changes across the published interview experience. Audit every published case for a clear brief, a suitable main activity, meaningful follow-ups, usable help, and a complete worked solution. Preserve existing learner progress and working routes.

Run the application and test the following journeys on desktop and a narrow mobile screen:

• A first-time guest enters a guided case, understands the first task, and makes a meaningful edit.
• A phone user adds two components, connects them, changes the connection, undoes the edit, and receives a relevant follow-up without typing a diagram description.
• A learner proposes a valid alternative to the reference design and gets feedback that recognizes its merits.
• A learner gets stuck on the first question, opens the full solution, returns to their own work, and retries that stage.
• A learner switches from an HLD architecture case to an LLD case and encounters a substantially different activity suited to the problem.
• A signed-in learner leaves midway and resumes with the same brief, interview stage, editable design, and decisions.
• Keyboard controls, reduced motion, and the core authored interview work as intended.

Start by taking one HLD case and one LLD case through the full experience. Use what you learn from those two to improve the shared components, then carry the upgrade through the case library. Work autonomously, checkpoint completed milestones according to the repository workflow, and keep a concise handoff with the last verified milestone and next unfinished task so an interrupted session can continue. Finish by reporting what shipped, which journeys you actually tested, and any remaining limitations.
