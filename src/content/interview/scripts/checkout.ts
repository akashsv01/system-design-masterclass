import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const checkout: InterviewScript = {
  caseId: 'case-checkout',
  track: 'hld',
  doLine: 'Connect the services an order passes from cart to dispatch, race two shoppers for the last unit, then see what shoppers get when dispatch is offline',
  skills: ['architecture', 'concurrency', 'reliability', 'messaging'],
  brief: {
    interviewer: { name: 'Tomás', role: 'engineering manager for the shop’s order flow' },
    intro: 'We sell limited drops: 5,000 hoodies, and a couple of hundred thousand people show up in the first minute. After someone pays, the order must reach the warehouse’s dispatch system, which is run by another team and is sometimes down for maintenance.',
    users: 'Shoppers buying limited-edition items on their phones, and the warehouse team who pick and ship each order.',
    needs: ['Reserve an item when checkout starts, pay for it, and get an order confirmation', 'Hand every accepted order to dispatch so it gets picked and shipped', 'Show a shopper honestly what is happening to their order'],
    mustHold: ['Never sell more units than we have', 'Never take payment for a unit we cannot supply', 'An accepted order is never lost on its way to dispatch'],
    constraints: ['5,000 units of one product; up to 200,000 shoppers in the first minute', 'Adding to the cart reserves nothing. A reservation starts at checkout and lasts 10 minutes', 'Payment goes through an outside provider that usually replies in 2 seconds', 'The dispatch system is separate and can be down for maintenance', 'Overselling is unacceptable; selling a few too few is tolerable'],
    outOfScope: ['Shipping prices and tax', 'Returns and refunds on request', 'Limiting purchases per customer'],
    terms: [
      { term: 'SKU', meaning: 'one specific sellable item, such as “black hoodie, size M”, with its own stock count' },
      { term: 'reservation', meaning: 'a temporary claim on one unit for one shopper. If they do not pay within 10 minutes, the unit goes back on sale' },
      { term: 'dispatch', meaning: 'the warehouse system that picks, packs and ships an order' },
      { term: 'order accepted', meaning: 'we have recorded the order and the payment. It is promised; it may not have shipped yet' },
      { term: 'idempotent', meaning: 'safe to repeat: handling the same message twice has the same effect as once' },
    ],
    firstMove: 'A shopper taps Place order on the last hoodie. Draw the services an order passes through from cart to dispatch: which one decides there is stock, which takes the payment, and which tells the warehouse. Then trace an order through your design.',
  },
  palette: [
    { type: 'shop', kind: 'client', name: 'Shop app', blurb: 'The shopper’s phone app. It shows the cart and sends Place order.' },
    { type: 'checkout', kind: 'service', name: 'Checkout service', blurb: 'Runs one checkout from start to finish: reserve, pay, confirm. It calls the others.' },
    { type: 'inventory', kind: 'service', name: 'Inventory service', blurb: 'Decides whether a unit is available and holds it for a shopper for 10 minutes.' },
    { type: 'stockdb', kind: 'db', name: 'Stock counts', blurb: 'A database with one count of available units per SKU, and the reservations against it.' },
    { type: 'payment', kind: 'ext', name: 'Payment provider', blurb: 'An outside company that charges cards. Usually replies in 2 s; can be slow or down.' },
    { type: 'orders', kind: 'service', name: 'Order service', blurb: 'Records an accepted order and passes it on to dispatch.' },
    { type: 'ordersdb', kind: 'db', name: 'Orders database', blurb: 'One row per order: items, shopper, payment id and status. The record of what we promised.' },
    { type: 'events', kind: 'queue', name: 'Order events', blurb: 'Holds “order placed” messages, in order, until the warehouse side takes them.' },
    { type: 'dispatch', kind: 'service', name: 'Dispatch service', blurb: 'The warehouse’s system. Picks, packs and ships. Run by another team; sometimes down.' },
  ],
  verbs: ['sends request', 'calls', 'reads and writes', 'writes to', 'reads from', 'publishes event', 'delivers to'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'when', q: 'When is a unit held for a shopper?', a: 'When checkout starts, for 10 minutes. Adding to the cart holds nothing, or abandoned carts would hide stock.' },
          { id: 'oversell', q: 'Which is worse: selling too many, or too few?', a: 'Too many. We must never sell a unit we do not have. A few unsold units at the end is tolerable.' },
          { id: 'abandon', q: 'What if a shopper reserves a unit and never pays?', a: 'After 10 minutes the reservation expires and the unit goes back on sale.' },
          { id: 'dispatch', q: 'Who ships the order, and how reliable is that system?', a: 'A separate dispatch system owned by the warehouse team. It is sometimes down for maintenance, for minutes to an hour.' },
          { id: 'peak', q: 'How busy does it get?', a: 'Up to 200,000 shoppers in the first minute, nearly all for one SKU.' },
          { id: 'scope', q: 'Do returns, shipping prices or purchase limits matter here?', a: 'Not today. Taking the right orders and delivering them to dispatch is the job.' },
        ],
        assumptions: [
          { id: 'handoff', q: 'How does an accepted order reach dispatch?', options: [
            { id: 'call', label: 'Order service calls Dispatch directly and waits for its answer', consequence: 'Simple, but an order cannot be accepted while dispatch is down, even after the shopper has paid.' },
            { id: 'queue', label: 'The order is recorded first, then handed over through a queue', consequence: 'Orders are accepted even when dispatch is down; they ship late. You must say so honestly and never lose a message.' },
          ] },
          { id: 'sequence', q: 'Do you reserve the unit before or after you charge the card?', options: [
            { id: 'reserve-first', label: 'Reserve first, then charge, then confirm', consequence: 'A shopper who cannot get a unit is told straight away and is never charged. Unpaid reservations need an expiry.' },
            { id: 'charge-first', label: 'Charge first, then take the unit', consequence: 'No unpaid holds, but a shopper can pay and then find the unit gone, so you must refund them.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers tell you what must be exact, and which tell you what may wait?',
        walkthrough: [
          { text: 'Never selling too many makes stock the one number that must be exact, at the moment of reserving.' },
          { text: 'Holds that expire after 10 minutes tell you reservations are a separate thing from sales.' },
          { text: 'A dispatch system that is sometimes down tells you the order record cannot depend on it being up.' },
          { text: '200,000 shoppers for one SKU tells you the stock count is a hot spot.' },
        ],
        solution: [{ type: 'list', items: ['Stock must be exact at reservation; the count never goes below zero.', 'Reservations start at checkout and expire after 10 minutes.', 'Dispatch is separate and can be down, so an accepted order must be stored and handed over later.', 'One SKU takes nearly all the traffic: its stock count is a hot spot.', 'Overselling is worse than underselling.'] }],
        why: 'These answers decide where the exact decision happens (the stock count), what has an expiry (the reservation), and what must not depend on another team’s uptime (the order record).',
      },
      lessons: ['requirements'],
    },
    {
      id: 'design', title: 'Design', intro: 'Connect the services an order passes through, from the shopper’s tap to dispatch. Then trace an order through your own design.',
      question: 'A shopper places an order. Which service decides there is stock, which takes payment, and how does the order reach dispatch?',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-shop', 'shop', 'client', 'Shop app', 60, 220], ['s-checkout', 'checkout', 'service', 'Checkout service', 300, 220]], [['s-shop', 's-checkout', 'sends request']]),
        traces: [
          { id: 'reserve', label: 'Reserve the last hoodie', token: 'POST /reserve hoodie-M', from: { type: 'shop' }, to: { type: 'stockdb' } },
          { id: 'order', label: 'Place an order from cart to dispatch', token: 'POST /orders', from: { type: 'shop' }, to: { type: 'dispatch' } },
        ],
      },
      help: {
        hint: 'Which one service owns the stock count? And if dispatch is down when an order is accepted, where does the order wait?',
        walkthrough: [
          { text: 'The app sends Place order to Checkout service, which runs the steps in order.', focus: ['shop', 'checkout'] },
          { text: 'First Checkout asks Inventory service to reserve a unit. It is the only part that changes the Stock counts.', focus: ['checkout', 'inventory', 'stockdb'] },
          { text: 'Then Checkout charges the card through the payment provider.', focus: ['checkout', 'payment'] },
          { text: 'Then Order service records the order in the Orders database.', focus: ['orders', 'ordersdb'] },
          { text: 'Last, Order service publishes “order placed” to Order events, and Dispatch service takes it from there.', focus: ['orders', 'events', 'dispatch'] },
        ],
        solution: [
          { type: 'p', text: '**One owner for stock, a durable record for the order, a queue to dispatch.** Checkout reserves a unit (one conditional write in Stock counts), charges the card, then Order service stores the order and publishes it. Dispatch reads from the queue when it is up.' },
          { type: 'code', lang: 'http', code: 'POST /v1/orders {cart_id, sku: "hoodie-M"}   Idempotency-Key: …\n→ 409 sold_out                       (nothing charged)\n→ 202 {order_id, status: "accepted"} (shipping may be delayed)' },
        ],
        why: 'Reserving before charging means a shopper who cannot get a unit is never charged. Recording the order before the queue and sending it through the queue means dispatch’s downtime cannot lose an accepted order.',
      },
      lessons: ['first-booking', 'queues'],
    },
    {
      id: 'lastunit', title: 'Last unit', intro: 'Maya and Ravi both tap Place order on the last black hoodie in size M, a few milliseconds apart. Arrange their reads and writes, predict, then run it.',
      question: 'Maya and Ravi both see one unit left and both reserve it at once. How many of them are told “reserved”?',
      activity: {
        kind: 'timeline', names: ['Maya', 'Ravi'], resource: 'Hoodie M (units left)', initial: 1,
        read: 'checks the stock count', write: 'reserves the unit',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'Check, then write', detail: 'Read the count; if it is above zero, write the new count. Two separate steps.', code: "SELECT available FROM stock WHERE sku = 'hoodie-M';\n-- if available > 0:\nUPDATE stock SET available = :seen - 1 WHERE sku = 'hoodie-M';" },
          { id: 'conditional', label: 'Conditional decrement', detail: 'One statement that takes a unit only if one is still there.', code: "UPDATE stock SET available = available - 1, reserved = reserved + 1\nWHERE sku = 'hoodie-M' AND available > 0;\n-- 1 row → reserved; 0 rows → sold out" },
          { id: 'lock', label: 'Lock the row', detail: 'The first shopper locks the stock row; the second waits until the first has written.', code: "SELECT available FROM stock WHERE sku = 'hoodie-M' FOR UPDATE;" },
        ],
        predict: { q: 'With “check, then write” and this order, how many shoppers are told “reserved”?', choices: [{ id: 'one', label: 'One of them' }, { id: 'both', label: 'Both of them' }, { id: 'none', label: 'Neither' }] },
      },
      help: {
        hint: 'What did Ravi read, and was it still true when he wrote?',
        walkthrough: [
          { text: 'Maya reads: 1 unit left.' },
          { text: 'Ravi reads before Maya writes: he also sees 1 unit left.' },
          { text: 'Maya reserves it. Ravi reserves it too, because his decision used a count that is no longer true.' },
          { text: 'Fix: make the check part of the write (a conditional decrement), or make Ravi wait (a lock).' },
        ],
        solution: [
          { type: 'p', text: 'With a plain check-then-write, **both** are told “reserved”: two orders for one hoodie. A conditional decrement lets exactly one succeed in every order. The other changes 0 rows and is told “sold out” before any payment is taken.' },
          { type: 'code', lang: 'python', code: 'def reserve(db, sku):\n    n = db.execute(\n        "UPDATE stock SET available = available - 1, reserved = reserved + 1 "\n        "WHERE sku = ? AND available > 0", (sku,)).rowcount\n    return n == 1   # False → 409 sold_out, no charge' },
        ],
        why: '“Never sell more units than we have” needs the check and the decrement to be one step at the source of truth, because anything a shopper’s request read earlier may be stale.',
      },
      lessons: ['concurrent-reservations', 'transactions', 'lab-hot-spots'],
    },
    {
      id: 'dispatch', title: 'Dispatch goes offline', intro: 'The interviewer changes one condition. Predict, run it on your design, then revise.',
      question: 'Dispatch goes offline just as a shopper pays. What does the shopper see, and what happens to their order?',
      change: { announce: 'New condition: the dispatch system goes down for maintenance for forty minutes in the middle of the drop. Shoppers keep placing orders.', rule: RULES.trace, alternate: { announce: 'New condition: the payment provider is offline for ten minutes. Shoppers have already reserved units.', label: 'Replay with the payment provider offline' } },
      activity: {
        kind: 'trace', request: 'an order from the shop app through checkout to dispatch', from: ['shop'], to: ['dispatch', 'payment'], failCandidates: ['dispatch', 'payment'],
        predict: { q: 'While dispatch is down, what does the shopper see after paying?', choices: [{ id: 'error', label: 'An error: the order did not go through' }, { id: 'delayed', label: 'Order accepted; shipping is delayed' }, { id: 'ok', label: 'Nothing changes' }] },
      },
      help: {
        hint: 'Is the shopper waiting on Dispatch when it is down, or has something else already accepted the order?',
        walkthrough: [
          { text: 'The unit is reserved and the card is charged. Neither step needs dispatch.', focus: ['inventory', 'payment'] },
          { text: 'Order service records the order in the Orders database: this is the promise we made.', focus: ['orders', 'ordersdb'] },
          { text: 'The message “order placed” goes into Order events, which is up, so the shopper sees “order accepted”.', focus: ['events'] },
          { text: 'It waits there until Dispatch returns. Then dispatch takes the messages in order, ignoring any it has seen.', focus: ['events', 'dispatch'] },
        ],
        solution: [
          { type: 'list', items: ['**With a queue between Order service and Dispatch:** the shopper sees “order accepted, shipping may be delayed”. The message waits in Order events.', '**Without one** (Order service calls Dispatch and waits): the shopper sees an error after their card was charged, so the order and the charge disagree.', 'Dispatch handles each order id **idempotently**, because a queue may deliver twice.', 'If the **payment provider** is the part that is down, the order is not accepted; the reservation simply expires and the unit goes back on sale.'] },
        ],
        why: '“An accepted order is never lost” holds because the order is recorded before dispatch is involved, and the hand-off waits in a durable queue instead of depending on dispatch being up.',
      },
      lessons: ['queues', 'availability', 'idempotency'],
    },
  ],
  rules: [
    // Design stage
    { id: 'co-owner', stage: 'design', when: { link: [{ type: 'inventory' }, { type: 'stockdb' }], labels: ['writes to', 'reads and writes'] }, ack: '{type:inventory} is the only part that writes the stock count. Good: one owner.', strength: 'You gave stock a single owner: {type:inventory} writes {type:stockdb}.' },
    { id: 'co-no-stock', stage: 'design', when: { lacks: { type: 'stockdb' } }, coach: 'The stock count needs a home. Add Stock counts and connect Inventory service to it.', gap: { text: 'No single place owned the stock count.', fix: 'Add Stock counts and make Inventory service its only writer, using one conditional decrement.', stage: 'design', lesson: 'first-booking' }, priority: 3 },
    { id: 'co-connect', stage: 'design', when: { all: [{ has: { type: 'stockdb' } }, { not: { path: [{ type: 'shop' }, { type: 'dispatch' }] } }] }, coach: 'Connect the whole journey: Shop app → Checkout → Inventory / Payment / Order service → … → Dispatch. Select a part, then “Connect to…”.', priority: 2 },
    { id: 'co-trace-now', stage: 'design', when: { all: [{ path: [{ type: 'shop' }, { type: 'dispatch' }] }, { not: { result: 'trace:order', is: 'ok' } }] }, coach: 'Press “Trace a request” and run “Place an order from cart to dispatch” to watch it cross your design.', priority: 1 },
    { id: 'co-trace-ok', stage: 'design', when: { result: 'trace:order', is: 'ok' }, ack: 'An order travelled from the shop app to dispatch along your arrows.' },
    { id: 'co-client-db', stage: 'design', when: { link: ['client', 'db'] }, priority: 9, ask: { text: 'The shop app talks to {kind:db} directly. Who checks that a unit is still available before it is reserved?', choices: [
      { id: 'service', label: 'A service in between owns the check', reply: 'Yes: the app cannot be trusted with the rule, and every reservation goes through one place you control.', verdict: 'sound' },
      { id: 'app', label: 'The app checks the count, then writes', reply: 'Two apps can both see “1 left” before either writes. That is the race we run next.', verdict: 'risky' },
    ] } },
    { id: 'co-sequence', stage: 'design', when: { link: [{ type: 'checkout' }, { type: 'payment' }] }, priority: 8, ask: { text: 'The arrow from {type:checkout} to {type:payment} does not show order. Which comes first: reserving the unit or charging the card?', choices: [
      { id: 'reserve-first', label: 'Reserve first, then charge, then confirm. Unpaid reservations expire', reply: 'Yes. A shopper who cannot get a unit hears so straight away and is never charged. The cost is that unpaid holds need the 10-minute expiry.', verdict: 'sound' },
      { id: 'charge-first', label: 'Charge first, then take the unit. Refund if none is left', reply: 'Workable, and it avoids unpaid holds. The cost: with 200,000 shoppers for 5,000 units, most of them would be charged and then refunded. That is a valid alternative, but a very noisy one for this drop.', verdict: 'partial' },
      { id: 'parallel', label: 'Do both at once to be fast', reply: 'Then a paid shopper can lose the unit, or a reserved unit can fail to be paid for, with no clean way back. Pick an order.', verdict: 'risky' },
    ] }, gap: { text: 'The order of reserving and charging was not settled.', fix: 'Reserve first with an expiry, then charge, then confirm the reservation.', stage: 'design', lesson: 'first-booking' } },
    { id: 'co-dispatch-sync', stage: 'design', when: { link: [{ type: 'orders' }, { type: 'dispatch' }] }, priority: 9, ask: { text: '{type:orders} calls {type:dispatch} directly and waits. The warehouse team is doing maintenance when an order is accepted. What does the shopper get?', choices: [
      { id: 'queue', label: 'Record the order, then hand it over through a queue, so the shopper hears “accepted, shipping delayed”', reply: 'Yes. Insert a queue between them: the order is safe in your database and the message waits for dispatch.', verdict: 'sound' },
      { id: 'error', label: 'An error, and they try again later', reply: 'Their card may already be charged. They would see an error for an order we took money for.', verdict: 'risky' },
      { id: 'retry', label: 'Order service retries every few seconds until dispatch answers', reply: 'It works for brief outages. For forty minutes you hold shoppers’ requests open or lose them if Order service restarts. A durable queue holds them for you.', verdict: 'partial' },
    ] }, gap: { text: 'Order service depended on dispatch being up to accept an order.', fix: 'Record the order, then publish it to a queue that dispatch reads when it is available.', stage: 'dispatch', lesson: 'queues' } },
    { id: 'co-queue', stage: 'design', when: { link: [{ type: 'orders' }, 'queue'] }, ack: 'Orders go to dispatch through {kind:queue}, so dispatch’s downtime cannot block an accepted order.', strength: 'You handed orders to dispatch through {kind:queue}, so an accepted order never depends on dispatch being up.' },
    { id: 'co-dual-write', stage: 'design', when: { all: [{ link: [{ type: 'orders' }, { type: 'ordersdb' }], labels: ['writes to', 'reads and writes'] }, { link: [{ type: 'orders' }, 'queue'] }] }, priority: 7, ask: { text: '{type:orders} writes to {type:ordersdb} and also publishes to {kind:queue}. The diagram does not show what happens if it crashes between the two. What do you do?', choices: [
      { id: 'outbox', label: 'Write the order and the outgoing message together in one transaction; a relay publishes it', reply: 'Yes. That is the outbox pattern. Either both are saved or neither is, so the queue never misses an order and never announces one that does not exist.', verdict: 'sound' },
      { id: 'db-first', label: 'Save the order first, then publish, and sweep for orders never published', reply: 'Sound enough, if the sweep is real. It is the same idea as an outbox, with the repair done after the fact.', verdict: 'partial' },
      { id: 'queue-first', label: 'Publish first, then save the order', reply: 'A crash in between sends dispatch an order that was never saved. Then payment and shipping disagree.', verdict: 'risky' },
    ] }, gap: { text: 'Saving the order and publishing it were separate steps that could be torn apart by a crash.', fix: 'Write the order and its outgoing message in one transaction (an outbox), then publish from there.', stage: 'design', lesson: 'queues' } },
    { id: 'co-hot', stage: 'design', when: { has: { type: 'stockdb' } }, priority: 5, ask: { text: 'Nearly all 200,000 shoppers want one SKU. They all change the same row in {type:stockdb}. What limits throughput, and what would you do?', choices: [
      { id: 'buckets', label: 'Split the 5,000 units over several rows (say ten of 500) and try another row when one is empty', reply: 'Yes. Writes spread over rows instead of queuing on one. A few units may look “sold out” in a bucket while others have stock, which is the tolerated underselling.', verdict: 'sound' },
      { id: 'front', label: 'Admit shoppers at a steady rate with a waiting room in front', reply: 'Also sound: it turns a spike into a flow the single row can handle. You then need the waiting room itself to stay up.', verdict: 'sound' },
      { id: 'bigger', label: 'Use a bigger database', reply: 'The row is the bottleneck, not the machine. One row is changed one write at a time however large the server is.', verdict: 'partial' },
    ] } },
    { id: 'co-gate', stage: 'design', when: { link: [{ type: 'inventory' }, 'cache'], labels: ['writes to', 'reads and writes'] }, priority: 9, ack: 'You are counting stock in {kind:cache}. That is a real approach: an in-memory counter handles a huge spike very fast.', ask: { text: 'If {kind:cache} restarts and loses its counts, what stops you selling more than 5,000?', choices: [
      { id: 'db-final', label: '{type:stockdb} still records each reservation with a conditional decrement, so it has the final say', reply: 'Exactly. The cache admits quickly; the database decides. That is a valid alternative to the reference design, at the cost of two stores that must agree.', verdict: 'sound' },
      { id: 'rare', label: 'Restarts are rare enough to ignore', reply: 'A restart in the first minute of a drop is exactly when it matters. Keep the database as the final word.', verdict: 'risky' },
    ] }, strength: 'You proposed a fast in-memory gate with the database as final authority: a valid alternative design.' },
    // Last-unit stage
    { id: 'co-race-fixed', stage: 'lastunit', when: { result: 'lastunit', is: 'one' }, ack: 'Only one shopper was told “reserved”, in every order you tried.', strength: 'You made the reservation a single conditional step, so exactly one shopper gets the last unit.' },
    { id: 'co-race-loser', stage: 'lastunit', when: { result: 'lastunit', is: 'one' }, priority: 6, ask: { text: 'The second shopper’s reservation was refused. What do they see, and have they been charged?', choices: [
      { id: 'sold-out', label: '“Sold out” straight away. Reserving came before charging, so nothing was charged', reply: 'Yes. That is the benefit of reserving first. A shopper who loses the race loses a few seconds, not money.', verdict: 'sound' },
      { id: 'refund', label: 'They see an error, and they are refunded afterwards', reply: 'That works if you charge first, but it creates 195,000 refunds for this drop. Reserve first and nobody needs a refund.', verdict: 'partial' },
      { id: 'queue', label: 'They wait in case the first shopper does not pay', reply: 'Fair idea: if the first reservation expires, the unit returns. Tell them clearly; a waitlist is a separate feature.', verdict: 'partial' },
    ] } },
    { id: 'co-race-oversold', stage: 'lastunit', when: { result: 'lastunit', is: 'oversold' }, priority: 5, ask: { text: 'Both shoppers were told “reserved”: two orders for one hoodie. Which part must make the check and the decrement one step?', choices: [
      { id: 'db', label: 'Stock counts, with a conditional decrement (available > 0)', reply: 'Yes: the source of truth makes the decision atomically. Switch the guard and run the same order again.', verdict: 'sound' },
      { id: 'lock', label: 'Stock counts, with a row lock while the shopper decides', reply: 'It is correct. Under 200,000 attempts a lock makes everyone queue behind whoever holds it, so a single statement is lighter.', verdict: 'partial' },
      { id: 'app', label: 'Checkout service should check twice', reply: 'Checking twice is still checking before writing. The check has to be part of the write.', verdict: 'risky' },
    ] }, gap: { text: 'The reservation was check-then-write, so two shoppers could get the last unit.', fix: 'Use a conditional decrement (or a row lock) in Stock counts and rerun the race.', stage: 'lastunit', lesson: 'concurrent-reservations' } },
    // Dispatch stage
    { id: 'co-d-err', stage: 'dispatch', when: { all: [{ result: 'dispatch', is: 'error' }, { lacks: 'queue' }] }, priority: 8, ask: { text: 'Dispatch is down, and the shopper sees an error even though the card was charged. What should change?', choices: [
      { id: 'queue', label: 'Record the order, then put it in a durable queue; the shopper sees “accepted, shipping delayed”', reply: 'Yes. Accepting an order should not depend on the warehouse being up. Add the queue and run it again.', verdict: 'sound' },
      { id: 'refund', label: 'Refund every order placed while dispatch is down', reply: 'Honest, but you turn forty minutes of maintenance into a lost sale for everyone and a refund per shopper.', verdict: 'risky' },
      { id: 'retry', label: 'Retry harder until dispatch answers', reply: 'Helps for short blips. For a long outage shoppers wait, and a restart of Order service loses the retries.', verdict: 'partial' },
    ] }, gap: { text: 'A dispatch outage turned accepted, paid orders into errors.', fix: 'Record the order first and hand it over through a durable queue that dispatch drains when it is back.', stage: 'dispatch', lesson: 'queues' } },
    { id: 'co-d-delayed', stage: 'dispatch', when: { result: 'dispatch', is: 'delayed' }, ack: 'Your design accepted the order in {kind:queue} before dispatch was involved, so the shopper gets a confirmation.', strength: 'You kept a dispatch outage off the shopper’s path: the order is accepted and ships late, not lost.' },
    { id: 'co-d-words', stage: 'dispatch', when: { result: 'dispatch', is: 'delayed' }, priority: 7, ask: { text: 'The shopper’s order is accepted but not yet with dispatch. What should the confirmation page say?', choices: [
      { id: 'honest', label: '“Order confirmed. Shipping is running late; we will email you when it ships.”', reply: 'Yes. It says what is true: the order is promised, the shipping has not started. Do not claim more than you know.', verdict: 'sound' },
      { id: 'shipped', label: '“Your order has shipped!”', reply: 'It has not. A false promise is worse than a delay.', verdict: 'risky' },
      { id: 'error', label: '“Something went wrong. Please try again.”', reply: 'The order is saved and paid. Telling them to try again invites a second order.', verdict: 'risky' },
    ] } },
    { id: 'co-d-dupes', stage: 'dispatch', when: { result: 'dispatch', is: 'delayed' }, priority: 6, ask: { text: 'Dispatch is back and the queue delivers the 3,000 waiting orders. If a message is delivered twice by mistake, what happens?', choices: [
      { id: 'idem', label: 'Dispatch remembers the order ids it has handled and ignores repeats', reply: 'Yes. A queue promises “at least once”, not “exactly once”, so the receiver makes repeats harmless.', verdict: 'sound' },
      { id: 'never', label: 'It cannot happen', reply: 'A message taken but not acknowledged before a crash is delivered again. Plan for it.', verdict: 'risky' },
      { id: 'shopper', label: 'Compare shopper email and item to spot repeats', reply: 'Two real orders by one shopper would be merged. Use the order id.', verdict: 'risky' },
    ] }, strength: 'You made dispatch safe to repeat, so a redelivered message cannot ship an order twice.' },
    { id: 'co-d-error-queue', stage: 'dispatch', when: { all: [{ result: 'dispatch', is: 'error' }, { has: 'queue' }] }, priority: 6, ask: { text: 'That request failed even though your design has a queue, so the failing part sits before it. The shopper had already reserved a unit. What happens to that unit?', choices: [
      { id: 'expire', label: 'The reservation expires after 10 minutes and the unit goes back on sale', reply: 'Yes. The expiry is what makes a failed payment harmless: nobody has to remember to release the unit.', verdict: 'sound' },
      { id: 'hold', label: 'It stays reserved until the provider is back', reply: 'Units would be locked by shoppers who cannot pay, and a ten-minute outage could hide the whole drop.', verdict: 'risky' },
      { id: 'sold', label: 'It is sold to the next shopper straight away', reply: 'That is fine only if the first shopper’s payment can no longer complete. Let the reservation expire, and refuse a late payment.', verdict: 'partial' },
    ] } },
    { id: 'co-d-broken', stage: 'dispatch', when: { result: 'dispatch', is: 'broken' }, coach: 'There is no chain of arrows from the shop app to that part. Add the arrows, then run it again.', priority: 4 },
  ],
  solution: {
    design: g([
      ['shop', 'shop', 'client', 'Shop app', 40, 220], ['checkout', 'checkout', 'service', 'Checkout service', 160, 220], ['inventory', 'inventory', 'service', 'Inventory service', 300, 60],
      ['stockdb', 'stockdb', 'db', 'Stock counts', 450, 60], ['payment', 'payment', 'ext', 'Payment provider', 300, 380], ['orders', 'orders', 'service', 'Order service', 300, 220],
      ['ordersdb', 'ordersdb', 'db', 'Orders database', 450, 170], ['events', 'events', 'queue', 'Order events', 450, 290], ['dispatch', 'dispatch', 'service', 'Dispatch service', 580, 290],
    ], [
      ['shop', 'checkout', 'sends request'], ['checkout', 'inventory', 'calls'], ['inventory', 'stockdb', 'reads and writes'], ['checkout', 'payment', 'calls'], ['checkout', 'orders', 'calls'],
      ['orders', 'ordersdb', 'reads and writes'], ['orders', 'events', 'publishes event'], ['events', 'dispatch', 'delivers to'],
    ]),
    why: {
      shop: 'Sends Place order with an idempotency key; shows sold out, accepted or an honest delay.',
      checkout: 'Runs one checkout in a fixed order: reserve, charge, record. It never decides stock itself.',
      inventory: 'The single owner of stock: reserves a unit with one conditional decrement and expires it after 10 minutes.',
      stockdb: 'Source of truth for units available and reserved. Split into buckets if one SKU is too hot.',
      payment: 'External: called with a timeout and an idempotency key, after the unit is already reserved.',
      orders: 'Records an accepted order and its outgoing message together, so the order is never lost on its way to dispatch.',
      ordersdb: 'The record of what we promised each shopper. Written before dispatch is involved.',
      events: 'Holds “order placed” messages durably and in order, so dispatch downtime delays shipping but never loses an order.',
      dispatch: 'The warehouse’s system. Takes messages when it is up and ignores order ids it has already handled.',
    },
    alternatives: { stockdb: { types: ['cache'], tradeoff: 'A fast in-memory counter can admit shoppers at a very high rate during a spike. The database must still record each reservation with a conditional write, so two stores must agree.' } },
    trace: { title: 'A shopper buys the last hoodie, and dispatch is down', steps: [
      { from: 'shop', to: 'checkout', text: 'Place order: hoodie M, with an idempotency key.' },
      { from: 'checkout', to: 'inventory', text: 'Reserve one unit for 10 minutes.' },
      { from: 'inventory', to: 'stockdb', text: 'UPDATE … SET available = available − 1 WHERE sku = hoodie-M AND available > 0 → 1 row: reserved. (0 rows would mean “sold out”, with nothing charged.)' },
      { from: 'checkout', to: 'payment', text: 'Charge the card with the order’s idempotency key. A lost reply is retried with the same key.' },
      { from: 'checkout', to: 'orders', text: 'Payment succeeded: confirm the reservation and create the order.' },
      { from: 'orders', to: 'ordersdb', text: 'One transaction writes the order (status accepted) and its “order placed” message.' },
      { from: 'orders', to: 'events', text: 'The message is published. The shopper sees “Order confirmed; shipping may be delayed”.' },
      { from: 'events', to: 'dispatch', text: 'Forty minutes later dispatch is back, takes the message and starts picking. A repeat of the same order id is ignored.' },
    ] },
    tradeoff: 'Reserving before charging with a short expiry keeps shoppers from paying for units they cannot get, at the cost of a few units briefly held by people who never pay. The queue to dispatch means orders ship late rather than fail, but you owe shoppers honest status and dispatch must tolerate repeated messages.',
    otherApproach: 'If dispatch were part of the same system and always up, Order service could call it directly inside the order transaction. For an even hotter drop, put a waiting room in front of Checkout and an in-memory counter in front of Stock counts, keeping the database’s conditional write as the final word.',
  },
};
