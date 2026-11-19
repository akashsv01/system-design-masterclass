/**
 * LRU cache with an explicit hash map + doubly linked list, instrumented so the
 * lesson can show which implementation line runs for each operation.
 *
 * Order convention: index 0 = most recently used (head), last = least recently used (tail).
 */

export type LruOp = { type: 'get'; key: string } | { type: 'put'; key: string; value: string };

export interface LruStep {
  op: LruOp;
  /** Keys from most to least recently used, after the operation. */
  order: string[];
  values: Record<string, string>;
  hit?: boolean;
  evicted?: string;
  returned?: string | null;
  /** Ids of implementation lines executed, in order (see LRU_PY_LINES). */
  lines: string[];
  summary: string;
}

interface Node {
  key: string;
  value: string;
  prev: Node | null;
  next: Node | null;
}

export class LruCache {
  private map = new Map<string, Node>();
  private head: Node | null = null; // most recent
  private tail: Node | null = null; // least recent
  constructor(public readonly capacity: number) {
    if (capacity < 1) throw new Error('capacity must be at least 1');
  }

  private unlink(n: Node) {
    if (n.prev) n.prev.next = n.next;
    else this.head = n.next;
    if (n.next) n.next.prev = n.prev;
    else this.tail = n.prev;
    n.prev = n.next = null;
  }

  private pushFront(n: Node) {
    n.next = this.head;
    n.prev = null;
    if (this.head) this.head.prev = n;
    this.head = n;
    if (!this.tail) this.tail = n;
  }

  order(): string[] {
    const out: string[] = [];
    for (let n = this.head; n; n = n.next) out.push(n.key);
    return out;
  }

  values(): Record<string, string> {
    return Object.fromEntries([...this.map.entries()].map(([k, n]) => [k, n.value]));
  }

  get(key: string, lines: string[] = []): string | null {
    lines.push('get-lookup');
    const n = this.map.get(key);
    if (!n) {
      lines.push('get-miss');
      return null;
    }
    lines.push('get-move');
    this.unlink(n);
    this.pushFront(n);
    lines.push('get-return');
    return n.value;
  }

  put(key: string, value: string, lines: string[] = []): string | undefined {
    lines.push('put-lookup');
    const existing = this.map.get(key);
    if (existing) {
      lines.push('put-update');
      existing.value = value;
      this.unlink(existing);
      this.pushFront(existing);
      return undefined;
    }
    let evicted: string | undefined;
    lines.push('put-check-full');
    if (this.map.size === this.capacity) {
      const lru = this.tail!;
      lines.push('put-evict');
      this.unlink(lru);
      this.map.delete(lru.key);
      evicted = lru.key;
    }
    lines.push('put-insert');
    const n: Node = { key, value, prev: null, next: null };
    this.map.set(key, n);
    this.pushFront(n);
    return evicted;
  }
}

export function runLru(capacity: number, ops: LruOp[]): LruStep[] {
  const c = new LruCache(capacity);
  return ops.map((op) => {
    const lines: string[] = [];
    if (op.type === 'get') {
      const v = c.get(op.key, lines);
      const hit = v !== null;
      return {
        op, order: c.order(), values: c.values(), hit, returned: v, lines,
        summary: hit ? `get(${op.key}) hit: ${op.key} moves to the front.` : `get(${op.key}) missed: nothing moves.`,
      };
    }
    const evicted = c.put(op.key, op.value, lines);
    return {
      op, order: c.order(), values: c.values(), evicted, lines,
      summary: evicted
        ? `put(${op.key}) on a full cache evicts ${evicted}, the least recently used.`
        : `put(${op.key}) inserts ${op.key} at the front.`,
    };
  });
}

/**
 * Maps each traced line id to a unique snippet of python/sdm/lru_cache.py, the learner-facing
 * implementation. The lesson highlights the line containing the snippet. tests/sim.test.ts
 * checks that each snippet occurs exactly once in that file.
 */
export const LRU_PY_LINES: Record<string, string> = {
  'get-lookup': 'node = self.index.get(key)\n        if node is None:',
  'get-miss': 'return None\n        self._unlink(node)',
  'get-move': 'self._unlink(node)\n        self._push_front(node)\n        return node.value',
  'get-return': 'return node.value',
  'put-lookup': 'node = self.index.get(key)\n        if node is not None:',
  'put-update': 'node.value = value',
  'put-check-full': 'if len(self.index) == self.capacity:',
  'put-evict': 'lru = self.tail',
  'put-insert': 'node = Node(key, value)',
};

/** 1-based line numbers (within `source`) that the snippet for `id` covers. */
export function linesFor(source: string, id: string): number[] {
  const snip = LRU_PY_LINES[id];
  if (!snip) return [];
  const at = source.indexOf(snip);
  if (at < 0) return [];
  const first = source.slice(0, at).split('\n').length;
  // Highlight only the first line of multi-line snippets (the rest give uniqueness context).
  return [first];
}

/**
 * A fresh eviction problem (brief §3, B5): a full 3-slot cache in a stated recency order, two operations that
 * change recency (at least one read that moves an older key forward), then a put of a new key. The learner names
 * the evicted key. Deterministic per seed so a puzzle number always means the same problem.
 */
export interface EvictionPuzzle {
  seed: number;
  /** Keys from most to least recently used before the operations. */
  start: string[];
  ops: LruOp[];
  /** Trace of the operations only (the set-up puts are not shown). */
  trace: LruStep[];
  /** Key evicted by the final put. */
  evicted: string;
  /** The answer a learner gets by ignoring reads ("evict whatever was last at the start"). */
  naive: string;
}

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function evictionPuzzle(seed: number): EvictionPuzzle {
  const r = seeded(seed * 7919 + 13);
  const pool = ['A', 'B', 'C', 'D', 'E', 'F'];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const start = pool.slice(0, 3);
  const outside = pool.slice(3);
  // First operation always reads an older key, so recency (not arrival) decides the answer.
  const first: LruOp = { type: 'get', key: r() < 0.6 ? start[2] : start[1] };
  const kind = r();
  const second: LruOp =
    kind < 0.34 ? { type: 'get', key: outside[0] } // a miss: changes nothing
      : kind < 0.67 ? { type: 'put', key: start[0], value: start[0].toLowerCase() + '2' } // update an existing key: moves it, evicts nothing
        : { type: 'get', key: start[r() < 0.5 ? 0 : 1] };
  const newKey = outside[outside.length - 1];
  const ops: LruOp[] = [first, second, { type: 'put', key: newKey, value: newKey.toLowerCase() }];
  const setup: LruOp[] = [...start].reverse().map((k) => ({ type: 'put', key: k, value: k.toLowerCase() }));
  const full = runLru(3, [...setup, ...ops]);
  const trace = full.slice(setup.length);
  return { seed, start, ops, trace, evicted: trace[trace.length - 1].evicted ?? '', naive: start[2] };
}
