import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';
import { py } from '../../lessons/_kit';

const cls = (rows: [string, string, string, number, number][], links: [string, string, string][]) => ({
  comps: rows.map(([id, type, label, x, y]) => ({ id, type, kind: 'class' as const, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const lldShoppingCart: InterviewScript = {
  caseId: 'lld-shopping-cart',
  track: 'lld',
  doLine: 'Give each job in a cart to one object, walk a discount through checkout, build the classes, then open the same cart in two tabs',
  skills: ['object-design', 'concurrency', 'data-modeling'],
  brief: {
    interviewer: { name: 'Priya', role: 'engineer on the checkout team' },
    intro: 'We need the cart code that sits behind the checkout page. Marketing adds a new promotion every few weeks, so I care about where the discount rules live and what the cart promises about its total.',
    users: 'Shoppers adding items, and the checkout page asking “what do I owe?”. Marketing adds discounts without asking us for a release of the cart.',
    needs: ['Add an item with a unit price and a quantity', 'Show the subtotal and the total after discounts', 'Apply several discounts at checkout'],
    mustHold: ['Quantities are positive and a cart has one currency', 'The total is never negative, however many discounts stack', 'Adding a new discount never means editing the Cart class'],
    constraints: ['One currency per cart; prices are whole cents', 'A cart holds up to about 50 lines', 'A shopper may have the same cart open on a phone and a laptop'],
    outOfScope: ['Tax and shipping', 'Payment (that is a separate service)'],
    terms: [
      { term: 'value object', meaning: 'a small object defined by its values, such as Money(500, "EUR"); it checks its own rules and is never edited in place' },
      { term: 'strategy', meaning: 'a rule packaged behind one method, so you can swap or add rules without changing the code that uses them' },
      { term: 'version check', meaning: 'saving only if the cart is still at the version you read; otherwise the save is refused' },
    ],
    firstMove: 'Start with the words in my sentence: cart, line, money, discount. Tell me which object owns each job, then walk me through applying a 10% discount at checkout.',
  },
  palette: [
    { type: 'cart', kind: 'class', name: 'Cart', blurb: 'Owns the lines and the list of discounts; add(), subtotal(), total().' },
    { type: 'line', kind: 'class', name: 'Line', blurb: 'One product in the cart: sku, unit price, quantity.' },
    { type: 'money', kind: 'class', name: 'Money', blurb: 'Whole cents plus a currency. Refuses negative values and mixed currencies.' },
    { type: 'discount', kind: 'iface', name: 'Discount', blurb: 'One method: given the cart, return how much to take off.' },
    { type: 'pct-off', kind: 'class', name: 'TenPercentOver', blurb: 'A discount: 10% off when the subtotal reaches a threshold.' },
    { type: 'checkout', kind: 'class', name: 'CheckoutService', blurb: 'Loads the cart, asks for the total, saves the cart back.' },
  ],
  verbs: ['has many', 'has', 'uses', 'implements'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Pin down the rules before the objects.',
      question: 'Which rules would you confirm before writing a single class?',
      activity: { kind: 'clarify', questions: [
        { id: 'currency', q: 'Can one cart mix currencies?', a: 'No. A cart has one currency; adding a price in another currency is an error.' },
        { id: 'qty', q: 'What quantities are allowed?', a: 'Whole numbers of at least 1. Adding the same SKU again increases its quantity.' },
        { id: 'negative', q: 'What if discounts add up to more than the subtotal?', a: 'The total is zero, never negative.' },
        { id: 'new-rules', q: 'Who adds discount rules, and how often?', a: 'Marketing, every few weeks. Developers should not edit the cart for each one.' },
        { id: 'devices', q: 'Can the same cart be open in two places?', a: 'Yes: phone and laptop. Both can add items.' },
      ], assumptions: [
        { id: 'stack', q: 'When two discounts apply, how do they combine?', options: [
          { id: 'sum', label: 'Each discount is computed from the subtotal and the amounts are added', consequence: 'Order does not matter and each rule is easy to test alone.' },
          { id: 'chain', label: 'Each discount applies to the price left by the one before', consequence: 'Order now matters, so the cart must define and test it.' },
        ] },
      ] },
      help: {
        hint: 'Which rule decides what the shopper owes when three discounts apply at once?',
        walkthrough: [{ text: 'One currency, positive quantities: Money and Cart enforce these.' }, { text: 'Total = subtotal minus discounts, never below zero.' }, { text: 'Discounts are separate rules, so marketing can add them.' }],
        solution: [{ type: 'list', items: ['Quantity ≥ 1; one currency per cart.', 'total = max(0, subtotal − sum of discounts).', 'Each discount is its own rule behind one method.', 'The same cart may be changed from two devices.'] }],
        why: 'These rules are the invariants the classes must keep; everything else is naming.',
      },
      lessons: ['contracts-invariants', 'domain-objects'],
    },
    {
      id: 'roles', title: 'Who does what', intro: 'Give each job to one object, then walk through a discount at checkout.',
      question: 'Which object owns each job, and who makes sure the total is never negative?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'cart', name: 'Cart', blurb: 'Holds the lines and the discounts.' },
          { id: 'line', name: 'Line', blurb: 'sku, unit price, quantity' },
          { id: 'money', name: 'Money', blurb: 'Cents and a currency.' },
          { id: 'discount', name: 'Discount', blurb: 'A rule: cart in, amount off out.' },
          { id: 'checkout', name: 'CheckoutService', blurb: 'Handles the checkout request.' },
        ],
        cards: [
          { id: 'sum', text: 'Add up the lines to a subtotal', owner: 'cart', why: 'The cart sees every line; a single line cannot.' },
          { id: 'linecost', text: 'Work out unit price × quantity for one product', owner: 'line', alt: ['cart'], why: 'The line has both numbers; the cart summing them is a valid shortcut.' },
          { id: 'currency', text: 'Refuse mixed currencies and negative amounts', owner: 'money', alt: ['cart'], why: 'Money checks itself everywhere it is used; the cart can also check on add().' },
          { id: 'rule', text: 'Decide how much “10% over €50” takes off', owner: 'discount', why: 'Each promotion owns its own arithmetic, so the cart never changes.' },
          { id: 'floor', text: 'Keep the total from going below zero', owner: 'cart', why: 'Only the cart sees the subtotal and all discounts together.' },
          { id: 'save', text: 'Load the cart and save it after the shopper pays', owner: 'checkout', why: 'Request handling and storage are the service’s job, not the cart’s.' },
        ],
        walk: { title: 'Apply a 10% discount at checkout', steps: [
          { prompt: 'Who receives the shopper’s “checkout” request?', owner: 'checkout', call: 'checkout.start(cart_id="c-42")' },
          { prompt: 'Who adds up the lines?', owner: 'cart', call: 'cart.subtotal()  # Money(6000, "EUR")' },
          { prompt: 'Who computes how much 10% off is?', owner: 'discount', call: 'ten_percent_over(5000)(cart)  # Money(600, "EUR")' },
          { prompt: 'Who subtracts it and keeps the result at zero or above?', owner: 'cart', call: 'cart.total()  # max(0, 6000 - 600)' },
        ] },
      },
      help: {
        hint: 'Put each job where the data it needs already is.',
        walkthrough: [
          { text: 'Cart has all the lines, so it sums them and applies the floor at zero.', focus: ['cart', 'line'] },
          { text: 'A Discount is given the cart and returns a Money. It does not change the cart.', focus: ['disc'] },
          { text: 'Money refuses negative values and mixed currencies for everyone.', focus: ['money'] },
        ],
        solution: [
          { type: 'code', lang: 'python', code: py('sdm/cases/cart.py', 'ten_percent_over'), caption: 'python/sdm/cases/cart.py — tested with pytest' },
          { type: 'p', text: 'The discount only reads the cart. `Cart.total()` subtracts all discounts and never returns less than zero.' },
        ],
        why: 'Each rule is enforced by the object that owns the data, so a new discount cannot break the invariants.',
      },
      lessons: ['responsibilities', 'cohesion-coupling', 'pattern-strategy'],
    },
    {
      id: 'build', title: 'Draw the classes', intro: 'Place the classes and connect them. Label each arrow with what it means.',
      question: 'Draw the classes for the cart. How does a new discount get in without editing Cart?',
      activity: { kind: 'build', flavor: 'classes', starter: cls([['c', 'cart', 'Cart', 90, 200], ['l', 'line', 'Line', 330, 120]], [['c', 'l', 'has many']]) },
      help: {
        hint: 'If marketing adds a rule next month, which class do you edit? It should be none of the existing ones.',
        walkthrough: [
          { text: 'Cart has many Lines, and each Line has a unit price as Money.', focus: ['cart', 'line', 'money'] },
          { text: 'Cart uses a Discount interface. It does not know which discounts exist.', focus: ['cart', 'disc'] },
          { text: 'TenPercentOver implements Discount; a new promotion is one more class.', focus: ['ten'] },
        ],
        solution: [{ type: 'list', items: ['Cart → Line (has many); Line → Money (has).', 'Cart → Discount (uses); TenPercentOver → Discount (implements).', 'CheckoutService → Cart (uses).'] }],
        why: 'The interface is the seam: marketing adds classes behind it and the cart code stays closed.',
      },
      lessons: ['pattern-strategy', 'uml', 'solid'],
    },
    {
      id: 'tabs', title: 'Two tabs', intro: 'The interviewer changes one condition. Predict, run it, revise.',
      question: 'One unit of a product is left. The phone and the laptop both add it to the same cart. Can both succeed?',
      change: { announce: 'New condition: the same cart is open on a phone and a laptop. Both tap “add” for the last unit of a limited item at the same moment.', rule: RULES.timeline },
      activity: {
        kind: 'timeline', names: ['Phone tab', 'Laptop tab'], resource: 'Last unit (units left)', initial: 1,
        read: 'loads the cart and sees 1 left', write: 'saves the cart with the unit added',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'Save whatever the tab holds', detail: 'Each tab saves the cart it loaded. The second save never checks what changed in between.', code: 'cart = repo.load(cart_id)\ncart.add(sku, unit)\nrepo.save(cart)' },
          { id: 'conditional', label: 'Version check on save', detail: 'The cart has a version. A save succeeds only if the stored version is still the one the tab read.', code: "UPDATE carts SET data=:d, version=version+1\nWHERE id=:id AND version=:read_version" },
          { id: 'lock', label: 'Lock the cart while a tab edits', detail: 'The second tab waits until the first has saved.', code: 'SELECT * FROM carts WHERE id=:id FOR UPDATE' },
        ],
        predict: { q: 'Both tabs saved without any check. How many tabs get the last unit?', choices: [{ id: 'one', label: 'One' }, { id: 'both', label: 'Both' }, { id: 'none', label: 'Neither' }] },
      },
      help: {
        hint: 'When the laptop saves, does it know the phone already changed the cart?',
        walkthrough: [{ text: 'Both tabs read “1 left” before either saves.' }, { text: 'A plain save trusts that old read, so both write and the unit is sold twice.' }, { text: 'A version check makes the second save fail; that tab reloads and sees 0 left.' }],
        solution: [{ type: 'p', text: 'Without a check, both tabs win. Add a version to the cart and save with “only if the version is unchanged”. The refused tab reloads and shows “sold out”.' }],
        why: 'Two readers each saw a true value; only the store, at write time, can tell whether it is still true.',
      },
      lessons: ['concurrency-lld', 'concurrent-reservations', 'locking-mvcc'],
    },
  ],
  rules: [
    { id: 'roles-good', stage: 'roles', when: { result: 'roles', is: 'pass' }, ack: 'Each job sits with the object that owns its data.', strength: 'You gave each job to the object that owns the data: Cart sums and floors, Discount computes its own amount, Money validates itself.' },
    { id: 'roles-gap', stage: 'roles', when: { result: 'roles', is: 'gaps' }, gap: { text: 'Some cart jobs sit with objects that lack the data to do them.', fix: 'Reassign the cards marked “reconsider” and replay the checkout walk.', stage: 'roles', lesson: 'responsibilities' } },
    { id: 'floor-ask', stage: 'roles', when: { result: 'roles', is: ['pass', 'gaps'] }, priority: 5, ask: { text: 'Two discounts together take €70 off a €60 cart. What should total() return?', choices: [
      { id: 'zero', label: 'Zero: the cart floors the result with max(0, …)', reply: 'Yes. The cart sees the subtotal and all discounts together, so it holds the floor.', verdict: 'sound' },
      { id: 'each', label: 'Each discount caps itself so it never exceeds the subtotal', reply: 'That helps one rule, but two capped rules can still add up to too much. Cap at the total as well.', verdict: 'partial' },
      { id: 'neg', label: 'Return −10 and let checkout deal with it', reply: 'Then every caller must remember to check. Keep the promise inside the cart.', verdict: 'risky' },
    ] }, gap: { text: 'Nothing stops stacked discounts from producing a negative total.', fix: 'Floor the total at zero inside Cart.total().', stage: 'roles', lesson: 'contracts-invariants' } },
    { id: 'floor-strength', when: { answer: 'floor-ask', is: 'zero' }, strength: 'You kept “total is never negative” inside the cart instead of trusting callers.' },
    { id: 'build-start', stage: 'build', when: { lacks: { type: 'discount' } }, coach: 'Marketing will add rules often. What could Cart talk to, so it never has to change?' },
    { id: 'build-iface', stage: 'build', when: { all: [{ has: { type: 'discount' } }, { link: [{ type: 'cart' }, { type: 'discount' }] }] }, ack: 'Cart talks to {type:discount}, not to a particular promotion.', strength: 'You put a Discount interface between Cart and the promotions, so new rules do not touch Cart.' },
    { id: 'build-hardcoded', stage: 'build', when: { all: [{ lacks: { type: 'discount' } }, { has: { type: 'pct-off' } }] }, priority: 5, ask: { text: 'Cart points straight at {type:pct-off}. Next month marketing wants buy-two-get-one. What changes?', choices: [
      { id: 'iface', label: 'Add a Discount interface; Cart uses it and each promotion implements it', reply: 'Right: the cart stays closed and each promotion is one new class.', verdict: 'sound' },
      { id: 'edit', label: 'Edit Cart to know about the new promotion', reply: 'It works once, then every promotion is a change to the cart and a new risk to its invariants.', verdict: 'risky' },
    ] }, gap: { text: 'Cart depends on a particular discount, so each new promotion edits the cart.', fix: 'Add a Discount interface that Cart uses and promotions implement.', stage: 'build', lesson: 'pattern-strategy' } },
    { id: 'build-money', stage: 'build', when: { lacks: { type: 'money' } }, priority: 4, ask: { text: 'I see no Money class. Where does “one currency, never negative” get enforced?', choices: [
      { id: 'value', label: 'A Money value object that checks itself', reply: 'Good: every place that handles an amount gets the rule for free.', verdict: 'sound' },
      { id: 'cart', label: 'Cart checks on every add and every discount', reply: 'Possible, but each discount can also create amounts. Then every class repeats the check, and one forgets.', verdict: 'partial' },
      { id: 'ints', label: 'Plain integers and a comment', reply: 'A comment cannot refuse a mixed currency. Something must.', verdict: 'risky' },
    ] } },
    { id: 'build-alt-checkout', stage: 'build', when: { all: [{ has: { type: 'checkout' } }, { link: [{ type: 'checkout' }, { type: 'discount' }] }] }, priority: 3, ask: { text: 'CheckoutService chooses the discounts itself and passes the amounts to Cart. Cart no longer holds them. What do you gain and lose?', choices: [
      { id: 'tradeoff', label: 'Cart is simpler, but the total rule is now spread over two classes', reply: 'Yes. That is a valid design if checkout is the only caller. If another caller builds totals, it can forget the floor.', verdict: 'sound' },
      { id: 'nothing', label: 'Nothing changes', reply: 'The total no longer comes from one object, so the floor can be bypassed.', verdict: 'risky' },
    ] } },
    { id: 'build-arrows', stage: 'build', when: { has: { type: 'cart' } }, priority: 2, ask: { text: 'An arrow from Cart to Line says they are connected. Does it show that two Lines with the same SKU become one line with a larger quantity?', choices: [
      { id: 'no', label: 'No. That rule lives in add(), and I would test it', reply: 'Right. A class diagram shows structure, not behaviour. The merge rule needs a method and a test.', verdict: 'sound' },
      { id: 'yes', label: 'Yes, “has many” means that', reply: '“Has many” only says a cart holds several lines. Merging is behaviour in add().', verdict: 'risky' },
    ] } },
    { id: 'tabs-fixed', stage: 'tabs', when: { result: 'tabs', is: 'one' }, ack: 'With the check at save time, only one tab got the last unit.', strength: 'You moved the check to the moment of saving (a version check), so two tabs cannot both take the last unit.' },
    { id: 'tabs-over', stage: 'tabs', when: { result: 'tabs', is: 'oversold' }, priority: 5, ask: { text: 'Both tabs got the last unit. What should the second save do?', choices: [
      { id: 'version', label: 'Be refused because the cart changed since it was read; the tab reloads', reply: 'Yes. Switch to the version check and run the same order again.', verdict: 'sound' },
      { id: 'lock', label: 'Wait for a lock on the cart while the first tab saves', reply: 'That works but holds the cart while a shopper thinks. Keep the lock for a short write, not for a page open.', verdict: 'partial' },
      { id: 'disable', label: 'Disable the button once someone reads 1 left', reply: 'The other tab never learns that. The store must decide at write time.', verdict: 'risky' },
    ] }, gap: { text: 'Two tabs both took the last unit because saves were not checked.', fix: 'Add a version to the cart and save only if the version is unchanged.', stage: 'tabs', lesson: 'concurrency-lld' } },
  ],
  solution: {
    design: cls([
      ['svc', 'checkout', 'CheckoutService', 60, 200], ['cart', 'cart', 'Cart', 270, 200], ['line', 'line', 'Line', 480, 90], ['money', 'money', 'Money', 480, 200], ['disc', 'discount', 'Discount', 270, 370], ['ten', 'pct-off', 'TenPercentOver', 480, 370],
    ], [['svc', 'cart', 'uses'], ['cart', 'line', 'has many'], ['line', 'money', 'has'], ['cart', 'disc', 'uses'], ['ten', 'disc', 'implements']]),
    why: {
      svc: 'Loads the cart, asks for the total, saves it with a version check.',
      cart: 'Owns lines and discounts; add() keeps quantities positive and one currency; total() floors at zero.',
      line: 'One product: sku, unit price, quantity.',
      money: 'Whole cents and a currency; refuses negatives and mixed currencies.',
      disc: 'The seam: one method, cart in, Money out.',
      ten: 'One promotion. Another promotion is another class like this.',
    },
    alternatives: { disc: { types: ['discount'], tradeoff: 'A plain function (Callable[[Cart], Money]) does the same job in Python with less ceremony; an interface helps when a discount has its own data.' } },
    trace: { title: 'Apply a 10% discount at checkout', steps: [
      { from: 'svc', to: 'cart', text: 'total() on the loaded cart.' },
      { from: 'cart', to: 'line', text: 'subtotal: sum of unit × quantity for each line = €60.00.' },
      { from: 'cart', to: 'disc', text: 'asks each discount for its amount.' },
      { from: 'ten', to: 'disc', text: 'TenPercentOver(€50) returns €6.00 because the subtotal is at least €50.' },
      { from: 'cart', to: 'money', text: 'max(0, 6000 − 600) = Money(5400, "EUR").' },
    ] },
    tradeoff: 'Discounts behind one method keep the cart closed to new promotions, but the order and stacking rules must still be defined and tested in one place.',
    otherApproach: 'If promotions need data from many sources (customer history, stock), a separate pricing service that returns the discounts fits better than rules inside the cart.',
  },
};
