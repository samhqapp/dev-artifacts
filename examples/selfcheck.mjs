// Self-check of the dock count: 0 groups, 1 group, and a group removed after a reload.
// Needs Playwright, which this repo does not ship: PLAYWRIGHT=/path/to/playwright/index.mjs node examples/selfcheck.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { tabTitle } from '../title.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const here = path.dirname(new URL(import.meta.url).pathname), dir = mkdtempSync(path.join(os.tmpdir(), 'dv-check-')), v = path.join(dir, 'v.js');
const put = (groups) => writeFileSync(v, groups.map((id) =>
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
  assert.equal(await p.title(), tabTitle(), 'the tab title is exactly orca-title, nothing after it');
  put(['one']); await p.reload(); await p.waitForTimeout(400); s = await state();
  assert.ok(!s.empty && s.dock && s.count === '1 / 1', '1 group: "1 / 1" ' + JSON.stringify(s));
  put(['one', 'two']); await p.reload(); await p.waitForTimeout(400);
  await p.evaluate(() => { localStorage.setItem('devpanel', JSON.stringify({ ...JSON.parse(localStorage.getItem('devpanel')), picks: { two: 3 } })); });
  put(['one']); await p.reload(); await p.waitForTimeout(400); s = await state();
  assert.ok(s.count === '1 / 1' && !s.md.includes('two') && !JSON.parse(s.store).picks.two, 'removed group: gone from count, copy and live picks ' + JSON.stringify(s));
  // one rule for every count: pager total = Open, Open + Archived = blue groups here; a green comment-only group never counts
  writeFileSync(v, `DevPanel.group({ id: 'a', label: 'a', target: '.d-hero h1', options: [{ name: 'A' }, { name: 'B' }] });
DevPanel.group({ id: 'b', label: 'b', target: '.d-hero h1', options: [{ name: 'A' }, { name: 'B' }] });
DevPanel.group({ id: 'c', label: 'c', target: '.d-hero p' });`);
  await p.reload(); await p.waitForTimeout(400);
  const counts = () => p.evaluate(() => { const s = document.querySelector('dev-panel').shadowRoot, b = s.querySelectorAll('.od-dock .dv-arch button');
    return [s.querySelector('.od-count').textContent.trim(), b[0].textContent, b[1].textContent, s.querySelectorAll('.od-dock .k-dots button').length]; });
  assert.deepEqual(await counts(), ['1 / 2', 'Open 2', 'Archived 1', 2], 'counts agree (removed "two" had a pick: 1 old item)');
  await p.evaluate(() => { localStorage.setItem('devpanel', JSON.stringify({ ...JSON.parse(localStorage.getItem('devpanel')), fin: { b: true } })); });
  await p.reload(); await p.waitForTimeout(400);
  assert.deepEqual(await counts(), ['1 / 1', 'Open 1', 'Archived 2', 1], 'counts agree after Final');
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
  // arrows change the pick, comments save at once, the list scrolls only past 70%, rounds reset and restore
  const opts = (names) => '[' + names.map((n) => `{ name: '${n}' }`).join(', ') + ']', ABC = ['A', 'B', 'C', 'D', 'E', 'F'];
  const big = Array.from({ length: 40 }, (_, i) => 'Option ' + (i + 1));
  const put2 = (m) => writeFileSync(v, `DevPanel.group({ id: 'm', label: 'm', target: '.d-hero h1', options: ${opts(m)} });
DevPanel.group({ id: 'big', label: 'big', target: '.d-hero p', kind: 'select', options: ${opts(big)} });`);
  put2(ABC); await p.goto(`http://127.0.0.1:${port}/`); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  // Playwright's CSS locators reach into the open shadow root
  const ev = (fn) => p.evaluate(fn), L = (s) => p.locator(s).first(), js = (s, fn) => L(s).evaluate(fn);
  const store = () => ev(() => JSON.parse(localStorage.getItem('devpanel') || '{}'));
  const M = '.od-dock .dv-g[data-id="m"] ';
  assert.equal(await p.locator('.od-dock .dv-g').count(), 2, 'the dock shows every group at once');
  await js(M + '.dv-o[data-i="1"]', (e) => e.focus());
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  assert.equal(await ev(() => document.documentElement.getAttribute('data-dv-m')), '3', 'dock arrows apply the pick');
  assert.equal((await store()).picks.m, 3, 'dock arrows save the pick');
  assert.equal(await p.locator(M + '.dv-o:not(.dv-moreo)').count(), 3, 'three options inline, the rest behind "…"');
  await js(M + '.dv-moreo', (e) => e.click()); await p.waitForTimeout(300);
  await p.keyboard.press('ArrowDown');
  assert.equal(await ev(() => document.documentElement.getAttribute('data-dv-m')), '4', 'popover arrows apply the pick');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  assert.equal(await js('.od-pop', (e) => e.classList.contains('od-show')), false, 'Enter closes the popover');
  assert.match(await L(M + '.dv-moreo').textContent(), /^C/, '"…" carries a pick past the inline ones (4 = C after Current)');
  // instant save: type, reload at once
  await js(M + '.dv-lab', (e) => e.click()); await p.waitForTimeout(250);
  await js('.od-body textarea', (e) => e.focus()); await p.keyboard.type('keep me');
  await p.reload(); await p.waitForTimeout(400);
  assert.equal((await store()).notes.m, 'keep me', 'the comment survives an instant reload');
  // 70%: a 40-option list stops at 70% of the window and scrolls, with the pick in view
  await ev(() => localStorage.setItem('devpanel', JSON.stringify({ ...JSON.parse(localStorage.getItem('devpanel')), picks: { ...JSON.parse(localStorage.getItem('devpanel')).picks, big: 35 } })));
  await p.reload(); await p.waitForTimeout(400); await ev(() => DevPanel.open('big')); await p.waitForTimeout(500);
  const h = await js('.od-pop', (pop) => { const b = pop.querySelector('.od-body'), o = b.querySelector('[data-i="35"]').getBoundingClientRect(), bb = b.getBoundingClientRect();
    return { pop: pop.offsetHeight, vh: innerHeight, scrolls: b.scrollHeight > b.clientHeight, inView: o.top >= bb.top - 1 && o.bottom <= bb.bottom + 1 }; });
  assert.ok(h.pop <= h.vh * 0.7 + 1 && h.scrolls && h.inView, 'popover stops at 70% and shows the pick ' + JSON.stringify(h));
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  // overall comment: typed in row 1, saved at once, first in Copy choices; and the dock never moves the page
  const spot = () => ev(() => { const r = document.querySelector('.d-hero h1').getBoundingClientRect(); return Math.round((r.top + scrollY) * 10) / 10; });
  const y0 = await spot();
  await js('.od-dock .dv-overall', (e) => e.focus()); await p.keyboard.type('Whole page looks good'); await p.keyboard.press('Shift+Enter'); await p.keyboard.type('but tighter');
  await L(M + '.dv-o[data-i="2"]').hover(); await p.waitForTimeout(200); await L('.od-dock .dv-g[data-id="big"] .dv-lab').hover();
  await ev(() => DevPanel.open('big')); await p.waitForTimeout(400); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.mouse.move(5, 5); await p.waitForTimeout(300);
  assert.equal(await spot(), y0, 'typing, hover and the popover move the page by 0 px');
  const md = await ev(() => DevPanel.markdown());
  assert.ok(md.startsWith('- Overall: Whole page looks good\n  but tighter\n- m'), 'Copy choices puts the overall comment first ' + JSON.stringify(md));
  assert.equal((await store()).overall, 'Whole page looks good\nbut tighter', 'the overall comment saves at once');
  // rounds: m's options change, big's do not; m's old pick and comment go to Archived with no notice
  put2(['A', 'B', 'C', 'D', 'E', 'G']); await p.reload(); await p.waitForTimeout(400);
  let st = await store();
  assert.ok(!st.picks.m && !st.notes.m && st.old.length === 1 && st.old[0].pick === 'C' && st.old[0].note === 'keep me' && st.picks.big === 35,
    'a changed group starts fresh, its old items go to Archived, others keep theirs ' + JSON.stringify(st));
  assert.ok(await L('.od-dock .dv-say').evaluate((e) => e.hidden), 'no notice bar on a new round');
  assert.equal(await L('.od-dock .dv-arch button:last-child').textContent(), 'Archived 1', 'Archived counts the old-round item');
  await js('.od-dock .dv-arch button:last-child', (e) => e.click()); await p.waitForTimeout(200);
  assert.match(await L('.od-dock .dv-oldt').textContent(), /C - keep me/, 'the archived item shows its old text');
  await js('.od-dock .dv-unarch', (e) => e.click()); await p.waitForTimeout(200);
  st = await store();
  assert.ok(st.picks.m === 4 && st.notes.m === 'keep me' && !st.old.length, 'Unarchive brings it back ' + JSON.stringify(st));
  // a removed group with a pick: its old item goes to Archived
  writeFileSync(v, `DevPanel.group({ id: 'big', label: 'big', target: '.d-hero p', kind: 'select', options: ${opts(big)} });`);
  await p.reload(); await p.waitForTimeout(400);
  st = await store();
  assert.ok(st.old.length === 1 && st.old[0].id === 'm', 'a removed group goes to Archived ' + JSON.stringify(st));
  assert.equal(await p.locator('.od-dot.od-plain:visible').count(), 0, 'no blue dots on the page');
  // row 1 still: 20 fast clicks on next, then Clear, never move the arrows, eye, Clear, Open/Archived, or Copy
  await p.evaluate(() => { for (let i = 1; i <= 9; i++) DevPanel.group({ id: 'extra-' + i, label: 'Extra group ' + i, target: '.d-hero h1', options: [{ name: 'Tight' }, { name: 'Loose' }] }); });
  await p.waitForTimeout(300);
  const row1 = () => p.evaluate(() => { const s = document.querySelector('dev-panel').shadowRoot, q = (x) => { const e = s.querySelector(x); if (!e || !e.offsetParent) return null;
    const r = e.getBoundingClientRect(); return [r.x, r.y, r.width].map(Math.round).join(','); };
    return { next: q('.od-step > :last-child'), back: q('.od-step > :first-child'), eye: q('.dv-eye'), clear: q('.dv-clear'), arch: q('.dv-arch'), copy: q('.od-primary') }; });
  const first = await row1();
  for (const k of ['next', 'back', 'eye', 'clear', 'arch', 'copy']) assert.ok(first[k], 'row 1 shows ' + k);
  for (let i = 0; i < 20; i++) {
    await js('.od-dock .od-step > :last-child', (e) => e.click()); await p.waitForTimeout(30);
    assert.deepEqual(await row1(), first, 'row 1 moved after next click ' + (i + 1));
  }
  await js('.od-dock .dv-clear', (e) => e.click()); await p.waitForTimeout(100);
  const after = await row1();
  for (const k of ['next', 'eye', 'arch', 'copy']) assert.equal(after[k], first[k], 'Clear all? moved ' + k);
  console.log('ok: tab title, 0 groups, 1 group, removed group, counts agree, two pages, all groups in the dock, arrows pick, instant save, 70% list, overall first, 0 px shift, rounds to Archived, no blue dots, row 1 still');
} finally { await b.close(); srv.kill(); rmSync(dir, { recursive: true, force: true }); }
