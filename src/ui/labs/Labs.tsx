import { useMemo, type ReactNode } from 'react';
import { LabFrame, Slider, Choice, Readout } from './LabFrame';
import { Chart, Timeline, type Series } from '../components/Visuals';
import { Snippet } from '../components/Exercise';
import { useRecord } from '../../progress/ProgressProvider';
import { simulateLb, simulateCacheHitRate, stampede, shardLoads, backlogSeries, simulateRetries, reservationOutcomes, interleavings, runInterleaving, type LbPolicy, type ReserveStrategy } from '../../sim/labs';
import { staleFraction, type ReadStrategy } from '../../sim/replication';
import { evictionPuzzle, type EvictionPuzzle, type LruOp } from '../../sim/lru';
import { RecencyRow } from '../components/RecencyRow';
import { Icon } from '../components/Icon';

const Note = ({ children }: { children: ReactNode }) => <p className="notice" style={{ marginTop: 12, marginBottom: 0 }} aria-live="polite">{children}</p>;

/* ---------------- Request tracing ---------------- */
function traceEvents(cacheSeatMap: boolean, parallel: boolean) {
  const db = cacheSeatMap ? 20 : 420;
  const t0 = 10;
  const tDb = t0 + 15;
  const endDb = tDb + db;
  const pricing = 180;
  const recs = 220;
  const startPricing = endDb;
  const startRecs = parallel ? endDb : endDb + pricing;
  const end = Math.max(startPricing + pricing, startRecs + recs) + 30;
  return {
    total: end,
    events: [
      { t: 0, lane: 'gw', label: 'request in' },
      { t: tDb, lane: 'db', label: `seat map query ${db} ms`, tone: (db > 200 ? 'fail' : 'ok') as 'fail' | 'ok' },
      { t: startPricing, lane: 'pricing', label: `pricing ${pricing} ms`, tone: 'active' as const },
      { t: startRecs, lane: 'recs', label: `recommendations ${recs} ms`, tone: 'active' as const },
      { t: end, lane: 'gw', label: `response at ${end} ms`, tone: 'ok' as const },
    ],
  };
}
const TRACE_LANES = [{ id: 'gw', label: 'Gateway' }, { id: 'db', label: 'Seat DB' }, { id: 'pricing', label: 'Pricing' }, { id: 'recs', label: 'Recommend' }];

export function LabRequestTracing() {
  const [s, set] = useRecord<{ cache: boolean; parallel: boolean }>('sim:lab-request-tracing', { cache: false, parallel: false });
  const tr = traceEvents(s.cache, s.parallel);
  return (
    <LabFrame
      id="lab-request-tracing"
      opening="The event page takes almost 900 ms. Product wants it under 500 ms. You have a trace of one slow request and time for one or two fixes. Which ones?"
      predict={{ id: 'dominant', prompt: 'The trace shows: seat-map query 420 ms, pricing call 180 ms, recommendations 220 ms, run one after another. Which single fix saves the most time?', choices: [
        { id: 'cache', text: 'Cache the seat map (query → ~20 ms)', why: 'It removes the biggest span: about 400 ms saved.' },
        { id: 'parallel', text: 'Run pricing and recommendations in parallel', why: 'That saves 180 ms (the shorter of the two now overlaps the longer). Good, but smaller.' },
        { id: 'gateway', text: 'Speed up the gateway', why: 'The gateway accounts for a few ms. Optimising it barely moves the total.' },
      ] }}
      experiment={{ title: 'Apply fixes, watch the trace', body: 'Toggle each fix. The trace and total are recomputed from the same model. Spans that run in parallel overlap; spans in sequence add up.', render: () => (
        <>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button className="btn btn-small" aria-pressed={s.cache} onClick={() => set({ ...s, cache: !s.cache })}>Cache the seat map</button>
            <button className="btn btn-small" aria-pressed={s.parallel} onClick={() => set({ ...s, parallel: !s.parallel })}>Run pricing and recommendations in parallel</button>
          </div>
          <Readout items={[
            { name: 'Total', value: `${tr.total} ms`, tone: tr.total <= 500 ? 'good' : 'bad' },
            { name: 'Target', value: '500 ms' },
            { name: 'Longest span', value: s.cache ? (s.parallel ? 'recs 220 ms' : 'recs 220 ms') : 'seat map 420 ms' },
          ]}>{tr.total <= 500 ? 'Under target. The longest remaining span now decides the total.' : `${tr.total - 500} ms over target. Sequential spans add up; remove or overlap the biggest.`}</Readout>
          <Timeline lanes={TRACE_LANES} events={tr.events} upTo={tr.events.length} unit="ms" description={`Total ${tr.total} ms`} note="Illustrative trace; each dot marks when a span starts." />
        </>
      ) }}
      explain={{ title: 'Fix the biggest span first', body: ['A trace shows where the time goes. Sequential spans add up, so the critical path is the longest chain. Caching the seat map removes 400 ms; parallelising removes the shorter of two independent calls (180 ms). Both together: about 300 ms.', 'Optimising something off the critical path (the gateway, or the shorter of two parallel calls) changes nothing users feel.'] }}
      exercise={{ id: 'why', prompt: 'After both fixes, which span should you look at next, and why?', checklist: ['Names recommendations (now the longest span on the critical path).', 'Explains it sets the total because the others overlap with it.'], model: 'Recommendations: at 220 ms it’s now the longest span on the critical path, so it decides the total; making pricing faster would change nothing.' }}
      fresh={{ question: { id: 'fresh', prompt: 'A new trace: auth 30 ms, then *in parallel* inventory 300 ms and reviews 90 ms, then render 40 ms. What is the total?', choices: [
        { id: '370', text: '370 ms', why: 'Right: 30 + max(300, 90) + 40.' },
        { id: '460', text: '460 ms', why: 'That adds the parallel calls as if they ran in sequence.' },
        { id: '160', text: '160 ms', why: 'That uses the shorter parallel call. The longer one decides when both are done.' },
      ], correct: '370' }, reveal: () => <Timeline lanes={[{ id: 'a', label: 'Auth' }, { id: 'i', label: 'Inventory' }, { id: 'r', label: 'Reviews' }, { id: 'x', label: 'Render' }]} events={[{ t: 0, lane: 'a', label: 'auth 30' }, { t: 30, lane: 'i', label: 'inventory 300', tone: 'fail' }, { t: 30, lane: 'r', label: 'reviews 90' }, { t: 330, lane: 'x', label: 'render 40 → 370', tone: 'ok' }]} upTo={4} unit="ms" description="Total 370 ms" /> }}
      assumptions={['Span durations are fixed per run; caching reduces the seat-map query to 20 ms.', 'Pricing and recommendations are independent, so they can run in parallel.']}
    />
  );
}

