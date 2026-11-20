/**
 * One interview session as a saved `interview:<id>` record (synced through the existing progress store, so a
 * signed-in learner resumes the same brief, stage, editable design and decisions on another device).
 * Version 1 records (the earlier free-form workspace) are migrated on read; nothing is lost.
 */
import { EMPTY_GRAPH, type DesignGraph } from '../../sim/interview/graph';
import type { InterviewScript } from '../../content/interview/types';

export type HelpLevel = 0 | 1 | 2 | 3 | 4;
export interface LogEntry { at: number; who: 'interviewer' | 'you'; text: string; rule?: string; verdict?: 'sound' | 'partial' | 'risky' }

export interface SessionV2 {
  v: 2;
  caseId: string;
  mode: 'guided' | 'mock';
  startedAt: number;
  savedAt?: number;
  finishedAt?: number;
  timer: { on: boolean; minutes: number; startedAt?: number };
  /** Index into script.stages; stages.length means the debrief. */
  stage: number;
  /** Furthest stage reached (the rail lets the learner go back without losing it). */
  reached: number;
  design: DesignGraph;
  states: DesignGraph;
  /** Per-stage activity state (prediction, timeline order, guard, assignments, sliders…). */
  work: Record<string, Record<string, unknown>>;
  /** Follow-up answers by rule id; assumptions as `assume:<id>`; asked clarifying questions as `asked:<id>`. */
  answers: Record<string, string>;
  /** Activity outcomes the interviewer and debrief read, e.g. race: 'one'. */
  results: Record<string, string>;
  log: LogEntry[];
  /** Acknowledgements already made (rule ids). */
  acked: string[];
  /** Private record of the most help used per stage: 1 hint · 2 walkthrough · 3 stage solution · 4 full solution. */
  help: Record<string, HelpLevel>;
  /** The design as it was when each stage was entered, for “Try this step again”. */
  snapshots: Record<string, { design: DesignGraph; states: DesignGraph }>;
  /** Replaying the changed condition with its alternate. */
  alternate?: boolean;
  notes: string;
  scores?: Record<string, number>;
}

interface SessionV1 {
  caseId: string; startedAt: number; timed: boolean; minutes: number; phase: number; notes: string;
  diagram: { boxes: { id: string; x: number; y: number; label: string }[]; arrows: { from: string; to: string }[] };
  hintsUsed: number; scores: Record<string, number>; finishedAt?: number; savedAt?: number;
}

export function migrate(r: unknown, script?: InterviewScript): SessionV2 | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Partial<SessionV2> & Partial<SessionV1>;
  if (o.v === 2) return { ...blank(o.caseId!, o.mode ?? 'guided'), ...(o as SessionV2) };
  if (!o.caseId) return null;
  const v1 = o as SessionV1;
  const lld = script?.track === 'lld' || v1.caseId.startsWith('lld-');
  const design: DesignGraph = {
    comps: (v1.diagram?.boxes ?? []).map((b) => ({ id: b.id, type: 'custom', kind: lld ? 'class' : 'service', label: b.label, x: Math.round((b.x * 640) / 800), y: Math.round(Math.min(440, b.y)) })),
    links: (v1.diagram?.arrows ?? []).map((a, i) => ({ id: `m${i}`, from: a.from, to: a.to })),
  };
  return {
    ...blank(v1.caseId, 'mock'),
    startedAt: v1.startedAt ?? Date.now(),
    savedAt: v1.savedAt,
    finishedAt: v1.finishedAt,
    timer: { on: !!v1.timed, minutes: v1.minutes ?? 45, startedAt: v1.startedAt },
    design,
    stage: Math.min(1, v1.phase ?? 0),
    reached: Math.min(1, v1.phase ?? 0),
    notes: v1.notes ?? '',
    scores: v1.scores,
    help: v1.hintsUsed ? { clarify: 1 } : {},
  };
}

export function blank(caseId: string, mode: 'guided' | 'mock'): SessionV2 {
  return {
    v: 2, caseId, mode, startedAt: Date.now(), timer: { on: false, minutes: 45 }, stage: 0, reached: 0,
    design: EMPTY_GRAPH, states: EMPTY_GRAPH, work: {}, answers: {}, results: {}, log: [], acked: [], help: {}, snapshots: {}, notes: '',
  };
}

export const newSessionId = (caseId: string) => `${caseId}-${Date.now().toString(36)}`;
