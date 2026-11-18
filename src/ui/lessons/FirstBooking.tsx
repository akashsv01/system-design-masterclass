/**
 * Lesson: "Two buyers see one seat left. Who gets it?"
 * Format: guided trace. Storyboard: docs/STORYBOARDS.md §1.
 * Everything on screen derives from runReservation()/transition() in src/sim/booking.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Diagram, type DEdge, type DNode, type DToken, type Layout } from '../components/Diagram';
import { Caption, Controls, LessonShell, More, NextLesson, Question, Sources, useReplay, useStep, Clock, type Change } from '../components/Lesson';
import { DraftEditor } from '../components/Draft';
import { runReservation, seatText, confirmations, type BookingEvent } from '../../sim/booking';
import { useProgress, useRecord } from '../../progress/ProgressProvider';
import { raiseStatus } from '../../progress/activity';
import { topicById } from '../../content/curriculum';

const ID = 'first-booking';

const WIDE: Layout = {
  width: 820,
  height: 340,
  nodes: {
    'phone-maya': { x: 110, y: 90, w: 180 },
    'phone-leo': { x: 110, y: 255, w: 180 },
    server: { x: 420, y: 172, w: 170 },
    db: { x: 700, y: 172, w: 190, h: 84 },
  },
};
const NARROW: Layout = {
  width: 360,
  height: 520,
  nodes: {
    'phone-maya': { x: 92, y: 62, w: 164 },
    'phone-leo': { x: 270, y: 62, w: 164 },
    server: { x: 180, y: 262, w: 170 },
    db: { x: 180, y: 452, w: 200, h: 84 },
  },
};

const single = runReservation([{ name: 'Maya', pressAt: 0 }], 'check-then-write');
const race = runReservation(
  [
    { name: 'Maya', pressAt: 0 },
    { name: 'Leo', pressAt: 5 },
  ],
  'check-then-write',
);

const STEPS = [
  'One seat left',
  'Press Reserve',
  'Ask the database',
  'Change the stored value',
  'The answer comes back',
  'Check yourself',
  'A second buyer',
  'Predict',
  'Run the race',
  'Explain it',
  'The big picture (HLD)',
  'The seat itself (LLD)',
];

type Phase = { events: BookingEvent[]; shown: number; leo: boolean };

function fmtMs(t: number) {
  return `20:00:00.${String(Math.max(0, t)).padStart(3, '0')}`;
}

/** Build the diagram from a prefix of the event list. */
function scene({ events, shown, leo }: Phase, highlight: 'none' | 'db' | 'server' = 'none') {
  const seen = events.slice(0, shown);
  const last = seen[seen.length - 1];
  const seat = last ? last.seat : { status: 'available' as const };
  const replies = Object.fromEntries(seen.filter((e) => e.kind === 'reply').map((e) => [e.actor, e]));
  const phoneValue = (name: string) => {
    const r = replies[name];
    if (r) return r.outcome === 'confirmed' ? 'Confirmed ✓' : 'Sold out ✕';
    if (seen.some((e) => e.actor === name && e.kind === 'send')) return 'waiting…';
    return 'F12 · 1 left';
  };
  const phoneState = (name: string): DNode['state'] => {
    const r = replies[name];
    if (r) return r.outcome === 'confirmed' ? 'ok' : 'fail';
    return last?.actor === name && last.kind === 'send' ? 'active' : 'idle';
  };
  const usedServer = seen.length > 0;
  const usedDb = seen.some((e) => e.to === 'db');
  const prevSeat = seen.length > 1 ? seen[seen.length - 2].seat : { status: 'available' as const };
  const dbChanged = last?.kind === 'write';
  const nodes: DNode[] = [
    { id: 'phone-maya', kind: 'client', label: 'Maya’s phone', value: phoneValue('Maya'), state: phoneState('Maya') },
    { id: 'phone-leo', kind: 'client', label: 'Leo’s phone', value: phoneValue('Leo'), state: leo ? phoneState('Leo') : 'ghost' },
    {
      id: 'server', kind: 'server', label: 'Server', sub: 'booking program',
      state: !usedServer && highlight !== 'server' ? 'ghost' : last && (last.from === 'server' || last.to === 'server') && last.kind !== 'reply' ? 'active' : 'idle',
    },
    {
      id: 'db', kind: 'db', label: 'Database', value: `F12: ${seatText(seat)}`,
      state: !usedDb && highlight !== 'db' ? 'ghost' : dbChanged ? 'focus' : last?.to === 'db' ? 'active' : 'idle',
      tag: dbChanged ? { text: `was: ${seatText(prevSeat)}`, tone: 'changed' } : last?.kind === 'read' ? { text: `read: ${seatText(seat)}`, tone: 'plain' } : undefined,
    },
  ];
  const edges: DEdge[] = [
    { id: 'e1', from: 'phone-maya', to: 'server', state: usedServer ? 'idle' : 'ghost' },
    { id: 'e2', from: 'phone-leo', to: 'server', state: leo && usedServer ? 'idle' : 'ghost' },
    { id: 'e3', from: 'server', to: 'db', state: usedDb ? 'idle' : 'ghost' },
  ];
  const tokens: DToken[] = last
    ? [
        {
          id: `${shown}-${last.t}-${last.kind}-${last.actor}`,
          from: last.kind === 'reply' ? 'server' : last.from,
          to: last.kind === 'reply' ? last.to : last.to,
          label:
            last.kind === 'send' ? `Reserve · ${last.actor}` :
            last.kind === 'read' ? `read F12` :
            last.kind === 'write' ? `F12 = ${last.actor}` :
            last.kind === 'reply' ? (last.outcome === 'confirmed' ? `OK · ${last.actor}` : `Sold out`) : last.label,
          tone: last.kind === 'reply' ? (last.outcome === 'confirmed' ? 'response' : 'fail') : 'request',
        },
      ]
    : [];
  return { nodes, edges, tokens, seat };
}

