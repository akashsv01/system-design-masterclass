import type { CaseStudy } from '../caseTypes';
import { HLD_CASES_1 } from './hld1';
import { HLD_CASES_2 } from './hld2';
import { HLD_CASES_3 } from './hld3';
import { LLD_CASES } from './lld';

const all: CaseStudy[] = [...HLD_CASES_1, ...HLD_CASES_2, ...HLD_CASES_3, ...LLD_CASES];

export const CASES: Record<string, CaseStudy> = Object.fromEntries(all.map((c) => [c.id, c]));
