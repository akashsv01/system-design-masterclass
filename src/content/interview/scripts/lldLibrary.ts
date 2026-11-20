import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';
import { py } from '../../lessons/_kit';

const st = (states: [string, string, number, number][], trans: [string, string, string][]) => ({
  comps: states.map(([id, label, x, y]) => ({ id, type: id, kind: 'state' as const, label, x, y })),
  links: trans.map(([from, to, label]) => ({ id: `${from}-${to}-${label}`, from, to, label })),
});

const DAY = 1440;

export const lldLibrary: InterviewScript = {
  caseId: 'lld-library',
  track: 'lld',
  doLine: 'Model books, copies and members, assign each job to an object, add a three-day reservation hold on a timer, then handle two members reserving the last copy',
  skills: ['object-design', 'state-machines', 'concurrency'],
  brief: {
    interviewer: { name: 'Grace', role: 'developer for a city library network' },
    intro: 'Our catalogue software is a pile of scripts. I want a clean core model for lending: who owns what rule, and what states a physical book goes through.',
    users: 'Librarians at the desk and members using the self-service kiosk; both call the same code.',
    needs: ['Borrow a book, limited per member', 'Return a book so the next person can have it', 'Reserve a book that has no free copy'],
    mustHold: ['A copy has at most one borrower', 'A member never has more than 3 loans', 'A reserved copy is not lent to anyone but the reserver while it is held'],
    constraints: ['A title (ISBN) has several physical copies', 'A returned copy is held for the first reserver for 3 days, then released', 'About 50,000 members; at most a few requests per second at one branch', 'Time reaches your code as events, so tests can control the clock'],
    outOfScope: ['Fines and late fees', 'Search and catalogue metadata', 'Inter-branch transfers'],
    terms: [
      { term: 'copy', meaning: 'one physical book; a title with five copies has five of these' },
      { term: 'reservation', meaning: 'a place in the queue for a title that has no free copy' },
      { term: 'hold', meaning: 'a returned copy set aside for the first reserver for a limited time' },
    ],
    firstMove: 'Start with the nouns. Show me a Library, a Copy and a Member and how they relate, then walk me through a member borrowing one book.',
  },
  palette: [
    { type: 'library', kind: 'class', name: 'Library', blurb: 'Coordinates lending: finds a copy, checks the limit, records the loan.' },
    { type: 'copy', kind: 'class', name: 'Copy', blurb: 'One physical book: copy id, ISBN, and who has it.' },
    { type: 'member', kind: 'class', name: 'Member', blurb: 'A person: their current loans and their limit.' },
    { type: 'reservation', kind: 'class', name: 'Reservation', blurb: 'A member’s place in the queue for a title.' },
    { type: 'copy-state', kind: 'enum', name: 'CopyState', blurb: 'Available, borrowed, held for a reserver.' },
    { type: 'notifier', kind: 'iface', name: 'Notifier', blurb: 'Tells a member their copy is ready; email in production, a fake in tests.' },
  ],
  verbs: ['has many', 'uses', 'creates', 'notifies'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Pin down books versus copies and the lending rules.',
      question: 'Which rules would you confirm before drawing any class?',
      activity: { kind: 'clarify', questions: [
        { id: 'copies', q: 'Is a book one thing or many?', a: 'A title has several physical copies. Availability is per copy; search and details are per title.' },
        { id: 'limit', q: 'How many loans can a member have?', a: 'Three. A fourth is refused.' },
        { id: 'none', q: 'What if no copy is free?', a: 'Borrowing fails. The member may reserve instead and join a queue for that title.' },
        { id: 'hold', q: 'What happens to a returned copy that someone reserved?', a: 'It is held for the first reserver for 3 days. If they do not collect it, it is released.' },
        { id: 'threads', q: 'Can two people act on the same title at once?', a: 'Yes. A desk and a kiosk can both be calling the library.' },
      ], assumptions: [
        { id: 'release', q: 'How is an unclaimed hold released after 3 days?', options: [
          { id: 'timer', label: 'A timer event releases it', consequence: 'The copy is a state machine with one timed transition; tests control the clock.' },
          { id: 'lazy', label: 'Check the age of the hold the next time someone asks for the copy', consequence: 'No timer, but the copy looks held until someone looks, and the next reserver is not told.' },
        ] },
      ] },
      help: {
        hint: 'A title has five copies and three are out. Is the title available?',
        walkthrough: [{ text: 'A copy is borrowed or not, independently of its siblings.' }, { text: 'A member has a limit of three.' }, { text: 'Reserved returns are held, then released.' }],
        solution: [{ type: 'list', items: ['Availability is per copy.', 'Loan limit: 3 per member.', 'A returned copy goes to the first reserver for 3 days.', 'Unclaimed holds are released.'] }],
        why: 'Entities (copies, members) and values (ISBN) fall out of these rules, and each rule becomes an invariant.',
      },
      lessons: ['requirements', 'domain-objects'],
    },
    {
      id: 'roles', title: 'Who does what', intro: 'Give each job to one object, then walk a member borrowing a book.',
      question: 'Who checks the loan limit, and who remembers who has the copy?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'library', name: 'Library', blurb: 'All copies and members; borrow() and give_back().' },
          { id: 'copy', name: 'Copy', blurb: 'copy_id, isbn, borrower' },
          { id: 'member', name: 'Member', blurb: 'member_id, loans, max_loans' },
          { id: 'reservation', name: 'Reservation', blurb: 'member, isbn, queue position' },
        ],
        cards: [
          { id: 'find', text: 'Find a free copy of “Dune”', owner: 'library', why: 'Only the library sees all copies of a title.' },
          { id: 'limit', text: 'Refuse a fourth loan', owner: 'library', alt: ['member'], why: 'The library coordinates the check. Member may also expose a can_borrow() it reads.' },
          { id: 'who', text: 'Remember who has copy 17', owner: 'copy', why: 'The copy is the thing that is borrowed, so it knows its borrower.' },
          { id: 'loans', text: 'Remember which copies Ana has', owner: 'member', why: 'The member’s loans are the member’s state.' },
          { id: 'queue', text: 'Remember who is waiting for “Dune”', owner: 'reservation', alt: ['library'], why: 'A Reservation is that fact; the library keeps the queue of them.' },
          { id: 'atomic', text: 'Check a copy is free and mark it borrowed in one step', owner: 'library', why: 'The check and the change must not be split, and the library owns the data and any lock.' },
        ],
        walk: { title: 'Ana borrows “Dune”', steps: [
          { prompt: 'Who receives the request?', owner: 'library', call: 'library.borrow("ana", "dune")' },
          { prompt: 'Whose data says Ana has fewer than 3 loans?', owner: 'member', call: 'len(member.loans) >= member.max_loans' },
          { prompt: 'Who picks a copy with no borrower?', owner: 'library', call: 'next(c for c in copies if c.isbn == "dune" and c.borrower is None)' },
          { prompt: 'Whose field records that Ana has it?', owner: 'copy', call: 'copy.borrower = "ana"' },
        ] },
      },
      help: {
        hint: 'Which object has to see all the copies to answer this?',
        walkthrough: [
          { text: 'Library sees every copy and every member, so it coordinates.', focus: ['lib'] },
          { text: 'Copy knows its borrower; Member knows its loans.', focus: ['copy', 'member'] },
          { text: 'Both change together in one step inside the library.', focus: ['lib'] },
        ],
        solution: [{ type: 'code', lang: 'python', code: py('sdm/cases/library.py', 'borrow'), caption: 'python/sdm/cases/library.py — tested with pytest' }, { type: 'p', text: 'borrow() enforces the loan limit and the “at most one borrower” rule, and raises when nothing is free.' }],
        why: 'Each fact lives with the object it describes, and the library enforces rules that span several of them.',
      },
      lessons: ['responsibilities', 'cohesion-coupling', 'domain-objects'],
    },
    {
      id: 'states', title: 'A copy’s states', intro: 'Place the states, name each arrow with its event, then replay the week. One tick is one minute, so a day is 1,440.',
      question: 'Draw a copy’s states and events. What happens to the copy Ben never came to collect?',
      activity: {
        kind: 'states', entity: 'Copy 17 of “Dune”', initial: 'available',
        states: [
          { key: 'available', label: 'Available', blurb: 'On the shelf; anyone can borrow it.' },
          { key: 'borrowed', label: 'Borrowed', blurb: 'With one member.' },
          { key: 'held', label: 'Held', blurb: 'Returned and set aside for the first reserver.' },
        ],
        events: [{ id: 'borrow', label: 'borrow' }, { id: 'return', label: 'return' }, { id: 'return-reserved', label: 'return (someone waiting)' }, { id: 'collect', label: 'collect (reserver)' }, { id: 'release', label: 'release (3 days)' }],
        timer: { event: 'release', after: 3 * DAY },
        scenario: [
          { at: 0, event: 'borrow', label: 'Monday 09:00: Ana borrows the copy', expect: 'borrowed' },
          { at: DAY, event: 'return-reserved', label: 'Tuesday 09:00: Ana returns it; Ben is first in the queue', expect: 'held' },
          { at: DAY + 600, event: 'borrow', label: 'Tuesday 19:00: Cy asks to borrow the held copy', expect: 'held' },
          { at: 5 * DAY, event: 'borrow', label: 'Saturday 09:00: Cy asks again; Ben never came', expect: 'borrowed' },
        ],
        starter: st([['available', 'Available', 90, 220], ['borrowed', 'Borrowed', 320, 220]], [['available', 'borrowed', 'borrow']]),
      },
      help: {
        hint: 'On Tuesday evening the copy is on the shelf but Cy must not get it. On Saturday he may. What changed it?',
        walkthrough: [
          { text: 'Monday: Available → Borrowed on “borrow”.', focus: ['cs'] },
          { text: 'Tuesday: Borrowed → Held on “return (someone waiting)”. There is no arrow from Held on “borrow”, so Cy is refused.', focus: ['cs', 'copy'] },
          { text: 'Three days after Held began, nobody has acted, but the timer fires: Held → Available on “release”.', focus: ['cs'] },
          { text: 'Saturday: Cy’s borrow works from Available.', focus: ['cs'] },
        ],
        solution: [
          { type: 'table', head: ['From', 'Event', 'To'], rows: [['Available', 'borrow', 'Borrowed'], ['Borrowed', 'return', 'Available'], ['Borrowed', 'return (someone waiting)', 'Held'], ['Held', 'collect (reserver only)', 'Borrowed'], ['Held', 'release (3 days)', 'Available']] },
          { type: 'p', text: 'Without the release arrow the copy stays held forever and nobody else can borrow it.' },
        ],
        why: 'The 3-day hold only exists in the design if a timed transition frees the copy.',
      },
      lessons: ['state-machines', 'pattern-state'],
    },
    {
      id: 'reserve', title: 'Two reservations at once', intro: 'The interviewer changes one condition. Predict, run it, revise.',
      question: 'Ana and Ben both press Reserve on the last free copy of “Dune” at the same moment. Can both be given it?',
      change: { announce: 'New condition: the desk and the kiosk both call the library at the same moment. One copy of “Dune” is left, and Ana and Ben each press Reserve.', rule: RULES.timeline },
      activity: {
        kind: 'timeline', names: ['Ana (desk)', 'Ben (kiosk)'], resource: 'Copies of “Dune” left to reserve', initial: 1,
        read: 'sees the copy is free', write: 'sets it aside for them',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'Check, then set aside (no protection)', detail: 'Each request looks, then writes based on what it saw.', code: 'if copy.state == AVAILABLE:\n    copy.hold_for(member)' },
          { id: 'conditional', label: 'Check and set aside as one locked step', detail: 'The hold succeeds only if the copy is still available at that instant.', code: 'with self._lock:\n    if copy.state == AVAILABLE:\n        copy.hold_for(member)' },
          { id: 'lock', label: 'One lock around the whole reserve()', detail: 'The second request waits until the first has finished.', code: 'with self._lock:\n    return self._reserve(member, isbn)' },
        ],
        predict: { q: 'With no protection, how many members are told the copy is theirs?', choices: [{ id: 'one', label: 'One' }, { id: 'both', label: 'Both' }, { id: 'none', label: 'Neither' }] },
      },
      help: {
        hint: 'Between “the copy is free” and “the copy is held for me”, can the other request slip in?',
        walkthrough: [
          { text: 'Both read “available” before either writes.', focus: ['lib'] },
          { text: 'Both write, so the copy is promised to two members and one will be refused at the desk.', focus: ['copy'] },
          { text: 'Make the check and the change one step inside the library.', focus: ['lib'] },
        ],
        solution: [{ type: 'p', text: 'No, once the check and the change are one locked step inside the library: the second member gets “no copy free” and joins the queue. Without it, both are told the copy is theirs.' }],
        why: '“A copy has at most one holder” has to hold for every caller, so the check and the change cannot be separate steps.',
      },
      lessons: ['concurrency-lld', 'concurrent-reservations', 'locking-mvcc'],
    },
  ],
  rules: [
    { id: 'lib-roles-good', stage: 'roles', when: { result: 'roles', is: 'pass' }, ack: 'The library coordinates; copies and members keep their own facts.', strength: 'You kept the borrower on the copy, the loans on the member and the cross-object checks in the library.' },
    { id: 'lib-roles-gap', stage: 'roles', when: { result: 'roles', is: 'gaps' }, priority: 5, ask: { text: 'Some job needs to see all copies of a title, and you gave it to a single Copy or Member. Where does it belong?', choices: [
      { id: 'library', label: 'In Library, which owns all copies', reply: 'Yes. Only the library can find a free copy among several.', verdict: 'sound' },
      { id: 'copy', label: 'Each Copy asks its siblings', reply: 'That couples every copy to every other copy for no benefit.', verdict: 'risky' },
    ] }, gap: { text: 'A job that needs every copy was given to one copy or one member.', fix: 'Reassign the cards marked “reconsider” and walk through Ana’s borrow again.', stage: 'roles', lesson: 'responsibilities' } },
    { id: 'lib-roles-alt', stage: 'roles', when: { result: 'roles', is: 'pass' }, priority: 3, ask: { text: 'You could track availability on the title instead of on each copy. What would break?', choices: [
      { id: 'copies', label: 'Three of five copies can be out, so one yes/no per title cannot say who has which', reply: 'Yes. Availability and borrowers are per copy.', verdict: 'sound' },
      { id: 'nothing', label: 'Nothing; a count per title is enough', reply: 'A count can say “2 left”, but not who must return which copy or which is held.', verdict: 'partial' },
    ] } },
    { id: 'lib-states-stuck', stage: 'states', when: { result: 'states', is: 'stuck' }, priority: 6, ask: { text: 'On Saturday the copy was still Held for Ben, who never came. How does it get back on the shelf?', choices: [
      { id: 'timer', label: 'Held → Available on a timed “release” after 3 days', reply: 'Yes. Draw it and replay.', verdict: 'sound' },
      { id: 'cy', label: 'Cy may take it if he asks late enough', reply: 'That is the lazy check: it works, but only when someone asks, and the next reserver is not told.', verdict: 'partial' },
      { id: 'forever', label: 'Ben’s hold stays until he comes', reply: 'The copy is lost to everyone else until then.', verdict: 'risky' },
    ] }, gap: { text: 'An unclaimed hold never ended, so the copy stayed off the shelf.', fix: 'Add Held → Available on a timed “release” and replay.', stage: 'states', lesson: 'state-machines' } },
    { id: 'lib-states-ok', stage: 'states', when: { result: 'states', is: 'pass' }, ack: 'Your copy refused Cy while held and released itself after three days.', strength: 'You gave the copy a Held state with a timed release, so a reserved copy is protected and then freed automatically.' },
    { id: 'lib-hold-collect', stage: 'states', when: { result: 'states', is: 'pass' }, priority: 5, ask: { text: 'Ben arrives on Wednesday. Your diagram has one arrow Held → Borrowed. The arrow alone does not say whose copy it is. What stops Cy using it?', choices: [
      { id: 'guard', label: 'A guard: only the member the copy is held for may collect', reply: 'Yes. The event needs a check on who is acting.', verdict: 'sound' },
      { id: 'trust', label: 'The desk will notice', reply: 'Rules enforced by people get forgotten. Put the guard in the copy.', verdict: 'risky' },
      { id: 'two', label: 'Make a separate state per reserver', reply: 'That multiplies states. Store the reserver in a field and guard on it.', verdict: 'partial' },
    ] } },
    { id: 'lib-guard-strength', when: { answer: 'lib-hold-collect', is: 'guard' }, strength: 'You added the guard “only the reserver may collect”, so a held copy cannot be taken by someone else.' },
    { id: 'lib-reserve-one', stage: 'reserve', when: { result: 'reserve', is: 'one' }, ack: 'With the check and the change as one step, only one member got the copy.', strength: 'You made reserving atomic, so the last copy goes to one member and the other joins the queue.' },
    { id: 'lib-reserve-over', stage: 'reserve', when: { result: 'reserve', is: 'oversold' }, priority: 5, ask: { text: 'Both requests saw the copy free and both set it aside. Where must the check and the change happen?', choices: [
      { id: 'library', label: 'Inside the library, as one locked step', reply: 'Yes. Switch the guard and run the same order again.', verdict: 'sound' },
      { id: 'member', label: 'Each member object checks first', reply: 'Members cannot see each other’s requests, so both still read “free”.', verdict: 'risky' },
      { id: 'queue', label: 'Put every request through one queue and handle them one at a time', reply: 'That works and avoids locks. Latency is the price, which is fine for a few requests a second.', verdict: 'partial' },
    ] }, gap: { text: 'Two members could both be promised the last copy.', fix: 'Make check-and-hold one locked step in Library and rerun the same order.', stage: 'reserve', lesson: 'concurrency-lld' } },
    { id: 'lib-lock-scope', stage: 'reserve', when: { result: 'reserve', is: 'one' }, priority: 3, ask: { text: 'One lock for the whole library is simplest. When would you want locks per title instead?', choices: [
      { id: 'busy', label: 'When many threads work on different titles and wait for each other', reply: 'Yes. For a few requests per second one lock is fine.', verdict: 'sound' },
      { id: 'always', label: 'Always, for safety', reply: 'More locks mean more chances for deadlock. Add them when contention shows up.', verdict: 'partial' },
    ] } },
  ],
  solution: {
    design: {
      comps: [
        { id: 'lib', type: 'library', kind: 'class', label: 'Library', x: 250, y: 200 },
        { id: 'member', type: 'member', kind: 'class', label: 'Member', x: 60, y: 100 },
        { id: 'copy', type: 'copy', kind: 'class', label: 'Copy', x: 470, y: 100 },
        { id: 'cs', type: 'copy-state', kind: 'enum', label: 'CopyState', x: 520, y: 300 },
        { id: 'res', type: 'reservation', kind: 'class', label: 'Reservation', x: 60, y: 320 },
        { id: 'note', type: 'notifier', kind: 'iface', label: 'Notifier', x: 270, y: 380 },
      ],
      links: [
        { id: 'lib-member', from: 'lib', to: 'member', label: 'has many' }, { id: 'lib-copy', from: 'lib', to: 'copy', label: 'has many' },
        { id: 'copy-cs', from: 'copy', to: 'cs', label: 'uses' }, { id: 'lib-res', from: 'lib', to: 'res', label: 'has many' }, { id: 'lib-note', from: 'lib', to: 'note', label: 'notifies' },
      ],
    },
    why: {
      lib: 'Coordinates lending: finds a free copy, enforces the limit, owns the lock and the reservation queues.',
      member: 'A person and their current loans; max_loans is 3.',
      copy: 'One physical book: id, ISBN and borrower. A small state machine: available, borrowed, held.',
      cs: 'Available, borrowed, held. The timed “release” is the only way a hold ends without a collect.',
      res: 'One member’s place in the queue for a title; the first is offered the next returned copy.',
      note: 'Tells the first reserver their copy is ready; a fake in tests.',
    },
    alternatives: { note: { types: ['library'], tradeoff: 'Calling the notifier directly from Library is simpler, but tests then need real email unless a fake is injected.' } },
    trace: { title: 'Ana returns “Dune” and Ben is first in the queue', steps: [
      { from: 'lib', to: 'copy', text: 'give_back("17"): clear Ana’s loan and the copy’s borrower.' },
      { from: 'lib', to: 'res', text: 'Is anyone waiting for “Dune”? Yes: Ben is first.' },
      { from: 'copy', to: 'cs', text: 'The copy moves Borrowed → Held for Ben; a 3-day timer starts.' },
      { from: 'lib', to: 'note', text: 'Ben is told his copy is ready.' },
    ] },
    tradeoff: 'Putting the check-and-change inside one Library object under a lock is simple and correct for one process; several servers would need the database to do it.',
    otherApproach: 'With many holds and different rules per state, the State pattern gives each copy state its own class; with three states a small table is clearer.',
  },
};
