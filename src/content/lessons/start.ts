import type { GenericLesson } from '../lessonTypes';
import { e, layout, n, py, pyLine } from './_kit';

const HOLD = py('sdm/seat_hold.py', 'hold');

export const hldVsLld: GenericLesson = {
  id: 'hld-vs-lld',
  area: 'Start here',
  opening:
    'Your manager asks for “seat holds”: a buyer gets ten minutes to pay before the seat goes back on sale. One teammate starts drawing boxes and arrows. Another starts writing a `Seat` class. They’re both right, but they’re answering different questions.',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [
        n('apps', 'client', 'Apps', { sub: 'phones, web' }),
        n('booking', 'service', 'Booking service', { sub: 'seat rules' }),
        n('store', 'db', 'Seat store', { sub: 'availability' }),
        n('pay', 'ext', 'Payments', { sub: 'another company' }),
        n('seat', 'box', 'Seat', { sub: 'state, holder, expiry' }),
        n('clock', 'box', 'Clock', { sub: 'what time is it?' }),
        n('svc', 'box', 'hold(seat, buyer)', { sub: 'the rule' }),
      ],
      edges: [
        e('apps', 'booking', 'HTTPS'),
        e('booking', 'store', 'reads, writes'),
        e('booking', 'pay', 'charge', { dashed: true }),
        e('svc', 'seat', 'changes'),
        e('svc', 'clock', 'asks'),
      ],
      ...layout(380, 478, {
        apps: [{ x: 100, y: 80, w: 150 }, { x: 86, y: 45, w: 148 }],
        booking: [{ x: 400, y: 80, w: 190 }, { x: 272, y: 45, w: 160 }],
        store: [{ x: 700, y: 80, w: 170 }, { x: 86, y: 160, w: 148 }],
        pay: [{ x: 700, y: 200, w: 170 }, { x: 272, y: 160, w: 160 }],
        seat: [{ x: 190, y: 310, w: 180 }, { x: 86, y: 430, w: 148 }],
        svc: [{ x: 470, y: 310, w: 200 }, { x: 180, y: 300, w: 220 }],
        clock: [{ x: 730, y: 310, w: 150 }, { x: 272, y: 430, w: 160 }],
      }),
    },
  },
  steps: [
    {
      kicker: 'Problem',
      title: 'One feature, two questions',
      body: [
        'Seat holds touch the whole system and one small piece of code. Before anyone draws or types, it helps to know which question you’re answering.',
      ],
      view: { hide: ['seat', 'clock', 'svc'], dim: ['apps', 'booking', 'store', 'pay'] },
    },
    {
      kicker: 'Idea',
      title: 'High-level design: parts and ownership',
      body: [
        '**High-level design (HLD)** decides the parts of a system, what data each part owns, and how they talk. For holds, the HLD question is: where does “F12 is held by Maya until 20:10” live, and who is allowed to change it?',
        'Answer: the booking service owns it and stores it in the seat store. Apps only ask. Payments never touch seats directly.',
      ],
      view: { hide: ['seat', 'clock', 'svc'], states: { store: 'focus' }, tags: { store: { text: 'owns holds', tone: 'ok' } } },
      changes: [{ kind: 'add', text: 'Owner of seat state: booking service + seat store' }],
    },
    {
      kicker: 'Watch',
      title: 'Zoom in on one box',
      body: [
        'Now zoom into the booking service. Inside it are ordinary programming pieces: a `Seat` with a state, a clock, and one function that applies the rule.',
      ],
      view: { dim: ['apps', 'store', 'pay'], states: { booking: 'focus' } },
      changes: [{ kind: 'add', text: 'Inside the booking service: Seat, Clock, hold()' }],
    },
    {
      kicker: 'Idea',
      title: 'Low-level design: objects and rules',
      body: [
        '**Low-level design (LLD)** decides the objects inside one part, their states, and the rules that keep them correct. For holds: a seat is *available*, *held* or *booked*. A hold can only start on an available seat, and it ends by itself when its time runs out.',
      ],
      view: { dim: ['apps', 'store', 'pay', 'booking'], states: { svc: 'focus', seat: 'active' }, tags: { seat: { text: 'held until 20:10', tone: 'changed' } } },
      code: { code: HOLD, highlight: [pyLine(HOLD, "if self.state != \"available\":")], caption: 'python/sdm/seat_hold.py — the rule lives in one method' },
    },
    {
      kicker: 'Predict',
      title: 'Sort the question',
      body: ['Real design work moves between the two levels all the time. The skill is noticing which level a question belongs to.'],
      view: { dim: ['apps', 'pay'], states: { store: 'focus', seat: 'focus' } },
      predict: {
        id: 'sort',
        prompt: 'Your teammate asks: “Should apps cache seat availability for a few seconds to cut load?” Is that HLD or LLD?',
        choices: [
          { id: 'hld', text: 'HLD', why: 'Right. It changes which part holds a copy of the data and how fresh it is, a question about parts and communication. Its LLD follow-up is how the cache entry expires.' },
          { id: 'lld', text: 'LLD', why: 'It sounds like a code detail, but it moves a copy of seat data into another part of the system. Who holds data, and how stale it may be, is an HLD decision.' },
        ],
        correct: 'hld',
      },
    },
  ],
  worked: {
    title: 'the same feature at both levels',
    blocks: [
      { type: 'table', head: ['Question', 'Level', 'Typical artifact'], rows: [
        ['Which service stores holds?', 'HLD', 'Box-and-arrow diagram'],
        ['How many hold requests per second at 20:00 on sale day?', 'HLD', 'Capacity estimate'],
        ['What does `POST /holds` accept and return?', 'HLD (API contract)', 'API sketch'],
        ['What states can a seat be in?', 'LLD', 'State diagram'],
        ['Which method enforces “one hold per seat”?', 'LLD', 'Class sketch, code'],
        ['How do we test expiry without waiting ten minutes?', 'LLD', 'Unit test with a fake clock'],
      ] },
      { type: 'p', text: 'Interviews usually say which level they want. “Design Ticketmaster” is HLD. “Design the classes for a booking system” is LLD. Strong answers still touch the other level where it matters, for example naming the invariant the database must enforce.' },
    ],
  },
  checks: [
    {
      kind: 'choice', id: 'q1', prompt: '“A hold must expire after ten minutes even if the server restarts.” Which level does this requirement push on hardest?',
      choices: [
        { id: 'hld', text: 'HLD: the expiry time must be stored durably, not just in one server’s memory.', why: 'Right. Surviving a restart is about where state lives. The LLD still has to compare the expiry with the clock.' },
        { id: 'lld', text: 'LLD: it is only about the `Seat` class.', why: 'The class compares times, but if the hold lived only in one server’s memory, a restart would lose it. That’s a decision about storage, which is HLD.' },
      ],
      correct: 'hld',
    },
    {
      kind: 'choice', id: 'q2', prompt: 'Which of these is an LLD decision?',
      choices: [
        { id: 'a', text: 'Put a queue between checkout and email.', why: 'That adds a part and changes how parts communicate: HLD.' },
        { id: 'b', text: 'Make `confirm()` refuse a buyer whose hold has expired.', why: 'Right: a rule inside one object.' },
        { id: 'c', text: 'Run the booking service in two regions.', why: 'Where parts run is HLD.' },
      ],
      correct: 'b',
    },
  ],
  exercise: {
    id: 'food',
    prompt: 'A food-delivery app adds “track my order”. Write one HLD question and one LLD question you would ask first.',
    hint: 'HLD: where do driver locations come from and who stores them? LLD: what states can an order be in?',
    checklist: ['The HLD question is about parts, data ownership or communication.', 'The LLD question is about objects, states or rules inside one part.'],
    model: 'HLD: how do driver locations get from the driver’s phone to the customer’s phone, and does anything store them? LLD: which states can an order move through (placed → cooking → picked up → delivered), and which transitions are allowed?',
  },
  next: { id: 'inside-a-request', reason: 'Both levels rest on requests moving between parts. Next you’ll open one up and time each stage.' },
};

export const START_LESSONS = [hldVsLld];
