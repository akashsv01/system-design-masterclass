# LLD interview scripts: fact-check

Scope: `src/content/interview/scripts/` lldParkingLot, lldElevator, lldVendingMachine, lldLibrary, lldExpenseSharing, lldLru, lldBoardGame, lldShoppingCart, lldNotifications, lldLiveScores, lldRateLimiter, lldScheduler, lldLogger (lldBooking untouched). Checked against `python/sdm/cases/*.py`, `python/sdm/lru_cache.py`, `rate_limit.py`, `src/content/cases/lld.ts`, and `runScenario` / `runTimeline` / `runQueue` in `src/sim/interview/sims.ts`. Every states scenario was run against a hand-written correct machine and a machine missing its key arrow; every queue activity was run for all arrival/worker/policy combinations. Final: `check-interview-script.ts` 0 errors, 0 warnings on all 13; `npx tsc -b` clean.

Recurring defect found: in a `states` activity the UI verdict is `stuck` whenever a step that has `expect` is refused. A step that the design should refuse therefore turned a correct design into "An event the brief allows was refused" and the `pass` rules never fired. Fixed by dropping `expect` from the deliberately refused step and, where needed, adding a later accepted step that still fails without the key arrow.

## lldParkingLot
Checked: park/leave/ticket claims against `parking_lot.py` (smallest fit, repeat plate, None when full), size comparison, timeline guards and predict outcome, rule replies.
- why.lot: "changes state under one lock" → "changes state in one step; the lock around it is added in the two-gates stage (the tested code is the single-threaded core)". The tested `ParkingLot` has no lock.
- trace step 2: "Under the lock:" → "Inside one locked step:" (same reason).

## lldElevator
Checked: `request`/`next_stop` (SCAN, floor range, reversal), 0-9 floors, door-timer scenario (passes with close arrow, stuck without), roles walk.
- palette Direction: "Up, down or idle." → "Up or down." (idle belongs to CarState; the class card and solution say UP, DOWN; Python uses +1/-1).
- roles walk step 3: owner `policy` → `elevator`, prompt "...next?" → "...next in version 1?". The tested code that the call shows lives in `Elevator.next_stop`; the card list already says StopPolicy is optional.

## lldVendingMachine
Checked: insert/select/cancel against `vending.py` (idle/has_money derived from balance, check order, change zeroing), money-conservation claims, both state scenarios.
- states scenario, minute 8 `select` (refused in Idle) had `expect: 'idle'`: a correct design scored `stuck`. Now: no `expect`, label "(refused)", plus new step "Minute 9: Mia inserts coins" expect `has_money` (accepted only if the timeout freed the machine; without the timeout the verdict is `stuck`). Walkthrough and `vm-timeout-missing` text updated to match.
- card scenario, minute 9 late `approved` (refused in Idle) had `expect: 'idle'`: same defect. Now no `expect`, label "(refused)", plus "Minute 10: Zoe taps a card" expect `awaiting_bank`. Walkthrough sentence added.

## lldLibrary
Checked: borrow/give_back against `library.py` (limit check, LookupError, ValueError), 3-day hold timing (Held entered at minute 1440, release fires at 5760, i.e. Friday 09:00), timeline guards.
- states scenario, Tuesday 19:00 refused borrow had `expect: 'held'`: correct design scored `stuck`. Now no `expect`, label "(refused)". Saturday borrow still catches a missing release arrow.
- Race stage said "Reserve the last free copy", contradicting the brief (reserve = queue for a title with no free copy). Reframed as two members pressing Borrow on the last free copy: question, announce, resource, read/write labels, all three guard labels/details/code (`copy.borrower is None` ... `copy.borrower = member_id`, `_borrow`), hint, walkthrough, solution ("no copy available" and may reserve instead), `why` ("at most one borrower"), and rule texts (`lib-reserve-one`, `lib-reserve-over`) now say borrow. Stage id and result key `reserve` unchanged. Stage title "Two reservations at once" → "Two borrowers at once".
- Not changed: `Library.give_back` on a copy that is not borrowed raises `KeyError(None)`; the script does not claim otherwise.

## lldExpenseSharing
Checked: `balances` (divmod, first people get the extra cent, payer credited) with the 10000 / 3334-3333-3333 / +6666 -3333 -3333 numbers; `settle` greedy (largest debtor to largest creditor); planQuery outcomes for the keys stage; payment-id guard.
- keys tradeoff "index": "one lookup per group she is in" → "one index lookup instead of asking every partition" (planQuery: an index on person is a single extra lookup).
- roles card `plan`: "fewest payments" → "fewest practical payments" (greedy is not minimal; clarify already says so).
- settle solution: "A lock ... does not help retries" → "... cannot tell a retry from a second genuine €20 payment" (the stated reason was inaccurate: a lock plus a re-read would also skip a repeat).
- design link Group→Ledger "has many" → "uses" (a group has one ledger).