export default function FirstBooking() {
  const { store } = useProgress();
  const [replayKey, replay] = useReplay();
  const [pressed, setPressed] = useRecord<boolean>('sim:first-booking:pressed', false);
  const [raceShown, setRaceShown] = useRecord<number>('sim:first-booking:race', 0);
  const [prediction] = useRecord<{ attempts: { picked: string }[] } | null>('quiz:first-booking:predict', null);
  const hasPrediction = !!prediction?.attempts?.length;
  const { step, go, next, back } = useStep(ID, STEPS.length, { onReplay: replay, canAdvance: true });
  const topic = topicById(ID);

  useEffect(() => {
    if (step === STEPS.length - 1) raiseStatus(store, ID, 'studied');
  }, [step, store]);

  // Map lesson steps to how much of the simulation is visible.
  const phase: Phase = useMemo(() => {
    if (step === 0) return { events: single, shown: 0, leo: false };
    if (step === 1) return { events: single, shown: pressed ? 1 : 0, leo: false };
    if (step === 2) return { events: single, shown: 2, leo: false };
    if (step === 3) return { events: single, shown: 3, leo: false };
    if (step === 4 || step === 5) return { events: single, shown: 4, leo: false };
    if (step === 6 || step === 7) return { events: race, shown: 0, leo: true };
    return { events: race, shown: step === 8 ? raceShown : race.length, leo: true };
  }, [step, pressed, raceShown]);

  const sc = scene(phase);
  const showDiagram = step <= 9;

  // Allow replay to re-run the token of the current step.
  const [tick, setTick] = useState(0);
  useEffect(() => setTick((x) => x + 1), [replayKey]);

  const nextDisabled = (step === 1 && !pressed) || (step === 7 && !hasPrediction) || (step === 8 && raceShown < race.length);
  const nextHint = step === 1 && !pressed ? 'Press Reserve first' : step === 7 && !hasPrediction ? 'Make a prediction first' : step === 8 && raceShown < race.length ? 'Play the race to the end' : undefined;
  const lastEvent = phase.events[phase.shown - 1];

  return (
    <LessonShell
      id={ID}
      crumbs={<><Link to="/topics">Foundations</Link> / Your first system</>}
      title="Two buyers see one seat left. Who gets it?"
      opening="Maya and Leo both want the last seat at Friday’s concert. They tap Reserve on different phones, a few milliseconds apart. Follow one reservation from tap to confirmation, then watch what happens when two arrive together."
    >
      {showDiagram && (
        <section className="stage" aria-label="Diagram">
          <div className="stage-top">
            <span className="muted" style={{ fontSize: 14 }}>Seat F12 · Friday 20:00</span>
            {step >= 6 && <Clock time={lastEvent ? fmtMs(lastEvent.t) : '19:59:59'} />}
          </div>
          <Diagram
            key={`d-${tick}`}
            nodes={sc.nodes}
            edges={sc.edges}
            tokens={sc.tokens}
            wide={WIDE}
            narrow={NARROW}
            description={`Seat F12 is ${seatText(sc.seat)}. ${lastEvent ? lastEvent.label : 'No request sent yet.'}`}
          />
          {step === 1 && (
            <div className="stage-actions">
              <button className="btn btn-primary btn-lg" onClick={() => { setPressed(true); setTick((x) => x + 1); }} disabled={pressed}>
                {pressed ? 'Reserve sent' : 'Reserve seat F12'}
              </button>
            </div>
          )}
          {step === 8 && (
            <div className="stage-actions">
              <button className="btn btn-primary" onClick={() => setRaceShown(Math.min(race.length, raceShown + 1))} disabled={raceShown >= race.length}>
                {raceShown === 0 ? 'Start: both press Reserve' : raceShown >= race.length ? 'Race finished' : 'Next event ▸'}
              </button>
              <button className="btn btn-quiet" onClick={() => setRaceShown(0)} disabled={raceShown === 0}>
                Restart race
              </button>
            </div>
          )}
        </section>
      )}

      <StepCaption step={step} phase={phase} hasPrediction={hasPrediction} />

      {step === 5 && (
        <Question
          recordKey="first-booking:truth"
          prompt="Maya’s phone, the server, or the database: where does the real state of seat F12 live?"
          choices={[
            { id: 'phone', text: 'Maya’s phone — it showed “1 left”.' },
            { id: 'server', text: 'The server — it runs the booking code.' },
            { id: 'db', text: 'The database — it stores F12’s value.' },
          ]}
          correct="db"
          explain={(p) =>
            p === 'db' ? (
              <p>Right. The phone shows a copy that can go out of date, and the server only acts on what it reads. The stored value is the truth everyone else asks about.</p>
            ) : p === 'phone' ? (
              <p>The phone only shows what it was told when the page loaded. That copy can already be wrong — you’ll see exactly that in a moment.</p>
            ) : (
              <p>The server decides <em>what to do</em>, but it reads and writes the seat in the database. If the server restarted, the seat’s value would still be there.</p>
            )
          }
        />
      )}

      {step === 7 && (
        <Question
          isPrediction
          recordKey="first-booking:predict"
          prompt="Maya presses Reserve at 20:00:00.000 and Leo at 20:00:00.005. The server reads the seat, and if it says available, writes the buyer’s name. What happens?"
          choices={[
            { id: 'maya', text: 'Maya gets the seat. Leo is told it’s sold out.' },
            { id: 'both', text: 'Both are told “Confirmed”.' },
            { id: 'leo', text: 'Leo gets the seat because his write lands last.' },
            { id: 'unsure', text: 'I’m not sure — it depends on timing.' },
          ]}
          explain={() => <p>Prediction saved. Run the race to see what this server actually does.</p>}
        />
      )}

      {step === 9 && (
        <DraftEditor
          recordKey="first-booking:race"
          prompt="In your own words: why did both buyers get “Confirmed”, and what would have to be true to prevent it?"
          placeholder="Both servers read… before either…"
        />
      )}

      {step === 10 && <HldView />}
      {step === 11 && <LldView />}

      <Controls
        step={step}
        count={STEPS.length}
        onBack={back}
        onNext={next}
        onReplay={step <= 9 ? replay : undefined}
        nextLabel={STEPS[step + 1]}
        nextDisabled={nextDisabled}
        nextHint={nextHint}
      />

      {step >= 8 && (
        <More summary="Event history">
          <ol className="history">
            {race.slice(0, step === 8 ? raceShown : race.length).map((e, i) => (
              <li key={i}>
                <time>+{e.t} ms</time>
                <span>
                  {e.actor}: {e.label}
                </span>
              </li>
            ))}
          </ol>
        </More>
      )}

      {step === STEPS.length - 1 && (
        <NextLesson
          to="/learn/inside-a-request"
          title="What’s inside a request?"
          reason="You sent “Reserve F12” without opening it. Next you’ll take one apart — address, method, headers, body — and see why it took 40 ms to arrive."
        />
      )}

      <More summary="Go deeper: what this model leaves out">
        <p>
          Real booking systems add payment, holds that expire, and many servers in front of one database. We kept one server and one seat so the
          race is easy to see. The same race happens with ten servers — it just happens more often.
        </p>
        <p>
          Our timings (40 ms per network hop, 10 ms per database step) are illustrative. Real numbers depend on distance and load; you’ll measure
          them in <Link to="/learn/latency">Latency and percentiles</Link>.
        </p>
      </More>
      {topic && <Sources sources={topic.sources} />}
      <p className="muted" style={{ fontSize: 14, marginTop: 24 }}>
        Jump to: {STEPS.map((s, i) => (
          <button key={s} className="btn btn-quiet btn-small" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined} style={{ fontWeight: i === step ? 700 : 400 }}>
            {i + 1}
          </button>
        ))}
      </p>
    </LessonShell>
  );
}

