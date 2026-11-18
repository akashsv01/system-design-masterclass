import type { Block, Check, DiagramSpec, StepView } from './lessonTypes';

export type CaseStageKind = 'clarify' | 'simple' | 'critical-path' | 'failure' | 'change' | 'compare' | 'model' | 'invariants' | 'tests';

export interface CaseStage {
  kind: CaseStageKind;
  title: string;
  /** What the learner does before seeing guidance. */
  task: string;
  hints: string[];
  /** Reference answer revealed on request. */
  reference: Block[];
  /** What the reference diagram highlights at this stage. */
  view?: StepView;
}

export interface CaseStudy {
  id: string;
  /** Deliberately ambiguous, as an interviewer would say it. */
  prompt: string;
  pairedWith?: string;
  assumptions: string[];
  /** Reference architecture (HLD) or class/state diagram (LLD), revealed stage by stage. */
  diagram: DiagramSpec;
  stages: CaseStage[];
  /** Defensible alternatives compared under explicit assumptions. */
  alternatives?: { name: string; when: string; cost: string }[];
  checks: Check[];
  /** Transparent rubric for self-assessment. */
  rubric: { area: string; strong: string }[];
}
