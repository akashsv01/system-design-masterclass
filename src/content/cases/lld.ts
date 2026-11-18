import { LLD_RUBRIC, type CaseStudy } from './_case';
import { e, layout, n, py } from '../lessons/_kit';
import type { Block } from '../lessonTypes';
import type { CaseStageKind } from '../caseTypes';

type St = { kind: CaseStageKind; title: string; task: string; hints?: string[]; ref: Block[]; focus?: string[] };

/** Builds an LLD case with a class diagram laid out in up to two rows (wide) / two columns (phone). */
function lld(o: {
  id: string; prompt: string; assumptions: string[]; classes: [string, string, string?][]; links: [string, string, string?][]; stages: St[];
  checks: CaseStudy['checks']; rubric: Parameters<typeof LLD_RUBRIC>[0]; pairedWith?: string; alternatives?: CaseStudy['alternatives'];
}): CaseStudy {
  const ids = o.classes.map((c) => c[0]);
  const perRow = Math.ceil(ids.length / 2);
  const slots: Record<string, [{ x: number; y: number; w: number }, { x: number; y: number; w: number }]> = {};
  ids.forEach((id, i) => {
    const row = Math.floor(i / perRow);
    const colInRow = i % perRow;
    const count = row === 0 ? perRow : ids.length - perRow;
    slots[id] = [{ x: (820 / (count + 1)) * (colInRow + 1), y: row === 0 ? 80 : 230, w: Math.min(200, 760 / count - 20) }, { x: i % 2 === 0 ? 92 : 268, y: 50 + Math.floor(i / 2) * 130, w: 164 }];
  });
  return {
    id: o.id, prompt: o.prompt, assumptions: o.assumptions, pairedWith: o.pairedWith, alternatives: o.alternatives,
    diagram: { nodes: o.classes.map(([id, label, sub]) => n(id, 'box', label, { sub })), edges: o.links.map(([a, b, l]) => e(a, b, l)), ...layout(310, 50 + Math.ceil(ids.length / 2 - 1) * 130 + 50, slots) },
    stages: o.stages.map((s) => ({ kind: s.kind, title: s.title, task: s.task, hints: s.hints ?? [], reference: s.ref, view: s.focus ? { states: Object.fromEntries(s.focus.map((f) => [f, 'focus' as const])) } : undefined })),
    checks: o.checks,
    rubric: LLD_RUBRIC(o.rubric),
  };
}

const code = (path: string, fn?: string, caption?: string): Block => ({ type: 'code', lang: 'python', code: py(path, fn), caption: caption ?? `python/${path} — tested with pytest` });
const choice = (id: string, prompt: string, right: [string, string], wrong: [string, string]): CaseStudy['checks'][number] => ({ kind: 'choice', id, prompt, choices: [{ id: 'r', text: right[0], why: right[1] }, { id: 'w', text: wrong[0], why: wrong[1] }], correct: 'r' });

