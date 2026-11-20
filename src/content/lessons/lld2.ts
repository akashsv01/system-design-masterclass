import type { GenericLesson } from '../lessonTypes';
import { e, layout, n, py, pyLine } from './_kit';

const MOVE_TO = py('sdm/lld.py', 'move_to');
const TRANSFER = py('sdm/lld.py', 'transfer');

export const uml: GenericLesson = {
  id: 'uml',
  area: 'LLD and machine coding',
  opening: 'In an LLD interview you have 45 minutes and a whiteboard. Writing code first hides the design. Three small diagrams show it at a glance: what the classes are, how they talk during one operation, and which states an object moves through.',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [
        n('booking', 'box', 'BookingService', { sub: '+ hold(seat, buyer)' }),
        n('seat', 'box', 'Seat', { sub: '- holder · + hold()' }),
        n('repo', 'box', '«interface» SeatRepository', { sub: '+ get() + save()' }),
        n('clock', 'box', '«interface» Clock', { sub: '+ now()' }),
        n('sql', 'box', 'SqlSeatRepository'),
      ],
      edges: [e('booking', 'seat', 'uses'), e('booking', 'repo', 'depends on'), e('booking', 'clock', 'depends on'), e('sql', 'repo', 'implements', { dashed: true })],
      ...layout(320, 470, {
        booking: [{ x: 410, y: 60, w: 220 }, { x: 180, y: 45, w: 230 }],
        seat: [{ x: 130, y: 190, w: 190 }, { x: 92, y: 180, w: 166 }],
        repo: [{ x: 430, y: 190, w: 240 }, { x: 268, y: 180, w: 166 }],
        clock: [{ x: 720, y: 190, w: 170 }, { x: 92, y: 320, w: 166 }],
        sql: [{ x: 430, y: 285, w: 220 }, { x: 268, y: 320, w: 166 }],
      }),
    },
  },
  steps: [
    { kicker: 'Idea', title: 'Class diagram: the parts', body: ['A **class diagram** shows classes, their key fields and methods (`-` private, `+` public), and how they relate. Keep it to what matters for the discussion: five boxes beat fifty.'], view: { hide: ['clock', 'sql'] } },
    { kicker: 'Watch', title: 'Interfaces and implementations', body: ['`«interface»` marks an abstraction. A dashed arrow means “implements”. BookingService depends on `SeatRepository`, not on the SQL version, which is dependency inversion drawn as a picture.'], view: { states: { repo: 'focus', sql: 'active' } }, changes: [{ kind: 'add', text: 'SqlSeatRepository implements SeatRepository' }] },
    { kicker: 'Idea', title: 'Sequence diagram: one call, over time', body: ['A **sequence diagram** lists participants across the top and messages flowing down in time order: buyer → BookingService.hold → SeatRepository.get → Seat.hold → SeatRepository.save → reply. It’s the best way to show *who calls whom, in what order*.'], view: { states: { booking: 'active' }, tokens: [{ from: 'booking', to: 'repo', label: 'get(F12)', tone: 'request' }] } },
    { kicker: 'Predict', title: 'Pick the diagram for the question', body: ['An interviewer asks: “Can a refunded ticket ever be scanned at the door?”'], view: {},
      predict: { id: 'which', prompt: 'Which diagram answers that most directly?', choices: [
        { id: 'state', text: 'A state diagram of the ticket', why: 'Right. It shows every state and every allowed transition; you can see there’s no arrow from Refunded to Scanned.' },
        { id: 'class', text: 'A class diagram', why: 'It shows structure, not which state changes are allowed.' },
        { id: 'seq', text: 'A sequence diagram', why: 'It shows one scenario’s messages, not all possible states.' },
      ], correct: 'state' } },
  ],
  worked: { title: 'the three diagrams in text form', blocks: [
    { type: 'code', lang: 'text', code: 'Sequence: hold seat\nBuyer -> BookingService : hold(F12, maya)\nBookingService -> SeatRepository : get(F12)\nSeatRepository --> BookingService : seat\nBookingService -> Seat : hold(maya)\nSeat --> BookingService : True\nBookingService -> SeatRepository : save(seat)\nBookingService --> Buyer : held until 20:10', caption: 'Plain-text sequence diagrams are quick to write on a whiteboard or in a doc.' },
    { type: 'code', lang: 'text', code: 'State: Ticket\n[*] --> Issued\nIssued --> Scanned : scan at door\nIssued --> Refunded : refund\nScanned --> [*]\nRefunded --> [*]' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'You want to show reviewers that payment is charged *after* the seat hold succeeds. Which diagram?', choices: [
    { id: 'seq', text: 'Sequence diagram', why: 'Right. Ordering of calls is exactly what it shows.' },
    { id: 'class', text: 'Class diagram', why: 'It shows that the classes exist and relate, not the order of calls.' },
  ], correct: 'seq' }],
  exercise: { id: 'draw', prompt: 'List the participants of a sequence diagram for “buyer cancels a booking and is refunded”, in order of first appearance.', checklist: ['Includes buyer, a booking/checkout service, the booking repository, and the payment provider.', 'Order reflects the call flow (service before repository before refund).'], model: 'Buyer → BookingService → BookingRepository (load booking) → PaymentProvider (refund) → BookingRepository (save cancelled) → back to Buyer.' },
  next: { id: 'state-machines', reason: 'The state diagram deserves its own lesson: it is the most useful LLD tool for resources with a lifecycle.' },
};

