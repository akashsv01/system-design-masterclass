/**
 * One specific next activity, with the reason it is useful (brief §4, §10). Used by Home and Practice.
 *
 * Order of preference depends on the page:
 *  - Home: the exact unfinished activity first (continue), then the lesson's own "next", then the route.
 *  - Practice: revision that is due, then a fresh exercise for a recorded gap, then unfinished work, then the route.
 * There is always an answer: a learner with nothing due still gets a sensible next activity.
 */
import { CURRICULUM, topicById } from '../content/curriculum';
import { GENERIC_LESSONS } from '../content/lessons';
import type { LessonStatus } from '../../shared/progress';
import type { TopicWithStatus } from '../content/types';

export interface LastActivity { id: string; at: number; step?: number; count?: number; stepTitle?: string }
export interface Mistake { lessonId: string; text?: string; resolved?: boolean; self?: boolean; at?: number }
export interface Review { lessonId: string; due: number; reps?: number }

export interface Recommendation {
  kind: 'continue' | 'revision' | 'gap' | 'next' | 'route';
  topic: TopicWithStatus;
  title: string;
  reason: string;
  /** For gaps: the topic the learner struggled with. */
  from?: TopicWithStatus;
}

const solved = (s?: LessonStatus) => s === 'hinted' || s === 'independent';

/** Topics that build on, or share scope with, a topic the learner struggled with (labs first). */
export function freshFor(id: string, done: Set<string>): TopicWithStatus[] {
  const t = topicById(id);
  if (!t) return [];
  const terms = new Set(t.covers.map((c) => c.toLowerCase()));
  return CURRICULUM.filter((c) => c.id !== id && c.status !== 'planned' && !done.has(c.id) && (c.prereqs.includes(id) || c.covers.some((x) => terms.has(x.toLowerCase()))))
    .sort((a, b) => Number(b.kind === 'lab') - Number(a.kind === 'lab'))
    .slice(0, 2);
}

export function nextOnRoute(statuses: Record<string, LessonStatus>): TopicWithStatus | undefined {
  return CURRICULUM.find((t) => !statuses[t.id] && t.status !== 'planned');
}

export function recommend(
  page: 'home' | 'practice',
  input: { statuses: Record<string, LessonStatus>; last?: LastActivity | null; reviews: Review[]; mistakes: Mistake[]; now?: number },
): Recommendation | null {
  const { statuses, last, reviews, mistakes } = input;
  const now = input.now ?? Date.now();
  const lastTopic = last ? topicById(last.id) : undefined;
  const unfinished = lastTopic && statuses[lastTopic.id] === 'started' ? lastTopic : undefined;

  const cont = (): Recommendation | null =>
    unfinished
      ? {
          kind: 'continue',
          topic: unfinished,
          title: unfinished.title,
          reason: last?.stepTitle
            ? `You stopped at step ${(last.step ?? 0) + 1}${last.count ? ` of ${last.count}` : ''}: “${last.stepTitle}”.`
            : 'You started this and haven’t finished it.',
        }
      : null;

  const due = reviews.filter((r) => typeof r.due === 'number' && r.due <= now).sort((a, b) => a.due - b.due)[0];
  const revision = (): Recommendation | null => {
    const t = due ? topicById(due.lessonId) : undefined;
    return t ? { kind: 'revision', topic: t, title: t.title, reason: `Due for revision. Answer its checks from memory; if you get them right first time, the next revision moves further out.` } : null;
  };

  const open = mistakes.filter((m) => !m.resolved).sort((a, b) => Number(!!a.self) - Number(!!b.self) || (b.at ?? 0) - (a.at ?? 0));
  const gap = (): Recommendation | null => {
    const m = open[0];
    const from = m ? topicById(m.lessonId) : undefined;
    if (!from) return null;
    const done = new Set(Object.entries(statuses).filter(([, s]) => s === 'independent').map(([k]) => k));
    const f = freshFor(from.id, done)[0];
    return f
      ? { kind: 'gap', topic: f, from, title: f.title, reason: `You missed a check in “${from.short ?? from.title}”. This ${f.kind === 'lab' ? 'lab' : 'topic'} uses the same idea in a new setting, so you can test whether it has stuck.` }
      : { kind: 'gap', topic: from, from, title: from.title, reason: 'You missed a check here. Reread the step it tests, then answer again.' };
  };

  const lessonNext = (): Recommendation | null => {
    if (!lastTopic || (!solved(statuses[lastTopic.id]) && statuses[lastTopic.id] !== 'studied')) return null;
    const n = GENERIC_LESSONS[lastTopic.id]?.next;
    const t = n ? topicById(n.id) : lastTopic.id === 'first-booking' ? topicById('hld-vs-lld') : undefined;
    if (!t || statuses[t.id]) return null;
    return { kind: 'next', topic: t, title: t.title, reason: n?.reason.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') ?? 'It builds directly on what you just finished.' };
  };

  const route = (): Recommendation | null => {
    const t = nextOnRoute(statuses);
    if (!t) return null;
    const before = t.prereqs.map((p) => topicById(p)).filter(Boolean);
    const ready = before.every((p) => statuses[p!.id]);
    return {
      kind: 'route',
      topic: t,
      title: t.title,
      reason: t.id === 'first-booking'
        ? 'The first lesson: one seat, two buyers, and the five ideas every later topic uses.'
        : ready && before.length
          ? `Next on the route. It builds on ${before.map((p) => p!.short ?? p!.title).join(' and ')}, which you’ve opened.`
          : 'Next on the recommended route.',
    };
  };

  const order = page === 'home' ? [cont, lessonNext, revision, route] : [revision, gap, cont, lessonNext, route];
  for (const f of order) {
    const r = f();
    if (r) return r;
  }
  return null;
}