export const LLD_CASES: CaseStudy[] = [
  lld({
    id: 'lld-parking-lot', prompt: 'Design the classes for a parking lot.',
    assumptions: ['Spots are small, medium or large; a vehicle fits its size or larger.', 'A ticket is issued on entry; payment on exit is out of scope for v1.'],
    classes: [['lot', 'ParkingLot', 'park(), leave()'], ['spot', 'Spot', 'size, vehicle'], ['size', 'Size (Enum)', 'S / M / L'], ['ticket', 'tickets: dict', 'plate → Spot']],
    links: [['lot', 'spot', 'has many'], ['spot', 'size'], ['lot', 'ticket']],
    stages: [
      { kind: 'clarify', title: 'Rules first', task: 'Which rules decide where a car parks?', ref: [{ type: 'list', items: ['A vehicle fits a spot of its size or larger; prefer the smallest that fits.', 'One vehicle per spot, one spot per vehicle.', 'Lot full → no ticket.'] }] },
      { kind: 'model', title: 'Who owns what?', task: 'Which class decides which spot a car gets?', focus: ['lot'], ref: [{ type: 'p', text: 'The ParkingLot owns the spots and the plate → spot map, so it decides allocation. A Spot only knows its size and occupant; Size is an Enum so sizes compare by value.' }] },
      { kind: 'invariants', title: 'The invariants in code', task: 'Point to where “one spot per vehicle” is enforced.', focus: ['lot', 'ticket'], ref: [code('sdm/cases/parking_lot.py', 'park')] },
      { kind: 'change', title: 'Change: electric charging spots', task: 'Some spots have chargers; EVs prefer them. What changes?', ref: [{ type: 'p', text: 'Add a `features` set to Spot and pass a preference into `park` (or a strategy that ranks fitting spots). Allocation stays in one method, and the ranking rule is the only new code.' }] },
    ],
    checks: [choice('q1', 'Where should spot allocation live?', ['ParkingLot.park()', 'It owns the spots and the ticket map.'], ['In each Spot', 'A single spot can’t see the others to choose the best fit.'])],
    rubric: { responsibilities: 'ParkingLot allocates; Spot holds state; Size is a value.', interfaces: 'park(plate, size) → spot id or None; leave(plate).', invariants: 'One vehicle per spot and per plate, checked in park().', tests: 'Smallest fit, full lot, double park rejected, leave frees the spot.', adaptability: 'Charging spots or pricing added without rewriting allocation.' },
  }),
  lld({
    id: 'lld-elevator', prompt: 'Design an elevator controller.',
    assumptions: ['One car, N floors; requests come from buttons inside and outside.', 'Serve requests efficiently without starving any floor.'],
    classes: [['ctl', 'Elevator', 'request(), next_stop()'], ['stops', 'stops: set', 'requested floors'], ['dir', 'direction', '+1 up / −1 down']],
    links: [['ctl', 'stops'], ['ctl', 'dir']],
    stages: [
      { kind: 'clarify', title: 'What is “fair”?', task: 'Should the car always go to the nearest request?', ref: [{ type: 'p', text: 'Nearest-first can bounce between two busy floors and starve a distant one. Continuing in one direction until no requests remain ahead, then reversing (the SCAN idea, like a lift sweeping a building), bounds every wait.' }] },
      { kind: 'model', title: 'State and decisions', task: 'What state does the controller need?', focus: ['ctl'], ref: [code('sdm/cases/elevator.py')] },
      { kind: 'tests', title: 'Test the order', task: 'At floor 0 going up, with requests 5, 2, 8, what order is served, and what if 1 is requested after reaching 8?', ref: [{ type: 'p', text: '2, 5, 8 (sweep up), then 1 (reverse). The pytest suite asserts exactly this.' }] },
      { kind: 'change', title: 'Change: three cars', task: 'With three cars, who decides which car takes a hall call?', ref: [{ type: 'p', text: 'Add a Dispatcher that assigns hall calls to the car with the lowest estimated arrival; each Elevator keeps its own SCAN logic. Concurrency: the dispatcher serialises assignments so two cars aren’t sent to the same call.' }] },
    ],
    checks: [choice('q1', 'Why not always serve the nearest request?', ['A distant floor can wait forever while two near floors keep calling', 'SCAN bounds waiting time.'], ['It’s slower to compute', 'It’s not about computation; it’s fairness.'])],
    rubric: { responsibilities: 'Elevator owns stops and direction; dispatcher (later) assigns cars.', interfaces: 'request(floor), next_stop().', invariants: 'Floor in range; each stop served once.', tests: 'Sweep order, reversal, invalid floor.', adaptability: 'Multiple cars via a dispatcher without changing each car.' },
  }),
  lld({
    id: 'lld-vending-machine', prompt: 'Design a vending machine.',
    assumptions: ['Coins add to a balance; select an item; get item and change; cancel refunds.'],
    classes: [['vm', 'VendingMachine', 'insert(), select(), cancel()'], ['state', 'state', 'idle / has_money'], ['stock', 'prices, stock', 'per item']],
    links: [['vm', 'state'], ['vm', 'stock']],
    stages: [
      { kind: 'clarify', title: 'States and actions', task: 'List the states and which actions are valid in each.', ref: [{ type: 'table', head: ['State', 'insert', 'select', 'cancel'], rows: [['idle', '→ has_money', '“insert money first”', 'refund 0'], ['has_money', 'add to balance', 'dispense or explain why not', 'refund balance → idle']] }] },
      { kind: 'model', title: 'The machine', task: 'Read the worked design. Where is each rule enforced?', focus: ['vm'], ref: [code('sdm/cases/vending.py')] },
      { kind: 'invariants', title: 'Money is conserved', task: 'State an invariant about money and where it holds.', ref: [{ type: 'p', text: 'Money in = price of items dispensed + change returned + refunds. `select` returns change and zeroes the balance in one step; `cancel` refunds everything. No path keeps money without dispensing or refunding.' }] },
      { kind: 'change', title: 'Change: card payments', task: 'Card payments are authorised by a bank and can fail. What changes?', ref: [{ type: 'p', text: 'Add a state `awaiting_payment` with a payment strategy (coins or card) injected. Card authorisation failures return to idle with nothing dispensed. With more states, State classes start to pay off ([State pattern](/learn/pattern-state)).' }] },
    ],
    checks: [choice('q1', 'A customer selects an item with no money inserted. Best response?', ['“Insert money first”, state unchanged', 'Every action is checked against the current state.'], ['Dispense it and charge later', 'That breaks the money invariant.'])],
    rubric: { responsibilities: 'Machine owns balance, stock and state checks.', interfaces: 'insert(cents), select(item) → (message, change), cancel() → refund.', invariants: 'Money conserved; stock never negative.', tests: 'Each state × action, sold out, exact change, cancel.', adaptability: 'New payment methods via an injected strategy and a new state.' },
  }),
  lld({
    id: 'lld-library', prompt: 'Design a library management system.',
    assumptions: ['Books have many copies; members borrow up to a limit; returns free the copy.'],
    classes: [['lib', 'Library', 'borrow(), give_back()'], ['copy', 'Copy', 'copy_id, isbn, borrower'], ['member', 'Member', 'loans, max_loans']],
    links: [['lib', 'copy', 'has many'], ['lib', 'member', 'has many'], ['member', 'copy', 'borrows']],
    stages: [
      { kind: 'clarify', title: 'Books vs copies', task: 'Why distinguish a book (ISBN) from a copy?', ref: [{ type: 'p', text: 'Members borrow a physical copy; availability is per copy, while search and metadata are per book. Copies are entities (each has an id and a borrower); the ISBN is a value.' }] },
      { kind: 'model', title: 'Borrowing', task: 'Read `borrow`. Which two rules does it enforce?', focus: ['lib'], ref: [code('sdm/cases/library.py', 'borrow')] },
      { kind: 'tests', title: 'Edge cases', task: 'List three tests you’d write.', ref: [{ type: 'list', items: ['Loan limit reached → error.', 'No copy available → error (and maybe a reservation later).', 'Return frees the copy and the member’s loan slot.'] }] },
      { kind: 'change', title: 'Change: reservations', task: 'Members can reserve a book with no copies available.', ref: [{ type: 'p', text: 'Add a per-ISBN reservation queue. On return, offer the copy to the first reserver (held for 3 days) instead of making it available. That’s a small state machine per copy: available → held_for(member) → borrowed.' }] },
    ],
    checks: [choice('q1', 'Availability should be tracked per…', ['Copy', 'Each physical copy is borrowed independently.'], ['Book title', 'A title can have five copies, three of them out.'])],
    rubric: { responsibilities: 'Library coordinates; Copy and Member hold their state.', interfaces: 'borrow(member, isbn) → copy id; give_back(copy).', invariants: 'Loan limit; a copy has at most one borrower.', tests: 'Limit, unavailability, return.', adaptability: 'Reservations as a copy state machine.' },
  }),
  lld({
    id: 'lld-expense-sharing', prompt: 'Design an app for splitting expenses among friends.',
    assumptions: ['Expenses are split equally among chosen people; amounts in cents.', 'Show who owes whom, with as few payments as practical.'],
    classes: [['exp', 'Expense', 'payer, amount, people'], ['bal', 'balances()', 'net per person'], ['settle', 'settle()', 'payments to zero out']],
    links: [['exp', 'bal'], ['bal', 'settle']],
    stages: [
      { kind: 'clarify', title: 'Money is integers', task: 'Why store cents as integers, and what about €100 split three ways?', ref: [{ type: 'p', text: 'Floating-point money accumulates rounding errors. Use integer cents and distribute the leftover cent(s) deterministically: €100 → 3334, 3333, 3333. The invariant: balances always sum to exactly zero.' }] },
      { kind: 'model', title: 'Net balances', task: 'Read `balances`. Where are leftover cents handled?', focus: ['bal'], ref: [code('sdm/cases/expenses.py', 'balances')] },
      { kind: 'critical-path', title: 'Settling up', task: 'Ana is owed €60; Ben owes €15; Cleo owes €45. Which payments settle it?', focus: ['settle'], ref: [{ type: 'p', text: 'Cleo pays Ana €45 and Ben pays Ana €15. The greedy algorithm matches the largest debtor with the largest creditor repeatedly.' }, code('sdm/cases/expenses.py', 'settle')] },
      { kind: 'change', title: 'Change: unequal splits', task: 'Support “Ana 50%, Ben 30%, Cleo 20%”.', ref: [{ type: 'p', text: 'Represent each expense’s split as a strategy that returns per-person shares summing exactly to the amount (equal, percentages, exact amounts). `balances` stays the same; only share calculation varies.' }] },
    ],
    checks: [choice('q1', 'What invariant must every set of balances satisfy?', ['They sum to exactly zero', 'Money owed equals money due.'], ['Everyone’s balance is non-negative', 'Debtors have negative balances by definition.'])],
    rubric: { responsibilities: 'Pure functions for balances and settlement; expenses as data.', interfaces: 'balances(expenses) → dict; settle(balances) → payments.', invariants: 'Integer cents; balances sum to zero.', tests: 'Remainders, sum to zero, settlement correctness.', adaptability: 'Split strategies for unequal shares.' },
  }),
  lld({
    id: 'lld-logger', prompt: 'Design a logging library.',
    assumptions: ['Levels DEBUG < INFO < WARNING < ERROR; multiple outputs (console, file); used from many threads.'],
    classes: [['log', 'Logger', 'log(level, msg, **fields)'], ['sink', '«protocol» Sink', 'write(line)'], ['mem', 'MemorySink', 'for tests'], ['file', 'FileSink', 'appends']],
    links: [['log', 'sink', 'writes to'], ['mem', 'sink', 'implements'], ['file', 'sink', 'implements']],
    stages: [
      { kind: 'clarify', title: 'Requirements', task: 'Which requirements shape the design?', ref: [{ type: 'list', items: ['Filter by level cheaply (skip formatting for hidden levels).', 'Structured fields (seat=F12) for searching.', 'Thread safety: lines must not interleave.', 'Pluggable outputs.'] }] },
      { kind: 'model', title: 'Logger and sinks', task: 'Read the design. How does it stay safe across threads?', focus: ['log', 'sink'], ref: [code('sdm/cases/logger.py', 'Logger')] },
      { kind: 'tests', title: 'Testing a logger', task: 'How do you test it without files?', ref: [{ type: 'p', text: 'Inject a MemorySink and assert on its lines; run four threads logging 200 lines each and check there are exactly 800 intact lines.' }] },
      { kind: 'change', title: 'Change: async writes', task: 'Writing to a slow disk blocks request threads. What would you change?', ref: [{ type: 'p', text: 'Put a queue in front of slow sinks: `log` enqueues, a background thread writes. Add a bounded queue and a policy when it’s full (drop DEBUG first). That’s a Decorator around a sink.' }] },
    ],
    checks: [choice('q1', 'Why check the level before formatting the message?', ['So hidden DEBUG logs cost almost nothing', 'Formatting is the expensive part.'], ['It’s required by Python', 'It’s a performance choice.'])],
    rubric: { responsibilities: 'Logger filters and formats; sinks only write.', interfaces: 'Sink protocol with write(line).', invariants: 'Lines never interleave; levels respected.', tests: 'Level filtering, concurrency, sink injection.', adaptability: 'Async or remote sinks via decorators.' },
  }),
  lld({
    id: 'lld-notifications', pairedWith: 'case-notifications', prompt: 'Design the notification sender inside the notification service.',
    assumptions: ['A notification goes to each of a user’s preferred channels.', 'A channel can fail; a retried notification must not be sent twice on a channel.'],
    classes: [['n', 'Notifier', 'notify(id, user, msg)'], ['ch', 'Channel', 'callable(user, msg)'], ['prefs', 'prefs', 'user → channels'], ['sent', 'sent set', '(id, user, channel)']],
    links: [['n', 'ch', 'uses'], ['n', 'prefs'], ['n', 'sent']],
    stages: [
      { kind: 'clarify', title: 'Partial success', task: 'Email succeeds, SMS fails. Is the notification “sent”?', ref: [{ type: 'p', text: 'Track status per channel. Report partial success, retry only the failed channel, and never resend the successful one.' }] },
      { kind: 'model', title: 'Channels as strategies', task: 'Read the design. Why are channels plain functions?', focus: ['n', 'ch'], ref: [code('sdm/cases/notifier.py', 'Notifier')] },
      { kind: 'invariants', title: 'At most once per channel', task: 'Where does the design prevent duplicate sends on a retry?', focus: ['sent'], ref: [{ type: 'p', text: 'The `sent` set keyed by (notification id, user, channel) is checked before sending and updated after success. In production this lives in the delivery log (durable), not memory ([HLD case](/cases/case-notifications)).' }] },
      { kind: 'change', title: 'Change: quiet hours', task: 'Non-critical notifications must wait until morning in the user’s time zone.', ref: [{ type: 'p', text: 'Inject a clock and a policy function `may_send(user, priority, now)`; deferred notifications get a not-before time. Keep the policy out of the channels so every channel obeys it.' }] },
    ],
    checks: [choice('q1', 'A retried notification reaches the Notifier. Email already succeeded. What should happen?', ['Skip email, retry only failed channels', 'Dedup per (id, user, channel).'], ['Resend all channels', 'Users would get duplicate emails.'])],
    rubric: { responsibilities: 'Notifier orchestrates; channels deliver; prefs decide where.', interfaces: 'Channel = callable(user, message).', invariants: 'At most one successful send per (notification, user, channel).', tests: 'Partial failure, dedup, preferences.', adaptability: 'New channels as functions; policies injected.' },
  }),
  lld({
    id: 'lld-lru', prompt: 'Implement an LRU cache (machine-coding round).',
    assumptions: ['get(key) and put(key, value) in O(1); fixed capacity.'],
    classes: [['cache', 'LRUCache', 'get(), put()'], ['index', 'dict', 'key → Node'], ['list', 'doubly linked list', 'head = most recent']],
    links: [['cache', 'index'], ['cache', 'list']],
    stages: [
      { kind: 'clarify', title: 'Contract', task: 'What does get return on a miss, and does put on an existing key evict?', ref: [{ type: 'p', text: 'Miss returns None. Put on an existing key updates and moves it to the front, with no eviction. Capacity < 1 is an error. Say these out loud before coding.' }] },
      { kind: 'model', title: 'Two structures', task: 'Why both a dict and a linked list?', focus: ['index', 'list'], ref: [{ type: 'p', text: 'The dict finds a node in O(1); the linked list moves or removes it in O(1). Full walkthrough: [LRU lesson](/learn/lru-cache).' }, code('sdm/lru_cache.py', 'put')] },
      { kind: 'tests', title: 'Tests interviewers look for', task: 'List four test cases.', ref: [{ type: 'list', items: ['Read protects from eviction.', 'Update doesn’t evict.', 'Miss changes nothing.', 'Capacity 1; randomized comparison against OrderedDict.'] }] },
      { kind: 'change', title: 'Change: thread safety', task: 'Two threads call put at once. What breaks and what’s the simplest fix?', ref: [{ type: 'p', text: 'Pointer updates interleave and corrupt the list. Wrap get and put in one lock (`with self._lock:`). Simple and correct; shard into several caches if the lock becomes a bottleneck.' }] },
    ],
    checks: [choice('q1', 'Which structure makes moving an entry to the front O(1)?', ['A doubly linked list', 'Unlink and push front touch only neighbours.'], ['A Python list', 'Removing from the middle shifts elements.'])],
    rubric: { responsibilities: 'Cache class hides nodes and pointers.', interfaces: 'get(key) → value | None; put(key, value).', invariants: 'dict and list always hold the same keys; size ≤ capacity.', tests: 'Eviction order, update, miss, capacity 1, randomized.', adaptability: 'Thread safety and TTLs addable.' },
  }),
  lld({
    id: 'lld-rate-limiter', prompt: 'Design an in-process rate limiter class.',
    assumptions: ['Per-key token buckets; called from many threads.'],
    classes: [['lim', 'KeyedLimiter', 'allow(key, now)'], ['bucket', 'TokenBucket', 'tokens, rate'], ['lock', 'Lock', 'atomic check-and-spend']],
    links: [['lim', 'bucket', 'one per key'], ['lim', 'lock']],
    stages: [
      { kind: 'clarify', title: 'Per key, bursts', task: 'What parameters does each bucket need?', ref: [{ type: 'p', text: 'Capacity (burst) and refill rate; time is passed in (`now`) so tests control it.' }] },
      { kind: 'model', title: 'The design', task: 'Read it. Why is the lock needed?', focus: ['lim', 'lock'], ref: [code('sdm/cases/keyed_limiter.py', 'KeyedLimiter'), code('sdm/rate_limit.py', 'TokenBucket')] },
      { kind: 'invariants', title: 'Never over-spend', task: 'Without the lock, how could two threads exceed the limit?', ref: [{ type: 'p', text: 'Both read 1 token, both decide “allowed”, both decrement, and the bucket spends a token it didn’t have. The check and the spend must be one atomic step.' }] },
      { kind: 'change', title: 'Change: memory growth', task: 'Millions of keys appear once and never return. What do you add?', ref: [{ type: 'p', text: 'Evict idle buckets: an LRU of buckets, or drop buckets that would be full anyway (a full bucket is equivalent to a new one).' }] },
    ],
    checks: [choice('q1', 'Why pass `now` into allow()?', ['Tests can control time; no sleeping', 'Deterministic tests.'], ['It’s faster', 'It’s about testability.'])],
    rubric: { responsibilities: 'Limiter maps keys to buckets; bucket owns refill math.', interfaces: 'allow(key, now) → bool.', invariants: 'Tokens never negative; atomic check-and-spend.', tests: 'Burst, refill, key isolation, concurrency.', adaptability: 'Idle-bucket eviction; distributed backing store.' },
  }),
  lld({
    id: 'lld-scheduler', prompt: 'Design an in-process task scheduler.',
    assumptions: ['Schedule callables at times; run due tasks in time order.'],
    classes: [['sch', 'TaskScheduler', 'schedule(), run_due()'], ['heap', 'min-heap', '(time, seq, task)'], ['clock', 'clock()', 'injected']],
    links: [['sch', 'heap'], ['sch', 'clock']],
    stages: [
      { kind: 'clarify', title: 'Ordering', task: 'Two tasks are due at the same time. Which runs first?', ref: [{ type: 'p', text: 'Insertion order: a sequence number breaks ties, which also avoids comparing functions (which Python can’t do).' }] },
      { kind: 'model', title: 'Heap of due times', task: 'Read the design. What does the heap give you?', focus: ['heap'], ref: [code('sdm/cases/task_scheduler.py', 'TaskScheduler')] },
      { kind: 'tests', title: 'Testing time', task: 'How do you test a task due in 5 seconds without waiting?', focus: ['clock'], ref: [{ type: 'p', text: 'Inject a fake clock (`lambda: now[0]`) and advance it in the test. The suite checks nothing runs early and due tasks run in order.' }] },
      { kind: 'change', title: 'Change: a task raises', task: 'One task throws an exception. Should the rest still run?', ref: [{ type: 'p', text: 'Yes: catch per task, record the failure, continue. Optionally reschedule with backoff. A bad task must not stall the scheduler.' }] },
    ],
    checks: [choice('q1', 'Why a heap?', ['O(log n) insert and quick access to the earliest task', 'Exactly what “next due” needs.'], ['It sorts everything instantly', 'A heap only keeps the minimum at the top.'])],
    rubric: { responsibilities: 'Scheduler orders and runs; clock injected.', interfaces: 'schedule(at, task); run_due() → count.', invariants: 'Never run early; ties in insertion order.', tests: 'Fake clock, ordering, failures.', adaptability: 'Recurring tasks, failure handling, threads.' },
  }),
  lld({
    id: 'lld-booking', pairedWith: 'case-ticket-booking', prompt: 'Design the classes for seat holds and bookings for one event.',
    assumptions: ['Holds expire after 10 minutes; confirming after expiry must fail (refund).', 'Called concurrently from many request threads.'],
    classes: [['inv', 'SeatInventory', 'hold(), confirm()'], ['hold', 'Hold', 'seat, buyer, expires_at'], ['lock', 'Lock', 'one step check-and-change'], ['sets', 'free / holds / booked', 'disjoint']],
    links: [['inv', 'hold', 'creates'], ['inv', 'lock'], ['inv', 'sets']],
    stages: [
      { kind: 'clarify', title: 'States of a seat', task: 'Name the states and transitions.', ref: [{ type: 'p', text: 'free → held(buyer, expiry) → booked(buyer); held → free on expiry. This is the LLD half of the [booking case](/cases/case-ticket-booking) and the state machine from the [first lesson](/learn/first-booking).' }] },
      { kind: 'model', title: 'The inventory', task: 'Read `hold` and `confirm`. What makes them safe under concurrency?', focus: ['inv', 'lock'], ref: [code('sdm/cases/seat_booking.py', 'hold'), code('sdm/cases/seat_booking.py', 'confirm')] },
      { kind: 'invariants', title: 'Disjoint sets', task: 'State the invariant across free, holds and booked.', focus: ['sets'], ref: [{ type: 'p', text: 'Every seat is in exactly one of free, holds, booked. Each method moves a seat between them inside the lock. The concurrency test runs 8 threads holding one seat: exactly one wins.' }] },
      { kind: 'change', title: 'Change: many processes', task: 'The service now runs on 10 servers. Does the lock still protect you?', ref: [{ type: 'p', text: 'No. A threading lock only covers one process. Move the check-and-change into the database (conditional update), and keep this class as the in-memory model for tests and single-process tools.' }] },
    ],
    checks: [choice('q1', 'Why does a threading.Lock stop protecting holds with 10 servers?', ['Each process has its own lock; they don’t coordinate', 'Use a database conditional write.'], ['Locks expire', 'They don’t; they’re per process.'])],
    rubric: { responsibilities: 'Inventory owns seat sets and expiry.', interfaces: 'hold(seat, buyer, now); confirm(seat, buyer, now).', invariants: 'Seat in exactly one set; one hold winner.', tests: 'Expiry, late payment, 8-thread race.', adaptability: 'Moves to DB conditional writes across processes.' },
  }),
  lld({
    id: 'lld-shopping-cart', prompt: 'Design a shopping cart with discounts.',
    assumptions: ['Lines with unit price and quantity; discounts as rules; one currency per cart.'],
    classes: [['cart', 'Cart', 'add(), subtotal(), total()'], ['line', 'Line', 'sku, unit, qty'], ['money', 'Money', 'value object'], ['disc', 'Discount', 'Cart → Money']],
    links: [['cart', 'line', 'has many'], ['line', 'money'], ['cart', 'disc', 'applies']],
    stages: [
      { kind: 'clarify', title: 'Totals and rules', task: 'Which invariants matter for a cart?', ref: [{ type: 'list', items: ['Quantities positive; one currency; totals never negative.', 'Discounts are separate rules, so marketing can add them without editing the cart.'] }] },
      { kind: 'model', title: 'Cart with discount strategies', task: 'Read the design. How are discounts added?', focus: ['cart', 'disc'], ref: [code('sdm/cases/cart.py', 'Cart'), code('sdm/cases/cart.py', 'ten_percent_over')] },
      { kind: 'invariants', title: 'Never negative', task: 'Find the line that stops stacked discounts from making the total negative.', ref: [{ type: 'p', text: '`max(0, subtotal − discounts)` in `total()`, plus Money itself refuses negative values.' }] },
      { kind: 'change', title: 'Change: buy 2, get 1 free', task: 'How do you add that rule?', ref: [{ type: 'p', text: 'Write one more Discount function that inspects lines for the SKU and returns the value of the free items. The cart doesn’t change ([Strategy](/learn/pattern-strategy)).' }] },
    ],
    checks: [choice('q1', 'Why model money as a value object?', ['Currency and non-negativity are enforced everywhere money is used', 'Invariants travel with the value.'], ['It’s faster than int', 'It’s about correctness.'])],
    rubric: { responsibilities: 'Cart sums lines; discounts compute their own value.', interfaces: 'add(sku, unit, qty); total() → Money.', invariants: 'Positive qty, one currency, non-negative total.', tests: 'Subtotal, discount threshold, currency mismatch.', adaptability: 'New promotions as new functions.' },
  }),
  lld({
    id: 'lld-board-game', prompt: 'Design tic-tac-toe, then extend it to Connect Four.',
    assumptions: ['Two players alternate; first to N in a row wins.'],
    classes: [['board', 'Board', 'place(), wins()'], ['ttt', 'tic_tac_toe()', '3×3, 3 in a row'], ['c4', 'connect_four()', '6×7, 4, gravity']],
    links: [['ttt', 'board', 'configures'], ['c4', 'board', 'configures']],
    stages: [
      { kind: 'clarify', title: 'What varies?', task: 'What differs between tic-tac-toe and Connect Four?', ref: [{ type: 'p', text: 'Board size, win length, and gravity (pieces fall to the lowest free row). Move validation and win detection are otherwise the same.' }] },
      { kind: 'model', title: 'One board, configured', task: 'Read the design. How do two games share one class?', focus: ['board'], ref: [code('sdm/cases/board_game.py', 'Board')] },
      { kind: 'critical-path', title: 'Checking a win in O(1)-ish', task: 'Why check only lines through the last move?', ref: [{ type: 'p', text: 'A new win must include the piece just placed. Count matching pieces in both directions along four axes from that cell: at most 4 × 2 × (win length) cells, not the whole board.' }] },
      { kind: 'change', title: 'Change: an AI player', task: 'Add a computer opponent.', ref: [{ type: 'p', text: 'Introduce a Player protocol with `choose_move(board) -> move`; human and AI implement it, and the game loop asks whoever’s turn it is. The board doesn’t change.' }] },
    ],
    checks: [choice('q1', 'Connect Four was added by…', ['Configuring the same Board with size, win length and gravity', 'Composition over a subclass per game.'], ['Copying the tic-tac-toe class', 'Duplication doubles the bugs.'])],
    rubric: { responsibilities: 'Board validates moves and detects wins; factories configure games.', interfaces: 'place(player, col, row?) → (row, col); wins(row, col).', invariants: 'Cells only filled once; gravity respected.', tests: 'Wins on rows/columns/diagonals, full column, taken cell.', adaptability: 'New games by configuration; players via a protocol.' },
  }),
  lld({
    id: 'lld-live-scores', pairedWith: 'case-live-scores', prompt: 'Design the score event processor for a live match.',
    assumptions: ['Provider events have ids and per-match sequence numbers; duplicates and out-of-order delivery happen; corrections arrive as events.'],
    classes: [['proc', 'ScoreProcessor', 'receive(event)'], ['state', 'MatchState', 'home, away, goals, last_seq'], ['seen', 'seen ids', 'dedupe'], ['pending', 'pending', 'seq → event']],
    links: [['proc', 'state'], ['proc', 'seen'], ['proc', 'pending']],
    stages: [
      { kind: 'clarify', title: 'What can go wrong in a feed?', task: 'List the feed problems the processor must handle.', ref: [{ type: 'list', items: ['Duplicates (same event id twice).', 'Out of order (seq 3 before 2).', 'Corrections (goal disallowed).'] }] },
      { kind: 'model', title: 'Dedupe, buffer, apply in order', task: 'Read `receive`. Trace events with seq 2, then 1, then a duplicate of 1.', focus: ['proc', 'pending'], ref: [code('sdm/cases/score_processor.py', 'receive')] },
      { kind: 'invariants', title: 'Score derived, never edited', task: 'How does the processor guarantee the score matches the goals?', focus: ['state'], ref: [{ type: 'p', text: 'The score is recomputed from the set of standing goals after every event. A disallowed goal is removed from the set, so the score can’t drift from the goals that count.' }, code('sdm/cases/score_processor.py', '_apply')] },
      { kind: 'change', title: 'Change: a gap that never fills', task: 'Seq 7 is lost forever. Events 8, 9… pile up in pending. What do you do?', ref: [{ type: 'p', text: 'Add a timeout: after N seconds, request the missing event from the provider, or fetch a full snapshot and resync last_seq. Expose “delayed” to clients rather than showing a wrong score.' }] },
    ],
    checks: [choice('q1', 'Event seq 3 arrives before seq 2. What happens?', ['It waits in pending until 2 arrives, then both apply in order', 'Ordering is preserved.'], ['It applies immediately', 'Out-of-order application could show a wrong intermediate score.'])],
    rubric: { responsibilities: 'Processor handles delivery problems; state only holds derived facts.', interfaces: 'receive(event) → applied sequence numbers.', invariants: 'Each event once, in order; score derived from standing goals.', tests: 'Out of order, duplicate, correction.', adaptability: 'Gap timeouts and snapshots.' },
  }),
];
