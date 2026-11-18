/**
 * Interactive labs. Each lab component lives in src/ui/labs and its simulation in src/sim.
 * Every lab gives: a prediction, a meaningful control, an observable consequence, and a fresh problem.
 */
export interface LabMeta {
  id: string;
  prediction: string;
  control: string;
  consequence: string;
  freshProblem: string;
  assumptions: string[];
}

const all: LabMeta[] = [];

export const LABS: Record<string, LabMeta> = Object.fromEntries(all.map((l) => [l.id, l]));
export function registerLabs(list: LabMeta[]) {
  for (const l of list) LABS[l.id] = l;
}
