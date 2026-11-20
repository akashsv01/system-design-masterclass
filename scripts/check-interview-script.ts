/** Usage: npx tsx scripts/check-interview-script.ts src/content/interview/scripts/<file>.ts — audits every script exported by the file. */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { auditScript } from '../src/content/interview/audit';
import type { InterviewScript } from '../src/content/interview/types';

const files = process.argv.slice(2);
let bad = 0;
for (const f of files) {
  const mod = (await import(pathToFileURL(resolve(f)).href)) as Record<string, unknown>;
  for (const [name, v] of Object.entries(mod)) {
    const s = v as InterviewScript;
    if (!s || typeof s !== 'object' || !('caseId' in s) || !('stages' in s)) continue;
    const { errors, warnings } = auditScript(s);
    console.log(`${name} (${s.caseId}): ${errors.length} errors, ${warnings.length} warnings`);
    for (const x of errors) console.log('  ERROR ' + x);
    for (const x of warnings) console.log('  warn  ' + x);
    bad += errors.length;
  }
}
process.exit(bad ? 1 : 0);
