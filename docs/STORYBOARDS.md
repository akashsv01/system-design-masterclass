# Flagship storyboards

Each row records what the learner already knows, the event, the state change, and what they should notice.
The UI derives text, diagram, clock and values from the simulation state named in the last column.

## 1. first-booking — "Two buyers see one seat left. Who gets it?" (guided trace)

| # | Learner knows | Event | State change | Notice | Sim state |
|---|---|---|---|---|---|
| 1 | Nothing | — | Maya's phone shows "F12 · 1 left" | A phone shows things; it does not decide | none |
| 2 | Phone = client | Learner presses **Reserve** | Request token phone → server | A request is a message asking for something; the server is a program that answers it | `runReservation([Maya])` event `send` |
| 3 | Request, server | Server reads F12 | DB tag "F12: available" lights up | The database is where the truth about the seat lives | event `read` |
| 4 | Database | Server writes Maya | DB value `available → booked · Maya`, tag "was: available" | One stored value changed — that change *is* the booking | event `write` |
| 5 | Write | Reply returns | Response token server → phone; phone "Confirmed ✓" | Response = answer to the request | event `reply` |
| 6 | Full round trip | Quick check | — | Where does the seat's truth live? (database) | — |
| 7 | One buyer works | Reset to 19:59:59; Leo appears | Two phones both show "1 left" | Both screens are correct *right now* | initial |
| 8 | Two phones | **Predict**: both press within 5 ms. What happens? | — | Commit to a guess | — |
| 9 | Prediction | Learner presses **Run the race** | Events play in time order; both reads see "available"; both writes; both replies "Confirmed" | Two confirmations, one seat. Last write wins in storage | `runReservation([Maya@0, Leo@5], 'check-then-write')` |
| 10 | The race | Save a sketch/explanation | Draft saved (`draft:first-booking:race`) | Their own words are kept for later | — |
| 11 | The bug exists | HLD view | Components: apps, booking service, seat store, payment provider; ownership tag on seat store | One part owns availability; everyone else asks it | static |
| 12 | Ownership | LLD view: seat states | available → held → booked; held → available on expiry | The rule: *available → held* must be checked and changed in one step | `transition()` |
| — | — | Next lesson | — | "What's inside a request?" — because they sent one without opening it | — |

## 2. replica-lag — "Why does my profile still show my old name?" (timeline experiment)

| # | Learner knows | Event | State change | Notice | Sim |
|---|---|---|---|---|---|
| 1 | Client/server/DB | — | Leader "Sam", follower "Sam", clock 10:00:00 | Two copies; only one accepts updates | `stateAt(t=T0, wrote=false)` |
| 2 | Two copies | Learner presses **Save Alex** | Write token → leader; leader "Alex" (tag "was: Sam"); follower still "Sam"; copy token waits on the edge | Saved ≠ copied | `stateAt(WRITE_AT)` |
| 3 | Copy pending | Clock 10:00:01. **Predict**: read from follower → which name? | After answer: read token profile → follower → "Sam" | Both screens tell the truth about their own copy | `readProfile(T0+1000)` |
| 4 | Stale read | Clock 10:00:02 | Copy token reaches follower; follower "Alex". Term *replication lag* introduced | Lag = time between leader write and follower apply | `stateAt(T0+2000)` |
| 5 | Lag | Slider lag 0–3000 ms; strategy choice; replay | Stale-read % and "Saved" delay update | Each fix moves the cost somewhere: leader load, or slower saves | `staleFraction`, `stateAt` |

## 3. lru-cache — "Which item should the cache forget?" (behaviour → implementation)

| # | Learner knows | Event | State change | Notice | Sim |
|---|---|---|---|---|---|
| 1 | Cache stores copies; small | — | Three slots: C, B, A (most → least recent) | Order means recency, not insertion | `runLru` after 3 puts |
| 2 | Recency row | Learner presses **read A** | A slides to front: A, C, B | A read changes order | step `get A` |
| 3 | Reads reorder | **Predict**: put D evicts which? | After answer: B leaves, D enters front | Least recently *used*, not least recently *added* | step `put D` |
| 4 | Behaviour | Free play: get/put buttons, capacity 3 | Row updates | Learner tests own hypotheses | `LruCache` |
| 5 | Behaviour solid | Implementation view: map + linked list | Highlight Python line ids from trace while diagram shows pointers | Map finds a node in O(1); list keeps order in O(1) | `lines` |
| 6 | Implementation | Exercise: trace a sequence; Python comparison | Graded answer | Can predict final order | — |


