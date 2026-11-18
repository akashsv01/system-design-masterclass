/**
 * Data format for lessons rendered by the generic stepped reader (src/ui/lessons/GenericLesson.tsx).
 * Text fields accept a small inline markup: **bold**, *em*, `code`, [label](/route).
 */
import type { DNode, DEdge, DToken, Layout } from '../ui/components/Diagram';

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'code'; lang: 'java' | 'python' | 'pseudo' | 'sql' | 'http' | 'json' | 'text'; code: string; caption?: string }
  | { type: 'codeTabs'; tabs: { lang: 'java' | 'python' | 'pseudo' | 'sql' | 'text'; label: string; code: string }[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'callout'; title: string; text: string; tone?: 'info' | 'warn' }
  | { type: 'formula'; title: string; assumptions: string[]; steps: string[]; result: string; changed?: string };

export interface DiagramSpec {
  nodes: DNode[];
  edges: DEdge[];
  wide: Layout;
  narrow: Layout;
}

export interface StepView {
  /** Node ids to hide (reserving their space). */
  hide?: string[];
  /** Node ids to dim. */
  dim?: string[];
  states?: Record<string, DNode['state']>;
  values?: Record<string, string>;
  subs?: Record<string, string>;
  tags?: Record<string, DNode['tag']>;
  edgeStates?: Record<string, DEdge['state']>;
  tokens?: Omit<DToken, 'id'>[];
}

export interface LessonStep {
  title: string;
  kicker?: 'Problem' | 'Idea' | 'Watch' | 'Try it' | 'Trade-off' | 'Failure' | 'Fix' | 'Recap' | 'Predict' | 'Example';
  body: string[];
  changes?: { kind: 'add' | 'chg' | 'del'; text: string }[];
  view?: StepView;
  /** Optional question embedded in this step; must be answered before Next. */
  predict?: ChoiceQuestion;
  callout?: { title: string; text: string; tone?: 'info' | 'warn' };
  /** Description for screen readers when the diagram has changed meaningfully. */
  alt?: string;
}

export interface ChoiceQuestion {
  id: string;
  prompt: string;
  choices: { id: string; text: string; why: string }[];
  /** Omit for an opinion/prediction. */
  correct?: string;
}

export interface NumericQuestion {
  id: string;
  prompt: string;
  answer: number;
  /** Accept answers within this relative tolerance (0.1 = ±10%). */
  tolerance: number;
  unit: string;
  solution: string[];
}

export interface OrderQuestion {
  id: string;
  prompt: string;
  /** Items in the correct order. They are shuffled deterministically for display. */
  items: string[];
  explain: string;
}

export interface OpenExercise {
  id: string;
  prompt: string;
  hints: string[];
  rubric: string[];
  model: string[];
}

export type Check = ({ kind: 'choice' } & ChoiceQuestion) | ({ kind: 'numeric' } & NumericQuestion) | ({ kind: 'order' } & OrderQuestion);

export interface GenericLesson {
  id: string;
  opening: string;
  diagram?: DiagramSpec;
  steps: LessonStep[];
  /** An inspectable worked example: concrete values, arithmetic, or code. */
  worked: { title: string; blocks: Block[] };
  /** Objective checks of the learning objective (graded automatically). */
  checks: Check[];
  /** Open exercise with progressive hints, a rubric and a model answer. */
  exercise: OpenExercise;
  deeper?: Block[];
  /** Where a beginner's analogy breaks, misconceptions, or variations. */
  next?: { id: string; reason: string };
}
