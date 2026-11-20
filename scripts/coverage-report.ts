/**
 * Curriculum coverage report and content audit.
 *   npx tsx scripts/coverage-report.ts          → writes docs/COVERAGE.md
 *   npx tsx scripts/coverage-report.ts --check  → also exits 1 on any error
 *
 * Checks: missing prerequisites, prerequisite cycles, duplicate ids/titles/routes, missing or duplicate
 * catalog decision lines, orphan content,
 * topics marked complete without assessment, broken internal links, invalid answer keys, next-lesson ids,
 * and master-prompt scope terms not covered by any topic.
 */
import { writeFileSync } from 'node:fs';
import { CURRICULUM, MODULES, piecesFor, CUSTOM_LESSONS } from '../src/content/curriculum';
import { OUTLINE_PROBLEMS } from '../src/content/manifest';
import { SCRIPTS } from '../src/content/interview/scripts';
import { auditScript } from '../src/content/interview/audit';
import { GENERIC_LESSONS } from '../src/content/lessons';
import { CASES } from '../src/content/cases';
import { LABS } from '../src/content/labs';
import { SCOPE } from './scope-terms';
import { GOF } from '../src/content/gof';
import type { Check } from '../src/content/lessonTypes';
import { DECISIONS } from '../src/content/decisions';

const errors: string[] = [];
// Interview scripts (interview brief §10): every published case has an audited script.
const INTERVIEW: string[] = [];
for (const id of Object.keys(CASES)) {
  const sc = SCRIPTS[id];
  if (!sc) { INTERVIEW.push(`interview: ${id} has no interview script yet`); continue; }
}

// Course outline (Category → Module → Lesson): every topic exactly once, no unknown ids, prerequisites earlier.
for (const p of OUTLINE_PROBLEMS) errors.push(`outline: ${p}`);
{
  const pos = new Map(CURRICULUM.map((t, i) => [t.id, i]));
  for (const t of CURRICULUM) for (const p of t.prereqs) if ((pos.get(p) ?? -1) > pos.get(t.id)!) errors.push(`outline: ${t.id} comes before its prerequisite ${p}`);
}
const warnings: string[] = [];
for (const sc of Object.values(SCRIPTS)) { const r = auditScript(sc); errors.push(...r.errors.map((x) => `interview: ${x}`)); warnings.push(...r.warnings.map((x) => `interview: ${x}`)); }
// Missing scripts are errors once the whole library is scripted; until then they are reported as warnings.
(Object.keys(SCRIPTS).length >= Object.keys(CASES).length ? errors : warnings).push(...INTERVIEW);

const ids = new Set(CURRICULUM.map((t) => t.id));
const routes = new Set(CURRICULUM.map((t) => t.route));
const STATIC_ROUTES = ['/', '/topics', '/practice', '/interview', '/progress', '/coverage', '/patterns', '/capstone'];

// Duplicates
const seen = new Map<string, string>();
for (const t of CURRICULUM) {
  for (const [kind, key] of [['id', t.id], ['title', t.title.toLowerCase()], ['route', t.route]] as const) {
    const k = `${kind}:${key}`;
    if (seen.has(k)) errors.push(`Duplicate ${kind} "${key}" (${seen.get(k)} and ${t.id})`);
    seen.set(k, t.id);
  }
  if (!MODULES.some((m) => m.id === t.category)) errors.push(`${t.id}: unknown category ${t.category}`);
  for (const p of t.prereqs) if (!ids.has(p)) errors.push(`${t.id}: missing prerequisite "${p}"`);
}

// Catalog decision lines (brief §3 B7): every topic has one, and no two are the same.
const decisionSeen = new Map<string, string>();
for (const t of CURRICULUM) {
  const d = DECISIONS[t.id];
  if (!d) errors.push(`${t.id}: no catalog decision line in src/content/decisions.ts`);
  else if (decisionSeen.has(d.toLowerCase())) errors.push(`${t.id}: decision line duplicates ${decisionSeen.get(d.toLowerCase())}`);
  else decisionSeen.set(d.toLowerCase(), t.id);
}
for (const id of Object.keys(DECISIONS)) if (!ids.has(id)) errors.push(`decisions.ts: "${id}" is not a topic`);

// Cycles
const state = new Map<string, 0 | 1 | 2>();
const byId = new Map(CURRICULUM.map((t) => [t.id, t]));
function visit(id: string, path: string[]) {
  if (state.get(id) === 2) return;
  if (state.get(id) === 1) {
    errors.push(`Prerequisite cycle: ${[...path, id].join(' → ')}`);
    return;
  }
  state.set(id, 1);
  for (const p of byId.get(id)?.prereqs ?? []) visit(p, [...path, id]);
  state.set(id, 2);
}
for (const t of CURRICULUM) visit(t.id, []);

