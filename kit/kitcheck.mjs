#!/usr/bin/env node
// kitcheck: render a kit page at 1440 and 390 wide, Light and Dark, with every detail row open, and fail on layout defects:
// a card closer than 12 px to content above or below it, card content closer than 14 px to the card edge,
// sideways overflow, and clipped text. Saves one full-page screenshot per mode. Also fails on:
// 7 a focus ring (outline) on keyboard focus, 8 an image cut by object-fit cover/none or a clipping parent,
// 9 a border on only 2 or 3 sides or with uneven widths, 10 the last content ending less than 12 px above the dock.
// Fixtures: kitcheck-fixtures/<check>-fail.html exits 1, <check>-pass.html exits 0.
// Usage: node kitcheck.mjs <page.html> [--out <dir>]   Exit: 0 clean, 1 offenders, 2 could not run.
// No npm packages: it drives Playwright's headless shell (or Chrome) over the DevTools protocol with Node's own WebSocket.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { spawn } from 'node:child_process';

const KIT = path.dirname(new URL(import.meta.url).pathname);
const argv = process.argv.slice(2), outAt = argv.indexOf('--out');
const pagePath = path.resolve(argv.find((a, i) => !a.startsWith('--') && (outAt < 0 || i !== outAt + 1)) || '');
if (!pagePath.endsWith('.html') || !fs.existsSync(pagePath)) { console.error('usage: node kitcheck.mjs <page.html> [--out <dir>]'); process.exit(2); }
// Title rule: exactly the tab title from ../title.mjs, so the reader knows which chat to paste choices into. Kit pages are "Kit > ...".
{
  const title = (fs.readFileSync(pagePath, 'utf8').match(/<title>([^<]*)<\/title>/i) || [])[1]?.trim() || '';
  const want = (await import('../title.mjs')).tabTitle();
  if (!title.startsWith('Kit > ') && title !== want) {
    console.error(`kitcheck: <title> is "${title}"; it must be exactly "${want}"`); process.exit(1);
  }
}
const out = path.resolve(outAt >= 0 ? argv[outAt + 1] : path.join(process.env.TMPDIR || os.tmpdir(), 'kitcheck', path.basename(pagePath, '.html')));
fs.mkdirSync(out, { recursive: true });

