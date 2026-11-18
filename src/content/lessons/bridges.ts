import type { GenericLesson } from '../lessonTypes';
import { chain, e, layout, n, py, pyLine } from './_kit';

const TINY_GET = py('sdm/tiny_map.py', 'bucket_for');
const UNSAFE = py('sdm/counter.py').split('\n\n\nclass SafeCounter')[0];
const SAFE_INC = `def increment(self):\n    with self.lock:           # only one thread at a time runs the block\n        self.value = self.value + 1`;
const CHECKOUT = py('sdm/payments.py', 'checkout');

export const bridgeJson: GenericLesson = {
  id: 'bridge-json',
  area: 'Bridges',
  opening: 'When Maya taps Reserve, her phone sends the server a few lines of text. Both sides have to agree on exactly what those lines mean, or the booking fails with an error nobody saw coming.',
  visual: { kind: 'compare' },
  steps: [
    {
      kicker: 'Idea', title: 'Text both sides can read',
      body: ['**JSON** is a text format for data. Curly braces hold named fields, square brackets hold lists, and values are strings, numbers, `true`/`false` or `null`. Python reads it into dicts and lists with `json.loads`.'],
      compare: {
        left: { title: 'What the phone sends', points: ['`{"seat": "F12", "buyer": "Maya", "price": 4500}`'] },
        right: { title: 'What Python sees after json.loads', points: ['`{"seat": "F12", "buyer": "Maya", "price": 4500}`, a dict', '`body["price"]` → `4500`, an int'] },
      },
    },
    {
      kicker: 'Idea', title: 'Nesting and lists',
      body: ['Fields can hold other objects or lists. A whole order fits in one value: a list of seats, each with its own fields.'],
      compare: {
        left: { title: 'Order JSON', points: ['`{"order": 91, "seats": [{"id": "F12"}, {"id": "F13"}], "paid": false}`'] },
        right: { title: 'Reading it in Python', points: ['`body["seats"][1]["id"]` → `"F13"`', '`len(body["seats"])` → `2`', '`body["paid"]` → `False`'] },
      },
    },
    {
      kicker: 'Failure', title: 'A small change breaks the other side',
      body: ['A server developer “tidies up” prices to strings with a currency: `"45.00 EUR"`. Phones still running the old app do `price / 100`, and the app crashes on a string.'],
      compare: {
        left: { title: 'Version 1', points: ['`"price": 4500`', 'Old app: `4500 / 100` → `45.0`'], tone: 'ok', verdict: 'works' },
        right: { title: 'Version 2', points: ['`"price": "45.00 EUR"`', 'Old app: dividing a string → error'], tone: 'fail', verdict: 'breaks old apps' },
        focus: 'right',
      },
      predict: {
        id: 'safe-change', prompt: 'Which change can the server make without breaking phones still running the old app?',
        choices: [
          { id: 'add', text: 'Add a new field `"currency": "EUR"` and keep `price` as it is.', why: 'Right. Old apps ignore fields they don’t know, and new apps can read both.' },
          { id: 'rename', text: 'Rename `price` to `amount`.', why: 'Old apps look for `price`, find nothing, and fail.' },
          { id: 'type', text: 'Send `price` as `45.0` (a float) instead of `4500`.', why: 'Old apps would show €0.45. The type survived but the meaning changed.' },
        ],
        correct: 'add',
      },
    },
  ],
  worked: {
    title: 'parse, read, and change safely',
    blocks: [
      { type: 'code', lang: 'python', code: 'import json\n\nbody = json.loads(\'{"seat": "F12", "price": 4500, "currency": "EUR"}\')\nprint(body["seat"])           # F12\nprint(body["price"] / 100)    # 45.0\nprint(body.get("discount", 0)) # 0 — .get gives a default for a missing field', caption: 'New Python: `json.loads` turns JSON text into dicts and lists; `dict.get(key, default)` avoids a crash on missing fields.' },
      { type: 'p', text: 'The safe habit: **add** fields, never repurpose them. Readers should tolerate fields they don’t know and supply defaults for fields that are missing. You’ll meet this again in [Schema evolution](/learn/schema-evolution).' },
    ],
  },
  checks: [
    { kind: 'choice', id: 'q1', prompt: 'What does `json.loads(\'{"seats": ["F12", "F13"]}\')["seats"][0]` return?', choices: [
      { id: 'a', text: '`"F12"`', why: 'Right: the first item of the list stored under "seats".' },
      { id: 'b', text: '`["F12", "F13"]`', why: 'That’s the whole list; `[0]` picks its first item.' },
      { id: 'c', text: 'An error', why: 'The JSON is valid and the indexes exist.' },
    ], correct: 'a' },
  ],
  exercise: { id: 'why', prompt: 'Why is renaming a JSON field riskier than adding one?', checklist: ['Mentions that old clients still look for the old name.', 'Mentions that unknown new fields are usually ignored.'], model: 'Clients already in users’ pockets still read the old name and break when it disappears. A new field is simply ignored by clients that don’t know it.' },
  next: { id: 'bridge-sql', reason: 'JSON carries data between programs. SQL is how the server asks the database for it.' },
};

