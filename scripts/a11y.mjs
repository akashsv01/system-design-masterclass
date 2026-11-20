// Accessibility audit: axe-core on representative pages (light and dark), plus a keyboard-only
// walk through a lesson. Usage: node scripts/a11y.mjs [baseUrl]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.argv[2] ?? 'http://localhost:8787';
const pages = ['/', '/topics', '/learn/first-booking', '/learn/replica-lag', '/learn/latency', '/learn/inside-a-request', '/labs/lab-cache', '/labs/lab-lru', '/cases/case-ticket-booking', '/cases/case-notifications', '/cases/lld-parking-lot', '/patterns/gof-reference', '/practice', '/interview', '/interview?probe=1', '/progress', '/coverage', '/capstone/capstone'];
let failures = 0;
const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  for (const path of pages) {
    await p.goto(base + path, { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    await p.addScriptTag({ content: axeSource });
    const res = await p.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document, { resultTypes: ['violations'] });
      return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') }));
    });
    if (res.length) {
      failures += res.length;
      console.log(`${scheme} ${path}: ${res.map((v) => `${v.id} (${v.impact}, ${v.n}) e.g. ${v.sample}`).join(' | ')}`);
    }
  }
  await ctx.close();
}
// Keyboard-only walk: open a lesson, Tab to the Next button, activate it with Enter, use the arrow keys.
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
await p.goto(base + '/learn/latency', { waitUntil: 'networkidle' });
let reachedNext = false;
for (let i = 0; i < 60 && !reachedNext; i++) {
  await p.keyboard.press('Tab');
  reachedNext = await p.evaluate(() => document.activeElement?.classList.contains('btn-next') ?? false);
}
const focusVisible = await p.evaluate(() => { const cs = getComputedStyle(document.activeElement); return cs.outlineStyle !== 'none' || (cs.boxShadow && cs.boxShadow !== 'none'); });
await p.keyboard.press('Enter');
await p.waitForTimeout(300);
const afterEnter = await p.locator('.controls .count-long').textContent();
await p.keyboard.press('ArrowRight');
await p.waitForTimeout(300);
const afterArrow = await p.locator('.controls .count-long').textContent();
console.log(`keyboard: reached Next by Tab: ${reachedNext}; visible focus: ${focusVisible}; Enter → "${afterEnter}"; ArrowRight → "${afterArrow}"`);
if (!reachedNext || !focusVisible || afterEnter !== 'Step 2 of 6') failures++;
// Reduced motion: the layered view opens as a flat list and transitions are effectively instant.
const rctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const r = await rctx.newPage();
await r.goto(base + '/learn/inside-a-request', { waitUntil: 'networkidle' });
const flat = await r.locator('.layer-flat').count();
const dur = await r.evaluate(() => getComputedStyle(document.querySelector('.btn')).transitionDuration);
console.log(`reduced motion: layered view starts flat: ${flat > 0}; button transition: ${dur}`);
if (!flat || !/^0\.?0*1?m?s|^1e-05s|^0s/.test(dur.split(',')[0])) failures++;
await browser.close();
console.log(failures ? `${failures} accessibility problem(s)` : 'No serious or critical axe violations; keyboard path works.');
process.exit(failures ? 1 : 0);
