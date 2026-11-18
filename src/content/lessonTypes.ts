/**
 * Data format for lessons rendered by the generic stepped reader (src/ui/lessons/GenericLesson.tsx).
 * Text fields accept a small inline markup: **bold**, *em*, `code`, [label](/route).
 */
import type { DNode, DEdge, DToken, Layout } from '../ui/components/Diagram';
import type { TimelineEvent, Series } from '../ui/components/Visuals';
import type { Layer } from '../ui/components/LayerStack';

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
  depth?: 'flat' | 'layered';
}

/** The lesson's visual format, chosen per topic (docs/LESSON_GUIDE.md §4). */
export type Visual =
  | { kind: 'diagram'; spec: DiagramSpec }
  | { kind: 'timeline'; lanes: { id: string; label: string }[]; events: TimelineEvent[]; unit?: string; note?: string }
  | { kind: 'chart'; xLabel: string; yLabel: string; chartKind?: 'line' | 'bar'; yMax?: number; yLog?: boolean; categories?: string[]; note?: string }
  | { kind: 'compare' }
  | { kind: 'stack'; layers: Layer[] }
  | { kind: 'none' };

/** Per-step view for non-diagram visuals. */
export interface TimelineView { upTo: number; focus?: number }
export interface ChartView { series: Series[]; marks?: { x: number; y: number; label: string }[]; thresholds?: { y: number; label: string }[] }
export interface CompareView {
  left: { title: string; points: string[]; verdict?: string; tone?: 'ok' | 'fail' | 'plain' };
  right: { title: string; points: string[]; verdict?: string; tone?: 'ok' | 'fail' | 'plain' };
  focus?: 'left' | 'right' | 'both';
}
export interface StackView { ghost?: string[]; focus?: string; separation?: number; tones?: Record<string, Layer['tone']>; details?: Record<string, string> }

/**
 * An optional learner control on one step: change an input and see the consequence.
 * `compute` is a pure function so the result is deterministic and replayable.
 */
export interface Experiment {
  step: number;
  label: string;
  min: number;
  max: number;
  stepSize: number;
  initial: number;
  unit: string;
  /** Returns the view to show and one or two sentences describing the consequence. */
  compute: (value: number) => { text: string; diagram?: StepView; chart?: ChartView; timeline?: TimelineView; compare?: CompareView; stack?: StackView };
  assumptions: string[];
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
  /** Views for non-diagram visuals. */
  timeline?: TimelineView;
  chart?: ChartView;
  compare?: CompareView;
  stack?: StackView;
  /** A short Python snippet revealed on request at this step ("See it in Python"). */
  code?: { code: string; highlight?: number[]; caption: string; open?: boolean };
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

/** Explain a decision or trade-off in one or two sentences (Amendment 3/4). */
export interface ShortExercise {
  id: string;
  prompt: string;
  hint?: string;
  checklist: string[];
  model: string;
}

/** Select the line that explains a behaviour, or the line with the mistake. */
export interface LinePickQuestion {
  id: string;
  prompt: string;
  /** Path under python/ whose function is shown, or inline code. */
  code: string;
  answer: number[];
  explain: string;
  wrong?: Record<number, string>;
  hint?: string;
  highlight?: number[];
}

export type Check =
  | ({ kind: 'choice' } & ChoiceQuestion)
  | ({ kind: 'numeric' } & NumericQuestion)
  | ({ kind: 'order' } & OrderQuestion)
  | ({ kind: 'line' } & LinePickQuestion);

export interface GenericLesson {
  id: string;
  opening: string;
  /** Breadcrumb label for the area, e.g. "Data systems". */
  area?: string;
  visual: Visual;
  experiment?: Experiment;
  steps: LessonStep[];
  /** An inspectable worked example: concrete values, arithmetic, or code. */
  worked: { title: string; blocks: Block[] };
  /** Objective checks of the learning objective (graded automatically). */
  checks: Check[];
  /** One small exercise: explain a decision in one or two sentences. */
  exercise: ShortExercise;
  deeper?: Block[];
  /** Where a beginner's analogy breaks, misconceptions, or variations. */
  next?: { id: string; reason: string };
}