/* ---------------- Load balancing ---------------- */
export function LabLoadBalancing() {
  const [s, set] = useRecord<{ rate: number; slow: number; policy: LbPolicy }>('sim:lab-load-balancing', { rate: 45, slow: 150, policy: 'round-robin' });
  const res = useMemo(() => simulateLb({ arrivalsPerSec: s.rate, serviceMs: [50, 50, s.slow], policy: s.policy }), [s]);
  const capacity = Math.round(1000 / 50 * 2 + 1000 / s.slow);
  return (
    <LabFrame
      id="lab-load-balancing"
      opening="Three servers, one of them slow. Traffic climbs toward the on-sale peak. When does the slow server start hurting everyone, and does the balancing policy matter?"
      predict={{ id: 'slow', prompt: 'Servers take 50, 50 and 150 ms per request. At 45 requests/s with round robin, what happens to the slow server?', choices: [
        { id: 'queue', text: 'It gets 15/s but can only do ~6.7/s, so its queue grows and its requests wait longer and longer.', why: 'That’s what the simulation shows: round robin ignores speed.' },
        { id: 'fine', text: 'Nothing. Total capacity (~47/s) is above 45/s.', why: 'Total capacity is enough, but round robin sends the slow server a third of the traffic, more than it can handle alone.' },
      ] }}
      experiment={{ title: 'Change traffic, speed and policy', body: 'Each run simulates 10 seconds, millisecond by millisecond, with a fixed random seed. Compare per-server p99 latency under each policy.', render: () => (
        <>
          <Slider label="Arrivals" value={s.rate} min={10} max={80} step={5} unit="req/s" onChange={(v) => set({ ...s, rate: v })} />
          <Slider label="Server C time" value={s.slow} min={50} max={300} step={25} unit="ms" onChange={(v) => set({ ...s, slow: v })} />
          <Choice label="Policy" value={s.policy} options={[{ id: 'round-robin', label: 'Round robin' }, { id: 'least-connections', label: 'Least connections' }]} onChange={(v) => set({ ...s, policy: v })} />
          <Readout items={[
            { name: 'Overall p50', value: `${Math.round(res.p50).toLocaleString()} ms` },
            { name: 'Overall p99', value: `${Math.round(res.p99).toLocaleString()} ms`, tone: res.p99 > 1000 ? 'bad' : 'good' },
            { name: 'Capacity', value: `≈ ${capacity} req/s` },
            { name: 'Dropped', value: `${res.dropped}`, tone: res.dropped ? 'bad' : undefined },
          ]}>{s.rate > capacity ? 'Arrivals exceed total capacity: no policy can keep queues short.' : res.perServer[2].p99 > 1000 ? `Server C gets ${s.policy === 'round-robin' ? 'a third of the traffic' : 'more than it can finish'} and its queue grows, which drags the overall p99 up.` : 'Every server keeps up with the work it is given.'}</Readout>
          <Chart kind="bar" categories={['Server A', 'Server B', 'Server C']} series={[{ name: 'values', points: res.perServer.map((x, i) => [i, Math.round(x.p99)] as [number, number]), tone: res.perServer[2].p99 > 1000 ? 'fail' : 'accent' }]} xLabel="" yLabel="p99 latency (ms)" description="p99 latency per server" note={`Requests served in 10 simulated seconds: A ${res.perServer[0].served}, B ${res.perServer[1].served}, C ${res.perServer[2].served}.`} />
        </>
      ) }}
      explain={{ title: 'Capacity is per server, not just in total', body: ['Round robin gives every server the same share. If one server can’t keep up with its share, its queue grows without limit even though the fleet as a whole has spare capacity.', 'Least connections sends new work to whoever has least in progress, so the slow server naturally receives less. It can’t create capacity: push arrivals past the total and every policy fails.'] }}
      exercise={{ id: 'when', prompt: 'When would round robin be perfectly fine?', checklist: ['Servers are equally fast and requests cost about the same.', 'Load well below capacity.'], model: 'When every server is equally fast and requests take similar time, as in a uniform stateless fleet: then equal shares are already the right shares.' }}
      fresh={{ question: { id: 'fresh', prompt: 'Three equal servers at 50 ms each (60 req/s total). Arrivals rise to 70/s. Which policy keeps p99 low?', choices: [
        { id: 'none', text: 'Neither: demand exceeds total capacity, so queues grow under any policy.', why: 'Right. Balancing redistributes load; it can’t exceed capacity. You need more servers or to shed load.' },
        { id: 'lc', text: 'Least connections', why: 'It helps with uneven servers, not with total overload.' },
      ], correct: 'none' }, reveal: () => {
        const r = simulateLb({ arrivalsPerSec: 70, serviceMs: [50, 50, 50], policy: 'least-connections' });
        return <Note>Simulated at 70 req/s with least connections: p99 <strong>{Math.round(r.p99).toLocaleString()} ms</strong>, {r.dropped} dropped in 10 s.</Note>;
      } }}
      assumptions={['Each server handles one request at a time with a fixed service time; queues hold at most 200.', 'Arrivals are evenly spaced with ±50% seeded jitter; 10 simulated seconds per run.']}
    />
  );
}