export const stateMachines: GenericLesson = {
  id: 'state-machines',
  area: 'LLD and machine coding',
  opening: 'A refunded ticket gets scanned at the door, and the venue lets in someone who already got their money back. The code had a `status` string and nothing stopping any status from becoming any other. Which transitions should even be possible?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('issued', 'box', 'Issued'), n('scanned', 'box', 'Scanned'), n('refunded', 'box', 'Refunded')],
      edges: [e('issued', 'scanned', 'scan'), e('issued', 'refunded', 'refund'), e('refunded', 'scanned', 'scan?', { state: 'ghost', dashed: true })],
      ...layout(300, 420, {
        issued: [{ x: 140, y: 150, w: 170 }, { x: 180, y: 50, w: 200 }],
        scanned: [{ x: 600, y: 60, w: 170 }, { x: 92, y: 330, w: 150 }],
        refunded: [{ x: 600, y: 240, w: 170 }, { x: 268, y: 330, w: 150 }],
      }),
    },
  },
  steps: [
    { kicker: 'Idea', title: 'List the states', body: ['A **state machine** names every state a resource can be in and every allowed **transition** between them. A ticket is *Issued*, *Scanned* or *Refunded*. That’s its **resource lifecycle**.'], view: { edgeStates: { 'issued-scanned': 'ghost', 'issued-refunded': 'ghost' } } },
    { kicker: 'Watch', title: 'Draw only allowed transitions', body: ['From Issued, a ticket can be scanned or refunded. From Scanned or Refunded, nothing: both are final. Any transition not drawn is forbidden.'], view: { states: { issued: 'focus' } }, changes: [{ kind: 'add', text: 'Issued → Scanned, Issued → Refunded' }] },
    { kicker: 'Predict', title: 'Someone scans a refunded ticket', body: ['The scanner calls `ticket.move_to(SCANNED)` on a refunded ticket.'], view: { states: { refunded: 'active' }, edgeStates: { 'refunded-scanned': 'active' } }, code: { code: MOVE_TO, highlight: [pyLine(MOVE_TO, 'if new not in ALLOWED[self.state]:')], caption: 'python/sdm/lld.py — New Python: `Enum` gives a fixed set of named states.', open: true },
      predict: { id: 'scan', prompt: 'What happens?', choices: [
        { id: 'raise', text: 'It raises: Refunded has no allowed transitions.', why: 'Right. The forbidden transition is stopped in one place, whichever code tries it.' },
        { id: 'ok', text: 'The status becomes Scanned.', why: 'With a bare status string it would. The state machine checks the transition table first.' },
      ], correct: 'raise' } },
    { kicker: 'Fix', title: 'One table, one guard', body: ['Keep the allowed transitions in one table and route every change through one method. New rules (“refunds close 1 hour before the show”) become **guards** on a transition. Keep the history: it answers support questions.'], view: { states: { refunded: 'fail' }, tags: { refunded: { text: 'scan refused', tone: 'fail' } } } },
  ],
  worked: { title: 'the ticket state machine in Python', blocks: [
    { type: 'code', lang: 'python', code: py('sdm/lld.py').split('# --- State machines')[1].split('# --- Concurrency')[0].trim().replace(/^-+\n/, ''), caption: 'python/sdm/lld.py — enum states, a transition table, and one guarded method; tested with pytest' },
    { type: 'p', text: 'Seat holds ([first lesson](/learn/first-booking)), orders, payments and deliveries are all state machines. Writing the table first catches impossible states early. In the database, enforce the most important transitions with conditional updates (`... WHERE status = \'issued\'`).' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'A new rule: refunds are not allowed after the event starts. Where does it belong?', choices: [
    { id: 'guard', text: 'As a guard on the Issued → Refunded transition', why: 'Right. One place, applied however a refund is requested.' },
    { id: 'ui', text: 'Hide the refund button after the event starts', why: 'Useful for UX, but the API could still be called directly. The rule must live in the model.' },
  ], correct: 'guard' }],
  exercise: { id: 'order', prompt: 'List the states of a food-delivery order and one transition that must never happen.', checklist: ['Lists 4–6 sensible states (placed, preparing, picked up, delivered, cancelled).', 'Names a forbidden transition (e.g. delivered → cancelled, or picked up → preparing).'], model: 'Placed → Preparing → Picked up → Delivered, with Cancelled reachable only from Placed or Preparing; Delivered → Cancelled must never happen.' },
  next: { id: 'testing', reason: 'A state machine is easy to test exhaustively. Next: writing those tests.' },
};

