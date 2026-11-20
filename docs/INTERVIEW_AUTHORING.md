# Authoring interview scripts — shared instructions

Repository: /home/user/system-design-masterclass (TypeScript/React; learners know basic programming and are new to system design).
An interview script drives a visual interview simulator: an interviewer briefs the learner, the learner builds/acts in a
workspace, the interviewer follows up on the learner's actual diagram and decisions, a help ladder (hint → walkthrough →
stage solution → full solution) is always available, and a debrief cites strengths and gaps. All authored data; no AI at runtime.

## Read first (do not modify)
- src/content/interview/types.ts (schema), src/sim/interview/rules.ts (Cond, Rule, {type:x}/{kind:x} placeholders),
  src/sim/interview/sims.ts (RULES text, what each simulation does), src/sim/interview/graph.ts (Sel, CompKind),
  src/content/interview/catalogue.ts (kinds, verbsFor).
- Exemplars that set the bar: src/content/interview/scripts/ticketBooking.ts (HLD) and lldBooking.ts (LLD).
- How the UI uses scripts: src/ui/interview/activities.tsx and src/ui/interview/Session.tsx.
- Existing case content to stay consistent with: src/content/cases/hld1.ts, hld2.ts, hld3.ts, lld.ts (prompt, assumptions,
  reference diagram, stages, hints, references, alternatives, checks, rubric). Reuse its facts/numbers; never contradict them.
- Lesson ids (`lessons`, `gap.lesson`) must exist in src/content/manifest.ts (grep the id).
- Python only via `py('sdm/cases/<file>.py', 'fn')` from '../../lessons/_kit', only for files/functions that exist in python/sdm/.

## Result keys rules can test ({ result: key, is: value })
build traces → `trace:<traceId>` = ok|hit|broken · trace activity → `<stageId>` = ok|error|delayed|broken ·
timeline → `<stageId>` = one|oversold · states → `<stageId>` = pass|stuck|fail · roles → `<stageId>` = pass|gaps ·
model → `<stageId>:q1`, `<stageId>:q2` = one-partition|index|scatter and `<stageId>:tradeoff` = tradeoff id ·
queue → `<stageId>` = `<policyId>:bounded` | `<policyId>:unbounded`.
Answers: { answer: '<ruleId>', is: '<choiceId>' }; assumptions { answer: 'assume:<id>', is: '<optionId>' }.
States: arrow labels are event ids; scenario `at` is in minutes; a timer event fires `after` minutes after entering its source state.
Timeline: `initial` = units available; plain = check-then-write; conditional = compare-and-set; lock = second reader waits.

## Requirements (the audit enforces most)
- Brief: believable interviewer (name + role), who it is for, needs, what must work correctly, constraints with numbers
  consistent with the case, out of scope where useful, unfamiliar terms defined, a concrete first move in the interviewer's voice.
- Stage 1 is clarify: ≥4 questions with answers consistent with the brief, ≥1 genuine assumption with consequences.
- Each stage: one main interaction, one clear question, a 1–2 sentence guided intro; help = focused hint question,
  ≥2 walkthrough steps (focus ids must be solution component ids), a stage solution (Block[]), why it satisfies the brief; lessons.
- One stage carries `change` (announce + rule from RULES; `alternate` where a second twist makes sense).
- Palette: 5–9 case-relevant parts (clear names, one-line blurbs). LLD cases may use class/enum/iface/state kinds.
- Rules: ≥3 `ask` (2–3 choices, each with reply + verdict sound|partial|risky; accept different sound approaches), `ack`
  lines naming what the learner did, guided `coach` lines for first moves, ≥1 `strength`, ≥1 `gap` (text, fix, stage, lesson),
  ≥1 rule recognising a valid alternative to the reference design and asking about its trade-off, and questions about what the
  diagram cannot show (e.g. an arrow into a database does not prove a write is atomic). Every stage except clarify should have
  at least one rule reacting to it.
- Worked solution: ≤9 components, positions within 640×440 laid out left→right, `why` for every component, alternatives where
  valid, a realistic traced request/interaction (solution component ids), the main trade-off, when another approach makes sense.
- Writing: original, precise, plain English; short sentences; exemplars' tone. No invented citations. doLine ≤170 chars, phrased
  as what the learner will do ("Design checkout and handle a payment timeout").

## Output and validation
- One new file per case in src/content/interview/scripts/, camelCase export `export const <name>: InterviewScript`.
- DO NOT edit index.ts or any existing file; do not build, start servers or commit. Other agents write other files in parallel;
  ignore errors in files that are not yours.
- Validate until clean: `cd /home/user/system-design-masterclass && npx tsx scripts/check-interview-script.ts <your files>`
  → 0 errors each; `npx tsc -b 2>&1 | grep <your file names>` → empty.
- Final report (short): files + export names, each case's stage list (id: activity kind), remaining warnings.
