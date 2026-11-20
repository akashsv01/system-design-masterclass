import { describe, expect, it } from 'vitest';
import { addComp, autoArrange, connect, EMPTY_GRAPH, EMPTY_HISTORY, pushHistory, reconnect, redo, removeComp, shortestPath, undo, type DesignGraph } from '../src/sim/interview/graph';
import { planTrace, checkRoles, machineFrom, planQuery, runQueue, runScenario, runTimeline, traceRequest, validOrder, type TLOp } from '../src/sim/interview/sims';
import { holds, nextQuestion, type Rule } from '../src/sim/interview/rules';

function demo(): DesignGraph {
  let g = EMPTY_GRAPH;
  [g] = addComp(g, { id: 'app', type: 'client', kind: 'client', label: 'Shopper app', x: 0, y: 0 });
  [g] = addComp(g, { id: 'orders', type: 'orders', kind: 'service', label: 'Orders', x: 0, y: 0 });
  [g] = addComp(g, { id: 'q', type: 'queue', kind: 'queue', label: 'Order events', x: 0, y: 0 });
  [g] = addComp(g, { id: 'dispatch', type: 'dispatch', kind: 'service', label: 'Dispatch', x: 0, y: 0 });
  [g] = connect(g, 'app', 'orders', 'sends request');
  [g] = connect(g, 'orders', 'q', 'publishes event');
  [g] = connect(g, 'q', 'dispatch', 'delivers to');
  return g;
}

describe('design graph', () => {
  it('connects without duplicates or self-links, and reconnects', () => {
    let g = demo();
    const n = g.links.length;
    [g] = connect(g, 'app', 'orders');
    expect(g.links.length).toBe(n);
    expect(connect(g, 'app', 'app')[1]).toBeNull();
    const id = g.links[0].id;
    g = reconnect(g, id, 'to', 'dispatch');
    expect(g.links[0].to).toBe('dispatch');
    expect(removeComp(g, 'dispatch').links.every((l) => l.to !== 'dispatch')).toBe(true);
  });
  it('undo and redo restore exact graphs', () => {
    const a = demo();
    const h = pushHistory(EMPTY_HISTORY, a);
    const b = removeComp(a, 'q');
    const [h2, back] = undo(h, b)!;
    expect(back).toBe(a);
    const [, fwd] = redo(h2, back)!;
    expect(fwd).toBe(b);
  });
  it('finds paths and arranges in layers', () => {
    const g = demo();
    expect(shortestPath(g, 'client', { type: 'dispatch' })).toEqual(['app', 'orders', 'q', 'dispatch']);
    const laid = autoArrange(g, { width: 800, height: 400 });
    const xs = ['app', 'orders', 'q', 'dispatch'].map((id) => laid.comps.find((c) => c.id === id)!.x);
    expect([...xs].sort((p, q) => p - q)).toEqual(xs);
  });
});

describe('trace and failure', () => {
  const g = demo();
  const path = ['app', 'orders', 'q', 'dispatch'];
  it('a part behind a queue delays work instead of failing the customer', () => {
    expect(traceRequest(g, path, 'dispatch').outcome).toBe('delayed');
  });
  it('a part on the synchronous path fails the request', () => {
    expect(traceRequest(g, path, 'orders').outcome).toBe('error');
    expect(traceRequest(g, path, 'q').outcome).toBe('error');
  });
  it('a read stops at a cache on a hit and continues on a miss', () => {
    let [g2] = addComp(g, { id: 'c', type: 'cache', kind: 'cache', label: 'Seat-map cache', x: 0, y: 0 });
    [g2] = connect(g2, 'orders', 'c', 'reads from');
    let [g3] = addComp(g2, { id: 'db', type: 'db', kind: 'db', label: 'Seat store', x: 0, y: 0 });
    [g3] = connect(g3, 'c', 'db', 'reads from');
    const p = ['app', 'orders', 'c', 'db'];
    expect(traceRequest(g3, p, null, { read: true })).toMatchObject({ outcome: 'hit', at: 2 });
    expect(traceRequest(g3, p, null, { read: true, miss: true }).outcome).toBe('ok');
    expect(traceRequest(g3, p, null, { read: false }).hops.length).toBe(3);
  });
  it('a missing arrow is reported, not guessed', () => {
    const r = traceRequest(g, ['app', 'dispatch']);
    expect(r.outcome).toBe('broken');
    expect(r.missing).toEqual(['app', 'dispatch']);
  });
});

