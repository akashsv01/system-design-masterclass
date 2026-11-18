// End-to-end learner journeys against a running server (default http://localhost:8787).
// Usage: node scripts/e2e.mjs [baseUrl]
// Requires a fresh or disposable database: it registers new accounts with random emails.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.argv[2] ?? 'http://localhost:8787';
const results = [];
const ok = (name, cond, detail = '') => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const rand = Math.random().toString(36).slice(2, 8);
const emailA = `learner-${rand}@example.test`;
const emailB = `other-${rand}@example.test`;
const PASSWORD = 'correct horse battery';

async function signIn(page, email, mode) {
  await page.locator('.sync-chip').click();
  if (mode === 'register') await page.getByRole('button', { name: /Create an account/ }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.locator('.dialog button[type=submit]').click();
  await page.waitForSelector('.dialog', { state: 'detached' });
}

async function waitSynced(page) {
  await page.waitForFunction(() => document.querySelector('.sync-chip')?.getAttribute('data-kind') === 'saved', null, { timeout: 15000 });
}

const browser = await chromium.launch();
try {
  // ---------- Guest: public deep link, predict, experiment, draft, refresh ----------
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const a = await ctxA.newPage();
  const errors = [];
  a.on('pageerror', (e) => errors.push(String(e)));
  await a.goto(`${base}/learn/first-booking`);
  // The lesson chunk loads lazily, so wait for the heading rather than checking instantly.
  const opened = await a.getByRole('heading', { level: 1, name: /Two buyers see one seat left/ }).waitFor({ timeout: 10000 }).then(() => true, () => false);
  ok('public deep link opens a lesson without signing in', opened);

  // Walk to the prediction step (step 8) doing required actions.
  await a.locator('.controls .btn-next').click();
  await a.getByRole('button', { name: 'Reserve seat F12' }).click();
  for (let i = 0; i < 4; i++) await a.locator('.controls .btn-next').click();
  await a.getByRole('button', { name: 'Reserve as Maya' }).click();
  await a.getByRole('button', { name: 'Reserve as Leo' }).click();
  await a.getByRole('button', { name: /“Sold out”/ }).click();
  await a.locator('button.snip-line', { hasText: 'if seat.is_reserved:' }).click();
  await a.locator('.controls .btn-next').click(); // step 7
  await a.locator('.controls .btn-next').click(); // step 8 predict
  await a.getByRole('button', { name: /Both are told “Confirmed”/ }).click();
  ok('prediction is recorded', await a.getByText('Prediction saved.').isVisible());
  await a.locator('.controls .btn-next').click(); // step 9 race
  for (let i = 0; i < 8; i++) {
    const b = a.getByRole('button', { name: /^(Start: both press Reserve|Next event ▸)$/ });
    if (await b.isEnabled()) await b.click();
  }
  ok('experiment runs to two confirmations', await a.getByRole('heading', { name: 'Two confirmations, one seat' }).isVisible());
  await a.locator('.controls .btn-next').click(); // step 10 draft
  const draftText = `Both reads saw available before either write (${rand}).`;
  await a.locator('textarea').first().fill(draftText);
  // Draw a stroke on the sketch to verify drawings persist too.
  await a.getByText('Sketch it instead (optional)').click();
  const canvas = a.locator('canvas.sketch');
  const box = await canvas.boundingBox();
  await a.mouse.move(box.x + 20, box.y + 20);
  await a.mouse.down();
  await a.mouse.move(box.x + 120, box.y + 80, { steps: 5 });
  await a.mouse.up();
  ok('guest is told work is saved on this device only', await a.getByText(/Saved on this device at/).isVisible());

  await a.reload();
  ok('guest refresh restores the exact step', (await a.locator('.controls .count-long').textContent()) === 'Step 10 of 12');
  ok('guest refresh restores the draft text', (await a.locator('textarea').first().inputValue()) === draftText);

  // ---------- Sign up mid-drawing: guest work migrates ----------
  await signIn(a, emailA, 'register');
  await waitSynced(a);
  ok('after sign-up the draft is still there', (await a.locator('textarea').first().inputValue()) === draftText);
  ok('sync chip reports synced', (await a.locator('.sync-chip').getAttribute('data-kind')) === 'saved');

  // ---------- Second browser resumes ----------
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const b = await ctxB.newPage();
  await b.goto(`${base}/`);
  await signIn(b, emailA, 'login');
  await waitSynced(b);
  await b.goto(`${base}/`);
  const cont = b.locator('.continue-card');
  ok('second browser shows Continue learning', await cont.isVisible());
  await cont.click();
  await b.waitForSelector('textarea');
  ok('second browser resumes the exact step', (await b.locator('.controls .count-short').textContent()) === '10/12');
  ok('second browser restores the draft', (await b.locator('textarea').first().inputValue()) === draftText);
  const strokes = await b.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('sdm:v1:user:')) {
      const d = JSON.parse(localStorage.getItem(k));
      return d.records['draft:first-booking:race']?.value?.strokes?.length ?? 0;
    }
    return 0;
  });
  ok('second browser restores the drawing', strokes >= 1, `${strokes} stroke(s)`);

  // ---------- Conflicting edits from two devices keep both ----------
  await b.locator('textarea').first().fill(`Edited on the phone (${rand}).`);
  await a.locator('textarea').first().fill(`Edited on the laptop (${rand}).`);
  await waitSynced(b);
  await waitSynced(a);
  await a.reload();
  await waitSynced(a);
  await b.reload();
  await waitSynced(b);
  const bothVisible = (await a.getByText(/You have 2 versions of this/).count()) + (await b.getByText(/You have 2 versions of this/).count());
  ok('concurrent edits on two devices preserve both versions', bothVisible > 0);

  // ---------- Interrupted save: offline, then reconnect ----------
  await ctxA.setOffline(true);
  await a.locator('textarea').first().fill(`Written offline (${rand}).`);
  await a.waitForFunction(() => document.querySelector('.sync-chip')?.getAttribute('data-kind') === 'pending', null, { timeout: 15000 });
  ok('offline edit shows a pending state', true);
  await ctxA.setOffline(false);
  await a.evaluate(() => window.dispatchEvent(new Event('online')));
  await waitSynced(a);
  ok('pending edit syncs after reconnecting', (await a.locator('.sync-chip').getAttribute('data-kind')) === 'saved');

  // ---------- Private account isolation ----------
  const ctxC = await browser.newContext();
  const c = await ctxC.newPage();
  await c.goto(`${base}/learn/first-booking`);
  await signIn(c, emailB, 'register');
  await waitSynced(c);
  const leaked = await c.evaluate(async () => (await (await fetch('/api/progress?since=0')).json()).records.filter((r) => String(JSON.stringify(r.value)).includes('Both reads saw')).length);
  ok('another account cannot see this learner’s work', leaked === 0);

  // ---------- Shared-device sign-out ----------
  await b.locator('.sync-chip').click();
  await b.getByRole('button', { name: 'Sign out of this device' }).click();
  await b.waitForSelector('.dialog', { state: 'detached' });
  const remaining = await b.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sdm:v1:user:')).length);
  ok('sign-out removes the account copy from the device', remaining === 0);
  await b.goto(`${base}/learn/first-booking`);
  const textAfter = await b.locator('textarea').count() ? await b.locator('textarea').first().inputValue() : '';
  ok('next person on the device does not see the draft', !textAfter.includes(rand));
  const apiAfter = await b.evaluate(async () => (await fetch('/api/progress')).status);
  ok('server session is gone after sign-out', apiAfter === 401);

  // ---------- Fill one blank: real Python runs in the browser ----------
  const ctxD = await browser.newContext();
  const d = await ctxD.newPage();
  d.on('pageerror', (e) => errors.push(String(e)));
  await d.goto(`${base}/learn/first-booking`);
  await d.getByRole('button', { name: '12', exact: true }).click();
  const blank = d.getByLabel('Missing expression');
  await blank.fill('seat.buyer is None');
  await d.getByRole('button', { name: 'Run the checks' }).click();
  await d.waitForSelector('text=/checks pass|✕/', { timeout: 90000 });
  ok('a wrong blank fails the Python checks', (await d.getByText(/All [0-9]+ checks pass/).count()) === 0);
  await blank.fill('seat.is_reserved');
  await d.getByRole('button', { name: 'Run the checks' }).click();
  await d.waitForSelector('text=/All [0-9]+ checks pass/', { timeout: 60000 });
  ok('the right blank passes the Python checks in the browser', true);

  ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
