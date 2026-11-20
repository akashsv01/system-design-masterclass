import type { GenericLesson } from '../lessonTypes';
import { e, layout, n, py, pyLine } from './_kit';

const P = 'sdm/patterns.py';
const CHECKOUT_TOTAL = py(P, 'checkout_total');
const STUDENT = py(P, 'student_price');
const SURGE = py(P, 'SurgePricing');
const PUBLISH = py(P, 'publish');
const ORDER_PENDING = py(P, 'Pending');
const RETRYING = py(P, 'RetryingClient');
const LISTING = '@dataclass(frozen=True)\n' + py(P, 'EventListing');
const ADAPTER = py(P, 'OldBankAdapter');
const SEATMAP = py(P, 'SeatMap');

const IF_CHAIN = `def checkout_total(base_cents, quantity, kind):
    if kind == "regular":
        price = base_cents
    elif kind == "student":
        price = base_cents * 80 // 100
    elif kind == "member":
        price = base_cents * 90 // 100
    # every new rule: edit this function
    return price * quantity`;

export const patternStrategy: GenericLesson = {
  id: 'pattern-strategy',
  area: 'Design patterns',
  opening: 'Change request: “Add member pricing. Next month, group pricing. Then surge pricing on sale day.” Each request edits the same `if/elif` chain in checkout, and each edit risks breaking the others. What if checkout didn’t know any pricing rules at all?',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Problem', title: 'Every rule edits checkout', body: ['The pricing rules live inside checkout as a growing chain of conditions. Checkout changes whenever pricing changes, and every test of checkout must cover every rule.'],
      compare: { left: { title: 'Now', points: ['`if kind == "regular" … elif "student" … elif "member"`', 'New rule = edit checkout'], tone: 'fail' }, right: { title: 'Wanted', points: ['Checkout asks “what does this cost?”', 'New rule = new code, no edits'] } },
      code: { code: IF_CHAIN, highlight: [2, 4, 6], caption: 'The growing conditional', open: true } },
    { kicker: 'Fix', title: 'Step 1: pass the rule in as a function', body: ['In Python, functions are values. Write each rule as a small function and pass the one you want into checkout. Checkout calls `pricing(base)` and no longer knows which rule it got. That’s the **Strategy** pattern, with no classes needed.'],
      compare: { left: { title: 'Rules', points: ['`regular_price`, `student_price`, `member_price`', 'Each a 2-line function, tested alone'], tone: 'ok' }, right: { title: 'Checkout', points: ['`checkout_total(5000, 2, student_price)`', 'Never edited for new rules'], tone: 'ok' } },
      code: { code: `${STUDENT}\n\n\n${CHECKOUT_TOTAL}`, highlight: [6, 7], caption: 'python/sdm/patterns.py — New Python: `Callable[[int], int]` is the type of “a function from int to int”.', open: true }, changes: [{ kind: 'chg', text: 'Rules moved out of checkout into functions' }] },
    { kicker: 'Predict', title: 'A rule that needs state', body: ['Surge pricing depends on how many seats are left, which changes during the sale.'],
      compare: { left: { title: 'A plain function', points: ['`def surge_price(base): ...`', 'Where do seats_left and capacity come from?'] }, right: { title: 'Option', points: ['A small class holding that state, callable like a function'] } },
      predict: { id: 'state', prompt: 'How should surge pricing fit the same checkout without changing it?', choices: [
        { id: 'class', text: 'A class with `__call__`, created with seats_left and capacity, passed in exactly like the functions.', why: 'Right. Use a class only when the strategy needs its own state. Checkout still just calls `pricing(base)`.' },
        { id: 'global', text: 'Read seats_left from a global variable inside a function.', why: 'Hidden global state makes it untestable and wrong when two events sell at once.' },
        { id: 'edit', text: 'Add `elif kind == "surge"` back into checkout.', why: 'That undoes the refactoring.' },
      ], correct: 'class' } },
    { kicker: 'Watch', title: 'Step 2: a class only when it earns it', body: ['`SurgePricing(seats_left=10, capacity=100)` stores its state, and `__call__` makes the object callable, so checkout can’t tell it apart from a function. Base €50, 90% sold: €50 + 45% of €50 = €72.50.'],
      compare: { left: { title: 'Function strategies', points: ['regular, student, member'], tone: 'ok' }, right: { title: 'Class strategy', points: ['SurgePricing(seats_left, capacity)', 'Same call: `pricing(base)`'], tone: 'ok' } },
      code: { code: SURGE, highlight: [pyLine(SURGE, 'def __call__')], caption: 'python/sdm/patterns.py — New Python: defining `__call__` lets you call an object like a function.', open: true } },
  ],
  worked: { title: 'the whole refactoring, tested', blocks: [
    { type: 'code', lang: 'python', code: 'checkout_total(5000, 2, regular_price)                          # 10000\ncheckout_total(5000, 2, student_price)                          # 8000\ncheckout_total(5000, 1, SurgePricing(seats_left=10, capacity=100))  # 7250', caption: 'Each line is asserted in python/tests/test_lld.py' },
    { type: 'p', text: '**When not to use it:** two rules that never change don’t need a strategy. An `if` is clearer. Reach for Strategy when rules multiply, vary per customer or event, or need testing in isolation.' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Group pricing arrives: 10% off when buying 6 or more. With the refactored design, what changes?', choices: [
    { id: 'new', text: 'Write a new pricing strategy; checkout is untouched.', why: 'Right. (It needs quantity, so its signature might take it, or a class could hold it. The point is that checkout doesn’t grow.)' },
    { id: 'edit', text: 'Edit checkout to detect groups.', why: 'That reintroduces rule knowledge into checkout.' },
  ], correct: 'new' }],
  exercise: { id: 'when', prompt: 'In one or two sentences: why start with functions before reaching for strategy classes in Python?', checklist: ['Functions are simpler and already interchangeable values.', 'A class is only needed when the strategy holds state or configuration.'], model: 'Functions are already interchangeable values in Python, so a pricing rule can be two lines; a class only earns its place when the rule needs its own state, like surge pricing’s seat counts.' },
  next: { id: 'pattern-observer', reason: 'Strategy swaps one behaviour. Observer lets many listeners react to one event.' },
};

