import type { GenericLesson } from '../lessonTypes';
import { e, layout, n, py, pyLine } from './_kit';

const SEAT = py('sdm/lld.py', 'Seat');
const MONEY = '@dataclass(frozen=True)\n' + py('sdm/lld.py', 'Money');
const CHECKOUT_INIT = py('sdm/lld.py', 'Checkout').split('\n\n    def pay')[0];
const CHECKOUT_PAY = py('sdm/lld.py', 'pay');

export const responsibilities: GenericLesson = {
  id: 'responsibilities',
  area: 'LLD and machine coding',
  opening: 'Three places in the code decide whether a seat can be held: the checkout handler, the admin tool and a batch job. Each checks slightly different things. One day they disagree, and a seat is sold twice. Which object should own that decision?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('checkout', 'service', 'Checkout handler'), n('admin', 'service', 'Admin tool'), n('batch', 'service', 'Nightly job'), n('seat', 'box', 'Seat', { sub: 'hold(buyer)' }), n('data', 'db', 'seat fields', { sub: 'holder, price' })],
      edges: [e('checkout', 'data', 'pokes fields', { dashed: true }), e('admin', 'data', undefined, { dashed: true }), e('batch', 'data', undefined, { dashed: true }), e('checkout', 'seat', 'asks', { state: 'ghost' }), e('admin', 'seat', undefined, { state: 'ghost' }), e('batch', 'seat', undefined, { state: 'ghost' }), e('seat', 'data', 'owns', { state: 'ghost' })],
      ...layout(320, 470, {
        checkout: [{ x: 120, y: 60, w: 190 }, { x: 70, y: 45, w: 124 }],
        admin: [{ x: 120, y: 160, w: 190 }, { x: 180, y: 45, w: 90 }],
        batch: [{ x: 120, y: 260, w: 190 }, { x: 290, y: 45, w: 124 }],
        seat: [{ x: 470, y: 160, w: 170 }, { x: 180, y: 230, w: 200 }],
        data: [{ x: 720, y: 160, w: 170 }, { x: 180, y: 400, w: 200 }],
      }),
    },
  },
  steps: [
    { kicker: 'Problem', title: 'Everyone reaches into the data', body: ['Each caller reads `holder` and writes it directly, with its own idea of the rule. The rule exists in three copies, and they drift.'], view: { hide: ['seat'], states: { data: 'fail' } } },
    { kicker: 'Idea', title: 'Let the object with the data decide', body: ['A **responsibility** is something an object knows or does. The seat knows its holder, so the seat should decide whether it can be held. Callers *ask* (`seat.hold("Maya")`) instead of reading fields and deciding themselves.'], view: { edgeStates: { 'checkout-data': 'ghost', 'admin-data': 'ghost', 'batch-data': 'ghost', 'checkout-seat': 'idle', 'admin-seat': 'idle', 'batch-seat': 'idle', 'seat-data': 'idle' }, states: { seat: 'focus' } }, changes: [{ kind: 'chg', text: 'One rule, inside Seat.hold()' }] },
    { kicker: 'Watch', title: 'Hide the fields behind behaviour', body: ['**Encapsulation** keeps the fields private (by convention in Python, a leading underscore) and exposes only operations that keep the object valid. **Abstraction** means callers see *what* a seat can do, not *how* it stores things.'], view: { edgeStates: { 'checkout-data': 'ghost', 'admin-data': 'ghost', 'batch-data': 'ghost', 'checkout-seat': 'idle', 'admin-seat': 'idle', 'batch-seat': 'idle', 'seat-data': 'idle' }, states: { seat: 'focus', data: 'dim' } }, code: { code: SEAT, highlight: [pyLine(SEAT, 'def hold'), pyLine(SEAT, 'if self._holder is not None')], caption: 'python/sdm/lld.py — New Python: `@property` makes a read-only attribute; `_holder` signals “private”.', open: true } },
    { kicker: 'Predict', title: 'A new rule arrives', body: ['Product decides: a seat can’t be held within 1 hour of the show.'], view: { edgeStates: { 'checkout-data': 'ghost', 'admin-data': 'ghost', 'batch-data': 'ghost', 'checkout-seat': 'idle', 'admin-seat': 'idle', 'batch-seat': 'idle', 'seat-data': 'idle' }, states: { seat: 'active' } },
      predict: { id: 'change', prompt: 'With the rule inside `Seat.hold`, how many places must change?', choices: [
        { id: 'one', text: 'One: `Seat.hold`', why: 'Right. Every caller already goes through it. That’s the payoff of putting a responsibility in one place.' },
        { id: 'three', text: 'Three: every caller', why: 'That was the old design. Now callers only ask, and the seat decides.' },
      ], correct: 'one' } },
  ],
  worked: { title: 'tell, don’t ask', blocks: [
    { type: 'code', lang: 'python', code: '# Before: the caller decides, using the seat\'s data\nif seat._holder is None:\n    seat._holder = buyer\n\n# After: the seat decides\nif not seat.hold(buyer):\n    return "Sold out"', caption: 'The second version can’t forget a rule, because the rule isn’t in the caller.' },
    { type: 'p', text: 'Ask of each piece of logic: which object has the information this needs? Put the logic there. When an object only holds data and others make all its decisions, the rules end up scattered.' },
  ] },
  checks: [{ kind: 'line', id: 'smell', prompt: 'Which line breaks the seat’s encapsulation?', code: 'def admin_release(seat, reason):\n    log(f"releasing {seat.seat_id}: {reason}")\n    seat._holder = None\n    notify_waitlist(seat.seat_id)', answer: [3], explain: 'It writes a private field directly, bypassing any rule the seat enforces. Add a `seat.release()` method and call that.', wrong: { 2: 'Reading the public id for a log line is fine.', 4: 'Notifying others is the caller’s job here.' } }],
  exercise: { id: 'who', prompt: 'Who should be responsible for computing an order’s total: the order, the checkout handler, or the payment service? Why?', checklist: ['Picks the order (it has the line items and discounts).', 'Explains information lives there, so the rule stays in one place.'], model: 'The order: it holds the line items and applied discounts, so computing the total there keeps the rule in one place instead of every caller re-adding prices.' },
  next: { id: 'polymorphism-composition', reason: 'One object, one responsibility. Next: many objects that share a role.' },
};

