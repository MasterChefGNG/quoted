// End-to-end walk through every screen on a phone-sized Chrome, with screenshots.
// Run from quoted-web: node test/e2e.mjs [screenshot folder]
// Uses the installed Google Chrome (playwright-core downloads no browser).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const PORT = 8123;
const URL_ROOT = `http://localhost:${PORT}/`;
const shots = process.argv[2] ?? 'test/screenshots';
mkdirSync(shots, { recursive: true });

const server = spawn(process.execPath, ['tools/serve.mjs', String(PORT)], { stdio: 'pipe' });
await new Promise((resolve) => server.stdout.once('data', resolve));

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

let n = 0;
const shot = async (name) => { n += 1; await page.waitForTimeout(350); await page.screenshot({ path: `${shots}/${String(n).padStart(2, '0')}-${name}.png` }); };
// Big buttons are upper-cased by CSS, so match names without caring about case.
const button = (name) => page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') });
const tapText = (text) => page.getByText(text, { exact: true }).first().click();

try {
  await page.goto(URL_ROOT);
  await page.waitForSelector('.brand');
  await shot('home');
  assert.ok(await page.getByText('Add quoted to your home screen').isVisible(), 'install hint shows in the browser');
  await button('Got it').click();

  // Swipe pages
  await page.evaluate(() => { document.querySelector('.pager').scrollLeft = 390; });
  await shot('home-page-2');
  await page.evaluate(() => { document.querySelector('.pager').scrollLeft = 0; });

  // ----- Fill in the blanks: setup sheet, then answer wrong via the keyboard path -----
  await tapText('Fill in the blanks');
  await shot('setup-sheet');
  await button('Act 3').click();
  await button('5').click();
  await shot('setup-filtered');
  await button('START').click();
  for (let i = 0; i < 5; i++) {
    await page.waitForSelector('input.blank');
    const blanks = page.locator('input.blank');
    const count = await blanks.count();
    if (i === 0) await shot('fill-blanks-typing');
    for (let b = 0; b < count; b++) {
      await blanks.nth(b).fill(b === 0 ? 'zzz' : '');
      await blanks.nth(b).press('Enter');
    }
    await page.waitForSelector('.feedback');
    if (i === 0) await shot('fill-blanks-feedback');
    await button('CONTINUE').click();
  }
  await page.waitForSelector('.summary-top');
  await shot('summary');
  assert.ok(await page.getByText('TO WORK ON').isVisible());

  // ----- Retry the wrong ones in the same mode, then stop with the close button -----
  await button('RETRY THE WRONG ONES').click();
  await page.waitForSelector('input.blank');
  await button('Stop session').click();
  await shot('stop-dialog');
  await button('Stop').click();
  await page.waitForSelector('.brand');
  await shot('home-with-weak');
  const weakText = await page.locator('.bottom-bar .big-button').innerText();
  assert.match(weakText, /PRACTISE WEAK QUOTES/);

  // ----- Weak quotes, Type the full quote -----
  await page.locator('.bottom-bar .big-button').click();
  await shot('weak-mode-picker');
  await page.locator('.sheet').getByText('Type the full quote', { exact: true }).click();
  await page.waitForSelector('textarea.answer');
  await shot('type-full-typing');
  await page.locator('textarea.answer').fill('something is rotten in the state of denmark');
  await page.locator('textarea.answer').blur();
  await page.waitForTimeout(150);
  await button('CHECK').click();
  await page.waitForSelector('.feedback');
  await shot('type-full-feedback');
  await button('CONTINUE').click();
  await page.waitForTimeout(200);
  // Browser back during a test asks first
  await page.goBack();
  await page.waitForSelector('.dialog');
  await button('Stop').click();
  await page.waitForSelector('.brand');

  // ----- Flashcards -----
  await tapText('Flashcards');
  await button('5').click();
  await button('START').click();
  await page.waitForSelector('.flashcard');
  await shot('flashcard-front');
  for (let i = 0; i < 5; i++) {
    await page.locator('.flashcard').click();
    if (i === 0) await shot('flashcard-back');
    // A double tap must only mark one card (not on the last, where the 2nd tap would land on Done).
    if (i < 4) await button('GOT IT').dblclick(); else await button('GOT IT').click();
    await page.waitForTimeout(100);
  }
  await page.waitForSelector('.summary-top');
  await shot('flash-summary');
  assert.equal(await page.locator('.summary-top .hero').innerText(), '5 of 5');
  await button('DONE').click();

  // ----- Learn -----
  await tapText('Learn quotes');
  await shot('learn-setup');
  await button('START').click();
  await page.waitForSelector('.fading-quote');
  await shot('learn-step-0');
  await button('HIDE MORE').click();
  await shot('learn-step-1');
  while (await button('HIDE MORE').count()) await button('HIDE MORE').click();
  await page.locator('.gap').first().click();
  await shot('learn-all-hidden-peek');
  for (let i = 0; i < 5; i++) {
    while (await button('HIDE MORE').count()) await button('HIDE MORE').click();
    const next = (await button('FINISH').count()) ? 'FINISH' : 'I KNOW IT';
    await button(next).click();
  }
  await page.waitForSelector('.done-middle');
  await shot('learn-done');
  await button('TEST ME ON THESE').click();
  await page.waitForSelector('input.blank');
  await button('Stop session').click();
  await button('Stop').click();

  // Streak badge lit after finishing sessions
  await page.waitForSelector('.streak.done');
  await shot('home-streak');

  // ----- All quotes + filters -----
  await button('All quotes').click();
  await button('Filter').click();
  await button('Ophelia').click();
  await shot('list-filtered');
  assert.equal(await page.locator('.quote-card').count(), 3);
  await page.goBack();
  await page.waitForSelector('.brand');

  // ----- Settings, reset -----
  await button('Settings').click();
  await shot('settings');
  await button('RESET PROGRESS').click();
  await button('Reset').click();
  await page.waitForSelector('.brand');
  assert.match(await page.locator('.bottom-bar .big-button').innerText(), /NO WEAK QUOTES/);

  // ----- Progress survives a reload, and the app works offline -----
  await tapText('Flashcards');
  await button('5').click();
  await button('START').click();
  await page.locator('.flashcard').click();
  await button('MISSED IT').click();
  await page.reload();
  await page.waitForSelector('.brand');
  assert.match(await page.locator('.bottom-bar .big-button').innerText(), /PRACTISE WEAK QUOTES\s*1/);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('.brand');
  await context.setOffline(false);

  assert.deepEqual(errors, []);
  console.log(`E2E passed, ${n} screenshots in ${shots}`);
} catch (error) {
  await page.screenshot({ path: `${shots}/FAILED.png` });
  console.error('E2E failed:', error.message, errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
