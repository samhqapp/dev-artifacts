#!/usr/bin/env node
// Options page: decide how a component or tool should look or work. One kit panel per option, side by side, each
// with the real page in a frame (dark only, like the page) running the real devpanel.js with that option's setting.
// Usage: node options.mjs <spec.mjs> --out <dir> [--port 0]
// spec.mjs exports { topic, site, variants?, css?, path?, size?: [w, h], lead?, groups: [{ name, hint?, options: [
//   { name, sub, recommended?, set: {DevPanel.config values}, params?: {url params}, seed?: {store, dock} }] }] }
// It copies <site> into <out>, writes <out>/__options/ (page plus kit files), then runs serve.mjs on <out>.
import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { titlePrefix, fullTitle } from './title.mjs';

const args = process.argv.slice(2), flag = (n) => { const i = args.indexOf(n); return i < 0 ? undefined : args[i + 1]; };
const specPath = args[0], out = flag('--out'), port = flag('--port') ?? '0';
if (!specPath || !out) { console.error('usage: node options.mjs <spec.mjs> --out <dir> [--port 0]'); process.exit(1); }
const spec = (await import(path.resolve(specPath))).default, base = path.dirname(path.resolve(specPath));
const rel = (p) => p && path.resolve(base, p);
const kit = process.env.KIT_DIR || path.join(os.homedir(), '.agents/artifact-kit');
if (!existsSync(path.join(kit, 'kit.js'))) { console.error(`no kit.js in ${kit} (set KIT_DIR)`); process.exit(1); }

// the site, plus a seed script in each page's head: ?dv-seed writes that frame's store before devpanel.js reads it
mkdirSync(out, { recursive: true });
cpSync(rel(spec.site), out, { recursive: true });
const SEED = `<script>(()=>{const q=new URLSearchParams(location.search),s=q.get('dv-seed'),k=':'+q.get('dv-set');`
  + `if(s)try{const v=JSON.parse(s);if(v.store)localStorage.setItem('devpanel'+k,JSON.stringify(v.store));if(v.dock)localStorage.setItem('devpanel:dock'+k,v.dock)}catch{}`
  // ?dv-theme=dark: a frame's own appearance (browsers give a frame the page's): rewrite the page's
  // prefers-color-scheme rules and answer matchMedia, which the overlay reads
  + `const t=q.get('dv-theme');if(!t)return;const dark=t==='dark',mm=matchMedia.bind(window),is=(m)=>/prefers-color-scheme/.test(m),want=(m)=>/dark/.test(m)===dark;`
  + `window.matchMedia=(m)=>is(m)?mm(want(m)?'all':'not all'):mm(m);document.documentElement.style.colorScheme=t;`
  + `const walk=(rs)=>{for(const r of rs){if(r.media&&is(r.media.mediaText))r.media.mediaText=want(r.media.mediaText)?'all':'not all';if(r.cssRules)walk(r.cssRules)}};`
  + `const fix=()=>{for(const x of document.styleSheets){try{walk(x.cssRules)}catch{}}};fix();document.addEventListener('DOMContentLoaded',fix);addEventListener('load',fix)})()</script>`;
const pages = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? (f === '__options' ? [] : pages(p)) : f.endsWith('.html') ? [p] : []; });
for (const f of pages(out)) { const h = readFileSync(f, 'utf8'); if (!h.includes("q.get('dv-seed')")) writeFileSync(f, h.replace(/<head[^>]*>/i, (m) => m + '\n' + SEED)); }

// the kit page
const dir = path.join(out, '__options'); mkdirSync(dir, { recursive: true });
for (const f of ['kit.css', 'kit.js']) cpSync(path.join(kit, f), path.join(dir, f));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const [W, H] = spec.size || [1000, 620], at = spec.path || '/';
const src = (o) => {
  const q = new URLSearchParams({ 'dv-set': JSON.stringify({ ...o.set }), 'dv-theme': 'dark', ...(o.params || {}) });
  if (o.seed) q.set('dv-seed', JSON.stringify(o.seed));
  return esc('..' + at + (at.includes('?') ? '&' : '?') + q);
};
const frame = (o) => `<div class="p-frame"><iframe loading="lazy" title="${esc(o.name)}" src="${src(o)}"></iframe>`
  + `<a class="p-open" href="${src(o)}" target="_blank" title="Open this frame full size">Open ↗</a></div>`;
// a new round number whenever the questions change, so old answers never come back
const round = [...JSON.stringify(spec.groups.map((g) => [g.name, g.options.map((o) => o.name)]))].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const title = fullTitle(titlePrefix(), spec.topic);
writeFileSync(path.join(dir, 'index.html'), `<!doctype html>
<html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</title>
<script src="kit.js"></script>
<style>
  .p-frames { display: grid; gap: 14px; }
  .p-frame { position: relative; aspect-ratio: ${W} / ${H}; overflow: hidden; border-radius: 10px; border: .5px solid var(--line); background: var(--inset); }
  .p-frame iframe { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; border: 0; transform-origin: 0 0; scale: var(--p-s, .4); }
  .p-open { position: absolute; left: 14px; top: 14px; padding: 3px 8px; border-radius: 6px; text-decoration: none;
    font: 600 12px/1.4 var(--font); color: var(--muted); background: var(--card); box-shadow: var(--shadow); }
  .p-open:hover { color: var(--blue); }
</style></head>
<body><main class="k-wrap" data-kit data-round="${round}">
<section class="k-part" data-part="Start">
  <p class="k-kicker">Options</p><h1 class="k-title">${esc(spec.topic)}</h1>
  ${spec.lead ? `<p class="k-lead">${esc(spec.lead)}</p>` : ''}
</section>
${spec.groups.map((g, i) => `<section class="k-part" data-part="${esc(g.name)}">
  <p class="k-kicker">Group ${i + 1}</p><h2 class="k-h2">${esc(g.name)}</h2>${g.hint ? `<p class="k-hint">${esc(g.hint)}</p>` : ''}
  <div class="k-group" data-group="${esc(g.name)}"><div class="k-options">
${g.options.map((o) => `    <div class="k-option" data-option="${esc(o.name)}"${o.recommended ? ' data-recommended' : ''}${o.sub ? ` data-sub="${esc(o.sub)}"` : ''}>
      <div class="k-media p-frames">${frame(o)}</div>
    </div>`).join('\n')}
  </div></div>
</section>`).join('\n')}
</main>
<script>
  // each frame shows the real page at ${W} x ${H}, scaled to the panel's width
  const fit = (f) => f.style.setProperty('--p-s', f.clientWidth / ${W});
  const ro = new ResizeObserver((es) => es.forEach((e) => fit(e.target)));
  document.querySelectorAll('.p-frame').forEach((f) => { fit(f); ro.observe(f); });
</script>
</body></html>
`);

const srv = spawn(process.execPath, [new URL('./serve.mjs', import.meta.url).pathname, out,
  ...(spec.variants ? ['--variants', rel(spec.variants)] : []), ...(spec.css ? ['--css', rel(spec.css)] : []), '--port', port], { stdio: ['ignore', 'pipe', 'inherit'] });
srv.stdout.on('data', (b) => { const m = String(b).match(/http:\/\/[^\s/]+/); process.stdout.write(m ? `${m[0]}/__options/\n` : b); });
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { srv.kill(); process.exit(0); });
srv.on('exit', (c) => process.exit(c ?? 0));
