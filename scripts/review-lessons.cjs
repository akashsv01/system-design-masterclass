// Visual review: walk every step of a lesson, doing the interaction each step requires,
// screenshot it, and report console errors and layout problems.
// Usage: node scripts/review-lessons.cjs <baseUrl> <outDir> [lessonId ...]
const { chromium, devices } = require('playwright');
const [, , base = 'http://localhost:8787', out = 'screenshots-local', ...only] = process.argv;

async function act(p) {
  // Do whatever this step needs before Next can be pressed.
  for (const name of [/^Reserve seat F12$/, /^Save “Alex”$/, /^Read A$/, /^Reserve as Maya$/]) {
    const b = p.getByRole('button', { name }).first();
    if (await b.isVisible().catch(() => false) && await b.isEnabled().catch(() => false)) { await b.click(); await p.waitForTimeout(900); }
  }
  const leo = p.getByRole('button', { name: /^Reserve as Leo$/ });
  if (await leo.isVisible().catch(() => false) && await leo.isEnabled().catch(() => false)) { await leo.click(); await p.waitForTimeout(500); }
  // Race: play all events.
  for (let i = 0; i < 12; i++) {
    const ev = p.getByRole('button', { name: /^(Start: both press Reserve|Next event ▸)$/ });
    if (await ev.isVisible().catch(() => false) && await ev.isEnabled().catch(() => false)) { await ev.click(); await p.waitForTimeout(350); } else break;
  }
  // Answer any unanswered question with its last choice (often the right one in our lessons is not first).
  for (let round = 0; round < 3; round++) {
    const groups = p.locator('.question .choices');
    const n = await groups.count();
    for (let i = 0; i < n; i++) {
      const g = groups.nth(i);
      const btn = g.locator('button.choice:not([disabled])');
      if (await btn.count()) { await btn.nth(1).click().catch(() => btn.first().click()); await p.waitForTimeout(400); }
    }
    // Line picks: pick the highlighted line if any, else the 3rd line.
    const picks = p.locator('.question .snippet[role="listbox"]');
    const m = await picks.count();
    for (let i = 0; i < m; i++) {
      const opts = picks.nth(i).locator('button.snip-line');
      const hl = picks.nth(i).locator('button.snip-line.hl');
      if (await hl.count()) await hl.first().click(); else if (await opts.count() > 2) await opts.nth(2).click();
      await p.waitForTimeout(300);
    }
  }
}

async function layoutIssues(p) {
  return p.evaluate(() => {
    const issues = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) issues.push(`horizontal scroll: ${document.documentElement.scrollWidth} > ${innerWidth}`);
    // Smallest rendered SVG text in diagrams.
    let min = 99;
    document.querySelectorAll('svg.diagram text').forEach((t) => {
      const r = t.getBoundingClientRect();
      if (r.height > 0 && getComputedStyle(t.closest('g') || t).opacity !== '0') min = Math.min(min, r.height);
    });
    if (min < 12 && min !== 99) issues.push(`smallest diagram text box ${min.toFixed(1)}px`);
    const next = [...document.querySelectorAll('.controls button')].find((b) => /Next|first/.test(b.textContent || ''));
    if (next) {
      const r = next.getBoundingClientRect();
      const hdr = document.querySelector('.site-header').getBoundingClientRect();
      if (r.top < hdr.bottom && r.bottom > hdr.top) issues.push('Next button under header');
    }
    return issues;
  });
}

(async () => {
  const writeVerification = only.includes('--write-verification');
  const ids = only.filter((x) => !x.startsWith('--'));
  const lessons = ids.length ? ids : ['first-booking', 'replica-lag', 'lru-cache'];
  const failedIds = new Set();
  const b = await chromium.launch();
  const report = [];
  for (const [label, ctxOpts] of [['desktop', { viewport: { width: 1280, height: 900 } }], ['mobile', { ...devices['iPhone 13'] }]]) {
    for (const id of lessons) {
      const ctx = await b.newContext(ctxOpts);
      const p = await ctx.newPage();
      const errors = [];
      p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      p.on('pageerror', (e) => errors.push(String(e)));
      await p.goto(`${base}/learn/${id}`, { waitUntil: 'networkidle' });
      for (let s = 1; s <= 20; s++) {
        await act(p);
        await p.waitForTimeout(1000);
        const issues = await layoutIssues(p);
        await p.screenshot({ path: `${out}/${id}-${label}-${String(s).padStart(2, '0')}.png`, fullPage: label === 'mobile' });
        const count = await p.locator('.controls .count-long').textContent().catch(() => '');
        report.push(`${label} ${id} ${count} ${issues.join('; ')}`);
        if (issues.length) failedIds.add(id);
        const next = p.locator('.controls .btn-next');
        if (!(await next.count())) break;
        if (!(await next.isEnabled())) { report.push(`  BLOCKED: ${await next.textContent()}`); failedIds.add(id); break; }
        await next.click();
        await p.waitForTimeout(300);
      }
      if (errors.length) { report.push(`  CONSOLE ERRORS (${id} ${label}): ${[...new Set(errors)].slice(0, 5).join(' | ')}`); failedIds.add(id); }
      await ctx.close();
    }
  }
  await b.close();
  console.log(report.join('\n'));
  if (writeVerification) {
    // A lesson is "verified" only if every step rendered at both sizes with no console errors,
    // no layout issues and no blocked Next. Lessons that fail are removed from the list.
    const fs = require('fs');
    const path = 'src/content/verification.json';
    const v = JSON.parse(fs.readFileSync(path, 'utf8'));
    const set = new Set(v.verified);
    for (const id of lessons) (failedIds.has(id) ? set.delete(id) : set.add(id));
    v.verified = [...set].sort();
    fs.writeFileSync(path, JSON.stringify(v, null, 2) + '\n');
    console.log(`verification.json: ${v.verified.length} verified; failed this run: ${[...failedIds].join(', ') || 'none'}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
