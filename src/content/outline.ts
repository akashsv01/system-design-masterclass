/**
 * Course outline helpers (Workbench brief §5; project-wide instructions §2): Category → Module → Lesson,
 * from the manifest's CATEGORIES. Pure functions used by the navigator, breadcrumbs, the lesson pager and search.
 */
import { CATEGORIES } from './manifest';
import { CURRICULUM, topicById } from './curriculum';
import type { TopicWithStatus } from './types';
import { DECISIONS } from './decisions';
import type { Category, Unit } from './types';

export interface OutlinePath { category: Category; unit: Unit; topic: TopicWithStatus }

const PATHS = new Map<string, OutlinePath>();
for (const c of CATEGORIES) for (const u of c.units) for (const id of u.topics) { const t = topicById(id); if (t) PATHS.set(id, { category: c, unit: u, topic: t }); }

export const pathOf = (id: string) => PATHS.get(id);
export const unitKey = (c: string, u: string) => `${c}/${u}`;

/** Previous and next topic in outline order (the recommended route). */
export function neighbours(id: string): { prev?: TopicWithStatus; next?: TopicWithStatus } {
  const i = CURRICULUM.findIndex((t) => t.id === id);
  return i < 0 ? {} : { prev: CURRICULUM[i - 1], next: CURRICULUM[i + 1] };
}

const BY_ROUTE = new Map(CURRICULUM.map((t) => [t.route, t]));
/** The topic a pathname shows, if any (e.g. /learn/cache-invalidation). */
export const topicForPath = (pathname: string) => BY_ROUTE.get(pathname.replace(/\/+$/, ''));

export interface SearchHit { topic: TopicWithStatus; path: OutlinePath; score: number; where: 'title' | 'decision' | 'scope' }

/** Finds topics anywhere in the outline (collapsed branches included), best matches first. */
export function searchOutline(q: string, limit = 12): SearchHit[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const words = s.split(/\s+/);
  const hits: SearchHit[] = [];
  for (const [, p] of PATHS) {
    const t = p.topic;
    const title = `${t.title} ${t.short ?? ''}`.toLowerCase();
    const scope = `${t.objective} ${t.covers.join(' ')} ${p.unit.title} ${p.category.title}`.toLowerCase();
    const decision = (DECISIONS[t.id] ?? '').toLowerCase();
    if (!words.every((w) => title.includes(w) || scope.includes(w) || decision.includes(w))) continue;
    const score = (title.startsWith(s) ? 100 : 0) + words.filter((w) => title.includes(w)).length * 20 + words.filter((w) => decision.includes(w)).length * 4 + words.filter((w) => scope.includes(w)).length;
    hits.push({ topic: t, path: p, score, where: words.every((w) => title.includes(w)) ? 'title' : words.some((w) => decision.includes(w)) ? 'decision' : 'scope' });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Old `/topics#…` anchors from before the outline existed, mapped to a category. */
export const LEGACY_HASH: Record<string, string> = { labs: 'data', 'cases-hld': 'cases', 'cases-lld': 'cases', capstone: 'cases' };