function StepCaption({ step, phase, hasPrediction }: { step: number; phase: Phase; hasPrediction: boolean }) {
  const last = phase.events[phase.shown - 1];
  switch (step) {
    case 0:
      return (
        <Caption kicker="Problem" title="One seat left">
          <p>
            Maya opens the concert page and sees <strong>F12 · 1 left</strong>. Her phone is a <strong>client</strong>: it shows information and
            sends requests, but it doesn’t decide who gets a seat. Something else has to.
          </p>
        </Caption>
      );
    case 1:
      return (
        <Caption
          kicker="Try it"
          title={last ? 'A request is on its way' : 'Press Reserve'}
          changes={last ? [{ kind: 'add', text: 'Server — the program that handles reservations' }, { kind: 'add', text: 'Request: “Reserve F12 for Maya”' }] : undefined}
        >
          {last ? (
            <p>
              Maya’s phone sent a <strong>request</strong>: a message that asks for something, here “reserve F12 for Maya”. It travels over the
              internet to a <strong>server</strong>, a program running on a computer that is always on. The trip takes about 40 ms.
            </p>
          ) : (
            <p>Press the button as Maya. Watch where the tap goes.</p>
          )}
        </Caption>
      );
    case 2:
      return (
        <Caption kicker="Read" title="Ask the database" changes={[{ kind: 'add', text: 'Database — stores the value of every seat' }, { kind: 'chg', text: 'Server reads F12 → available' }]}>
          <p>
            The server can’t trust the phone’s “1 left” — it could be minutes old. It asks the <strong>database</strong>, a program whose job is to
            store data and hand it back reliably. The answer: F12 is <strong>available</strong>.
          </p>
        </Caption>
      );
    case 3:
      return (
        <Caption kicker="Write" title="Change the stored value" changes={[{ kind: 'chg', text: 'F12: available → booked · Maya' }]}>
          <p>
            The server writes Maya’s name into F12. Look at the database: the value changed, and the tag shows what it was. That one change{' '}
            <em>is</em> the booking. Everything else is messages about it.
          </p>
        </Caption>
      );
    case 4:
      return (
        <Caption kicker="Respond" title="The answer comes back" changes={[{ kind: 'add', text: 'Response: “OK · Maya”' }, { kind: 'chg', text: 'Maya’s phone: Confirmed ✓' }]}>
          <p>
            The server sends a <strong>response</strong>, the answer to the request. Maya’s phone shows <strong>Confirmed</strong> about 100 ms
            after her tap: 40 ms there, 20 ms of database work, 40 ms back.
          </p>
          <p>Client, request, server, database, response. Every system in this course is built from those five ideas.</p>
        </Caption>
      );
    case 5:
      return (
        <Caption kicker="Check" title="Check yourself">
          <p>One question before we add a second buyer.</p>
        </Caption>
      );
    case 6:
      return (
        <Caption kicker="Problem" title="A second buyer">
          <p>
            Rewind to just before 20:00. The seat is available again. Leo loaded the same page a second earlier, so his phone also says{' '}
            <strong>1 left</strong>. Both screens are correct — for now.
          </p>
        </Caption>
      );
    case 7:
      return (
        <Caption kicker="Predict" title="Two taps, five milliseconds apart">
          <p>Same server, same steps as before: read the seat, and if it’s available, write the buyer’s name. Commit to a guess before you watch.</p>
        </Caption>
      );
    case 8: {
      const done = phase.shown >= phase.events.length;
      const winners = confirmations(phase.events.slice(0, phase.shown));
      return (
        <Caption
          kicker="Observe"
          title={done ? 'Two confirmations, one seat' : last ? describeEvent(last) : 'Both press Reserve'}
          changes={done ? [{ kind: 'del', text: 'Maya and Leo were both told “Confirmed”' }, { kind: 'chg', text: 'Database says F12 belongs to Leo — his write landed last' }] : undefined}
        >
          {!last && <p>Step through the race one event at a time. Watch the database value and both phones.</p>}
          {last && !done && <p>{eventExplanation(last)}</p>}
          {done && (
            <>
              <p>
                Both reads happened <em>before</em> either write, so both saw “available”. Each write then succeeded, and the second overwrote the first.{' '}
                {winners.join(' and ')} were both told they have the seat. On Friday, two people will arrive for F12.
              </p>
              {hasPrediction && <p className="muted">Compare this with your prediction. Getting this wrong is normal — it surprises most developers the first time.</p>}
            </>
          )}
        </Caption>
      );
    }
    case 9:
      return (
        <Caption kicker="Explain" title="Put it in your own words">
          <p>
            This bug has a name — a <strong>race condition</strong>: the result depends on the timing of two actions that overlap. Write or sketch what
            went wrong. Your draft is saved, and you’ll come back to it in <Link to="/learn/concurrent-reservations">Concurrent reservations</Link>,
            where you’ll fix it and test the fix.
          </p>
        </Caption>
      );
    case 10:
      return (
        <Caption kicker="High-level design" title="Which parts does a booking system need?">
          <p>
            <strong>High-level design (HLD)</strong> answers: which parts exist, what each part owns, and how they talk. Here is a realistic first
            version of the concert system.
          </p>
        </Caption>
      );
    case 11:
      return (
        <Caption kicker="Low-level design" title="What states can a seat be in?">
          <p>
            <strong>Low-level design (LLD)</strong> zooms into one part and decides its objects, states and rules. The seat is the heart of this
            system, so start there.
          </p>
        </Caption>
      );
    default:
      return null;
  }
}