export const bridgeMaps: GenericLesson = {
  id: 'bridge-maps',
  area: 'Bridges',
  opening: 'A stadium has 60,000 seats. The server needs F12’s status *now*, not after checking 60,000 rows one by one. A hash map finds it in about one step, however many seats there are.',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [
        n('key', 'box', 'key "F12"'),
        n('hash', 'service', 'hash function', { sub: 'key → number' }),
        n('b0', 'box', 'bucket 0', { value: '' }),
        n('b1', 'box', 'bucket 1', { value: '' }),
        n('b2', 'box', 'bucket 2', { value: '' }),
        n('b3', 'box', 'bucket 3', { value: '' }),
      ],
      edges: [e('key', 'hash'), e('hash', 'b0', undefined, { dashed: true }), e('hash', 'b1', undefined, { dashed: true }), e('hash', 'b2', undefined, { dashed: true }), e('hash', 'b3', undefined, { dashed: true })],
      ...layout(330, 470, {
        key: [{ x: 100, y: 165, w: 140 }, { x: 180, y: 45, w: 160 }],
        hash: [{ x: 330, y: 165, w: 170 }, { x: 180, y: 160, w: 190 }],
        b0: [{ x: 650, y: 45, w: 230, h: 56 }, { x: 95, y: 300, w: 160, h: 64 }],
        b1: [{ x: 650, y: 125, w: 230, h: 56 }, { x: 265, y: 300, w: 160, h: 64 }],
        b2: [{ x: 650, y: 205, w: 230, h: 56 }, { x: 95, y: 410, w: 160, h: 64 }],
        b3: [{ x: 650, y: 285, w: 230, h: 56 }, { x: 265, y: 410, w: 160, h: 64 }],
      }),
    },
  },
  steps: [
    { kicker: 'Problem', title: 'Searching every seat is slow', body: ['Looking through a list means checking items one by one: 60,000 seats, up to 60,000 checks. A **hash map** (Python’s `dict`) skips the search.'], view: { hide: ['hash', 'b0', 'b1', 'b2', 'b3'] } },
    { kicker: 'Watch', title: 'Turn the key into a number', body: ['A **hash function** turns the key into a number, always the same number for the same key. Ours adds up the character codes of "F12" and takes the remainder after dividing by 4, the number of buckets: bucket 1.'], view: { tokens: [{ from: 'key', to: 'hash', label: '"F12"', tone: 'request' }] }, code: { code: TINY_GET, highlight: [2], caption: 'python/sdm/tiny_map.py — a deliberately simple hash for teaching' } },
    { kicker: 'Watch', title: 'Go straight to one bucket', body: ['The number says which **bucket** to look in. Storing F12 puts it in bucket 1. Finding it later repeats the same arithmetic and looks only in bucket 1. The other buckets are never touched.'], view: { values: { b1: 'F12 → Maya' }, states: { b1: 'focus' }, tokens: [{ from: 'hash', to: 'b1', label: 'bucket 1', tone: 'response' }] }, changes: [{ kind: 'add', text: 'bucket 1: F12 → Maya' }] },
    { kicker: 'Predict', title: 'Two keys, one bucket', body: ['"F21" has the same characters as "F12", so our simple hash sends it to the same bucket. That is a **collision**.'], view: { values: { b1: 'F12 → Maya, F21 → Leo' }, states: { b1: 'active' }, tags: { b1: { text: 'collision', tone: 'changed' } } },
      predict: { id: 'collide', prompt: 'Bucket 1 now holds F12 and F21. What does `get("F21")` do?', choices: [
        { id: 'scan', text: 'Goes to bucket 1 and compares keys until it finds F21.', why: 'Right. Each bucket is a short list, so a collision costs a comparison or two, not a full search.' },
        { id: 'wrong', text: 'Returns Maya, the first value in the bucket.', why: 'The map stores keys next to values and compares them, so it never confuses F12 with F21.' },
        { id: 'error', text: 'Raises an error because two keys share a bucket.', why: 'Collisions are normal. Buckets hold several pairs.' },
      ], correct: 'scan' } },
    { kicker: 'Trade-off', title: 'Why lookups stay fast', body: ['Real hash functions spread keys evenly, and maps add buckets as they fill. Each bucket stays short, so a lookup is about one step whether there are 10 seats or 10 million. The rule for keys: they must not change after insertion, or the map will look in the wrong bucket.'], view: { values: { b0: 'A1 → —', b1: 'F12 → Maya', b2: 'C7 → Ana', b3: 'F21 → Leo' } } },
  ],
  worked: { title: 'the tiny map, end to end', blocks: [
    { type: 'code', lang: 'python', code: py('sdm/tiny_map.py'), caption: 'python/sdm/tiny_map.py — tested with pytest. Python’s own dict works on the same idea with a far better hash.' },
    { type: 'p', text: 'Python’s `dict` and Java’s `HashMap` both work this way. In Python you only need `seats["F12"] = "Maya"` and `seats.get("F12")`.' },
  ] },
  checks: [
    { kind: 'choice', id: 'q1', prompt: 'Why can’t a Python list be used as a dict key?', choices: [
      { id: 'a', text: 'A list can change after insertion, so its hash could change and the map would look in the wrong bucket.', why: 'Right. Keys must be immutable (strings, numbers, tuples).' },
      { id: 'b', text: 'Lists are too long to hash.', why: 'Length isn’t the problem. Mutability is.' },
    ], correct: 'a' },
    { kind: 'numeric', id: 'q2', prompt: 'Our simple hash adds character codes: "A" is 65 and "1" is 49. Which bucket (out of 4) does key "A1" land in?', answer: 2, tolerance: 0.01, unit: '', solution: ['65 + 49 = 114', '114 ÷ 4 = 28 remainder 2', 'bucket 2'] },
  ],
  exercise: { id: 'why-fast', prompt: 'In one or two sentences: why does a dict lookup not slow down as the dict grows?', checklist: ['Mentions that the hash points straight to one bucket.', 'Mentions that buckets stay short because the map grows its bucket count.'], model: 'The hash of the key points straight to one bucket, so you never scan the others; the map adds buckets as it fills so each one stays short.' },
  next: { id: 'bridge-linked-lists', reason: 'Maps find things fast but don’t keep an order. Linked lists keep order cheaply. Together they make the LRU cache.' },
};