// Orphans
for (const id of [...Object.keys(GENERIC_LESSONS), ...Object.keys(CASES), ...Object.keys(LABS), ...Object.keys(CUSTOM_LESSONS)]) {
  if (!ids.has(id)) errors.push(`Orphan content "${id}" has no manifest entry`);
}

// Internal links and answer keys
const linkRe = /\[[^\]]+\]\((\/[^)#]+)(#[^)]*)?\)/g;
function checkLinks(where: string, text: string) {
  for (const m of text.matchAll(linkRe)) {
    const path = m[1];
    if (!routes.has(path) && !STATIC_ROUTES.includes(path)) errors.push(`${where}: broken link ${path}`);
  }
}
function checkCheck(where: string, c: Check) {
  if (c.kind === 'choice') {
    if (c.correct && !c.choices.some((x) => x.id === c.correct)) errors.push(`${where}/${c.id}: answer key "${c.correct}" is not a choice`);
    if (new Set(c.choices.map((x) => x.id)).size !== c.choices.length) errors.push(`${where}/${c.id}: duplicate choice ids`);
    for (const x of c.choices) if (!x.why?.trim()) errors.push(`${where}/${c.id}: choice ${x.id} has no explanation`);
  } else if (c.kind === 'numeric') {
    if (!(c.tolerance > 0 && c.tolerance < 1)) errors.push(`${where}/${c.id}: tolerance must be in (0,1)`);
    if (!c.solution.length) errors.push(`${where}/${c.id}: numeric check without worked solution`);
  } else if (c.kind === 'order') {
    if (c.items.length < 3) errors.push(`${where}/${c.id}: order check needs at least 3 items`);
  } else if (c.kind === 'line') {
    const n = c.code.split('\n').length;
    for (const a of c.answer) if (a < 1 || a > n) errors.push(`${where}/${c.id}: line ${a} outside snippet (1..${n})`);
  }
}
for (const [id, l] of Object.entries(GENERIC_LESSONS)) {
  const texts = [l.opening, ...l.steps.flatMap((s) => [...s.body, s.callout?.text ?? '']), l.exercise.model, ...(l.next ? [l.next.reason] : [])];
  for (const t of texts) checkLinks(id, t);
  for (const s of l.steps) if (s.predict) checkCheck(id, { kind: 'choice', ...s.predict });
  // Activity ids become saved-record keys; two activities sharing an id would share (and corrupt) one record.
  const activityIds = [...l.steps.filter((s) => s.predict).map((s) => s.predict!.id), ...l.checks.map((c) => c.id), l.exercise.id];
  const dupIds = activityIds.filter((x, i) => activityIds.indexOf(x) !== i);
  if (dupIds.length) errors.push(`${id}: duplicate activity id(s) ${[...new Set(dupIds)].join(', ')}`);
  for (const c of l.checks) checkCheck(id, c);
  if (l.next && !ids.has(l.next.id)) errors.push(`${id}: next lesson "${l.next.id}" not in manifest`);
  if (l.steps.length > 9) warnings.push(`${id}: ${l.steps.length} steps — consider splitting`);
  for (const s of l.steps) {
    // Step titles double as the Next button label; on phones it has two short lines.
    if (s.title.length > 40) errors.push(`${id}: step title too long for the Next button (${s.title.length} > 40): "${s.title}"`);
    if (s.body.length > 3) warnings.push(`${id} / "${s.title}": ${s.body.length} paragraphs (guide: ≤ 3)`);
    const words = s.body.join(' ').split(/\s+/).length;
    if (words > 130) warnings.push(`${id} / "${s.title}": ${words} words in one step (guide: keep it short)`);
    if (/today's digital world|let's dive|powerful concept|essential for scalable/i.test(s.body.join(' '))) errors.push(`${id}: banned phrase in "${s.title}"`);
  }
  if (l.visual.kind === 'diagram') {
    const nodeIds = new Set(l.visual.spec.nodes.map((n) => n.id));
    for (const n of nodeIds) {
      if (!l.visual.spec.wide.nodes[n]) errors.push(`${id}: node ${n} missing from wide layout`);
      if (!l.visual.spec.narrow.nodes[n]) errors.push(`${id}: node ${n} missing from narrow layout`);
    }
    for (const s of l.steps) for (const t of s.view?.tokens ?? []) if (!nodeIds.has(t.from) || !nodeIds.has(t.to)) errors.push(`${id}: token ${t.from}→${t.to} references unknown node`);
  }
}
for (const [id, c] of Object.entries(CASES)) {
  for (const ch of c.checks) checkCheck(id, ch);
  for (const st of c.stages) for (const b of st.reference) if (b.type === 'p') checkLinks(id, b.text);
}

// The pattern reference must cover all 23 Gang of Four patterns.
if (new Set(GOF.map((p) => p.id)).size !== 23) errors.push(`gof-reference: expected 23 distinct patterns, found ${new Set(GOF.map((p) => p.id)).size}`);
for (const p of GOF) if (p.lesson && !ids.has(p.lesson)) errors.push(`gof-reference: ${p.name} links to unknown lesson ${p.lesson}`);

// Topics claiming completeness must have assessment
for (const t of CURRICULUM) {
  const p = piecesFor(t.id);
  if ((t.status === 'implemented' || t.status === 'verified') && !p.assessment) errors.push(`${t.id}: marked ${t.status} without assessment`);
}

// Scope coverage
const haystack = CURRICULUM.map((t) => [t.title, t.short ?? '', ...t.covers].join(' | ').toLowerCase()).join(' || ');
const uncovered: string[] = [];
for (const [area, terms] of Object.entries(SCOPE)) for (const term of terms) if (!haystack.includes(term.toLowerCase())) uncovered.push(`${area}: ${term}`);
for (const u of uncovered) errors.push(`Scope term not covered by any topic — ${u}`);

// Report
const counts: Record<string, number> = {};
for (const t of CURRICULUM) counts[t.status] = (counts[t.status] ?? 0) + 1;
const lines: string[] = [];
lines.push('# Curriculum coverage report', '');
lines.push('Generated by `npm run coverage:report` from `src/content/manifest.ts` and the content that exists.');
lines.push('Status is computed, never hand-set: **planned** (nothing yet) → **partial** (missing pieces) → **implemented** (explanation, worked example, exercise, assessment) → **verified** (rendered in a browser at desktop and mobile with no console errors; listed in `src/content/verification.json`) → **reviewed** (an independent human editor; `src/content/reviews.json`).', '');
const withChecked = CURRICULUM.filter((t) => t.sources.some((x) => x.checked)).length;
const allSources = new Map(CURRICULUM.flatMap((t) => t.sources).map((x) => [`${x.title}|${x.where ?? ''}`, x]));
const checkedSources = [...allSources.values()].filter((x) => x.checked).length;
lines.push('Four separate kinds of evidence, never merged:', '');
lines.push(`- **Implementation:** ${CURRICULUM.filter((t) => t.status !== 'planned' && t.status !== 'partial').length} of ${CURRICULUM.length} topics have an explanation, worked example, exercise and assessment.`);
lines.push(`- **Technical verification:** ${counts.verified ?? 0} topics render every step at desktop and phone sizes without errors (\`scripts/review-lessons.cjs\`); tests, Python checks and simulations are listed in \`docs/DESIGN_REVIEW.md\`.`);
lines.push(`- **Source verification:** ${checkedSources} of ${allSources.size} distinct cited sections were read and compared with the lessons; ${withChecked} topics cite at least one checked source. Books are not accessible from the authoring environment and stay unchecked. Details: \`docs/SOURCES_AUDIT.md\`.`);
lines.push(`- **Independent editorial review:** ${counts.reviewed ?? 0} topics (only a human reviewer can add one, in \`src/content/reviews.json\`).`, '');
lines.push(`**${CURRICULUM.length} topics.** ` + ['planned', 'partial', 'implemented', 'verified', 'reviewed'].map((s) => `${s}: ${counts[s] ?? 0}`).join(' · '), '');
lines.push(`Audit: ${errors.length} error(s), ${warnings.length} warning(s).`, '');
for (const m of MODULES) {
  const ts = CURRICULUM.filter((t) => t.category === m.id);
  lines.push(`## ${m.title}`, '');
  lines.push('| Topic | Status | Format | Prerequisites | Objective | Sources (checked/total) |');
  lines.push('|---|---|---|---|---|---|');
  for (const t of ts) {
    const p = piecesFor(t.id);
    lines.push(`| [${t.short ?? t.title}](${t.route}) | ${t.status}${t.status === 'partial' ? ` (${t.statusNote})` : ''} | ${p.format} | ${t.prereqs.join(', ') || '—'} | ${t.objective.replace(/\|/g, '/')} | ${t.sources.filter((x) => x.checked).length}/${t.sources.length} |`);
  }
  lines.push('');
}
if (errors.length) lines.push('## Audit errors', '', ...errors.map((e) => `- ${e}`), '');
if (warnings.length) lines.push('## Audit warnings', '', ...warnings.map((e) => `- ${e}`), '');
writeFileSync('docs/COVERAGE.md', lines.join('\n'));
console.log(`docs/COVERAGE.md written. ${CURRICULUM.length} topics; ${JSON.stringify(counts)}; ${errors.length} errors, ${warnings.length} warnings.`);
if (errors.length) console.log(errors.slice(0, 40).map((e) => `  ERROR ${e}`).join('\n'));
if (process.argv.includes('--check') && errors.length) process.exit(1);