// Serve the page folder. kit.css and kit.js come from beside the page, or from this kit when the page folder has none.
const root = path.dirname(pagePath);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, s) => {
  const rel = decodeURIComponent(new URL(q.url, 'http://x').pathname).slice(1);
  let f = path.join(root, rel);
  if (!f.startsWith(root + path.sep)) { s.writeHead(403); return s.end(); }
  if (!fs.existsSync(f) && /^kit\.(css|js)$/.test(rel)) f = path.join(KIT, rel);
  fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/${encodeURIComponent(path.basename(pagePath))}`;

// Browser: Chrome in headless mode, else the newest Playwright headless shell. Neither shows a window.
const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), 'Library/Caches/ms-playwright');
const shells = fs.existsSync(pw) ? fs.readdirSync(pw).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse()
  .map(d => path.join(pw, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell')).filter(fs.existsSync) : [];
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Chrome first: headless shell 1248 stalls on the page step on this Mac (2026-11-22), headless Chrome does not.
const bin = fs.existsSync(chrome) ? chrome : shells[0];
if (!fs.existsSync(bin)) { console.error('kitcheck: no headless shell in ' + pw + ' and no Chrome'); process.exit(2); }
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'kitcheck-prof-'));
const ch = spawn(bin, [...(bin === chrome ? ['--headless=new'] : []), '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const done = code => { srv.close(); const end = () => { fs.rmSync(prof, { recursive: true, force: true }); process.exit(code); };
  if (ch.exitCode !== null || ch.signalCode) end(); else { ch.once('exit', end); ch.kill('SIGKILL'); } };
setTimeout(() => { console.error('kitcheck: timed out after 120 s'); done(2); }, 120000).unref();
const port = await new Promise((r, j) => { let buf = ''; ch.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on ws:\/\/[^:]+:(\d+)/); if (m) r(m[1]); }); ch.on('exit', () => j(new Error('browser exited'))); })
  .catch(e => { console.error('kitcheck: ' + e.message); done(2); });
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0; const wait = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); const w = d.id && wait.get(d.id); if (w) { wait.delete(d.id); d.error ? w[1](new Error(d.error.message)) : w[0](d.result); } };
const cmd = (method, params = {}) => new Promise((r, j) => { wait.set(++seq, [r, j]); ws.send(JSON.stringify({ id: seq, method, params })); });
const run = async fn => { const r = await cmd('Runtime.evaluate', { expression: `(${fn})()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Animation Off for this page, so nothing is mid-transition when it is measured.
await cmd('Page.enable');
await cmd('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('kit-anim:'+location.pathname,'off')}catch(e){}" });

// Runs in the page: open every detail row, then measure.
function prep() {
  return (async () => {
    for (let i = 0; i < 100 && !(document.readyState === 'complete' && (!document.querySelector('[data-kit]') || document.documentElement.classList.contains('k-ready'))); i++) await new Promise(r => setTimeout(r, 50));
    if (window.Kit && Kit.view) Kit.view('page');
    document.querySelectorAll('.k-row').forEach(r => { if (r.querySelector('.k-detail')) r.classList.add('k-open'); });
    document.querySelectorAll('details').forEach(d => { d.open = true; });
    // A lazy image below the fold never loads, so its decode() never settles: load every image now.
    await Promise.all([...document.images].map(i => { i.loading = 'eager'; return i.decode().catch(() => {}); }));
    await document.fonts.ready;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return document.documentElement.scrollHeight;
  })();
}
function check() {
  const GAP = 12, PAD = 14, vw = document.documentElement.clientWidth, bad = [];
  const cs = e => getComputedStyle(e);
  const fixed = e => { for (; e && e !== document.documentElement; e = e.parentElement) if (cs(e).position === 'fixed') return true; return false; };
  const alpha = c => { if (!c || c === 'transparent') return 0; const m = c.match(/\/\s*([\d.]+%?)\)$/) || c.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/); return m ? parseFloat(m[1]) / (m[1].endsWith('%') ? 100 : 1) : 1; };
  const name = e => { const p = e.closest('[data-part]'), t = (e.textContent || e.getAttribute('alt') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${e.tagName.toLowerCase()}${[...e.classList].map(c => '.' + c).join('')}${t ? ` "${t}"` : ''}${p && p !== e ? ` in part "${p.dataset.part}"` : ''}`; };
  const isCard = e => { const s = cs(e), r = e.getBoundingClientRect();
    if (r.width < 60 || r.height < 36 || s.visibility === 'hidden') return false;
    if (['IMG', 'PICTURE', 'VIDEO', 'CANVAS', 'svg'].includes(e.tagName)) return !e.parentElement.closest('[data-card]');
    const rad = Math.max(...['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].map(k => parseFloat(s[`border${k}Radius`]) || 0));
    return rad >= 8 && (alpha(s.backgroundColor) > 0 || s.boxShadow !== 'none' || (parseFloat(s.borderTopWidth) > 0 && alpha(s.borderTopColor) > 0)); };
  // A mockup screen (.k-screen) draws a real product at its own spacing, so the card rules skip its inside.
  const all = [...document.body.querySelectorAll('*')].filter(e => !fixed(e) && !e.closest('.k-screen') && e.getClientRects().length);
  all.forEach(e => { if (isCard(e)) e.dataset.card = ''; });
  const cards = all.filter(e => e.hasAttribute('data-card'));
  const scrolls = e => /auto|scroll/.test(cs(e).overflowX + cs(e).overflowY);
  // Content boxes: each text line, each control or image, each card.
  // Each box is cut to the part its scroll or clip ancestors show; a fully hidden one is dropped.
  const items = [];
  const add = (el, r0, text) => { let r = { left: r0.left, right: r0.right, top: r0.top, bottom: r0.bottom };
    for (let a = text ? el : el.parentElement; a && a !== document.body; a = a.parentElement) { if (cs(a).overflow === 'visible') continue;
      const b = a.getBoundingClientRect(); r = { left: Math.max(r.left, b.left), right: Math.min(r.right, b.right), top: Math.max(r.top, b.top), bottom: Math.min(r.bottom, b.bottom) }; }
    if (r.right - r.left > 1 && r.bottom - r.top > 1) items.push({ el, r }); };
  // Text nobody can see (transparent color, or an ancestor at opacity 0, such as the words of a collapsed rail) is not content.
  const unseen = e => { if (alpha(cs(e).color) === 0) return true; for (; e && e !== document.body; e = e.parentElement) if (+cs(e).opacity === 0) return true; return false; };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    const el = n.parentElement; if (!n.data.trim() || !el || el.closest('script,style,template,noscript,.k-screen') || fixed(el) || cs(el).visibility === 'hidden' || unseen(el)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const rs = [...rg.getClientRects()];
    for (const r of rs) add(el, r, true);
    // 5. Crushed text: a squeezed column wraps after every few characters (one character per line on a phone).
    const chars = n.data.replace(/\s+/g, '').length, lines = new Set(rs.map(r => Math.round(r.top))).size;
    if (chars >= 8 && lines >= 3 && chars / lines < 6) bad.push(`crushed: ${chars} characters on ${lines} lines, ${Math.round(el.getBoundingClientRect().width)}px wide: ${name(el)}`);
  }
  all.filter(e => e.matches('img,svg,textarea,input,select,button,video,canvas') || e.hasAttribute('data-card')).forEach(el => add(el, el.getBoundingClientRect()));
  const owner = el => el.closest('[data-card]');
  // A box under a clip-path (a rail panel clipped to its closed width) is not where it paints: its gaps are not measured.
  const clipped = e => { for (; e && e !== document.body; e = e.parentElement) if (cs(e).clipPath !== 'none') return true; return false; };
  for (const c of cards) {
    if (clipped(c)) continue;
    const R = c.getBoundingClientRect();
    // 1. Gap: content outside this card that sits above or below it, in the same columns.
    for (const { el, r } of items) {
      if (c.contains(el) || el.contains(c) || clipped(el) || r.right <= R.left + 1 || r.left >= R.right - 1) continue;
      const below = r.top - R.bottom, above = R.top - r.bottom, g = Math.max(below, above);
      if (g < GAP - .5) bad.push(`gap ${g < -1 ? 'overlap' : Math.round(g) + 'px'}: ${name(el)} ${below >= above ? 'below' : 'above'} ${name(c)}`);
    }
    // 2. Inner room: this card's own content keeps 14 px from its edges. Inset lists and tables use their row padding.
    if (c.matches('.k-list, .k-table, table, img, picture, svg, video, canvas')) continue;
    let worst = null;
    for (const { el, r } of items) {
      if (el === c || !c.contains(el) || owner(el.hasAttribute('data-card') ? el.parentElement : el) !== c) continue;
      if (el.closest('.k-cover')) continue;
      let sc = false; for (let a = el; a && a !== c.parentElement; a = a.parentElement) if (scrolls(a) && a !== el) sc = true; if (sc) continue;
      const m = Math.min(r.left - R.left, R.right - r.right, r.top - R.top, R.bottom - r.bottom);
      if (!worst || m < worst.m) worst = { m, el };
    }
    if (worst && worst.m < PAD - .5) bad.push(`inner ${Math.round(worst.m)}px: ${name(worst.el)} inside ${name(c)}`);
  }
  // 3. Sideways overflow.
  if (document.documentElement.scrollWidth > vw + 1) bad.push(`overflow: page is ${document.documentElement.scrollWidth}px wide in a ${vw}px window`);
  for (const e of all) { const r = e.getBoundingClientRect(); let inScroll = false; for (let a = e.parentElement; a; a = a.parentElement) if (/auto|scroll/.test(cs(a).overflowX)) inScroll = true;
    if (!inScroll && (r.right > vw + 1 || r.left < -1)) { bad.push(`overflow: ${name(e)} spans ${Math.round(r.left)}..${Math.round(r.right)}px`); break; } }
  // 3b. Phone: no sideways scrolling inside a box either (a wide table, code line or image strip). The phone rail bar is the one exception.
  if (vw <= 860) for (const e of all) { if (!/auto|scroll/.test(cs(e).overflowX) || e.matches('.k-side-in')) continue;
    if (e.scrollWidth > e.clientWidth + 1) bad.push(`sideways scroll ${e.scrollWidth}px in ${e.clientWidth}px: ${name(e)}`); }
  // 4. Clipped text: a box that hides overflow and has more text than room. Scroll boxes are fine.
  for (const e of all) { const s = cs(e);
    if (!/hidden|clip/.test(s.overflowX + s.overflowY) || !e.textContent.trim() || e.closest('[aria-expanded="false"]')) continue; // a collapsed disclosure clips on purpose
    if (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) bad.push(`clipped ${e.scrollWidth}x${e.scrollHeight} in ${e.clientWidth}x${e.clientHeight}: ${name(e)}`); }
  // 8. Image cut off: an image the owner must judge shows its full frame. Cover thumbnails (.k-cover, .k-av avatars) and a
  // very tall image with its fade (.k-tall) crop on purpose; icons under 40 px are not judged.
  for (const e of all) { if (!e.matches('img, video') || e.closest('.k-cover, .k-tall, .k-av')) continue;
    const r = e.getBoundingClientRect(), s = cs(e), nw = e.naturalWidth || e.videoWidth, nh = e.naturalHeight || e.videoHeight;
    if (r.width < 40 || r.height < 40 || !nw || !nh) continue;
    const w = r.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth),
      h = r.height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom) - parseFloat(s.borderTopWidth) - parseFloat(s.borderBottomWidth);
    const off = Math.abs(w / h / (nw / nh) - 1);
    if (/cover|none/.test(s.objectFit) && off > .02) { bad.push(`image cut: object-fit ${s.objectFit} shows ${Math.round(w)}x${Math.round(h)} of a ${nw}x${nh} image: ${name(e)}`); continue; }
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { if (cs(a).overflowX === 'visible') continue;
      const b = a.getBoundingClientRect(), hid = Math.max(0, b.left - r.left) + Math.max(0, r.right - b.right);
      if (hid > 1) { bad.push(`image cut: ${Math.round(hid)}px of its width hidden by ${name(a)}: ${name(e)}`); break; } }
  }
  // 9. Whole hairlines: a border shows on all four sides at one width. One side alone is a divider (row, caption, Final bar).
  for (const e of [...document.body.querySelectorAll('*')]) { if (e.matches('hr') || !e.getClientRects().length) continue;
    const s = cs(e), sides = ['Top', 'Right', 'Bottom', 'Left'].filter(k => parseFloat(s[`border${k}Width`]) > 0 && !/none|hidden/.test(s[`border${k}Style`]) && alpha(s[`border${k}Color`]) > 0);
    const ws = new Set(sides.map(k => s[`border${k}Width`]));
    if (sides.length === 2 || sides.length === 3) bad.push(`border on ${sides.join(', ').toLowerCase()} only: ${name(e)}`);
    else if (sides.length === 4 && ws.size > 1) bad.push(`border widths differ (${['Top', 'Right', 'Bottom', 'Left'].map(k => s[`border${k}Width`]).join(' ')}): ${name(e)}`);
  }
  // 10. Dock covers content: scrolled to the very bottom, the last content ends 12 px above the floating dock.
  // This also covers text under the dock on a page that cannot scroll it out (no scroll room means the bottom is the top).
  const roots = [document, ...[...document.querySelectorAll('*')].filter(e => e.shadowRoot).map(e => e.shadowRoot)];
  const dock = roots.map(d => d.querySelector('.k-dock, .od-dock, .dock')).find(d => d && d.getClientRects().length && cs(d).visibility !== 'hidden');
  if (dock && items.length) { const top = dock.getBoundingClientRect().top, maxY = document.documentElement.scrollHeight - innerHeight;
    const last = items.filter(i => !dock.contains(i.el)).reduce((m, i) => i.r.bottom + scrollY > m.b ? { b: i.r.bottom + scrollY, el: i.el } : m, { b: -1 });
    const room = top - (last.b - maxY);
    if (room < GAP - .5) bad.push(`dock ${room < 0 ? 'covers' : Math.round(room) + 'px above'}: ${name(last.el)} at the page bottom, under ${name(dock)}`); }
  cards.forEach(e => e.removeAttribute('data-card'));
  return bad;
}
// 7. No focus rings: focus each control as a keyboard user would, then fail on an outline (the browser ring or a drawn one).
// A fill or a box-shadow the kit draws on purpose is fine. Runs after the screenshot, since focus can open a rail or a row.
function focusCheck() {
  const bad = [], name = e => { const t = (e.textContent || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return `${e.tagName.toLowerCase()}${[...e.classList].map(c => '.' + c).join('')}${t ? ` "${t}"` : ''}`; };
  for (const e of document.body.querySelectorAll('button, a[href], input, textarea, select, summary, video[controls], [tabindex]:not([tabindex="-1"])')) {
    if (e.disabled || !e.getClientRects().length) continue;
    e.focus({ preventScroll: true, focusVisible: true });
    if (document.activeElement !== e) continue;
    const s = getComputedStyle(e);
    if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) bad.push(`focus ring: ${s.outlineStyle} ${s.outlineWidth} outline on ${name(e)}`);
    e.blur();
  }
  return bad;
}

const found = new Map(), shots = [];
try {
  for (const w of [1440, 390]) for (const theme of ['light', 'dark']) {
    const mode = `${w} ${theme}`;
    await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: w < 500 ? 844 : 900, deviceScaleFactor: 1, mobile: false });
    await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
    await cmd('Page.navigate', { url }); await sleep(300);
    const h = await run(prep);
    for (const b of await run(check)) found.set(b, [...(found.get(b) || []), mode]);
    await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: Math.min(h, 16000), deviceScaleFactor: 1, mobile: false });
    await sleep(250);
    const f = path.join(out, `${w}-${theme}.png`);
    fs.writeFileSync(f, Buffer.from((await cmd('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    shots.push(f);
    // 6. Hover never moves content: rest the mouse on the inbox rail, then the panel is open and the first thread has not moved.
    if (w === 1440 && theme === 'light') {
      // The first rail on the page; its thread is the first .k-part beside it, or the inbox's other column.
      const probe = () => { const s = document.querySelector('.k-side'), p = document.querySelector('.k-inbox .k-part') || (s && s.closest('.k-inbox').querySelector(':scope > :not(.k-side)')); if (!s || !p) return null;
        s.scrollIntoView({ block: 'center' }); // idempotent: the second call finds it already centered
        const r = s.getBoundingClientRect(), q = p.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 40, open: s.classList.contains('k-open'), p: [q.left, q.top, q.width, q.height].map(Math.round) }; };
      const a = await run(probe);
      if (a) {
        await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x, y: a.y, pointerType: 'mouse' }); await sleep(500);
        const b = await run(probe);
        const fs2 = path.join(out, '1440-light-rail-open.png');
        fs.writeFileSync(fs2, Buffer.from((await cmd('Page.captureScreenshot', { format: 'png' })).data, 'base64')); shots.push(fs2);
        console.log(`hover: first thread at ${a.p.join(',')} closed, ${b.p.join(',')} open (x,y,w,h)`);
        if (!b.open) found.set('hover: the inbox rail did not open on a resting mouse', ['1440 light']);
        if (a.p.join() !== b.p.join()) found.set(`hover: the first thread moved from ${a.p.join(',')} to ${b.p.join(',')}`, ['1440 light']);
        await cmd('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1430, y: 5, pointerType: 'mouse' });
      }
    }
    // A real Tab press first, so the focus calls after it count as keyboard focus (:focus-visible).
    for (const type of ['keyDown', 'keyUp']) await cmd('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    for (const b of await run(focusCheck)) found.set(b, [...(found.get(b) || []), mode]);
  }
} catch (e) { console.error('kitcheck: ' + e.message); done(2); }
for (const [b, modes] of found) console.log(`FAIL ${b}  [${[...new Set(modes)].join(', ')}]`);
console.log(`screenshots: ${out}`);
console.log(found.size ? `kitcheck: ${found.size} offenders in ${path.basename(pagePath)}` : `kitcheck: clean (${path.basename(pagePath)}, 1440 and 390, light and dark)`);
done(found.size ? 1 : 0);