/* ---------------- Cache behaviour ---------------- */
export function LabCache() {
  const [s, set] = useRecord<{ size: number; skew: number; coalesce: boolean }>('sim:lab-cache', { size: 50, skew: 1, coalesce: false });
  const curve = useMemo(() => [10, 25, 50, 100, 200, 400].map((sz) => [sz, Math.round(simulateCacheHitRate({ items: 2000, size: sz, skew: s.skew, requests: 8000 }) * 100)] as [number, number]), [s.skew]);
  const hit = useMemo(() => Math.round(simulateCacheHitRate({ items: 2000, size: s.size, skew: s.skew }) * 100), [s.size, s.skew]);
  return (
    <LabFrame
      id="lab-cache"
      opening="2,000 events, but on sale day a handful get most of the traffic. How big must the seat-map cache be to absorb most reads, and what happens the moment the hottest entry expires?"
      predict={{ id: 'size', prompt: 'With strongly skewed traffic, a cache holding 50 of 2,000 seat maps (2.5%) gets what hit rate, roughly?', choices: [
        { id: 'low', text: 'About 2.5%: it holds 2.5% of the items', why: 'That would be true if every item were equally popular. Skew changes everything.' },
        { id: 'high', text: 'Well over half: the popular few dominate', why: 'The simulation shows the popular items cover most requests.' },
      ] }}
      experiment={{ title: 'Size, skew and stampedes', body: 'Hit rates come from simulating an LRU cache over seeded requests. Skew 1.0 is strongly uneven popularity; 0.2 is nearly uniform.', render: () => (
        <>
          <Slider label="Cache size" value={s.size} min={10} max={400} step={10} unit="entries" onChange={(v) => set({ ...s, size: v })} />
          <Slider label="Popularity skew" value={s.skew} min={0.2} max={1.4} step={0.1} unit="" onChange={(v) => set({ ...s, skew: Math.round(v * 10) / 10 })} />
          <Choice label="When the hottest key expires (20,000 reads/s, 8 ms reload)" value={s.coalesce ? 'yes' : 'no'} options={[{ id: 'no', label: 'No coalescing' }, { id: 'yes', label: 'Coalesce reloads' }]} onChange={(v) => set({ ...s, coalesce: v === 'yes' })} />
          <Readout items={[
            { name: 'Hit rate', value: `${hit}%`, tone: hit >= 70 ? 'good' : undefined },
            { name: 'Reads reaching the DB', value: `${100 - hit}%` },
            { name: 'DB queries on expiry', value: `${stampede(20000, 8, s.coalesce)}`, tone: stampede(20000, 8, s.coalesce) > 1 ? 'bad' : 'good' },
          ]}>{`Caching ${((s.size / 2000) * 100).toFixed(1)}% of items serves ${hit}% of reads. `}{s.coalesce ? 'Coalescing turns the expiry spike into one reload.' : 'Every read in the 8 ms reload window misses at once: a stampede.'}</Readout>
          <Chart series={[{ name: 'hit rate', points: curve, tone: 'ok' }]} marks={[{ x: s.size, y: hit, label: `${hit}%` }]} xLabel="cache size (entries)" yLabel="hit rate (%)" yMax={100} description={`Hit rate ${hit}%`} note="LRU cache over 2,000 items, Zipf-like popularity." />
        </>
      ) }}
      explain={{ title: 'Skew makes small caches powerful, and expiry dangerous', body: ['When a few items get most requests, a small cache holding just those items absorbs most traffic. With nearly uniform popularity, hit rate tracks the fraction of items cached, and caching helps much less.', 'The hottest key is also the most dangerous to lose: when it expires, every request in the reload window misses at once. Coalescing (one reload, others wait) turns that spike into a single query.'] }}
      exercise={{ id: 'measure', prompt: 'Before sizing a production cache, what would you measure?', checklist: ['The real access distribution (how skewed).', 'Item size / memory per entry and the target hit rate or DB load.'], model: 'How skewed real access is (requests per key over a day) and how big each entry is, then pick the size that reaches the hit rate needed to keep database load under its limit.' }}
      fresh={{ question: { id: 'fresh', prompt: 'Popularity becomes nearly uniform (skew 0.2). Does doubling the cache from 200 to 400 entries roughly double the hit rate?', choices: [
        { id: 'yes', text: 'Roughly yes: with uniform access, hit rate tracks the fraction cached.', why: 'Right. With no hot set, each extra entry adds about the same.' },
        { id: 'no', text: 'No, it barely changes.', why: 'That’s true under strong skew, where the hot set is already cached. Under uniform access every entry matters.' },
      ], correct: 'yes' }, reveal: () => {
        const a = Math.round(simulateCacheHitRate({ items: 2000, size: 200, skew: 0.2 }) * 100);
        const b = Math.round(simulateCacheHitRate({ items: 2000, size: 400, skew: 0.2 }) * 100);
        return <Note>Simulated, skew 0.2: 200 entries → <strong>{a}%</strong>, 400 entries → <strong>{b}%</strong>.</Note>;
      } }}
      assumptions={['2,000 items; popularity weight 1/rank^skew; LRU eviction; 20,000 seeded requests per point (8,000 for the curve).', 'Stampede: requests arriving during one reload all miss unless coalesced.']}
    />
  );
}

