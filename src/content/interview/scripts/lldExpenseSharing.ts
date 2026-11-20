import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';
import { py } from '../../lessons/_kit';

export const lldExpenseSharing: InterviewScript = {
  caseId: 'lld-expense-sharing',
  track: 'lld',
  doLine: 'Design a group expense splitter: choose the key for stored shares, give each job to one object, then handle two people recording the same payment',
  skills: ['object-design', 'data-modeling', 'concurrency'],
  brief: {
    interviewer: { name: 'Priya', role: 'engineer on the shared-expenses team' },
    intro: 'Friends travel together, one person pays the bill, and everyone loses track of who owes whom. I want the objects behind that screen, and I want the money to add up exactly.',
    users: 'Friends in a small group (up to 20 people) who add shared bills and check who owes whom.',
    needs: ['Add a bill: who paid, how much, and who shares it', 'See what one person owes another, and each person’s net balance', 'Settle up with as few payments as practical', 'Record that one person paid another back'],
    mustHold: ['Money is whole cents, never fractions', 'Everyone’s balances add up to exactly zero after every change', 'A payment is recorded once, even if two people record it at the same moment'],
    constraints: ['Bills are split equally among the people chosen', 'A group has at most 20 people and a few thousand bills', 'Amounts are integer cents; €100 split three ways must still add up to €100', 'Two people can have the app open on the same group at once'],
    outOfScope: ['Currency conversion', 'Receipts and photos', 'Sign-in and sending reminders'],
    terms: [
      { term: 'net balance', meaning: 'what a person is owed minus what they owe; positive means they are owed money' },
      { term: 'ledger', meaning: 'the list of money movements, kept so a balance can always be explained' },
      { term: 'partition key', meaning: 'the field that decides which machine stores a row; a query on it reads one machine' },
    ],
    firstMove: 'Ana pays €100 for dinner for Ana, Ben and Cleo. Before you draw anything, tell me what you want to know about the money, then choose how the shares of that bill are stored.',
  },
  palette: [
    { type: 'group', kind: 'class', name: 'Group', blurb: 'The people on one trip or flat, and the entry point for adding a bill.' },
    { type: 'expense', kind: 'class', name: 'Expense', blurb: 'One bill: who paid, the amount in cents, and who shares it.' },
    { type: 'split', kind: 'iface', name: 'SplitRule', blurb: 'A promise to turn an amount into per-person shares that add up exactly.' },
    { type: 'equal', kind: 'class', name: 'EqualSplit', blurb: 'Splits evenly and hands the leftover cents out one at a time.' },
    { type: 'ledger', kind: 'class', name: 'Ledger', blurb: 'Keeps each person’s net balance and checks that they add up to zero.' },
    { type: 'settlement', kind: 'class', name: 'Settlement', blurb: 'Suggests the payments that bring every balance to zero.' },
  ],
  verbs: ['has many', 'uses', 'implements', 'creates'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Money code goes wrong in the edges. Find them before drawing.',
      question: 'Which rules about the money would you confirm before choosing any structure?',
      activity: { kind: 'clarify', questions: [
        { id: 'units', q: 'What unit is money stored in?', a: 'Integer cents. Floating-point euros pick up rounding errors that add up over thousands of bills.' },
        { id: 'indivisible', q: 'What if €100 does not split evenly three ways?', a: 'Every share is a whole number of cents and the shares add up to exactly the bill: 3334, 3333 and 3333.' },
        { id: 'split', q: 'Are splits always equal?', a: 'Equal for now. Percentages and exact amounts may come later, so do not hard-code “divide by the number of people”.' },
        { id: 'settle', q: 'What does settling up mean?', a: 'Show the fewest practical payments that bring everyone’s balance to zero. Greedy matching is fine; the true minimum is not required.' },
        { id: 'concurrent', q: 'Can two people use the same group at once?', a: 'Yes. Ana and Ben both have the app open and may record actions within the same second.' },
      ], assumptions: [
        { id: 'rounding', q: 'Who receives the leftover cents when a bill does not divide evenly?', options: [
          { id: 'first', label: 'The first people in the list, one cent each', consequence: 'Deterministic and testable: the same bill always gives the same shares. Over many bills the earlier names pay a few cents more.' },
          { id: 'payer', label: 'The payer absorbs them', consequence: 'Simple to explain, but the payer’s share is no longer equal, and a payer who is not sharing the bill gets odd cents they never owed.' },
        ] },
      ] },
      help: {
        hint: 'After one bill, what must be true about everyone’s balances?',
        walkthrough: [
          { text: 'Money is whole cents, so every share is an integer.' },
          { text: 'Shares must add up to the bill, so leftover cents go to named people.' },
          { text: 'Because balances come from shares, they add up to zero: the payer gains the bill, the sharers lose their shares.' },
          { text: 'Two people on one group means a write that can arrive twice.' },
        ],
        solution: [{ type: 'list', items: ['Integer cents everywhere.', 'Shares add up to the bill; leftover cents handed out deterministically.', 'Balances always add up to zero.', 'Equal splits now, behind a swappable rule.', 'The same payment must not be recorded twice.'] }],
        why: 'These rules are the invariants the objects must keep. A design that only works for evenly divisible bills is not finished.',
      },
      lessons: ['contracts-invariants', 'domain-objects'],
    },
    {
      id: 'keys', title: 'Store the shares', intro: 'Every bill produces rows of shares. Choose the key, then test two questions against it.',
      question: 'What do you key the stored shares on, and what does “my balance across all my groups” cost?',
      activity: {
        kind: 'model',
        tables: [{ id: 'entries', name: 'share_entries', fields: ['group_id', 'entry_id', 'payer', 'person', 'share_cents', 'created_at'] }],
        table: 'entries', partitions: 16,
        first: { id: 'q1', text: 'In the Rome trip group: how much does Ana owe Ben? Read that group’s entries in order', filter: 'group_id', sort: 'created_at' },
        second: { id: 'q2', text: 'Ana opens the app: her net balance across every group she belongs to', filter: 'person' },
        tradeoffs: [
          { id: 'index', label: 'Key on group, plus an index on person', consequence: 'Ana’s total becomes one index lookup instead of asking every partition. Every share written also updates the index, so writes cost more.', verdict: 'sound' },
          { id: 'stored', label: 'Key on group; also keep a stored balance per person, updated with each bill', consequence: 'Reading a balance is instant. But it is a second copy: if one write fails or runs twice, the stored balance and the entries disagree.', verdict: 'sound' },
          { id: 'recompute', label: 'Key on group; recompute Ana’s total by scanning her groups', consequence: 'Always correct, since it is derived from the entries. Slower, but fine if few people open the all-groups screen.', verdict: 'partial' },
          { id: 'key-person', label: 'Key on person instead', consequence: 'Ana’s total is one partition, but opening one group now gathers rows from up to 20 people’s partitions, and every bill writes to all of them.', verdict: 'risky' },
        ],
      },
      help: {
        hint: 'Which screen is opened most: one group’s details, or the total across all groups?',
        walkthrough: [
          { text: 'People open a group far more often than the all-groups total, so partition on group_id and sort by time.' },
          { text: 'Then “what does Ana owe Ben” reads one partition, already in order.' },
          { text: 'The all-groups total filters on person, so it needs an index, a stored balance, or a scan.' },
          { text: 'A stored balance is fast but is a copy that can drift from the entries; recomputing from entries cannot drift.' },
        ],
        solution: [
          { type: 'p', text: 'Key `share_entries` on **group_id**, sorted by **created_at**. Group screens read one partition. For the all-groups total, either add an index on `person` or keep a stored balance per person.' },
          { type: 'code', lang: 'python', code: py('sdm/cases/expenses.py', 'balances'), caption: 'python/sdm/cases/expenses.py — tested with pytest. Balances are derived from the bills, so they always sum to zero.' },
        ],
        why: 'The key should match the most frequent read. A stored balance must always be checkable against the entries, because entries are the source of truth.',
      },
      lessons: ['access-patterns', 'contracts-invariants'],
    },
    {
      id: 'roles', title: 'Who does what', intro: 'Give each job to one object, then walk through adding the dinner bill.',
      question: 'Which object owns each job, and which object makes sure the shares add up to the bill?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'group', name: 'Group', blurb: 'Members, and the entry point add_expense().' },
          { id: 'expense', name: 'Expense', blurb: 'payer, amount_cents, people' },
          { id: 'split', name: 'SplitRule', blurb: 'Turns an amount into shares.' },
          { id: 'ledger', name: 'Ledger', blurb: 'Net balance per person.' },
          { id: 'settlement', name: 'Settlement', blurb: 'Plans the payments to zero everyone.' },
        ],
        cards: [
          { id: 'members', text: 'Know who is in the group and refuse a bill that names a stranger', owner: 'group', why: 'The group is the only object that knows its members.' },
          { id: 'record', text: 'Remember who paid and how much one dinner cost', owner: 'expense', why: 'An Expense is exactly that fact, unchanged afterwards.' },
          { id: 'shares', text: 'Work out each person’s share, leftover cents included', owner: 'split', alt: ['expense'], why: 'A split rule can be swapped for percentages later. Putting it in Expense works for one rule but makes the next one a rewrite.' },
          { id: 'net', text: 'Keep each person’s net balance', owner: 'ledger', why: 'Balances are the ledger’s data.' },
          { id: 'zero', text: 'Check that all balances add up to zero after each bill', owner: 'ledger', alt: ['group'], why: 'The ledger owns the balances, so it can check them. The group may also assert it after calling the ledger.' },
          { id: 'plan', text: 'Suggest the fewest practical payments that settle everyone', owner: 'settlement', alt: ['ledger'], why: 'Planning reads balances but is a separate job with its own algorithm.' },
        ],
        walk: { title: 'Add a €100 dinner paid by Ana, shared by Ana, Ben and Cleo', steps: [
          { prompt: 'Who receives the request and checks the three people are members?', owner: 'group', call: 'group.add_expense("ana", 10000, ["ana", "ben", "cleo"])' },
          { prompt: 'Who holds the fact “Ana paid 10000 cents for three people”?', owner: 'expense', call: 'Expense(payer="ana", amount_cents=10000, people=[...])' },
          { prompt: 'Who turns 10000 cents into 3334, 3333 and 3333?', owner: 'split', call: 'split.shares(10000, ["ana", "ben", "cleo"])' },
          { prompt: 'Who applies the shares and keeps the balances at zero?', owner: 'ledger', call: 'ledger.apply(expense, shares)' },
        ] },
      },
      help: {
        hint: 'Which job would have to change when you add percentage splits?',
        walkthrough: [
          { text: 'Group is the entry point: it checks members, then hands the bill on.', focus: ['group'] },
          { text: 'Expense is a small record: payer, amount, people.', focus: ['exp'] },
          { text: 'The share calculation is the part that varies, so it sits behind an interface.', focus: ['split', 'equal'] },
          { text: 'Ledger applies shares to balances and checks they add up to zero.', focus: ['ledger'] },
        ],
        solution: [
          { type: 'code', lang: 'python', code: py('sdm/cases/expenses.py', 'settle'), caption: 'python/sdm/cases/expenses.py — Settlement is a separate job that only reads balances' },
          { type: 'p', text: 'Group coordinates; Expense records; SplitRule varies; Ledger keeps the money invariant; Settlement plans payments.' },
        ],
        why: 'The job that is most likely to change (how a bill is split) is isolated behind an interface, and the invariant lives with the data it protects.',
      },
      lessons: ['responsibilities', 'pattern-strategy', 'cohesion-coupling'],
    },
    {
      id: 'settle', title: 'Recorded twice', intro: 'The interviewer changes one condition. Predict, run it, revise.',
      question: 'Ben pays Ana back €20. Ben taps “I paid” while Ana taps “Ben paid me”. Is the payment recorded once?',
      change: { announce: 'New condition: both people have the app open. Ben records “I paid Ana €20” and Ana records “Ben paid me €20” within the same second.', rule: RULES.timeline, alternate: { announce: 'Second twist: the phone has no signal, so Ben’s tap is retried automatically when it reconnects.', label: 'Retry after a lost connection' } },
      activity: {
        kind: 'timeline', names: ['Ben (taps “I paid”)', 'Ana (taps “Ben paid me”)'], resource: 'Ben’s open debt to Ana (payments still to record)', initial: 1,
        read: 'sees the €20 still owed', write: 'records the €20 payment',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'Read the balance, then write the new one', detail: 'Each screen computes the new balance from the one it read, so both write “debt is now settled” and both payments are added.', code: 'debt = ledger.owed("ben", "ana")\nif debt >= 2000:\n    ledger.record_payment("ben", "ana", 2000)' },
          { id: 'conditional', label: 'Record with a payment id that can be used once', detail: 'The write says “record payment p-17 only if it is not recorded yet”. The second request finds it and changes nothing.', code: 'ledger.record_payment(payment_id="p-17", ...)  # ignored if p-17 exists' },
          { id: 'lock', label: 'Lock the group while recording', detail: 'The second request waits, then sees the debt is already settled.', code: 'with group.lock:\n    ledger.record_payment(...)' },
        ],
        predict: { q: 'With read-then-write, how many €20 payments are recorded?', choices: [{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }, { id: 'none', label: 'None' }] },
      },
      help: {
        hint: 'Does the second screen know the first one already wrote?',
        walkthrough: [
          { text: 'Both screens read “Ben owes €20”. That was true when they read it.' },
          { text: 'Each then writes “settled”. Neither write checks again, so the payment is counted twice.' },
          { text: 'A payment id the store accepts only once turns the second write into a harmless no-op, and also protects automatic retries.' },
        ],
        solution: [{ type: 'p', text: 'Give every payment an id made on the device. Record it as “only if this id is new”. The same id then makes retries safe as well as double taps. A lock around the group works inside one server but cannot tell a retry from a second genuine €20 payment.' }],
        why: '“Recorded once” must hold for every caller, so the check has to be inside the write, not before it.',
      },
      lessons: ['concurrency-lld', 'locking-mvcc'],
    },
  ],
  rules: [
    { id: 'keys-coach', stage: 'keys', when: { not: { result: 'keys:q1', is: ['one-partition', 'index', 'scatter'] } }, coach: 'Pick the partition key that matches the screen people open most, then press “Test this query”.' },
    { id: 'keys-q1-scatter', stage: 'keys', when: { result: 'keys:q1', is: 'scatter' }, priority: 6, ask: { text: 'Your first query, one group’s details, asks every partition. What is it filtering on that your key does not cover?', choices: [
      { id: 'group', label: 'group_id: the key should be group_id', reply: 'Yes. Everything about one group then lives together, in time order. Change the key and test again.', verdict: 'sound' },
      { id: 'more', label: 'Nothing; add more partitions', reply: 'More partitions makes a scatter ask more machines. The fix is a key that matches the query.', verdict: 'risky' },
    ] }, gap: { text: 'The key does not match the most common query, so opening a group asks every partition.', fix: 'Key on group_id sorted by created_at and test again.', stage: 'keys', lesson: 'access-patterns' } },
    { id: 'keys-ok', stage: 'keys', when: { result: 'keys:q1', is: 'one-partition' }, ack: 'Opening one group reads a single partition, already in time order.', strength: 'You keyed the shares on the group, so the screen people open most reads one partition.' },
    { id: 'keys-stored', stage: 'keys', when: { result: 'keys:tradeoff', is: 'stored' }, priority: 5, ask: { text: 'A stored balance per person is a valid alternative to an index. A write adds the share entries but fails before updating the stored balance. What would show the problem?', choices: [
      { id: 'sum', label: 'A check that the balances sum to zero, and a way to rebuild them from entries', reply: 'Yes. Entries are the source of truth; the stored balance is a cache you can rebuild and verify.', verdict: 'sound' },
      { id: 'txn', label: 'Write entries and balance in one transaction', reply: 'Good where the store allows it. Keep the check anyway: bugs can bypass the transaction.', verdict: 'sound' },
      { id: 'trust', label: 'Nothing is needed; the arrow shows both are written', reply: 'An arrow cannot show that two writes happen together. Without a check, the copies drift silently.', verdict: 'risky' },
    ] }, gap: { text: 'A stored balance can drift from the entries with no way to notice.', fix: 'Add a zero-sum check and a rebuild-from-entries path.', stage: 'keys', lesson: 'contracts-invariants' } },
    { id: 'keys-recompute', stage: 'keys', when: { result: 'keys:tradeoff', is: 'recompute' }, ask: { text: 'Recomputing from entries is always correct. At what point would you stop recomputing?', choices: [
      { id: 'slow', label: 'When the all-groups screen is opened often enough to feel slow', reply: 'Right. Measure first; then add an index or a stored balance with a check.', verdict: 'sound' },
      { id: 'never', label: 'Never; it is always correct so it is always fine', reply: 'Correct but not free: with a few thousand bills per group, a frequent screen would scan a lot.', verdict: 'partial' },
    ] } },
    { id: 'keys-risky', stage: 'keys', when: { result: 'keys:tradeoff', is: 'key-person' }, gap: { text: 'Keying on person makes every bill write to up to 20 partitions and every group screen read from them.', fix: 'Key on group_id and use an index or stored balance for the person view.', stage: 'keys', lesson: 'access-patterns' } },
    { id: 'roles-coach', stage: 'roles', when: { not: { result: 'roles', is: ['pass', 'gaps'] } }, coach: 'Start with the card most likely to change: how a bill is split.' },
    { id: 'roles-good', stage: 'roles', when: { result: 'roles', is: 'pass' }, ack: 'Each job sits with the object that owns its data.', strength: 'You isolated the split calculation and gave the zero-sum check to the object that owns the balances.' },
    { id: 'roles-gap', stage: 'roles', when: { result: 'roles', is: 'gaps' }, gap: { text: 'Some jobs were given to objects that do not own the data they need.', fix: 'Reassign the cards marked “reconsider” and walk through the dinner bill again.', stage: 'roles', lesson: 'responsibilities' } },
    { id: 'roles-split-ask', stage: 'roles', when: { result: 'roles', is: 'pass' }, priority: 4, ask: { text: 'Later we add “Ana 50%, Ben 30%, Cleo 20%”. A method on Expense could also do that. Why keep SplitRule separate?', choices: [
      { id: 'strategy', label: 'Each split kind becomes its own class; Expense and Ledger do not change', reply: 'Yes. That is the Strategy pattern: the part that varies sits behind an interface.', verdict: 'sound' },
      { id: 'branch', label: 'An if/else on split kind inside Expense is simpler', reply: 'Fine for two kinds. Each new kind then edits Expense, and every branch must keep the shares adding up.', verdict: 'partial' },
    ] } },
    { id: 'alt-split', when: { all: [{ has: { type: 'equal' } }, { lacks: { type: 'split' } }] }, ask: { text: 'You have EqualSplit but no SplitRule. That works while splits are equal. What does the first percentage split change?', choices: [
      { id: 'caller', label: 'Every caller that uses EqualSplit', reply: 'Yes. An interface lets callers depend on “a split” instead of one kind.', verdict: 'sound' },
      { id: 'nothing', label: 'Nothing, the new class just slots in', reply: 'Not without a common interface; callers name EqualSplit directly.', verdict: 'risky' },
    ] } },
    { id: 'settle-fixed', stage: 'settle', when: { result: 'settle', is: 'one' }, ack: 'The payment was recorded once, so balances still add up to zero.', strength: 'You made “record payment” safe against a double tap by putting the check inside the write.' },
    { id: 'settle-over', stage: 'settle', when: { result: 'settle', is: 'oversold' }, priority: 5, ask: { text: 'Both screens read “Ben owes €20”, and both recorded a payment. Where must the check live?', choices: [
      { id: 'inwrite', label: 'Inside the write: record only if this payment id is new', reply: 'Yes. It also makes automatic retries safe. Switch the guard and run again.', verdict: 'sound' },
      { id: 'lock', label: 'A lock on the group', reply: 'That works inside one server. Retries from a phone after a lost connection are still a separate request, so keep an id as well.', verdict: 'partial' },
      { id: 'warn', label: 'Show a warning if the debt looks settled', reply: 'The warning is shown from a read that may already be stale. The write itself must refuse.', verdict: 'risky' },
    ] }, gap: { text: 'Two screens recording the same payment counted it twice.', fix: 'Give each payment an id and record it only if the id is new.', stage: 'settle', lesson: 'concurrency-lld' } },
    { id: 'settle-cant-show', stage: 'settle', when: { result: 'settle', is: 'one' }, priority: 3, ask: { text: 'Your guard stopped the double tap. The timeline cannot show what the second person sees. What should Ana’s screen say?', choices: [
      { id: 'already', label: 'That the payment is already recorded, with the current balance', reply: 'Yes. A refused duplicate is a success from the user’s point of view; say so.', verdict: 'sound' },
      { id: 'error', label: 'An error', reply: 'It would make Ana think nothing was saved. The payment is recorded; the screen should say so.', verdict: 'partial' },
    ] } },
  ],
  solution: {
    design: {
      comps: [
        { id: 'group', type: 'group', kind: 'class', label: 'Group', x: 60, y: 200 },
        { id: 'exp', type: 'expense', kind: 'class', label: 'Expense', x: 240, y: 200 },
        { id: 'split', type: 'split', kind: 'iface', label: 'SplitRule', x: 420, y: 90 },
        { id: 'equal', type: 'equal', kind: 'class', label: 'EqualSplit', x: 560, y: 90 },
        { id: 'ledger', type: 'ledger', kind: 'class', label: 'Ledger', x: 420, y: 300 },
        { id: 'settle', type: 'settlement', kind: 'class', label: 'Settlement', x: 560, y: 380 },
      ],
      links: [
        { id: 'g-e', from: 'group', to: 'exp', label: 'has many' },
        { id: 'e-s', from: 'exp', to: 'split', label: 'uses' },
        { id: 'eq-s', from: 'equal', to: 'split', label: 'implements' },
        { id: 'g-l', from: 'group', to: 'ledger', label: 'uses' },
        { id: 'l-st', from: 'ledger', to: 'settle', label: 'creates' },
      ],
    },
    why: {
      group: 'Entry point. Checks that everyone named is a member, then passes the bill on and serialises changes to this group.',
      exp: 'An immutable record: payer, amount in cents, people. History comes from these.',
      split: 'The part that varies. Any rule must return shares that add up to the amount.',
      equal: 'Equal split: divmod, then one extra cent to the first people until the remainder is used up.',
      ledger: 'Applies shares to net balances and asserts they add up to zero. Balances can always be rebuilt from the expenses.',
      settle: 'Reads balances and returns the payments that zero them, matching the largest debtor to the largest creditor.',
    },
    alternatives: {
      split: { types: ['class'], tradeoff: 'A plain function or one class with an if on split kind is shorter for two kinds, but every new kind edits the same code.' },
      ledger: { types: ['class'], tradeoff: 'Computing balances from the expenses on demand removes the copy that can drift; it costs a scan per read.' },
    },
    trace: { title: 'Add a €100 dinner paid by Ana, shared by three', steps: [
      { from: 'group', to: 'exp', text: 'Builds Expense(payer=ana, 10000, [ana, ben, cleo]) after checking all three are members.' },
      { from: 'exp', to: 'equal', text: 'Asks the split rule for shares: 3334, 3333, 3333.' },
      { from: 'group', to: 'ledger', text: 'ledger.apply: Ana +10000, then each share subtracted: Ana +6666, Ben −3333, Cleo −3333.' },
      { from: 'ledger', to: 'settle', text: 'On request, plans payments: Ben pays Ana 3333, Cleo pays Ana 3333.' },
    ] },
    tradeoff: 'Balances derived from immutable bills are always explainable and sum to zero, but cost a scan; a stored balance is fast but is a copy you must check.',
    otherApproach: 'For a single device and a handful of bills, one function over a list of expenses is enough. Objects pay off once splits vary and several people write at once.',
  },
};