export const bridgeLinkedLists: GenericLesson = {
  id: 'bridge-linked-lists',
  area: 'Bridges',
  opening: 'A waiting list has 10,000 people. Someone in the middle cancels. In a Python list, everyone behind them shifts forward one slot. In a linked list, two pointers change and nobody moves.',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('head', 'box', 'head'), n('A', 'box', 'Ana'), n('B', 'box', 'Ben'), n('C', 'box', 'Cleo'), n('tail', 'box', 'tail')],
      edges: [e('head', 'A'), e('A', 'B', '⇄'), e('B', 'C', '⇄'), e('C', 'tail'), e('A', 'C', 'skip', { state: 'ghost' })],
      ...chain(['head', 'A', 'B', 'C', 'tail'], { w: 110, wideH: 240, gapY: 96 }),
    },
  },
  steps: [
    { kicker: 'Idea', title: 'Each item knows its neighbours', body: ['In a **doubly linked list**, every node stores its value plus two pointers: one to the node before it (`prev`) and one to the node after it (`next`). The list itself only remembers the first node (`head`) and the last (`tail`).'] },
    { kicker: 'Try it', title: 'Ben cancels', body: ['To remove Ben, point Ana’s `next` at Cleo and Cleo’s `prev` at Ana. Ben is no longer reachable. Nothing else moved.'], view: { states: { B: 'fail', A: 'active', C: 'active' }, edgeStates: { 'A-C': 'active', 'A-B': 'ghost', 'B-C': 'ghost' }, tags: { B: { text: 'unlinked', tone: 'fail' } } }, changes: [{ kind: 'chg', text: 'Ana.next → Cleo' }, { kind: 'chg', text: 'Cleo.prev → Ana' }],
      code: { code: 'def unlink(node):\n    node.prev.next = node.next\n    node.next.prev = node.prev\n    node.prev = node.next = None', highlight: [2, 3], caption: 'Two pointer changes, whatever the list length (ignoring the head/tail special cases)' } },
    { kicker: 'Predict', title: 'What did it cost?', body: ['Count the work: two pointer assignments. With 10,000 people in the queue it would still be two.'], view: { hide: ['B'], edgeStates: { 'A-C': 'idle', 'A-B': 'ghost', 'B-C': 'ghost' } },
      predict: { id: 'cost', prompt: 'You *already hold* a reference to the node to remove. How does the work grow with list length?', choices: [
        { id: 'const', text: 'It doesn’t: constant time, O(1).', why: 'Right. Only the neighbours’ pointers change.' },
        { id: 'linear', text: 'It grows with the list: O(n).', why: 'Only *finding* a node by value takes a walk. Once you hold it, removal is two assignments. A dict can hand you the node instantly, which is the LRU trick.' },
      ], correct: 'const' } },
  ],
  worked: { title: 'Python list vs linked list', blocks: [
    { type: 'table', head: ['Operation', 'Python list', 'Doubly linked list'], rows: [
      ['Read item #5,000', 'one step', 'walk 5,000 nodes'], ['Remove an item you hold', 'shift everything after it', 'change 2 pointers'], ['Add at the front', 'shift everything', 'change 2 pointers'], ['Find by value', 'scan', 'scan'],
    ] },
    { type: 'p', text: 'Neither is “better”. Lists win at reading by position, and linked lists win at reordering. The [LRU cache](/learn/lru-cache) uses both: a dict to find a node, and a linked list to move it.' },
  ] },
  checks: [{ kind: 'order', id: 'push-front', prompt: 'Put the steps for adding node N at the **front** of a non-empty list in order.', items: ['Set `N.next = head`', 'Set `head.prev = N`', 'Set `head = N`'], explain: 'Link the new node to the old head first, then point the old head back at it, then move `head`. Moving `head` first would lose the old head.' }],
  exercise: { id: 'when', prompt: 'Name one situation where a linked list beats a Python list, and why.', checklist: ['Names frequent insertion/removal or reordering.', 'Explains that no items have to shift.'], model: 'A recency list that constantly moves items to the front: each move is a couple of pointer changes instead of shifting every item behind it.' },
  next: { id: 'lru-cache', reason: 'You now have both halves of the LRU cache: a map to find, a linked list to reorder.' },
};