export const patternObserver: GenericLesson = {
  id: 'pattern-observer',
  area: 'Design patterns',
  opening: 'Change request: “When a booking is confirmed, also award loyalty points.” Checkout already calls the emailer, analytics and the venue notifier directly. Adding one more call means editing checkout again, and if the emailer throws, nothing after it runs.',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('checkout', 'service', 'Checkout'), n('bus', 'queue', 'EventBus', { sub: 'booked →' }), n('email', 'box', 'send_ticket'), n('analytics', 'box', 'record_sale'), n('loyalty', 'box', 'award_points')],
      edges: [e('checkout', 'bus', 'publish'), e('bus', 'email'), e('bus', 'analytics'), e('bus', 'loyalty')],
      ...layout(320, 470, {
        checkout: [{ x: 110, y: 160, w: 160 }, { x: 180, y: 45, w: 180 }],
        bus: [{ x: 380, y: 160, w: 180 }, { x: 180, y: 165, w: 200 }],
        email: [{ x: 700, y: 60, w: 180 }, { x: 70, y: 330, w: 124 }],
        analytics: [{ x: 700, y: 160, w: 180 }, { x: 180, y: 410, w: 130 }],
        loyalty: [{ x: 700, y: 260, w: 180 }, { x: 290, y: 330, w: 124 }],
      }),
    },
  },
  steps: [
    { kicker: 'Problem', title: 'Checkout knows every listener', body: ['Each new reaction to a booking means another call inside checkout. Checkout depends on email, analytics, venue and now loyalty code, none of which is its job.'], view: { hide: ['bus', 'loyalty'] } },
    { kicker: 'Fix', title: 'Publish once, let listeners subscribe', body: ['The **Observer** pattern: checkout publishes “booked” to an event bus. Listeners subscribe themselves. Checkout no longer knows who’s listening.'], view: { tokens: [{ from: 'checkout', to: 'bus', label: 'booked F12', tone: 'request' }] }, code: { code: PUBLISH, highlight: [pyLine(PUBLISH, 'for listener in')], caption: 'python/sdm/patterns.py' }, changes: [{ kind: 'add', text: 'award_points subscribes; checkout unchanged' }] },
    { kicker: 'Predict', title: 'One listener fails', body: ['The mail server is down, so `send_ticket` raises an exception.'], view: { states: { email: 'fail' }, tokens: [{ from: 'bus', to: 'analytics', label: 'booked', tone: 'copy' }, { from: 'bus', to: 'loyalty', label: 'booked', tone: 'copy' }] }, code: { code: PUBLISH, highlight: [pyLine(PUBLISH, 'except Exception as exc:')], caption: 'python/sdm/patterns.py', open: true },
      predict: { id: 'fail', prompt: 'With this `publish`, do analytics and loyalty still run?', choices: [
        { id: 'yes', text: 'Yes: each listener’s exception is caught and recorded, then the loop continues.', why: 'Right. One failing observer must not silently cancel the others. The errors are returned so someone can retry or alert.' },
        { id: 'no', text: 'No: the exception stops the loop.', why: 'It would without the try/except. That’s a classic Observer bug.' },
      ], correct: 'yes' } },
    { kicker: 'Trade-off', title: 'In-process vs across services', body: ['An in-process event bus is simple, but listeners run inside the request and die with the process. When reactions must survive crashes or run elsewhere, use a durable queue or topic, which is [pub/sub](/learn/queues) with the same idea.'], view: {} },
  ],
  worked: { title: 'the event bus', blocks: [{ type: 'code', lang: 'python', code: py(P, 'EventBus'), caption: 'python/sdm/patterns.py — tested: a broken listener doesn’t stop the others' }] },
  checks: [{ kind: 'choice', id: 'order', prompt: 'Listeners run in subscription order. Analytics must run after loyalty points are awarded. What’s the risk of relying on that order?', choices: [
    { id: 'fragile', text: 'Order becomes a hidden dependency that breaks when someone reorders subscriptions.', why: 'Right. If one reaction depends on another, make that explicit: chain them, or have loyalty publish its own event.' },
    { id: 'none', text: 'None: order is guaranteed.', why: 'It’s guaranteed by an implementation detail nobody will remember. Hidden ordering is a common source of bugs.' },
  ], correct: 'fragile' }],
  exercise: { id: 'when', prompt: 'When would you *not* use Observer for booking reactions?', checklist: ['When the caller needs the reaction’s result or must fail if it fails (e.g. payment).', 'Or when only one fixed collaborator exists (a direct call is clearer).'], model: 'When checkout must know the outcome, such as charging the card, since a fire-and-forget event can’t make the booking fail; reactions that merely follow the booking are the good fit.' },
  next: { id: 'pattern-state', reason: 'Observer decouples reactions. State tidies objects whose behaviour depends on their status.' },
};

