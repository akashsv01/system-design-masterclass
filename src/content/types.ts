/** Curriculum manifest types. See scripts/coverage-report.ts for the checks run on them. */

export interface Source {
  title: string;
  /** Chapter, section, or page — only when verified. */
  where?: string;
  url?: string;
  note?: string;
  /** True only after the cited section was read and the lesson's claims checked against it. */
  checked?: boolean;
}

/**
 * planned      – listed in scope, no learner-facing material yet
 * partial      – some material exists but explanation, worked example or exercise is missing
 * implemented  – explanation + worked example + exercise exist
 * verified     – implemented, and automated checks pass (sim tests, quiz keys, links, render)
 * reviewed     – a human editor has independently reviewed it (never set by automation)
 */
export type TopicStatus = 'planned' | 'partial' | 'implemented' | 'verified' | 'reviewed';

export type TopicKind = 'lesson' | 'bridge' | 'lab' | 'case-hld' | 'case-lld' | 'pattern' | 'capstone';

export interface Topic {
  id: string;
  title: string;
  /** Short label used in lists. */
  short?: string;
  /** Top-level category id (CATEGORIES in manifest.ts). */
  category: string;
  /** Module id within the category; the outline is Category → Module → Lesson. */
  unit: string;
  kind: TopicKind;
  prereqs: string[];
  objective: string;
  /** Scope terms from the master prompt this topic covers. */
  covers: string[];
  sources: Source[];
  route: string;
}

export interface TopicWithStatus extends Topic {
  status: TopicStatus;
  /** Why the status is what it is (missing pieces). */
  statusNote: string;
}

/** A module inside a category: a short, ordered group of lessons, labs and cases. */
export interface Unit {
  id: string;
  title: string;
  /** Topic ids in recommended order. */
  topics: string[];
}

/** A top-level category of the course outline. */
export interface Category {
  id: string;
  title: string;
  blurb: string;
  units: Unit[];
}

/** Category summary (id, title, blurb) for lists that don't need the modules. */
export type Module = Pick<Category, 'id' | 'title' | 'blurb'>;