/* ---------------- Stale reads ---------------- */
export function LabStaleReads() {
  const [s, set] = useRecord<{ lag: number; strategy: ReadStrategy }>('sim:lab-stale-reads', { lag: 1500, strategy: 'follower' });
  const series: Series[] = (['follower', 'leader-after-own-write', 'synchronous'] as ReadStrategy[]).map((st, i) => ({ name: st === 'follower' ? 'follower reads' : st === 'synchronous' ? 'synchronous' : 'read-your-writes', tone: (['fail', 'ok', 'accent'] as const)[i], points: [0, 500, 1000, 1500, 2000, 2500, 3000].map((lag) => [lag, Math.round(staleFraction({ lagMs: lag, strategy: st, stickyMs: 5000 }) * 100)] as [number, number]) }));
  const frac = Math.round(staleFraction({ lagMs: s.lag, strategy: s.strategy, stickyMs: 5000 }) * 100);
  return (
    <LabFrame
      id="lab-stale-reads"
      opening="Users edit their profile and reload it within three seconds. What fraction of those reloads show the old value, and which routing rule fixes it at what cost?"
      predict={{ id: 'pct', prompt: 'Lag is 1.5 s. A user reloads at a random moment in the 3 s after saving, reading from a follower. Roughly what share of reloads show the old name?', choices: [
        { id: 'half', text: 'About half', why: 'The copy is missing for 1.5 of the 3 seconds.' },
        { id: 'none', text: 'Almost none: lag is short', why: 'Short in absolute terms, but users reload quickly after saving.' },
        { id: 'all', text: 'Nearly all', why: 'After 1.5 s the follower has the new value.' },
      ] }}
      experiment={{ title: 'Lag and routing', body: 'The chart shows stale reads for each strategy as lag grows. The slider and buttons pick the case reported below.', render: () => (
        <>
          <Slider label="Replication lag" value={s.lag} min={0} max={3000} step={100} unit="ms" onChange={(v) => set({ ...s, lag: v })} />
          <Choice label="Writer’s reads go to" value={s.strategy} options={[{ id: 'follower', label: 'Follower' }, { id: 'leader-after-own-write', label: 'Leader for 5 s' }, { id: 'synchronous', label: 'Sync replication' }]} onChange={(v) => set({ ...s, strategy: v })} />
          <Readout items={[
            { name: 'Stale reloads', value: `${frac}%`, tone: frac ? 'bad' : 'good' },
            { name: 'Extra wait for “Saved”', value: s.strategy === 'synchronous' ? `${s.lag.toLocaleString()} ms` : '0 ms', tone: s.strategy === 'synchronous' && s.lag ? 'bad' : undefined },
            { name: 'Extra leader reads', value: s.strategy === 'leader-after-own-write' ? 'writer, 5 s' : 'none' },
          ]}>{s.strategy === 'follower' ? 'Follower reads are cheapest; the writer sees the old value until the copy lands.' : s.strategy === 'synchronous' ? 'No stale reads for anyone, paid for by a slower save on every write.' : 'No stale reads for the writer, paid for by extra reads on the leader.'}</Readout>
          <Chart series={series} marks={[{ x: s.lag, y: frac, label: `${frac}%` }]} xLabel="replication lag (ms)" yLabel="stale reloads (%)" yMax={100} description={`${frac}% stale`} note="Reloads sampled every 100 ms in the 3 s after “Saved”." />
        </>
      ) }}
      explain={{ title: 'Stale reads scale with lag ÷ reload window', body: ['With follower reads, the share of stale reloads is roughly the lag divided by how soon users reload. Read-your-writes removes them for the writer by sending that user’s reads to the leader briefly. Synchronous replication removes them for everyone by making every save wait for the copy.'] }}
      exercise={{ id: 'choose', prompt: 'For a team settings page edited by admins, which strategy would you pick and why?', checklist: ['Picks read-your-writes (or sync if all admins must see it instantly).', 'Mentions cost: leader load or slower saves.'], model: 'Read-your-writes: the admin who saved must see the change, others can lag briefly, and the extra leader reads are tiny for a settings page.' }}
      fresh={{ question: { id: 'fresh', prompt: 'Lag is 800 ms but the “read from leader” window is only 500 ms. A writer reloads 600 ms after saving. Stale?', choices: [
        { id: 'yes', text: 'Yes: the window has closed but the copy hasn’t arrived yet.', why: 'Right. The leader window must be longer than the lag (usually with margin), or a gap opens.' },
        { id: 'no', text: 'No: they read from the leader', why: 'Only for the first 500 ms. At 600 ms they’re back on the follower, which gets the copy at 800 ms.' },
      ], correct: 'yes' }, reveal: () => <Note>At 600 ms: window (500 ms) expired, copy arrives at 800 ms, so the follower still has the old value. Keep the window longer than worst-case lag.</Note> }}
      assumptions={['One leader and one follower with a fixed lag; reload times sampled every 100 ms over 3 s after the save.', 'Network time between app and databases ignored.']}
    />
  );
}

