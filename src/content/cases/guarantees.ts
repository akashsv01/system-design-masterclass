/**
 * Paired cases (brief §8): for each behaviour the learner must be able to promise, which HLD component owns it,
 * which LLD mechanism enforces it, and what change would move it. Keyed by the HLD case id; shown in both cases
 * of a pair. Every row restates a decision already worked through in the cases' own stages.
 */
export interface Guarantee { behavior: string; hld: string; lld: string; changes: string }

export const GUARANTEES: Record<string, { hld: string; lld: string; rows: Guarantee[] }> = {
  'case-ticket-booking': {
    hld: 'case-ticket-booking',
    lld: 'lld-booking',
    rows: [
      { behavior: 'One seat, one buyer', hld: 'Booking service, through a conditional `UPDATE … WHERE state = \'available\'` on the seat store', lld: '`SeatInventory.hold()` checks and changes the seat in one locked step; every seat is in exactly one of free, held, booked', changes: 'Running on many servers: a process lock no longer covers every request, so the check must move into the database write' },
      { behavior: 'An abandoned checkout frees the seat', hld: 'Seat store keeps `hold_expires_at`; an expired hold counts as available', lld: '`Hold.expires_at`; `hold()` and `confirm()` take the current time as an argument, so expiry is testable without waiting', changes: 'Longer payment flows: extend the hold, or authorise payment before the hold ends' },
      { behavior: 'Never keep money without a seat', hld: 'Booking confirms with a second conditional update after payment, and refunds idempotently if it fails', lld: '`confirm()` refuses an expired or foreign hold, so the caller knows to refund', changes: 'A payment provider that replies late by webhook: confirmation becomes asynchronous' },
      { behavior: 'A huge on-sale stays fair and stable', hld: 'A waiting room at the gateway admits buyers at the rate holds can absorb', lld: 'Not in the seat classes: it protects them from the spike', changes: 'Only needed for the biggest events; for small ones it is extra cost' },
    ],
  },
  'case-notifications': {
    hld: 'case-notifications',
    lld: 'lld-notifications',
    rows: [
      { behavior: 'A ticket confirmation always arrives', hld: 'Separate high-priority queue per channel, retries with backoff, and a dead-letter queue that is watched', lld: 'Calling `notify()` again with the same id resends only the channels that failed; each channel’s result is reported', changes: 'Marketing volume grows: keep it on its own queues so it can be delayed or dropped' },
      { behavior: 'A retry never sends twice on a channel', hld: 'Notify API deduplicates by notification id; the delivery log records (id, user, channel)', lld: 'The `sent` set keyed by (notification id, user, channel) is checked before every send', changes: 'Several worker processes: the `sent` record must live in shared storage, not in memory' },
      { behavior: 'Opt-outs and quiet hours are respected', hld: 'Preferences store, consulted before a message is enqueued and again before it is sent', lld: 'The change stage injects a `may_send(user, now)` policy, so the rule is testable without waiting until 22:00', changes: 'Quiet hours per time zone: the policy needs the user’s zone, and delayed messages need a scheduler' },
      { behavior: 'A slow SMS provider doesn’t delay email', hld: 'One queue and worker pool per channel', lld: 'Channels are independent callables behind one interface', changes: 'A single shared queue would let one slow channel block the rest' },
    ],
  },
  'case-live-scores': {
    hld: 'case-live-scores',
    lld: 'lld-live-scores',
    rows: [
      { behavior: 'A goal is never counted twice', hld: 'Ingest deduplicates provider events by id before they reach the match event log', lld: '`ScoreProcessor` keeps a `seen` set of event ids', changes: 'Two ingest instances for redundancy: dedupe must use a shared record or a single writer per match' },
      { behavior: 'Events apply in order', hld: 'The match event log is sequenced per match', lld: 'A `pending` buffer holds events until `last_seq + 1` arrives', changes: 'A sequence number that never arrives: add a timeout and ask the provider to resend' },
      { behavior: 'A disallowed goal fixes the score', hld: 'Corrections are events in the same log; the score is recomputed from it', lld: 'The score is recomputed from the recorded goals, never edited directly', changes: 'Corrections for many old matches: replaying whole logs gets expensive, so keep snapshots' },
      { behavior: 'Reconnecting fans catch up', hld: 'Clients resume from the last sequence number they saw, with jittered reconnects', lld: 'The processor exposes its state with `last_seq`, so a snapshot plus later events is enough', changes: 'Fan rooms with chat: two-way traffic, so rooms need WebSockets while scores can stay on SSE' },
    ],
  },
};

/** The guarantee table for a case, whichever side of the pair it is. */
export function guaranteesFor(caseId: string) {
  return Object.values(GUARANTEES).find((g) => g.hld === caseId || g.lld === caseId);
}