## lldLru
Checked: Python `get`/`put`/`keys_by_recency` and `lru_ordered.py` (`move_to_end`, `popitem(last=False)`), the C,B,A walk (get A → A,C,B; put D evicts B → D,A,C), the separate trace (put D into C,B,A evicts A → D,C,B), the 2-of-3 race (2+2 = four entries, capacity+1), lock/GIL statements, shard-LRU caveat. No corrections needed. Note for the owner: the tested `lru_cache.py` has no lock; the script presents the lock as the design fix.

## lldBoardGame
Checked: `Board.place/wins` (gravity, taken cell, four directions, `win_length`), `tic_tac_toe()`/`connect_four()`, states scenario (passes; stuck without win arrow).
- roles walk used `board.place("X", col=2)` for tic-tac-toe, which raises "cell taken" (no row). Now "Ana plays row 0, column 2", `game.play(player="ana", row=0, col=2)`, `board.place("X", col=2, row=0)`.
- mustHold "one outcome: won, drawn or resigned" → "won (including by resignation) or drawn" (the machine and clarify answer treat resignation as a win for the other player).
- Race stage was wrong: Ana's move and Ben's move cannot both pass a `self.turn == player` check, so the check-then-act race never produces a double move between two players. Reframed as Ana's double tap (two moves for different cells from the same player): question, announce, names ("Ana (first tap)", "Ana (second tap)"), plain guard detail, move-number detail, walkthrough step, and the clarify answer on concurrent moves. The retried-move twist and rule replies are unchanged.

## lldShoppingCart
Checked: `Cart.add/subtotal/total`, `ten_percent_over` (threshold inclusive, integer division), `Money` (negative refused; currency mismatch is in `Money.add` and `Cart.add`), walk numbers (6000, 600, 5400).
- Two-tabs stage was wrong: a version check on the cart cannot stop two tabs taking "the last unit" (stock is not in the cart), and "sold out" cannot appear from the cart. Reframed as the real cart hazard, a lost update (phone adds shoes, laptop adds a lamp, both save from the same version): question, announce, resource, read/write, plain-guard detail, predict question, walkthrough, solution, `tabs-fixed`/`tabs-over` text and gap, and the "disable the button" option. Sim parameters unchanged (second save refused under the version check).

## lldNotifications
Checked: `Notifier.notify` (per-channel try/except, sent set keyed (id, user, channel), duplicate skipped), queue activity (arrival 80 / 4 workers: capacity 10/s while slow, shed and breaker bounded, wait and retry unbounded, breaker refuses every message in the slow window), retry states scenario (passes at 10:03 and 10:06 timer firings; stuck without them).
- palette Channel: "One method: send(user, message)" now notes that the tested code (and lld.ts) uses a plain callable per channel.

## lldLiveScores
Checked: `ScoreProcessor.receive/_apply` (dedupe by id, buffer by seq, drain in order, goals dict, score derived), states scenario, timeline guards.
- states scenario, 16:50 late goal (refused in Finished) had `expect: 'finished'`: correct design scored `stuck`. Now no `expect`, label "(refused)".
- roles walk: disallowed event "seq 7" → "seq 5" (consistent with the goal at seq 4, the trace and the order stage; seq 7 would have to wait for 5 and 6).
- order stage: start order had seq 5 writing before seq 4, so the sim's conditional guard showed the out-of-order seq 5 write succeeding, contradicting "saved only if last_seq is n-1". Start order is now A (seq 4) then B (seq 5), so the refused write is seq 5. Predict question reworded ("Both workers save from version 3 without a check...") and the walkthrough line "a goal can reappear or a correction be lost" → "the goal or the correction can be silently lost".
- Not changed: the Python `MatchState` has no status and does not ignore events after full time; the script's `MatchStatus`/Finished rule is design-level and the only tested snippet cited is `_apply`.

## lldRateLimiter
Checked: `TokenBucket.allow` and `KeyedLimiter` (lock around map + spend), the 11th-request arithmetic (0.2 tokens after 10 spends in 100 ms at 2/s), timeline guards, memory-state scenario (passes; stuck without the full-bucket arrows), LRU/sweep claims, "Python threads never collide" reply (correct: threads can be paused between check and decrement). No corrections needed.

## lldScheduler
Checked: `TaskScheduler.schedule/run_due` (heap of (at, seq, task), tie-break, injected clock), retry timeline (retry fires 10:03, success 10:04; passes, stuck without the timed arrow), claim/lock claims.
- roles walk step 2: `scheduler.take_due(now)` (not in the tested code) → `heappop(self._heap)  # earliest (due, seq) first, once due <= now`.
- Not changed: the tested scheduler has no lock and no try/except; the script says to add the try/except and presents the lock as the race fix.

## lldLogger
Checked: `Logger.log` (level check before formatting, sorted fields, one lock around fan-out), levels and default INFO, line format "ERROR payment failed seat=F12", queue activity (800 lines/s, disk 1000 to 250 lines/s for 30 s: 550/s backlog, wait unbounded, shed bounded at about 2 s of lines, breaker bounded). No corrections needed. The tested logger does not catch sink exceptions; the script raises that as a rule question, not as an existing behaviour.