---

# Interview workspace storyboards (2026-11-20)

Method: huashu-art-motion's shot-list discipline (one idea per beat, hold still while the learner reads, slow
moves to guide the eye and fast ones only for the consequence, the subject large in frame, deterministic), applied
to *live, editable* scenes rather than rendered video. Every beat below is a state of the real workspace that the
learner can pause, step, edit and replay. Durations follow the motion-design tokens: 120–240 ms for feedback on
repeated actions, 600–900 ms per hop only for illustrative travel, and no motion at all under reduced motion.

## S1 — “Trace a request through *your* design” (HLD build stage)

| # | Beat (what the learner sees) | Motion | Hold / control |
|---|---|---|---|
| 1 | Their own parts and arrows; the request chip (“View the seat map”) sits on their client. | none | Holds until **Trace**. |
| 2 | The chip travels along *their* first arrow; the arrow brightens behind it; the arrived-at part gets a ring and a one-line note (“App server: handles the request”). | 700 ms ease-in-out per hop | **Pause / Step** between hops; hop counter “1 of 2”. |
| 3 | The chip reaches the part that answers (their database). A reply chip returns along the same arrows. | 500 ms per hop back | Readout: “2 hops to the source of truth”. |
| 4 | The interviewer reacts to *what was traced*: every view reads the database, so asks what protects it at the on-sale spike. | panel enters 180 ms | One question, quick choices. |
| 5 | Learner selects the App server → Database arrow and chooses **Insert a part here → Cache**; the arrow splits around the new part. | 180 ms ease-out | Undo restores the single arrow. |
| 6 | **Replay**: the chip now stops at their cache (hit) and returns from there; toggle **Miss** and it continues to the database. | as 2–3 | Readout changes: “1 hop: answered by Seat-map cache (hit)”. |
| 7 | The interviewer’s next question names *their* cache: “A seat was just held. How does Seat-map cache stop the map showing it as free?” | 180 ms | Quick choices; one free-text sentence optional. |

Rule shown beside the trace: *A request moves along your arrows. A read stops at the first cache that has the
data (a hit) and continues past it on a miss. It fails if a part on its synchronous path is offline; work handed
to a queue waits there.*

## S2 — “Two buyers, one seat” (concurrency stage)

| # | Beat | Motion | Hold / control |
|---|---|---|---|
| 1 | Two lanes (Ana, Ben) and four operation cards in the learner’s order; the seat counter shows 1. | none | Learner reorders cards (drag or ↑/↓). |
| 2 | Learner predicts: one sale, two sales, or none. | none | Run is locked until a prediction is chosen. |
| 3 | Run: each card lights in turn; reads show the value each buyer *saw*; writes change the counter. | 600 ms per op | Pause / Step / Replay. |
| 4 | Consequence: two green “confirmed” stamps and the counter at −1 → “Sold twice”. | 240 ms emphasis | Rule printed under the result. |
| 5 | Learner switches the write to *conditional* (or a lock) and replays the same order. | as 3 | Second write is refused; one stamp. |

## S3 — “The hold expires” (LLD state machine)

| # | Beat | Motion | Hold / control |
|---|---|---|---|
| 1 | The learner’s states and labelled arrows; the current state is filled. | none | Edit freely. |
| 2 | **Advance the clock** one event at a time; the active state moves along the learner’s arrow for that event. | 300 ms | Step / Replay; the log lists accepted and refused events. |
| 3 | At 10 minutes the timed arrow fires on its own — *only if the learner drew it*. Without it the seat stays Held and Ben’s reserve is refused. | 300 ms + log line | The difference from the expected outcome is flagged with a label, not only colour. |
