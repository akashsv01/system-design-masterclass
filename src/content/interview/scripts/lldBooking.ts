import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';
import { py } from '../../lessons/_kit';

const st = (states: [string, string, number, number][], trans: [string, string, string][]) => ({
  comps: states.map(([id, label, x, y]) => ({ id, type: id, kind: 'state' as const, label, x, y })),
  links: trans.map(([from, to, label]) => ({ id: `${from}-${to}-${label}`, from, to, label })),
});

export const lldBooking: InterviewScript = {
  caseId: 'lld-booking',
  track: 'lld',
  doLine: 'Draw a seat’s states, advance the clock until a hold expires, assign each job to an object, then move from one server to ten',
  skills: ['state-machines', 'object-design', 'concurrency'],
  brief: {
    interviewer: { name: 'Marcus', role: 'senior engineer who owns the seat inventory code' },
    intro: 'The architecture is settled: Booking service owns seats. Now I want the code inside it. Think in objects and states, not boxes and arrows between servers.',
    users: 'Other code: the Booking service’s request handlers, called by many threads at once.',
    needs: ['Hold a free seat for one buyer for ten minutes', 'Confirm the seat for that buyer when they pay', 'Release holds that run out'],
    mustHold: ['A seat is in exactly one state at a time', 'Only the buyer who holds a seat can confirm it', 'A payment after the hold expired is refused (the caller refunds)'],
    constraints: ['Holds last 10 minutes', 'Many request threads call the same object concurrently', 'Time is passed in as `now`, so tests can control the clock'],
    outOfScope: ['Databases and networks (that was the HLD interview)', 'Pricing and seat maps'],
    terms: [
      { term: 'state machine', meaning: 'a list of states and the events allowed to move between them' },
      { term: 'invariant', meaning: 'a rule that must be true before and after every method call' },
      { term: 'guard', meaning: 'a condition checked before a transition is allowed, such as “only the holder may pay”' },
    ],
    firstMove: 'A seat can be free, held by one buyer for ten minutes, or booked. Draw its states and the events that move it between them, then advance the clock past ten minutes and show me what happens.',
  },
  palette: [
    { type: 'inventory', kind: 'class', name: 'SeatInventory', blurb: 'Owns every seat for one event and the methods hold() and confirm().' },
    { type: 'hold', kind: 'class', name: 'Hold', blurb: 'One reservation: seat, buyer, expires_at.' },
    { type: 'state-enum', kind: 'enum', name: 'SeatState', blurb: 'The fixed set of states a seat can be in.' },
    { type: 'booking-svc', kind: 'class', name: 'BookingService', blurb: 'Handles requests: calls the inventory and the payment gateway, refunds when needed.' },
    { type: 'gateway', kind: 'iface', name: 'PaymentGateway', blurb: 'An interface for charging and refunding; tests use a fake.' },
  ],
  verbs: ['reserve', 'pay', 'expire', 'cancel'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Pin down the rules before the objects.',
      question: 'Which rules would you confirm before writing a single class?',
      activity: { kind: 'clarify', questions: [
        { id: 'states', q: 'What states can a seat be in?', a: 'Free (available), held by one buyer, or booked. Nothing else for now.' },
        { id: 'expiry', q: 'Who notices that a hold has expired?', a: 'Nobody runs a timer for you. Methods receive `now`; a hold whose `expires_at` has passed counts as expired.' },
        { id: 'late', q: 'What if a buyer pays after their hold expired?', a: 'Refuse the confirmation. The caller refunds the payment.' },
        { id: 'threads', q: 'Is the object shared between threads?', a: 'Yes. Many request threads call hold() and confirm() on the same inventory.' },
        { id: 'cancel', q: 'Can a buyer give a seat back?', a: 'Yes, a held seat can be cancelled; a booked one cannot here.' },
      ], assumptions: [
        { id: 'sweep', q: 'How are expired holds released?', options: [
          { id: 'lazy', label: 'Lazily: each call first releases anything that has expired', consequence: 'No background thread; every method must expire first.' },
          { id: 'sweeper', label: 'A background sweeper runs every few seconds', consequence: 'Simpler methods, but a seat can look held a few seconds after it expired.' },
        ] },
      ] },
      help: {
        hint: 'Which rule decides what happens at minute eleven?',
        walkthrough: [{ text: 'States: available, held, booked.' }, { text: 'Expiry is decided from `now` and `expires_at`, not by a timer.' }, { text: 'A late payment is refused and refunded.' }, { text: 'Concurrent callers mean check-and-change must be one step.' }],
        solution: [{ type: 'list', items: ['States: available → held → booked; held → available on expiry or cancel.', 'Expiry from `now`, passed in.', 'Late payment: refuse; caller refunds.', 'Shared across threads: one lock around check-and-change.'] }],
        why: 'These rules are the invariants your classes must keep; everything else is naming.',
      },
      lessons: ['state-machines', 'contracts-invariants'],
    },
    {
      id: 'states', title: 'Seat states', intro: 'Place the states, connect them, and name each arrow with the event that causes it. Then advance the clock.',
      question: 'Draw a seat’s states and the events between them. What happens at 10:12 when Ben tries to reserve F12?',
      activity: {
        kind: 'states', entity: 'Seat F12', initial: 'available',
        states: [
          { key: 'available', label: 'Available', blurb: 'Anyone can reserve it.' },
          { key: 'held', label: 'Held', blurb: 'Reserved by one buyer until their hold expires.' },
          { key: 'booked', label: 'Booked', blurb: 'Paid for. Final.' },
        ],
        events: [{ id: 'reserve', label: 'reserve' }, { id: 'pay', label: 'pay' }, { id: 'expire', label: 'expire (10 min)' }, { id: 'cancel', label: 'cancel' }],
        timer: { event: 'expire', after: 10 },
        scenario: [
          { at: 0, event: 'reserve', label: '10:00 Ana reserves F12', expect: 'held' },
          { at: 12, event: 'reserve', label: '10:12 Ben reserves F12', expect: 'held' },
          { at: 15, event: 'pay', label: '10:15 Ben pays', expect: 'booked' },
        ],
        starter: st([['available', 'Available', 90, 220], ['held', 'Held', 320, 220]], [['available', 'held', 'reserve']]),
      },
      help: {
        hint: 'At 10:10 Ana’s hold runs out. Which arrow takes F12 back to Available, and what event is it?',
        walkthrough: [
          { text: '10:00 Ana reserves: Available → Held.' },
          { text: '10:10 nobody acts, but Ana’s ten minutes are up: Held → Available on “expire”. Only an arrow you draw can make this happen.' },
          { text: '10:12 Ben reserves: Available → Held, now for Ben.' },
          { text: '10:15 Ben pays: Held → Booked.' },
        ],
        solution: [
          { type: 'table', head: ['From', 'Event', 'To'], rows: [['Available', 'reserve', 'Held'], ['Held', 'pay (holder only)', 'Booked'], ['Held', 'expire (10 min)', 'Available'], ['Held', 'cancel', 'Available']] },
          { type: 'p', text: 'Without the expire arrow, Ana’s abandoned hold keeps F12 forever and Ben is refused.' },
        ],
        why: 'The brief says holds last ten minutes; that rule only exists in your design if a transition enforces it.',
      },
      lessons: ['state-machines', 'pattern-state'],
    },
    {
      id: 'roles', title: 'Who does what', intro: 'Give each job to one object, then walk through Ben paying.',
      question: 'Which object owns each job, and which object refuses Ana’s late payment?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'inventory', name: 'SeatInventory', blurb: 'All seats for one event; hold() and confirm().' },
          { id: 'hold', name: 'Hold', blurb: 'seat, buyer, expires_at' },
          { id: 'booking-svc', name: 'BookingService', blurb: 'Handles a request end to end.' },
          { id: 'gateway', name: 'PaymentGateway', blurb: 'Charges and refunds cards.' },
        ],
        cards: [
          { id: 'free', text: 'Decide whether F12 is free right now', owner: 'inventory', why: 'Only the inventory sees every seat’s state.' },
          { id: 'remember', text: 'Remember who holds F12 and until when', owner: 'hold', alt: ['inventory'], why: 'A Hold is that fact; the inventory keeps the Holds.' },
          { id: 'atomic', text: 'Check and change a seat in one step', owner: 'inventory', why: 'The lock lives with the data it protects.' },
          { id: 'expire', text: 'Release holds that have expired', owner: 'inventory', alt: ['booking-svc'], why: 'The inventory expires lazily at the start of each call; a service-level sweeper is a valid alternative if the brief allows a short delay.' },
          { id: 'charge', text: 'Charge the card', owner: 'gateway', why: 'Payment is someone else’s system behind an interface.' },
          { id: 'refund', text: 'Refund a payment that arrived after the hold expired', owner: 'booking-svc', why: 'Refunding involves payment and inventory; the service that coordinates both decides.' },
        ],
        walk: { title: 'Ben pays for F12 at 10:15', steps: [
          { prompt: 'Who receives Ben’s “pay for F12” request?', owner: 'booking-svc', call: 'booking.pay(seat="F12", buyer="ben")' },
          { prompt: 'Who charges Ben’s card?', owner: 'gateway', call: 'gateway.charge(order="o-ben-F12", amount=…)' },
          { prompt: 'Who checks that Ben still holds F12 and books it?', owner: 'inventory', call: 'inventory.confirm("F12", "ben", now)' },
          { prompt: 'Whose data says who holds F12 and until when?', owner: 'hold', call: 'hold.buyer == "ben" and hold.expires_at > now' },
        ] },
      },
      help: {
        hint: 'Put each job where the data it needs already lives.',
        walkthrough: [
          { text: 'SeatInventory holds every seat, so it decides availability and keeps the lock.' },
          { text: 'Hold is a small value: seat, buyer, expiry.' },
          { text: 'BookingService coordinates payment and inventory, so it refunds when confirm() says no.' },
        ],
        solution: [
          { type: 'code', lang: 'python', code: py('sdm/cases/seat_booking.py', 'confirm'), caption: 'python/sdm/cases/seat_booking.py — tested with pytest' },
          { type: 'p', text: '`confirm` refuses when the hold is gone or belongs to someone else; BookingService then refunds Ana.' },
        ],
        why: 'Each invariant is enforced by the object that owns the data, so no caller can forget it.',
      },
      lessons: ['responsibilities', 'cohesion-coupling', 'dependency-injection'],
    },
    {
      id: 'servers', title: 'Ten servers', intro: 'The interviewer changes one condition. Predict, run it, revise.',
      question: 'Booking service now runs on ten servers, each with its own SeatInventory and its own lock. Can two buyers still both hold F12?',
      change: { announce: 'New condition: the Booking service now runs on ten servers. Ana’s request reaches server 3 and Ben’s reaches server 7 at the same moment.', rule: RULES.timeline },
      activity: {
        kind: 'timeline', names: ['Ana (server 3)', 'Ben (server 7)'], resource: 'Seat F12 (seats left)', initial: 1,
        read: 'checks F12', write: 'marks F12 held',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'threading.Lock in each server', detail: 'Each process has its own lock, so server 3 and server 7 never wait for each other.', code: 'with self._lock:   # one lock per process\n    ...' },
          { id: 'conditional', label: 'Conditional write in the shared database', detail: 'The database applies “only if still free” for every server.', code: "UPDATE seats SET state='held', holder=:buyer\nWHERE id='F12' AND state='available'" },
          { id: 'lock', label: 'Row lock in the shared database', detail: 'SELECT … FOR UPDATE makes the second server wait.', code: "SELECT state FROM seats WHERE id='F12' FOR UPDATE" },
        ],
        predict: { q: 'With a threading.Lock in each server, how many buyers are told “held”?', choices: [{ id: 'one', label: 'One' }, { id: 'both', label: 'Both' }, { id: 'none', label: 'Neither' }] },
      },
      help: {
        hint: 'Does server 7 know that server 3 is holding its lock?',
        walkthrough: [{ text: 'A threading lock lives in one process’s memory.' }, { text: 'Server 3 and server 7 each take their own lock, so both check “free” and both write.' }, { text: 'Move the check-and-change to the one place they share: the database.' }],
        solution: [{ type: 'p', text: 'No: per-process locks don’t coordinate across servers. Move the check-and-change into the shared database (conditional update or row lock) and keep SeatInventory as the in-memory model for tests and single-process tools.' }],
        why: '“Exactly one buyer wins” has to hold for every caller, and only the shared store sees every caller.',
      },
      lessons: ['concurrency-lld', 'concurrent-reservations', 'locking-mvcc'],
    },
  ],
  rules: [
    { id: 'expire-missing', stage: 'states', when: { result: 'states', is: 'stuck' }, priority: 6, ask: { text: 'At 10:12 F12 was still Held by Ana, so Ben was refused. Nobody is paying for that seat. What should have happened at 10:10?', choices: [
      { id: 'expire', label: 'Held → Available on “expire”, ten minutes after the hold', reply: 'Yes. Draw that arrow and advance the clock again.', verdict: 'sound' },
      { id: 'ben', label: 'Ben should take over Ana’s hold', reply: 'Then Ana could pay at 10:09 and lose the seat. Expiry should free the seat first.', verdict: 'risky' },
    ] }, gap: { text: 'Holds never expired in your state machine.', fix: 'Add Held → Available on “expire” and replay the clock.', stage: 'states', lesson: 'state-machines' } },
    { id: 'expire-ok', stage: 'states', when: { result: 'states', is: 'pass' }, ack: 'Your machine freed F12 at 10:10 and Ben got it.', strength: 'Your seat state machine handled expiry: an abandoned hold frees the seat on its own.' },
    { id: 'late-pay', stage: 'states', when: { result: 'states', is: 'pass' }, priority: 5, ask: { text: 'Ana’s payment arrives at 10:13, after her hold expired and Ben now holds F12. Your arrow says Held → Booked on “pay”. Who gets F12?', choices: [
      { id: 'guard', label: 'Nobody new: “pay” needs a guard — only the current holder', reply: 'Right: the event alone isn’t enough; the transition checks who is paying. Ana is refused and refunded.', verdict: 'sound' },
      { id: 'ana', label: 'Ana, because she paid', reply: 'That takes Ben’s seat away during his hold. The guard “only the holder” prevents it.', verdict: 'risky' },
    ] } },
    { id: 'guard-strength', when: { answer: 'late-pay', is: 'guard' }, strength: 'You added the guard “only the holder may pay”, so a late payment can’t steal a seat.' },
    { id: 'roles-good', stage: 'roles', when: { result: 'roles', is: 'pass' }, ack: 'Each job sits with the object that owns its data.', strength: 'You put each responsibility where its data lives (SeatInventory decides, Hold remembers, BookingService coordinates).' },
    { id: 'roles-gap', stage: 'roles', when: { result: 'roles', is: 'gaps' }, gap: { text: 'Some jobs were given to objects that don’t own the data they need.', fix: 'Reassign the cards marked “reconsider” and walk through Ben’s payment again.', stage: 'roles', lesson: 'responsibilities' } },
    { id: 'servers-fixed', stage: 'servers', when: { result: 'servers', is: 'one' }, ack: 'With the check in the shared database, only one server’s buyer wins.', strength: 'You moved the check-and-change to the shared store when one process became ten.' },
    { id: 'servers-over', stage: 'servers', when: { result: 'servers', is: 'oversold' }, priority: 5, ask: { text: 'Server 3 and server 7 each took their own lock, and both sold F12. Where must the check-and-change live now?', choices: [
      { id: 'db', label: 'In the database all ten servers share, as one conditional write', reply: 'Yes: only the shared store sees every caller. Switch the write and run the same order again.', verdict: 'sound' },
      { id: 'sticky', label: 'Route every request for an event to the same server', reply: 'That can work (one owner per event), but you must handle that server failing and moving its events. It is a valid design with more moving parts.', verdict: 'partial' },
      { id: 'bigger', label: 'Use a bigger lock in each server', reply: 'Any lock that lives inside one process only coordinates that process.', verdict: 'risky' },
    ] }, gap: { text: 'Per-process locks let two servers sell F12 twice.', fix: 'Use a conditional write or a row lock in the shared database and rerun.', stage: 'servers', lesson: 'concurrency-lld' } },
  ],
  solution: {
    design: {
      comps: [
        { id: 'svc', type: 'booking-svc', kind: 'class', label: 'BookingService', x: 90, y: 200 },
        { id: 'inv', type: 'inventory', kind: 'class', label: 'SeatInventory', x: 320, y: 200 },
        { id: 'hold', type: 'hold', kind: 'class', label: 'Hold', x: 540, y: 120 },
        { id: 'state', type: 'state-enum', kind: 'enum', label: 'SeatState', x: 540, y: 290 },
        { id: 'pay', type: 'gateway', kind: 'iface', label: 'PaymentGateway', x: 320, y: 380 },
      ],
      links: [
        { id: 'svc-inv', from: 'svc', to: 'inv', label: 'uses' }, { id: 'inv-hold', from: 'inv', to: 'hold', label: 'has many' },
        { id: 'inv-state', from: 'inv', to: 'state', label: 'uses' }, { id: 'svc-pay', from: 'svc', to: 'pay', label: 'uses' },
      ],
    },
    why: {
      svc: 'Coordinates a request: charge, confirm, refund if confirm says no.',
      inv: 'Owns every seat and the lock; hold() and confirm() keep the invariants.',
      hold: 'A value: seat, buyer, expires_at. Expiry is a comparison with `now`.',
      state: 'Available / Held / Booked — the only states a seat can be in.',
      pay: 'An interface so tests use a fake and production uses the real provider.',
    },
    trace: { title: 'Ben pays for F12 at 10:15', steps: [
      { from: 'svc', to: 'pay', text: 'charge(order o-ben-F12) — succeeds.' },
      { from: 'svc', to: 'inv', text: 'confirm("F12", "ben", now): expire old holds, check Ben holds F12, move it to booked — all under the lock.' },
      { from: 'inv', to: 'hold', text: 'hold.buyer == "ben" and hold.expires_at > now → allowed.' },
      { from: 'inv', to: 'state', text: 'F12: Held → Booked.' },
    ] },
    tradeoff: 'A lock inside one object is simple and testable but only protects one process; across servers the database must make the same check atomically.',
    otherApproach: 'With many states and rules per state, the State pattern (one class per state) keeps each state’s allowed events together; for three states a small table is clearer.',
  },
};