export const polymorphismComposition: GenericLesson = {
  id: 'polymorphism-composition',
  area: 'LLD and machine coding',
  opening: 'You model tickets with inheritance: `Ticket`, then `VipTicket(Ticket)`, then `StudentTicket(Ticket)`. Then someone needs a student VIP ticket that can be transferred. Which class does it inherit from?',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Idea', title: 'Polymorphism: one call, many behaviours', body: ['**Polymorphism** means one call (`ticket.price()`) runs different code depending on the object. Checkout calls `price()` and never asks “which kind of ticket is this?”'],
      compare: { left: { title: 'Without polymorphism', points: ['`if kind == "vip": ... elif kind == "student": ...` in every function'], tone: 'fail' }, right: { title: 'With polymorphism', points: ['`total = sum(t.price() for t in tickets)`', 'Each ticket type knows its own price'], tone: 'ok' } } },
    { kicker: 'Watch', title: 'Inheritance: share by being a kind of', body: ['**Inheritance** says “a VIP ticket *is a* ticket”, so it reuses the parent’s code and overrides what differs. It works well for one axis of variation.'],
      compare: { left: { title: 'Inheritance tree', points: ['Ticket', '├ VipTicket', '└ StudentTicket'] }, right: { title: 'Works while', points: ['Each ticket varies in only one way'] } } },
    { kicker: 'Failure', title: 'Two axes of variation', body: ['Now tickets vary by **price rule** (regular, student, VIP) *and* by **transfer rule** (transferable, not). With inheritance you need a class for every combination: `StudentTransferableTicket`, `VipNonTransferableTicket`… 3 × 2 = 6 classes, growing with every new rule.'],
      compare: { left: { title: 'Inheritance', points: ['6 classes for 3 price × 2 transfer rules', '12 when a third transfer rule arrives'], tone: 'fail' }, right: { title: '?', points: ['There’s a better shape'] }, focus: 'left' } },
    { kicker: 'Fix', title: 'Composition: has-a instead of is-a', body: ['**Composition** builds a ticket from parts: it *has a* pricing rule and *has a* transfer rule, each chosen independently. 3 + 2 small parts cover all 6 combinations.'],
      compare: { left: { title: 'Inheritance', points: ['A class per combination'], tone: 'fail' }, right: { title: 'Composition', points: ['`Ticket(pricing=student_price, transfer=allow_transfer)`', '3 pricing rules + 2 transfer rules = 5 parts'], tone: 'ok', verdict: 'grows by addition' } },
      changes: [{ kind: 'chg', text: '6 subclasses → 5 small parts' }] },
    { kicker: 'Predict', title: 'Choose', body: ['A venue adds “group pricing: 10% off for 6+ tickets”.'],
      compare: { left: { title: 'Inheritance', points: ['Add GroupTicket, GroupTransferableTicket, …'] }, right: { title: 'Composition', points: ['Add one pricing rule'] } },
      predict: { id: 'add', prompt: 'With composition, what do you add for group pricing?', choices: [
        { id: 'one', text: 'One pricing rule (a function or small class).', why: 'Right. It combines with every existing transfer rule automatically.' },
        { id: 'many', text: 'A new subclass for each transfer rule.', why: 'That’s the inheritance explosion composition avoids.' },
      ], correct: 'one' } },
  ],
  worked: { title: 'composition in Python', blocks: [
    { type: 'code', lang: 'python', code: 'from dataclasses import dataclass\nfrom typing import Callable\n\n@dataclass\nclass Ticket:\n    base_cents: int\n    pricing: Callable[[int], int]        # has a pricing rule\n    can_transfer: Callable[[], bool]     # has a transfer rule\n\n    def price(self) -> int:\n        return self.pricing(self.base_cents)\n\nstudent_vip = Ticket(9000, pricing=lambda c: c * 80 // 100, can_transfer=lambda: True)\nprint(student_vip.price())   # 7200', caption: 'New Python: `Callable[[int], int]` means “a function taking an int and returning an int”; `lambda` writes a tiny one inline.' },
    { type: 'p', text: 'Inheritance still fits a genuine “is a” relationship with one axis of variation, or a framework that expects a base class. Reach for composition when behaviours vary independently.' },
  ] },
  checks: [{ kind: 'numeric', id: 'count', prompt: 'Tickets vary by 4 pricing rules and 3 delivery methods. How many subclasses would inheritance need for every combination?', answer: 12, tolerance: 0.01, unit: 'classes', solution: ['One class per combination', '4 × 3 = 12 (composition needs 4 + 3 = 7 parts)'] }],
  exercise: { id: 'why', prompt: 'In one or two sentences: when is inheritance still a good choice?', checklist: ['A true “is a” relationship with a single axis of variation.', 'Or a framework that requires subclassing.'], model: 'When the subtype really is a kind of the parent and varies in just one way, or when a framework expects you to subclass its base class.' },
  next: { id: 'cohesion-coupling', reason: 'Composition keeps parts small. Next: measuring whether parts belong together.' },
};

