import { useEffect, useState } from 'react';

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A learner-controlled sequence of `n` beats (hops, operations, clock events). One number drives everything:
 * `pos` runs from 0 (nothing happened) to n (all done); the integer part is the beat in progress and the
 * fraction is how far it has travelled. Play, pause, step forward, step back and replay are all moves of
 * `target`. Under reduced motion nothing travels: each beat lands at once, ~1 s apart when playing.
 */
export function usePlayer(n: number, resetKey: string, beatMs = 700) {
  const [pos, setPos] = useState(0);
  const [target, setTarget] = useState(0);
  const reduced = prefersReducedMotion();
  useEffect(() => { setPos(0); setTarget(0); }, [resetKey]);
  const moving = pos !== target;
  useEffect(() => {
    if (!moving) return;
    if (reduced) {
      const id = setTimeout(() => setPos((p) => Math.min(target, Math.floor(p) + 1)), Number.isInteger(pos) && pos > 0 ? 900 : 0);
      return () => clearTimeout(id);
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setPos((p) => (p < target ? Math.min(target, p + dt / beatMs) : Math.max(target, p - dt / beatMs)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [moving, target, reduced, beatMs, pos]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = n > 0 && pos >= n;
  const whole = Number.isInteger(pos);
  // The beat to draw and how far along it is (a finished beat stays drawn at its end).
  const beat = n === 0 ? -1 : pos >= n ? n - 1 : whole ? pos - 1 : Math.floor(pos);
  const t = pos >= n ? 1 : whole ? (pos > 0 ? 1 : 0) : pos - Math.floor(pos);
  return {
    pos, beat, t, done, started: pos > 0, playing: moving,
    play: () => { if (done) { setPos(0); setTarget(n); } else setTarget(n); },
    pause: () => setTarget(reduced ? Math.floor(pos) : pos),
    step: () => setTarget(Math.min(n, Math.floor(pos) + 1)),
    back: () => { const b = Math.max(0, Math.ceil(pos) - 1); setPos(b); setTarget(b); },
    replay: () => { setPos(0); setTarget(n); },
    reset: () => { setPos(0); setTarget(0); },
    finish: () => { setPos(n); setTarget(n); },
  };
}
