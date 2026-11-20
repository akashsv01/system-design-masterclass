import type { InterviewScript } from '../types';
import { py } from '../../lessons/_kit';

const st = (states: [string, string, number, number][], trans: [string, string, string][]) => ({
  comps: states.map(([id, label, x, y]) => ({ id, type: id, kind: 'state' as const, label, x, y })),
  links: trans.map(([from, to, label]) => ({ id: `${from}-${to}-${label}`, from, to, label })),
});

export const lldElevator: InterviewScript = {
  caseId: 'lld-elevator',
  track: 'lld',
  doLine: 'Draw the states of one elevator car with a door timer, assign each job to an object, then add two more cars and decide who takes a hall call',
  skills: ['state-machines', 'object-design', 'concurrency'],
  brief: {
    interviewer: { name: 'Priya', role: 'engineer on the building-controls team' },
    intro: 'We are writing the controller for a ten-floor office building. The motors and buttons are someone else’s problem. I want the logic: what the car is doing at any moment and who decides where it goes.',
    users: 'People in the building pressing buttons, and the hardware layer that calls your classes when something happens.',
    needs: ['Take a request for a floor from a button inside the car', 'Take a call from a button in the hallway', 'Serve requests without leaving any floor waiting forever'],
    mustHold: ['The car is in exactly one state at a time', 'Doors are never open while the car moves', 'A request for a floor that does not exist is refused'],
    constraints: ['Floors 0 to 9', 'Doors stay open for a few seconds, then close on their own', 'Requests can arrive at any moment, including while doors are open', 'Time reaches your code as events, so tests can control the clock'],
    outOfScope: ['Motor control and sensors', 'Overload weight and emergency stop', 'Express and service lifts'],
    terms: [
      { term: 'hall call', meaning: 'a button press in the hallway: a floor and a wish to go up or down' },
      { term: 'SCAN', meaning: 'keep going in one direction while requests remain ahead, then reverse, like a lift sweeping the building' },
      { term: 'timer event', meaning: 'a transition that fires by itself a set time after entering a state' },
    ],
    firstMove: 'Start with the car. Draw its states, such as waiting, moving and doors open, and the events between them. Then replay a short morning and show me what happens when the doors have been open for a few seconds.',
  },
  palette: [
    { type: 'elevator', kind: 'class', name: 'Elevator', blurb: 'One car: its floor, direction, pending stops and state.' },
    { type: 'dispatcher', kind: 'class', name: 'Dispatcher', blurb: 'Decides which car answers a hall call when there is more than one.' },
    { type: 'hallcall', kind: 'class', name: 'HallCall', blurb: 'A request from a hallway: floor and wanted direction.' },
    { type: 'direction', kind: 'enum', name: 'Direction', blurb: 'Up, down or idle.' },
    { type: 'carstate', kind: 'enum', name: 'CarState', blurb: 'Idle, moving up, moving down, doors open.' },
    { type: 'policy', kind: 'iface', name: 'StopPolicy', blurb: 'A rule for picking the next stop, such as SCAN. Swappable.' },
  ],
  verbs: ['uses', 'has many', 'creates', 'implements'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Pin down fairness and timing before the states.',
      question: 'What would you confirm before drawing the car’s states?',
      activity: { kind: 'clarify', questions: [
        { id: 'order', q: 'Should the car always go to the nearest request?', a: 'No. Nearest-first can bounce between two busy floors and leave a distant floor waiting. Keep going one way, then reverse.' },
        { id: 'doors', q: 'How long do doors stay open?', a: 'A few seconds, then they close by themselves. A new request while open does not reopen them.' },
        { id: 'range', q: 'What if someone requests floor 14?', a: 'Refuse it. Floors are 0 to 9.' },
        { id: 'cars', q: 'How many cars?', a: 'One for now. Design so that more can be added later.' },
        { id: 'clock', q: 'Where does time come from?', a: 'The hardware layer sends events, including “doors have been open long enough”. Your code never sleeps.' },
      ], assumptions: [
        { id: 'door-timer', q: 'How do doors close?', options: [
          { id: 'timer', label: 'A timer event fires a few seconds after they open', consequence: 'The car is a state machine with one timed transition; tests control the clock.' },
          { id: 'sleep', label: 'The car code sleeps for a few seconds, then closes them', consequence: 'Simple, but the car cannot react to a request or be tested without waiting.' },
        ] },
      ] },
      help: {
        hint: 'A distant floor, and two near floors that keep calling. Who is served?',
        walkthrough: [{ text: 'Nearest-first starves the distant floor.' }, { text: 'Sweeping in one direction bounds every wait.' }, { text: 'Doors close on a timer, not a sleep.' }],
        solution: [{ type: 'list', items: ['SCAN: continue ahead, then reverse.', 'Doors close by a timer event.', 'Refuse floors outside 0 to 9.', 'One car now, more later.'] }],
        why: 'Fairness and the timer decide the states and the events; the classes follow from them.',
      },
      lessons: ['requirements', 'state-machines'],
    },
    {
      id: 'states', title: 'The car’s states', intro: 'Place the states, name each arrow with its event, then replay the morning. The clock runs in ticks; one tick stands for the few seconds the doors stay open.',
      question: 'Draw the car’s states and events. Ana presses 5 at floor 0; what happens after the doors open?',
      activity: {
        kind: 'states', entity: 'The car', initial: 'idle',
        states: [
          { key: 'idle', label: 'Idle', blurb: 'Stopped, doors closed, nothing pending.' },
          { key: 'up', label: 'Moving up', blurb: 'Travelling to a floor above, doors closed.' },
          { key: 'down', label: 'Moving down', blurb: 'Travelling to a floor below, doors closed.' },
          { key: 'open', label: 'Doors open', blurb: 'Stopped at a floor, people getting in or out.' },
        ],
        events: [{ id: 'go-up', label: 'go up' }, { id: 'go-down', label: 'go down' }, { id: 'arrive', label: 'arrive' }, { id: 'close', label: 'close (1 tick)' }],
        timer: { event: 'close', after: 1 },
        scenario: [
          { at: 0, event: 'go-up', label: 'Tick 0: Ana presses 5 at floor 0', expect: 'up' },
          { at: 3, event: 'arrive', label: 'Tick 3: the car reaches floor 5', expect: 'open' },
          { at: 4, event: 'go-down', label: 'Tick 4: Ben presses 2 inside', expect: 'down' },
          { at: 7, event: 'arrive', label: 'Tick 7: the car reaches floor 2', expect: 'open' },
        ],
        starter: st([['idle', 'Idle', 90, 220], ['up', 'Moving up', 320, 120]], [['idle', 'up', 'go-up']]),
      },
      help: {
        hint: 'At tick 4 the doors have been open one tick. Which arrow lets Ben’s request start the car?',
        walkthrough: [
          { text: 'Tick 0: Idle → Moving up on “go up”.', focus: ['car'] },
          { text: 'Tick 3: Moving up → Doors open on “arrive”.', focus: ['car', 'dir'] },
          { text: 'Tick 4: the timer fired one tick after the doors opened: Doors open → Idle on “close”.', focus: ['car'] },
          { text: 'Then Ben’s “go down” moves Idle → Moving down. There is no arrow from Doors open straight to moving.', focus: ['car'] },
        ],
        solution: [
          { type: 'table', head: ['From', 'Event', 'To'], rows: [['Idle', 'go up / go down', 'Moving up / down'], ['Moving up or down', 'arrive', 'Doors open'], ['Doors open', 'close (timer)', 'Idle']] },
          { type: 'p', text: 'Doors open can only be left through the timer, so doors are never open while the car moves.' },
        ],
        why: 'The “doors never open while moving” rule is enforced because only “close” leaves the open state.',
      },
      lessons: ['state-machines', 'pattern-state'],
    },
    {
      id: 'roles', title: 'Who does what', intro: 'Give each job to one object, then follow a press of the button inside the car.',
      question: 'Which object keeps the pending stops, and which one refuses floor 14?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'elevator', name: 'Elevator', blurb: 'floor, direction, stops; request() and next_stop()' },
          { id: 'panel', name: 'ButtonPanel', blurb: 'Reports which button was pressed.' },
          { id: 'direction', name: 'Direction (enum)', blurb: 'UP, DOWN' },
          { id: 'policy', name: 'StopPolicy', blurb: 'The rule that picks the next stop.' },
        ],
        cards: [
          { id: 'press', text: 'Report that “5” was pressed inside the car', owner: 'panel', why: 'It is the hardware edge. It reports, and decides nothing.' },
          { id: 'valid', text: 'Refuse floor 14 because the building has 10 floors', owner: 'elevator', why: 'The car knows its floor count, so it protects its own invariant.' },
          { id: 'pending', text: 'Remember which floors still need a visit', owner: 'elevator', why: 'The pending stops are the car’s state.' },
          { id: 'order', text: 'Pick the next stop: keep going ahead, then reverse', owner: 'policy', alt: ['elevator'], why: 'A StopPolicy lets the rule change; in version 1 it can sit inside Elevator.next_stop().' },
          { id: 'turn', text: 'Reverse direction when nothing is ahead', owner: 'elevator', alt: ['policy'], why: 'Direction is the car’s state; the policy may decide when to flip it.' },
        ],
        walk: { title: 'Ana presses 5 inside the car at floor 0', steps: [
          { prompt: 'Who reports the button press?', owner: 'panel', call: 'car.request(5)' },
          { prompt: 'Who checks 5 is a real floor and adds it?', owner: 'elevator', call: 'if not 0 <= floor < self.floors: raise ValueError' },
          { prompt: 'Who chooses which stop is next?', owner: 'policy', call: 'ahead = [f for f in stops if (f - floor) * direction >= 0]' },
        ] },
      },
      help: {
        hint: 'Which object holds the data each job needs?',
        walkthrough: [
          { text: 'The Elevator holds floor, direction and stops, so it validates and orders them.', focus: ['car'] },
          { text: 'Direction is a value the Elevator keeps, with only two options.', focus: ['dir'] },
        ],
        solution: [{ type: 'code', lang: 'python', code: py('sdm/cases/elevator.py', 'next_stop'), caption: 'python/sdm/cases/elevator.py — tested with pytest' }, { type: 'p', text: 'It keeps going while requests lie ahead, reverses when none do, and serves the nearest stop in that direction.' }],
        why: 'The car owns its stops and direction, so invalid floors and unfair ordering are handled in one place.',
      },
      lessons: ['responsibilities', 'cohesion-coupling'],
    },
    {
      id: 'cars', title: 'Three cars', intro: 'The interviewer changes one condition. Decide who owns the new job.',
      question: 'With three cars, who decides which car answers a hall call at floor 6?',
      change: { announce: 'New condition: the building now has three cars. Someone presses “down” at floor 6, and all three cars could answer.', rule: 'Each car still sweeps its own stops. Something new must pick one car per hall call, and that choice must not send two cars to one call.' },
      activity: {
        kind: 'roles',
        classes: [
          { id: 'elevator', name: 'Elevator', blurb: 'One car with its own stops and SCAN order.' },
          { id: 'dispatcher', name: 'Dispatcher', blurb: 'Receives hall calls and picks a car.' },
          { id: 'hallcall', name: 'HallCall', blurb: 'floor, direction' },
          { id: 'panel', name: 'ButtonPanel', blurb: 'Reports hallway presses.' },
        ],
        cards: [
          { id: 'assign', text: 'Choose which car answers the hall call at floor 6', owner: 'dispatcher', why: 'It is the only object that sees all three cars.' },
          { id: 'eta', text: 'Say how long this car would take to reach floor 6', owner: 'elevator', alt: ['dispatcher'], why: 'The car knows its floor, direction and stops. The dispatcher asks each car instead of reading its internals.' },
          { id: 'once', text: 'Make sure one hall call is given to exactly one car', owner: 'dispatcher', why: 'Assignments are made one at a time in one place.' },
          { id: 'sweep', text: 'Order the stops for one car', owner: 'elevator', why: 'Unchanged: each car keeps its own SCAN logic.' },
          { id: 'record', text: 'Remember the floor and wanted direction of a hallway press', owner: 'hallcall', alt: ['dispatcher'], why: 'A HallCall is that fact as a small value.' },
        ],
        walk: { title: 'Down is pressed at floor 6', steps: [
          { prompt: 'Who receives the press?', owner: 'dispatcher', call: 'dispatcher.hall_call(HallCall(6, DOWN))' },
          { prompt: 'Who knows how far each car is from floor 6?', owner: 'elevator', call: 'car.eta(6, DOWN)' },
          { prompt: 'Who then adds floor 6 to the winner’s stops?', owner: 'elevator', call: 'best.request(6)' },
        ] },
      },
      help: {
        hint: 'Which object can see all three cars at once?',
        walkthrough: [
          { text: 'A single car cannot compare itself with the others, so a Dispatcher is needed.', focus: ['disp'] },
          { text: 'The Dispatcher asks each Elevator for an estimate and gives the call to the lowest.', focus: ['disp', 'car'] },
          { text: 'Assignment happens one call at a time, so two cars are never sent to one press.', focus: ['disp', 'call'] },
        ],
        solution: [{ type: 'p', text: 'Add a Dispatcher that owns hall calls. Each Elevator keeps its own SCAN logic and exposes an estimate. The dispatcher serialises assignments.' }],
        why: 'The new job needs a view of all cars, so it gets its own object and the car classes stay unchanged.',
      },
      lessons: ['responsibilities', 'concurrency-lld', 'pattern-strategy'],
    },
  ],
  rules: [
    { id: 'el-close-missing', stage: 'states', when: { result: 'states', is: 'stuck' }, priority: 6, ask: { text: 'At tick 4 the doors were still “open” and Ben’s request was refused. Nothing in your diagram closes them. What should happen one tick after they open?', choices: [
      { id: 'timer', label: 'Doors open → Idle on a timed “close”', reply: 'Yes. Draw that arrow and replay the clock.', verdict: 'sound' },
      { id: 'move', label: 'Doors open → Moving on “go down”', reply: 'That lets the car move while the doors are open. Closing has to come first.', verdict: 'risky' },
    ] }, gap: { text: 'Nothing closed the doors, so the car stayed stuck open.', fix: 'Add Doors open → Idle on a timed “close” and replay.', stage: 'states', lesson: 'state-machines' } },
    { id: 'el-ok', stage: 'states', when: { result: 'states', is: 'pass' }, ack: 'Your car closed its doors on the timer and then answered Ben.', strength: 'You gave the car a timed “close”, so doors close by themselves and never stay open while it moves.' },
    { id: 'el-open-request', stage: 'states', when: { result: 'states', is: 'pass' }, priority: 5, ask: { text: 'Someone presses a floor while the doors are open. Your diagram has no arrow for it. What does the car do with that press?', choices: [
      { id: 'remember', label: 'Remember it as a pending stop; it is not a state change', reply: 'Yes. The press changes the stop list, not the state, so the diagram stays small.', verdict: 'sound' },
      { id: 'drop', label: 'Ignore it; they can press again', reply: 'That loses a request silently. Remember it.', verdict: 'risky' },
      { id: 'reopen', label: 'Add a “request” arrow from every state', reply: 'It works but multiplies arrows. Keep stops as data and states for what the car is doing.', verdict: 'partial' },
    ] } },
    { id: 'el-roles-good', stage: 'roles', when: { result: 'roles', is: 'pass' }, ack: 'Validation and ordering sit with the car that owns the stops.', strength: 'You kept pending stops, direction and floor-range checks inside Elevator, so its invariants live in one class.' },
    { id: 'el-roles-gap', stage: 'roles', when: { result: 'roles', is: 'gaps' }, gap: { text: 'A job was given to an object that does not hold the data for it.', fix: 'Reassign the cards marked “reconsider” and follow Ana’s press again.', stage: 'roles', lesson: 'responsibilities' } },
    { id: 'el-roles-policy', stage: 'roles', when: { result: 'roles', is: 'pass' }, priority: 3, ask: { text: 'You kept the ordering rule inside Elevator. When is a separate StopPolicy worth adding?', choices: [
      { id: 'second', label: 'When a second rule, such as priority floors, becomes real', reply: 'Yes. One rule does not need an interface yet.', verdict: 'sound' },
      { id: 'now', label: 'Always, from the first day', reply: 'It is valid, but an interface with one implementation is a place to look for nothing.', verdict: 'partial' },
    ] } },
    { id: 'el-cars-disp', stage: 'cars', when: { result: 'cars', is: 'pass' }, ack: 'A Dispatcher picks the car; each car keeps its own sweep.', strength: 'You put the multi-car decision in a Dispatcher and left each Elevator unchanged.', ask: { text: 'Two hall calls at floors 6 and 7 arrive in the same instant. Your dispatcher is called from two threads. What could go wrong?', choices: [
      { id: 'serial', label: 'Both pick the same “closest” car from stale information; assign one call at a time', reply: 'Yes. Make assignment a single locked step, or one thread owns the dispatcher.', verdict: 'sound' },
      { id: 'nothing', label: 'Nothing; the cars sort it out', reply: 'Two calls going to one car may be fine, but two cars sent to one call wastes a trip. Decide in one place.', verdict: 'risky' },
    ] } },
    { id: 'el-cars-gap', stage: 'cars', when: { result: 'cars', is: 'gaps' }, priority: 5, ask: { text: 'A hall call needs a view of all three cars. Which job did you leave with a single car?', choices: [
      { id: 'dispatcher', label: 'Choosing the car: it belongs to a Dispatcher', reply: 'Yes. One object that can see all cars decides.', verdict: 'sound' },
      { id: 'nearest', label: 'Let each car claim the call if it is nearest', reply: 'Two cars can claim at once. It can work with a shared claim step, which is a dispatcher by another name.', verdict: 'partial' },
    ] }, gap: { text: 'The choice of car was given to something that cannot see all cars.', fix: 'Give hall-call assignment to a Dispatcher and keep SCAN inside each Elevator.', stage: 'cars', lesson: 'responsibilities' } },
  ],
  solution: {
    design: {
      comps: [
        { id: 'call', type: 'hallcall', kind: 'class', label: 'HallCall', x: 60, y: 120 },
        { id: 'disp', type: 'dispatcher', kind: 'class', label: 'Dispatcher', x: 250, y: 200 },
        { id: 'car', type: 'elevator', kind: 'class', label: 'Elevator', x: 450, y: 200 },
        { id: 'dir', type: 'direction', kind: 'enum', label: 'Direction', x: 520, y: 360 },
        { id: 'cs', type: 'carstate', kind: 'enum', label: 'CarState', x: 360, y: 360 },
        { id: 'pol', type: 'policy', kind: 'iface', label: 'StopPolicy', x: 520, y: 60 },
      ],
      links: [
        { id: 'disp-call', from: 'disp', to: 'call', label: 'uses' }, { id: 'disp-car', from: 'disp', to: 'car', label: 'has many' },
        { id: 'car-dir', from: 'car', to: 'dir', label: 'uses' }, { id: 'car-cs', from: 'car', to: 'cs', label: 'uses' }, { id: 'car-pol', from: 'car', to: 'pol', label: 'uses' },
      ],
    },
    why: {
      call: 'A hallway press: floor and wanted direction.',
      disp: 'Owns the choice among cars. Asks each for an estimate and assigns one call at a time.',
      car: 'One car: floor, direction, pending stops and state. Refuses bad floors and orders its own stops.',
      dir: 'Up or down; the sweep reverses it when nothing is ahead.',
      cs: 'Idle, moving up, moving down, doors open. “Close” is the only way out of doors open.',
      pol: 'Optional: the rule for the next stop, so SCAN can be swapped.',
    },
    alternatives: { pol: { types: ['elevator'], tradeoff: 'Keeping the ordering rule inside Elevator is simpler while there is only one rule.' } },
    trace: { title: 'Down is pressed at floor 6 with three cars', steps: [
      { from: 'call', to: 'disp', text: 'HallCall(6, DOWN) arrives at the dispatcher.' },
      { from: 'disp', to: 'car', text: 'It asks each car for an estimate to floor 6 and picks the lowest.' },
      { from: 'car', to: 'cs', text: 'The chosen car adds 6 to its stops; when it arrives, Moving → Doors open.' },
      { from: 'car', to: 'dir', text: 'After doors close, direction is kept or reversed by the sweep.' },
    ] },
    tradeoff: 'A dispatcher that sees all cars gives good assignments but is one more object to keep consistent; each car stays simple and testable.',
    otherApproach: 'For a single car, drop the Dispatcher. For many cars and zones, estimates can use traffic data, but the roles stay the same.',
  },
};
