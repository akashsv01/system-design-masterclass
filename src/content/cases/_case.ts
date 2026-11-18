import type { CaseStudy } from '../caseTypes';

/** Transparent rubrics used for self-assessment (MASTER_PROMPT §11). */
export const HLD_RUBRIC = (s: { requirements: string; estimates: string; api: string; data: string; path: string; failure: string }) => [
  { area: 'Requirements', strong: s.requirements },
  { area: 'Estimates', strong: s.estimates },
  { area: 'API', strong: s.api },
  { area: 'Data model', strong: s.data },
  { area: 'Critical path', strong: s.path },
  { area: 'Failure reasoning', strong: s.failure },
  { area: 'Communication', strong: 'States assumptions out loud, names trade-offs, and changes the design when a requirement changes instead of defending the old one.' },
];

export const LLD_RUBRIC = (s: { responsibilities: string; interfaces: string; invariants: string; tests: string; adaptability: string }) => [
  { area: 'Responsibilities', strong: s.responsibilities },
  { area: 'Interfaces', strong: s.interfaces },
  { area: 'Invariants and correctness', strong: s.invariants },
  { area: 'Tests', strong: s.tests },
  { area: 'Adaptability', strong: s.adaptability },
];

export type { CaseStudy };
