import type { CaseStudy } from '../caseTypes';

const all: CaseStudy[] = [];

export const CASES: Record<string, CaseStudy> = Object.fromEntries(all.map((c) => [c.id, c]));