export const patternState: GenericLesson = {
  id: 'pattern-state',
  area: 'Design patterns',
  opening: 'Change request: “Add a ‘disputed’ order status.” The `Order` class has `pay()`, `cancel()`, `refund()` and `ship()`, and each starts with the same `if status == "pending" … elif status == "paid" …` switch. Adding one status means editing all four.',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Problem', title: 'The same switch in every method', body: ['Every method branches on status. Behaviour for one status is spread across four methods, and adding a status touches all of them.'],
      compare: { left: { title: 'Now', points: ['`pay()`: if pending… elif paid… elif cancelled…', '`cancel()`: if pending… elif paid… elif cancelled…'], tone: 'fail' }, right: { title: 'Pain', points: ['New status = edit every method', 'Easy to miss one'] } } },
    { kicker: 'Fix', title: 'One object per state', body: ['The **State** pattern moves each status’s behaviour into its own class: `Pending`, `Paid`, `Cancelled`. The order holds its current state object and delegates: `order.pay()` calls `self.state.pay(self)`. Each state decides what happens and which state comes next.'],
      compare: { left: { title: 'Order', points: ['`def pay(self): return self.state.pay(self)`'], tone: 'ok' }, right: { title: 'Pending', points: ['`pay`: → Paid', '`cancel`: → Cancelled'], tone: 'ok' } },
      code: { code: ORDER_PENDING, highlight: [pyLine(ORDER_PENDING, 'order.state = Paid()')], caption: 'python/sdm/patterns.py — New Python: `ABC` and `@abstractmethod` force each state to implement every action.', open: true }, changes: [{ kind: 'chg', text: 'Per-status behaviour moved into state classes' }] },
    { kicker: 'Predict', title: 'Paying twice', body: ['An order is Paid and the client sends `pay()` again.'],
      compare: { left: { title: 'Paid.pay', points: ['returns “already paid”'] }, right: { title: 'Paid.cancel', points: ['→ Cancelled, returns “refund issued”'] } },
      predict: { id: 'twice', prompt: 'Where is the “already paid” behaviour defined?', choices: [
        { id: 'paid', text: 'In the `Paid` class, alongside everything else a paid order does.', why: 'Right. All of a status’s behaviour is in one place. Adding “Disputed” means adding one class.' },
        { id: 'order', text: 'In `Order.pay` with an if-statement.', why: 'That’s the old design. Order now only delegates.' },
      ], correct: 'paid' } },
    { kicker: 'Trade-off', title: 'Table or classes?', body: ['A transition table ([State machines](/learn/state-machines)) is simpler when states differ only in *which* transitions are allowed. State classes earn their keep when each state *behaves* differently: different messages, side effects, calculations.'],
      compare: { left: { title: 'Transition table', points: ['Small, data-driven', 'Best when states only gate transitions'], tone: 'ok' }, right: { title: 'State classes', points: ['Behaviour per state', 'Best when actions differ a lot by state'], tone: 'ok' } } },
  ],
  worked: { title: 'the order lifecycle', blocks: [{ type: 'code', lang: 'python', code: py(P).split('# --- State ')[1].split('# --- Decorator')[0].replace(/^-+\n/, '').trim(), caption: 'python/sdm/patterns.py — tested with pytest' }] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Adding a “Disputed” status with the State pattern requires…', choices: [
    { id: 'class', text: 'A new `Disputed` class, plus the transitions that lead into it.', why: 'Right. Existing state classes change only where they transition to Disputed.' },
    { id: 'all', text: 'Editing every method of Order.', why: 'Order only delegates. That was the problem being solved.' },
  ], correct: 'class' }],
  exercise: { id: 'which', prompt: 'For a ticket that is only Issued / Scanned / Refunded with no other behaviour differences, would you use State classes? Why?', checklist: ['No: a transition table is simpler.', 'States only gate transitions; no per-state behaviour to hold.'], model: 'No: the states only decide which transitions are allowed, which a small transition table expresses more simply than three classes.' },
  next: { id: 'pattern-decorator', reason: 'State changes behaviour by status. Decorator adds behaviour around an object without touching it.' },
};

