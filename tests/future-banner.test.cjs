const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const KEY = 'desafio-first-visit-at';
const NOW = 1800000000000;
let browser, server, url;
before(async () => {
  server = http.createServer((req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname;
    const file = path.join(process.cwd(), name === '/' ? 'index.html' : name.slice(1));
    if (!file.startsWith(process.cwd() + path.sep)) {res.writeHead(403).end(); return;}
    try {
      res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html');
      res.end(fs.readFileSync(file));
    } catch {res.writeHead(404).end();}
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless: true});
});
after(async () => {await browser?.close(); server?.close();});
async function visit(t, {saved, blocked, writeBlocked, width = 1280, reducedMotion = 'no-preference'} = {}) {
  const context = await browser.newContext({viewport: {width, height: 900}, reducedMotion});
  t.after(() => context.close());
  const page = await context.newPage();
  await page.clock.install({time: NOW});
  await page.clock.pauseAt(NOW);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'browser runtime errors'));
  await page.addInitScript(({saved, blocked, writeBlocked, KEY}) => {
    if (saved !== undefined) localStorage.setItem(KEY, saved);
    if (blocked) Object.defineProperty(window, 'localStorage', {get() {throw new Error('blocked');}});
    if (writeBlocked) Storage.prototype.setItem = () => {throw new Error('quota');};
  }, {saved, blocked, writeBlocked, KEY});
  await page.goto(url);
  return page;
}
async function value(page) {return page.locator('#future-timer').getAttribute('aria-label');}
async function advance(page, ms) {await page.clock.fastForward(ms);}
test('first visit saves immediately and appears only after 10 seconds', async t => {
  const page = await visit(t);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), KEY), String(NOW));
  assert.equal(await page.locator('#future-banner').isVisible(), false);
  await advance(page, 9999);
  assert.equal(await page.locator('#future-banner').isVisible(), false);
  await advance(page, 1);
  assert.equal(await page.locator('#future-banner').isVisible(), true);
  assert.equal(await value(page), '00:00:10');
});
test('return visit shows immediately, counts closed time, and never replays accumulated digits', async t => {
  const page = await visit(t, {saved: String(NOW - 3661000)});
  assert.equal(await page.locator('#future-banner').isVisible(), true);
  assert.equal(await value(page), '01:01:01');
  assert.equal(await page.locator('#future-timer .is-changing').count(), 0);
  await advance(page, 86400000);
  await page.reload();
  assert.equal(await value(page), '25:01:01');
});
test('invalid or future values restart and overwrite storage', async t => {
  for (const saved of ['garbage', '', ' ', 'Infinity', '-1', '0', String(NOW + 1000)]) {
    const page = await visit(t, {saved});
    assert.equal(await value(page), '00:00:00');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), KEY), String(NOW));
    assert.equal(await page.locator('#future-banner').isVisible(), false);
  }
});
test('blocked reads and writes count only the current visit', async t => {
  for (const options of [{blocked: true}, {writeBlocked: true}]) {
    const page = await visit(t, options);
    await advance(page, 61000);
    assert.equal(await value(page), '00:01:01');
    await page.reload();
    assert.equal(await value(page), '00:00:00');
  }
});
test('only changed digits roll downward, including 9 to 0 and minute rollover', async t => {
  const page = await visit(t, {saved: String(NOW - 59000)});
  assert.equal(await value(page), '00:00:59');
  await advance(page, 1000);
  assert.equal(await value(page), '00:01:00');
  assert.equal(await page.locator('.future-digit.is-changing').count(), 3);
  const last = page.locator('.future-digit').last();
  assert.equal(await last.locator('.future-counter-number').count(), 20);
  const positions = await last.evaluate(el => {
    const numbers = el.querySelectorAll('.future-counter-number');
    const old = numbers[10].getBoundingClientRect();
    const current = numbers[9].getBoundingClientRect();
    return {old: old.top, current: current.top};
  });
  assert.ok(positions.current < positions.old);
  await advance(page, 600);
  assert.equal(await page.locator('.is-changing').count(), 0);
  const visible = await last.evaluate(el => {
    const slot = el.getBoundingClientRect();
    return [...el.querySelectorAll('.future-counter-number')].find(number => {
      const row = number.getBoundingClientRect();
      return Math.abs(row.top - slot.top) < 1;
    })?.textContent;
  });
  assert.equal(visible, '0');
});
test('hours grow beyond 99, and visibility/pageshow refresh from wall clock', async t => {
  const page = await visit(t, {saved: String(NOW - 359999000)});
  assert.equal(await value(page), '99:59:59');
  await advance(page, 1000);
  assert.equal(await value(page), '100:00:00');
  assert.equal(await page.locator('.future-digit.is-changing').count(), 6);
  await page.clock.setSystemTime(NOW + 61000);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  assert.equal(await value(page), '100:01:00');
  await page.clock.setSystemTime(NOW + 121000);
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  assert.equal(await value(page), '100:02:00');
});
test('reduced motion disables transitions and digit rolling', async t => {
  const page = await visit(t, {saved: String(NOW - 9000), reducedMotion: 'reduce'});
  await advance(page, 1000);
  assert.equal(await value(page), '00:00:10');
  assert.equal(await page.locator('.is-changing').count(), 0);
  assert.equal(await page.locator('#future-banner').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
});
test('desktop/mobile layouts reserve measured space, keep anchors clear, and expose an accessible timer', async t => {
  fs.mkdirSync('tests/artifacts', {recursive: true});
  for (const width of [1280, 760, 320, 375, 390]) {
    const page = await visit(t, {width, saved: String(NOW - 360000000)});
    await advance(page, 650);
    const layout = await page.evaluate(() => {
      const bar = document.querySelector('#future-banner').getBoundingClientRect();
      const text = document.querySelector('.future-banner-message').getBoundingClientRect();
      const timer = document.querySelector('#future-timer').getBoundingClientRect();
      return {height: bar.height, padding: parseFloat(getComputedStyle(document.body).paddingTop), hero: document.querySelector('.hero').getBoundingClientRect().top,
        overflow: document.documentElement.scrollWidth > innerWidth, textRight: text.right, timerLeft: timer.left, timerRight: timer.right,
        color: getComputedStyle(document.querySelector('#future-banner')).backgroundColor};
    });
    assert.equal(layout.overflow, false);
    assert.equal(layout.color, 'rgb(185, 28, 28)');
    assert.ok(layout.textRight <= layout.timerLeft);
    assert.ok(layout.timerRight <= width);
    assert.ok(Math.abs(layout.height - layout.padding) < 1);
    assert.ok(layout.hero >= layout.height);
    assert.equal(await page.locator('#future-timer').getAttribute('role'), 'timer');
    assert.equal(await page.locator('#future-timer').getAttribute('aria-live'), 'off');
    assert.equal(await page.locator('#future-timer > [aria-hidden="true"]').count(), 1);
    await page.screenshot({path: `tests/artifacts/banner-${width}.png`, animations: 'disabled'});
    await page.locator('a[href="#desafio"]').click();
    await advance(page, 1000);
    await page.waitForTimeout(700);
    const anchorTop = await page.locator('#desafio').evaluate(el => el.getBoundingClientRect().top);
    assert.ok(anchorTop >= layout.height - 1, `anchor covered at ${width}`);
    await page.setViewportSize({width: width === 1280 ? 320 : 1280, height: 900});
    await page.waitForTimeout(100);
    const resize = await page.evaluate(() => ({height: document.querySelector('#future-banner').getBoundingClientRect().height, padding: parseFloat(getComputedStyle(document.body).paddingTop)}));
    assert.ok(Math.abs(resize.height - resize.padding) < 1);
  }
});