export const bridgeSql: GenericLesson = {
  id: 'bridge-sql',
  area: 'Bridges',
  opening: 'The booking server needs “every seat in row F that is still free”. It doesn’t loop over rows itself. It sends the database one sentence of SQL and gets back exactly those rows.',
  visual: { kind: 'compare' },
  steps: [
    { kicker: 'Idea', title: 'Tables, rows, columns', body: ['A relational database stores data in **tables**. Each row is one thing (a seat), and each column is one fact about it. **SQL** is the language for asking questions and making changes.'],
      compare: { left: { title: 'seats table', points: ['`F12 | row F | free`', '`F13 | row F | held`', '`G01 | row G | free`'] }, right: { title: 'Query', points: ['`SELECT id FROM seats WHERE row = \'F\' AND status = \'free\';`', '→ `F12`'] } } },
    { kicker: 'Watch', title: 'Change only what matches', body: ['`UPDATE` changes rows and `WHERE` decides which. Booking F12 changes one row.'],
      compare: { left: { title: 'Before', points: ['`F12 | free`', '`F13 | held`', '`G01 | free`'] }, right: { title: 'After', points: ['`UPDATE seats SET status = \'booked\' WHERE id = \'F12\';`', '`F12 | booked` ← 1 row changed', '`F13 | held`', '`G01 | free`'], tone: 'ok' }, focus: 'right' } },
    { kicker: 'Failure', title: 'Forget the WHERE', body: ['A tired engineer runs the same statement without `WHERE`.'],
      compare: { left: { title: 'Intended', points: ['`UPDATE seats SET status = \'booked\' WHERE id = \'F12\';`', '1 row'], tone: 'ok' }, right: { title: 'Ran', points: ['`UPDATE seats SET status = \'booked\';`', '**every** row booked: the whole venue sold out'], tone: 'fail' }, focus: 'right' },
      predict: { id: 'rows', prompt: 'The venue has 60,000 seats. How many rows does the second statement change?', choices: [
        { id: 'all', text: '60,000', why: 'Right. No `WHERE` means every row. This is why production changes go through reviews and backups exist.' },
        { id: 'one', text: '1', why: 'Without `WHERE` there’s nothing limiting it to F12.' },
      ], correct: 'all' } },
    { kicker: 'Idea', title: 'Combine tables with JOIN', body: ['Bookings live in their own table. A **JOIN** matches rows across tables, here each booking with its buyer’s name.'],
      compare: { left: { title: 'bookings + buyers', points: ['bookings: `F12 | buyer 7`', 'buyers: `7 | Maya`'] }, right: { title: 'Query', points: ['`SELECT b.seat, u.name FROM bookings b JOIN buyers u ON u.id = b.buyer_id;`', '→ `F12 | Maya`'] } } },
  ],
  worked: { title: 'four statements you will see everywhere', blocks: [
    { type: 'code', lang: 'sql', code: "-- read\nSELECT id, status FROM seats WHERE row = 'F';\n-- add\nINSERT INTO bookings (seat, buyer_id) VALUES ('F12', 7);\n-- change (always with WHERE)\nUPDATE seats SET status = 'booked' WHERE id = 'F12' AND status = 'free';\n-- combine\nSELECT b.seat, u.name FROM bookings b JOIN buyers u ON u.id = b.buyer_id;" },
    { type: 'p', text: 'Notice `AND status = \'free\'` in the UPDATE: the database changes the row only if it is still free. That one condition is the fix for the race in the first lesson, and you’ll test it in [Concurrent reservations](/labs/concurrent-reservations).' },
  ] },
  checks: [
    { kind: 'choice', id: 'q1', prompt: '`UPDATE seats SET status = \'booked\' WHERE id = \'F12\' AND status = \'free\';` runs when F12 is already booked. How many rows change?', choices: [
      { id: '0', text: '0', why: 'Right. The WHERE no longer matches, so nothing changes, and the app can tell the buyer it’s gone.' },
      { id: '1', text: '1', why: 'The row doesn’t match `status = \'free\'` any more.' },
    ], correct: '0' },
  ],
  exercise: { id: 'where', prompt: 'Why might a booking UPDATE include the seat’s current status in its WHERE clause?', checklist: ['Says the update only happens if the seat is still free.', 'Connects it to two buyers racing.'], model: 'So the database only books the seat if it is still free at the moment of the write; if another buyer got there first, zero rows change and we can say “sold out”.' },
  next: { id: 'access-patterns', reason: 'Now that you can ask a database questions, the next step is deciding what tables to have, starting from the questions the app will ask.' },
};