export const patternDecorator: GenericLesson = {
  id: 'pattern-decorator',
  area: 'Design patterns',
  opening: 'Change request: “Payment calls must retry on timeout, and every call must be logged.” You could edit the payment client. But the client is shared, retries suit only some callers, and the next request will be “add metrics”. Can you add behaviour around an object without editing it?',
  visual: { kind: 'stack', layers: [
    { id: 'log', label: 'LoggingClient', detail: 'records each charge' },
    { id: 'retry', label: 'RetryingClient', detail: 'retries timeouts, up to 3 attempts' },
    { id: 'provider', label: 'Provider client', detail: 'the real charge() call' },
  ] },
  steps: [
    { kicker: 'Idea', title: 'Wrap, don’t edit', body: ['A **Decorator** is an object with the *same interface* as the thing it wraps. It does its extra work, then delegates to the inner object. Callers can’t tell the difference.'], stack: { ghost: ['log', 'retry'], focus: 'provider' } },
    { kicker: 'Watch', title: 'Add retries as a layer', body: ['`RetryingClient(provider)` has a `charge` method too. It calls the inner `charge` and catches timeouts up to three times. The provider’s code is unchanged.'], stack: { ghost: ['log'], focus: 'retry', tones: { retry: 'active' } }, code: { code: RETRYING, highlight: [pyLine(RETRYING, 'return self.inner.charge(cents)')], caption: 'python/sdm/patterns.py', open: true }, changes: [{ kind: 'add', text: 'Retry layer around the provider' }] },
    { kicker: 'Watch', title: 'Stack another layer', body: ['`LoggingClient(RetryingClient(provider), log)` adds logging on the outside. Pull the layers apart: each wraps the next and offers the same `charge` call.'], stack: { separation: 0.9, focus: 'log', tones: { log: 'active', retry: 'ok' } } },
    { kicker: 'Predict', title: 'Count the calls', body: ['The provider times out twice, then succeeds. The stack is Logging → Retrying (3 attempts) → provider.'], stack: { separation: 0.9, tones: { provider: 'active' } },
      predict: { id: 'count', prompt: 'How many log lines, and how many provider calls?', choices: [
        { id: '1-3', text: '1 log line, 3 provider calls', why: 'Right. Logging sits outside retries, so it sees one charge. Put logging *inside* the retry layer and you’d log every attempt. Order of wrapping matters.' },
        { id: '3-3', text: '3 log lines, 3 provider calls', why: 'That would happen if logging wrapped the provider directly, inside the retries.' },
      ], correct: '1-3' } },
  ],
  worked: { title: 'decorators, functions, and Python’s @ syntax', blocks: [
    { type: 'code', lang: 'python', code: 'client = LoggingClient(RetryingClient(FlakyProvider(failures_before_success=2), attempts=3), log)\nclient.charge(4500)   # "charged 4500"; provider.calls == 3; log == ["charge 4500"]', caption: 'Asserted in python/tests/test_lld.py' },
    { type: 'p', text: 'Python’s `@decorator` syntax applies the same idea to functions: `@functools.lru_cache` wraps a function with caching. Object decorators like the ones above suit cases where the wrapped thing is an object with several methods or configuration.' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'You want to measure the latency of *each attempt*, including retries. Where does the metrics decorator go?', choices: [
    { id: 'inside', text: 'Inside the retry layer, wrapping the provider directly.', why: 'Right. Each attempt passes through it. Outside the retry layer it would time the whole retried call.' },
    { id: 'outside', text: 'Outside the retry layer.', why: 'Then it would see one call per charge, hiding individual attempts.' },
  ], correct: 'inside' }],
  exercise: { id: 'why', prompt: 'Why is a decorator better than adding `retry=True` and `log=True` flags to the payment client?', checklist: ['Keeps the client focused; behaviours stay separate and composable.', 'New behaviours (metrics, circuit breaker) add new wrappers, not more flags/branches.'], model: 'Flags pile conditional branches into one class; decorators keep each behaviour in its own small wrapper that you can combine in any order, and adding metrics later doesn’t touch existing code.' },
  next: { id: 'pattern-factory-builder', reason: 'Decorators add behaviour. Factories and builders make complex objects easy to create correctly.' },
};

export const patternFactoryBuilder: GenericLesson = {
  id: 'pattern-factory-builder',
  area: 'Design patterns',
  opening: 'Change request: “Concerts are standing-only and 16+.” Every place that creates an event listing now passes nine arguments in the right order, and someone writes `EventListing("Tour", "Arena", "2026-12-01", 6000, 16, False)`. Which argument was “False” again?',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Problem', title: 'Long, positional constructors', body: ['Positional arguments make calls unreadable and easy to get wrong silently: swap two ints and the age limit becomes the price.'],
      compare: { left: { title: 'Call site', points: ['`EventListing("Tour", "Arena", "2026-12-01T20:00", 6000, 16, False)`'], tone: 'fail' }, right: { title: 'Questions', points: ['Which number is the age limit?', 'What does False mean?'] } } },
    { kicker: 'Fix', title: 'Python’s builder: keyword arguments', body: ['Python already solves most of this. A frozen dataclass with **keyword arguments** and sensible defaults reads like a sentence: `EventListing(title="Tour", venue="Arena", starts_at=…, price_cents=6000, age_limit=16, seated=False)`. A separate Builder class is rarely needed.'],
      compare: { left: { title: 'Before', points: ['Positional soup'], tone: 'fail' }, right: { title: 'After', points: ['`age_limit=16, seated=False`: named, defaulted, read-only'], tone: 'ok' } },
      code: { code: LISTING, caption: 'python/sdm/patterns.py', open: true } },
    { kicker: 'Watch', title: 'A named factory for a common case', body: ['A **factory method** gives a common configuration a name: `EventListing.concert(title, venue, starts_at, price)` sets 16+ and standing. Callers say *what* they want, and the rule lives in one place. (This is a named `@classmethod` constructor. The Gang of Four’s Factory Method is broader: a creation method that subclasses override to change which class is built.)'],
      compare: { left: { title: 'Callers', points: ['`EventListing.concert("Tour", "Arena", "2026-12-01T20:00", 6000)`'], tone: 'ok' }, right: { title: 'Rule in one place', points: ['Concerts: age_limit=16, seated=False'], tone: 'ok' } },
      changes: [{ kind: 'add', text: 'EventListing.concert() factory' }] },
    { kicker: 'Predict', title: 'The rule changes', body: ['Concerts become 18+.'],
      compare: { left: { title: 'With the factory', points: ['?'] }, right: { title: 'Without it', points: ['Find every call site that builds a concert'] } },
      predict: { id: 'change', prompt: 'With the factory, how many places change?', choices: [
        { id: 'one', text: 'One: the factory method', why: 'Right. Every concert is created through it.' },
        { id: 'many', text: 'Every place a concert is created', why: 'That’s the situation the factory removes.' },
      ], correct: 'one' } },
  ],
  worked: { title: 'when a real Builder class helps', blocks: [
    { type: 'p', text: 'A step-by-step Builder (`ListingBuilder().titled(...).at(...).build()`) is worth it in Python mainly when construction has **ordering or validation across steps** (for example, a seat map assembled section by section, then validated as a whole), or when building immutable objects incrementally from many sources. Otherwise prefer keyword arguments, defaults and `@classmethod` factories.' },
    { type: 'code', lang: 'python', code: 'e = EventListing.concert("Tour", "Arena", "2026-12-01T20:00", 6000)\nassert e.age_limit == 16 and not e.seated', caption: 'Asserted in python/tests/test_lld.py' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'Which call is safest to read and change?', choices: [
    { id: 'kw', text: '`EventListing(title="Tour", venue="Arena", starts_at="…", price_cents=6000, age_limit=16)`', why: 'Right. Every value is named, and defaults cover the rest.' },
    { id: 'pos', text: '`EventListing("Tour", "Arena", "…", 6000, 16)`', why: 'It works, until someone reorders the fields or swaps two numbers.' },
  ], correct: 'kw' }],
  exercise: { id: 'factory', prompt: 'Name one more factory method you would add to EventListing, and the rule it captures.', checklist: ['A named common configuration (e.g. family_show(): all ages, seated; festival_day(): standing, 18+).', 'States the rule it centralises.'], model: '`EventListing.family_show(...)`: all ages and seated, so kids’ shows are always configured the same way.' },
  next: { id: 'pattern-adapter', reason: 'Factories create objects consistently. Adapters make mismatched objects fit.' },
};