/* ---------------- Hot spots ---------------- */
export function LabHotSpots() {
  const [s, set] = useRecord<{ shards: number; hot: number; key: 'event' | 'seat' | 'event+bucket' }>('sim:lab-hot-spots', { shards: 4, hot: 40, key: 'event' });
  const loads = shardLoads({ shards: s.shards, hotShare: s.hot / 100, key: s.key, buckets: 4 });
  const max = Math.max(...loads);
  return (
    <LabFrame
      id="lab-hot-spots"
      opening="A superstar’s tour goes on sale and one event takes a huge share of all traffic. Your seats are sharded. Does adding shards help? Does the partition key?"
      predict={{ id: 'more', prompt: 'Partitioned by event_id with 4 shards, the hot shard carries 55%. You double to 8 shards. What does the hot shard carry?', choices: [
        { id: 'still', text: 'Still over 45%: the hot event lives on one shard however many there are.', why: 'Right. More shards dilute the background traffic, not the hot key.' },
        { id: 'half', text: 'About 27%: half as much', why: 'Only the background traffic spreads out. The hot event’s 40% stays together.' },
      ] }}
      experiment={{ title: 'Shards, hotness and key choice', body: 'Loads are each shard’s share of total traffic. One shard can only take so much: watch the tallest bar.', render: () => (
        <>
          <Slider label="Shards" value={s.shards} min={2} max={16} step={1} unit="" onChange={(v) => set({ ...s, shards: v })} />
          <Slider label="Hot event share" value={s.hot} min={0} max={80} step={5} unit="%" onChange={(v) => set({ ...s, hot: v })} />
          <Choice label="Partition key" value={s.key} options={[{ id: 'event', label: 'event_id' }, { id: 'seat', label: 'seat_id' }, { id: 'event+bucket', label: 'event_id + bucket (4)' }]} onChange={(v) => set({ ...s, key: v })} />
          <Readout items={[
            { name: 'Hottest shard', value: `${max}%`, tone: max > 30 ? 'bad' : 'good' },
            { name: 'Even share', value: `${(100 / s.shards).toFixed(1)}%` },
            { name: 'Shards per event query', value: s.key === 'seat' ? `all ${s.shards}` : s.key === 'event+bucket' ? '4' : '1' },
          ]}>{s.key === 'event' ? 'The hot event lives on one shard however many shards there are.' : s.key === 'seat' ? 'Load is even, but every query about the event now asks every shard (scatter-gather).' : 'The hot event is split four ways; its reads now combine 4 shards.'}</Readout>
          <Chart kind="bar" categories={loads.map((_, i) => `${i}`)} series={[{ name: 'values', points: loads.map((l, i) => [i, l] as [number, number]), tone: max > 30 ? 'fail' : 'accent' }]} xLabel="shard" yLabel="share of traffic (%)" yMax={100} description={`Hottest shard ${max}%`} />
        </>
      ) }}
      explain={{ title: 'Hot keys need their own plan', body: ['Hashing spreads *different* keys evenly. A single very popular key still lands on one shard. Fixes split the key (seat_id, or event_id plus a bucket suffix for known-hot events) at the cost of reads that must ask several shards, or cache the hot key’s reads in front of the shards.'] }}
      exercise={{ id: 'detect', prompt: 'How would you find out which keys are hot before an on-sale?', checklist: ['Measure per-key request rates (metrics, sampling, previous sales).', 'Use known signals (pre-sale registrations, artist popularity) to pre-split.'], model: 'Track requests per partition key (sampled) and use pre-sale signals like waitlist sign-ups to identify likely hot events, then pre-split those with buckets before the sale.' }}
      fresh={{ question: { id: 'fresh', prompt: '8 shards, hot event 60% of traffic, key = event_id + 4 buckets. What does each of the 4 bucket shards carry, roughly?', choices: [
        { id: '20', text: 'About 20%: 15% of the hot event plus 5% background', why: 'Right: 60% ÷ 4 = 15%, plus (40% ÷ 8) = 5%.' },
        { id: '65', text: 'About 65%', why: 'Buckets split the hot event four ways.' },
      ], correct: '20' }, reveal: () => <Note>Simulated loads: {shardLoads({ shards: 8, hotShare: 0.6, key: 'event+bucket', buckets: 4 }).join('%, ')}%.</Note> }}
      assumptions={['Background traffic spreads evenly over shards; the hot event’s traffic follows the partition key.', 'Bucketed keys split the hot event evenly over 4 shards.']}
    />
  );
}

/* ---------------- Queue backlog ---------------- */
export function LabQueueBacklog() {
  const [s, set] = useRecord<{ process: number; burst: number }>('sim:lab-queue-backlog', { process: 1500, burst: 10 });
  const r = backlogSeries({ arrive: 2000, process: s.process, burstSeconds: s.burst * 60, afterArrive: 300, seconds: 40 * 60 });
  const pts = r.backlog.filter((_, i) => i % 60 === 0).map((b, i) => [i, b] as [number, number]);
  const drainMin = r.backlog.findIndex((b, i) => i > s.burst * 60 && b === 0);
  return (
    <LabFrame
      id="lab-queue-backlog"
      opening="Ticket emails queue up during an on-sale. How deep does the backlog get, how late is the last email, and how many workers would keep it under five minutes?"
      predict={{ id: 'peak', prompt: '2,000 messages/s arrive for 10 minutes; workers send 1,500/s. What is the peak backlog?', choices: [
        { id: '300k', text: '300,000', why: '500 extra per second × 600 s.' },
        { id: '30k', text: '30,000', why: 'That’s one minute’s growth; the rush lasts ten.' },
        { id: '1.2m', text: '1.2 million', why: 'That counts all arrivals, not the excess over what workers send.' },
      ] }}
      experiment={{ title: 'Worker speed and rush length', body: 'After the rush, arrivals drop to 300/s and the backlog drains at the spare rate.', render: () => (
        <>
          <Slider label="Workers send" value={s.process} min={1000} max={3000} step={100} unit="msg/s" onChange={(v) => set({ ...s, process: v })} />
          <Slider label="Rush length" value={s.burst} min={1} max={30} step={1} unit="min" onChange={(v) => set({ ...s, burst: v })} />
          <Readout items={[
            { name: 'Peak backlog', value: Math.max(...r.backlog).toLocaleString(), tone: Math.max(...r.backlog) ? 'bad' : 'good' },
            { name: 'Oldest wait', value: `${Math.round(r.maxAgeSeconds / 6) / 10} min`, tone: r.maxAgeSeconds <= 300 ? 'good' : 'bad' },
            { name: 'Cleared', value: drainMin > 0 ? `${Math.round((drainMin - s.burst * 60) / 60)} min after the rush` : s.process >= 2000 ? 'never built up' : 'not within 40 min' },
          ]}>{s.process >= 2000 ? 'Workers keep up with the rush, so nothing waits.' : `The queue grows by ${(2000 - s.process).toLocaleString()} messages every second of the rush, then drains at ${(s.process - 300).toLocaleString()}/s.`} {r.maxAgeSeconds <= 300 ? 'The 5-minute promise holds.' : 'The 5-minute promise for ticket emails is broken.'}</Readout>
          <Chart series={[{ name: 'backlog', points: pts, tone: s.process >= 2000 ? 'ok' : 'fail' }]} xLabel="minutes" yLabel="messages waiting" description={`Peak ${Math.max(...r.backlog)}`} note="2,000 msg/s during the rush, then 300 msg/s." />
        </>
      ) }}
      explain={{ title: 'Excess × duration, then drain at the spare rate', body: ['Backlog grows by (arrivals − processing) every second of the rush, then shrinks by (processing − new arrivals). The wait of the last message ≈ backlog ÷ processing rate. A queue turns overload into delay rather than errors, which is useful only if the delay is acceptable.'] }}
      exercise={{ id: 'alert', prompt: 'What would you alert on for this queue, and at what threshold?', checklist: ['Age of the oldest message (user-visible delay).', 'A threshold tied to the promise (e.g. tickets within 5 minutes).'], model: 'The age of the oldest message, alerting at 3 minutes so there’s time to add workers before the 5-minute promise for ticket emails is broken.' }}
      fresh={{ question: { id: 'fresh', prompt: 'To keep the oldest email under 5 minutes during a 10-minute rush of 2,000/s, which is the smallest worker rate that works?', choices: [
        { id: '1400', text: 'About 1,400/s', why: 'Right. Backlog = (2,000 − p) × 600 s; the last message waits backlog ÷ p. Requiring that ≤ 300 s gives p ≥ 1,333/s, so 1,400 works and 1,300 doesn’t.' },
        { id: '1000', text: '1,000/s', why: 'Backlog = 1,000 × 600 = 600,000; the last message waits 600 s = 10 minutes.' },
        { id: '2000', text: 'At least 2,000/s', why: 'That avoids any backlog, but up to 5 minutes of delay is allowed, so less is enough.' },
      ], correct: '1400' }, reveal: () => {
        const rows = [1200, 1300, 1400, 1500].map((p) => ({ p, age: backlogSeries({ arrive: 2000, process: p, burstSeconds: 600, afterArrive: 300, seconds: 1800 }).maxAgeSeconds }));
        return <Note>Simulated oldest wait: {rows.map((x) => `${x.p}/s → ${Math.round(x.age / 6) / 10} min`).join(' · ')}</Note>;
      } }}
      assumptions={['Steady arrival and processing rates; second-by-second accounting; no retries or failures.']}
    />
  );
}

