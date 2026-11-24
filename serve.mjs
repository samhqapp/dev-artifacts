#!/usr/bin/env node
// Dev-only static server: serves <site dir>, injects the DevPanel overlay and your variants into every HTML page,
// and reloads the page when a file changes. Binds 127.0.0.1 only. No npm dependencies.
// Usage: node serve.mjs <site dir> [--variants file.js] [--css file.css] [--port 0] [--page /path] [--proxy /api=http://127.0.0.1:8080]
//        add --shot <out dir> [--sizes 1440x900,390x844] [--open <group>] [--each] [--scheme dark] [--run '<js>'] to take screenshots and exit.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { titlePrefix } from './title.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const bool = (name) => { const i = args.indexOf(name); return i >= 0 && !!args.splice(i, 1); };
const variants = flag('--variants'), css = flag('--css'), port = Number(flag('--port') ?? 0);
const shotDir = flag('--shot'), sizes = flag('--sizes') || '1440x900,390x844', openId = flag('--open'), page = flag('--page') || '/';
const each = bool('--each');
// --scheme dark|light shoots in that appearance; --run '<js>' sets up a page state (open a menu, pick an item) before a page shot.
const scheme = flag('--scheme'), run = flag('--run');
// --proxy /api=http://127.0.0.1:8080 forwards that path prefix to a local API, so the page gets live data.
// Extra headers (an API key, a dev token) come from DV_PROXY_HEADERS as JSON, so they never show in `ps`.
const [proxyPath, proxyTo] = (flag('--proxy') || '').split(/=(.*)/);
const proxyHeaders = JSON.parse(process.env.DV_PROXY_HEADERS || '{}');
const root = path.resolve(args[0] || '.');
if (!fs.statSync(root, { throwIfNoEntry: false })?.isDirectory()) { console.error(`Not a folder: ${root}`); process.exit(1); }
const own = path.dirname(fileURLToPath(import.meta.url));
const PREFIX = titlePrefix(); // '<project> > <Orca tab>', or the repo folder name