export const cohesionCoupling: GenericLesson = {
  id: 'cohesion-coupling',
  area: 'LLD and machine coding',
  opening: 'A developer changes the email template, and seat pricing breaks. They live in the same 2,000-line `BookingManager` class, sharing half its fields. Why should an email change ever touch pricing?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('mgr', 'box', 'BookingManager', { sub: 'prices, holds, emails, reports' }), n('pricing', 'box', 'Pricing'), n('holds', 'box', 'Holds'), n('emails', 'box', 'Emails'), n('reports', 'box', 'Reports')],
      edges: [e('holds', 'pricing', 'asks price', { state: 'ghost' }), e('emails', 'holds', 'listens', { state: 'ghost', dashed: true })],
      ...layout(300, 420, {
        mgr: [{ x: 410, y: 150, w: 300, h: 90 }, { x: 180, y: 60, w: 300, h: 90 }],
        pricing: [{ x: 140, y: 70, w: 160 }, { x: 92, y: 220, w: 160 }],
        holds: [{ x: 140, y: 230, w: 160 }, { x: 268, y: 220, w: 160 }],
        emails: [{ x: 680, y: 70, w: 160 }, { x: 92, y: 360, w: 160 }],
        reports: [{ x: 680, y: 230, w: 160 }, { x: 268, y: 360, w: 160 }],
      }),
    },
  },
  steps: [
    { kicker: 'Problem', title: 'One class doing four jobs', body: ['`BookingManager` prices seats, manages holds, sends emails and builds reports. Its methods share fields loosely, so a change for one job can break another. It has **low cohesion**: its parts don’t belong together.'], view: { hide: ['pricing', 'holds', 'emails', 'reports'], states: { mgr: 'fail' } } },
    { kicker: 'Fix', title: 'Split by reason to change', body: ['Group code that changes for the same reason. Pricing changes when the business changes prices, and emails change when marketing rewrites copy. Four focused modules, each with **high cohesion**: everything inside serves one purpose.'], view: { hide: ['mgr'], states: { pricing: 'focus', holds: 'focus', emails: 'focus', reports: 'focus' } }, changes: [{ kind: 'chg', text: 'One class → four focused modules' }] },
    { kicker: 'Idea', title: 'Coupling: how much modules know', body: ['**Coupling** is how much one module depends on another’s details. Holds asks pricing for a price through one function: loose coupling. Emails only *listens* for a “held” event and knows nothing about how holds work: looser still.'], view: { hide: ['mgr'], edgeStates: { 'holds-pricing': 'idle', 'emails-holds': 'idle' } } },
    { kicker: 'Predict', title: 'Test the design', body: ['Marketing rewrites every email template.'], view: { hide: ['mgr'], edgeStates: { 'holds-pricing': 'idle', 'emails-holds': 'idle' }, states: { emails: 'active' } },
      predict: { id: 'touch', prompt: 'Which modules have to change?', choices: [
        { id: 'emails', text: 'Only Emails', why: 'Right. High cohesion means the change stays inside one module; loose coupling means nobody else notices.' },
        { id: 'all', text: 'Emails and Holds', why: 'Holds publishes an event and doesn’t know how emails are written. Nothing in it changes.' },
      ], correct: 'emails' } },
  ],
  worked: { title: 'deep modules', blocks: [
    { type: 'p', text: 'A useful test from *A Philosophy of Software Design*: a good module is **deep**. It has a small interface hiding a lot of behaviour. `pricing.price_for(seat, buyer)` is one function, behind which live discounts, surge rules and currency rounding. Callers know nothing about them, so all of that can change freely.' },
    { type: 'table', head: ['Signal', 'Suggests'], rows: [['Changing one feature touches many files', 'Low cohesion: related code is spread out'], ['A module imports many internals of another', 'Tight coupling'], ['A class has fields only some methods use', 'It may be several classes'], ['Callers must call methods in a specific order', 'A shallow interface leaking internals']] },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Holds reads `pricing._surge_table` directly to compute a price. What’s the problem?', choices: [
    { id: 'tight', text: 'Tight coupling: any change to pricing’s internals breaks holds.', why: 'Right. Call a public function like `pricing.price_for(seat)` instead.' },
    { id: 'fine', text: 'Nothing. It’s faster.', why: 'Speed isn’t the issue. Holds now depends on a private detail pricing should be free to change.' },
  ], correct: 'tight' }],
  exercise: { id: 'split', prompt: 'A `UserService` handles sign-up, password reset, profile photos and invoice PDFs. How would you split it, and by what rule?', checklist: ['Splits by reason to change (e.g. accounts/auth, profiles/media, billing).', 'States the rule (things that change together stay together).'], model: 'Split by reason to change: an accounts module (sign-up, password reset), a profile module (photos), and billing (invoices). Each changes for different reasons and teams.' },
  next: { id: 'solid', reason: 'Cohesion and coupling underlie five famous design rules. Next: SOLID.' },
};