export const bridgeInterfaces: GenericLesson = {
  id: 'bridge-interfaces',
  area: 'Bridges',
  opening: 'Checkout must accept cards today and wallets next month. If checkout has to know every payment type, each new one means editing checkout. What if it only needed to know that a payment can `pay`?',
  visual: {
    kind: 'diagram',
    spec: {
      nodes: [n('checkout', 'service', 'checkout()', { sub: 'calls method.pay()' }), n('card', 'box', 'Card', { sub: 'pay(amount)' }), n('wallet', 'box', 'Wallet', { sub: 'pay(amount)' }), n('gift', 'box', 'GiftCard', { sub: 'pay(amount)' })],
      edges: [e('checkout', 'card', 'pay()'), e('checkout', 'wallet', 'pay()'), e('checkout', 'gift', 'pay()')],
      ...layout(300, 400, {
        checkout: [{ x: 160, y: 150, w: 200 }, { x: 180, y: 50, w: 220 }],
        card: [{ x: 620, y: 60, w: 180 }, { x: 70, y: 300, w: 120 }],
        wallet: [{ x: 620, y: 150, w: 180 }, { x: 180, y: 300, w: 100 }],
        gift: [{ x: 620, y: 240, w: 180 }, { x: 295, y: 300, w: 120 }],
      }),
    },
  },
  steps: [
    { kicker: 'Idea', title: 'Depend on what it can do', body: ['Checkout doesn’t care *what* the payment is, only that it has a `pay(amount)` method. That promise is an **interface**: a set of methods several classes agree to provide.'], view: { hide: ['wallet', 'gift'] }, code: { code: CHECKOUT, caption: 'python/sdm/payments.py' } },
    { kicker: 'Watch', title: 'A second class keeps the promise', body: ['`Wallet` also has `pay(amount)`. Checkout calls it the same way. Checkout’s code did not change.'], view: { hide: ['gift'], states: { wallet: 'focus' }, tokens: [{ from: 'checkout', to: 'wallet', label: 'pay(1500)', tone: 'request' }] }, changes: [{ kind: 'add', text: 'Wallet with pay(amount)' }] },
    { kicker: 'Idea', title: 'Python checks behaviour, not names', body: ['Python uses **duck typing**: if an object has the method, the call works. `typing.Protocol` writes the promise down so editors and type checkers can warn you early.'], view: { hide: ['gift'] }, code: { code: 'class PaymentMethod(Protocol):\n    def pay(self, amount_cents: int) -> str: ...', caption: 'New Python: a Protocol lists the methods a type must have. Card and Wallet never mention it, they just match.' } },
    { kicker: 'Predict', title: 'Add a gift card', body: ['Next month: gift cards.'], view: { states: { gift: 'active' } },
      predict: { id: 'gift', prompt: 'You write `GiftCard` with a `pay(amount_cents)` method. What has to change in `checkout`?', choices: [
        { id: 'none', text: 'Nothing.', why: 'Right. Checkout depends on the interface, not on concrete classes.' },
        { id: 'if', text: 'Add `if isinstance(method, GiftCard): ...`', why: 'That’s exactly what interfaces let you avoid. Every new type would mean another branch in checkout.' },
      ], correct: 'none' } },
  ],
  worked: { title: 'the full example', blocks: [{ type: 'code', lang: 'python', code: py('sdm/payments.py'), caption: 'python/sdm/payments.py — tested with pytest' }] },
  checks: [{ kind: 'choice', id: 'q1', prompt: 'A `Voucher` class has `redeem(amount)` but no `pay`. What happens if you pass it to checkout?', choices: [
    { id: 'err', text: '`AttributeError` when checkout calls `pay`.', why: 'Right. The object doesn’t keep the promise. A type checker using the Protocol would warn you before running.' },
    { id: 'ok', text: 'It works, because Python finds `redeem` instead.', why: 'Python calls exactly the method named, `pay`.' },
  ], correct: 'err' }],
  exercise: { id: 'why', prompt: 'What does checkout gain by depending on `pay()` instead of on `Card`?', checklist: ['New payment types can be added without editing checkout.', 'Checkout can be tested with a fake payment.'], model: 'New payment types plug in without touching checkout, and tests can pass in a fake that records the call instead of charging a real card.' },
  next: { id: 'responsibilities', reason: 'Interfaces are the first tool of low-level design. Next: deciding which object should be responsible for what.' },
};

