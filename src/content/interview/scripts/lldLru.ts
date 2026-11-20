import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';
import { py } from '../../lessons/_kit';

export const lldLru: InterviewScript = {
  caseId: 'lld-lru',
  track: 'lld',
  doLine: 'Design an LRU cache: give each job to a dictionary or a list, assemble the classes, then keep it correct when two threads touch it at once',
  skills: ['object-design', 'concurrency', 'caching'],
  brief: {
    interviewer: { name: 'Dana', role: 'engineer running a machine-coding round' },
    intro: 'We need a small in-memory cache that forgets the entry nobody has used for the longest time. I care about the shape of the objects and what stays true after every call.',
    users: 'Other code in the same program: request handlers that call get and put, often from several threads.',
    needs: ['Store a value under a key, up to a fixed capacity', 'Look a value up by key', 'When full, drop the least recently used entry to make room'],
    mustHold: ['get and put each take constant time, not time proportional to the size', 'The cache never holds more than its capacity', 'Reading or updating a key makes it the most recently used one'],
    constraints: ['Capacity is fixed at construction and is at least 1', 'A miss returns None; put on an existing key updates it and does not evict', 'Up to 8 threads share one cache object', 'Only the standard library'],
    outOfScope: ['Expiry by time', 'Saving to disk', 'Sharing a cache between processes'],
    terms: [
      { term: 'LRU', meaning: 'least recently used: the entry whose last read or write is the oldest' },
      { term: 'O(1)', meaning: 'takes the same short time however many entries there are' },
      { term: 'linked list', meaning: 'entries each pointing to the next and previous one, so an entry can be moved without shifting the others' },
    ],
    firstMove: 'The cache holds three entries: C, B, A, with C used most recently. Show me which structure finds A and which one knows A is the oldest, then walk through “get A” and “put D”.',
  },
  palette: [
    { type: 'cache', kind: 'class', name: 'LRUCache', blurb: 'The public object: get(), put(), the capacity and the eviction rule.' },
    { type: 'node', kind: 'class', name: 'Node', blurb: 'One entry: key, value, and links to its neighbours in the order list.' },
    { type: 'index', kind: 'class', name: 'Index (dict)', blurb: 'A dictionary from key to Node, for instant lookup.' },
    { type: 'order', kind: 'class', name: 'RecencyList', blurb: 'A doubly linked list; the head is the most recently used, the tail the oldest.' },
    { type: 'lock', kind: 'class', name: 'Lock', blurb: 'Lets one thread at a time run a block of code.' },
    { type: 'ordered', kind: 'class', name: 'OrderedDict', blurb: 'A dictionary that remembers order and can move a key to the end in constant time.' },
  ],
  verbs: ['has', 'uses', 'has many', 'creates'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'A cache has small edge cases that interviewers love. Settle them out loud.',
      question: 'Which behaviours would you pin down before writing any class?',
      activity: { kind: 'clarify', questions: [
        { id: 'miss', q: 'What does get return for a key that is not there?', a: 'None. A miss is normal, not an error.' },
        { id: 'update', q: 'What does put do if the key already exists?', a: 'It replaces the value and makes the key the most recently used. Nothing is evicted.' },
        { id: 'read', q: 'Does reading an entry count as using it?', a: 'Yes. A successful get makes that key the most recently used.' },
        { id: 'cap', q: 'What if capacity is zero or negative?', a: 'Refuse it at construction with an error. A cache that can hold nothing is a bug.' },
        { id: 'threads', q: 'Is one cache shared by several threads?', a: 'Yes, up to 8 threads call get and put on the same object.' },
      ], assumptions: [
        { id: 'keys', q: 'What may a key be?', options: [
          { id: 'hashable', label: 'Any hashable value (strings, numbers, tuples)', consequence: 'A dictionary handles it directly, and the cache needs no knowledge of the key type.' },
          { id: 'str', label: 'Strings only', consequence: 'Simpler to type and test, but callers with number or tuple keys must convert them first.' },
        ] },
      ] },
      help: {
        hint: 'Which call changes what “least recently used” means?',
        walkthrough: [
          { text: 'A hit counts as use, so get changes the order as well as returning a value.' },
          { text: 'put on an existing key updates and promotes; only a new key can evict.' },
          { text: 'A fixed capacity of at least 1 is a rule enforced at construction.' },
          { text: 'Shared threads mean get, which changes order, is also a write.' },
        ],
        solution: [{ type: 'list', items: ['Miss → None.', 'Hit → promote to most recent.', 'put existing → update and promote, no eviction.', 'put new when full → evict the oldest, then insert.', 'Capacity < 1 → error.'] }],
        why: 'Each answer is an invariant the cache must keep. “get is a read” is the most common wrong assumption, and it matters later for threads.',
      },
      lessons: ['contracts-invariants', 'lru-cache'],
    },
    {
      id: 'roles', title: 'Who does what', intro: 'One structure is good at finding, the other at ordering. Decide which job goes where.',
      question: 'Which structure finds an entry, which knows the oldest one, and who keeps both in step?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'cache', name: 'LRUCache', blurb: 'get(), put(), capacity and eviction.' },
          { id: 'node', name: 'Node', blurb: 'key, value, prev, next.' },
          { id: 'index', name: 'Index (dict)', blurb: 'key → Node.' },
          { id: 'order', name: 'RecencyList', blurb: 'head = newest, tail = oldest.' },
        ],
        cards: [
          { id: 'find', text: 'Find the entry for key “A” without looking at the others', owner: 'index', why: 'A dictionary jumps straight to a key; a list would have to walk.' },
          { id: 'oldest', text: 'Know which entry is the oldest', owner: 'order', why: 'The list keeps entries in use order, so the tail is always the oldest.' },
          { id: 'move', text: 'Move an entry to the front without shifting the others', owner: 'order', alt: ['node'], why: 'A doubly linked list re-points two neighbours. The Node carries the pointers the list updates.' },
          { id: 'remember', text: 'Hold a key, its value and its neighbours', owner: 'node', why: 'A Node is that data. It stores the key so an evicted Node can be removed from the dictionary too.' },
          { id: 'evict', text: 'When full, remove the oldest from both the list and the dictionary', owner: 'cache', why: 'Only the cache sees both structures, so only it can keep them in step.' },
          { id: 'cap', text: 'Refuse a capacity below 1', owner: 'cache', why: 'The public object enforces its own construction rule.' },
        ],
        walk: { title: 'Cache holds C, B, A (C newest), capacity 3. “get A” then “put D”.', steps: [
          { prompt: 'Who finds the Node for A?', owner: 'index', call: 'self.index.get("A")' },
          { prompt: 'Who moves A to the front, making the order A, C, B?', owner: 'order', call: 'unlink(node); push_front(node)' },
          { prompt: 'Who notices that D would make four entries?', owner: 'cache', call: 'len(self.index) == self.capacity' },
          { prompt: 'Who tells you B is the one to drop?', owner: 'order', call: 'lru = self.tail  # B' },
          { prompt: 'Who removes B from the dictionary too?', owner: 'cache', call: 'del self.index[lru.key]' },
        ] },
      },
      help: {
        hint: 'Which structure can answer “which is oldest?” instantly, and which can answer “where is key A?”',
        walkthrough: [
          { text: 'The dictionary maps key to Node: a hit costs one lookup.', focus: ['index'] },
          { text: 'The list keeps use order: front is newest, tail is oldest, and moving a node touches only its neighbours.', focus: ['list', 'node'] },
          { text: 'On eviction the cache must remove the tail from the list and its key from the dictionary. That is why a Node stores its key.', focus: ['cache', 'node'] },
        ],
        solution: [
          { type: 'code', lang: 'python', code: py('sdm/lru_cache.py', 'put'), caption: 'python/sdm/lru_cache.py — tested with pytest' },
          { type: 'p', text: 'After “get A” the order is A, C, B. “put D” finds the cache full, drops B from both structures and pushes D to the front: D, A, C.' },
        ],
        why: 'Neither structure alone gives constant-time find and constant-time reorder. The cache’s job is to keep them describing the same entries.',
      },
      lessons: ['lru-cache', 'responsibilities'],
    },
    {
      id: 'classes', title: 'Draw the classes', intro: 'Assemble the objects and say how each relates to the next.',
      question: 'Draw LRUCache and the parts it needs. Which part holds the entries, and which holds their order?',
      activity: {
        kind: 'build', flavor: 'classes',
        starter: { comps: [{ id: 'c1', type: 'cache', kind: 'class', label: 'LRUCache', x: 90, y: 200 }], links: [] },
      },
      help: {
        hint: 'What does LRUCache need to hold so that both “find A” and “drop the oldest” are instant?',
        walkthrough: [
          { text: 'LRUCache owns a dictionary of key → Node.', focus: ['cache', 'index'] },
          { text: 'LRUCache also owns the order list; each Node sits in both.', focus: ['cache', 'list'] },
          { text: 'The list is made of Nodes; each Node has a prev and a next.', focus: ['list', 'node'] },
        ],
        solution: [
          { type: 'code', lang: 'python', code: py('sdm/lru_cache.py', 'get'), caption: 'python/sdm/lru_cache.py — get promotes the node, so reading changes the order' },
          { type: 'p', text: 'Arrows: LRUCache has an Index; LRUCache has a RecencyList; the Index and the list each hold many Nodes.' },
        ],
        why: 'Every Node is reachable from both the dictionary (by key) and the list (by order), which is what makes both operations constant time.',
      },
      lessons: ['uml', 'lab-lru'],
    },
    {
      id: 'threads', title: 'Two threads', intro: 'The interviewer changes one condition. Predict, run it, revise.',
      question: 'Two threads call put with new keys when exactly one slot is free. Can the cache end up over capacity?',
      change: { announce: 'New condition: two request threads share the cache. Cache holds 2 of 3 entries. Thread 1 puts X and thread 2 puts Y at the same moment.', rule: RULES.timeline, alternate: { announce: 'Second twist: thread 1 calls get on A while thread 2 calls get on B. Neither adds or removes anything.', label: 'Two reads at once' } },
      activity: {
        kind: 'timeline', names: ['Thread 1 (put X)', 'Thread 2 (put Y)'], resource: 'Free slots in the cache', initial: 1,
        read: 'checks for a free slot', write: 'inserts its entry',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'No lock', detail: 'Both threads see one free slot and both insert, so the cache holds four entries.', code: 'if len(self.index) == self.capacity:\n    evict()\nself.index[key] = node   # both threads got here' },
          { id: 'lock', label: 'One lock around all of get and put', detail: 'The second thread waits until the first has finished, then sees the cache full and evicts.', code: 'with self._lock:\n    ...  # check and change together' },
        ],
        predict: { q: 'With no lock, how many entries can the cache end up holding?', choices: [{ id: 'cap', label: 'At most its capacity' }, { id: 'over', label: 'One more than capacity' }, { id: 'none', label: 'Fewer than before' }] },
      },
      help: {
        hint: 'Is “check for room, then insert” one step, or two?',
        walkthrough: [
          { text: 'The check and the insert are two steps; another thread can run in between.' },
          { text: 'Both threads see room, so both insert and the size goes over capacity.' },
          { text: 'One lock around the whole of put makes the check and change a single step.' },
          { text: 'get also moves nodes, so it needs the same lock.' },
        ],
        solution: [{ type: 'p', text: 'Yes, it can. Guard all of get and put with one lock inside LRUCache. Because get reorders the list, two concurrent gets can also corrupt it, so reads need the lock too.' }],
        why: 'The size and order are shared data that every call changes; one lock keeps check-and-change atomic and is cheap at 8 threads.',
      },
      lessons: ['concurrency-lld', 'bridge-threads'],
    },
  ],
  rules: [
    { id: 'roles-coach', stage: 'roles', when: { not: { result: 'roles', is: ['pass', 'gaps'] } }, coach: 'Start with “find A without looking at the others”. Which structure does that?' },
    { id: 'roles-good', stage: 'roles', when: { result: 'roles', is: 'pass' }, ack: 'The dictionary finds and the list orders, with the cache keeping them in step.', strength: 'You split the work correctly: a dictionary for lookup, a linked list for order, and the cache keeps both in step.' },
    { id: 'roles-gap', stage: 'roles', when: { result: 'roles', is: 'gaps' }, gap: { text: 'Lookup and ordering were given to the wrong structure.', fix: 'Reassign the cards marked “reconsider” and replay “get A, put D”.', stage: 'roles', lesson: 'lru-cache' } },
    { id: 'roles-why-key', stage: 'roles', when: { result: 'roles', is: 'pass' }, priority: 5, ask: { text: 'Why does each Node store its key when the dictionary already maps key to Node?', choices: [
      { id: 'evict', label: 'When the oldest Node is evicted, we need its key to delete it from the dictionary', reply: 'Yes. The list hands you a Node; only the key lets you remove the dictionary entry.', verdict: 'sound' },
      { id: 'speed', label: 'Lookups are faster with the key inside the Node', reply: 'No: the dictionary is what makes lookups fast. The key is there for eviction.', verdict: 'risky' },
    ] } },
    { id: 'classes-coach', stage: 'classes', when: { count: 'class', max: 1 }, coach: 'Add the Index and the RecencyList, then draw an arrow from LRUCache to each.' },
    { id: 'classes-both', stage: 'classes', when: { all: [{ has: { type: 'index' } }, { has: { type: 'order' } }, { has: { type: 'node' } }] }, ack: 'You drew both an Index and a RecencyList, with Nodes shared between them.', strength: 'Your class diagram has both a lookup structure and an order structure, so get and put can each be constant time.' },
    { id: 'classes-no-order', stage: 'classes', when: { all: [{ has: { type: 'index' } }, { lacks: { type: ['order', 'ordered'] } }] }, priority: 6, ask: { text: 'A dictionary alone finds A instantly. How does your design know which entry is the oldest?', choices: [
      { id: 'list', label: 'Add a list that keeps use order', reply: 'Yes. Add a RecencyList and connect it to LRUCache and to Node.', verdict: 'sound' },
      { id: 'scan', label: 'Scan every entry for the oldest timestamp', reply: 'That works, but it takes time proportional to the size, which breaks the constant-time requirement.', verdict: 'risky' },
    ] }, gap: { text: 'The design has no structure that knows the oldest entry in constant time.', fix: 'Add a RecencyList (or OrderedDict) and link it to the cache.', stage: 'classes', lesson: 'lru-cache' } },
    { id: 'classes-ordered', stage: 'classes', when: { all: [{ has: { type: 'ordered' } }, { lacks: { type: 'order' } }] }, priority: 5, ask: { text: 'You used an OrderedDict instead of a dictionary plus list. That is a valid design. What does it give up?', choices: [
      { id: 'hidden', label: 'Less to write, but the O(1) behaviour depends on a library detail instead of code you can see', reply: 'Right. It is a good answer in production code; interviews often ask you to show the list.', verdict: 'sound' },
      { id: 'slower', label: 'It is slower than a linked list', reply: 'Both are constant time for these operations. The difference is how much you show and control.', verdict: 'partial' },
    ] } },
    { id: 'classes-unseen', stage: 'classes', when: { has: { type: 'cache' } }, priority: 3, ask: { text: 'An arrow from LRUCache to a dictionary does not show that evicting from the list also removes the key from the dictionary. Where does that rule live?', choices: [
      { id: 'cache', label: 'In LRUCache.put, which touches both', reply: 'Yes. The diagram cannot show it, so name it and test it: after eviction, the key is not found.', verdict: 'sound' },
      { id: 'list', label: 'In the list; it knows about the dictionary', reply: 'Then the list depends on the dictionary and cannot be tested alone. Let the cache coordinate.', verdict: 'partial' },
    ] } },
    { id: 'threads-fixed', stage: 'threads', when: { result: 'threads', is: 'one' }, ack: 'With the lock, the second thread waited and saw the cache full.', strength: 'You made check-and-change a single step with one lock, so the cache stays within its capacity.' },
    { id: 'threads-over', stage: 'threads', when: { result: 'threads', is: 'oversold' }, priority: 5, ask: { text: 'Both threads saw a free slot and the cache went over capacity. Which calls need the lock?', choices: [
      { id: 'both', label: 'Both get and put, because get also reorders the list', reply: 'Yes. Any call that changes shared state needs it, and get changes the order.', verdict: 'sound' },
      { id: 'put', label: 'Only put, since get just reads', reply: 'get moves a node to the front. Two gets at once, or a get during a put, can corrupt the list.', verdict: 'risky' },
      { id: 'fine', label: 'A lock per key', reply: 'Eviction touches an entry that is not the one being written, so a per-key lock cannot protect the size or the list.', verdict: 'partial' },
    ] }, gap: { text: 'Without a lock, two puts at once exceed the capacity.', fix: 'Wrap get and put in one lock held for the whole check-and-change.', stage: 'threads', lesson: 'concurrency-lld' } },
    { id: 'threads-cost', stage: 'threads', when: { result: 'threads', is: 'one' }, priority: 3, ask: { text: 'One lock means 8 threads queue behind each other. Is that a problem here?', choices: [
      { id: 'short', label: 'No: each call holds the lock for a few operations, so waits are short', reply: 'Right. Measure it before adding anything cleverer.', verdict: 'sound' },
      { id: 'shard', label: 'Yes: split into several smaller caches by key hash, each with its own lock', reply: 'A valid answer when the lock really is the bottleneck. The cost: the eviction is now per shard, not truly least recently used overall.', verdict: 'sound' },
    ] } },
  ],
  solution: {
    design: {
      comps: [
        { id: 'cache', type: 'cache', kind: 'class', label: 'LRUCache', x: 70, y: 200 },
        { id: 'lock', type: 'lock', kind: 'class', label: 'Lock', x: 70, y: 380 },
        { id: 'index', type: 'index', kind: 'class', label: 'Index (dict)', x: 300, y: 90 },
        { id: 'list', type: 'order', kind: 'class', label: 'RecencyList', x: 300, y: 300 },
        { id: 'node', type: 'node', kind: 'class', label: 'Node', x: 520, y: 200 },
      ],
      links: [
        { id: 'c-i', from: 'cache', to: 'index', label: 'has' },
        { id: 'c-l', from: 'cache', to: 'list', label: 'has' },
        { id: 'c-k', from: 'cache', to: 'lock', label: 'uses' },
        { id: 'i-n', from: 'index', to: 'node', label: 'has many' },
        { id: 'l-n', from: 'list', to: 'node', label: 'has many' },
      ],
    },
    why: {
      cache: 'The public object. Holds the lock, enforces capacity, and keeps the dictionary and list describing the same entries.',
      lock: 'One lock held for the whole of get and put, because both read and change shared state.',
      index: 'key → Node. Makes finding an entry constant time.',
      list: 'Doubly linked list in use order: head newest, tail oldest. Moving or removing a node is constant time.',
      node: 'key, value, prev, next. Lives in both structures; the key lets an evicted node be removed from the dictionary.',
    },
    alternatives: {
      list: { types: ['ordered'], tradeoff: 'OrderedDict with move_to_end does the same job in a few lines. You write less but show less, and rely on the library’s guarantees.' },
    },
    trace: { title: 'put D into a full cache (C, B, A)', steps: [
      { from: 'cache', to: 'lock', text: 'Takes the lock for the whole call.' },
      { from: 'cache', to: 'index', text: 'D is not in the dictionary, and its size equals the capacity of 3: eviction needed.' },
      { from: 'cache', to: 'list', text: 'The tail is A (the oldest). Unlink it.' },
      { from: 'index', to: 'node', text: 'Delete A’s key from the dictionary using the Node’s stored key.' },
      { from: 'list', to: 'node', text: 'Create Node D, add it to the dictionary and push it to the head: D, C, B.' },
    ] },
    tradeoff: 'A dictionary plus a linked list gives constant-time find and reorder at the cost of keeping two structures in step; one lock keeps them consistent but serialises callers.',
    otherApproach: 'OrderedDict gives the same behaviour in a few lines and is the right choice in production. Sharding by key hash reduces lock contention, at the price of approximate LRU.',
  },
};
