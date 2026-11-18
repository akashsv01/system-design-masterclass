/**
 * Seat reservation simulation (deterministic).
 *
 * Model assumptions (shown to learners):
 * - One seat, F12. One server process handles each request; requests may interleave.
 * - "check-then-write": the server reads the seat, and if it is available, writes the buyer's name.
 * - "conditional-write": the server writes only if the seat is still available, in one atomic
 *   database statement, and reports whether a row changed.
 * - Times are milliseconds after 20:00:00.000. Network hops take `hopMs`.
 */

export type SeatState = { status: 'available' } | { status: 'held'; by: string; until: number } | { status: 'booked'; by: string };

export type Strategy = 'check-then-write' | 'conditional-write';

export interface BookingEvent {
  t: number;
  actor: string;
  kind: 'send' | 'read' | 'write' | 'write-skipped' | 'reply';
  from: string;
  to: string;
  label: string;
  /** Seat value in the database after this event. */
  seat: SeatState;
  /** Optional result of a reply. */
  outcome?: 'confirmed' | 'sold-out';
}

export interface BuyerPlan {
  name: string;
  /** When the buyer presses Reserve (ms). */
  pressAt: number;
}

export function seatText(s: SeatState): string {
  if (s.status === 'available') return 'available';
  if (s.status === 'held') return `held · ${s.by}`;
  return `booked · ${s.by}`;
}

/**
 * Run a reservation race. Each buyer: send (hop) → server reads (db hop) → server writes (db hop) → reply (hop).
 * Events are ordered by time; ties break by buyer order, which keeps the run deterministic.
 */
export function runReservation(buyers: BuyerPlan[], strategy: Strategy, hopMs = 40, dbMs = 10): BookingEvent[] {
  type Pending = { t: number; order: number; seq: number; fn: () => void };
  const queue: Pending[] = [];
  let seq = 0;
  const events: BookingEvent[] = [];
  let seat: SeatState = { status: 'available' };
  const at = (t: number, order: number, fn: () => void) => queue.push({ t, order, seq: seq++, fn });

  buyers.forEach((b, order) => {
    const phone = `phone-${b.name.toLowerCase()}`;
    at(b.pressAt, order, () => {
      events.push({ t: b.pressAt, actor: b.name, kind: 'send', from: phone, to: 'server', label: `Reserve F12 for ${b.name}`, seat });
      const tRead = b.pressAt + hopMs;
      if (strategy === 'check-then-write') {
        at(tRead, order, () => {
          const sawAvailable = seat.status === 'available';
          events.push({ t: tRead, actor: b.name, kind: 'read', from: 'server', to: 'db', label: `read F12 → ${seatText(seat)}`, seat });
          const tWrite = tRead + dbMs;
          at(tWrite, order, () => {
            if (sawAvailable) {
              seat = { status: 'booked', by: b.name };
              events.push({ t: tWrite, actor: b.name, kind: 'write', from: 'server', to: 'db', label: `write F12 = ${b.name}`, seat });
            }
            const tReply = tWrite + dbMs;
            at(tReply, order, () => {
              events.push({
                t: tReply, actor: b.name, kind: 'reply', from: 'server', to: phone,
                label: sawAvailable ? 'Confirmed ✓' : 'Sold out', seat, outcome: sawAvailable ? 'confirmed' : 'sold-out',
              });
            });
          });
        });
      } else {
        at(tRead, order, () => {
          const ok = seat.status === 'available';
          if (ok) seat = { status: 'booked', by: b.name };
          events.push({
            t: tRead, actor: b.name, kind: ok ? 'write' : 'write-skipped', from: 'server', to: 'db',
            label: ok ? `set F12 = ${b.name} if available → 1 row` : `set F12 = ${b.name} if available → 0 rows`, seat,
          });
          const tReply = tRead + dbMs * 2;
          at(tReply, order, () => {
            events.push({
              t: tReply, actor: b.name, kind: 'reply', from: 'server', to: phone,
              label: ok ? 'Confirmed ✓' : 'Sold out', seat, outcome: ok ? 'confirmed' : 'sold-out',
            });
          });
        });
      }
    });
  });

  while (queue.length) {
    queue.sort((a, b) => a.t - b.t || a.order - b.order || a.seq - b.seq);
    queue.shift()!.fn();
  }
  return events;
}

export function confirmations(events: BookingEvent[]): string[] {
  return events.filter((e) => e.outcome === 'confirmed').map((e) => e.actor);
}

/* ---------- Seat state machine (LLD) ---------- */

export type SeatAction =
  | { type: 'hold'; buyer: string; now: number; holdMs: number }
  | { type: 'pay'; buyer: string; now: number }
  | { type: 'release'; buyer: string }
  | { type: 'expire'; now: number };

export type Transition = { ok: true; next: SeatState } | { ok: false; reason: string; next: SeatState };

/** The single rule that prevents two confirmed bookings lives here. */
export function transition(s: SeatState, a: SeatAction): Transition {
  switch (a.type) {
    case 'hold':
      if (s.status === 'held' && s.until <= a.now) s = { status: 'available' };
      if (s.status !== 'available') return { ok: false, reason: `Seat is ${seatText(s)}`, next: s };
      return { ok: true, next: { status: 'held', by: a.buyer, until: a.now + a.holdMs } };
    case 'pay':
      if (s.status !== 'held' || s.by !== a.buyer) return { ok: false, reason: 'No active hold for this buyer', next: s };
      if (s.until <= a.now) return { ok: false, reason: 'Hold expired before payment arrived', next: { status: 'available' } };
      return { ok: true, next: { status: 'booked', by: a.buyer } };
    case 'release':
      if (s.status !== 'held' || s.by !== a.buyer) return { ok: false, reason: 'Nothing to release', next: s };
      return { ok: true, next: { status: 'available' } };
    case 'expire':
      if (s.status === 'held' && s.until <= a.now) return { ok: true, next: { status: 'available' } };
      return { ok: false, reason: 'Hold still active', next: s };
  }
}
