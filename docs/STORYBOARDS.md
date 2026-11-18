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