export const bridgeThreads: GenericLesson = {
  id: 'bridge-threads',
  area: 'Bridges',
  opening: 'Two threads each add 1 to a counter that starts at 0. You expect 2. Sometimes you get 1. Nothing crashed and no error was printed. Where did the other increment go?',
  visual: {
    kind: 'timeline',
    unit: 'step',
    lanes: [{ id: 'a', label: 'Thread A' }, { id: 'b', label: 'Thread B' }, { id: 'v', label: 'counter' }],
    events: [
      { t: 1, lane: 'a', label: 'read 0' },
      { t: 2, lane: 'b', label: 'read 0', tone: 'active' },
      { t: 3, lane: 'a', label: 'write 1', to: { lane: 'v', t: 3.4 } },
      { t: 4, lane: 'v', label: 'value 1' },
      { t: 5, lane: 'b', label: 'write 1', tone: 'fail', to: { lane: 'v', t: 5.4 } },
      { t: 6, lane: 'v', label: 'value 1 ✕', tone: 'fail' },
    ],
  },
  steps: [
    { kicker: 'Idea', title: 'One line, three steps', body: ['`self.value = self.value + 1` looks like one action, but the computer does three: **read** the value, **add** 1, **write** it back. A **thread** is a sequence of steps the program runs. With two threads, their steps can interleave in any order.'], timeline: { upTo: 0 }, code: { code: UNSAFE, highlight: [6, 7, 8], caption: 'python/sdm/counter.py — the three steps, written out' } },
    { kicker: 'Watch', title: 'Both read before either writes', body: ['Thread A reads 0. Before A writes, the scheduler switches to Thread B, which also reads 0.'], timeline: { upTo: 2 } },
    { kicker: 'Predict', title: 'Now both write', body: ['Each thread adds 1 to what *it* read.'], timeline: { upTo: 2 },
      predict: { id: 'final', prompt: 'A writes its result, then B writes its result. What is the final value?', choices: [
        { id: '1', text: '1', why: 'Right. Both computed 0 + 1. B’s write replaces A’s. This is a **lost update**.' },
        { id: '2', text: '2', why: 'B never saw A’s write; it computed from the 0 it read earlier.' },
      ], correct: '1' } },
    { kicker: 'Failure', title: 'A lost update', body: ['A wrote 1, then B wrote 1 over it. Two increments, one result. This is the same race as the two concert buyers: a check (read) and a change (write) with a gap between them.'], timeline: { upTo: 6 }, changes: [{ kind: 'del', text: 'Thread A’s increment lost' }] },
    { kicker: 'Fix', title: 'One thread at a time', body: ['A **lock** lets only one thread run the read-add-write block at a time. The other thread waits. It’s correct, at the cost of threads queueing at that line.'], timeline: { upTo: 6, focus: 3 }, code: { code: SAFE_INC, highlight: [2], caption: 'New Python: `with self.lock:` acquires the lock and always releases it at the end of the block.', open: true } },
  ],
  worked: { title: 'replaying the race deterministically', blocks: [
    { type: 'code', lang: 'python', code: py('sdm/counter.py', 'interleaved_lost_update'), caption: 'python/sdm/counter.py — the bad interleaving written out step by step, so the test is repeatable' },
    { type: 'p', text: 'Real races depend on timing, so they appear rarely and vanish when you add print statements. Replaying the exact interleaving makes the bug visible every time. Concurrency topics continue in [Races and deadlocks](/learn/concurrency-lld).' },
  ] },
  checks: [{ kind: 'line', id: 'gap', prompt: 'In `UnsafeCounter.increment`, after which line can another thread slip in and cause a lost update? Pick the earliest.', code: 'def increment(self):\n    current = self.value      # 1. read\n    current = current + 1     # 2. add\n    self.value = current      # 3. write', answer: [2], explain: 'Once the value is read, anything another thread writes before line 4 will be overwritten.', wrong: { 4: 'By then the damage is done. The gap opens right after the read.' } }],
  exercise: { id: 'link', prompt: 'How is the lost-update counter like the double-booked seat?', checklist: ['Both read a value, then write based on it.', 'Another actor changed it in between.'], model: 'In both, someone reads a value, decides what to write from it, and another thread or buyer writes in between, so one change silently overwrites the other.' },
  next: { id: 'processes-threads', reason: 'Threads are how one server serves many users at once. Next: processes, threads, concurrency and parallelism.' },
};

export const BRIDGE_LESSONS = [bridgeJson, bridgeMaps, bridgeLinkedLists, bridgeSql, bridgeInterfaces, bridgeThreads];
export { pyLine };