describe('trace planning through the learner’s own design', () => {
  it('follows a cache-aside read: hit stops at the cache, miss continues to the database', () => {
    let g = EMPTY_GRAPH;
    [g] = addComp(g, { id: 'a', type: 'client', kind: 'client', label: 'App', x: 0, y: 0 });
    [g] = addComp(g, { id: 's', type: 'svc', kind: 'service', label: 'Booking', x: 0, y: 0 });
    [g] = addComp(g, { id: 'd', type: 'db', kind: 'db', label: 'Seat store', x: 0, y: 0 });
    [g] = connect(g, 'a', 's', 'sends request');
    [g] = connect(g, 's', 'd', 'reads from');
    expect(planTrace(g, ['a', 's', 'd'], { read: true })).toMatchObject({ outcome: 'ok', answeredBy: 'd' });
    [g] = addComp(g, { id: 'c', type: 'cache', kind: 'cache', label: 'Seat-map cache', x: 0, y: 0 });
    [g] = connect(g, 's', 'c', 'reads from');
    expect(planTrace(g, ['a', 's', 'd'], { read: true })).toMatchObject({ outcome: 'hit', answeredBy: 'c' });
    const miss = planTrace(g, ['a', 's', 'd'], { read: true, miss: true });
    expect(miss.hops.map((h) => h.to)).toEqual(['s', 'c', 'd']);
    expect(planTrace(g, ['a', 's', 'd'], { read: false }).hops.map((h) => h.to)).toEqual(['s', 'd']);
  });
});

describe('two-buyer timeline', () => {
  const interleaved: TLOp[] = [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }];
  const serial: TLOp[] = [{ actor: 0, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'read' }, { actor: 1, kind: 'write' }];
  it('plain writes oversell when both read first', () => {
    expect(runTimeline(interleaved, 'plain').oversold).toBe(true);
    expect(runTimeline(serial, 'plain').oversold).toBe(false);
  });
  it('a conditional write or a lock lets exactly one win in every valid order', () => {
    const orders: TLOp[][] = [];
    const ops: TLOp[] = [{ actor: 0, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'read' }, { actor: 1, kind: 'write' }];
    const perm = (rest: TLOp[], acc: TLOp[]) => { if (!rest.length) { if (validOrder(acc)) orders.push(acc); return; } rest.forEach((o, i) => perm([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, o])); };
    perm(ops, []);
    expect(orders.length).toBe(6);
    for (const o of orders) for (const guard of ['conditional', 'lock'] as const) {
      const r = runTimeline(o, guard);
      expect(r.wins.filter(Boolean).length).toBe(1);
      expect(r.final).toBe(0);
    }
  });
  it('with a lock the second reader waits', () => {
    expect(runTimeline(interleaved, 'lock').steps.some((s) => s.waited)).toBe(true);
  });
});

