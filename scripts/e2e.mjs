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

  // Walk to the prediction step (step 8). Each required action is the control row's primary button (D15).
  const primary = a.locator('.controls .btn-next');
  const press = async (wait = 700) => { await primary.click(); await a.waitForTimeout(wait); };
  await press(); // step 2
  ok('the step action is the one primary button', (await primary.textContent()).includes('Reserve seat F12'));
  // Gating: → must not skip a required action (A1).
  await a.keyboard.press('ArrowRight');
  await a.waitForTimeout(300);
  ok('→ key cannot skip a required action', (await a.locator('.controls .count-long').textContent()) === 'Step 2 of 12');
  await press(1300); // Reserve
  for (let i = 0; i < 4; i++) await press(500); // to step 6 (code)
  await press(); // Run reserve() for Maya
  await press(); // Run reserve() for Leo
  await a.getByRole('button', { name: /“Sold out”/ }).click();
  await a.locator('button.snip-line', { hasText: 'if seat.is_reserved:' }).click();
  await press(); // step 7
  await press(); // step 8 predict
  await a.keyboard.press('ArrowRight');
  await a.waitForTimeout(300);
  ok('→ key cannot skip a required prediction', (await a.locator('.controls .count-long').textContent()) === 'Step 8 of 12');
  await a.locator('.steps-toggle').click();
  ok('the step list locks steps past the prediction', await a.locator('#steps-list button', { hasText: 'Run the race' }).isDisabled());
  await a.locator('.steps-toggle').click();
  await a.getByRole('button', { name: /Both are told “Confirmed”/ }).click();
  ok('prediction is recorded', await a.getByText('Prediction saved.').isVisible());
  await press(); // step 9 race
  // Rapid clicks on the race's event button must not skip or duplicate events.
  await primary.click();
  await primary.click({ delay: 0 }).catch(() => {});
  await a.waitForTimeout(200);
  ok('a double click advances the race by one event only', (await primary.textContent()).includes('Next event (2 of'));
  for (let i = 0; i < 9; i++) {
    if (!(await primary.textContent()).match(/Next event|Start:/)) break;
    await press(1000);
  }
  ok('experiment runs to two confirmations', await a.getByRole('heading', { name: 'Two confirmations, one seat' }).isVisible());
  await press(); // step 10 draft
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
  const cont = b.locator('.resume-panel a.btn-primary');
  ok('second browser shows the unfinished activity as the primary action', (await cont.textContent()).includes('Continue at step 10'));
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
  // Learner A has passed every gate, so the step list can jump straight to the last step.
  const d = a;
  await d.goto(`${base}/learn/first-booking`);
  await d.locator('.steps-toggle').click();
  await d.locator('#steps-list button', { hasText: 'The seat itself (LLD)' }).click();
  const blank = d.getByLabel('Missing expression');
  await blank.fill('seat.buyer is None');
  await d.getByRole('button', { name: 'Run the checks' }).click();
  await d.waitForSelector('text=/checks pass|Fail:/', { timeout: 90000 });
  ok('a wrong blank fails the Python checks', (await d.getByText(/All [0-9]+ checks pass/).count()) === 0);
  await blank.fill('seat.is_reserved');
  await d.getByRole('button', { name: 'Run the checks' }).click();
  await d.waitForSelector('text=/All [0-9]+ checks pass/', { timeout: 60000 });
  ok('the right blank passes the Python checks in the browser', true);
  const statusA = await d.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('sdm:v1:user:')) return JSON.parse(localStorage.getItem(k)).records['status:first-booking']?.value;
    return null;
  });
  ok('a blank solved on the second try counts as solved with help, not independently', statusA === 'hinted', String(statusA));

  // ---------- Evidence: a retry after a miss never counts as independent; self-ratings never count ----------
  const ctxF = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const f = await ctxF.newPage();
  f.on('pageerror', (e) => errors.push(String(e)));
  const guestRec = (key) => f.evaluate((k) => JSON.parse(localStorage.getItem('sdm:v1:guest') ?? '{"records":{}}').records[k]?.value ?? null, key);
  await f.goto(`${base}/labs/lab-lru`);
  await f.locator('.question .choice').first().click();
  await f.locator('.controls .btn-next').click(); await f.waitForTimeout(600);
  for (let i = 0; i < 3; i++) { await f.locator('.controls .btn-next').click(); await f.waitForTimeout(800); }
  ok('LRU lab: the experiment is stepped from the control row', (await f.locator('.op-list li.current').count()) === 1);
  await f.locator('.controls .btn-next').click(); await f.waitForTimeout(500);
  await f.locator('.controls .btn-next').click(); await f.waitForTimeout(500);
  const freshPrompt1 = await f.locator('.question h3').first().textContent();
  // Evidence rule: the first answer decides. A right answer after a miss counts as solved with help.
  await f.locator('.question .choice').first().click();
  await f.waitForTimeout(300);
  const firstWasWrong = (await f.locator('.question .choice.wrong').count()) > 0;
  if (firstWasWrong) {
    const rightText = (await f.locator('.question .choice.right').textContent()).trim();
    await f.getByRole('button', { name: /Try again/ }).click();
    await f.locator('.question .choice', { hasText: rightText }).first().click();
    await f.waitForTimeout(300);
  }
  const labStatus = await guestRec('status:lab-lru');
  ok(firstWasWrong ? 'a right answer after a miss counts as solved with help' : 'a right first answer counts as solved independently', labStatus === (firstWasWrong ? 'hinted' : 'independent'), String(labStatus));
  ok('LRU lab: after answering, a confidence question is offered separately', await f.getByText('How sure were you before you saw the answer?').isVisible());
  await f.getByRole('button', { name: 'I guessed' }).click();
  const selfLab = await guestRec('self:lab-lru');
  ok('confidence is stored as self-assessment', !!selfLab?.confidence && Object.values(selfLab.confidence).includes('guess'));
  await f.getByRole('button', { name: 'Another cache state' }).click();
  await f.waitForTimeout(400);
  const freshPrompt2 = await f.locator('.question h3').first().textContent();
  ok('LRU lab: “Another cache state” gives a new, unanswered problem', freshPrompt2 !== freshPrompt1 && (await f.locator('.question .choice:disabled').count()) === 0);

  // Independent case: the reference design is hidden until the learner saves an answer.
  await f.goto(`${base}/cases/case-notifications`);
  await f.getByRole('button', { name: /Independent attempt/ }).click();
  ok('independent case hides the reference design', (await f.locator('section[aria-label="Design diagram"]').count()) === 0 && await f.locator('svg.workspace').isVisible());
  ok('independent case cannot reveal before answering', await f.getByRole('button', { name: 'Save my answer and open the reference' }).isDisabled());
  await f.locator('textarea').first().fill('Ticket confirmations must arrive; promos can be dropped; at-least-once with dedup.');
  await f.getByRole('button', { name: 'Save my answer and open the reference' }).click();
  ok('after saving, the answer and the reference sit side by side', await f.getByRole('heading', { name: 'Your answer' }).isVisible() && await f.getByRole('heading', { name: 'Reference' }).isVisible());
  await f.locator('.steps-toggle').click();
  await f.locator('#steps-list button', { hasText: 'Check yourself' }).click();
  for (const area of await f.locator('.question [role=radiogroup]').all()) await area.getByRole('radio', { name: 'Strong' }).click();
  ok('rating every rubric area “Strong” does not mark the case solved', (await guestRec('status:case-notifications')) !== 'independent');
  ok('rubric ratings are stored as self-assessment', !!(await guestRec('self:case-notifications'))?.ratings);
  await ctxF.close();

  // ---------- Interview workspace persists a diagram across reloads ----------
  const ctxE = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const iv = await ctxE.newPage();
  iv.on('pageerror', (e) => errors.push(String(e)));
  await iv.goto(`${base}/interview`);
  await iv.getByRole('button', { name: 'Start' }).first().click();
  await iv.waitForURL(/\/interview\/.+/);
  await iv.getByPlaceholder(/Add a component/).fill('Booking service');
  await iv.getByRole('button', { name: 'Add', exact: true }).click();
  await iv.locator('#iv-notes').fill(`Assume 50k holds/min (${rand})`);
  await iv.waitForTimeout(300);
  await iv.reload();
  const boxKept = await iv.locator('svg.workspace text', { hasText: 'Booking service' }).count();
  const notesKept = (await iv.locator('#iv-notes').inputValue()).includes(rand);
  ok('interview diagram and notes survive a reload', boxKept === 1 && notesKept);
  await iv.goto(`${base}/interview`);
  ok('interview appears in “Your mock interviews”', await iv.getByText('Your mock interviews').isVisible());

  // ---------- Capstone loads and its surprise step is reachable ----------
  await iv.goto(`${base}/capstone/capstone`);
  for (let i = 0; i < 2; i++) { await iv.locator('.controls .btn-next').click(); await iv.waitForTimeout(400); }
  ok('capstone shows the surprise requirement at step 3', await iv.getByText('Surprise requirement').isVisible());

  ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