export const solid: GenericLesson = {
  id: 'solid',
  area: 'LLD and machine coding',
  opening: 'Five principles with an acronym, SOLID, show up in nearly every LLD interview. Each is easier to see as a specific mistake and its fix than as a definition. Here they are on booking-system code.',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Idea', title: 'S: single responsibility', body: ['A module should have **one reason to change**. `Invoice` that both calculates totals and renders PDFs changes when tax rules change *and* when the PDF design changes.'],
      compare: { left: { title: 'Violates', points: ['`Invoice.total()` and `Invoice.render_pdf()`'], tone: 'fail' }, right: { title: 'Fixed', points: ['`Invoice.total()`', '`InvoicePdf(invoice).render()`'], tone: 'ok' } } },
    { kicker: 'Idea', title: 'O: open for extension, closed to edits', body: ['Add behaviour **without editing** working code. A new payment method shouldn’t mean editing an `if/elif` chain in checkout.'],
      compare: { left: { title: 'Violates', points: ['`if method == "card": ... elif method == "wallet": ...`'], tone: 'fail' }, right: { title: 'Fixed', points: ['`method.pay(amount)`: new methods are new classes'], tone: 'ok' } } },
    { kicker: 'Idea', title: 'L: Liskov substitution', body: ['A subtype must work **anywhere its parent works**. If `FreeTicket(Ticket)` raises an error on `refund()`, code that refunds any ticket breaks when handed a free one.'],
      compare: { left: { title: 'Violates', points: ['`FreeTicket.refund()` raises NotImplementedError'], tone: 'fail' }, right: { title: 'Fixed', points: ['`FreeTicket.refund()` returns €0, or refund isn’t on the base type'], tone: 'ok' } } },
    { kicker: 'Idea', title: 'I and D: small interfaces, abstractions', body: ['**Interface segregation**: don’t force clients to depend on methods they don’t use. **Dependency inversion**: high-level code (checkout) depends on an abstraction (`charge(cents)`), not a concrete provider.'],
      compare: { left: { title: 'Violates', points: ['`Checkout` imports `StripeClient` directly', 'A 20-method `PaymentGateway` interface for a 1-method need'], tone: 'fail' }, right: { title: 'Fixed', points: ['`Checkout(charge=...)` takes any function or object with `charge`', 'Tiny interfaces matching real needs'], tone: 'ok' } } },
    { kicker: 'Predict', title: 'Name the violation', body: ['A colleague’s code:'],
      compare: { left: { title: 'Code', points: ['`class ReadOnlySeatMap(SeatMap):`', '`    def block(self, seat): raise Exception("read only")`'] }, right: { title: 'Context', points: ['Admin code calls `seat_map.block(seat)` on any SeatMap'] } },
      predict: { id: 'which', prompt: 'Which principle does this break?', choices: [
        { id: 'l', text: 'Liskov substitution', why: 'Right. A ReadOnlySeatMap can’t stand in for a SeatMap. Better: a separate read-only interface that SeatMap extends.' },
        { id: 's', text: 'Single responsibility', why: 'The class has one job. The problem is that it breaks its parent’s promise.' },
        { id: 'o', text: 'Open/closed', why: 'It extends without editing, but the extension breaks substitutability.' },
      ], correct: 'l' } },
  ],
  worked: { title: 'SOLID in one table', blocks: [
    { type: 'table', head: ['Principle', 'Symptom when broken', 'Typical fix'], rows: [['Single responsibility', 'Unrelated changes collide in one class', 'Split by reason to change'], ['Open/closed', 'Every new case edits an if/elif chain', 'Polymorphism or a registry of handlers'], ['Liskov substitution', 'Subclasses throw “not supported”', 'Redesign the hierarchy or interface'], ['Interface segregation', 'Implementers stub out methods they don’t need', 'Split into role-sized interfaces'], ['Dependency inversion', 'Core logic imports concrete infrastructure', 'Depend on a small abstraction; inject the concrete one']] },
    { type: 'p', text: 'Treat SOLID as smells to notice, not rules to apply everywhere. A 20-line script doesn’t need dependency inversion.' },
  ] },
  checks: [{ kind: 'choice', id: 'dip', prompt: '`class Checkout:` creates `StripeClient()` inside its constructor. Which principle does this break most clearly?', choices: [
    { id: 'd', text: 'Dependency inversion', why: 'Right. Checkout is welded to one concrete provider and can’t be tested with a fake. Pass the client in.' },
    { id: 'i', text: 'Interface segregation', why: 'The issue is depending on a concrete class at all, not the interface’s size.' },
  ], correct: 'd' }],
  exercise: { id: 'pick', prompt: 'Which SOLID principle do you think matters most in day-to-day code, and why? One or two sentences.', checklist: ['Names one principle.', 'Gives a concrete reason tied to change or testing.'], model: 'Single responsibility: most painful bugs I’ve seen come from unrelated changes colliding in one class, and splitting by reason to change prevents that.' },
  next: { id: 'contracts-invariants', reason: 'SOLID shapes classes. Next: the promises each class keeps.' },
};

