import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const payments: InterviewScript = {
  caseId: 'case-payments',
  track: 'hld',
  doLine: 'Design the payment system behind checkout, handle a provider that charges but never replies, then keep a duplicated webhook from recording a payment twice',
  skills: ['architecture', 'reliability', 'consistency', 'concurrency'],
  brief: {
    interviewer: { name: 'Ines', role: 'engineer on the payments team' },
    intro: 'Our shop takes card payments through an outside provider. When something goes wrong, people lose money or we do, and finance has to explain it. I want a design where every payment is recorded exactly once.',
    users: 'Shoppers paying for an order by card, and the finance team who must account for every cent.',
    needs: ['A shopper pays for an order and learns whether it worked', 'Our system learns the final result even when the provider is slow or silent', 'Finance can see every movement of money and check it against the provider’s own records'],
    mustHold: ['An order is never charged twice', 'A successful charge is never lost or forgotten', 'Every movement of money is recorded as balanced entries, exactly once'],
    constraints: ['Up to 2,000 payments a second during an on-sale', 'The provider usually replies in about two seconds and sometimes never replies', 'The provider reports the final result later by webhook, and may send the same webhook more than once', 'Every payment is recorded as a pair of ledger entries that add up to zero'],
    outOfScope: ['Refunds and partial refunds', 'Splitting revenue between several parties', 'Currencies and tax'],
    terms: [
      { term: 'payment provider', meaning: 'the outside company that talks to card networks and actually moves the money (a PSP)' },
      { term: 'idempotency key', meaning: 'an id sent with a request so that repeating the request does not repeat its effect' },
      { term: 'webhook', meaning: 'a message the provider sends to us when a payment’s final result is known' },
      { term: 'ledger', meaning: 'an append-only list of money movements. Each movement is two entries that add up to zero; balances are computed from entries' },
      { term: 'reconciliation', meaning: 'comparing our ledger with the provider’s own report to find payments that disagree' },
    ],
    firstMove: 'A shopper taps Pay. Show me the parts between that tap and the money being recorded, and where an order’s payment state lives. Then trace “pay for an order” through your design.',
  },
  palette: [
    { type: 'app', kind: 'client', name: 'Shop app', blurb: 'The shopper’s app. It sends Pay and shows the result.' },
    { type: 'checkout', kind: 'service', name: 'Checkout service', blurb: 'Holds the order and asks for payment. It does not touch card details or money records.' },
    { type: 'pay', kind: 'service', name: 'Payment service', blurb: 'Owns each payment’s state (pending, paid, failed) and talks to the provider.' },
    { type: 'psp', kind: 'ext', name: 'Payment provider', blurb: 'An outside company that charges cards. Usually replies in 2 s; sometimes never. Sends a webhook later.' },
    { type: 'hook', kind: 'service', name: 'Webhook handler', blurb: 'Receives the provider’s messages about final results. The same message can arrive twice.' },
    { type: 'ledger', kind: 'db', name: 'Ledger', blurb: 'Append-only record of money movements as balanced pairs of entries.' },
    { type: 'attempts', kind: 'queue', name: 'Payment attempt queue', blurb: 'Holds “charge this order” requests until they are sent to the provider.' },
    { type: 'recon', kind: 'worker', name: 'Reconciliation job', blurb: 'Runs nightly: compares our ledger with the provider’s report and flags differences.' },
  ],
  verbs: ['sends request', 'calls', 'reads and writes', 'writes to', 'reads from', 'sends callback', 'publishes event', 'delivers to'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'twice', q: 'What if a shopper taps Pay twice, or the app retries?', a: 'The order is charged once. A repeat of the same request must have no further effect.' },
          { id: 'final', q: 'Do we always learn the result right away?', a: 'Usually, in about two seconds. Sometimes the provider is slow or silent, and the final result arrives later by webhook.' },
          { id: 'hook', q: 'Does the provider send each webhook once?', a: 'At least once. The same webhook can be delivered twice, a moment apart.' },
          { id: 'books', q: 'How must money be recorded?', a: 'As balanced pairs of ledger entries that are never edited. Balances come from adding entries up.' },
          { id: 'peak', q: 'How busy does it get?', a: 'Up to 2,000 payments a second during an on-sale.' },
          { id: 'scope', q: 'Do refunds, split payouts or currencies matter here?', a: 'Not today. Charging an order once and recording it correctly is the whole job.' },
        ],
        assumptions: [
          { id: 'finality', q: 'Does checkout wait for the provider’s final answer?', options: [
            { id: 'wait', label: 'Yes, with a timeout, for card payments that normally take seconds', consequence: 'Simple for the shopper. You must decide what to show when the reply never comes.' },
            { id: 'async', label: 'No: say “processing” and let the webhook finish it', consequence: 'Resilient to a slow provider, but the shopper sees an unfinished state for a while.' },
          ] },
          { id: 'record', q: 'Where is the money recorded?', options: [
            { id: 'flag', label: 'A “paid” flag on the order', consequence: 'Easy to write, but a flag has no history and cannot be checked against the provider’s report.' },
            { id: 'ledger', label: 'An append-only ledger of balanced entries', consequence: 'Every movement is explainable and checkable, at the cost of more writes per payment.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers say what must be remembered, and which say where duplicates will come from?',
        walkthrough: [
          { text: 'A repeat must not charge again, so every request needs an identity the system remembers.' },
          { text: 'The provider can be silent, so a payment needs a “pending” state, not just paid or failed.' },
          { text: 'Webhooks can repeat, so applying one must be safe to do twice.' },
          { text: 'Finance needs history, so money is recorded as entries rather than a flag.' },
        ],
        solution: [{ type: 'list', items: ['A repeated request must not charge twice: use an idempotency key.', 'The provider may be silent, so a payment can be pending for a while.', 'Webhooks repeat, so applying one must be safe to repeat.', 'Money is recorded as balanced, append-only entries and reconciled with the provider.'] }],
        why: 'These answers decide that payment state has one owner, that “unknown” is a real state, and that every step that can be repeated is made safe to repeat.',
      },
      lessons: ['requirements'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts a payment touches and connect them. Then trace both the shopper’s Pay and the provider’s later confirmation through your own design.',
      question: 'A shopper taps Pay. Which part owns the payment’s state, and where is the money recorded?',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-app', 'app', 'client', 'Shop app', 60, 220], ['s-checkout', 'checkout', 'service', 'Checkout service', 300, 220]], [['s-app', 's-checkout', 'sends request']]),
        traces: [
          { id: 'pay', label: 'Pay for an order', token: 'POST /payments order-881', from: 'client', to: { type: 'ledger' } },
          { id: 'confirm', label: 'The provider confirms the payment', token: 'webhook payment.succeeded', from: { type: 'psp' }, to: { type: 'ledger' } },
        ],
      },
      help: {
        hint: 'If checkout and the webhook handler both change a payment’s state, which one is right when they disagree? Give payment state one owner.',
        walkthrough: [
          { text: 'The app sends Pay to Checkout service, which asks Payment service to charge the order.', focus: ['app', 'checkout', 'pay'] },
          { text: 'Payment service creates the payment as pending, then calls the provider with an idempotency key.', focus: ['pay', 'psp'] },
          { text: 'Payment service is the only writer of the Ledger, so every entry comes through one set of rules.', focus: ['pay', 'ledger'] },
          { text: 'The provider’s final result arrives at the Webhook handler, which passes it to Payment service.', focus: ['psp', 'hook', 'pay'] },
          { text: 'Each night, Reconciliation compares the Ledger with the provider’s report.', focus: ['recon', 'ledger', 'psp'] },
        ],
        solution: [
          { type: 'p', text: '**Payment service owns payment state.** Checkout asks it to charge an order with an idempotency key. It records a pending payment, calls the provider with the same key, and writes ledger entries when the result is final. The webhook handler never writes the Ledger itself; it hands each event to Payment service.' },
          { type: 'code', lang: 'http', code: 'POST /v1/payments {order_id: 881, amount: 4500}   Idempotency-Key: order-881\n→ 202 {payment_id, status: "pending"} | 200 {status: "paid"} | 409 order already paid' },
        ],
        why: 'One owner for payment state is what makes “never charged twice” checkable: every request, retry and webhook passes through the same rules.',
      },
      lessons: ['idempotency', 'transactions'],
    },
    {
      id: 'timeout', title: 'Provider goes silent', intro: 'The interviewer changes one condition. Predict, run it on your design, then revise.',
      question: 'The provider charges the shopper’s card but its reply never arrives. What does the shopper see, and how do you avoid charging them twice?',
      change: { announce: 'New condition: the payment provider stops replying during the on-sale. Some charges go through, but the replies are lost.', rule: RULES.trace, alternate: { announce: 'New condition: the Ledger database is offline for five minutes while payments are still arriving.', label: 'Replay with the ledger offline' } },
      activity: {
        kind: 'trace', request: 'a Pay request from the shop app to the payment provider', from: ['app'], to: ['psp', 'ledger'], failCandidates: ['psp', 'ledger'],
        predict: { q: 'While the provider is silent, what does the shopper see?', choices: [{ id: 'error', label: 'A spinner that ends in an error or timeout' }, { id: 'delayed', label: '“Processing”: the payment is accepted and finishes later' }, { id: 'ok', label: 'Nothing changes' }] },
      },
      help: {
        hint: 'Is the shopper waiting on the provider when it goes quiet? And if Payment service tries again, how does the provider know it is the same charge?',
        walkthrough: [
          { text: 'Payment service calls the provider while the shopper waits, so a silent provider means a wait and then a timeout.', focus: ['pay', 'psp'] },
          { text: 'The payment is now unknown: the card may or may not have been charged. It stays pending, never “failed”.', focus: ['pay'] },
          { text: 'Retrying with the same idempotency key makes the provider return the first result instead of charging again.', focus: ['pay', 'psp'] },
          { text: 'The webhook, or a status query, settles the final state; reconciliation catches anything that slips through.', focus: ['hook', 'recon'] },
        ],
        solution: [
          { type: 'list', items: ['Record the payment as **pending** before calling the provider.', 'Call with a timeout and an **idempotency key per order**; retry with the same key, or query the provider for status.', 'Treat a timeout as **unknown**, not failed. Only a final provider result moves it to paid or failed.', 'Show the shopper “processing” and finish via webhook; reconcile nightly.'] },
        ],
        why: '“Never charged twice” and “never lose a successful charge” both survive a lost reply only when a timeout is treated as unknown and every retry carries the same key.',
      },
      lessons: ['timeouts', 'retries', 'idempotency', 'lab-payment-retries'],
    },
    {
      id: 'webhook', title: 'Webhook delivered twice', intro: 'The provider sends the same “payment succeeded” webhook twice, a moment apart. Arrange the two deliveries’ checks and writes, predict, then run it.',
      question: 'Two deliveries of one webhook arrive together. How many times is the payment recorded in the ledger?',
      activity: {
        kind: 'timeline', names: ['Delivery 1', 'Delivery 2'], resource: 'Payment for order 881 (recorded: 0 of 1 times allowed)', initial: 1,
        read: 'checks the payment is still pending', write: 'marks it paid and records the ledger entries',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'Check, then apply', detail: 'Read the payment’s state; if it is pending, write the ledger entries and mark it paid. Two separate steps.', code: "status = db.get(payment).status\nif status == 'pending':\n    ledger.add(entries)\n    db.set(payment, status='paid')" },
          { id: 'conditional', label: 'Conditional state change', detail: 'One statement that moves the payment from pending to paid only if it is still pending, in the same transaction as the ledger entries.', code: "BEGIN;\nUPDATE payments SET status = 'paid' WHERE id = :id AND status = 'pending';\n-- 1 row → INSERT the ledger entries; 0 rows → already applied, do nothing\nCOMMIT;" },
          { id: 'lock', label: 'Lock the payment row', detail: 'The first delivery locks the payment; the second waits until the first has written, then sees “paid”.', code: "SELECT status FROM payments WHERE id = :id FOR UPDATE;" },
        ],
        predict: { q: 'With “check, then apply” and this order, how many times is the payment recorded?', choices: [{ id: 'one', label: 'Once' }, { id: 'both', label: 'Twice: both deliveries record it' }, { id: 'none', label: 'Never' }] },
      },
      help: {
        hint: 'What did the second delivery see when it checked, and was that still true when it wrote?',
        walkthrough: [
          { text: 'Delivery 1 reads: the payment is pending.' },
          { text: 'Delivery 2 reads before Delivery 1 has written: it also sees pending.' },
          { text: 'Delivery 1 records the money and marks it paid. Delivery 2 records it again, because its check is out of date.' },
          { text: 'Fix: make the check part of the state change (a conditional transition), so only one delivery can move pending to paid.' },
        ],
        solution: [
          { type: 'p', text: 'With a plain check-then-apply, **both** deliveries record the payment and the ledger shows the money twice. A conditional transition lets exactly one delivery succeed in every order; the other changes 0 rows and does nothing. Dedupe by the provider’s event id adds a second safety net.' },
          { type: 'code', lang: 'python', code: 'def apply_paid(db, payment_id, entries):\n    with db:  # one transaction\n        n = db.execute(\n            "UPDATE payments SET status=\'paid\' WHERE id=? AND status=\'pending\'",\n            (payment_id,)).rowcount\n        if n == 1:\n            db.executemany("INSERT INTO ledger(payment_id, account, amount) VALUES (?,?,?)", entries)\n    return n == 1   # False: duplicate delivery, ignored' },
        ],
        why: '“Every movement of money is recorded exactly once” needs the state check and the ledger write to be one atomic step, because a provider may repeat any message.',
      },
      lessons: ['transactions', 'idempotency', 'concurrent-reservations'],
    },
  ],
  rules: [
    // Design stage
    { id: 'pm-owner', stage: 'design', when: { all: [{ link: [{ type: 'pay' }, { type: 'ledger' }], labels: ['writes to', 'reads and writes'] }, { not: { link: [{ type: 'hook' }, { type: 'ledger' }], labels: ['writes to', 'reads and writes'] } }, { not: { link: [{ type: 'checkout' }, { type: 'ledger' }], labels: ['writes to', 'reads and writes'] } }] }, ack: '{type:pay} is the only writer of {type:ledger}. Good: one owner.', strength: 'You gave payment state and the ledger a single owner: only {type:pay} writes {type:ledger}.' },
    { id: 'pm-no-ledger', stage: 'design', when: { lacks: { type: 'ledger' } }, coach: 'Money needs a record finance can check. Add the Ledger and connect Payment service to it.', gap: { text: 'There was no durable record of money movements.', fix: 'Add an append-only Ledger of balanced entries, written only by Payment service.', stage: 'design', lesson: 'transactions' }, priority: 3 },
    { id: 'pm-no-pay', stage: 'design', when: { all: [{ has: { type: 'ledger' } }, { lacks: { type: 'pay' } }] }, coach: 'Who remembers whether an order was already charged? Give payment state a home: add Payment service.', priority: 3 },
    { id: 'pm-connect', stage: 'design', when: { all: [{ has: { type: 'ledger' } }, { not: { path: ['client', { type: 'ledger' }] } }] }, coach: 'Connect the path: Shop app → Checkout service → Payment service → Ledger. Select a part, then “Connect to…”.', priority: 2 },
    { id: 'pm-trace-now', stage: 'design', when: { all: [{ path: ['client', { type: 'ledger' }] }, { not: { result: 'trace:pay', is: 'ok' } }] }, coach: 'Press “Trace a request” and run “Pay for an order” to watch it cross your design.', priority: 1 },
    { id: 'pm-confirm-path', stage: 'design', when: { all: [{ path: ['client', { type: 'ledger' }] }, { has: { type: 'psp' } }, { not: { path: [{ type: 'psp' }, { type: 'ledger' }] } }] }, coach: 'The provider’s final answer arrives later by webhook. Add the Webhook handler and connect Provider → Webhook handler → Payment service.', priority: 2 },
    { id: 'pm-confirm-ok', stage: 'design', when: { result: 'trace:confirm', is: 'ok' }, ack: 'The provider’s confirmation reaches {type:ledger} along your arrows.' },
    { id: 'pm-direct-psp', stage: 'design', when: { link: [{ type: 'checkout' }, 'ext'] }, priority: 9, ask: { text: '{type:checkout} calls the provider directly. If it restarts halfway through a call, who remembers that this order was already sent for payment?', choices: [
      { id: 'pay', label: 'A payment service stores each payment’s state and key before calling the provider', reply: 'Yes: the record outlives any one server. After a restart the state is still there, so the retry carries the same key.', verdict: 'sound' },
      { id: 'memory', label: 'Checkout keeps it in memory', reply: 'A restart loses it, and the next try looks like a brand-new payment.', verdict: 'risky' },
      { id: 'ask', label: 'Ask the provider every time', reply: 'The provider can answer, and you should reconcile with it. But it cannot tell you what you intended; that is your state to keep.', verdict: 'partial' },
    ] }, gap: { text: 'No part stored payment state before calling the provider.', fix: 'Add Payment service: record each payment as pending with its key, then call the provider.', stage: 'design', lesson: 'idempotency' } },
    { id: 'pm-key', stage: 'design', when: { link: [{ type: 'pay' }, { type: 'psp' }], labels: ['calls'] }, priority: 8, ask: { text: 'An arrow to {type:psp} does not show what happens when the same Pay request arrives twice. What stops two charges?', choices: [
      { id: 'key', label: 'A unique idempotency key per order: repeats return the stored result', reply: 'Yes. The key is stored with the payment and also sent to the provider, so a repeat at either level has no further effect.', verdict: 'sound' },
      { id: 'button', label: 'Disable the Pay button after the first tap', reply: 'Helpful, but retries also come from networks, apps and servers. The button is a courtesy, not a guarantee.', verdict: 'partial' },
      { id: 'hope', label: 'Double taps are rare; accept it', reply: 'At 2,000 payments a second, rare is many double charges a day.', verdict: 'risky' },
    ] }, strength: 'You made repeats safe with an idempotency key stored by {type:pay} and sent to the provider.' },
    { id: 'pm-hook-ledger', stage: 'design', when: { link: [{ type: 'hook' }, { type: 'ledger' }], labels: ['writes to', 'reads and writes'] }, priority: 8, ask: { text: 'Both the webhook handler and {type:pay} write to {type:ledger}. If they disagree about one payment, who wins?', choices: [
      { id: 'one', label: 'Only Payment service writes; the handler passes each event to it', reply: 'Yes: one writer means one set of rules. Change the handler’s arrow to point at Payment service.', verdict: 'sound' },
      { id: 'provider', label: 'The handler, because the provider is the authority on charges', reply: 'The provider is the authority on the charge, but the ledger still needs one writer applying one rule to its own records.', verdict: 'partial' },
      { id: 'last', label: 'Whoever writes last', reply: '“Last write wins” is how a payment ends up recorded twice, or not at all.', verdict: 'risky' },
    ] } },
    { id: 'pm-queue', stage: 'design', when: { link: [{ type: 'pay' }, 'queue'] }, priority: 7, ack: 'Charges wait in {kind:queue} before reaching the provider. That is a real alternative: the shopper does not wait on the provider at all.', ask: { text: 'With charges queued, what does the shopper see right after tapping Pay?', choices: [
      { id: 'processing', label: '“Processing”, then the result by push or a status check once the webhook arrives', reply: 'Yes. The design is honest about the unknown. It is a valid alternative to the reference design, at the cost of an unfinished state the shopper must understand.', verdict: 'sound' },
      { id: 'success', label: '“Payment successful”', reply: 'Nothing has been charged yet. The card could still be declined.', verdict: 'risky' },
      { id: 'error', label: 'An error until the queue drains', reply: 'Then the queue gives you nothing. Its point is to accept the work now.', verdict: 'partial' },
    ] }, strength: 'You queued charges so a slow provider never holds the shopper, and kept the payment in an honest “processing” state.' },
    { id: 'pm-recon', stage: 'design', when: { has: { type: 'recon' } }, ack: 'You planned reconciliation: a way to find payments that disagree with the provider.', strength: 'You added reconciliation against the provider’s report, so mistakes that slip through are found.' },
    { id: 'pm-no-recon', stage: 'design', when: { all: [{ has: { type: 'ledger' } }, { lacks: { type: 'recon' } }] }, coach: 'Even careful code leaves a few payments out of step with the provider. What checks the ledger against the provider’s own report?', priority: 0, gap: { text: 'Nothing compared the ledger with the provider’s records.', fix: 'Add a nightly reconciliation job that flags payments the two sides disagree on.', stage: 'design', lesson: 'idempotency' } },
    // Timeout stage
    { id: 'pm-t-state', stage: 'timeout', when: { result: 'timeout', is: 'error' }, priority: 8, ask: { text: 'The provider did not answer. What state should this payment be in now?', choices: [
      { id: 'pending', label: 'Pending: we do not know yet whether it was charged', reply: 'Yes. A timeout means unknown. Only a final answer, from a webhook or a status query, can change it.', verdict: 'sound' },
      { id: 'failed', label: 'Failed, so the shopper can try again', reply: 'If the card was charged, a new attempt charges again. “Failed” must come from the provider, not from our timeout.', verdict: 'risky' },
      { id: 'paid', label: 'Paid, because it usually works', reply: 'Then a declined card gets the goods for free. Do not guess.', verdict: 'risky' },
    ] } },
    { id: 'pm-t-retry', stage: 'timeout', when: { result: 'timeout', is: 'error' }, priority: 7, ask: { text: 'The provider charged the card but its reply was lost. {type:pay} will try again. How do you avoid charging twice?', choices: [
      { id: 'key', label: 'Retry with the same idempotency key', reply: 'Yes: the provider recognises the key and returns the first result instead of charging again.', verdict: 'sound' },
      { id: 'status', label: 'Ask the provider for the payment’s status first, and send again only if there is none', reply: 'Also sound, as long as the status lookup uses the same key or order id. It costs an extra call per retry.', verdict: 'sound' },
      { id: 'new', label: 'Send it again as a new request', reply: 'A new request is a new charge. That is the double charge we are preventing.', verdict: 'risky' },
    ] }, gap: { text: 'A lost provider reply could lead to a second charge.', fix: 'Retry with the same idempotency key (or check the payment’s status first), and keep the payment pending until the provider says otherwise.', stage: 'timeout', lesson: 'idempotency' } },
    { id: 'pm-t-delayed', stage: 'timeout', when: { result: 'timeout', is: 'delayed' }, ack: 'Your design accepted the payment in {kind:queue}, so the shopper sees “processing” instead of an error.', strength: 'Your design keeps a silent provider off the shopper’s path.' },
    { id: 'pm-t-learn', stage: 'timeout', when: { result: 'timeout', is: 'delayed' }, priority: 6, ask: { text: 'The shopper sees “processing”. How do they find out the result?', choices: [
      { id: 'webhook', label: 'The webhook updates the payment; the app is told, or checks the status', reply: 'Yes. The webhook is the source of the final answer, and the app only needs to show what Payment service now says.', verdict: 'sound' },
      { id: 'refresh', label: 'They refresh the page until it changes', reply: 'It works, but a shopper may pay again while waiting. Tell them clearly the first payment is in progress.', verdict: 'partial' },
      { id: 'success', label: 'Show “paid” right away', reply: 'The card may still be declined. Show only what you know.', verdict: 'risky' },
    ] } },
    { id: 'pm-t-ledger', stage: 'timeout', when: { all: [{ result: 'timeout', is: 'error' }, { has: { type: 'ledger' } }] }, priority: 2, coach: 'Try the other twist: “Replay with the ledger offline” shows what happens when the part that records money is the one that fails.' },
    { id: 'pm-t-broken', stage: 'timeout', when: { result: 'timeout', is: 'broken' }, coach: 'There is no chain of arrows from the app to that part. Add the arrows, then run it again.', priority: 4 },
    // Webhook stage
    { id: 'pm-w-one', stage: 'webhook', when: { result: 'webhook', is: 'one' }, ack: 'Only one delivery recorded the payment, in every order you tried.', strength: 'You made the state change conditional, so a repeated webhook is harmless.' },
    { id: 'pm-w-atomic', stage: 'webhook', when: { result: 'webhook', is: 'one' }, priority: 6, ask: { text: 'The payment is marked paid and the ledger entries are written. If the server crashes between those two steps, what is left?', choices: [
      { id: 'txn', label: 'Do both in one transaction, so either both happen or neither does', reply: 'Yes. Then the retry of the webhook finds the payment still pending and tries again, safely.', verdict: 'sound' },
      { id: 'ledger-first', label: 'Write the ledger first, then mark it paid', reply: 'A crash in between records the money, but the payment is still pending, so the retry records it again. They need to be one step.', verdict: 'risky' },
      { id: 'recon', label: 'Reconciliation will notice later', reply: 'It will, and you want it. But finding mistakes later is a backstop, not the plan.', verdict: 'partial' },
    ] } },
    { id: 'pm-w-two', stage: 'webhook', when: { result: 'webhook', is: 'oversold' }, priority: 7, ask: { text: 'Both deliveries recorded the payment, so the ledger holds the money twice. What makes a repeated webhook harmless?', choices: [
      { id: 'cond', label: 'A conditional pending → paid change, in the same transaction as the ledger entries', reply: 'Yes: the check and the change are one step at the source of truth, so only one delivery can win. Switch the guard and run it again.', verdict: 'sound' },
      { id: 'event', label: 'Store each provider event id under a unique constraint and skip repeats', reply: 'Also sound: the database refuses the second insert. It protects against the same event twice; the state change protects against two different events for the same payment.', verdict: 'sound' },
      { id: 'timer', label: 'Ignore webhooks that arrive within a minute of the first', reply: 'A timer guesses. A late retry would sneak through, and a real second event would be dropped.', verdict: 'risky' },
    ] }, gap: { text: 'A repeated webhook recorded the same payment twice.', fix: 'Make “pending → paid” a conditional change in the same transaction as the ledger entries, and dedupe by event id.', stage: 'webhook', lesson: 'idempotency' } },
  ],
  solution: {
    design: g([
      ['app', 'app', 'client', 'Shop app', 40, 200], ['checkout', 'checkout', 'service', 'Checkout service', 160, 200], ['pay', 'pay', 'service', 'Payment service', 300, 200],
      ['psp', 'psp', 'ext', 'Payment provider', 440, 70], ['hook', 'hook', 'service', 'Webhook handler', 570, 200], ['ledger', 'ledger', 'db', 'Ledger', 440, 340], ['recon', 'recon', 'worker', 'Reconciliation job', 580, 380],
    ], [
      ['app', 'checkout', 'sends request'], ['checkout', 'pay', 'calls'], ['pay', 'psp', 'calls'], ['pay', 'ledger', 'reads and writes'], ['psp', 'hook', 'sends callback'],
      ['hook', 'pay', 'calls'], ['recon', 'ledger', 'reads from'], ['recon', 'psp', 'calls'],
    ]),
    why: {
      app: 'Sends Pay with an order id; shows pending, paid or failed from what Payment service says.',
      checkout: 'Owns the order. Asks Payment service to charge it; never touches card details or money records.',
      pay: 'Single owner of payment state and ledger writes. Stores each payment as pending with its idempotency key before calling the provider.',
      psp: 'External: called with a timeout and the idempotency key; reports the final result later by webhook.',
      hook: 'Receives provider events (possibly twice) and hands them to Payment service, which applies each once.',
      ledger: 'Append-only balanced entries, written in the same transaction as a payment’s state change.',
      recon: 'Nightly: compares the ledger with the provider’s report and flags any payment the two disagree on.',
    },
    alternatives: { pay: { types: ['attempts'], tradeoff: 'Queuing charges means the shopper never waits on the provider, at the cost of an unfinished “processing” state and a worker that sends each charge once.' } },
    trace: { title: 'A shopper pays for order 881', steps: [
      { from: 'app', to: 'checkout', text: 'Pay for order 881, €45.' },
      { from: 'checkout', to: 'pay', text: 'Create payment: key order-881.' },
      { from: 'pay', to: 'ledger', text: 'Insert payment 881 as pending (unique on the key). A repeat of this request finds it and returns its state.' },
      { from: 'pay', to: 'psp', text: 'Charge €45 with Idempotency-Key order-881. No reply within 5 s: the payment stays pending; the retry uses the same key.' },
      { from: 'psp', to: 'hook', text: 'Webhook: payment.succeeded, event evt_77. It is delivered twice.' },
      { from: 'hook', to: 'pay', text: 'Pass the event on. Payment service applies it once: pending → paid changes 1 row, so the ledger entries are written in the same transaction; the repeat changes 0 rows.' },
      { from: 'recon', to: 'ledger', text: 'That night, reconciliation matches the ledger to the provider’s settlement report. Order 881 matches.' },
    ] },
    tradeoff: 'A stored pending state, idempotency keys and one conditional transition make every retry and duplicate safe, but the shopper may see “processing” for a while, and reconciliation is another job to run.',
    otherApproach: 'If payments are rare and slow, queue each charge and let a single worker send it. If the provider supports it, authorise when the order is placed and capture later, which shrinks the window where a payment can be unknown.',
  },
};