const DEV = {
  '/__dev/devpanel.js': path.join(own, 'devpanel.js'),
  ...(variants && { '/__dev/variants.js': path.resolve(variants) }),
  ...(css && { '/__dev/variants.css': path.resolve(css) }),
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8' };

const INJECT = [
  css && '<link rel="stylesheet" href="/__dev/variants.css">',
  '<script src="/__dev/devpanel.js"></script>',
  variants && '<script src="/__dev/variants.js"></script>',
  // polling, not SSE: an open stream never lets headless screenshots finish loading
  '<script>(v=>setInterval(()=>fetch("/__dev/version").then(r=>r.text()).then(n=>{if(v===undefined)v=n;else if(n!==v)location.reload()}).catch(()=>{}),800))()</script>',
].filter(Boolean).join('\n');

let version = Date.now();
const reload = () => { version = Date.now(); };
if (!shotDir) { // shot mode never reloads, so writing shots inside the site can't restart a page mid-shot
  fs.watch(root, { recursive: true }, reload);
  for (const f of Object.values(DEV)) fs.watch(f, reload);
}

function file(p) {
  const st = fs.statSync(p, { throwIfNoEntry: false });
  if (st?.isDirectory()) return file(path.join(p, 'index.html'));
  return st?.isFile() ? p : null;
}

const server = http.createServer((req, res) => { try { handle(req, res); } catch { if (!res.headersSent) res.writeHead(500); res.end(); } })
.listen(port, '127.0.0.1', function () {
  const url = `http://127.0.0.1:${this.address().port}${page}`;
  if (!shotDir) return console.log(`Dev artifacts: ${url}  (serving ${root})`);
  shoot(url).then(() => process.exit(0), (e) => { console.error(`Shot failed: ${e.message}`); process.exit(1); });
});

function handle(req, res) {
  // Only local Host names, so a DNS-rebinding page can't read files through this server.
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(req.headers.host || '')) { res.writeHead(403).end(); return; }
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  if (url.includes('\0') || url.split('/').some(s => s.startsWith('.') && s.length > 0)) { res.writeHead(404).end(); return; } // no .git, .env
  if (proxyTo && url.startsWith(proxyPath)) {
    const up = http.request(new URL(req.url, proxyTo), { method: req.method, headers: { ...req.headers, host: new URL(proxyTo).host, ...proxyHeaders } },
      (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(up);
    return;
  }
  if (url === '/__dev/version') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end(String(version)); return; }
  const abs = DEV[url] || path.join(root, url);
  if (!DEV[url] && abs !== root && !abs.startsWith(root + path.sep)) { res.writeHead(403).end(); return; } // no ../ escapes
  // a folder without its trailing slash: redirect, so the page's relative images and CSS resolve
  if (!DEV[url] && !url.endsWith('/') && fs.statSync(abs, { throwIfNoEntry: false })?.isDirectory()) {
    const u = new URL(req.url, 'http://x'); res.writeHead(301, { Location: u.pathname + '/' + u.search }).end(); return;
  }
  const p = file(abs);
  if (!p) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404'); return; }
  const type = TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream';
  let body = fs.readFileSync(p);
  if (url === '/__dev/devpanel.js') body = `window.__dvTitlePrefix=${JSON.stringify(PREFIX)};\n` + body; // the overlay's tab title
  // a kit page (options.mjs) has its own dock, so it gets no overlay
  if (type.startsWith('text/html') && !/<main[^>]*\bdata-kit\b/.test(body.toString('utf8'))) {
    const html = body.toString('utf8'), at = html.toLowerCase().lastIndexOf('</body>');
    body = at < 0 ? html + INJECT : html.slice(0, at) + INJECT + '\n' + html.slice(at);
  }
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
}

// ---- --shot: headless Chrome over the DevTools protocol (Node 22's built-in WebSocket) ----

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const found = [];
  const pwRoots = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(os.homedir(), 'Library/Caches/ms-playwright'), path.join(os.homedir(), '.cache/ms-playwright')];
  for (const pw of pwRoots.filter((p) => p && fs.existsSync(p))) {
    for (const d of fs.readdirSync(pw, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith('chromium_headless_shell-')))
      for (const sub of fs.readdirSync(path.join(pw, d.name)))
        found.push([+d.name.split('-')[1], path.join(pw, d.name, sub, 'chrome-headless-shell')]);
  }
  return [...found.sort((a, b) => b[0] - a[0]).map((f) => f[1]),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';

async function shoot(base) {
  const bin = findChrome();
  if (!bin) throw new Error('no Chrome found: set CHROME_PATH, or install a Playwright chromium_headless_shell');
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-chrome-'));
  const chrome = spawn(bin, ['--headless', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run',
    '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    const wsUrl = await new Promise((ok, no) => {
      let log = '';
      chrome.stderr.on('data', (d) => { log += d; const m = log.match(/ws:\/\/\S+/); if (m) ok(m[0]); });
      chrome.on('exit', () => no(new Error('Chrome exited: ' + log.slice(-300))));
      setTimeout(() => no(new Error('Chrome did not start in 15 s')), 15000);
    });
    const ws = new WebSocket(wsUrl);
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('DevTools socket failed')); });
    let seq = 0; const waiting = new Map();
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data), w = d.id && waiting.get(d.id);
      if (w) { waiting.delete(d.id); d.error ? w.no(new Error(d.error.message)) : w.ok(d.result); }
    };
    let session;
    const send = (method, params = {}) => new Promise((ok, no) => {
      const id = ++seq; waiting.set(id, { ok, no });
      ws.send(JSON.stringify({ id, method, params, sessionId: session }));
    });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    ({ sessionId: session } = await send('Target.attachToTarget', { targetId, flatten: true }));
    const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
    const load = async (query) => {
      await send('Page.navigate', { url: base + (query ? '?' + query : '') });
      for (let t = 0; t < 200 && (await evaluate('document.readyState')) !== 'complete'; t++) await sleep(50);
      await evaluate('document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))');
    };
    const center = (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: 'center', behavior: 'instant' })`);
    const files = [];
    const snap = async (name) => {
      await sleep(350); // badge fade and popover open animation
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const out = path.join(path.resolve(shotDir), name + '.png');
      fs.writeFileSync(out, Buffer.from(data, 'base64'));
      files.push(out);
    };

    fs.mkdirSync(shotDir, { recursive: true });
    // Reduced motion, so entrance animations don't leave parts of the page faded or missing in the shots.
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' },
      ...(scheme ? [{ name: 'prefers-color-scheme', value: scheme }] : [])] });
    for (const size of sizes.split(',')) {
      const [w, h] = size.split('x').map(Number);
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
      await load('');
      const groups = (await evaluate('window.DevPanel ? DevPanel.groups() : []')).filter((g) => !openId || g.id === openId);
      if (openId && !groups.length) throw new Error(`no group "${openId}" (is --variants set?)`);
      const xs = await evaluate('document.documentElement.scrollWidth - innerWidth');
      if (xs > 0) console.log(`X scroll at ${size}: the page is ${xs} px wider than the window`);
      if (each) {
        for (const g of groups) for (let i = 1; i <= g.options.length; i++) {
          await load(`dv-clean=1&dv-pick=${encodeURIComponent(g.id)}:${i}`);
          await center(g.target);
          await snap(`${g.id}-${i}-${slug(g.options[i - 1])}-${scheme ? scheme + '-' : ''}${size}`);
        }
      } else if (openId) {
        await center(groups[0].target);
        await evaluate(`DevPanel.open(${JSON.stringify(openId)})`);
        await snap(`${openId}-open-${size}`);
      } else {
        if (run) { await evaluate(run); await sleep(400); }
        await snap(`page-${scheme ? scheme + '-' : ''}${size}`);
      }
    }
    console.log(files.join('\n'));
    session = undefined;
    await send('Browser.close').catch(() => {});
  } finally {
    chrome.kill();
    server.close();
    await sleep(200);
    fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3 });
  }
}
