# Project-wide design and motion instructions (2026-11-20) — saved verbatim

> Standing instructions for every screen. They sit above the Workbench Brief (`docs/MASTER_PROMPT.md`) and the
> Interview Simulator Brief (`docs/INTERVIEW_BRIEF_2026-11-20.md`) wherever they overlap. Conventions derived from
> them are in `CLAUDE.md` ("Design and motion conventions") and `docs/DESIGN.md`.

---

PROJECT-WIDE DESIGN AND MOTION INSTRUCTIONS

Apply these instructions throughout System Design Masterclass. They cover the homepage, curriculum explorer, expandable topic navigation, HLD and LLD lessons, visual simulations, practice exercises, interview simulator, worked solutions, sign-in, and saved progress. Include loading, empty, error, and resume states in the design. The audience is anyone who knows basic programming and is learning system design from scratch.

Set up the tools and use them

Check which of the following tools are available in this Claude Code environment. You have my permission to install the missing ones from their official sources. Prefer project-level setup where supported, reuse working installations, and verify what the active session can use.

• Figma — Install the official plugin with `claude plugin install figma@claude-plugins-official` if missing. Use Figma for shared layouts, responsive behavior, component states, and visual consistency. If account authorization requires my involvement, tell me the exact action once and continue the repository work in parallel.

• Impeccable — If missing, use `npx impeccable install` and select Claude Code for this project. Use it across the site to critique and refine typography, spacing, color, hierarchy, copy, and accessibility. Review the implemented screens at desktop and phone sizes.

• Motion Design & UI Animation — Install the `motion-design` skill from https://github.com/richtabor/agent-skills if missing. Use it for everyday product interactions such as expanding a topic, opening a drawer, switching lesson steps, connecting components, and restoring a saved session.

• Reference to Motion — Install `reference-to-motion` from https://github.com/charlie947/motion-graphics-skills if missing. When a reference recording is available, study how it directs attention, introduces information, and gives the learner time to think. Apply those observations to original interactions that fit this product.

• Huashu Art Motion — Follow the installation instructions at https://github.com/alchaincyf/huashu-art-motion if missing. Use it to storyboard concepts that benefit from motion, such as a request crossing services, a queue building up, or two operations racing. Implement instructional scenes as interactive, learner-controlled experiences wherever the learner can change the outcome.

Apply the tools according to the job each screen performs

1. Homepage. Let a first-time visitor experience the teaching style immediately. Give them one small, meaningful interaction, a clear “Start learning” action, and an easy way to explore the curriculum. Give a returning learner a direct route back to their saved place.

2. Navigation. Keep the curriculum within reach. On desktop, use a collapsible topic navigator. On mobile, use an accessible Topics drawer. Clicking a category reveals its modules, and clicking a module reveals its lessons. Show the active lesson, preserve expansion state, and keep the reading position stable. A learner should be able to switch topics without scrolling through the entire syllabus.

3. Lessons. Give each step one question, one visual focus, and a short explanation close to what it describes. Introduce terminology when it first becomes useful. Let learners predict, step through, pause, replay, and try a different input. Choose a visual form that teaches the concept: a timeline for concurrency, a state diagram for object behavior, or a request trace for service architecture. Keep Python snippets short and use them where seeing the code clarifies the idea.

4. Practice and interviews. Give learners an editable workspace and a clear task. Make adding, connecting, and changing components easy with a mouse, keyboard, or touch. Drive simulations, hints, and interviewer follow-ups from the learner’s actual decisions. Preserve their work when they open a solution or switch views.

5. Progress and account screens. Keep lessons and practice accessible to guests. Make it clear where work is saved and what signing in adds. When learners return, restore the useful context: the lesson step, the unfinished exercise, or the editable interview design.

Give the product a consistent identity while letting each activity feel distinct. Share typography, colors, controls, focus states, and motion conventions. Give the homepage room for discovery, the lesson reader room to concentrate, and the interview canvas room to build. Keep repeated actions fast. Give teaching animations enough time to reveal cause and effect. Support reduced motion with clear highlights, labels, and discrete steps.

Carry these decisions into the repository’s existing project instructions and shared components so future sessions inherit them. If a skill installation is blocked, record the specific limitation and continue with the available tools. Keep authoring tools separate from website runtime dependencies.

Before calling the revamp complete, test one continuous journey on desktop and mobile: arrive as a beginner, discover a topic, expand its module, complete a visual lesson, try a related exercise, use a hint, and return to saved work. Fix anything in that journey that feels cramped, confusing, slow, or disconnected. Make routine design decisions independently and implement the improvements end to end.