/* ---------------- Payment retries ---------------- */
export function LabPaymentRetries() {
  const [s, set] = useRecord<{ retries: number; backoff: 'none' | 'exponential' | 'exponential+jitter'; key: boolean }>('sim:lab-payment-retries', { retries: 3, backoff: 'none', key: false });
  const r = useMemo(() => simulateRetries({ clients: 2000, retries: s.retries, backoff: s.backoff, idempotencyKey: s.key, outageSeconds: 3, lostReplyRate: 0.3 }), [s]);
  return (
    <LabFrame
      id="lab-payment-retries"
      opening="The payment provider struggles for three seconds. 2,000 buyers are mid-checkout. Some charges go through but the reply is lost. Your retry policy decides how many people get charged twice, and how hard you hit the provider while it’s down."
      predict={{ id: 'dup', prompt: 'Retries enabled, no idempotency key, 30% of calls during the outage succeed but lose their reply. Will anyone be charged twice?', choices: [
        { id: 'yes', text: 'Yes: a retry after a lost reply is a brand-new charge.', why: 'The simulation counts them.' },
        { id: 'no', text: 'No: the provider knows it’s the same buyer.', why: 'Without a key, it has no way to tell a retry from a second purchase.' },
      ] }}
      experiment={{ title: 'Retries, backoff and keys', body: 'Each run replays the same 2,000 clients with a fixed seed. The chart shows attempts per second hitting the provider.', render: () => (
        <>
          <Slider label="Retries" value={s.retries} min={0} max={5} step={1} unit="" onChange={(v) => set({ ...s, retries: v })} />
          <Choice label="Backoff" value={s.backoff} options={[{ id: 'none', label: 'Immediate' }, { id: 'exponential', label: 'Exponential' }, { id: 'exponential+jitter', label: '+ jitter' }]} onChange={(v) => set({ ...s, backoff: v })} />
          <Choice label="Idempotency key" value={s.key ? 'on' : 'off'} options={[{ id: 'off', label: 'Off' }, { id: 'on', label: 'On' }]} onChange={(v) => set({ ...s, key: v === 'on' })} />
          <Readout items={[
            { name: 'Confirmed', value: `${r.succeeded.toLocaleString()} of 2,000`, tone: r.succeeded === 2000 ? 'good' : 'bad' },
            { name: 'Charged, never told', value: `${Math.max(0, r.charged - r.succeeded).toLocaleString()}`, tone: r.charged > r.succeeded ? 'bad' : 'good' },
            { name: 'Duplicate charges', value: `${r.duplicateCharges.toLocaleString()}`, tone: r.duplicateCharges ? 'bad' : 'good' },
            { name: 'Attempts in second 0', value: `${r.attemptsPerSecond[0].toLocaleString()}` },
          ]}>
            {r.succeeded < 2000 && r.charged > r.succeeded
              ? `${(2000 - r.succeeded).toLocaleString()} buyers ran out of retries inside the outage and saw an error, yet ${(r.charged - r.succeeded).toLocaleString()} of them were charged: their charge went through but the reply was lost. `
              : ''}
            {r.duplicateCharges ? 'Without an idempotency key, each retry after a lost reply is a new charge.' : s.key ? 'The key lets the provider recognise retries, so nobody pays twice.' : ''}
          </Readout>
          <Chart kind="bar" categories={r.attemptsPerSecond.slice(0, 12).map((_, i) => `${i}`)} series={[{ name: 'values', points: r.attemptsPerSecond.slice(0, 12).map((a, i) => [i, a] as [number, number]), tone: 'accent' }]} xLabel="second" yLabel="attempts sent to the provider" description="Attempts per second" note="The provider is degraded for the first 3 seconds; every call after that succeeds." />
        </>
      ) }}
      explain={{ title: 'Keys stop duplicates; backoff stops storms', body: ['Only an idempotency key prevents double charges: the provider recognises the retry and returns the first result. Backoff and jitter don’t prevent duplicates, but they spread retries out so a struggling provider isn’t hammered all at once. Too few retries, and buyers whose attempts all fell in the outage give up.'] }}
      exercise={{ id: 'policy', prompt: 'Write the retry policy you’d ship for payment calls in one or two sentences.', checklist: ['Idempotency key per payment.', 'A small number of retries with exponential backoff and jitter, within a deadline.'], model: 'Every payment carries one idempotency key; retry timeouts and 503s up to 3 times with exponential backoff and full jitter, within a 10-second overall deadline, then show the buyer a clear failure.' }}
      fresh={{ question: { id: 'fresh', prompt: 'You enable idempotency keys but keep immediate retries. What changes?', choices: [
        { id: 'dups', text: 'Duplicates drop to zero; the burst of attempts in the first second stays.', why: 'Right. Keys fix correctness, backoff fixes load. You need both.' },
        { id: 'both', text: 'Both duplicates and the burst disappear.', why: 'Keys don’t change when retries are sent.' },
      ], correct: 'dups' }, reveal: () => {
        const x = simulateRetries({ clients: 2000, retries: 3, backoff: 'none', idempotencyKey: true, outageSeconds: 3, lostReplyRate: 0.3 });
        return <Note>Simulated: duplicates <strong>{x.duplicateCharges}</strong>; attempts in second 0: <strong>{x.attemptsPerSecond[0]}</strong>.</Note>;
      } }}
      assumptions={['2,000 clients start at t=0; during the 3 s outage calls fail, but 30% charge the card and lose the reply.', 'After the outage every call succeeds. Backoff starts at 0.5 s and doubles (cap 8 s); “immediate” waits 0.2 s.']}
    />
  );
}