export const contractsInvariants: GenericLesson = {
  id: 'contracts-invariants',
  area: 'LLD and machine coding',
  opening: 'A bug report: an order total of −€12. Nobody wrote “make totals negative”. Somewhere, a discount larger than the price slipped through. What if it were impossible to create negative money in the first place?',
  visual: { kind: 'none' },
  steps: [
    { kicker: 'Idea', title: 'Contracts: what a function promises', body: ['A **contract** states what a function expects (**preconditions**: amount is positive) and what it guarantees (**postconditions**: the balance went down by exactly that amount). Write them down, and check the preconditions at the boundary.'], code: { code: 'def withdraw(wallet, cents):\n    if cents <= 0:\n        raise ValueError("amount must be positive")      # precondition\n    if cents > wallet.cents:\n        raise ValueError("insufficient funds")            # precondition\n    wallet.cents -= cents                                 # postcondition: balance down by cents', highlight: [2, 4], caption: 'Fail loudly at the boundary instead of corrupting state', open: true } },
    { kicker: 'Idea', title: 'Invariants: what is always true', body: ['An **invariant** holds for an object at all times: money is never negative, and a booked seat always has a buyer. Enforce it in the one place objects are created and changed. Then no caller can break it, even by accident.'], code: { code: MONEY, highlight: [pyLine(MONEY, 'if self.cents < 0')], caption: 'python/sdm/lld.py — New Python: `@dataclass(frozen=True)` makes an immutable class; `__post_init__` runs after the fields are set.', open: true } },
    { kicker: 'Predict', title: 'Immutable values remove a class of bugs', body: ['`Money` is frozen: once created, its fields can’t change. Adding money returns a *new* Money object.'], code: { code: 'price = Money(4500, "EUR")\ndiscount = Money(5700, "EUR")\nprice.cents = price.cents - discount.cents', highlight: [3], caption: 'What happens on line 3?' },
      predict: { id: 'frozen', prompt: 'What happens when line 3 runs?', choices: [
        { id: 'error', text: 'An error: frozen dataclasses refuse assignment.', why: 'Right. And constructing `Money(-1200, "EUR")` would also fail in `__post_init__`. The −€12 total can’t exist.' },
        { id: 'neg', text: 'price becomes −€12.', why: 'That’s exactly the bug this design prevents. Frozen objects can’t be modified after creation.' },
      ], correct: 'error' } },
    { kicker: 'Trade-off', title: 'Where to validate, and how to fail', body: ['Validate untrusted input at the edges (API requests, files) and return clear errors. Inside the system, invariants in constructors catch programming mistakes. Raise exceptions for broken contracts rather than returning `None` or `-1`, which callers forget to check.'] },
  ],
  worked: { title: 'error handling that keeps invariants', blocks: [
    { type: 'table', head: ['Situation', 'Handle by'], rows: [['User typed a bad email', 'Return a validation error (400) with a message'], ['Seat already held', 'A normal outcome: return a clear result (“unavailable”)'], ['Money would go negative', 'Raise: it’s a bug, and the invariant must hold'], ['Payment provider timed out', 'Retry with backoff, then report failure ([Retries](/learn/retries))']] },
    { type: 'p', text: 'Distinguish expected outcomes (sold out, declined) from broken contracts (negative money). The first are results, and the second are exceptions.' },
  ] },
  checks: [{ kind: 'line', id: 'where', prompt: 'Where is the best single place to guarantee “money is never negative”?', code: '@dataclass(frozen=True)\nclass Money:\n    cents: int\n    currency: str\n\n    def __post_init__(self):\n        if self.cents < 0:\n            raise ValueError("money cannot be negative")', answer: [7], explain: 'Every Money is checked as it’s created, and frozen means it can’t change afterwards. No caller can produce negative money.', wrong: { 3: 'Declaring the field doesn’t validate it.', 2: 'The class declaration alone enforces nothing.' } }],
  exercise: { id: 'booked', prompt: 'State one invariant for a Booking object and say where you would enforce it.', checklist: ['A concrete always-true rule (e.g. status “paid” implies a payment id; total ≥ 0).', 'Enforced at construction/state-change methods.'], model: 'A booking in status “paid” always has a payment id; enforce it in the method that moves the booking to paid, which requires the payment id as an argument.' },
  next: { id: 'domain-objects', reason: 'Value objects like Money are one kind of domain object. Next: entities and repositories.' },
};

