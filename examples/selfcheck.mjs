// Self-check of the dock count: 0 groups, 1 group, and a group removed after a reload.
// Needs Playwright, which this repo does not ship: PLAYWRIGHT=/path/to/playwright/index.mjs node examples/selfcheck.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const here = path.dirname(new URL(import.meta.url).pathname), dir = mkdtempSync(path.join(os.tmpdir(), 'dv-check-')), v = path.join(dir, 'v.js');
const put = (groups) => writeFileSync(v, `DevPanel.config({ topic: 'self check' });\n` + groups.map((id) =>
  `DevPanel.group({ id: '${id}', label: '${id}', target: '.d-hero h1', options: [{ name: 'A' }, { name: 'B' }] });`).join('\n'));
put([]);
// a two-page copy of the demo: / and /b.html
const web = path.join(dir, 'site'); mkdirSync(web);
for (const f of ['index.html', 'b.html']) copyFileSync(path.join(here, 'demo/index.html'), path.join(web, f));
const port = 4700 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, [path.join(here, '../serve.mjs'), web, '--variants', v, '--port', String(port)], { stdio: 'ignore' });
const b = await chromium.launch();
try {
  await new Promise((r) => setTimeout(r, 800));
  const p = await b.newPage();
  const state = () => p.evaluate(() => { const s = document.querySelector('dev-panel').shadowRoot;
    return { empty: s.host.hasAttribute('data-empty'), count: s.querySelector('.od-step').hidden ? null : s.querySelector('.od-count').textContent.trim(),
      dock: !s.querySelector('.od-dock').hidden, handle: !s.querySelector('.dv-handle').hidden, md: DevPanel.markdown(), store: localStorage.getItem('devpanel') }; });
  await p.goto(`http://127.0.0.1:${port}/`); await p.waitForTimeout(400);
  let s = await state();
  assert.ok(s.empty && !s.dock && s.handle && s.count === null && s.md === '', '0 groups: no dock, no count, only the handle ' + JSON.stringify(s));
  put(['one']); await p.reload(); await p.waitForTimeout(400); s = await state();
  assert.ok(!s.empty && s.dock && s.count === '1 / 1', '1 group: "1 / 1" ' + JSON.stringify(s));
  put(['one', 'two']); await p.reload(); await p.waitForTimeout(400);
  await p.evaluate(() => { localStorage.setItem('devpanel', JSON.stringify({ ...JSON.parse(localStorage.getItem('devpanel')), picks: { two: 3 } })); });
  put(['one']); await p.reload(); await p.waitForTimeout(400); s = await state();
  assert.ok(s.count === '1 / 1' && !s.md.includes('two') && !s.store.includes('"two"'), 'removed group: gone from count, copy and store ' + JSON.stringify(s));
  // one rule for every count: pager total = Open, Open + Archived = blue groups here; a green comment-only group never counts
  writeFileSync(v, `DevPanel.group({ id: 'a', label: 'a', target: '.d-hero h1', options: [{ name: 'A' }, { name: 'B' }] });
DevPanel.group({ id: 'b', label: 'b', target: '.d-hero h1', options: [{ name: 'A' }, { name: 'B' }] });
DevPanel.group({ id: 'c', label: 'c', target: '.d-hero p' });`);
  await p.reload(); await p.waitForTimeout(400);
  const counts = () => p.evaluate(() => { const s = document.querySelector('dev-panel').shadowRoot, b = s.querySelectorAll('.od-dock .dv-arch button');
    return [s.querySelector('.od-count').textContent.trim(), b[0].textContent, b[1].textContent, s.querySelectorAll('.od-dock .k-dots button').length]; });
  assert.deepEqual(await counts(), ['1 / 2', 'Open 2', 'Archived 0', 2], 'counts agree');
  await p.evaluate(() => { localStorage.setItem('devpanel', JSON.stringify({ ...JSON.parse(localStorage.getItem('devpanel')), fin: { b: true } })); });
  await p.reload(); await p.waitForTimeout(400);
  assert.deepEqual(await counts(), ['1 / 1', 'Open 1', 'Archived 1', 1], 'counts agree after Final');
  // two pages: a group on /b.html counts and lists here, and next opens that page and lands on it
  writeFileSync(v, `DevPanel.group({ id: 'a', label: 'a', page: '/', target: '.d-hero h1', options: [{ name: 'A' }, { name: 'B' }] });
DevPanel.group({ id: 'p2', label: 'p2', page: '/b.html', target: '.d-hero h1', options: [{ name: 'A' }, { name: 'B' }] });
DevPanel.group({ id: 'c', label: 'c', target: '.d-hero p' });`);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  const rows = () => p.evaluate(() => { document.querySelector('dev-panel').shadowRoot.querySelector('.od-count').click();
    return [...document.querySelector('dev-panel').shadowRoot.querySelectorAll('.dv-row')].map((r) => r.dataset.id).join(','); });
  assert.deepEqual(await counts(), ['1 / 2', 'Open 2', 'Archived 0', 2], 'two pages: counts');
  assert.equal(await rows(), 'a,p2', 'two pages: the list matches the count');
  await p.keyboard.press('Escape'); await p.evaluate(() => DevPanel.next()); await p.waitForURL(/b\.html/); await p.waitForTimeout(800);
  assert.deepEqual((await counts())[0], '2 / 2', 'next lands on the group on /b.html');
  console.log('ok: 0 groups, 1 group, removed group, counts agree, two pages');
} finally { await b.close(); srv.kill(); rmSync(dir, { recursive: true, force: true }); }
