/**
 * Home hero (Workbench brief §4; project-wide instructions §1): one small, real interaction. Every part is
 * labelled; the visitor predicts, runs the race beat by beat (pause, step, replay), and the prediction is saved
 * as lesson 1's prediction so the lesson can pick up the thread.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Diagram, type DNode, type DToken, type Layout } from '../components/Diagram';
import { runTimeline } from '../../sim/interview/sims';
import { useRecord } from '../../progress/ProgressProvider';
import { usePlayer } from '../interview/player';
import { Icon } from '../components/Icon';

const WIDE: Layout = { width: 560, height: 280, nodes: { maya: { x: 90, y: 60, w: 150 }, leo: { x: 90, y: 220, w: 150 }, server: { x: 300, y: 140, w: 140 }, db: { x: 480, y: 140, w: 140 } } };
const NARROW: Layout = { width: 340, height: 400, nodes: { maya: { x: 85, y: 50, w: 140 }, leo: { x: 255, y: 50, w: 140 }, server: { x: 170, y: 200, w: 150 }, db: { x: 170, y: 340, w: 160 } } };
const CHOICES = [
  { id: 'maya', text: 'Maya gets it; Leo sees “Sold out”' },
  { id: 'both', text: 'Both are told “Confirmed”' },
  { id: 'leo', text: 'Leo gets it' },
] as const;

export function HeroRace() {
  const [pred, setPred] = useRecord<{ attempts: { picked: string; at: number }[] } | null>('quiz:first-booking:predict', null);
  const picked = pred?.attempts?.[0]?.picked;
  const [armed, setArmed] = useState(false);
  const r = useMemo(() => runTimeline([{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }], 'plain', 1, ['Maya', 'Leo']), []);
  const pl = usePlayer(4, 'hero', 900);
  const n = armed ? (pl.done ? 4 : pl.beat + (pl.t >= 1 ? 1 : 0)) : 0;
  const BEATS = ['Maya’s request checks seat F12: available', 'Leo’s request checks seat F12: still available', 'Maya’s request writes “held by Maya”', 'Leo’s request writes “held by Leo” — over Maya'];
  const nodes: DNode[] = [
    { id: 'maya', kind: 'client', label: 'Maya’s phone', value: n >= 3 ? 'Confirmed ✓' : 'F12 · 1 left', state: n >= 3 ? 'ok' : 'idle' },
    { id: 'leo', kind: 'client', label: 'Leo’s phone', value: n >= 4 ? 'Confirmed ✓' : 'F12 · 1 left', state: n >= 4 ? 'ok' : 'idle' },
    { id: 'server', kind: 'server', label: 'Ticket server', sub: 'checks, then writes', state: armed && !pl.done && pl.started ? 'active' : 'idle' },
    { id: 'db', kind: 'db', label: 'Seat record F12', value: n >= 4 ? 'held · Leo' : n >= 3 ? 'held · Maya' : 'available', state: n >= 4 ? 'fail' : n >= 1 ? 'focus' : 'idle', tag: n >= 4 ? { text: 'was: held · Maya', tone: 'changed' } : undefined },
  ];
  const tokens: DToken[] = armed && pl.started && !pl.done && pl.beat >= 0 ? [{ id: `b${pl.beat}`, from: pl.beat % 2 === 0 ? 'maya' : 'leo', to: pl.beat < 2 ? 'server' : 'db', label: pl.beat < 2 ? 'Reserve' : 'write', tone: 'request', at: pl.t }] : [];
  const edges = [{ id: 'a', from: 'maya', to: 'server' }, { id: 'b', from: 'leo', to: 'server' }, { id: 'c', from: 'server', to: 'db' }];
  const result = r.oversold;
  return (
    <figure className="hero-race" aria-labelledby="race-cap">
      <Diagram nodes={nodes} edges={edges} tokens={tokens} wide={WIDE} narrow={NARROW} breakpoint={440}
        description={`Maya’s phone and Leo’s phone both show seat F12 with one left. Both send Reserve to the ticket server, which reads the seat record and then writes it. ${n ? BEATS.slice(0, n).join('. ') + '.' : 'Nothing has happened yet.'}`} />
      <div className="race-panel">
        {!armed ? (
          <fieldset className="race-predict">
            <legend id="race-cap">They tap Reserve 5 ms apart. Predict, then run it.</legend>
            <div className="choice-row">
              {CHOICES.map((c) => <button key={c.id} className="choice" aria-pressed={picked === c.id} onClick={() => setPred({ attempts: [{ picked: c.id, at: Date.now() }] })}>{c.text}</button>)}
            </div>
            <button className="btn btn-primary" disabled={!picked} onClick={() => { setArmed(true); pl.replay(); }}><Icon name="play" size={15} /> Run the race</button>
            {!picked && <span className="muted small"> Pick a prediction first.</span>}
          </fieldset>
        ) : (
          <div aria-live="polite">
            <ol className="race-beats">{BEATS.map((b, i) => <li key={i} className={i < n ? 'done' : i === n && pl.playing ? 'now' : ''}>{i < n ? b : <span className="muted">{b.split(':')[0].split('writes')[0]}…</span>}</li>)}</ol>
            <div className="player">
              <button className="btn btn-small" onClick={pl.playing ? pl.pause : pl.play}>{pl.playing ? 'Pause' : pl.done ? 'Replay' : 'Continue'}</button>
              <button className="btn btn-small btn-quiet" onClick={pl.back} disabled={!pl.started}>Step back</button>
              <button className="btn btn-small btn-quiet" onClick={pl.step} disabled={pl.done}>Step</button>
            </div>
            {pl.done && (
              <p className="race-result">
                <strong>{result ? 'Both phones say “Confirmed”. One seat, two tickets.' : 'One buyer wins.'}</strong>{' '}
                {picked === 'both' ? 'You predicted it.' : 'Most people predict one winner; the server checked before either write landed.'}{' '}
                <Link to="/learn/first-booking">See why, and fix it, in lesson 1 <Icon name="arrow-right" size={14} /></Link>
              </p>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}