describe('state machine with a clock', () => {
  let g = EMPTY_GRAPH;
  [g] = addComp(g, { id: 'a', type: 'available', kind: 'state', label: 'Available', x: 0, y: 0 });
  [g] = addComp(g, { id: 'h', type: 'held', kind: 'state', label: 'Held', x: 0, y: 0 });
  [g] = addComp(g, { id: 'b', type: 'booked', kind: 'state', label: 'Booked', x: 0, y: 0 });
  [g] = connect(g, 'a', 'h', 'reserve');
  [g] = connect(g, 'h', 'b', 'pay');
  const events = [{ at: 0, event: 'reserve', label: 'Ana reserves' }, { at: 12, event: 'reserve', label: 'Ben reserves', expect: 'held' }];
  it('without an expiry arrow the seat stays held forever', () => {
    const steps = runScenario(machineFrom(g), 'available', events, { event: 'expire', after: 10 });
    expect(steps.at(-1)!.accepted).toBe(false);
    expect(steps.at(-1)!.matches).toBe(true); // still "held" — but held by Ana, which the learner sees in the log
  });
  it('a timed arrow fires on its own once its time has passed', () => {
    const [g2] = connect(g, 'h', 'a', 'expire');
    const steps = runScenario(machineFrom(g2), 'available', events, { event: 'expire', after: 10 });
    expect(steps.some((s) => s.auto && s.to === 'available')).toBe(true);
    expect(steps.at(-1)!.accepted).toBe(true);
  });
});

describe('data model, queue and roles', () => {
  it('plans queries by key', () => {
    const key = { partition: 'conversation_id', sort: 'seq', indexes: [] as string[] };
    expect(planQuery(key, { id: 'a', text: '', filter: 'conversation_id', sort: 'seq' }).plan).toBe('one-partition');
    expect(planQuery(key, { id: 'b', text: '', filter: 'sender_id' }).plan).toBe('scatter');
    expect(planQuery({ ...key, indexes: ['sender_id'] }, { id: 'b', text: '', filter: 'sender_id' }).plan).toBe('index');
  });
  it('a queue drains when capacity exceeds arrivals and grows when it does not', () => {
    expect(runQueue({ arrival: 80, workers: 10, serviceMs: 100, policy: 'wait' }).maxQueue).toBe(0);
    expect(runQueue({ arrival: 120, workers: 10, serviceMs: 100, policy: 'wait' }).endQueue).toBeGreaterThan(1000);
  });
  it('retries amplify a slowdown; shedding bounds it', () => {
    const base = { arrival: 80, workers: 10, serviceMs: 100, slow: { from: 10, to: 30, serviceMs: 400 }, timeoutS: 2 } as const;
    const retry = runQueue({ ...base, policy: 'retry' });
    const shed = runQueue({ ...base, policy: 'shed' });
    expect(retry.maxQueue).toBeGreaterThan(shed.maxQueue);
    expect(shed.maxWaitS).toBeLessThanOrEqual(2);
  });
  it('accepts alternative owners', () => {
    const cards = [{ id: 'x', text: '', owner: 'lot', alt: ['floor'], why: '' }];
    expect(checkRoles(cards, { x: 'floor' }).x).toBe('alt');
    expect(checkRoles(cards, { x: 'spot' }).x).toBe('wrong');
  });
});

describe('interviewer rules', () => {
  const rules: Rule[] = [
    { id: 'cache', when: { has: 'cache' }, ask: { text: 'Prices change. How do shoppers avoid stale prices?' }, priority: 1 },
    { id: 'owner', when: { link: [{ type: 'orders' }, 'queue'], labels: ['publishes event'] }, ask: { text: 'What if a message is delivered twice?' }, priority: 2 },
  ];
  it('asks about bare arrows before anything else', () => {
    let [g] = connect(demo(), 'orders', 'dispatch');
    const q = nextQuestion(rules, { g, answers: {}, results: {} }, 's', new Set());
    expect(q?.kind).toBe('label');
    [g] = connect(g, 'orders', 'dispatch', 'calls');
    expect(nextQuestion(rules, { g, answers: {}, results: {} }, 's', new Set())).toMatchObject({ kind: 'rule', rule: { id: 'owner' } });
  });
  it('evaluates nested conditions over answers and results', () => {
    const x = { g: demo(), answers: { hold: 'db' }, results: { race: 'one' } };
    expect(holds({ all: [{ answer: 'hold', is: ['db', 'redis'] }, { result: 'race', is: 'one' }, { not: { has: 'cache' } }] }, x)).toBe(true);
  });
});
