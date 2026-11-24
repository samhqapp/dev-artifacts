// Self-check of the dock count: 0 groups, 1 group, and a group removed after a reload.
// Needs Playwright, which this repo does not ship: PLAYWRIGHT=/path/to/playwright/index.mjs node examples/selfcheck.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const here = path.dirname(new URL(import.meta.url).pathname), dir = mkdtempSync(path.join(os.tmpdir(), 'dv-check-')), v = path.join(dir, 'v.js');
const put = (groups) => writeFileSync(v, `DevPanel.config({ topic: 'self check' });\n` + groups.map((id) =>
  `DevPanel.group({ id: '${id}', label: '${id}', target: '.d-hero h1', options: [{ name: 'A' }, { name: 'B' }] });`).join('\n'));
put([]);
const port = 4700 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, [path.join(here, '../serve.mjs'), path.join(here, 'demo'), '--variants', v, '--port', String(port)], { stdio: 'ignore' });
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
  console.log('ok: 0 groups, 1 group, removed group');
} finally { await b.close(); srv.kill(); rmSync(dir, { recursive: true, force: true }); }