export const patternAdapter: GenericLesson = {
  id: 'pattern-adapter',
  area: 'Design patterns',
  opening: 'Change request: “Support payments through our partner bank.” Its library has `make_payment(amount_euros, reference)` and returns a dict. Everything in checkout expects `charge(cents) -> str`. Rewrite checkout for one bank? Or make the bank look like what checkout already expects?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('checkout', 'service', 'Checkout', { sub: 'calls charge(cents)' }), n('adapter', 'box', 'OldBankAdapter', { sub: 'charge(cents)' }), n('bank', 'ext', 'OldBankApi', { sub: 'make_payment(euros, ref)' })],
      edges: [e('checkout', 'adapter', 'charge(4500)'), e('adapter', 'bank', 'make_payment(45.0, …)')],
      ...layout(220, 420, {
        checkout: [{ x: 120, y: 110, w: 190 }, { x: 180, y: 50, w: 220 }],
        adapter: [{ x: 420, y: 110, w: 200 }, { x: 180, y: 200, w: 220 }],
        bank: [{ x: 720, y: 110, w: 200 }, { x: 180, y: 360, w: 240 }],
      }),
    },
  },
  steps: [
    { kicker: 'Problem', title: 'Two interfaces that don’t match', body: ['Checkout calls `charge(cents)`. The bank offers `make_payment(euros, reference)`. Units differ, names differ, return types differ.'], view: { hide: ['adapter'], states: { bank: 'fail' } } },
    { kicker: 'Fix', title: 'Translate at the boundary', body: ['An **Adapter** implements the interface checkout expects and translates each call into the bank’s API: cents to euros, dict to string. Checkout doesn’t change, and neither does the bank library.'], view: { states: { adapter: 'focus' }, tokens: [{ from: 'checkout', to: 'adapter', label: 'charge(4500)', tone: 'request' }] }, code: { code: ADAPTER, highlight: [pyLine(ADAPTER, 'cents / 100')], caption: 'python/sdm/patterns.py', open: true }, changes: [{ kind: 'add', text: 'OldBankAdapter translates charge → make_payment' }] },
    { kicker: 'Predict', title: 'Where do quirks belong?', body: ['The bank needs amounts in euros as floats and returns `{"ok": False}` on decline instead of raising.'], view: { tokens: [{ from: 'adapter', to: 'bank', label: 'make_payment(45.0)', tone: 'request' }] },
      predict: { id: 'quirks', prompt: 'Where should the euros conversion and the dict handling live?', choices: [
        { id: 'adapter', text: 'Only inside the adapter', why: 'Right. The bank’s quirks stay at the boundary, and the rest of the system keeps speaking cents and strings.' },
        { id: 'checkout', text: 'In checkout, with an `if provider == "bank"` branch', why: 'That leaks one vendor’s quirks into core code, and it repeats for every new provider.' },
      ], correct: 'adapter' } },
  ],
  worked: { title: 'adapters at system boundaries', blocks: [
    { type: 'p', text: 'Adapters are everywhere at the edges of a system: payment providers, email services, legacy APIs, file formats. They pair naturally with dependency injection: checkout takes “anything with `charge`”, and you pass in the adapter.' },
    { type: 'code', lang: 'python', code: 'checkout = Checkout(charge=OldBankAdapter(OldBankApi()).charge, clock=time.time, bookings=repo)', caption: 'The adapter plugs in wherever a payment client is expected.' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'The bank’s API changes its response format next year. What must change?', choices: [
    { id: 'adapter', text: 'Only the adapter', why: 'Right. That’s the payoff of isolating the vendor behind it.' },
    { id: 'all', text: 'Every caller of charge()', why: 'Callers only know `charge(cents)`, which didn’t change.' },
  ], correct: 'adapter' }],
  exercise: { id: 'test', prompt: 'How would you test the adapter without calling the real bank?', checklist: ['Pass a fake bank object with the same make_payment signature.', 'Assert the conversion (cents→euros) and the result mapping.'], model: 'Give the adapter a fake bank object that records the `make_payment` arguments and returns a chosen dict, then assert it received 45.0 euros for 4500 cents and mapped the result correctly.' },
  next: { id: 'pattern-command', reason: 'Adapters translate calls. Commands turn calls into objects you can store, queue and undo.' },
};

