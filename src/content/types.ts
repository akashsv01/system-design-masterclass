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
  module: string;
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

export interface Module {
  id: string;
  title: string;
  blurb: string;
}
