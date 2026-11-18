/**
 * Capstone: an unfamiliar problem with a surprise requirement. None of the case studies covers
 * it directly, but every part maps to something taught in the course.
 */
import type { Block } from './lessonTypes';

export const CAPSTONE = {
  prompt: 'Design the wristband system for a 3-day music festival: 80,000 people use RFID wristbands to enter gates and to pay at 400 bars and food stalls.',
  context: [
    'Mobile coverage on the festival site is unreliable, especially when crowds peak.',
    'People top up wristbands online before and during the festival; unused balance is refunded afterwards.',
    'Gates must let people in fast: the evening rush is 15,000 entries in 30 minutes.',
  ],
  surprise: 'Day 2, 20:00: the uplink to gates 3 and 4 and to the whole east food court fails for 90 minutes. Entry and payments there must continue, and nobody may spend money they don’t have, or enter twice on a single-entry ticket.',
  phases: [
    { title: 'Requirements and estimates', task: 'List the questions you’d ask and estimate the peak entry and payment rates.' },
    { title: 'First design', task: 'Draw the main parts: wristband, gates, payment terminals, top-up, ledger. Which part owns balances?' },
    { title: 'The surprise', task: 'Read the new situation, then change your design so the east side keeps working offline.' },
    { title: 'Review', task: 'Rate your design and compare it with your first design in the course.' },
  ],
  reference: [
    { type: 'h', text: 'Requirements and estimates' },
    { type: 'list', items: ['Entry peak: 15,000 / 1,800 s ≈ 8.3 entries/s across all gates; one gate lane ≈ 1 entry every 3–4 s.', 'Payments: 80,000 people × ~10 purchases/day ≈ 800k/day; evening peak maybe 10× average ≈ 90 payments/s.', 'Correctness: no negative balances beyond a small agreed limit; no double entry on single-entry tickets; every payment recorded exactly once.'] },
    { type: 'h', text: 'First design' },
    { type: 'list', items: ['Central **ledger** (double-entry) owns balances; top-ups and refunds go through the payment provider with idempotency keys.', 'Terminals and gates talk to the ledger online, each transaction carrying a unique id (terminal id + counter) so retries are idempotent.', 'Ticket service owns entry state (entered / not entered) per wristband, with conditional updates.'] },
    { type: 'h', text: 'After the surprise: designing for disconnection' },
    { type: 'list', items: ['Accept that offline terminals can’t ask the ledger. Choose availability with bounded risk: each wristband carries a **signed offline allowance** (e.g. up to €50 or its last known balance), and terminals record transactions locally.', 'Each offline transaction has a unique id and a per-terminal sequence number, stored durably on the terminal and **synced when the link returns**. The ledger applies them idempotently, in order.', 'Prevent double-spend across offline terminals by **writing the remaining offline allowance onto the wristband chip** at each purchase (the card is the state), and capping risk per wristband.', 'Gates: write “entered at gate 3, 20:14” onto the wristband chip and keep a local list of entered ids; on reconnect, sync to the ticket service. Conflicts (rare) are flagged for staff review.', 'Reconciliation after sync: any wristband overspent beyond its allowance is flagged; the agreed limit keeps worst-case loss small and known.'] },
    { type: 'callout', title: 'The trade-off you’re making', text: 'During a partition you can’t have both “every terminal can sell” and “no one ever overspends by a cent”. This design picks availability, bounds the inconsistency with an allowance, and repairs it with idempotent sync and reconciliation. That’s CAP during partitions, idempotency, ordering, and sagas, applied to a new domain.' },
  ] as Block[],
  rubric: [
    { area: 'Requirements', strong: 'Asks about connectivity, peaks, refund rules, single vs multi-entry tickets before designing.' },
    { area: 'Estimates', strong: 'Derives entry and payment rates at peak and sizes gate lanes from them.' },
    { area: 'Ownership and data', strong: 'One ledger owns balances (double-entry); ticket service owns entry state; ids for every transaction.' },
    { area: 'Failure reasoning', strong: 'Explicitly chooses availability with bounded risk during the outage, and explains how it is repaired afterwards.' },
    { area: 'Correctness after reconnect', strong: 'Idempotent, ordered sync of offline transactions; reconciliation and conflict handling.' },
    { area: 'Communication', strong: 'States assumptions, names the trade-off, adapts the design to the surprise instead of defending the first version.' },
  ],
  /** Concepts the learner may demonstrate; terms are matched case-insensitively in their notes. */
  skills: [
    { concept: 'Idempotency', terms: ['idempoten', 'unique id', 'dedup', 'transaction id'], lesson: 'idempotency' },
    { concept: 'Behaviour during partitions (CAP)', terms: ['offline', 'partition', 'availability', 'cap '], lesson: 'cap-quorums' },
    { concept: 'Ordering and sequence numbers', terms: ['sequence', 'order', 'counter'], lesson: 'clocks-ordering' },
    { concept: 'Ledger / transactions', terms: ['ledger', 'double-entry', 'balance', 'transaction'], lesson: 'transactions' },
    { concept: 'Capacity estimation', terms: ['per second', '/s', 'peak', 'estimate'], lesson: 'capacity-estimation' },
    { concept: 'Conditional writes against races', terms: ['conditional', 'double entry', 'twice', 'race'], lesson: 'first-booking' },
    { concept: 'Reconciliation and compensation', terms: ['reconcil', 'compensat', 'refund', 'saga'], lesson: 'distributed-transactions' },
    { concept: 'Queues and sync', terms: ['queue', 'sync', 'replay', 'backlog'], lesson: 'queues' },
  ],
};