export const testing: GenericLesson = {
  id: 'testing',
  area: 'LLD and machine coding',
  opening: 'You changed the hold-expiry logic. Did you break late payments? You could click through the app for twenty minutes, or run 40 tests in half a second. Tests are how a design stays changeable.',
  visual: { kind: 'none' },
  steps: [
    { kicker: 'Idea', title: 'Arrange, act, assert', body: ['A unit test has three parts. **Arrange**: build the objects and fakes. **Act**: call the one behaviour under test. **Assert**: check the result. One behaviour per test, named after it.'], code: { code: 'def test_late_payment_is_refused():\n    seat = Seat("F13")                                   # arrange\n    seat.hold("Maya", now=0, hold_seconds=60)\n    ok = seat.confirm("Maya", now=61)                     # act\n    assert not ok                                        # assert\n    assert seat.hold("Leo", now=61)                      # the seat is free again', highlight: [4, 5], caption: 'Adapted from python/tests/test_foundations.py — time is an argument, so the test needs no waiting', open: true } },
    { kicker: 'Idea', title: 'Test doubles replace slow, risky parts', body: ['A **fake** is a working lightweight version (an in-memory repository). A **stub** returns canned answers (a payment that always succeeds). A **spy** records calls so you can assert on them (“charge was never called”); Python calls these mocks (`unittest.mock`). Prefer fakes and stubs, and use spies when the interaction itself is the behaviour.'] },
    { kicker: 'Predict', title: 'Fill in the missing assertion', body: ['This test should prove an expired hold is not charged.'], code: { code: 'def test_expired_hold_not_charged():\n    charges = []\n    checkout = Checkout(charge=lambda c: charges.append(c) or True,\n                        clock=lambda: 300.0, bookings=repo_with_b2())\n    result = checkout.pay("b2", hold_expires_at=200.0)\n    assert result == "hold expired"\n    # missing line here', highlight: [7], caption: 'What should the last line check?', open: true },
      predict: { id: 'assert', prompt: 'Which assertion completes the test?', choices: [
        { id: 'none', text: '`assert charges == []`', why: 'Right. The behaviour under test includes “no money moved”, and the fake recorded every call.' },
        { id: 'len', text: '`assert len(charges) == 1`', why: 'That would assert the bug: an expired hold being charged.' },
        { id: 'skip', text: 'Nothing; the first assert is enough.', why: 'Returning “hold expired” after charging the card would still pass. Check the side effect too.' },
      ], correct: 'none' } },
    { kicker: 'Trade-off', title: 'What to test, at which level', body: ['Many fast unit tests for rules (state machines, pricing, invariants). Fewer integration tests for real boundaries (does the SQL repository actually save?). A handful of end-to-end tests for critical journeys. This site follows the same shape: pytest and vitest for logic, and a browser e2e for sign-in and sync.'] },
  ],
  worked: { title: 'running the course’s own tests', blocks: [
    { type: 'code', lang: 'text', code: '$ cd python && python3 -m pytest -q\n........................................................................ [ 98%]\n.                                                                        [100%]\n73 passed in 0.59s', caption: 'The Python code in the lessons comes from python/ and is checked by these tests (short test excerpts in lessons are adapted from them).' },
    { type: 'table', head: ['Double', 'What it does', 'Example'], rows: [['Fake', 'Works, but simplified', 'InMemoryBookings'], ['Stub', 'Returns fixed answers', '`charge=lambda c: True`'], ['Spy (Python: mock)', 'Records calls for assertions', '`charges.append(c)`'], ['Fake clock', 'Time you control', '`clock=lambda: 300.0`']] },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'A test passes when run alone but fails when the whole suite runs. Most likely cause?', choices: [
    { id: 'shared', text: 'Tests share state (a global, a database row, the real clock) and affect each other.', why: 'Right. Each test should arrange its own state and use injected fakes.' },
    { id: 'slow', text: 'The machine is too slow.', why: 'Order-dependent failures almost always come from shared state.' },
  ], correct: 'shared' }],
  exercise: { id: 'name', prompt: 'Write a good name for a test that checks a refunded ticket can’t be scanned.', checklist: ['Names the behaviour, not the method (e.g. test_refunded_ticket_cannot_be_scanned).', 'Readable as a sentence.'], model: '`test_refunded_ticket_cannot_be_scanned`: it states the rule, so a failure explains itself.' },
  next: { id: 'refactoring-lesson', reason: 'Tests make change safe. Next: changing structure without changing behaviour.' },
};

