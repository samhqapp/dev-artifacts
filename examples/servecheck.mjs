// Self-check of serve.mjs with no browser and no packages: node examples/servecheck.mjs
// 1. Live reload: 20 writes of a page in 3 s move the version once, and only after the writes stop.
//    Without the debounce in serve.mjs the version moves on almost every write and this fails.
// 2. Title: a page may name itself '<tab title> · <short name>'; any other change is rejected or replaced.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { tabTitle, titleOk } from '../title.mjs';

const tab = tabTitle();
assert.ok(titleOk(tab, tab), 'the bare tab title passes');
assert.ok(titleOk(`${tab} · A1`, tab), 'a short name after " · " passes');
for (const bad of [`${tab} · `, `${tab} - A1`, `${tab} A1`, `${tab} ·  A1`, `${tab} · A · B`, `x ${tab} · A1`, `${tab} · ${'x'.repeat(41)}`])
  assert.ok(!titleOk(bad, tab), `rejected: "${bad}"`);

const here = path.dirname(new URL(import.meta.url).pathname), dir = mkdtempSync(path.join(os.tmpdir(), 'dv-serve-'));
const page = (title) => `<title>${title}</title>\n<main class="k-wrap" data-kit><section class="k-part"><p>x</p></section></main>\n`;
writeFileSync(path.join(dir, 'index.html'), page(`${tab} · A1`));
writeFileSync(path.join(dir, 'b.html'), page(`${tab} - A1`));
const srv = spawn(process.execPath, [path.join(here, '../serve.mjs'), dir, '--port', '0'], { stdio: ['ignore', 'pipe', 'inherit'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const base = await new Promise((ok, no) => { srv.stdout.on('data', (d) => { const m = String(d).match(/http:\/\/127\.0\.0\.1:\d+/); if (m) ok(m[0]); }); srv.on('exit', no); });
  const get = (p) => fetch(base + p).then((r) => r.text());
  const shown = (html) => html.match(/<title>([^<]*)<\/title>/)[1].replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  assert.equal(shown(await get('/')), `${tab} · A1`, 'serve.mjs keeps a page title with a short name');
  assert.equal(shown(await get('/b.html')), tab, 'serve.mjs replaces any other page title');

  const seen = [await get('/__dev/version')];
  let writing = true, stop = Infinity, burstEnd;
  const poll = (async () => { while (writing || Date.now() < stop) { const v = await get('/__dev/version'); if (v !== seen.at(-1)) seen.push(v); await sleep(100); } })();
  for (let i = 0; i < 20; i++) { writeFileSync(path.join(dir, 'index.html'), page(`${tab} · A1`) + `<!-- ${i} -->`); await sleep(150); }
  burstEnd = seen.length; writing = false; stop = Date.now() + 2500;
  await poll;
  assert.equal(burstEnd, 1, `the version moved ${burstEnd - 1} times during the burst; it must wait until the writes stop`);
  assert.equal(seen.length - 1, 1, `20 writes in 3 s moved the version ${seen.length - 1} times; expected 1`);
  console.log('servecheck: ok (1 reload for 20 writes in 3 s; title suffix kept, other titles replaced)');
} finally { srv.kill(); rmSync(dir, { recursive: true, force: true }); }
