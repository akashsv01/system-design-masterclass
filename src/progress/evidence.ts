/**
 * Evidence of skill, kept apart from self-assessment (brief §10).
 *
 *  - An objective activity (a graded choice, a line pick, a fill-in, an estimate, an ordering, a lab's fresh
 *    problem) records an Outcome. Its FIRST outcome in a round is locked: answering again after seeing the
 *    right answer can make it "hinted" (solved with help), never "independent".
 *  - A topic is "solved independently" only when every required activity in one round was right first time
 *    with no hint, reveal or retry. "Solved with hints" when all were eventually solved but some needed help.
 *  - Self-assessment (rubric ratings, short-answer self-checks, confidence) is stored under `self:` and never
 *    changes a topic's status.
 *  - Spaced revision starts a new round: the learner answers fresh copies of the checks, and the review interval
 *    grows only when that round is solved independently.
 */
import type { ProgressStore } from './store';
import { raiseStatus } from './activity';

export type Outcome = 'independent' | 'hinted' | 'missed';
export interface Act { round: number; first: Outcome; best: Outcome; at: number }
export interface Evidence { round: number; acts: Record<string, Act>; completed?: number[] }
export interface SelfAssessment { ratings?: Record<string, number>; checklist?: Record<string, boolean[]>; confidence?: Record<string, string>; at: number }

const RANK: Record<Outcome, number> = { missed: 0, hinted: 1, independent: 2 };
const REVIEW_DAYS = [1, 3, 7, 16, 35];

export function getEvidence(store: ProgressStore, topicId: string): Evidence {
  return store.get<Evidence>(`evidence:${topicId}`) ?? { round: 0, acts: {} };
}

/** Suffix for quiz record keys so a revision round gets fresh, unanswered copies of the same checks. */
export function roundKey(store: ProgressStore, topicId: string, base: string): string {
  const r = getEvidence(store, topicId).round;
  return r > 0 ? `${base}:r${r}` : base;
}

export function recordOutcome(
  store: ProgressStore,
  topicId: string,
  activityId: string,
  outcome: Outcome,
  opts: { required?: string[]; gap?: string } = {},
) {
  const ev = getEvidence(store, topicId);
  const prev = ev.acts[activityId]?.round === ev.round ? ev.acts[activityId] : undefined;
  const first: Outcome = prev ? prev.first : outcome;
  // A success that follows a miss in the same round is a success with help.
  const effective: Outcome = prev && prev.first !== 'independent' && outcome === 'independent' ? 'hinted' : outcome;
  const best: Outcome = prev && RANK[prev.best] >= RANK[effective] ? prev.best : effective;
  const acts = { ...ev.acts, [activityId]: { round: ev.round, first, best, at: Date.now() } };
  const next: Evidence = { ...ev, acts };

  const mistakeKey = `mistake:${topicId}:${activityId}`;
  if (outcome !== 'independent') {
    store.set(mistakeKey, { lessonId: topicId, activityId, text: opts.gap ?? '', at: Date.now(), resolved: false });
  } else if (store.get(mistakeKey) && first === 'independent') {
    store.set(mistakeKey, { ...(store.get(mistakeKey) as object), resolved: true });
  }

  const required = opts.required?.length ? opts.required : [activityId];
  const inRound = required.map((id) => acts[id]).filter((a) => a && a.round === ev.round);
  const allSolved = inRound.length === required.length && inRound.every((a) => a.best !== 'missed');
  if (allSolved && !(ev.completed ?? []).includes(ev.round)) {
    const clean = inRound.every((a) => a.first === 'independent');
    raiseStatus(store, topicId, clean ? 'independent' : 'hinted');
    const prevReview = store.get<{ reps: number }>(`review:${topicId}`);
    const reps = clean ? (prevReview?.reps ?? 0) + 1 : 0;
    const days = REVIEW_DAYS[Math.min(reps, REVIEW_DAYS.length - 1)];
    store.set(`review:${topicId}`, { lessonId: topicId, reps, due: Date.now() + days * 86_400_000, last: Date.now() });
    next.completed = [...(ev.completed ?? []), ev.round];
  }
  store.set(`evidence:${topicId}`, next);
}

/** Start a revision round: checks reappear unanswered; earlier rounds stay in the record. */
export function startRevision(store: ProgressStore, topicId: string) {
  const ev = getEvidence(store, topicId);
  store.set(`evidence:${topicId}`, { ...ev, round: ev.round + 1 });
}

export function recordSelf(store: ProgressStore, topicId: string, patch: Partial<Omit<SelfAssessment, 'at'>>) {
  const cur = store.get<SelfAssessment>(`self:${topicId}`) ?? { at: 0 };
  store.set(`self:${topicId}`, {
    ...cur,
    ratings: { ...(cur.ratings ?? {}), ...(patch.ratings ?? {}) },
    checklist: { ...(cur.checklist ?? {}), ...(patch.checklist ?? {}) },
    confidence: { ...(cur.confidence ?? {}), ...(patch.confidence ?? {}) },
    at: Date.now(),
  });
}