export const refactoringLesson: GenericLesson = {
  id: 'refactoring-lesson',
  area: 'LLD and machine coding',
  opening: 'The pricing function is 200 lines of nested `if`s. Adding a “group discount” means reading all of it and hoping. Refactoring improves its structure in small steps, each one keeping the tests green, so the new rule becomes a two-line change.',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Idea', title: 'Same behaviour, better structure', body: ['**Refactoring** is a sequence of small, behaviour-preserving changes. Run the tests after each one. If they fail, the last small step is the culprit, and you undo it.'],
      compare: { left: { title: 'Before', points: ['One 200-line `price()`', 'Nested ifs for member/student/group/surge'], tone: 'fail' }, right: { title: 'Goal', points: ['Small named functions', 'New rules added, not edited in'] } } },
    { kicker: 'Watch', title: 'Step 1: extract function', body: ['Find a block that does one thing (the student discount) and move it into a named function. Behaviour is unchanged, and the name explains the block.'],
      compare: { left: { title: 'Before', points: ['`if buyer.is_student and not event.no_discounts: price = price * 80 // 100`'] }, right: { title: 'After', points: ['`price = apply_student_discount(price, buyer, event)`'], tone: 'ok' } },
      changes: [{ kind: 'chg', text: 'Extracted apply_student_discount()' }] },
    { kicker: 'Watch', title: 'Step 2: replace conditional with lookup', body: ['The chain `if kind == "regular" … elif kind == "student" …` becomes a table of functions: `PRICING[kind](base)`. Adding a rule adds an entry. This is the seed of the [Strategy pattern](/learn/pattern-strategy).'],
      compare: { left: { title: 'Before', points: ['`if/elif` on kind, repeated in 3 places'], tone: 'fail' }, right: { title: 'After', points: ['`PRICING = {"regular": regular_price, "student": student_price}`', '`PRICING[kind](base)`'], tone: 'ok' } } },
    { kicker: 'Predict', title: 'Spot the smell', body: ['Common **code smells** hint at which refactoring to apply.'],
      compare: { left: { title: 'Smell', points: ['The same 6-line validation block is copied into four handlers'] }, right: { title: 'Refactoring?', points: ['?'] } },
      predict: { id: 'smell', prompt: 'Which refactoring fits duplicated code best?', choices: [
        { id: 'extract', text: 'Extract function and call it from all four places', why: 'Right. One copy to fix, one name to read.' },
        { id: 'comment', text: 'Add a comment to each copy saying they must stay in sync', why: 'They won’t. Comments don’t keep copies in sync. Remove the duplication instead.' },
      ], correct: 'extract' } },
  ],
  worked: { title: 'smells and their refactorings', blocks: [
    { type: 'table', head: ['Smell', 'Refactoring'], rows: [['Long function', 'Extract function'], ['Duplicated code', 'Extract function / move to shared module'], ['Switch on type repeated in many places', 'Replace conditional with polymorphism or a lookup table'], ['Long parameter list', 'Introduce parameter object / builder'], ['Feature envy (a function mostly uses another object’s data)', 'Move function to that object'], ['Primitive obsession (`price_cents: int` everywhere)', 'Replace primitive with object (a `Money` value object)']] },
    { type: 'p', text: 'Refactor in commits separate from behaviour changes, so reviewers can check each one against a single question: did behaviour stay the same?' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'You’re mid-refactor and a test fails. Best move?', choices: [
    { id: 'undo', text: 'Undo the last small step and retry it differently.', why: 'Right. Small steps make the culprit obvious and the fix cheap.' },
    { id: 'push', text: 'Keep going and fix all failures at the end.', why: 'Failures pile up and interact. You lose the ability to tell which step broke what.' },
  ], correct: 'undo' }],
  exercise: { id: 'first', prompt: 'You inherit a 300-line function with no tests. What’s your first step before refactoring it?', checklist: ['Write characterisation tests that pin current behaviour.', 'Then refactor in small steps.'], model: 'Write a few tests that capture what it does today (even odd behaviour), so every refactoring step can be checked against them.' },
  next: { id: 'concurrency-lld', reason: 'Refactoring keeps code clear. Next: keeping it correct when many threads run it at once.' },
};

