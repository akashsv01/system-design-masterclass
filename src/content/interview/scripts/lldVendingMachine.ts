import type { InterviewScript } from '../types';
import { py } from '../../lessons/_kit';

const st = (states: [string, string, number, number][], trans: [string, string, string][]) => ({
  comps: states.map(([id, label, x, y]) => ({ id, type: id, kind: 'state' as const, label, x, y })),
  links: trans.map(([from, to, label]) => ({ id: `${from}-${to}-${label}`, from, to, label })),
});

export const lldVendingMachine: InterviewScript = {
  caseId: 'lld-vending-machine',
  track: 'lld',
  doLine: 'Draw a vending machine’s states with a refund timer, assign jobs to the machine and a payment strategy, then add card payments that can fail',
  skills: ['state-machines', 'object-design', 'api-design'],
  brief: {
    interviewer: { name: 'Tomas', role: 'firmware engineer for a snack-machine maker' },
    intro: 'Our machines take coins today. I want the control logic as objects, and a model that does not fall apart when we add a card reader next year.',
    users: 'People at the machine, and the hardware layer that calls insert, select and cancel.',
    needs: ['Insert coins to build up a balance', 'Select an item and receive it with the right change', 'Cancel and get the money back'],
    mustHold: ['Every action is checked against the current state', 'Money is conserved: money in = items sold + change + refunds', 'Stock never goes below zero'],
    constraints: ['About 20 items, each with a price in cents and a stock count', 'Money in the machine for more than 2 minutes without a selection is refunded', 'Time reaches your code as events, so tests can control the clock'],
    outOfScope: ['Coin-handling hardware', 'Remote stock reports', 'Discounts and loyalty cards'],
    terms: [
      { term: 'state machine', meaning: 'a list of states and the events allowed to move between them' },
      { term: 'strategy', meaning: 'an object that does one job in a swappable way, such as taking payment by coins or by card' },
      { term: 'timeout', meaning: 'a transition that fires by itself after a set time in a state' },
    ],
    firstMove: 'Draw the machine’s states and what insert, select and cancel do in each. Then replay a short sequence that ends with someone walking away after putting coins in.',
  },
  palette: [
    { type: 'machine', kind: 'class', name: 'VendingMachine', blurb: 'Owns the state and the three actions: insert, select, cancel.' },
    { type: 'stock', kind: 'class', name: 'Stock', blurb: 'Prices and counts per item.' },
    { type: 'machine-state', kind: 'enum', name: 'MachineState', blurb: 'Idle, has money, dispensing.' },
    { type: 'payment', kind: 'iface', name: 'PaymentMethod', blurb: 'A promise to take money, report the amount and refund it.' },
    { type: 'coins', kind: 'class', name: 'CoinPayment', blurb: 'Adds coins to a balance and returns change.' },
    { type: 'cardpay', kind: 'class', name: 'CardPayment', blurb: 'Asks a bank to authorise an amount; the answer can be no, or late.' },
  ],
  verbs: ['uses', 'implements', 'has', 'creates'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Pin down what each action does before drawing anything.',
      question: 'Which rules would you confirm before drawing the machine’s states?',
      activity: { kind: 'clarify', questions: [
        { id: 'states', q: 'What states can the machine be in?', a: 'Idle (no money), has money, and dispensing while an item drops. Nothing else for now.' },
        { id: 'early', q: 'What if someone selects before inserting money?', a: 'Say “insert money first”. The state does not change.' },
        { id: 'short', q: 'What if the balance is too low or the item is sold out?', a: 'Say why, keep the money, stay in the same state.' },
        { id: 'walk', q: 'What if someone walks away with money inserted?', a: 'After 2 minutes with no selection, refund and go back to idle.' },
        { id: 'change', q: 'Does the machine give change?', a: 'Yes. Change is the balance minus the price, returned in the same step as the item.' },
      ], assumptions: [
        { id: 'timer-kind', q: 'How is the 2-minute refund triggered?', options: [
          { id: 'event', label: 'A timer event arrives from the hardware layer', consequence: 'The machine has a timed transition and tests can control the clock.' },
          { id: 'check', label: 'Every call first checks how long ago the last coin was inserted', consequence: 'No timer, but nothing refunds until someone touches the machine again.' },
        ] },
      ] },
      help: {
        hint: 'What should happen to the coins when someone leaves without choosing?',
        walkthrough: [{ text: 'States: idle, has money, dispensing.' }, { text: 'Each action is valid in some states and refused in others.' }, { text: 'Inactivity refunds on a timer.' }],
        solution: [{ type: 'list', items: ['Idle: only insert is useful.', 'Has money: insert, select, cancel and the timeout all apply.', 'Dispensing: ignore actions until it finishes.', 'Timeout: refund and go to idle.'] }],
        why: 'The checks you list become the guards on transitions; money conservation follows from where the balance is zeroed.',
      },
      lessons: ['requirements', 'state-machines'],
    },
    {
      id: 'states', title: 'The machine’s states', intro: 'Place the states, name each arrow with its event, then replay the sequence with the clock. One tick is one minute.',
      question: 'Draw the states and events. What happens at minute 8 when someone presses select, after coins were put in at minute 3?',
      activity: {
        kind: 'states', entity: 'The machine', initial: 'idle',
        states: [
          { key: 'idle', label: 'Idle', blurb: 'No money. Only insert does anything.' },
          { key: 'has_money', label: 'Has money', blurb: 'Balance above zero; waiting for a selection.' },
          { key: 'dispensing', label: 'Dispensing', blurb: 'An item is dropping and change is returned.' },
        ],
        events: [{ id: 'insert', label: 'insert' }, { id: 'select', label: 'select' }, { id: 'cancel', label: 'cancel' }, { id: 'done', label: 'done' }, { id: 'timeout', label: 'timeout (2 min)' }],
        timer: { event: 'timeout', after: 2 },
        scenario: [
          { at: 0, event: 'insert', label: 'Minute 0: Sam inserts coins', expect: 'has_money' },
          { at: 1, event: 'select', label: 'Minute 1: Sam selects a chocolate bar', expect: 'dispensing' },
          { at: 2, event: 'done', label: 'Minute 2: the bar drops and change is returned', expect: 'idle' },
          { at: 3, event: 'insert', label: 'Minute 3: Lee inserts coins and walks away', expect: 'has_money' },
          { at: 8, event: 'select', label: 'Minute 8: someone presses select, with nothing inserted since (refused)' },
          { at: 9, event: 'insert', label: 'Minute 9: Mia inserts coins', expect: 'has_money' },
        ],
        starter: st([['idle', 'Idle', 90, 220], ['has_money', 'Has money', 320, 220]], [['idle', 'has_money', 'insert']]),
      },
      help: {
        hint: 'Lee left at minute 3. What took the machine back to idle before minute 8?',
        walkthrough: [
          { text: 'Minute 0: Idle → Has money on “insert”.', focus: ['machine', 'mstate'] },
          { text: 'Minute 1: Has money → Dispensing on “select”; minute 2: Dispensing → Idle on “done”.', focus: ['mstate'] },
          { text: 'Minute 3: Lee inserts. Two minutes later the timer fires: Has money → Idle, refunding.', focus: ['machine'] },
          { text: 'Minute 8: a select in Idle has no arrow, so it is refused (“insert money first”).', focus: ['mstate'] },
          { text: 'Minute 9: Mia inserts: Idle → Has money. Had Lee’s money still been there, the machine would be busy and refuse her.', focus: ['mstate'] },
        ],
        solution: [
          { type: 'table', head: ['From', 'Event', 'To'], rows: [['Idle', 'insert', 'Has money'], ['Has money', 'insert', 'Has money'], ['Has money', 'select', 'Dispensing'], ['Has money', 'cancel / timeout', 'Idle (refund)'], ['Dispensing', 'done', 'Idle']] },
          { type: 'code', lang: 'python', code: py('sdm/cases/vending.py', 'cancel'), caption: 'python/sdm/cases/vending.py — tested with pytest' },
        ],
        why: 'The refund rule only exists if a timed arrow enforces it; otherwise Lee’s coins sit in the machine for the next person.',
      },
      lessons: ['state-machines', 'pattern-state'],
    },
    {
      id: 'roles', title: 'Who does what', intro: 'Split the work between the machine and a payment strategy, then follow a purchase with exact change.',
      question: 'What does the machine own, and what does the payment method own?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'machine', name: 'VendingMachine', blurb: 'State, and the actions insert, select, cancel.' },
          { id: 'payment', name: 'PaymentMethod', blurb: 'Takes money, reports the amount, refunds.' },
          { id: 'stock', name: 'Stock', blurb: 'Price and count per item.' },
        ],
        cards: [
          { id: 'allowed', text: 'Check the current state allows “select”', owner: 'machine', why: 'The machine owns the state, so it owns the state checks.' },
          { id: 'price', text: 'Look up the price of item B3', owner: 'stock', why: 'Prices and counts live together in Stock.' },
          { id: 'enough', text: 'Check the money covers the price', owner: 'payment', alt: ['machine'], why: 'The payment method knows the amount. The machine may compare it with the price it was told.' },
          { id: 'collect', text: 'Take the payment (coins or card)', owner: 'payment', why: 'How money is taken differs by method, so it sits behind the interface.' },
          { id: 'refund', text: 'Give the money back on cancel or timeout', owner: 'payment', why: 'Only the method knows how to return what it took.' },
          { id: 'drop', text: 'Reduce stock and drop the item', owner: 'machine', alt: ['stock'], why: 'The machine coordinates the sale; Stock may do the decrement itself.' },
        ],
        walk: { title: 'Sam selects B3 with exact change', steps: [
          { prompt: 'Who receives “select B3”?', owner: 'machine', call: 'machine.select("B3")' },
          { prompt: 'Who knows the price of B3?', owner: 'stock', call: 'stock.price("B3")' },
          { prompt: 'Who confirms the money covers it and takes it?', owner: 'payment', call: 'payment.charge(price)' },
          { prompt: 'Who updates the state and drops the item?', owner: 'machine', call: 'self.state = DISPENSING' },
        ] },
      },
      help: {
        hint: 'Which parts differ between coins and a card, and which stay the same?',
        walkthrough: [
          { text: 'The machine’s state rules are the same for any payment method.', focus: ['machine'] },
          { text: 'Taking and refunding money is what differs, so it hides behind PaymentMethod.', focus: ['pay'] },
          { text: 'Stock holds prices and counts, separate from state rules.', focus: ['stock'] },
        ],
        solution: [{ type: 'code', lang: 'python', code: py('sdm/cases/vending.py', 'select'), caption: 'python/sdm/cases/vending.py — tested with pytest' }, { type: 'p', text: 'In version 1 balance and change live in the machine. Moving them behind PaymentMethod keeps the same checks and makes room for a card.' }],
        why: 'The parts that vary move behind an interface; the state rules stay in one place.',
      },
      lessons: ['responsibilities', 'pattern-strategy', 'dependency-injection'],
    },
    {
      id: 'card', title: 'Card payments', intro: 'The interviewer changes one condition. Decide what new state it needs.',
      question: 'A card payment must be authorised by a bank, which can refuse or answer late. What new state does the machine need?',
      change: { announce: 'New condition: customers can pay by card. The bank takes up to a minute to answer, and the answer can be no, or can arrive after the machine gave up.', rule: 'An event changes the state only if your diagram has an arrow for that event from the current state. A timed arrow fires by itself after its time. An answer that arrives in the wrong state is refused, so someone must undo the authorisation.' },
      activity: {
        kind: 'states', entity: 'The machine, paying by card', initial: 'idle',
        states: [
          { key: 'idle', label: 'Idle', blurb: 'Waiting for a customer.' },
          { key: 'awaiting_bank', label: 'Awaiting bank', blurb: 'A card was tapped; the bank has not answered yet.' },
          { key: 'dispensing', label: 'Dispensing', blurb: 'The bank said yes; the item is dropping.' },
        ],
        events: [{ id: 'tap', label: 'tap card' }, { id: 'approved', label: 'bank approves' }, { id: 'declined', label: 'bank declines' }, { id: 'done', label: 'done' }, { id: 'timeout', label: 'timeout (1 min)' }],
        timer: { event: 'timeout', after: 1 },
        scenario: [
          { at: 0, event: 'tap', label: 'Minute 0: Kim taps her card for B3', expect: 'awaiting_bank' },
          { at: 0.5, event: 'approved', label: 'Minute 0.5: the bank approves', expect: 'dispensing' },
          { at: 1, event: 'done', label: 'Minute 1: the item drops', expect: 'idle' },
          { at: 3, event: 'tap', label: 'Minute 3: Raj taps a card', expect: 'awaiting_bank' },
          { at: 3.5, event: 'declined', label: 'Minute 3.5: the bank declines', expect: 'idle' },
          { at: 5, event: 'tap', label: 'Minute 5: Eli taps a card', expect: 'awaiting_bank' },
          { at: 9, event: 'approved', label: 'Minute 9: the bank approves Eli’s payment, far too late (refused)' },
          { at: 10, event: 'tap', label: 'Minute 10: Zoe taps a card', expect: 'awaiting_bank' },
        ],
        starter: st([['idle', 'Idle', 90, 220], ['awaiting_bank', 'Awaiting bank', 320, 220]], [['idle', 'awaiting_bank', 'tap']]),
      },
      help: {
        hint: 'Where does the machine wait for the bank, and how does it leave that state if the bank never answers?',
        walkthrough: [
          { text: 'Tap moves Idle → Awaiting bank.', focus: ['mstate', 'machine'] },
          { text: 'Approved leads to Dispensing; declined leads back to Idle with nothing dispensed.', focus: ['mstate'] },
          { text: 'A timeout returns to Idle, so a late approval at minute 9 is refused and must be reversed; Zoe’s tap at minute 10 then starts a fresh wait.', focus: ['pay', 'machine'] },
        ],
        solution: [{ type: 'table', head: ['From', 'Event', 'To'], rows: [['Idle', 'tap card', 'Awaiting bank'], ['Awaiting bank', 'bank approves', 'Dispensing'], ['Awaiting bank', 'bank declines / timeout', 'Idle'], ['Dispensing', 'done', 'Idle']] }, { type: 'p', text: 'A late approval is refused in Idle. The card payment object must then cancel that authorisation so the customer is not charged.' }],
        why: 'A bank can say no or say nothing, so waiting needs its own state and a way out.',
      },
      lessons: ['state-machines', 'pattern-state', 'timeouts'],
    },
  ],
  rules: [
    { id: 'vm-timeout-missing', stage: 'states', when: { result: 'states', is: 'stuck' }, priority: 6, ask: { text: 'At minute 8 your machine still held Lee’s money, so the next person could spend it, and Mia’s coins at minute 9 were refused. What should have happened after two minutes?', choices: [
      { id: 'timeout', label: 'Has money → Idle on a timed “timeout”, refunding', reply: 'Yes. Draw the arrow and replay.', verdict: 'sound' },
      { id: 'keep', label: 'Keep the balance; the next customer will use it', reply: 'That gives one customer another’s money and breaks conservation.', verdict: 'risky' },
      { id: 'check', label: 'Refund when the next call arrives and notices it is old', reply: 'It can work (check on each call) but the money sits until someone touches the machine.', verdict: 'partial' },
    ] }, gap: { text: 'Money inserted and abandoned was never refunded.', fix: 'Add Has money → Idle on a timed “timeout” and replay.', stage: 'states', lesson: 'state-machines' } },
    { id: 'vm-states-ok', stage: 'states', when: { result: 'states', is: 'pass' }, ack: 'Your machine refunded Lee on the timer and refused the stray select.', strength: 'You drew a timed refund and a refused action in idle, so inactivity and invalid actions are both handled by the state machine.' },
    { id: 'vm-short-balance', stage: 'states', when: { result: 'states', is: 'pass' }, priority: 5, ask: { text: 'Your Has money state has an arrow to Dispensing on “select”. What if the balance is below the price? The diagram cannot show that.', choices: [
      { id: 'guard', label: 'A guard: select moves on only if the balance covers the price and stock is above zero', reply: 'Yes. Otherwise it explains why and stays in Has money.', verdict: 'sound' },
      { id: 'dispense', label: 'Dispense anyway and charge later', reply: 'That breaks money conservation.', verdict: 'risky' },
      { id: 'two', label: 'Add a second state per reason, such as “too little”', reply: 'It works but multiplies states. A guard plus a message keeps the diagram small.', verdict: 'partial' },
    ] } },
    { id: 'vm-roles-good', stage: 'roles', when: { result: 'roles', is: 'pass' }, ack: 'The state rules stay in the machine and the payment details sit behind an interface.', strength: 'You separated what stays the same (state checks) from what varies (how money is taken), which makes card payments an addition.' },
    { id: 'vm-roles-gap', stage: 'roles', when: { result: 'roles', is: 'gaps' }, gap: { text: 'Payment details and state rules were mixed in the same object.', fix: 'Move taking and refunding money to PaymentMethod and keep state checks in the machine.', stage: 'roles', lesson: 'pattern-strategy' } },
    { id: 'vm-roles-alt', stage: 'roles', when: { result: 'roles', is: 'pass' }, priority: 4, ask: { text: 'Version 1 can keep balance and change inside the machine, as the tested code does. When is a PaymentMethod worth adding?', choices: [
      { id: 'second', label: 'When a second way to pay is real', reply: 'Yes. Until then an interface with one implementation adds little.', verdict: 'sound' },
      { id: 'always', label: 'From the start, to be safe', reply: 'That is valid when cards are certain. Otherwise it is an extra file to read.', verdict: 'partial' },
    ] } },
    { id: 'vm-card-ok', stage: 'card', when: { result: 'card', is: 'pass' }, ack: 'Your machine waits for the bank, and leaves that wait on a decline or a timeout.', strength: 'You added an Awaiting bank state with a way out, so a bank that says no or says nothing never traps the machine.', ask: { text: 'The bank approves at minute 9, after your machine timed out. The customer’s card may now be charged. Who must undo it?', choices: [
      { id: 'cancel', label: 'The card payment object cancels the authorisation when a late approval is refused', reply: 'Yes. A refused event is a signal to compensate, not to ignore.', verdict: 'sound' },
      { id: 'ignore', label: 'Nothing; the bank will release it eventually', reply: 'Some banks do after days. The customer sees a charge for nothing meanwhile.', verdict: 'risky' },
      { id: 'dispense', label: 'Dispense late anyway', reply: 'The customer may have left. Another buyer could take it.', verdict: 'risky' },
    ] } },
    { id: 'vm-card-stuck', stage: 'card', when: { result: 'card', is: 'stuck' }, priority: 6, ask: { text: 'Your machine accepted a bank answer it should have refused, or stayed stuck waiting. What does a state need so that waiting cannot last forever?', choices: [
      { id: 'timeout', label: 'A timed arrow back to Idle', reply: 'Yes. Add it and replay.', verdict: 'sound' },
      { id: 'wait', label: 'Wait for the bank as long as it takes', reply: 'The next customer cannot use the machine meanwhile.', verdict: 'risky' },
    ] }, gap: { text: 'Waiting for the bank had no timeout, so a late or missing answer left the machine in the wrong state.', fix: 'Add Awaiting bank → Idle on a timed “timeout” and replay.', stage: 'card', lesson: 'timeouts' } },
  ],
  solution: {
    design: {
      comps: [
        { id: 'machine', type: 'machine', kind: 'class', label: 'VendingMachine', x: 80, y: 200 },
        { id: 'mstate', type: 'machine-state', kind: 'enum', label: 'MachineState', x: 80, y: 50 },
        { id: 'stock', type: 'stock', kind: 'class', label: 'Stock', x: 80, y: 360 },
        { id: 'pay', type: 'payment', kind: 'iface', label: 'PaymentMethod', x: 320, y: 200 },
        { id: 'coins', type: 'coins', kind: 'class', label: 'CoinPayment', x: 530, y: 110 },
        { id: 'card', type: 'cardpay', kind: 'class', label: 'CardPayment', x: 530, y: 300 },
      ],
      links: [
        { id: 'm-state', from: 'machine', to: 'mstate', label: 'uses' }, { id: 'm-stock', from: 'machine', to: 'stock', label: 'uses' },
        { id: 'm-pay', from: 'machine', to: 'pay', label: 'uses' }, { id: 'coins-pay', from: 'coins', to: 'pay', label: 'implements' }, { id: 'card-pay', from: 'card', to: 'pay', label: 'implements' },
      ],
    },
    why: {
      machine: 'Owns the state and the three actions; every action is checked against the state first.',
      mstate: 'Idle, has money, dispensing (and awaiting bank once cards exist).',
      stock: 'Price and count per item; the count never goes below zero.',
      pay: 'The promise: take money, report the amount, refund. The machine depends on this, not on coins or cards.',
      coins: 'Adds coins to a balance and returns change.',
      card: 'Asks a bank to authorise; handles a decline, a timeout and a late approval.',
    },
    alternatives: { pay: { types: ['machine'], tradeoff: 'Keeping balance and change in the machine is fine while coins are the only method, as in the tested version-1 code.' } },
    trace: { title: 'Sam selects B3 with exact change', steps: [
      { from: 'machine', to: 'mstate', text: 'select("B3"): state is Has money, so the action is allowed.' },
      { from: 'machine', to: 'stock', text: 'Price 150 cents, count 4: fine.' },
      { from: 'machine', to: 'pay', text: 'charge(150): the payment method confirms 150 was inserted.' },
      { from: 'pay', to: 'coins', text: 'Balance goes to zero, change is 0.' },
      { from: 'machine', to: 'mstate', text: 'Has money → Dispensing; after “done”, Dispensing → Idle.' },
    ] },
    tradeoff: 'A strategy for payment keeps the state rules unchanged when a card arrives, at the cost of one more interface and class to read.',
    otherApproach: 'With many states and rules per state, the State pattern puts each state’s allowed actions in its own class; with three or four states, a small table is clearer.',
  },
};