export const domainObjects: GenericLesson = {
  id: 'domain-objects',
  area: 'LLD and machine coding',
  opening: 'Two €45 amounts are the same thing. Two bookings for €45 are not. Booking #91 stays booking #91 even after its price changes. Telling these apart decides how you compare, store and change them.',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Idea', title: 'Value objects: defined by their value', body: ['A **value object** has no identity: `Money(4500, "EUR")` equals any other `Money(4500, "EUR")`. It’s immutable, so you replace it instead of changing it. Seat numbers, dates, addresses and money are usually value objects.'],
      compare: { left: { title: 'Value object', points: ['`Money(4500, "EUR") == Money(4500, "EUR")` → True', 'Immutable; “change” = new object', 'Safe to share and cache'], tone: 'ok' }, right: { title: 'Examples', points: ['Money, SeatNumber("F", 12)', 'DateRange, EmailAddress'] } } },
    { kicker: 'Idea', title: 'Entities: defined by identity', body: ['An **entity** has an identity that stays the same while its attributes change: booking #91 is the same booking when it moves from pending to paid. Compare entities by id, not by their fields.'],
      compare: { left: { title: 'Value object', points: ['Equal if values equal'] }, right: { title: 'Entity', points: ['`Booking("b91", ...)` stays b91 through every change', 'Equal if ids equal', 'Has a lifecycle (pending → paid → cancelled)'], tone: 'ok' } } },
    { kicker: 'Idea', title: 'Repositories: storage as a collection', body: ['A **repository** gives domain code a simple collection-like interface (`get(id)`, `save(booking)`) and hides SQL, caches and HTTP behind it. Domain logic stays readable and testable with an in-memory version.'],
      compare: { left: { title: 'Domain code sees', points: ['`bookings.get("b91")`', '`bookings.save(booking)`'], tone: 'ok' }, right: { title: 'Repository hides', points: ['SQL queries and connections', 'Mapping rows ↔ objects', 'Caching'] } } },
    { kicker: 'Predict', title: 'Which is which?', body: ['Classify a venue’s **seat number** (“row F, seat 12”) and a **buyer account**.'],
      compare: { left: { title: 'Seat number', points: ['Row F, seat 12'] }, right: { title: 'Buyer account', points: ['Can change email, name, password'] } },
      predict: { id: 'classify', prompt: 'Which pairing is right?', choices: [
        { id: 'right', text: 'Seat number: value object. Buyer account: entity.', why: 'Right. F12 is just a value. A buyer stays the same person when their email changes.' },
        { id: 'wrong', text: 'Seat number: entity. Buyer account: value object.', why: 'Two “F12” values are interchangeable. Two buyers with the same name are different people.' },
      ], correct: 'right' } },
  ],
  worked: { title: 'the three building blocks in Python', blocks: [
    { type: 'code', lang: 'python', code: py('sdm/lld.py').split('# --- Dependency injection')[0].split('# --- Value objects and entities')[1].trim(), caption: 'python/sdm/lld.py — a value object, an entity, a repository protocol, and an in-memory repository for tests' },
    { type: 'p', text: 'An **aggregate** groups entities that must change together under one root: an Order and its line items are saved and loaded as a unit, and outside code goes through the Order.' },
  ] },
  checks: [{ kind: 'choice', id: 'eq', prompt: 'Two Booking objects have identical fields but ids b91 and b92. Are they the same booking?', choices: [
    { id: 'no', text: 'No: entities are compared by identity.', why: 'Right. Two people can book identical seats on identical terms and still hold two bookings.' },
    { id: 'yes', text: 'Yes: their fields match.', why: 'That’s value-object equality. Bookings are entities.' },
  ], correct: 'no' }],
  exercise: { id: 'repo', prompt: 'Why give domain code a repository instead of letting it run SQL directly?', checklist: ['Domain logic stays readable/independent of storage.', 'Tests can use an in-memory repository.'], model: 'The domain logic reads as business rules rather than SQL, and tests can swap in an in-memory repository so they run fast with no database.' },
  next: { id: 'dependency-injection', reason: 'Repositories are dependencies. Next: passing them in, so tests can swap them out.' },
};