export const concurrencyLld: GenericLesson = {
  id: 'concurrency-lld',
  area: 'LLD and machine coding',
  opening: 'Two transfers run at once: Maya → Leo and Leo → Maya. Each locks its sender’s wallet, then waits for the receiver’s. Each holds what the other needs. Nothing crashes, nothing errors. Both threads simply wait forever.',
  visual: { kind: 'timeline', unit: 'ms', note: 'Two threads, two locks, opposite order.', lanes: [{ id: 't1', label: 'Thread 1 (Maya → Leo)' }, { id: 't2', label: 'Thread 2 (Leo → Maya)' }], events: [
    { t: 1, lane: 't1', label: 'locks Maya' },
    { t: 2, lane: 't2', label: 'locks Leo', tone: 'active' },
    { t: 3, lane: 't1', label: 'waits for Leo…', tone: 'fail' },
    { t: 4, lane: 't2', label: 'waits for Maya…', tone: 'fail' },
  ] },
  steps: [
    { kicker: 'Idea', title: 'Locks protect shared state', body: ['A **race** happens when the result depends on how threads interleave, like the [lost counter update](/learn/bridge-threads). A **lock** makes a block run one thread at a time. That fixes races and introduces a new risk.'], timeline: { upTo: 0 } },
    { kicker: 'Watch', title: 'Each takes one lock', body: ['Thread 1 locks Maya’s wallet. Thread 2 locks Leo’s.'], timeline: { upTo: 2 } },
    { kicker: 'Failure', title: 'Each waits for the other', body: ['Thread 1 now needs Leo’s lock, held by thread 2. Thread 2 needs Maya’s, held by thread 1. Neither can continue: a **deadlock**.'], timeline: { upTo: 4 }, changes: [{ kind: 'del', text: 'Both threads blocked forever' }] },
    { kicker: 'Predict', title: 'Prevent it', body: ['Deadlock needs a cycle of waiting. Break the cycle.'], timeline: { upTo: 4 }, code: { code: TRANSFER, highlight: [pyLine(TRANSFER, 'first, second ='), pyLine(TRANSFER, 'with first.lock, second.lock:')], caption: 'python/sdm/lld.py — New Python: `with a, b:` acquires both in order and always releases them.' },
      predict: { id: 'order', prompt: 'Why does locking the lower wallet id first prevent the deadlock?', choices: [
        { id: 'cycle', text: 'Both threads try Maya (id 1) first, so one waits before holding anything: no cycle.', why: 'Right. A global lock order makes circular waiting impossible. The tests run thousands of opposite transfers to check it.' },
        { id: 'fast', text: 'It makes the locks faster.', why: 'Speed is unchanged. The fix is that threads can no longer hold locks in opposite orders.' },
      ], correct: 'cycle' } },
  ],
  worked: { title: 'synchronisation tools in Python', blocks: [
    { type: 'table', head: ['Tool', 'Use for'], rows: [['`threading.Lock`', 'Mutual exclusion around shared state'], ['Lock ordering', 'Preventing deadlock when taking several locks'], ['`Lock.acquire(timeout=…)`', 'Giving up instead of waiting forever'], ['`queue.Queue`', 'Passing work between threads safely, often avoiding locks entirely'], ['Immutable objects', 'Data that can be shared without any lock']] },
    { type: 'code', lang: 'python', code: TRANSFER, caption: 'python/sdm/lld.py — tested with two threads doing 2,000 opposite transfers each' },
    { type: 'p', text: 'The same ideas apply across machines: database row locks can deadlock too (the database aborts one transaction), and the cure is again a consistent order. See [Locking and MVCC](/learn/locking-mvcc).' },
  ] },
  checks: [{ kind: 'line', id: 'race', prompt: 'Which line makes this seat counter unsafe with multiple threads?', code: 'class SeatsLeft:\n    def __init__(self, n):\n        self.n = n\n        self.lock = threading.Lock()\n\n    def take(self):\n        if self.n > 0:\n            with self.lock:\n                self.n -= 1\n                return True\n        return False', answer: [7], explain: 'The check happens *outside* the lock. Two threads can both see n = 1, then both decrement, ending at −1. The check and the change must both be inside the lock.', wrong: { 8: 'Taking the lock is right, but it’s taken too late.', 9: 'The decrement is protected. The check before it isn’t.' } }],
  exercise: { id: 'avoid', prompt: 'Besides lock ordering, name one way to avoid deadlocks in a booking service.', checklist: ['Names a valid technique (timeouts on lock acquisition, one lock/one owner per resource, queues/single writer, database conditional updates instead of app locks).', 'Explains briefly why it helps.'], model: 'Avoid holding application locks at all: use a single conditional database update per seat, so there’s never a moment where one request holds one lock while waiting for another.' },
  next: { id: 'gof-reference', reason: 'You now have the core LLD toolkit. Next: the classic design patterns, as a searchable reference.' },
};

export const LLD2 = [uml, stateMachines, testing, refactoringLesson, concurrencyLld];
