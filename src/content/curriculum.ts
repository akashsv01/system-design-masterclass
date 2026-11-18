/**
 * Joins the manifest with the content that exists and computes each topic's status.
 * Status is derived, never hand-set, so the coverage report cannot overstate progress.
 */
import { MODULES, TOPICS } from './manifest';
import type { Topic, TopicStatus, TopicWithStatus } from './types';
import { GENERIC_LESSONS } from './lessons';
import { CASES } from './cases';
import { LABS } from './labs';
import verification from './verification.json';
import reviews from './reviews.json';

/** Hand-built lessons and what they contain (kept honest by scripts/coverage-report.ts checks). */
export const CUSTOM_LESSONS: Record<string, { explanation: boolean; worked: boolean; exercise: boolean; assessment: boolean }> = {
  'first-booking': { explanation: true, worked: true, exercise: true, assessment: true },
  'replica-lag': { explanation: true, worked: true, exercise: true, assessment: true },
  'lru-cache': { explanation: true, worked: true, exercise: true, assessment: true },
};

export interface ContentPieces {
  explanation: boolean;
  worked: boolean;
  exercise: boolean;
  assessment: boolean;
  format: 'custom' | 'generic' | 'case' | 'lab' | 'none';
}

export function piecesFor(id: string): ContentPieces {
  const c = CUSTOM_LESSONS[id];
  if (c) return { ...c, format: 'custom' };
  const g = GENERIC_LESSONS[id];
  if (g)
    return {
      explanation: g.steps.length >= 3,
      worked: g.worked.blocks.length > 0,
      exercise: !!g.exercise?.checklist.length,
      assessment: g.checks.length > 0,
      format: 'generic',
    };
  const cs = CASES[id];
  if (cs)
    return {
      explanation: cs.stages.length >= 4,
      worked: cs.stages.some((s) => s.reference.length > 0),
      exercise: cs.stages.some((s) => s.task.length > 0),
      assessment: cs.rubric.length > 0 && cs.checks.length > 0,
      format: 'case',
    };
  const lb = LABS[id];
  if (lb) return { explanation: true, worked: true, exercise: true, assessment: true, format: 'lab' };
  return { explanation: false, worked: false, exercise: false, assessment: false, format: 'none' };
}

const verified = new Set<string>((verification as { verified: string[] }).verified);
const reviewed = new Set<string>((reviews as { reviewed: { id: string }[] }).reviewed.map((r) => r.id));

function statusOf(t: Topic): { status: TopicStatus; statusNote: string } {
  const p = piecesFor(t.id);
  if (p.format === 'none') return { status: 'planned', statusNote: 'No learner-facing material yet.' };
  const missing = (['explanation', 'worked', 'exercise', 'assessment'] as const).filter((k) => !p[k]);
  if (missing.length) return { status: 'partial', statusNote: `Missing: ${missing.join(', ')}.` };
  if (reviewed.has(t.id)) return { status: 'reviewed', statusNote: 'Independently reviewed by a human editor.' };
  if (verified.has(t.id)) return { status: 'verified', statusNote: 'Renders, all objective checks have valid keys, links resolve, simulations tested.' };
  return { status: 'implemented', statusNote: 'Explanation, worked example, exercise and assessment exist; not yet machine-verified.' };
}

export const CURRICULUM: TopicWithStatus[] = TOPICS.map((t) => ({ ...t, ...statusOf(t) }));
export { MODULES };

const byId = new Map(CURRICULUM.map((t) => [t.id, t]));
export function topicById(id: string): TopicWithStatus | undefined {
  return byId.get(id);
}

export function topicsInModule(moduleId: string): TopicWithStatus[] {
  return CURRICULUM.filter((t) => t.module === moduleId);
}

/** Recommended route: modules in order, topics in manifest order, with prerequisites satisfied. */
export function recommendedRoute(): TopicWithStatus[] {
  const done = new Set<string>();
  const out: TopicWithStatus[] = [];
  const pending = [...CURRICULUM];
  let guard = 0;
  while (pending.length && guard++ < 10_000) {
    const idx = pending.findIndex((t) => t.prereqs.every((p) => done.has(p) || !byId.has(p)));
    const t = pending.splice(idx === -1 ? 0 : idx, 1)[0];
    done.add(t.id);
    out.push(t);
  }
  return out;
}