function describeEvent(e: BookingEvent): string {
  if (e.kind === 'send') return `${e.actor} presses Reserve (+${e.t} ms)`;
  if (e.kind === 'read') return `Server reads F12 for ${e.actor}`;
  if (e.kind === 'write') return `Server writes ${e.actor} into F12`;
  if (e.kind === 'reply') return `${e.actor} is told: ${e.outcome === 'confirmed' ? 'Confirmed' : 'Sold out'}`;
  return e.label;
}

function eventExplanation(e: BookingEvent): string {
  if (e.kind === 'send') return e.actor === 'Maya' ? 'Maya’s request leaves first.' : 'Leo’s request is 5 ms behind Maya’s — both are now in flight.';
  if (e.kind === 'read') return e.actor === 'Maya' ? 'The server reads F12 for Maya: available.' : 'The server reads F12 for Leo. Maya’s write hasn’t happened yet, so Leo also sees available.';
  if (e.kind === 'write') return e.actor === 'Maya' ? 'Maya’s write lands. F12 now says Maya.' : 'Leo’s write lands 5 ms later and overwrites Maya. Nothing checked again.';
  return e.actor === 'Maya' ? 'Maya is told Confirmed.' : 'Leo is also told Confirmed.';
}

const HLD_WIDE: Layout = {
  width: 820,
  height: 330,
  nodes: {
    apps: { x: 100, y: 165, w: 160, h: 90 },
    booking: { x: 380, y: 100, w: 190 },
    seats: { x: 680, y: 100, w: 200, h: 84 },
    pay: { x: 380, y: 255, w: 190 },
  },
};
const HLD_NARROW: Layout = {
  width: 360,
  height: 560,
  nodes: {
    apps: { x: 180, y: 55, w: 220 },
    booking: { x: 180, y: 215, w: 220 },
    seats: { x: 95, y: 420, w: 170, h: 90 },
    pay: { x: 270, y: 420, w: 160, h: 90 },
  },
};

