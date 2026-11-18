/**
 * Lesson: "Why does my profile still show my old name?"
 * Format: timeline experiment. Storyboard: docs/STORYBOARDS.md §2.
 * Clock, values, tokens and captions all derive from stateAt()/readProfile() in src/sim/replication.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Diagram, type DNode, type DToken, type Layout } from '../components/Diagram';
import { Caption, Clock, Controls, LessonShell, More, NextLesson, Question, Sources, useReplay, useStep } from '../components/Lesson';
import { ShortAnswer, Snippet } from '../components/Exercise';
import { extractDef, lineOf } from '../../py/snippets';
import routingSource from '../../../python/sdm/read_routing.py?raw';
import { stateAt, readProfile, staleFraction, fmtClock, T0, WRITE_AT, type ReadStrategy, type ReplicaConfig } from '../../sim/replication';
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { raiseStatus } from '../../progress/activity';
import { topicById } from '../../content/curriculum';

const ID = 'replica-lag';
const ROUTE = extractDef(routingSource, 'pick_database');
const ROUTE_IF = lineOf(ROUTE, 'if reader_id');
const STEPS = ['Two copies', 'Save Alex', 'Read at 10:00:01', 'The copy arrives', 'Change the delay'];

const WIDE: Layout = {
  width: 820,
  height: 330,
  nodes: {
    phone: { x: 120, y: 165, w: 190, h: 84 },
    leader: { x: 560, y: 70, w: 230, h: 84 },
    follower: { x: 560, y: 262, w: 230, h: 84 },
  },
};
const NARROW: Layout = {
  width: 360,
  height: 390,
  nodes: {
    phone: { x: 84, y: 195, w: 152, h: 84 },
    leader: { x: 266, y: 48, w: 176, h: 84 },
    follower: { x: 266, y: 342, w: 176, h: 84 },
  },
};

const STRATEGIES: { id: ReadStrategy; label: string; cost: string }[] = [
  { id: 'follower', label: 'Always read from the follower', cost: 'Cheapest. The writer can see their old name until the copy arrives.' },
  { id: 'leader-after-own-write', label: 'Read your own writes from the leader for 5 s', cost: 'The writer always sees the new name. The leader serves extra reads after every save, and the app must remember who wrote recently.' },
  { id: 'synchronous', label: 'Wait for the follower before saying “Saved”', cost: 'Nobody sees the old name after “Saved”, but every save takes as long as the lag — and stalls if the follower is down.' },
];

type Sim = { lagMs: number; strategy: ReadStrategy; t: number };

export default function ReplicaLag() {
  const { store } = useProgress();
  const [replayKey, replay] = useReplay();
  const { step, next, back } = useStep(ID, STEPS.length, { onReplay: replay });
  const [saved, setSaved] = useRecord<boolean>('sim:replica-lag:saved', false);
  const [prediction] = useRecord<{ attempts: { picked: string }[] } | null>('quiz:replica-lag:predict', null);
  const [sim, setSim] = useRecord<Sim>('sim:replica-lag', { lagMs: 1500, strategy: 'follower', t: T0 + 1000 });
  const topic = topicById(ID);
  const answered = !!prediction?.attempts?.length;

  useEffect(() => {
    if (step === STEPS.length - 1) raiseStatus(store, ID, 'studied');
  }, [step, store]);

  // Lesson steps use a fixed lag of 1.5 s so 10:00:01 is mid-flight and 10:00:02 is after arrival.
  const cfg: ReplicaConfig = step === 4 ? { lagMs: sim.lagMs, strategy: sim.strategy, stickyMs: 5000 } : { lagMs: 1500, strategy: 'follower', stickyMs: 5000 };
  const t = step === 0 ? T0 : step === 1 ? WRITE_AT : step === 2 ? T0 + 1000 : step === 3 ? T0 + 2000 : sim.t;
  const wrote = step > 1 || (step === 1 && saved);
  const s = stateAt(cfg, t, wrote);
  const read = readProfile(cfg, t);

  // Which messages are visible.
  const tokens: DToken[] = [];
  if (step === 1 && saved) {
    tokens.push({ id: `w-${replayKey}`, from: 'phone', to: 'leader', label: 'name = Alex', tone: 'request' });
  }
  if ((step === 1 && saved) || step === 2) {
    tokens.push({ id: `c-wait-${step}`, from: 'leader', to: 'follower', label: 'copy ⧗', tone: 'copy', at: step === 1 ? 0.2 : 0.55 });
  }
  if (step === 2 && answered) {
    tokens.push({ id: `r-${replayKey}`, from: 'follower', to: 'phone', label: `“${read.value}”`, tone: read.stale ? 'fail' : 'response' });
  }
  if (step === 3) {
    tokens.push({ id: `c-arrive-${replayKey}`, from: 'leader', to: 'follower', label: 'copy: Alex', tone: 'copy' });
  }
  if (step === 4 && s.copyInFlight) {
    const p = Math.min(0.95, Math.max(0.05, (t - WRITE_AT) / cfg.lagMs));
    tokens.push({ id: `c-exp-${p.toFixed(2)}`, from: 'leader', to: 'follower', label: 'copy ⧗', tone: 'copy', at: p });
  }

  const phoneValue =
    step < 2 ? (step === 1 && saved ? 'Saved ✓' : 'Profile: Sam') :
    step === 2 ? (answered ? `Profile: ${read.value}` : 'Profile: ?') :
    step === 3 ? 'Profile: Alex' :
    t < s.savedAt ? 'Saving…' : `Profile: ${read.value}`;

  const nodes: DNode[] = [
    {
      id: 'phone', kind: 'client', label: 'Your phone', value: phoneValue,
      state: step === 2 && answered ? (read.stale ? 'fail' : 'ok') : step === 4 && t >= s.savedAt ? (read.stale ? 'fail' : 'ok') : 'idle',
    },
    {
      id: 'leader', kind: 'db', label: 'Leader', value: `name: ${s.leader}`,
      state: step === 1 && saved ? 'focus' : step === 4 && read.from === 'leader' && t >= WRITE_AT ? 'active' : 'idle',
      tag: step === 1 && saved ? { text: 'was: Sam', tone: 'changed' } : step === 0 ? { text: 'accepts updates', tone: 'plain' } : undefined,
    },
    {
      id: 'follower', kind: 'db', label: 'Follower', value: `name: ${s.follower}`,
      state: step === 3 ? 'focus' : step === 2 && answered ? 'active' : step === 4 && read.from === 'follower' && t >= WRITE_AT ? 'active' : 'idle',
      tag: step === 3 ? { text: 'was: Sam', tone: 'changed' } : step === 0 ? { text: 'receives a copy', tone: 'plain' } : s.copyInFlight ? { text: 'behind', tone: 'fail' } : undefined,
    },
  ];

  return (
    <LessonShell
      id={ID}
      crumbs={<><Link to="/topics">Data systems</Link> / Replication</>}
      title="Why does my profile still show my old name?"
      opening="You changed your name from Sam to Alex. A moment later, your profile says Sam again. Follow the update to see how both screens can be telling the truth."
    >
      <section className="stage" aria-label="Diagram">
        <div className="stage-top">
          <span className="muted" style={{ fontSize: 14 }}>
            Replication delay: {cfg.lagMs.toLocaleString()} ms
          </span>
          <Clock time={fmtClock(t, step === 4)} />
        </div>
        <Diagram
          nodes={nodes}
          edges={[
            { id: 'w', from: 'phone', to: 'leader', label: step >= 1 ? 'writes' : undefined },
            { id: 'c', from: 'leader', to: 'follower', label: 'copies', dashed: true, state: s.copyInFlight ? 'active' : 'idle' },
            { id: 'r', from: 'phone', to: 'follower', label: 'reads' },
          ]}
          tokens={tokens}
          wide={WIDE}
          narrow={NARROW}
          description={`At ${fmtClock(t)}, the leader stores ${s.leader} and the follower stores ${s.follower}.`}
        />
        {step === 1 && (
          <div className="stage-actions">
            <button className="btn btn-primary btn-lg" onClick={() => setSaved(true)} disabled={saved}>
              {saved ? 'Saved' : 'Save “Alex”'}
            </button>
          </div>
        )}
        {step === 4 && <Experiment sim={sim} setSim={setSim} />}
      </section>

      <StepText step={step} saved={saved} answered={answered} readValue={read.value} lag={cfg.lagMs} />

      {step === 2 && (
        <Question
          isPrediction
          recordKey="replica-lag:predict"
          prompt="It’s 10:00:01. If the profile reads from the follower now, which name appears?"
          choices={[
            { id: 'alex', text: 'Alex — the save already succeeded.' },
            { id: 'sam', text: 'Sam — the follower hasn’t received the copy yet.' },
            { id: 'error', text: 'An error — the databases disagree.' },
          ]}
          correct="sam"
          explain={(p) =>
            p === 'sam' ? <p>Right. Watch the read: it goes to the follower, which still holds Sam.</p> :
            p === 'alex' ? <p>The save succeeded on the <em>leader</em>. The read goes to the follower, whose copy is still on its way. Watch the read trace.</p> :
            <p>Neither database knows the other is behind, so there’s nothing to report. The follower answers honestly with what it has: Sam.</p>
          }
        />
      )}

      {step === 4 && (
        <>
          <Question
            recordKey="replica-lag:sister"
            prompt="The app uses “read your own writes from the leader for 5 s”. At 10:00:01, Alex’s sister opens Alex’s profile. Which name does she see?"
            choices={[
              { id: 'alex', text: 'Alex' },
              { id: 'sam', text: 'Sam' },
            ]}
            correct="sam"
            explain={(p) => (
              <p>
                {p === 'sam' ? 'Right. ' : ''}The rule only sends <em>the writer’s</em> reads to the leader. Everyone else still reads the follower,
                which says Sam until 10:00:02. That’s usually fine — the sister doesn’t know a change happened — and it keeps leader load low.
              </p>
            )}
          />
          <ShortAnswer
            lessonId={ID}
            spec={{
              id: 'like-count',
              prompt: 'When you tap Like, your own count must go up immediately; everyone else can wait a moment. Which approach would you pick, and what does it cost?',
              hint: 'Only one person needs the fresh value. Could their phone show it without asking a database?',
              checklist: ['Says only the person who tapped needs the fresh count.', 'Names a concrete cost (undoing the +1 if the write fails, or extra leader reads).'],
              model: 'Update the count on the tapper’s phone right away and send the write in the background; everyone else reads followers. The cost: if the write fails, the phone has to undo the +1.',
            }}
          />
        </>
      )}

      <Controls step={step} count={STEPS.length} onBack={back} onNext={next} onReplay={replay} nextLabel={STEPS[step + 1]}
        nextDisabled={(step === 1 && !saved) || (step === 2 && !answered)}
        nextHint={step === 1 && !saved ? 'Save “Alex” first' : step === 2 && !answered ? 'Answer the question first' : undefined} />

      <More summary="Event history">
        <ol className="history">
          {s.events.length === 0 && <li><time>{fmtClock(T0)}</time><span>Both databases store “Sam”.</span></li>}
          {s.events.map((e, i) => (
            <li key={i}><time>{fmtClock(e.t, true).slice(3)}</time><span>{e.text}</span></li>
          ))}
          {step >= 2 && answered && (
            <li><time>{fmtClock(t, true).slice(3)}</time><span>Profile reads from the {read.from}: “{read.value}”.</span></li>
          )}
        </ol>
      </More>

      <More summary="Worked example: one write, three reads">
        <p>Lag 1,500 ms. The write lands on the leader at 10:00:00.500, so the copy lands on the follower at 10:00:02.000.</p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Read at</th><th>From follower</th><th>Read own writes (writer)</th><th>Synchronous</th></tr></thead>
            <tbody>
              {[T0 + 700, T0 + 1000, T0 + 2100].map((rt) => (
                <tr key={rt}>
                  <td className="mono">{fmtClock(rt, true)}</td>
                  {(['follower', 'leader-after-own-write', 'synchronous'] as ReadStrategy[]).map((st) => {
                    const c = { lagMs: 1500, strategy: st, stickyMs: 5000 };
                    const r = readProfile(c, rt);
                    const st8 = stateAt(c, rt);
                    return <td key={st}>{st === 'synchronous' && rt < st8.savedAt ? 'still “Saving…”' : `${r.value}${r.stale ? ' (stale)' : ''}`}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Under synchronous replication the user waits 1.5 s for “Saved”. The stale reads haven’t vanished. They’ve turned into waiting.
        </p>
      </More>

      <More summary="Go deeper: what this model leaves out">
        <p>
          Real systems usually have several followers, each with its own lag. A user whose reads land on different followers can watch their name
          flip between old and new. Pinning each user to one follower (<em>monotonic reads</em>) prevents that.
        </p>
        <p>
          Lag is usually milliseconds, but grows under write bursts, network trouble or a slow follower. Our 1.5 s delay is exaggerated so you can
          see it. Measure your own system’s lag rather than assuming it.
        </p>
      </More>

      {step === STEPS.length - 1 && (
        <NextLesson to="/learn/failover" title="The leader database died. Now what?" reason="You now know followers can be behind. Next: what happens when the leader dies and a follower that’s behind gets promoted — including which writes are lost." />
      )}
      {topic && <Sources sources={topic.sources} />}
    </LessonShell>
  );
}

function StepText({ step, saved, answered, readValue, lag }: { step: number; saved: boolean; answered: boolean; readValue: string; lag: number }) {
  switch (step) {
    case 0:
      return (
        <Caption kicker="Setup" title="Two copies of your profile">
          <p>
            Your name is stored twice. The <strong>leader</strong> is the database that accepts updates. The <strong>follower</strong> receives a copy of
            every change, so it can serve reads and take load off the leader. Right now both say <strong>Sam</strong>.
          </p>
        </Caption>
      );
    case 1:
      return saved ? (
        <Caption kicker="Write" title="The leader says Alex. The follower still says Sam." changes={[{ kind: 'chg', text: 'Leader: Sam → Alex' }, { kind: 'add', text: 'Copy to follower: waiting' }]}>
          <p>Your phone shows “Saved” as soon as the leader stores the new name. The copy to the follower has started but hasn’t arrived.</p>
        </Caption>
      ) : (
        <Caption kicker="Try it" title="Change your name">
          <p>Press Save. Watch which database changes, and which one doesn’t.</p>
        </Caption>
      );
    case 2:
      return (
        <Caption kicker="Predict" title="Half a second later" changes={answered ? [{ kind: 'del', text: `The profile showed “${readValue}”` }] : undefined}>
          <p>
            The clock reads 10:00:01. Your phone has said “Saved” for half a second. Now the profile page loads, and this app sends profile reads to the
            follower.
          </p>
          {answered && (
            <p>
              Both screens told the truth. The save screen reported what the leader stored. The profile reported what the follower stored. They just
              read different copies at a moment when the copies differed.
            </p>
          )}
        </Caption>
      );
    case 3:
      return (
        <Caption kicker="Name it" title="The copy arrives" changes={[{ kind: 'chg', text: 'Follower: Sam → Alex at 10:00:02' }]}>
          <p>
            At 10:00:02 the copy reaches the follower, and now both say Alex. The gap between the leader applying a write and a follower applying it is
            called <strong>replication lag</strong>. Here it was {lag.toLocaleString()} ms.
          </p>
          <p>
            Nothing broke. The follower is <em>eventually</em> correct. The trouble is the window in between, and who reads during it.
          </p>
        </Caption>
      );
    case 4:
      return (
        <Caption kicker="Experiment" title="Change the delay, change the rule">
          <p>
            Drag the delay and the clock. Then pick a rule for where the writer’s reads go. Every rule removes stale reads for <em>someone</em> by paying
            somewhere else.
          </p>
        </Caption>
      );
    default:
      return null;
  }
}

function Experiment({ sim, setSim }: { sim: Sim; setSim: (s: Sim) => void }) {
  const cfg: ReplicaConfig = { lagMs: sim.lagMs, strategy: sim.strategy, stickyMs: 5000 };
  const frac = staleFraction(cfg);
  const st = stateAt(cfg, sim.t);
  const [playing, setPlaying] = useState(false);
  const simRef = useRef(sim);
  simRef.current = sim;
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const cur = simRef.current;
      const nt = cur.t + 250;
      if (nt > T0 + 4000) { setPlaying(false); return; }
      setSim({ ...cur, t: nt });
    }, 400);
    return () => clearInterval(id);
  }, [playing, setSim]);
  const strat = STRATEGIES.find((x) => x.id === sim.strategy)!;
  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 16, display: 'grid', gap: 14 }}>
      <label className="range-row" style={{ fontSize: 15 }}>
        <span style={{ minWidth: 150 }}>Replication delay</span>
        <input type="range" min={0} max={3000} step={250} value={sim.lagMs} onChange={(e) => setSim({ ...sim, lagMs: Number(e.target.value) })} aria-valuetext={`${sim.lagMs} milliseconds`} />
        <span className="mono" style={{ minWidth: 80 }}>{sim.lagMs} ms</span>
      </label>
      <label className="range-row" style={{ fontSize: 15 }}>
        <span style={{ minWidth: 150 }}>Clock</span>
        <input type="range" min={T0} max={T0 + 4000} step={250} value={sim.t} onChange={(e) => setSim({ ...sim, t: Number(e.target.value) })} aria-valuetext={fmtClock(sim.t, true)} />
        <button className="btn btn-small" onClick={() => { if (!playing && sim.t >= T0 + 4000) setSim({ ...sim, t: T0 }); setPlaying(!playing); }}>
          {playing ? 'Pause' : 'Play'}
        </button>
      </label>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 15, marginBottom: 6 }}>Where do the writer’s reads go?</legend>
        <div style={{ display: 'grid', gap: 6 }}>
          {STRATEGIES.map((x) => (
            <label key={x.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 15 }}>
              <input type="radio" name="strategy" checked={sim.strategy === x.id} onChange={() => setSim({ ...sim, strategy: x.id })} style={{ marginTop: 5 }} />
              <span>{x.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="notice" aria-live="polite">
        <strong>{Math.round(frac * 100)}%</strong> of the writer’s profile loads in the first 3 s after “Saved” show the old name.
        {' '}“Saved” appears {st.savedAt - WRITE_AT} ms after pressing Save.
        <div style={{ marginTop: 6, fontSize: 15 }}>{strat.cost}</div>
      </div>
      {sim.strategy === 'leader-after-own-write' && (
        <Snippet code={ROUTE} highlight={[ROUTE_IF]} caption="How an app might route reads (python/sdm/read_routing.py). Only the writer, and only for 5 seconds, goes to the leader." />
      )}
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Model: one leader, one follower, fixed delay, profile loads sampled every 100 ms. Network time between phone and databases is ignored.
      </p>
    </div>
  );
}