export const dependencyInjection: GenericLesson = {
  id: 'dependency-injection',
  area: 'LLD and machine coding',
  opening: 'To test “an expired hold can’t be paid”, you’d need to charge a real card and wait ten minutes. Or you could hand checkout a fake card processor and a clock you control. That second option needs one design decision made up front.',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('co', 'service', 'Checkout'), n('pay', 'ext', 'Real payment API'), n('clock', 'box', 'System clock'), n('db', 'db', 'Real database'), n('fpay', 'box', 'Fake charge', { sub: 'records calls' }), n('fclock', 'box', 'Fake clock', { sub: 'returns 300.0' }), n('fdb', 'box', 'In-memory repo')],
      edges: [e('co', 'pay'), e('co', 'clock'), e('co', 'db'), e('co', 'fpay', undefined, { state: 'ghost' }), e('co', 'fclock', undefined, { state: 'ghost' }), e('co', 'fdb', undefined, { state: 'ghost' })],
      ...layout(330, 470, {
        co: [{ x: 410, y: 165, w: 180 }, { x: 180, y: 230, w: 200 }],
        pay: [{ x: 120, y: 60, w: 190 }, { x: 70, y: 50, w: 124 }],
        clock: [{ x: 120, y: 165, w: 190 }, { x: 180, y: 50, w: 92 }],
        db: [{ x: 120, y: 270, w: 190 }, { x: 290, y: 50, w: 124 }],
        fpay: [{ x: 700, y: 60, w: 180 }, { x: 70, y: 410, w: 124 }],
        fclock: [{ x: 700, y: 165, w: 180 }, { x: 180, y: 410, w: 92 }],
        fdb: [{ x: 700, y: 270, w: 180 }, { x: 290, y: 410, w: 124 }],
      }),
    },
  },
  steps: [
    { kicker: 'Problem', title: 'Hard-wired dependencies', body: ['If checkout creates its own payment client and reads the system clock inside its methods, tests can’t replace them. Every test charges real cards and depends on the real time.'], view: { hide: ['fpay', 'fclock', 'fdb'], states: { co: 'fail' } } },
    { kicker: 'Fix', title: 'Pass dependencies in', body: ['**Dependency injection** just means: give an object its collaborators instead of letting it create them. Checkout takes `charge`, `clock` and `bookings` as constructor arguments. Production passes real ones.'], view: { hide: ['fpay', 'fclock', 'fdb'], states: { co: 'focus' } }, code: { code: CHECKOUT_INIT, caption: 'python/sdm/lld.py — collaborators arrive through __init__', open: true } },
    { kicker: 'Watch', title: 'Tests pass fakes', body: ['A test passes a fake charge function that records calls, a clock stuck at 300.0, and an in-memory repository. No network, no waiting, no real money: the test runs in milliseconds.'], view: { dim: ['pay', 'clock', 'db'], edgeStates: { 'co-pay': 'ghost', 'co-clock': 'ghost', 'co-db': 'ghost', 'co-fpay': 'idle', 'co-fclock': 'idle', 'co-fdb': 'idle' }, states: { fclock: 'focus' } }, changes: [{ kind: 'chg', text: 'Same Checkout code, fake collaborators' }] },
    { kicker: 'Predict', title: 'Run the expired-hold test', body: ['The fake clock returns 300.0 and the hold expired at 200.0.'], view: { dim: ['pay', 'clock', 'db'], edgeStates: { 'co-pay': 'ghost', 'co-clock': 'ghost', 'co-db': 'ghost', 'co-fpay': 'idle', 'co-fclock': 'idle', 'co-fdb': 'idle' } }, code: { code: CHECKOUT_PAY, highlight: [pyLine(CHECKOUT_PAY, 'if self.clock() >= hold_expires_at')], caption: 'python/sdm/lld.py', open: true },
      predict: { id: 'result', prompt: 'What does `pay()` return, and is the fake charge called?', choices: [
        { id: 'expired', text: '"hold expired", and charge is never called.', why: 'Right. The test can assert both: the result, and that the fake recorded no charge.' },
        { id: 'paid', text: '"paid"', why: 'The clock check runs before charging: 300.0 ≥ 200.0, so it returns early.' },
      ], correct: 'expired' } },
  ],
  worked: { title: 'the test, in full', blocks: [
    { type: 'code', lang: 'python', code: 'def test_expired_hold_is_not_charged():\n    repo = InMemoryBookings()\n    repo.save(Booking("b2", "F13", Money(4500, "EUR")))\n    charges = []\n    checkout = Checkout(\n        charge=lambda cents: charges.append(cents) or True,   # fake: records, always succeeds\n        clock=lambda: 300.0,                                 # fake: time stands still\n        bookings=repo,\n    )\n    assert checkout.pay("b2", hold_expires_at=200.0) == "hold expired"\n    assert charges == []', caption: 'Adapted from python/tests/test_lld.py — runs in milliseconds' },
    { type: 'p', text: 'In Python, injection is usually just constructor or function arguments, with no framework required. Default arguments can supply production dependencies for convenience: `clock=time.time`.' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Which version of a function is easiest to test?', choices: [
    { id: 'inj', text: '`def is_expired(hold, now): return now >= hold.expires_at`', why: 'Right. Time is an argument, so a test passes any value it likes.' },
    { id: 'wired', text: '`def is_expired(hold): return time.time() >= hold.expires_at`', why: 'The test would have to wait, or patch the global clock.' },
  ], correct: 'inj' }],
  exercise: { id: 'what', prompt: 'Name two dependencies in a booking service you would always inject, and why.', checklist: ['Names two (clock, payment client, repository, ID generator, email sender).', 'Reason: nondeterministic, slow, external or costly in tests.'], model: 'The clock (time-dependent rules must be testable without waiting) and the payment client (tests must never charge real cards).' },
  next: { id: 'uml', reason: 'Collaborators form a structure. Next: drawing it so others can review it.' },
};

export const LLD1 = [responsibilities, polymorphismComposition, cohesionCoupling, solid, contractsInvariants, domainObjects, dependencyInjection];
