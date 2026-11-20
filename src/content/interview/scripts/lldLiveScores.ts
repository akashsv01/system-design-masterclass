import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';
import { py } from '../../lessons/_kit';

const st = (states: [string, string, number, number][], trans: [string, string, string][]) => ({
  comps: states.map(([id, label, x, y]) => ({ id, type: id, kind: 'state' as const, label, x, y })),
  links: trans.map(([from, to, label]) => ({ id: `${from}-${to}-${label}`, from, to, label })),
});

export const lldLiveScores: InterviewScript = {
  caseId: 'lld-live-scores',
  track: 'lld',
  doLine: 'Draw a match’s states with goals and a correction, assign each job to an object, then apply two updates that arrive out of order',
  skills: ['state-machines', 'object-design', 'consistency'],
  brief: {
    interviewer: { name: 'Tomás', role: 'engineer who owns the score feed code' },
    intro: 'The live-scores architecture is settled. I want the code inside the processor that turns the provider’s feed into the score. The feed is messy: think about states and rules, not boxes between servers.',
    users: 'Fans watching scores in the app, and the services that notify them. They read the match’s score and status.',
    needs: ['Apply each provider event to the match (kick-off, goal, half-time, full-time)', 'Handle a correction, such as a goal disallowed by video review', 'Tell subscribers when the score or status changes'],
    mustHold: ['Each event is applied once, in the provider’s order', 'The score always equals the goals that currently stand', 'A finished match never changes'],
    constraints: ['Each event has a unique id and a per-match sequence number', 'The feed can repeat an event or deliver two events in the wrong order', 'About 500 events per second across all matches'],
    outOfScope: ['How events travel from the provider (that was the HLD interview)', 'Player statistics'],
    terms: [
      { term: 'sequence number', meaning: 'a counter the provider adds to each event of a match: 1, 2, 3 …' },
      { term: 'idempotent', meaning: 'safe to repeat: applying the same event twice has the same effect as once' },
      { term: 'compare-and-set', meaning: 'write only if the value is still what you read; otherwise refuse and try again' },
    ],
    firstMove: 'Start with the match itself. Draw its states, the goal and correction events, then replay one: a goal is scored, then disallowed. What does the score show at each step?',
  },
  palette: [
    { type: 'processor', kind: 'class', name: 'ScoreProcessor', blurb: 'Receives each event and decides what to do with it.' },
    { type: 'match', kind: 'class', name: 'MatchState', blurb: 'The match: status, goals that stand, score, last applied sequence.' },
    { type: 'seen', kind: 'class', name: 'SeenIds', blurb: 'The event ids already received, to skip duplicates.' },
    { type: 'pending', kind: 'class', name: 'PendingBuffer', blurb: 'Events that arrived early, waiting for the ones before them.' },
    { type: 'subscriber', kind: 'iface', name: 'Subscriber', blurb: 'Anything that wants to hear about changes: on_change(match).' },
    { type: 'status', kind: 'enum', name: 'MatchStatus', blurb: 'scheduled, live, half-time, finished.' },
    { type: 'event', kind: 'class', name: 'MatchEvent', blurb: 'One provider event: id, seq, type, goal id, team.' },
  ],
  verbs: ['has', 'has many', 'uses', 'notifies', 'implements'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Find out how the feed can misbehave before designing anything.',
      question: 'Which rules would you confirm before writing a single class?',
      activity: { kind: 'clarify', questions: [
        { id: 'dups', q: 'Can the same event arrive twice?', a: 'Yes. The provider retries, so an event id may repeat. Applying it twice must change nothing.' },
        { id: 'order', q: 'Can events arrive out of order?', a: 'Yes. Each has a per-match sequence number; apply strictly in that order.' },
        { id: 'correction', q: 'How does a disallowed goal arrive?', a: 'As a new event that names the goal it cancels. We never edit history.' },
        { id: 'final', q: 'What can happen after full time?', a: 'Nothing. A finished match is final; a late event is ignored.' },
        { id: 'fans', q: 'Who hears about changes?', a: 'Several subscribers: the app feed, push notifications. They must not see a half-applied change.' },
      ], assumptions: [
        { id: 'gap', q: 'Seq 5 arrives but seq 4 is still missing. What does the processor do?', options: [
          { id: 'buffer', label: 'Hold seq 5 until 4 arrives', consequence: 'The score is always correct, but it can pause. A permanently lost seq 4 needs a timeout (later).' },
          { id: 'apply', label: 'Apply seq 5 now', consequence: 'Fans see changes sooner, but a correction can run before its goal and corrupt the score.' },
        ] },
      ] },
      help: {
        hint: 'Which problem is worse: a short delay, or a score that is briefly wrong?',
        walkthrough: [{ text: 'Duplicates are skipped by event id.' }, { text: 'Order is by sequence number; gaps wait.' }, { text: 'The score comes from the goals that stand, so a correction removes a goal.' }],
        solution: [{ type: 'list', items: ['Skip event ids already seen.', 'Apply seq n only after n−1.', 'Score = goals that stand; a correction removes one.', 'A finished match ignores everything.'] }],
        why: 'These rules are the invariants the classes must keep; the rest is naming.',
      },
      lessons: ['contracts-invariants', 'clocks-ordering'],
    },
    {
      id: 'states', title: 'Match states', intro: 'Place the match’s states and name each arrow with the event that causes it. A goal or a correction keeps the match live.',
      question: 'Draw the match’s states and events. What does your machine do with a goal event after the final whistle?',
      activity: {
        kind: 'states', entity: 'Match: Reds v Blues', initial: 'scheduled',
        states: [
          { key: 'scheduled', label: 'Scheduled', blurb: 'Not started.' },
          { key: 'live', label: 'Live', blurb: 'Being played. Goals and corrections happen here.' },
          { key: 'half-time', label: 'Half time', blurb: 'Break. The score cannot change.' },
          { key: 'finished', label: 'Finished', blurb: 'Final.' },
        ],
        events: [{ id: 'kick-off', label: 'kick-off' }, { id: 'goal', label: 'goal' }, { id: 'correction', label: 'goal disallowed' }, { id: 'half-time', label: 'half time' }, { id: 'restart', label: 'second half' }, { id: 'full-time', label: 'full time' }],
        scenario: [
          { at: 0, event: 'kick-off', label: '15:00 kick-off', expect: 'live' },
          { at: 20, event: 'goal', label: '15:20 Reds score', expect: 'live' },
          { at: 45, event: 'half-time', label: '15:45 half time', expect: 'half-time' },
          { at: 60, event: 'restart', label: '16:00 second half starts', expect: 'live' },
          { at: 70, event: 'correction', label: '16:10 the Reds goal is disallowed after review', expect: 'live' },
          { at: 105, event: 'full-time', label: '16:45 full time', expect: 'finished' },
          { at: 110, event: 'goal', label: '16:50 a late goal event arrives (refused)' },
        ],
        starter: st([['scheduled', 'Scheduled', 70, 220], ['live', 'Live', 270, 220]], [['scheduled', 'live', 'kick-off']]),
      },
      help: {
        hint: 'A goal changes the score but not the match’s state. Which arrow represents that?',
        walkthrough: [
          { text: 'Scheduled → Live on “kick-off”.' },
          { text: 'Live → Live on “goal” and on “goal disallowed”: the state stays, the goals change.' },
          { text: 'Live → Half time → Live → Finished. There is no arrow out of Finished, so a late goal is refused.' },
        ],
        solution: [{ type: 'table', head: ['From', 'Event', 'To'], rows: [['Scheduled', 'kick-off', 'Live'], ['Live', 'goal', 'Live'], ['Live', 'goal disallowed', 'Live'], ['Live', 'half time', 'Half time'], ['Half time', 'second half', 'Live'], ['Live', 'full time', 'Finished']] }],
        why: 'The brief says a finished match never changes. With no arrow leaving Finished, that is enforced by the design.',
      },
      lessons: ['state-machines', 'pattern-state'],
    },
    {
      id: 'roles', title: 'Who does what', intro: 'Give each job to one object, then walk through a goal that is scored and then disallowed.',
      question: 'Which object owns each job, and which one decides that a goal no longer counts?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'processor', name: 'ScoreProcessor', blurb: 'Receives events.' },
          { id: 'match', name: 'MatchState', blurb: 'Status, goals, score, last seq.' },
          { id: 'seen', name: 'SeenIds', blurb: 'Event ids already received.' },
          { id: 'pending', name: 'PendingBuffer', blurb: 'Early events.' },
          { id: 'subscriber', name: 'Subscriber', blurb: 'Hears about changes.' },
        ],
        cards: [
          { id: 'dup', text: 'Skip an event id already received', owner: 'seen', alt: ['processor'], why: 'The set of ids is its own small object; the processor may hold the set directly in a first version.' },
          { id: 'wait', text: 'Hold seq 5 until seq 4 has arrived', owner: 'pending', alt: ['processor'], why: 'Early events wait in a buffer the processor drains.' },
          { id: 'order', text: 'Decide which event is applied next', owner: 'processor', why: 'It sees the buffer and the last applied sequence.' },
          { id: 'goals', text: 'Remember which goals stand and derive the score', owner: 'match', why: 'The score is computed from the goals that stand, so it cannot drift.' },
          { id: 'notify', text: 'Tell the app and the push service the score changed', owner: 'subscriber', alt: ['processor'], why: 'Subscribers receive the change; the processor calls them after the match is updated.' },
          { id: 'final', text: 'Refuse changes to a finished match', owner: 'match', alt: ['processor'], why: 'The match knows its own status; the processor may also check before applying.' },
        ],
        walk: { title: 'A goal is scored, then disallowed', steps: [
          { prompt: 'Who receives “goal g1” (seq 4)?', owner: 'processor', call: 'processor.receive({"id": "e4", "seq": 4, "type": "goal", "goal_id": "g1", "team": "home"})' },
          { prompt: 'Who records that g1 stands and derives 1–0?', owner: 'match', call: 'match.goals["g1"] = "home"  # score 1-0' },
          { prompt: 'Who receives “goal_disallowed g1” (seq 5) and decides it can be applied?', owner: 'processor', call: 'processor.receive({"seq": 5, "type": "goal_disallowed", "goal_id": "g1"})' },
          { prompt: 'Whose data changes so the score goes back to 0–0?', owner: 'match', call: 'match.goals.pop("g1")  # score 0-0' },
        ] },
      },
      help: {
        hint: 'The score is not stored on its own. What is it computed from?',
        walkthrough: [
          { text: 'ScoreProcessor handles delivery problems: duplicates and order.', focus: ['proc', 'seen', 'pending'] },
          { text: 'MatchState holds the goals that stand and derives the score from them.', focus: ['state'] },
          { text: 'A disallowed goal removes that goal; the score can never disagree with the goals.', focus: ['state'] },
        ],
        solution: [
          { type: 'code', lang: 'python', code: py('sdm/cases/score_processor.py', '_apply'), caption: 'python/sdm/cases/score_processor.py — tested with pytest' },
          { type: 'p', text: 'The score is recomputed from `goals` after every event. Removing a goal is the only way to “subtract” one.' },
        ],
        why: 'Delivery problems live in the processor; match facts live in the match, so each invariant has one owner.',
      },
      lessons: ['responsibilities', 'pattern-observer', 'cohesion-coupling'],
    },
    {
      id: 'order', title: 'Two updates, wrong order', intro: 'The interviewer changes one condition. Predict, run it, revise.',
      question: 'Two workers each hold one update for the same match: “goal” (seq 4) and “goal disallowed” (seq 5). Both read version 3. Can both be applied to version 3?',
      change: { announce: 'New condition: the processor now runs on two workers. Update seq 4 (goal) and seq 5 (goal disallowed) reach different workers at the same moment.', rule: RULES.timeline },
      activity: {
        kind: 'timeline', names: ['Worker A (seq 4: goal)', 'Worker B (seq 5: disallowed)'], resource: 'Match record, version 3 (updates it will accept)', initial: 1,
        read: 'reads the match at version 3', write: 'saves its change as version 4',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'Save the match as the worker computed it', detail: 'Each worker writes what it computed from version 3. The later save overwrites the earlier one.', code: 'match = store.load(match_id)\nmatch.apply(event)\nstore.save(match)' },
          { id: 'conditional', label: 'Sequence check: save only if last_seq is still what was read', detail: 'Seq 5 may only be saved when the stored last_seq is 4; otherwise it is refused and goes back to the buffer.', code: "UPDATE matches SET data=:d, last_seq=:seq\nWHERE id=:id AND last_seq=:seq - 1" },
          { id: 'lock', label: 'Lock the match while an update is applied', detail: 'The second worker waits for the first to save.', code: 'SELECT * FROM matches WHERE id=:id FOR UPDATE' },
        ],
        predict: { q: 'Both workers save from version 3 without a check. What does the stored match show?', choices: [{ id: 'both', label: 'Both applied in the right order' }, { id: 'overwrite', label: 'One update overwrites the other' }, { id: 'refused', label: 'The second save is refused' }] },
      },
      help: {
        hint: 'What does seq 5 need to be true about the stored match before it may be applied?',
        walkthrough: [{ text: 'Both workers computed from version 3, so neither saw the other.' }, { text: 'A plain save lets the last writer win, so the goal or the correction can be silently lost.' }, { text: 'A sequence check makes seq 5 wait until the stored last_seq is 4.' }],
        solution: [{ type: 'p', text: 'Use a conditional write on last_seq: seq n is saved only if the stored last_seq is n−1. A refused update goes back to the buffer and is applied after the one it waits for.' }],
        why: 'Ordering has to be enforced where the match is saved, because that is the only place that sees both updates.',
      },
      lessons: ['concurrency-lld', 'clocks-ordering', 'locking-mvcc'],
    },
  ],
  rules: [
    { id: 'states-pass', stage: 'states', when: { result: 'states', is: 'pass' }, ack: 'Your match went live, paused at half time and ended as finished; the late goal was refused.', strength: 'Your match state machine kept goals inside Live and had no way out of Finished, so a finished match never changes.' },
    { id: 'states-stuck', stage: 'states', when: { result: 'states', is: ['stuck', 'fail'] }, priority: 6, ask: { text: 'At least one event in the replay was refused or ended in the wrong state. Which kind of event needs an arrow that goes back to the same state?', choices: [
      { id: 'goal', label: 'Goal and goal disallowed: Live → Live', reply: 'Yes. They change the goals, not the status. Add them and replay.', verdict: 'sound' },
      { id: 'nothing', label: 'None; goals do not need arrows', reply: 'Without an arrow the event is refused, so the score would never change.', verdict: 'risky' },
    ] }, gap: { text: 'Some events had no arrow, so they were refused or moved the match to the wrong state.', fix: 'Add Live → Live for goal and correction, and check each status change in the replay.', stage: 'states', lesson: 'state-machines' } },
    { id: 'derived-ask', stage: 'states', when: { result: 'states', is: 'pass' }, priority: 4, ask: { text: 'Your arrows say a correction keeps the match live. Does the diagram show how the score goes from 1–0 back to 0–0?', choices: [
      { id: 'no', label: 'No. The score is derived from the goals that stand, in MatchState', reply: 'Right. A state machine shows status. The goal list and the derived score are data you must also design and test.', verdict: 'sound' },
      { id: 'yes', label: 'Yes, the arrow does it', reply: 'The arrow only says the event is allowed. Something must remove the goal.', verdict: 'risky' },
      { id: 'counter', label: 'Subtract one from a score counter', reply: 'It works for one goal, but a repeated correction or a goal in the wrong order drifts it. Derive from the goals instead.', verdict: 'partial' },
    ] }, gap: { text: 'It was unclear how a disallowed goal changes the score.', fix: 'Store the goals that stand and derive the score from them in MatchState.', stage: 'roles', lesson: 'contracts-invariants' } },
    { id: 'roles-good', stage: 'roles', when: { result: 'roles', is: 'pass' }, ack: 'Delivery problems sit with the processor and match facts with the match.', strength: 'You separated delivery problems (duplicates, order) from match facts (goals and score).' },
    { id: 'roles-gap', stage: 'roles', when: { result: 'roles', is: 'gaps' }, gap: { text: 'Some jobs sit with objects that lack the data to do them.', fix: 'Reassign the cards marked “reconsider” and replay the goal-then-disallowed walk.', stage: 'roles', lesson: 'responsibilities' } },
    { id: 'dedupe-ask', stage: 'roles', when: { result: 'roles', is: ['pass', 'gaps'] }, priority: 5, ask: { text: 'The provider repeats event e4 (a goal) after it was applied. What keeps the score at 1–0?', choices: [
      { id: 'ids', label: 'Skip any event id already seen', reply: 'Yes. Repeating an event is then harmless.', verdict: 'sound' },
      { id: 'seq', label: 'Skip any event whose seq is not above last_seq', reply: 'Also sound: a repeat has a seq already applied. It still needs to remember buffered events that have not applied yet.', verdict: 'partial' },
      { id: 'goal', label: 'Check whether the goal id is already in goals', reply: 'That protects a goal but not a correction or a status change. Use the event id.', verdict: 'risky' },
    ] }, gap: { text: 'A repeated provider event could be applied twice.', fix: 'Keep the ids of events already received and skip them.', stage: 'roles', lesson: 'idempotency' } },
    { id: 'order-fixed', stage: 'order', when: { result: 'order', is: 'one' }, ack: 'With the sequence check, only the in-order update was saved; the other waited.', strength: 'You enforced event order where the match is saved (a sequence check), so two workers cannot overwrite each other.' },
    { id: 'order-over', stage: 'order', when: { result: 'order', is: 'oversold' }, priority: 5, ask: { text: 'Both updates were saved on version 3, so one overwrote the other. What must seq 5 check before it saves?', choices: [
      { id: 'lastseq', label: 'That the stored last_seq is 4; if not, refuse and put it back in the buffer', reply: 'Yes. Switch to the conditional write and run the same order again.', verdict: 'sound' },
      { id: 'owner', label: 'Route all events of a match to one worker', reply: 'A valid alternative: one owner per match. You must handle that worker failing and the match moving.', verdict: 'partial' },
      { id: 'clock', label: 'Compare timestamps and keep the newest', reply: 'Clocks on two workers disagree. The provider’s sequence number is the order to trust.', verdict: 'risky' },
    ] }, gap: { text: 'Two workers overwrote each other’s update to the same match.', fix: 'Save with a conditional write on last_seq and buffer refused updates.', stage: 'order', lesson: 'concurrency-lld' } },
    { id: 'order-owner', stage: 'order', when: { result: 'order', is: 'one' }, priority: 3, ask: { text: 'Instead of a sequence check, you could send every event for one match to the same worker. What would you give up?', choices: [
      { id: 'failover', label: 'If that worker dies, its matches must move and its buffer is lost', reply: 'Yes. One owner is simple while it lives; failure needs a rebuild step, which the check does not.', verdict: 'sound' },
      { id: 'nothing', label: 'Nothing; it is strictly better', reply: 'It removes the race but adds failover and an uneven load for popular matches.', verdict: 'risky' },
    ] } },
  ],
  solution: {
    design: {
      comps: [
        { id: 'event', type: 'event', kind: 'class', label: 'MatchEvent', x: 50, y: 210 },
        { id: 'proc', type: 'processor', kind: 'class', label: 'ScoreProcessor', x: 250, y: 210 },
        { id: 'seen', type: 'seen', kind: 'class', label: 'SeenIds', x: 250, y: 60 },
        { id: 'pending', type: 'pending', kind: 'class', label: 'PendingBuffer', x: 250, y: 360 },
        { id: 'state', type: 'match', kind: 'class', label: 'MatchState', x: 460, y: 210 },
        { id: 'status', type: 'status', kind: 'enum', label: 'MatchStatus', x: 520, y: 360 },
        { id: 'sub', type: 'subscriber', kind: 'iface', label: 'Subscriber', x: 520, y: 60 },
      ],
      links: [
        { id: 'p-e', from: 'proc', to: 'event', label: 'uses' }, { id: 'p-s', from: 'proc', to: 'seen', label: 'has' }, { id: 'p-b', from: 'proc', to: 'pending', label: 'has' },
        { id: 'p-m', from: 'proc', to: 'state', label: 'has' }, { id: 'm-st', from: 'state', to: 'status', label: 'uses' }, { id: 'p-sub', from: 'proc', to: 'sub', label: 'notifies' },
      ],
    },
    why: {
      event: 'One provider event: id, seq, type, goal id, team. Treated as read-only.',
      proc: 'Handles delivery problems: skips duplicates, buffers early events, applies in sequence order.',
      seen: 'The ids already received; a repeat is skipped.',
      pending: 'Events that arrived before their predecessor, keyed by sequence number.',
      state: 'Status, goals that stand and last applied seq. The score is derived from the goals.',
      status: 'scheduled, live, half-time, finished: the only states a match can be in.',
      sub: 'The app feed and push service implement on_change(match); the processor does not know which exist.',
    },
    alternatives: { seen: { types: ['processor'], tradeoff: 'A plain set inside the processor is enough for one process; a separate object helps when the ids must be stored durably.' } },
    trace: { title: 'A goal is scored, then disallowed', steps: [
      { from: 'event', to: 'proc', text: 'goal g1, seq 4, arrives.' },
      { from: 'proc', to: 'seen', text: 'Id e4 is new; remember it.' },
      { from: 'proc', to: 'pending', text: 'Seq 4 is the next one, so it is applied straight away.' },
      { from: 'proc', to: 'state', text: 'goals[g1] = home → score 1–0.' },
      { from: 'proc', to: 'sub', text: 'Subscribers are told: 1–0.' },
      { from: 'proc', to: 'state', text: 'Later goal_disallowed g1 (seq 5): goals.pop(g1) → score 0–0.' },
    ] },
    tradeoff: 'Buffering until the next sequence number keeps the score correct, but a lost event stalls the match until a timeout or a snapshot resyncs it.',
    otherApproach: 'Store every event and compute the score by replaying them (event sourcing): the score is always rebuildable, at the cost of more storage and a replay on recovery.',
  },
};
