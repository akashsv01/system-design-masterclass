/**
 * The interviewer's judgement as data (brief §6): conditions over the learner's actual design, their
 * stated assumptions and answers, and activity outcomes. No external AI service is involved; every
 * follow-up, acknowledgement and debrief line comes from authored rules evaluated here.
 */
import { find, linksBetween, shortestPath, byId, type DesignGraph, type Sel } from './graph';

export type Cond =
  | { has: Sel }
  | { lacks: Sel }
  | { count: Sel; min?: number; max?: number }
  /** An arrow from a match of [0] to a match of [1], optionally with one of these labels. */
  | { link: [Sel, Sel]; labels?: string[] }
  | { path: [Sel, Sel] }
  | { unlabeled: true }
  /** An answer to a follow-up, an assumption, or an asked clarifying question ("asked:<id>"). */
  | { answer: string; is?: string | string[] }
  /** The recorded outcome of a stage's activity, e.g. { result: 'race', is: 'oversold' }. */
  | { result: string; is: string | string[] }
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond };

export interface Ctx {
  g: DesignGraph;
  answers: Record<string, string | undefined>;
  results: Record<string, string | undefined>;
}

const oneOf = (v: string | undefined, is?: string | string[]) => v !== undefined && (is === undefined || (Array.isArray(is) ? is.includes(v) : v === is));

export function holds(c: Cond, x: Ctx): boolean {
  if ('has' in c) return find(x.g, c.has).length > 0;
  if ('lacks' in c) return find(x.g, c.lacks).length === 0;
  if ('count' in c) { const n = find(x.g, c.count).length; return n >= (c.min ?? 0) && n <= (c.max ?? Infinity); }
  if ('link' in c) return linksBetween(x.g, c.link[0], c.link[1], c.labels).length > 0;
  if ('path' in c) return !!shortestPath(x.g, c.path[0], c.path[1]);
  if ('unlabeled' in c) return x.g.links.some((l) => !l.label);
  if ('answer' in c) return oneOf(x.answers[c.answer], c.is);
  if ('result' in c) return oneOf(x.results[c.result], c.is);
  if ('all' in c) return c.all.every((k) => holds(k, x));
  if ('any' in c) return c.any.some((k) => holds(k, x));
  return !holds(c.not, x);
}

export interface Choice { id: string; label: string; reply: string; verdict?: 'sound' | 'partial' | 'risky' }

/** One authored interviewer move. */
export interface Rule {
  id: string;
  /** Which stage this belongs to; omit for "any time the learner discusses their design". */
  stage?: string;
  when: Cond;
  /** Short acknowledgement when the condition holds, naming what the learner did. {name:Sel} placeholders are filled from the design. */
  ack?: string;
  /** A follow-up question, asked once. */
  ask?: { text: string; choices?: Choice[]; free?: { placeholder: string; listen: string } };
  /** Guided mode only: a gentle nudge shown while the condition holds. */
  coach?: string;
  /** Debrief: this is evidence of a strong decision. */
  strength?: string;
  /** Debrief: this is a gap, with one concrete improvement and where to go. */
  gap?: { text: string; fix: string; stage: string; lesson?: string };
  /** Higher first. Gaps and questions are ordered by priority. */
  priority?: number;
}

/** Fills {kind} / {type:x} placeholders with the learner's own component names. */
export function fill(text: string, g: DesignGraph): string {
  return text.replace(/\{(type|kind):([a-z0-9-]+)\}/g, (_, f: 'type' | 'kind', v: string) => {
    const c = find(g, f === 'type' ? { type: v } : (v as Sel));
    return c[0]?.label ?? v.replace(/-/g, ' ');
  });
}

/** The next follow-up to ask: unlabeled arrows first (we can't read intent from a bare arrow), then authored rules by priority. */
export function nextQuestion(rules: Rule[], x: Ctx, stage: string, asked: Set<string>): { kind: 'label'; linkId: string } | { kind: 'rule'; rule: Rule } | null {
  const bare = x.g.links.find((l) => !l.label && byId(x.g, l.from) && byId(x.g, l.to));
  if (bare) return { kind: 'label', linkId: bare.id };
  const open = rules
    .filter((r) => r.ask && !asked.has(r.id) && (!r.stage || r.stage === stage) && holds(r.when, x))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return open[0] ? { kind: 'rule', rule: open[0] } : null;
}

/** Acknowledgements the interviewer can make now (not yet made). */
export const acks = (rules: Rule[], x: Ctx, stage: string, made: Set<string>) =>
  rules.filter((r) => r.ack && !made.has(r.id) && (!r.stage || r.stage === stage) && holds(r.when, x));

export const coachLines = (rules: Rule[], x: Ctx, stage: string) =>
  rules.filter((r) => r.coach && r.stage === stage && holds(r.when, x)).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

export function debrief(rules: Rule[], x: Ctx) {
  const strengths = rules.filter((r) => r.strength && holds(r.when, x));
  const gaps = rules.filter((r) => r.gap && holds(r.when, x)).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return { strengths, gaps };
}