/* ---------------- LRU operations ---------------- */
const opText = (o: LruOp) => (o.type === 'get' ? `get(${o.key})` : `put(${o.key})`);

/** Start state, operations, and (optionally) progress through them, drawn from one puzzle. */
function PuzzleView({ pz, shown, reveal }: { pz: EvictionPuzzle; shown: number; reveal?: boolean }) {
  const cur = shown === 0 ? null : pz.trace[shown - 1];
  const order = cur ? cur.order : pz.start;
  const values = cur ? cur.values : Object.fromEntries(pz.start.map((k) => [k, k.toLowerCase()]));
  const moved = cur && cur.op.type === 'get' && cur.hit ? cur.op.key : cur && cur.op.type === 'put' && !cur.evicted ? cur.op.key : undefined;
  return (
    <>
      <div className="stage-top">
        <span className="stage-label">Cache · capacity 3 · puzzle #{pz.seed}</span>
        <span className="clock">{cur ? `after ${opText(cur.op)}` : 'start'}</span>
      </div>
      <RecencyRow order={order} values={values} moved={moved ?? undefined} evicted={cur?.evicted} inserted={cur?.evicted ? cur.op.key : undefined} />
      <ol className="op-list" aria-label="Operations, in order">
        {pz.ops.map((o, i) => {
          const done = i < shown;
          const t = pz.trace[i];
          const result = !done && !reveal ? '' : t.op.type === 'get' ? (t.hit ? 'hit: moves to the front' : 'miss: nothing changes') : t.evicted ? `evicts ${t.evicted}` : 'updates the value, moves to the front';
          return (
            <li key={i} className={done ? (i === shown - 1 ? 'current' : 'done') : ''}>
              <code>{opText(o)}</code>
              {result && <span className="op-result">{result}</span>}
            </li>
          );
        })}
      </ol>
    </>
  );
}

