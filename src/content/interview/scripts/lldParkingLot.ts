import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';
import { py } from '../../lessons/_kit';

export const lldParkingLot: InterviewScript = {
  caseId: 'lld-parking-lot',
  track: 'lld',
  doLine: 'Draw the classes for a parking lot, give each job to one object, then handle two gates taking the last medium spot at once',
  skills: ['object-design', 'concurrency', 'data-modeling'],
  brief: {
    interviewer: { name: 'Dana', role: 'engineer who maintains the garage entry software' },
    intro: 'We run a small garage with three kinds of spots. I do not want servers or databases today. I want the objects: who knows what, and who decides where a car goes.',
    users: 'Drivers at the entry gates, and the gate software that calls your classes.',
    needs: ['Park a vehicle in the smallest free spot that fits it', 'Give the driver a ticket so the car can leave later', 'Free the spot when the car leaves'],
    mustHold: ['One vehicle per spot, and one spot per vehicle', 'A vehicle never gets a spot smaller than itself', 'A full lot hands out no ticket'],
    constraints: ['Spots are small, medium or large; a vehicle fits a spot of its size or larger', 'About 200 spots and two entry gates', 'Payment on exit is out of scope for version 1'],
    outOfScope: ['Pricing and payment', 'Reservations in advance', 'Cameras and number-plate reading'],
    terms: [
      { term: 'enum', meaning: 'a fixed list of named values, such as small, medium and large' },
      { term: 'invariant', meaning: 'a rule that is true before and after every method call, such as “one vehicle per spot”' },
      { term: 'responsibility', meaning: 'one job that exactly one class is in charge of' },
    ],
    firstMove: 'Start with the nouns. Put a ParkingLot, a Spot and a Size on the canvas and show me how they relate. Then we will follow one medium car through them.',
  },
  palette: [
    { type: 'lot', kind: 'class', name: 'ParkingLot', blurb: 'Owns every spot and the ticket records; has park() and leave().' },
    { type: 'spot', kind: 'class', name: 'Spot', blurb: 'One physical space: its id, its size and the vehicle in it, if any.' },
    { type: 'size', kind: 'enum', name: 'Size', blurb: 'Small, medium or large. Compares by value, so “fits” is a number check.' },
    { type: 'ticket', kind: 'class', name: 'Ticket', blurb: 'The record that a plate is in a spot. Version 1 keeps it as a dictionary, plate to spot.' },
    { type: 'gate', kind: 'class', name: 'EntryGate', blurb: 'Where drivers arrive; asks the lot to park and prints the ticket.' },
    { type: 'chooser', kind: 'iface', name: 'SpotChooser', blurb: 'A rule for ranking spots that fit, such as smallest first. Swappable later.' },
  ],
  verbs: ['has many', 'uses', 'creates', 'implements'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Pin down the rules before drawing any class.',
      question: 'Which rules decide where a car may park?',
      activity: { kind: 'clarify', questions: [
        { id: 'fit', q: 'Which spot can a medium car use?', a: 'A medium or a large one. A vehicle fits a spot of its own size or larger, never smaller.' },
        { id: 'prefer', q: 'If several spots fit, which one?', a: 'The smallest that fits, so large spots stay free for large vehicles.' },
        { id: 'full', q: 'What happens when nothing fits?', a: 'No ticket. The caller is told the lot is full for that size.' },
        { id: 'twice', q: 'Can the same plate park twice?', a: 'No. A plate that is already inside is rejected.' },
        { id: 'gates', q: 'How many callers at once?', a: 'Two entry gates, each a separate thread, calling the same lot object.' },
      ], assumptions: [
        { id: 'ticket-kind', q: 'How do we remember which plate is in which spot?', options: [
          { id: 'map', label: 'A dictionary in the lot: plate to spot', consequence: 'Leaving is one lookup. The lot is the single place that knows.' },
          { id: 'scan', label: 'Each spot stores its plate; leaving scans all spots', consequence: 'No extra structure, but leaving costs a scan and “one spot per plate” is harder to check.' },
        ] },
      ] },
      help: {
        hint: 'A medium car, a small spot free, a large spot free. Which spot, and why?',
        walkthrough: [{ text: 'Fit: a spot of the same size or larger.' }, { text: 'Choice: the smallest spot that fits.' }, { text: 'Full: no ticket.' }, { text: 'Same plate twice: reject.' }],
        solution: [{ type: 'list', items: ['Fits: spot size ≥ vehicle size.', 'Prefer the smallest fitting spot.', 'Full lot: no ticket.', 'A plate already parked is rejected.'] }],
        why: 'These rules become invariants the classes must keep; naming the classes comes second.',
      },
      lessons: ['requirements', 'contracts-invariants'],
    },
    {
      id: 'build', title: 'The classes', intro: 'Place the classes you need and label how they relate. Think nouns first, behaviour second.',
      question: 'Which classes and enum make up the lot, and which one has many of which?',
      activity: { kind: 'build', flavor: 'classes' },
      help: {
        hint: 'Which object can see every spot at once? Which thing has only a few fixed values?',
        walkthrough: [
          { text: 'ParkingLot is the whole: it has many Spots.', focus: ['lot', 'spot'] },
          { text: 'Size is a fixed set of values, so it is an enum that a Spot uses.', focus: ['size'] },
          { text: 'The lot also keeps the ticket records so it can find a car’s spot on exit.', focus: ['ticket'] },
        ],
        solution: [{ type: 'list', items: ['ParkingLot has many Spot.', 'Spot uses Size (enum).', 'ParkingLot keeps Ticket records, plate to spot.', 'EntryGate uses ParkingLot.'] }],
        why: 'Each noun in the brief has a home, and the lot is the only class that can see all spots.',
      },
      lessons: ['domain-objects', 'uml'],
    },
    {
      id: 'roles', title: 'Who does what', intro: 'Give each job to one object, then walk a medium car through them.',
      question: 'Which object decides the spot, and which one remembers the plate?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'lot', name: 'ParkingLot', blurb: 'All spots and all tickets; park() and leave().' },
          { id: 'spot', name: 'Spot', blurb: 'spot_id, size, vehicle' },
          { id: 'size', name: 'Size (enum)', blurb: 'SMALL, MEDIUM, LARGE' },
          { id: 'ticket', name: 'Ticket', blurb: 'plate to spot' },
        ],
        cards: [
          { id: 'pick', text: 'Choose which spot a medium car gets', owner: 'lot', why: 'Only the lot sees every spot, so only it can pick the smallest that fits.' },
          { id: 'fits', text: 'Say whether a large spot fits a medium car', owner: 'size', alt: ['spot'], why: 'Sizes compare by value. A Spot can ask its own size, but the comparison belongs to the enum.' },
          { id: 'occupant', text: 'Remember which plate sits in spot M2', owner: 'spot', alt: ['lot'], why: 'The spot is the thing that is occupied. The lot may mirror this in its ticket records.' },
          { id: 'record', text: 'Remember which spot a plate is in, for leaving', owner: 'ticket', alt: ['lot'], why: 'This is the ticket’s whole purpose; in version 1 the lot holds it as a dictionary.' },
          { id: 'atomic', text: 'Check a spot is free and take it in one step', owner: 'lot', why: 'The check and the change must not be split, and the lot owns the data and any lock.' },
          { id: 'reject', text: 'Reject a plate that is already parked', owner: 'lot', alt: ['ticket'], why: 'The lot sees every plate, so it enforces “one spot per vehicle”.' },
        ],
        walk: { title: 'A medium car arrives at gate A', steps: [
          { prompt: 'Who receives the arriving car’s request?', owner: 'lot', call: 'lot.park("KX-81", Size.MEDIUM)' },
          { prompt: 'Who compares sizes to find spots that fit?', owner: 'size', call: 'spot.size.value >= Size.MEDIUM.value' },
          { prompt: 'Whose data says the spot is free?', owner: 'spot', call: 'spot.vehicle is None' },
          { prompt: 'Who records plate KX-81 in spot M2 for the exit?', owner: 'ticket', call: 'tickets["KX-81"] = spot' },
        ] },
      },
      help: {
        hint: 'Which object needs to see all the spots to do this job?',
        walkthrough: [
          { text: 'Choosing needs every spot, so the lot chooses.', focus: ['lot'] },
          { text: 'A spot knows only itself and its occupant.', focus: ['spot'] },
          { text: 'The ticket record is what lets leave() find the spot without scanning.', focus: ['ticket'] },
        ],
        solution: [{ type: 'code', lang: 'python', code: py('sdm/cases/parking_lot.py', 'park'), caption: 'python/sdm/cases/parking_lot.py — tested with pytest' }, { type: 'p', text: 'park() rejects a repeat plate, filters to free spots that fit, takes the smallest and records the ticket, all in one method of the lot.' }],
        why: 'The lot owns the data that every decision needs, so each invariant is checked in one place.',
      },
      lessons: ['responsibilities', 'cohesion-coupling', 'domain-objects'],
    },
    {
      id: 'race', title: 'Two gates at once', intro: 'The interviewer changes one condition. Predict, run it, revise.',
      question: 'Gate A and gate B each receive a medium car while one medium spot is left. Can both cars get it?',
      change: { announce: 'New condition: both gates call park() on the same lot at the same moment, and only spot M2 is left.', rule: RULES.timeline },
      activity: {
        kind: 'timeline', names: ['Gate A', 'Gate B'], resource: 'Medium spots left (M2)', initial: 1,
        read: 'sees M2 is free', write: 'marks M2 occupied',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'Check, then mark (no protection)', detail: 'Each gate looks, then writes based on what it saw.', code: 'if spot.vehicle is None:\n    spot.vehicle = plate' },
          { id: 'conditional', label: 'Check and mark as one step', detail: 'The mark only succeeds if the spot is still free at that instant.', code: 'with self._lock:\n    if spot.vehicle is None:\n        spot.vehicle = plate' },
          { id: 'lock', label: 'One lock around the whole park()', detail: 'The second gate waits until the first has finished.', code: 'with self._lock:\n    return self._park(plate, size)' },
        ],
        predict: { q: 'With no protection, how many cars are told “spot M2”?', choices: [{ id: 'one', label: 'One' }, { id: 'both', label: 'Both' }, { id: 'none', label: 'Neither' }] },
      },
      help: {
        hint: 'Between “M2 is free” and “M2 is mine”, can the other gate sneak in?',
        walkthrough: [{ text: 'Both gates read “free” before either writes.', focus: ['gate', 'lot'] }, { text: 'Both then write, so two cars sit in one spot and the invariant breaks.', focus: ['spot'] }, { text: 'Make check and change one step inside the lot.', focus: ['lot'] }],
        solution: [{ type: 'p', text: 'Not with a guard: a lock inside the lot (or an atomic check-and-mark) makes the second gate see M2 taken and get “full” or another spot. Without one, both cars are told M2.' }],
        why: '“One vehicle per spot” has to hold for every caller, so the check and the change cannot be separate steps.',
      },
      lessons: ['concurrency-lld', 'concurrent-reservations'],
    },
  ],
  rules: [
    { id: 'pk-parts', stage: 'build', when: { all: [{ has: { type: 'lot' } }, { has: { type: 'spot' } }, { has: { type: 'size' } }] }, ack: 'You drew {type:lot}, {type:spot} and {type:size}: the whole, the part and the fixed values.' },
    { id: 'pk-coach-size', stage: 'build', when: { lacks: { type: 'size' } }, coach: 'A spot is small, medium or large and nothing else. Which kind of box holds a fixed set of names?' },
    { id: 'pk-coach-lot', stage: 'build', when: { lacks: { type: 'lot' } }, coach: 'Something has to see every spot to choose among them. Which class is that?' },
    { id: 'pk-owns', stage: 'build', when: { link: [{ type: 'lot' }, { type: 'spot' }], labels: ['has many'] }, strength: 'You made the lot own many spots, so it can see them all and pick the smallest fit.' },
    { id: 'pk-no-size', stage: 'build', when: { lacks: { type: 'size' } }, gap: { text: 'Sizes were not modelled as an enum, so “fits” has no clear definition.', fix: 'Add Size (small, medium, large) and compare by value.', stage: 'build', lesson: 'domain-objects' } },
    { id: 'pk-gate-spot', stage: 'build', when: { link: [{ type: 'gate' }, { type: 'spot' }] }, priority: 6, ask: { text: 'Your gate points straight at a spot. Gate A and gate B each ask a medium car’s spot from the same list. Who decides?', choices: [
      { id: 'lot', label: 'The lot: gates ask it to park, it picks', reply: 'Yes. One decider means one place to enforce the rules.', verdict: 'sound' },
      { id: 'gate', label: 'Each gate picks the first free spot itself', reply: 'Two gates can pick the same spot, and the smallest-fit rule lives in two places.', verdict: 'risky' },
      { id: 'share', label: 'Gates share a free-spot list', reply: 'That works if the list is the lot’s. It is then the lot under another name.', verdict: 'partial' },
    ] } },
    { id: 'pk-no-ticket', stage: 'build', when: { all: [{ has: { type: 'lot' } }, { lacks: { type: 'ticket' } }] }, priority: 5, ask: { text: 'You have no Ticket class. When KX-81 leaves, how does the lot find its spot?', choices: [
      { id: 'dict', label: 'A plate-to-spot dictionary inside the lot', reply: 'Yes. That is the version-1 design: no separate class needed, one lookup on exit.', verdict: 'sound' },
      { id: 'scan', label: 'Scan every spot for that plate', reply: 'Correct but slow, about 200 checks per exit, and a repeat plate is harder to detect.', verdict: 'partial' },
      { id: 'driver', label: 'Ask the driver which spot they used', reply: 'Drivers misremember. The lot must be the source of truth.', verdict: 'risky' },
    ] } },
    { id: 'pk-ticket-owner', stage: 'build', when: { has: { type: 'ticket' } }, priority: 4, ask: { text: 'You drew a Ticket class. Who creates it?', choices: [
      { id: 'lot', label: 'The lot, in the same step as taking the spot', reply: 'Yes: spot and ticket change together, so they cannot disagree.', verdict: 'sound' },
      { id: 'gate', label: 'The gate, after park() returns', reply: 'It works while nothing fails between the two calls. A crash there leaves a taken spot with no ticket.', verdict: 'partial' },
      { id: 'spot', label: 'The spot', reply: 'A spot does not know which plates are elsewhere, so it cannot reject a repeat plate.', verdict: 'risky' },
    ] } },
    { id: 'pk-rule-hidden', stage: 'build', when: { all: [{ has: { type: 'lot' } }, { has: { type: 'spot' } }] }, priority: 3, ask: { text: 'Your arrow says the lot has many spots. It does not say which one a medium car gets when a medium and a large are both free. What is the rule?', choices: [
      { id: 'smallest', label: 'Smallest that fits: the medium', reply: 'Yes. Large spots stay free for large vehicles.', verdict: 'sound' },
      { id: 'first', label: 'The first free spot in the list', reply: 'Simple, but a medium car can take the last large spot and a truck is then turned away.', verdict: 'partial' },
      { id: 'largest', label: 'The largest, for comfort', reply: 'That wastes large spots and fills the lot sooner for large vehicles.', verdict: 'risky' },
    ] } },
    { id: 'pk-chooser', stage: 'build', when: { has: { type: 'chooser' } }, ask: { text: 'You added a SpotChooser interface. That is a valid design. What does it cost for a lot with one rule?', choices: [
      { id: 'later', label: 'One more class now; pays off when rules such as charging spots arrive', reply: 'Right: extra indirection is worth it only when a second rule is likely.', verdict: 'sound' },
      { id: 'never', label: 'Nothing; always add interfaces', reply: 'Each interface adds a place to look. Add one when a second implementation is real.', verdict: 'partial' },
    ] } },
    { id: 'pk-roles-good', stage: 'roles', when: { result: 'roles', is: 'pass' }, ack: 'Each job sits with the object that owns its data.', strength: 'You gave allocation to the lot, occupancy to the spot and sizes to the enum, so each rule lives in one place.' },
    { id: 'pk-roles-gap', stage: 'roles', when: { result: 'roles', is: 'gaps' }, priority: 5, gap: { text: 'Some jobs were given to objects that cannot see the data they need.', fix: 'Reassign the cards marked “reconsider” and walk through the medium car again.', stage: 'roles', lesson: 'responsibilities' }, ask: { text: 'A single Spot knows only itself. Which job did you give it that needs to see other spots?', choices: [
      { id: 'lot', label: 'Choosing the best spot: move it to the lot', reply: 'Yes. Only the lot sees all spots.', verdict: 'sound' },
      { id: 'keep', label: 'Give each Spot a pointer to all other spots', reply: 'That makes every spot know the whole lot. Lots of coupling for no gain.', verdict: 'risky' },
    ] } },
    { id: 'pk-roles-alt', stage: 'roles', when: { result: 'roles', is: 'pass' }, priority: 2, ask: { text: 'You could also keep the plate only in the Spot and drop the ticket record. What would that cost?', choices: [
      { id: 'scan', label: 'Leaving needs a scan of all spots to find the plate', reply: 'Yes. Fine for 200 spots, a poor idea for 20,000.', verdict: 'sound' },
      { id: 'nothing', label: 'Nothing; it is strictly simpler', reply: 'It is fewer structures, but leaving and the repeat-plate check both need a scan.', verdict: 'partial' },
    ] } },
    { id: 'pk-race-one', stage: 'race', when: { result: 'race', is: 'one' }, ack: 'With the check and the mark as one step, only one gate’s car got M2.', strength: 'You made check-and-mark atomic, so two gates cannot share the last spot.', ask: { text: 'You protected park() with a lock. What must the lock cover?', choices: [
      { id: 'both', label: 'The check that the spot is free and the mark that it is taken, together', reply: 'Yes. A lock around only the mark still lets both gates check first.', verdict: 'sound' },
      { id: 'mark', label: 'Only the line that sets the vehicle', reply: 'Both gates already read “free”. The check has to be inside too.', verdict: 'risky' },
      { id: 'whole', label: 'The whole park() including the ticket write', reply: 'Also sound, and simplest. Keep it short, since every arrival waits on it.', verdict: 'sound' },
    ] } },
    { id: 'pk-race-over', stage: 'race', when: { result: 'race', is: 'oversold' }, priority: 5, ask: { text: 'Both gates read “M2 free” and both marked it. Two cars now share one spot. Where must the check live?', choices: [
      { id: 'atomic', label: 'Inside the lot, as one atomic check-and-mark', reply: 'Yes. Switch the guard and run the same order again.', verdict: 'sound' },
      { id: 'gates', label: 'In each gate, before calling the lot', reply: 'Each gate would still read before the other writes. The lot owns the data, so the lot protects it.', verdict: 'risky' },
      { id: 'one-gate', label: 'Only allow one gate to be busy at a time', reply: 'That works but serialises every arrival, even for different spots.', verdict: 'partial' },
    ] }, gap: { text: 'Two gates could be given the same last spot.', fix: 'Put the check and the change in one locked step inside ParkingLot.park() and rerun.', stage: 'race', lesson: 'concurrency-lld' } },
  ],
  solution: {
    design: {
      comps: [
        { id: 'gate', type: 'gate', kind: 'class', label: 'EntryGate', x: 60, y: 200 },
        { id: 'lot', type: 'lot', kind: 'class', label: 'ParkingLot', x: 270, y: 200 },
        { id: 'spot', type: 'spot', kind: 'class', label: 'Spot', x: 490, y: 110 },
        { id: 'size', type: 'size', kind: 'enum', label: 'Size', x: 490, y: 290 },
        { id: 'ticket', type: 'ticket', kind: 'class', label: 'Ticket records', x: 270, y: 370 },
      ],
      links: [
        { id: 'gate-lot', from: 'gate', to: 'lot', label: 'uses' }, { id: 'lot-spot', from: 'lot', to: 'spot', label: 'has many' },
        { id: 'spot-size', from: 'spot', to: 'size', label: 'uses' }, { id: 'lot-ticket', from: 'lot', to: 'ticket', label: 'creates' },
      ],
    },
    why: {
      gate: 'Where cars arrive. It asks the lot to park and prints the ticket; it decides nothing.',
      lot: 'Owns all spots and tickets. park() picks the smallest fit, rejects a repeat plate and changes state under one lock.',
      spot: 'One space: id, size and the vehicle in it.',
      size: 'Small, medium, large. Comparing by value makes “fits” a one-line check.',
      ticket: 'Plate to spot, so leave() is one lookup. A dictionary in the lot is enough for version 1.',
    },
    alternatives: { ticket: { types: ['spot'], tradeoff: 'Storing the plate only in the spot removes a structure, but leaving and the repeat-plate check then scan every spot.' } },
    trace: { title: 'A medium car arrives at gate A', steps: [
      { from: 'gate', to: 'lot', text: 'park("KX-81", Size.MEDIUM) — the gate asks the lot.' },
      { from: 'lot', to: 'spot', text: 'Under the lock: keep spots that are free and fit, take the smallest (M2), set its vehicle.' },
      { from: 'spot', to: 'size', text: 'Fit check: spot.size.value >= MEDIUM.value.' },
      { from: 'lot', to: 'ticket', text: 'tickets["KX-81"] = M2; the gate prints the ticket.' },
    ] },
    tradeoff: 'One lot object that decides everything is simple and easy to test, but it is a single point where all arrivals queue; that is fine for 200 spots and two gates.',
    otherApproach: 'With many lots, levels or pricing rules, split spot selection into a SpotChooser and keep per-level lots; for one lot a single class is clearer.',
  },
};