function HldView() {
  return (
    <>
      <section className="stage" aria-label="High-level design diagram" style={{ marginTop: 16 }}>
        <Diagram
          nodes={[
            { id: 'apps', kind: 'client', label: 'Apps', sub: 'phones, web' },
            { id: 'booking', kind: 'service', label: 'Booking service', sub: 'rules for seats' },
            { id: 'seats', kind: 'db', label: 'Seat store', sub: 'owns availability', state: 'focus', tag: { text: 'source of truth', tone: 'ok' } },
            { id: 'pay', kind: 'ext', label: 'Payment provider', sub: 'charges cards' },
          ]}
          edges={[
            { id: 'a', from: 'apps', to: 'booking', label: 'HTTPS' },
            { id: 'b', from: 'booking', to: 'seats', label: 'SQL' },
            { id: 'c', from: 'booking', to: 'pay', label: 'API call', dashed: true },
          ]}
          wide={HLD_WIDE}
          narrow={HLD_NARROW}
          description="Apps talk to a booking service over HTTPS. The booking service is the only part that reads or writes the seat store, and it calls a payment provider."
        />
      </section>
      <div className="caption">
        <ul>
          <li><strong>Apps</strong> show seats and send requests. They never change a seat directly.</li>
          <li><strong>Booking service</strong> holds the rules: who may hold a seat, for how long, and when it becomes booked.</li>
          <li><strong>Seat store</strong> owns availability. Only the booking service writes to it, so there is one place to enforce “one seat, one buyer”.</li>
          <li><strong>Payment provider</strong> is another company’s system. It can be slow or fail, so the design must not leave a seat stuck while it waits.</li>
        </ul>
        <p className="muted">The race you saw is an HLD question too: the fix belongs to whichever part owns availability.</p>
      </div>
    </>
  );
}