export function LabLru() {
  const base = useMemo(() => evictionPuzzle(4), []);
  const [shown, setShown] = useRecord<number>('sim:lab-lru:shown', 0);
  const [freshSeed, setFreshSeed] = useRecord<number>('sim:lab-lru:fresh-seed', 101);
  const fresh = useMemo(() => evictionPuzzle(freshSeed), [freshSeed]);
  const safeShown = Math.min(Math.max(0, shown), base.ops.length);
  const sorted = (keys: string[]) => [...keys].sort();
  return (
    <LabFrame
      id="lab-lru"
      opening="A 3-slot LRU cache forgets the item that was **used** least recently, not the one that arrived first. Reads change that order, and that is where predictions go wrong. Predict, step through it, then solve fresh cache states."
      predictVisual={() => <PuzzleView pz={base} shown={0} />}
      predict={{
        id: 'evict',
        prompt: `The cache starts full, most → least recent: **${base.start.join(', ')}**. Then: ${base.ops.map((o) => `\`${opText(o)}\``).join(', ')}. Which key does the last put evict?`,
        choices: sorted(base.start).map((k) => ({
          id: k,
          text: k,
          why: k === base.evicted
            ? `Right: ${k} ended up least recently used. Step through to watch it reach the end of the row.`
            : k === base.naive
              ? `${k} was least recent at the start, but a read moved it forward. Step through to see which key took its place.`
              : `${k} is not at the least-recent end when the put arrives. Step through to see the order change.`,
        })),
        correct: base.evicted,
      }}
      experiment={{
        title: 'Apply one operation at a time',
        body: 'Each operation updates the recency row. A hit moves the key to the front; a miss changes nothing; a put of a new key into a full cache evicts the key at the least-recent end.',
        render: () => (
          <>
            <PuzzleView pz={base} shown={safeShown} />
            {safeShown > 0 && (
              <div className="stage-actions"><button className="btn btn-quiet btn-small" onClick={() => setShown(0)}><Icon name="reset" size={15} /> Back to the start state</button></div>
            )}
          </>
        ),
        action: () => (safeShown < base.ops.length ? { label: `Apply ${opText(base.ops[safeShown])}`, onClick: () => setShown(safeShown + 1), lockMs: 650 } : undefined),
      }}
      explain={{ title: 'Track one list, not a history', body: ['You only ever need the current recency list. A hit moves the key to the front. A miss changes nothing. A put of an existing key updates it and moves it to the front without evicting. A put of a new key goes to the front and, if the cache was full, drops the key at the end.', 'The common mistake is answering with the key that was oldest *at the start*. Any read of that key rescues it.'] }}
      exercise={{ id: 'trick', prompt: 'Which operation in a trace is easiest to get wrong, and why?', checklist: ['Names one (a read that rescues the oldest key, a miss that changes nothing, or a put that updates an existing key without evicting).', 'Explains the misconception.'], model: 'A read of the least recent key: it moves that key to the front, so the next eviction takes a different key than the one that was oldest a moment ago.' }}
      fresh={{
        key: `p${freshSeed}`,
        visual: () => <PuzzleView pz={fresh} shown={0} />,
        question: {
          id: 'fresh',
          prompt: `New cache state, most → least recent: **${fresh.start.join(', ')}**. Then ${fresh.ops.map((o) => `\`${opText(o)}\``).join(', ')}. Which key is evicted?`,
          choices: sorted(fresh.start).map((k) => ({ id: k, text: k, why: k === fresh.evicted ? 'Right.' : k === fresh.naive ? `${k} was oldest at the start, but a read moved it forward.` : `${k} isn’t at the least-recent end when the new key arrives.` })),
          correct: fresh.evicted,
        },
        reveal: () => <PuzzleView pz={fresh} shown={fresh.ops.length} reveal />,
        another: { label: 'Another cache state', onClick: () => setFreshSeed(freshSeed + 1) },
      }}
      assumptions={['Capacity 3. A read (get) of a cached key moves it to the front; a read of a missing key changes nothing; a put of a cached key updates it and moves it to the front; a put of a new key into a full cache evicts the least recently used key.', 'Puzzles are generated from a numbered seed, so each puzzle number always gives the same problem.']}
    />
  );
}

/* ---------------- Concurrent reservations ---------------- */
const CONDITIONAL = `def reserve(db, seat_id, buyer):
    rows = db.execute(
        "UPDATE seats SET buyer = ? WHERE id = ? AND buyer IS NULL",
        buyer, seat_id,
    )
    return "Confirmed" if rows == 1 else "Sold out"`;

export function LabConcurrentReservations() {
  const [strategy, setStrategy] = useRecord<ReserveStrategy>('sim:concurrent-reservations', 'check-then-write');
  const out = reservationOutcomes(strategy);
  const three = useMemo(() => {
    const steps = (b: string) => [{ buyer: b, kind: 'read' as const }, { buyer: b, kind: 'write' as const }];
    const bc = interleavings(steps('Leo'), steps('Ana'));
    let triple = 0;
    let total = 0;
    for (const x of bc) for (const o of interleavings(steps('Maya'), x)) { total++; if (runInterleaving(o, 'check-then-write').confirmed.length === 3) triple++; }
    return { total, triple };
  }, []);
  return (
    <LabFrame
      id="concurrent-reservations"
      opening="Back to Maya and Leo and the last seat. In the first lesson you watched one bad interleaving. Now test every possible interleaving, then apply the fix and prove it holds in all of them."
      predict={{ id: 'count', prompt: 'With check-then-write (read, then write), there are 6 possible orderings of Maya’s and Leo’s steps. In how many are both confirmed?', choices: [
        { id: '1', text: 'Only 1: the unlucky one from the first lesson', why: 'More orderings than that let both reads happen before either write.' },
        { id: '4', text: '4 of 6', why: 'Any ordering where both reads come before the second write double-books.' },
        { id: '0', text: 'None', why: 'The first lesson showed at least one.' },
      ] }}
      experiment={{ title: 'Every interleaving, two strategies', body: 'Each row is one possible order of the two buyers’ database steps. Switch strategies and compare.', render: () => (
        <>
          <Choice label="Strategy" value={strategy} options={[{ id: 'check-then-write', label: 'Read, then write' }, { id: 'conditional-write', label: 'Conditional write' }]} onChange={setStrategy} />
          <Readout items={[
            { name: 'Orderings tested', value: `${out.total}` },
            { name: 'Double-booked', value: `${out.doubleBooked}`, tone: out.doubleBooked ? 'bad' : 'good' },
          ]}>{out.doubleBooked ? 'Any ordering where both reads land before the second write confirms both buyers.' : 'The check and the write happen as one statement, so no ordering can confirm two buyers.'}</Readout>
          <ol className="history" style={{ listStyle: 'none' }}>
            {out.results.map((r, i) => (
              <li key={i}><time>#{i + 1}</time><span>{r.order.map((s) => `${s.buyer} ${s.kind}`).join(' → ')} · <strong style={{ color: r.confirmed.length > 1 ? 'var(--fail)' : 'var(--ok)' }}>{r.confirmed.length > 1 ? 'both confirmed' : `${r.confirmed[0]} only`}</strong></span></li>
            ))}
          </ol>
          {strategy === 'conditional-write' && <Snippet code={CONDITIONAL} highlight={[3]} caption="The check and the write are one statement; the database applies it atomically." />}
        </>
      ) }}
      explain={{ title: 'Make the check part of the write', body: ['The race exists because the check (read) and the change (write) are separate steps, so another buyer’s steps can land between them. A conditional write, `UPDATE … WHERE buyer IS NULL`, makes the database do both atomically: exactly one statement changes a row, and the other reports 0 rows and gets “Sold out”.', 'The same fix appears in every lesson that touched this: the SQL bridge, transactions, locking. Now you’ve tested it against every ordering.'] }}
      exercise={{ id: 'why', prompt: 'Why does the conditional write never double-book, whatever the order?', checklist: ['The database executes the check and the update as one atomic operation on the row.', 'The second buyer’s statement finds the seat taken and changes 0 rows.'], model: 'The database applies `UPDATE … WHERE buyer IS NULL` atomically on that row, so whichever statement runs second finds a buyer already set and changes nothing, which the app reports as sold out.' }}
      fresh={{ question: { id: 'fresh', prompt: 'Three buyers, check-then-write. Is there an ordering in which all three are confirmed?', choices: [
        { id: 'yes', text: 'Yes: all three read before any of them writes.', why: 'Right. Every read sees “free”, and every write succeeds.' },
        { id: 'no', text: 'No: at most two', why: 'Nothing limits it to two. Three early reads mean three confirmations.' },
      ], correct: 'yes' }, reveal: () => <Note>Enumerated: <strong>{three.triple}</strong> of {three.total} orderings confirm all three buyers with check-then-write. With the conditional write: 0.</Note> }}
      assumptions={['Each buyer’s steps keep their own order; every interleaving of the two sequences is enumerated.', 'The conditional write is atomic per row, as in SQL databases.']}
    />
  );
}

export const LAB_COMPONENTS: Record<string, () => JSX.Element> = {
  'lab-request-tracing': LabRequestTracing,
  'lab-load-balancing': LabLoadBalancing,
  'lab-cache': LabCache,
  'lab-stale-reads': LabStaleReads,
  'lab-hot-spots': LabHotSpots,
  'lab-queue-backlog': LabQueueBacklog,
  'lab-payment-retries': LabPaymentRetries,
  'lab-lru': LabLru,
  'concurrent-reservations': LabConcurrentReservations,
};
