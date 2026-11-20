/**
 * Interview scripts (interview brief §2–9): everything the simulator needs for one case, authored so the
 * experience works without any external AI service. One script per published case; audited by
 * `npm run audit:content` (every case has a brief, a first move, a fitting main activity, follow-ups,
 * a full help ladder per stage and a complete worked solution).
 */
import type { Block } from '../lessonTypes';
import type { CompKind, DesignGraph, Sel } from '../../sim/interview/graph';
import type { Rule } from '../../sim/interview/rules';
import type { Guard, ModelQuery, Policy, RoleCard, ScenarioEvent, TLOp } from '../../sim/interview/sims';

export type Skill = 'architecture' | 'concurrency' | 'reliability' | 'data-modeling' | 'capacity' | 'caching' | 'messaging' | 'object-design' | 'state-machines' | 'consistency' | 'api-design';

export interface Brief {
  interviewer: { name: string; role: string };
  /** One or two sentences in the interviewer's voice, setting the scene. */
  intro: string;
  /** Who we're designing for. */
  users: string;
  /** What those users need to do. */
  needs: string[];
  /** What must work correctly, no matter what. */
  mustHold: string[];
  /** Numbers and limits that shape the design. */
  constraints: string[];
  outOfScope?: string[];
  /** Unfamiliar words, defined where they first appear. */
  terms?: { term: string; meaning: string }[];
  /** The concrete first move, in the interviewer's words. */
  firstMove: string;
}

/** A palette entry: a recognisable part with a short description shown on demand. */
export interface PaletteItem { type: string; kind: CompKind; name: string; blurb: string }

/** A clarifying question with the interviewer's answer (consistent with the brief). */
export interface ClarifyQ { id: string; q: string; a: string }
/** Where the brief leaves a real choice open: the learner states an assumption and it is carried through. */
export interface Assumption { id: string; q: string; options: { id: string; label: string; consequence: string }[] }

export interface Walk { text: string; /** Worked-solution component ids to highlight at this step. */ focus?: string[] }
export interface StageHelp {
  /** A focused question that points at the important decision. */
  hint: string;
  /** The relevant sequence, one step at a time. */
  walkthrough: Walk[];
  /** A worked answer to this stage's question. */
  solution: Block[];
  /** Why that answer satisfies the brief. */
  why: string;
}

export type Activity =
  | { kind: 'clarify'; questions: ClarifyQ[]; assumptions: Assumption[] }
  | {
      kind: 'build';
      /** "architecture" for HLD parts; "classes" for an LLD class diagram. */
      flavor: 'architecture' | 'classes';
      /** Offered in guided mode: a small starting point the learner edits. */
      starter?: DesignGraph;
      /** Requests the learner can trace through their own design (HLD). */
      traces?: { id: string; label: string; token: string; from: Sel; to: Sel; read?: boolean }[];
    }
  | {
      kind: 'trace';
      /** What travels, e.g. "an order from checkout to dispatch". */
      request: string;
      from: string[];
      to: string[];
      /** Parts the learner may take offline, by palette type (the learner's own copies of them). */
      failCandidates: string[];
      predict: { q: string; choices: { id: 'ok' | 'error' | 'delayed'; label: string }[] };
    }
  | {
      kind: 'timeline';
      names: [string, string];
      resource: string;
      initial: number;
      /** Plain words for each op, e.g. read: "checks the seat", write: "marks it held". */
      read: string;
      write: string;
      start: TLOp[];
      guards: { id: Guard; label: string; detail: string; code?: string }[];
      predict: { q: string; choices: { id: string; label: string }[] };
    }
  | {
      kind: 'states';
      entity: string;
      initial: string;
      states: { key: string; label: string; blurb: string }[];
      events: { id: string; label: string }[];
      timer?: { event: string; after: number };
      scenario: ScenarioEvent[];
      starter?: DesignGraph;
    }
  | {
      kind: 'model';
      tables: { id: string; name: string; fields: string[]; links?: { field: string; to: string }[] }[];
      table: string;
      first: ModelQuery;
      second: ModelQuery;
      partitions?: number;
      tradeoffs: { id: string; label: string; consequence: string; verdict: 'sound' | 'partial' | 'risky' }[];
    }
  | {
      kind: 'queue';
      what: string;
      arrival: [number, number, number];
      workers: [number, number, number];
      serviceMs: number;
      slow: { from: number; to: number; serviceMs: number; what: string };
      policies: { id: Policy; label: string; detail: string }[];
      timeoutS?: number;
    }
  | {
      kind: 'roles';
      classes: { id: string; name: string; blurb: string }[];
      cards: RoleCard[];
      walk: { title: string; steps: { prompt: string; owner: string; call: string }[] };
    };

export interface Stage {
  id: string;
  title: string;
  /** Guided mode: one or two sentences introducing the stage. */
  intro: string;
  /** The one clear question for this stage. */
  question: string;
  activity: Activity;
  help: StageHelp;
  lessons?: string[];
  /** Marks the stage that introduces a changed condition (predict → run → revise). */
  change?: { announce: string; rule: string; alternate?: { announce: string; label: string } };
}

export interface WorkedSolution {
  design: DesignGraph;
  /** Why each part is there, by component id (also used to explain differences one at a time). */
  why: Record<string, string>;
  /** Palette types that are a valid alternative for a solution component, with the trade-off. */
  alternatives?: Record<string, { types: string[]; tradeoff: string }>;
  /** A realistic request or interaction, hop by hop. */
  trace: { title: string; steps: { from: string; to: string; text: string }[] };
  tradeoff: string;
  otherApproach: string;
}

export interface InterviewScript {
  caseId: string;
  track: 'hld' | 'lld';
  /** What the learner will actually do, for the picker. */
  doLine: string;
  skills: Skill[];
  brief: Brief;
  palette: PaletteItem[];
  /** Arrow meanings relevant to this case, most useful first. */
  verbs: string[];
  stages: Stage[];
  rules: Rule[];
  solution: WorkedSolution;
}