function LldView() {
  return (
    <>
      <section className="stage" aria-label="Seat state diagram" style={{ marginTop: 16 }}>
        <Diagram
          nodes={[
            { id: 'available', kind: 'box', label: 'Available' },
            { id: 'held', kind: 'box', label: 'Held', sub: 'for 10 min', state: 'active' },
            { id: 'booked', kind: 'box', label: 'Booked', state: 'ok' },
          ]}
          edges={[
            { id: 'h', from: 'available', to: 'held', label: 'hold' },
            { id: 'p', from: 'held', to: 'booked', label: 'paid' },
          ]}
          wide={{ width: 820, height: 220, nodes: { available: { x: 120, y: 110 }, held: { x: 410, y: 110 }, booked: { x: 700, y: 110 } } }}
          narrow={{ width: 360, height: 420, nodes: { available: { x: 180, y: 60 }, held: { x: 180, y: 210 }, booked: { x: 180, y: 360 } } }}
          description="A seat moves from Available to Held when a buyer starts checkout, and from Held to Booked when payment succeeds. A hold that expires returns the seat to Available."
        />
        <p className="muted" style={{ fontSize: 14, margin: '8px 0 0', textAlign: 'center' }}>Held → Available when the hold expires or the buyer cancels.</p>
      </section>
      <div className="caption">
        <p>
          A <strong>hold</strong> reserves the seat for one buyer while they pay, so nobody else can take it mid-checkout — and it expires, so an
          abandoned checkout doesn’t lock the seat forever.
        </p>
        <div className="callout">
          <strong>The rule</strong>
          A seat may move from Available to Held only if it is <em>still</em> Available at the moment of the change — checked and changed as one
          indivisible step.
        </div>
        <p>
          The race broke exactly this rule: the check (read) and the change (write) were separate, and another buyer slipped in between. You’ll make
          them one step in <Link to="/learn/concurrent-reservations">Concurrent reservations</Link>.
        </p>
      </div>
    </>
  );
}
