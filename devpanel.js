/* Dev artifacts (DevPanel): a dev-only overlay that shows design options live on a real site.
   DevPanel.group({ id, label, target, options: [{ name, note? }], dot?: 'tr'|'tl', current?: false, apply?(i) })
   Option 1 is "Current" (no attribute) unless current: false. Picking option i > 1 sets data-dv-<id>="<i>" on <html>.
   Everything lives in one shadow root, so no style leaks in or out. Never ship this file.
   URL params: ?dv-open=<id> opens a popover, ?dv-hl=<id> shows the badge-hover highlight,
   ?dv-pick=<id>:<i>[,<id>:<i>] forces options (nothing is saved), ?dv-clean hides the whole overlay. */
(() => {
  if (window.DevPanel) return;
  const KEY = 'devpanel:' + location.pathname, Q = new URLSearchParams(location.search);
  const forced = Object.fromEntries((Q.get('dv-pick') || '').split(',').map((s) => s.split(':')).filter((p) => p[1] > 0).map(([k, v]) => [k, +v]));
  const st = { picks: {}, notes: {}, hidden: false };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY)) || {}); } catch {}
  const save = () => { if (Q.has('dv-pick')) return; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
  const groups = [];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const sheetMQ = matchMedia('(max-width: 600px)'), darkMQ = matchMedia('(prefers-color-scheme: dark)');
  let host, sh, layer, hl, ring, bps, pop, scr, knob, count, hideBtn, copyBtn, open = null, hover = null, raf = 0, knobT = 0;

  const CSS = `
:host { all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; color-scheme: light;
  --blue: #007aff; --blue-top: #4da3ff; --ink: #1d1d1f; --muted: rgba(60,60,67,.6); --line: rgba(0,0,0,.12);
  --pop: rgba(246,246,248,.86); --dock: rgba(255,255,255,.66); --hi: rgba(255,255,255,.75); --row: rgba(0,0,0,.05);
  --sep: rgba(0,0,0,.09); --field: rgba(0,0,0,.04); --knob: #000;
  --shadow: 0 0 0 .5px rgba(0,0,0,.05), 0 2px 6px rgba(0,0,0,.08), 0 14px 36px rgba(0,0,0,.16);
  font: 13px/1.35 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif; color: var(--ink);
  -webkit-font-smoothing: antialiased; }
:host([data-dark]) { color-scheme: dark;
  --blue: #0a84ff; --blue-top: #5eb0ff; --ink: #f5f5f7; --muted: rgba(235,235,245,.6); --line: rgba(255,255,255,.14);
  --pop: rgba(36,36,40,.86); --dock: rgba(40,40,44,.6); --hi: rgba(255,255,255,.14); --row: rgba(255,255,255,.07);
  --sep: rgba(255,255,255,.1); --field: rgba(0,0,0,.25); --knob: #fff;
  --shadow: 0 0 0 .5px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.3), 0 14px 36px rgba(0,0,0,.5); }
* { box-sizing: border-box; outline: none !important; -webkit-tap-highlight-color: transparent; }
button, textarea { font: inherit; color: inherit; }
button { cursor: pointer; border: 0; background: none; padding: 0; }
[hidden] { display: none !important; }

.dot { position: absolute; left: 0; top: 0; width: 20px; height: 20px; border-radius: 50%; pointer-events: auto;
  display: grid; place-items: center; color: #fff; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
  background: linear-gradient(180deg, var(--blue-top), var(--blue) 55%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.45), inset 0 0 0 .5px rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.3);
  opacity: .6; transition: opacity .15s ease; }
.dot::before { content: ""; position: absolute; inset: -8px; border-radius: 50%; } /* 36 px hit area for touch */
.dot:hover, .dot:focus-visible, .dot[aria-expanded="true"] { opacity: 1; }

/* badge-hover highlight: padded ring plus blueprint guides on the target's exact edges */
.hl > * { position: absolute; left: 0; top: 0; opacity: 0; transition: opacity .15s ease; }
.ring { border-radius: 10px; border: 1px solid color-mix(in srgb, var(--blue) 50%, transparent);
  background: color-mix(in srgb, var(--blue) 5%, transparent); }
.bp { background: var(--blue); }
.bp.h { height: 1px; -webkit-mask: linear-gradient(90deg, transparent, #000 48px, #000 calc(100% - 48px), transparent);
  mask: linear-gradient(90deg, transparent, #000 48px, #000 calc(100% - 48px), transparent); }
.bp.v { width: 1px; -webkit-mask: linear-gradient(180deg, transparent, #000 48px, #000 calc(100% - 48px), transparent);
  mask: linear-gradient(180deg, transparent, #000 48px, #000 calc(100% - 48px), transparent); }
.hl.on .ring { opacity: 1; }
.hl.on .bp { opacity: .45; }

.pop { position: absolute; display: flex; flex-direction: column; width: max-content; min-width: 240px;
  max-width: min(360px, calc(100vw - 16px)); max-height: calc(100vh - 16px); pointer-events: auto;
  border-radius: 12px; background: var(--pop); border: 1px solid var(--line); box-shadow: var(--shadow); overflow: hidden;
  backdrop-filter: blur(40px) saturate(1.8); -webkit-backdrop-filter: blur(40px) saturate(1.8);
  animation: dv-in .14s ease-out; z-index: 2; } /* above the dock, so the phone sheet covers it */
@keyframes dv-in { from { opacity: 0; transform: scale(.98); } }
.scroll { flex: 1 1 auto; min-height: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain;
  padding: 5px; scrollbar-width: none; overflow-wrap: anywhere; }
.scroll::-webkit-scrollbar { display: none; }
.knob { position: absolute; right: 2px; top: 0; width: 4px; border-radius: 2px; background: var(--knob); opacity: 0;
  pointer-events: none; transition: opacity .35s ease; }
.knob::before { content: ""; position: absolute; inset: 0 -4px; }
.knob.show { opacity: .3; pointer-events: auto; transition-duration: .12s; }
.knob.drag { opacity: .5; }
.head { display: flex; align-items: center; gap: 7px; padding: 4px 9px 5px; font-size: 12px; font-weight: 600; color: var(--muted); }
.head .dot { position: static; width: 16px; height: 16px; font-size: 10px; opacity: 1; pointer-events: none; flex: none; }
.sep { height: 1px; margin: 5px 9px; background: var(--sep); }
.opt { display: grid; grid-template-columns: 12px 1fr auto; align-items: start; column-gap: 7px; width: 100%; text-align: left;
  padding: 4px 9px 5px 7px; border-radius: 6px; }
.opt:hover, .opt:focus-visible { background: var(--blue); color: #fff; }
.opt .ck { font-size: 11px; font-weight: 700; line-height: 18px; visibility: hidden; }
.opt[aria-selected="true"] .ck { visibility: visible; }
.opt .name { display: block; line-height: 18px; }
.opt .note { display: block; color: var(--muted); font-size: 11.5px; line-height: 1.3; margin-bottom: 1px; }
.opt .n { color: var(--muted); font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; padding-left: 10px; }
.opt:hover .note, .opt:hover .n, .opt:focus-visible .note, .opt:focus-visible .n { color: rgba(255,255,255,.82); }
textarea { display: block; width: calc(100% - 8px); margin: 2px 4px 4px; min-height: 30px; padding: 6px 8px; resize: none;
  overflow: hidden; border-radius: 6px; border: 1px solid var(--line); background: var(--field); line-height: 1.35; }
textarea:focus { border-color: color-mix(in srgb, var(--blue) 60%, var(--line)); }
textarea::placeholder { color: var(--muted); }

.dock { position: absolute; left: 0; right: 0; margin-inline: auto; width: max-content; max-width: calc(100vw - 24px);
  bottom: calc(16px + env(safe-area-inset-bottom, 0px)); pointer-events: auto; display: flex; align-items: center;
  gap: 4px; padding: 5px; border-radius: 999px; background: var(--dock); border: 1px solid var(--line);
  box-shadow: var(--shadow), inset 0 1px 0 var(--hi);
  backdrop-filter: blur(28px) saturate(1.8); -webkit-backdrop-filter: blur(28px) saturate(1.8); }
.dock output { padding: 0 8px 0 10px; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.dock button { padding: 7px 12px; border-radius: 999px; font-weight: 600; white-space: nowrap; }
.dock button:hover, .dock button:focus-visible { background: var(--row); }
.dock .copy { background: linear-gradient(180deg, var(--blue-top), var(--blue) 55%); color: #fff;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.35); }
.dock .copy:hover, .dock .copy:focus-visible { background: var(--blue); }

@media (max-width: 600px) {
  .pop { position: fixed; left: 8px !important; right: 8px; top: auto !important; bottom: calc(8px + env(safe-area-inset-bottom, 0px));
    width: auto !important; min-width: 0; max-width: none; max-height: 45vh !important; border-radius: 16px; animation-name: dv-up; }
  @keyframes dv-up { from { transform: translateY(16px); opacity: 0; } }
  .scroll { padding: 6px; }
  .pop:not([hidden]) ~ .dock { visibility: hidden; } /* the sheet replaces the dock while open */
  .opt { padding: 9px 9px 9px 7px; }
  textarea { font-size: 16px; } /* 16 px stops iOS zoom on focus */
}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }`;

  function mount() {
    if (host || !document.body) return;
    host = document.createElement('dev-panel');
    sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = `<style>${CSS}</style><div class="hl"><div class="ring"></div><div class="bp h"></div><div class="bp h"></div><div class="bp v"></div><div class="bp v"></div></div>
<div class="layer"></div><div class="pop" role="dialog" aria-label="Dev artifacts" hidden><div class="scroll"></div><div class="knob"></div></div>
<div class="dock" aria-label="Dev artifacts"><output></output><button class="copy" type="button">Copy choices</button><button class="hide" type="button"></button><button class="reset" type="button">Reset</button></div>`;
    [hl, ring, layer, pop, scr, knob] = ['.hl', '.ring', '.layer', '.pop', '.scroll', '.knob'].map((s) => sh.querySelector(s));
    bps = sh.querySelectorAll('.bp');
    count = sh.querySelector('output'); hideBtn = sh.querySelector('.hide'); copyBtn = sh.querySelector('.copy');
    copyBtn.onclick = copy;
    hideBtn.onclick = () => { st.hidden = !st.hidden; save(); if (st.hidden) close(); sync(); };
    sh.querySelector('.reset').onclick = () => { st.picks = {}; st.notes = {}; save(); close(); groups.forEach((g) => setVar(g, 1)); sync(); };
    scr.onscroll = flash;
    pop.onpointermove = (e) => { if (e.clientX > pop.getBoundingClientRect().right - 16) flash(); };
    knob.onpointerdown = (e) => {
      e.preventDefault(); knob.setPointerCapture(e.pointerId); knob.classList.add('drag');
      const y0 = e.clientY, s0 = scr.scrollTop, k = scr.scrollHeight / scr.clientHeight;
      knob.onpointermove = (m) => { scr.scrollTop = s0 + (m.clientY - y0) * k; };
      knob.onpointerup = knob.onpointercancel = () => { knob.onpointermove = null; knob.classList.remove('drag'); flash(); };
    };
    if (Q.has('dv-clean')) host.style.display = 'none';
    document.body.appendChild(host);
    for (const g of groups) addDot(g);
    theme();
    darkMQ.addEventListener('change', theme);
    new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    new MutationObserver(theme).observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    sync();
  }

  // Dark panel on a dark site: page background luminance, then a one-sided color-scheme, then the OS setting.
  const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  function theme() {
    let dark = null;
    for (const el of [document.body, document.documentElement]) {
      cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#0000'; cv.fillStyle = getComputedStyle(el).backgroundColor; cv.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = cv.getImageData(0, 0, 1, 1).data;
      if (a > 128) { dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 128; break; }
    }
    if (dark === null) {
      const cs = getComputedStyle(document.documentElement).colorScheme;
      if (/dark/.test(cs) !== /light/.test(cs)) dark = /dark/.test(cs);
    }
    host.toggleAttribute('data-dark', dark ?? darkMQ.matches);
  }

  function addDot(g) {
    const d = g.el = document.createElement('button');
    d.type = 'button'; d.className = 'dot'; d.textContent = g.n;
    d.setAttribute('aria-label', `Options for ${g.label}`);
    d.onclick = () => (open === g ? close() : show(g));
    d.onpointerenter = (e) => { if (e.pointerType !== 'touch') { hover = g; schedule(); } };
    d.onpointerleave = () => { hover = null; schedule(); };
    layer.appendChild(d);
  }

  const pick = (g) => st.picks[g.id] || 1;
  function setVar(g, i) {
    const attr = 'data-dv-' + g.id, root = document.documentElement;
    if (i === 1 && g.current !== false) root.removeAttribute(attr); else root.setAttribute(attr, String(i));
    try { g.apply && g.apply(i); } catch (e) { console.error('[dev artifacts]', g.id, e); }
    schedule();
  }

  function show(g) {
    open = g;
    scr.innerHTML = `<div class="head"><span class="dot">${g.n}</span>${esc(g.label)}</div><div class="list" role="listbox">${g.opts.map((o, k) =>
      `<button type="button" class="opt" role="option" data-i="${k + 1}" aria-selected="${pick(g) === k + 1}"><span class="ck">✓</span><span><span class="name">${esc(o.name)}</span>${o.note ? `<span class="note">${esc(o.note)}</span>` : ''}</span><span class="n">${k + 1}</span></button>`).join('')}</div><div class="sep"></div><textarea rows="1" placeholder="Comment"></textarea>`;
    const list = scr.querySelector('.list'), ta = scr.querySelector('textarea');
    list.onmouseover = (e) => { const b = e.target.closest('.opt'); if (b) setVar(g, +b.dataset.i); };
    list.onmouseleave = () => setVar(g, pick(g));
    list.onclick = (e) => {
      const b = e.target.closest('.opt'); if (!b) return;
      const i = +b.dataset.i; if (i === 1) delete st.picks[g.id]; else st.picks[g.id] = i;
      save(); setVar(g, i);
      list.querySelectorAll('.opt').forEach((o) => o.setAttribute('aria-selected', o === b));
      sync();
    };
    ta.value = st.notes[g.id] || '';
    const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
    ta.oninput = () => { const v = ta.value; if (v.trim()) st.notes[g.id] = v; else delete st.notes[g.id]; save(); grow(); };
    pop.hidden = false; scr.scrollTop = 0; grow();
    sh.querySelectorAll('.layer .dot').forEach((d) => d.setAttribute('aria-expanded', d === g.el));
    if (sheetMQ.matches) requestAnimationFrame(() => {
      // bring the target into the free part above the bottom sheet
      const t = document.querySelector(g.target), r = t && t.getBoundingClientRect(), top = innerHeight - pop.offsetHeight - 8;
      if (r && (r.top < 8 || r.bottom > top - 8)) scrollBy(0, r.top - Math.max(12, (top - r.height) / 2));
    });
    schedule();
  }

  function close() {
    if (!open) return;
    setVar(open, pick(open));
    open = null; pop.hidden = true; scr.innerHTML = '';
    sh.querySelectorAll('.layer .dot').forEach((d) => d.setAttribute('aria-expanded', 'false'));
    schedule();
  }

  function sync() {
    if (!host) return;
    const n = groups.filter((g) => pick(g) !== 1).length;
    count.textContent = `${n} ${n === 1 ? 'pick' : 'picks'}`;
    hideBtn.textContent = st.hidden ? 'Show dots' : 'Hide dots';
    schedule();
  }

  // Thin overlay knob: shows while scrolling or while the pointer is at the right edge, fades 2 s later.
  function flash() {
    const ch = scr.clientHeight, sh2 = scr.scrollHeight;
    if (sh2 <= ch + 1) { knob.classList.remove('show'); return; }
    const len = Math.max(40, ch * ch / sh2), y = scr.offsetTop + 3 + (scr.scrollTop / (sh2 - ch)) * (ch - 6 - len);
    Object.assign(knob.style, { height: len + 'px', transform: `translateY(${y}px)` });
    knob.classList.add('show');
    clearTimeout(knobT);
    knobT = setTimeout(() => { if (!knob.classList.contains('drag')) knob.classList.remove('show'); }, 2000);
  }

  const box = (el, x, y, w, h) => { el.style.transform = `translate(${x}px, ${y}px)`; el.style.width = w + 'px'; el.style.height = h + 'px'; };

  function place() {
    raf = 0;
    const vw = innerWidth, vh = innerHeight;
    let lit = st.hidden ? null : hover;
    for (const g of groups) {
      const t = document.querySelector(g.target), r = t && t.getBoundingClientRect();
      const on = !st.hidden && r && r.width > 0 && r.bottom > 36 && r.top < vh - 20;
      g.el.hidden = !on;
      if (!on) { if (lit === g) lit = null; continue; }
      // the badge floats just outside the target's top corner (4 px gap) and stays on screen
      const x = clamp(g.pos === 'tl' ? r.left - 24 : r.right + 4, 6, vw - 26);
      const y = Math.min(Math.max(r.top - 24, 6), r.bottom - 20);
      g.r = r;
      g.el.style.transform = `translate(${x}px, ${y}px)`;
    }
    hl.classList.toggle('on', !!lit);
    if (lit) {
      const r = lit.r, P = 8, E = 48;
      box(ring, r.left - P, r.top - P, r.width + 2 * P, r.height + 2 * P);
      box(bps[0], r.left - E, r.top, r.width + 2 * E, 1);
      box(bps[1], r.left - E, r.bottom - 1, r.width + 2 * E, 1);
      box(bps[2], r.left, r.top - E, 1, r.height + 2 * E);
      box(bps[3], r.right - 1, r.top - E, 1, r.height + 2 * E);
    }
    if (!open || sheetMQ.matches) return;
    if (open.el.hidden) return close();
    // beside the target on the roomiest side (right, left, below, above), so the target stays in view
    const keep = scr.scrollTop; // resetting the size below would otherwise jump the list back to the top
    pop.style.width = pop.style.maxHeight = '';
    let w = pop.offsetWidth, h = pop.offsetHeight, left, top;
    const r = open.r, M = 8, DOCK = 72, G = 12, GR = open.pos === 'tl' ? G : 32, GL = open.pos === 'tl' ? 32 : G; // 32 clears the badge
    const room = { right: vw - r.right - GR - M, left: r.left - GL - M, below: vh - r.bottom - G - DOCK, above: r.top - G - M };
    const low = h + M + DOCK <= vh ? vh - DOCK : vh - M; // stay above the dock when there is room
    const side = ['right', 'left'].find((s) => room[s] >= w) || ['right', 'left'].find((s) => room[s] >= 240)
      || ['below', 'above'].find((s) => room[s] >= Math.min(h, 320)) || 'inside';
    if (side === 'inside') {
      // the target fills the window (a whole layout): float at the window's top right, as tall as needed
      const max = vh - 2 * M - DOCK;
      if (h > max) { pop.style.maxHeight = max + 'px'; h = max; }
      left = vw - w - M; top = M;
    } else if (side === 'right' || side === 'left') {
      if (w > room[side]) { pop.style.width = room[side] + 'px'; w = pop.offsetWidth; h = pop.offsetHeight; }
      left = side === 'right' ? r.right + GR : r.left - GL - w;
      top = clamp(r.top, M, low - h);
    } else {
      const max = Math.max(room[side], 160);
      if (h > max) { pop.style.maxHeight = max + 'px'; h = max; }
      top = clamp(side === 'below' ? r.bottom + G : r.top - G - h, M, vh - h - M);
      left = clamp(r.left, M, vw - w - M);
    }
    Object.assign(pop.style, { left: left + 'px', top: top + 'px' });
    scr.scrollTop = keep;
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(place); };

  function md() {
    return groups.map((g) => {
      const i = pick(g), note = (st.notes[g.id] || '').trim();
      let s = `- ${g.label}: ${i} ${g.opts[i - 1] ? g.opts[i - 1].name : '?'}`;
      if (note) { const [first, ...rest] = note.split('\n'); s += ' - ' + first + rest.map((l) => '\n  ' + l).join(''); }
      return s;
    }).join('\n');
  }
  async function copy() {
    const text = md();
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; sh.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch {} ta.remove();
    }
    copyBtn.textContent = 'Copied'; setTimeout(() => (copyBtn.textContent = 'Copy choices'), 1200);
  }

  addEventListener('scroll', schedule, { passive: true, capture: true });
  addEventListener('resize', schedule);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) return close();
    const t = e.composedPath()[0];
    if (e.key !== '.' || e.metaKey || e.ctrlKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
    st.hidden = !st.hidden; save(); if (st.hidden) close(); sync();
  });
  addEventListener('pointerdown', (e) => {
    if (!open) return;
    const p = e.composedPath();
    if (!p.includes(pop) && !p.includes(open.el)) close();
  }, true);
  const boot = () => {
    mount();
    try { new ResizeObserver(schedule).observe(document.body); } catch {}
    const find = (id) => id && groups.find((x) => x.id === id);
    const g = find(Q.get('dv-open')), h = find(Q.get('dv-hl'));
    if (g) setTimeout(() => show(g), 50);
    if (h) { hover = h; schedule(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot);

  window.DevPanel = {
    group(cfg) {
      if (!cfg || !cfg.id || !cfg.target || !Array.isArray(cfg.options)) throw new Error('DevPanel.group needs id, target, options');
      if (!/^[a-z0-9-]+$/.test(cfg.id)) throw new Error('DevPanel id must be lowercase letters, digits, or dashes: ' + cfg.id);
      const g = { ...cfg, label: cfg.label || cfg.id, pos: cfg.dot || 'tr', n: groups.length + 1,
        opts: cfg.current === false ? cfg.options : [{ name: 'Current' }, ...cfg.options] };
      if (forced[g.id]) st.picks[g.id] = forced[g.id];
      if (pick(g) > g.opts.length) delete st.picks[g.id];
      groups.push(g);
      if (pick(g) !== 1) setVar(g, pick(g));
      if (host) { addDot(g); sync(); }
      return g;
    },
    markdown: md,
    open: (id) => { const g = groups.find((x) => x.id === id); if (g) show(g); },
    groups: () => groups.map((g) => ({ id: g.id, label: g.label, target: g.target, options: g.opts.map((o) => o.name) })),
  };
})();
