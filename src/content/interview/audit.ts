/**
 * Audit for interview scripts (interview brief §10): a clear brief, a first move, clarifying questions, a main
 * activity suited to the case, meaningful follow-ups, a full help ladder at every stage, a changed condition and a
 * complete worked solution — and every reference (palette types, stage ids, lesson ids, solution ids) resolves.
 */
import type { InterviewScript } from './types';
import type { Cond } from '../../sim/interview/rules';
import type { Sel } from '../../sim/interview/graph';
import { CATALOGUE, LLD_CATALOGUE } from './catalogue';
import { TOPICS } from '../manifest';
import { validOrder } from '../../sim/interview/sims';

const KINDS = new Set(['client', 'lb', 'gateway', 'service', 'worker', 'db', 'cache', 'queue', 'stream', 'storage', 'cdn', 'ext', 'search', 'scheduler', 'class', 'enum', 'iface', 'state']);

export function auditScript(s: InterviewScript): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const e = (m: string) => errors.push(`${s.caseId}: ${m}`);
  const w = (m: string) => warnings.push(`${s.caseId}: ${m}`);
  const topicIds = new Set(TOPICS.map((t) => t.id));
  if (!topicIds.has(s.caseId)) e('caseId is not a topic');
  const b = s.brief;
  if (!b.interviewer?.name || !b.interviewer.role) e('brief: interviewer name and role');
  if (!b.intro || !b.users || !b.firstMove) e('brief: intro, users and firstMove are required');
  if ((b.needs?.length ?? 0) < 2) e('brief: at least 2 needs');
  if ((b.mustHold?.length ?? 0) < 1) e('brief: at least 1 must-hold');
  if ((b.constraints?.length ?? 0) < 2) e('brief: at least 2 constraints');
  if (!b.terms?.length) w('brief: no terms defined');
  if (!s.doLine || s.doLine.length > 170) e('doLine missing or longer than 170 characters');
  if (!s.skills.length) e('no skills');
  const types = new Set(s.palette.map((p) => p.type));
  if (types.size !== s.palette.length) e('palette types must be unique');
  if (s.palette.length < 3 || s.palette.length > 10) e(`palette should have 3–10 parts (has ${s.palette.length})`);
  for (const p of s.palette) { if (!KINDS.has(p.kind)) e(`palette ${p.type}: unknown kind ${p.kind}`); if (!p.blurb) e(`palette ${p.type}: blurb required`); }
  const allTypes = new Set([...types, ...CATALOGUE.map((c) => c.type), ...LLD_CATALOGUE.map((c) => c.type)]);
  const selOk = (sel: Sel, where: string) => {
    if (typeof sel === 'string') { if (!KINDS.has(sel)) e(`${where}: unknown kind ${sel}`); return; }
    for (const t of ([] as string[]).concat(sel.type ?? [])) if (!allTypes.has(t)) e(`${where}: unknown type ${t}`);
    for (const k of ([] as string[]).concat(sel.kind ?? [])) if (!KINDS.has(k)) e(`${where}: unknown kind ${k}`);
  };

  const stageIds = new Set(s.stages.map((st) => st.id));
  if (s.stages.length < 3) e('at least 3 stages');
  if (s.stages[0]?.activity.kind !== 'clarify') e('first stage must be clarify');
  if (!s.stages.some((st) => st.change)) e('no stage introduces a changed condition');
  const kinds = s.stages.map((st) => st.activity.kind);
  if (!kinds.some((k) => !['clarify', 'build'].includes(k))) e('needs a main activity beyond clarify and build (trace, timeline, states, model, queue or roles)');
  for (const st of s.stages) {
    const where = `stage ${st.id}`;
    if (!st.title || !st.intro || !st.question) e(`${where}: title, intro and question required`);
    if (!st.help?.hint || (st.help.walkthrough?.length ?? 0) < 2 || !st.help.solution?.length || !st.help.why) e(`${where}: help needs hint, ≥2 walkthrough steps, a solution and why`);
    for (const l of st.lessons ?? []) if (!topicIds.has(l)) e(`${where}: unknown lesson ${l}`);
    for (const wk of st.help?.walkthrough ?? []) for (const f of wk.focus ?? []) if (!s.solution.design.comps.some((c) => c.id === f)) e(`${where}: walkthrough focus ${f} is not a solution component`);
    if (st.change && (!st.change.announce || !st.change.rule)) e(`${where}: change needs announce and rule`);
    const a = st.activity;
    switch (a.kind) {
      case 'clarify':
        if (a.questions.length < 4) e(`${where}: at least 4 clarifying questions`);
        for (const q of a.questions) if (!q.q || !q.a) e(`${where}: question ${q.id} needs q and a`);
        for (const as of a.assumptions) if (as.options.length < 2) e(`${where}: assumption ${as.id} needs ≥2 options`);
        if (!a.assumptions.length) w(`${where}: no assumption for the learner to state`);
        break;
      case 'build':
        for (const t of a.traces ?? []) { selOk(t.from, `${where} trace ${t.id} from`); selOk(t.to, `${where} trace ${t.id} to`); }
        for (const c of a.starter?.comps ?? []) if (!allTypes.has(c.type)) e(`${where}: starter type ${c.type} unknown`);
        if (s.track === 'hld' && !a.traces?.length) w(`${where}: no request to trace`);
        break;
      case 'trace':
        for (const t of [...a.from, ...a.to, ...a.failCandidates]) if (!types.has(t)) e(`${where}: ${t} is not a palette type`);
        if (a.predict.choices.length < 2) e(`${where}: predict needs choices`);
        break;
      case 'timeline':
        if (!validOrder(a.start)) e(`${where}: start order has a write before its read`);
        if (!a.guards.some((g) => g.id === 'plain') || !a.guards.some((g) => g.id !== 'plain')) e(`${where}: guards need “plain” and a safe option`);
        break;
      case 'states': {
        const keys = new Set(a.states.map((x) => x.key));
        const evs = new Set(a.events.map((x) => x.id));
        if (!keys.has(a.initial)) e(`${where}: initial state not in states`);
        for (const ev of a.scenario) { if (!evs.has(ev.event)) e(`${where}: scenario event ${ev.event} not in events`); if (ev.expect && !keys.has(ev.expect)) e(`${where}: expected state ${ev.expect} unknown`); }
        if (a.timer && !evs.has(a.timer.event)) e(`${where}: timer event not in events`);
        break;
      }
      case 'model': {
        const t = a.tables.find((x) => x.id === a.table);
        if (!t) { e(`${where}: table ${a.table} missing`); break; }
        for (const q of [a.first, a.second]) if (!t.fields.includes(q.filter) || (q.sort && !t.fields.includes(q.sort))) e(`${where}: query ${q.id} uses fields not in ${t.name}`);
        if (a.tradeoffs.length < 2) e(`${where}: at least 2 trade-offs`);
        break;
      }
      case 'queue':
        if (a.policies.length < 2) e(`${where}: at least 2 policies`);
        if (!(a.arrival[0] <= a.arrival[1] && a.arrival[1] <= a.arrival[2]) || !(a.workers[0] <= a.workers[1] && a.workers[1] <= a.workers[2])) e(`${where}: ranges must be [min, default, max]`);
        break;
      case 'roles': {
        const cls = new Set(a.classes.map((c) => c.id));
        for (const c of a.cards) for (const o of [c.owner, ...(c.alt ?? [])]) if (!cls.has(o)) e(`${where}: card ${c.id} owner ${o} unknown`);
        for (const st2 of a.walk.steps) if (!cls.has(st2.owner)) e(`${where}: walk owner ${st2.owner} unknown`);
        if (a.cards.length < 4) e(`${where}: at least 4 responsibility cards`);
        break;
      }
    }
  }

  const ruleIds = new Set<string>();
  const condOk = (c: Cond, where: string) => {
    if ('has' in c) selOk(c.has, where); else if ('lacks' in c) selOk(c.lacks, where); else if ('count' in c) selOk(c.count, where);
    else if ('link' in c || 'path' in c) { const pr = 'link' in c ? c.link : c.path; selOk(pr[0], where); selOk(pr[1], where); }
    else if ('all' in c) c.all.forEach((k) => condOk(k, where)); else if ('any' in c) c.any.forEach((k) => condOk(k, where)); else if ('not' in c) condOk(c.not, where);
  };
  for (const r of s.rules) {
    const where = `rule ${r.id}`;
    if (ruleIds.has(r.id)) e(`${where}: duplicate id`);
    ruleIds.add(r.id);
    if (r.stage && !stageIds.has(r.stage)) e(`${where}: unknown stage ${r.stage}`);
    if (r.gap && !stageIds.has(r.gap.stage)) e(`${where}: gap stage ${r.gap.stage} unknown`);
    if (r.gap?.lesson && !topicIds.has(r.gap.lesson)) e(`${where}: unknown lesson ${r.gap.lesson}`);
    if (r.ask?.choices) { if (r.ask.choices.length < 2) e(`${where}: ask needs ≥2 choices`); for (const ch of r.ask.choices) if (!ch.reply) e(`${where}: choice ${ch.id} needs a reply`); }
    if (!r.ack && !r.ask && !r.coach && !r.strength && !r.gap) e(`${where}: does nothing`);
    condOk(r.when, where);
  }
  if (s.rules.filter((r) => r.ask).length < 3) e('at least 3 follow-up questions (rules with ask)');
  if (!s.rules.some((r) => r.strength)) e('no rule records a strength for the debrief');
  if (!s.rules.some((r) => r.gap)) e('no rule records a gap for the debrief');
  for (const st of s.stages) if (st.activity.kind !== 'clarify' && !s.rules.some((r) => r.stage === st.id)) w(`stage ${st.id}: no interviewer rule reacts to it`);

  const sol = s.solution;
  const ids = new Set(sol.design.comps.map((c) => c.id));
  if (sol.design.comps.length < 3) e('solution: at least 3 components');
  for (const c of sol.design.comps) { if (!allTypes.has(c.type)) e(`solution ${c.id}: type ${c.type} unknown`); if (!sol.why[c.id]) e(`solution ${c.id}: why missing`); if (c.x < 0 || c.x > 640 || c.y < 0 || c.y > 440) e(`solution ${c.id}: position outside 640×440`); }
  for (const l of sol.design.links) if (!ids.has(l.from) || !ids.has(l.to)) e(`solution link ${l.id}: unknown end`);
  if (sol.trace.steps.length < 2) e('solution trace: at least 2 steps');
  for (const t of sol.trace.steps) if (!ids.has(t.from) || !ids.has(t.to)) e(`solution trace step ${t.from}→${t.to}: unknown component`);
  if (!sol.tradeoff || !sol.otherApproach) e('solution: tradeoff and otherApproach required');
  for (const [k, v] of Object.entries(sol.alternatives ?? {})) { if (!ids.has(k)) e(`solution alternative ${k}: unknown component`); for (const t of v.types) if (!allTypes.has(t)) e(`solution alternative ${k}: type ${t} unknown`); }
  return { errors, warnings };
}