export const patternCommand: GenericLesson = {
  id: 'pattern-command',
  area: 'Design patterns',
  opening: 'Change request: “Venue staff editing the seat map need Undo.” Right now, blocking a seat just changes a set. Once it’s changed, the app has no record of what was done or how to reverse it.',
  visual: { kind: 'timeline', unit: 'action', lanes: [{ id: 'staff', label: 'Staff' }, { id: 'map', label: 'Seat map' }, { id: 'hist', label: 'Undo history' }], events: [
    { t: 1, lane: 'staff', label: 'block F12', to: { lane: 'map', t: 1.3 } },
    { t: 1.5, lane: 'hist', label: '+ undo: unblock F12' },
    { t: 2, lane: 'staff', label: 'block F13', to: { lane: 'map', t: 2.3 } },
    { t: 2.5, lane: 'hist', label: '+ undo: unblock F13' },
    { t: 3, lane: 'staff', label: 'Undo', tone: 'active', to: { lane: 'hist', t: 3.3 } },
    { t: 3.5, lane: 'map', label: 'F13 unblocked', tone: 'ok' },
  ] },
  steps: [
    { kicker: 'Idea', title: 'Turn an action into a value', body: ['The **Command** pattern represents an action as an object (or here, a pair of functions): *do* and *undo*. Once an action is a value, you can store it, queue it, log it, or reverse it.'], timeline: { upTo: 2 }, code: { code: SEATMAP, highlight: [pyLine(SEATMAP, 'self.run(lambda: self.blocked.add(seat), lambda: self.blocked.discard(seat))')], caption: 'python/sdm/patterns.py — New Python: `lambda` creates a small unnamed function.', open: true } },
    { kicker: 'Watch', title: 'Each action pushes its undo', body: ['Blocking F12 runs “add F12” and pushes “remove F12” onto the history. Blocking F13 does the same.'], timeline: { upTo: 4 }, changes: [{ kind: 'add', text: 'History: [unblock F12, unblock F13]' }] },
    { kicker: 'Predict', title: 'Press Undo', body: ['The history is a stack: last in, first out.'], timeline: { upTo: 4 },
      predict: { id: 'undo', prompt: 'Which seat does Undo unblock?', choices: [
        { id: 'f13', text: 'F13, the most recent action', why: 'Right. Undo pops the last pushed command and runs its undo.' },
        { id: 'f12', text: 'F12, the first action', why: 'Undo reverses actions in reverse order, so the newest goes first.' },
      ], correct: 'f13' } },
    { kicker: 'Watch', title: 'Undo runs the stored reverse', body: ['Undo pops “unblock F13” and runs it. F12 stays blocked. The same idea powers job queues (commands waiting to run), audit logs (commands that ran), and retries (commands to run again).'], timeline: { upTo: 6 } },
  ],
  worked: { title: 'commands beyond undo', blocks: [
    { type: 'table', head: ['Use', 'How commands help'], rows: [['Undo / redo', 'Store do + undo pairs on a stack'], ['Job queues', 'Serialize the command, a worker runs it later'], ['Audit logs', 'Record each command with who and when'], ['Macros / batch edits', 'Run a list of commands as one']] },
    { type: 'code', lang: 'python', code: 'm = SeatMap()\nm.block("F12"); m.block("F13"); m.undo()\nassert m.blocked == {"F12"}', caption: 'Asserted in python/tests/test_lld.py' },
  ] },
  checks: [{ kind: 'choice', id: 'q', prompt: 'A command “charge card €45” is queued and then cancelled. Why is it easier to cancel as a command than as a direct call?', choices: [
    { id: 'value', text: 'It hasn’t run yet: it’s data in a queue, which can be removed or inspected.', why: 'Right. Direct calls happen immediately. Commands can wait, be reviewed, or be dropped.' },
    { id: 'faster', text: 'Commands run faster.', why: 'Speed isn’t the point. Representing the action as data is.' },
  ], correct: 'value' }],
  exercise: { id: 'redo', prompt: 'How would you add Redo to the seat map?', checklist: ['When undoing, push the command (its do) onto a redo stack.', 'Clear the redo stack when a new action is performed.'], model: 'Keep a second stack: undo moves the command from the history to the redo stack, redo moves it back and re-runs `do`, and any new action clears the redo stack.' },
  next: { id: 'gof-reference', reason: 'Seven patterns in depth. The reference covers all 23 in brief.' },
};

export const PATTERN_LESSONS = [patternStrategy, patternObserver, patternState, patternDecorator, patternFactoryBuilder, patternAdapter, patternCommand];
