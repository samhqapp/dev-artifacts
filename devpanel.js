/* Dev artifacts (DevPanel): a dev-only overlay that shows design options live on a real site.
   DevPanel.group({ id, label, target, options: [{ name, note? }], page?: '/all' | ['/a', '/b'], dot?: 'tr'|'tl',
     current?: false, sample?: 'first'|'all', apply?(i) })
   Option 1 is "Current" (no attribute) unless current: false. Picking option i > 1 sets data-dv-<id>="<i>" on <html>.
   A group with options gets a blue dot. `options: [], current: false` makes a comment-only group with a green dot.
   A group without `page` belongs to the page where its target first shows up. Picks, comments, and the list of
   groups are kept for the whole site (one localStorage key per origin), so the dock counts and walks every page.
   DevPanel.config({ site: '/memory/' | ['/a/', '/b/'] }) splits one server into separate sites, each with its own store;
   groups whose `page` is on another site are skipped. Call it before DevPanel.group.
   DevPanel.config({ title: '<project> > <topic>' }) sets the browser tab title while the overlay runs, such as
   'samhq_backend > buy dialog'. Without it the title stays and the console warns once.
   DevPanel.config({ navigate(path) }) lets an app route itself; otherwise an SPA gets pushState + popstate and a
   static site a normal page load. Everything lives in one shadow root, so no style leaks in or out. Never ship this file.
   The dots and dock come from the shared option-dots overlay (dots.js, copied in below). The current group lives in
   the dock: its name, its options as a segmented control (a compact list when they do not fit), and its comment field.
   A dot click makes its group current. Hovering a dock option or a dot pulses a faint red glow line on the target once.
   URL params: ?dv-open=<id> makes a group current, ?dv-hl=<id> holds the glow at its peak (for screenshots),
   ?dv-pick=<id>:<i>[,<id>:<i>] forces options (nothing is saved), ?dv-clean hides the whole overlay.
   Keys: . hides the dots, ] and [ go to the next and previous blue dot on any page (also DevPanel.next() and .back()). */
/* option-dots:start: a copy of dev-artifacts/dots.js. Edit that file, then run dots-sync.mjs. */
/* Option dots: one shared overlay of option dots, with the artifact kit's look and motion.
   A blue dot opens choices to pick. A green dot opens only a comment field.
   The dock part has back and next (they step through the blue dots: scroll there, pulse the dot, open its popover)
   and a "Hide dots" switch that a reload keeps.
   This file is the one source. Other files hold copies between the option-dots markers: edit here, then run
   `node dots-sync.mjs <file>...`. Never write a closing script tag in this file (the kit inlines it).

   const od = OptionDots({ root, theme, key, step, list, select })
     root: where the dots, popover and dock go (default document.body; a shadow root works).
     theme: the element that gets data-od-dark (default <html>, or the shadow host). key: localStorage key for Hide dots.
     step(d), list(): replace the in-page back and next, and make the count a button (dev-artifacts walks a whole site).
     select(rec): a dot click calls it instead of opening the popover (dev-artifacts shows the group in the dock).
   od.add({ target, label, pick, render(body, rec), onClose(), pos: 'tr'|'tl', n }) -> rec
     target: an element, or a function that returns { t: element, r: rect }. pick: true blue, false green.
     render fills the popover body each time it opens. n: the number on a blue dot (default: its place on the page).
   od.open(rec), od.close(), od.go(rec, open) -> Promise, od.step(d), od.sync(), od.controls, od.dock(...buttons).
   od.freeze: a performance.now() time; until then a scroll does not move an open popover (a live preview is settling).
   Keys: [ and ] step, . hides the dots, Escape closes. */
(() => {
  if (window.OptionDots) return;
  const EASE = 'linear(0, 0.022, 0.075, 0.147, 0.228, 0.31, 0.391, 0.467, 0.537, 0.601, 0.657, 0.708, 0.751, 0.789, 0.822, 0.85, 0.874, 0.895, 0.912, 0.927, 0.939, 0.949, 0.958, 0.965, 0.971, 0.976, 0.98, 0.984, 0.987, 0.989, 0.991, 0.993, 0.994, 0.995, 0.996, 0.997, 0.997, 0.998, 0.998, 0.998, 1)';
  const CSS = `
:root, :host { --od-blue: #007aff; --od-green: #34c759; --od-ink: #1c1c1e; --od-muted: rgba(60,60,67,.62);
  --od-line: rgba(60,60,67,.16); --od-pop: rgba(255,255,255,.94); --od-dock: rgba(255,255,255,.66); --od-hi: rgba(255,255,255,.7);
  --od-fill: rgba(120,120,128,.12); --od-card: #fff; --od-ring: #fff; --od-knob: #000;
  --od-shadow: 0 1px 2px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.06);
  --od-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif;
  --od-ease: ${EASE}; --od-out: cubic-bezier(.22, 1, .36, 1); --od-open: 380ms; --od-close: 220ms; }
:root[data-od-dark], :host([data-od-dark]) { --od-blue: #0a84ff; --od-green: #30d158; --od-ink: #f2f2f7; --od-muted: rgba(235,235,245,.6);
  --od-line: rgba(84,84,88,.6); --od-pop: rgba(44,44,48,.94); --od-dock: rgba(40,40,44,.6); --od-hi: rgba(255,255,255,.14);
  --od-fill: rgba(255,255,255,.1); --od-card: #1c1c1e; --od-ring: #1c1c1e; --od-knob: #fff;
  --od-shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.3); }
.od-layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; }
.od-dot { all: unset; box-sizing: border-box; position: absolute; left: 0; top: 0; width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--od-ring); display: grid; place-items: center; pointer-events: auto; cursor: pointer; color: #fff;
  --od-c: var(--od-blue); background: var(--od-c); font: 700 11px/1 var(--od-font); font-variant-numeric: tabular-nums;
  box-shadow: 0 1px 2px rgba(0,0,0,.18), 0 4px 12px rgba(0,0,0,.16); transition: scale var(--od-close) var(--od-out);
  -webkit-tap-highlight-color: transparent; }
.od-dot[data-kind="note"] { --od-c: var(--od-green); }
.od-dot[hidden] { display: none; }
.od-dot svg { width: 11px; height: 11px; display: block; }
.od-dot::before { content: ""; position: absolute; inset: -9px; border-radius: 50%; } /* 40 px hit area for touch */
.od-dot::after { content: ""; position: absolute; inset: -2px; border-radius: 50%; pointer-events: none; }
.od-dot:hover, .od-dot:focus-visible, .od-dot[aria-expanded="true"], .od-dot[aria-current="true"] { scale: 1.14; transition: scale var(--od-open) var(--od-ease); }
.od-dot.od-pulse::after { animation: od-pulse .7s var(--od-out) 2; }
@keyframes od-pulse { from { box-shadow: 0 0 0 0 color-mix(in srgb, var(--od-c) 55%, transparent); } to { box-shadow: 0 0 0 14px transparent; } }
.od-mini { position: static; width: 18px; height: 18px; border: 0; font-size: 10px; box-shadow: none; pointer-events: none; flex: none; }
.od-mini::before { content: none; }
.od-mini svg { width: 10px; height: 10px; }

.od-pop { position: fixed; left: 0; top: 0; z-index: 2147483002; box-sizing: border-box; display: flex; flex-direction: column;
  width: max-content; min-width: 260px; max-width: min(380px, calc(100vw - 16px)); max-height: calc(100vh - 16px); overflow: hidden;
  border-radius: 14px; background: var(--od-pop); color: var(--od-ink); border: .5px solid var(--od-line); box-shadow: 0 12px 32px rgba(0,0,0,.2);
  backdrop-filter: blur(24px) saturate(1.6); -webkit-backdrop-filter: blur(24px) saturate(1.6); font: 14px/1.45 var(--od-font); text-align: left;
  transform-origin: top left; opacity: 0; transform: translateY(-4px) scale(.98); visibility: hidden; pointer-events: none;
  transition: opacity var(--od-close) var(--od-out), transform var(--od-close) var(--od-out), visibility 0s linear var(--od-close); }
.od-pop.od-show { opacity: 1; transform: none; visibility: visible; pointer-events: auto;
  transition: opacity 160ms ease, transform var(--od-open) var(--od-ease), visibility 0s; }
.od-pop *, .od-pop *::before, .od-pop *::after { box-sizing: border-box; }
.od-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px 2px; font-size: 13px; font-weight: 600; color: var(--od-muted); }
.od-head:empty { display: none; }
.od-body { flex: 1 1 auto; min-height: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; padding: 8px 14px 14px;
  scrollbar-width: none; overflow-wrap: anywhere; }
.od-body::-webkit-scrollbar { display: none; }
.od-body textarea:not(.k-comment) { display: block; width: 100%; margin: 10px 0 0; min-height: 46px; padding: 11px 14px; resize: none; overflow: hidden;
  font: 15px/1.4 var(--od-font); color: inherit; background: var(--od-card); border: .5px solid var(--od-line); border-radius: 12px; outline: none;
  box-shadow: var(--od-shadow); }
.od-body > textarea:first-child, .od-body > :first-child textarea:first-child { margin-top: 0; }
.od-body textarea:not(.k-comment):focus { border-color: var(--od-blue); }
.od-body textarea::placeholder { color: var(--od-muted); }
.od-knob { position: absolute; right: 2px; top: 0; width: 4px; border-radius: 2px; background: var(--od-knob); opacity: 0;
  pointer-events: none; transition: opacity .35s ease; }
.od-knob::before { content: ""; position: absolute; inset: 0 -4px; }
.od-knob.od-on { opacity: .3; pointer-events: auto; transition-duration: .12s; }
.od-knob.od-drag { opacity: .5; }

.od-dock { position: fixed; left: 0; right: 0; margin-inline: auto; width: max-content; max-width: calc(100vw - 24px); box-sizing: border-box;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 2147483001; pointer-events: auto; display: flex; align-items: center;
  justify-content: center; flex-wrap: wrap; gap: 8px; padding: 6px; border-radius: 999px; background: var(--od-dock); color: var(--od-ink);
  border: .5px solid var(--od-line); box-shadow: var(--od-shadow), inset 0 1px 0 var(--od-hi); font: 600 14px/1 var(--od-font);
  backdrop-filter: blur(28px) saturate(1.8); -webkit-backdrop-filter: blur(28px) saturate(1.8); }
.od-dock > button, .od-dock > output { all: unset; box-sizing: border-box; padding: 8px 14px; border-radius: 999px; cursor: pointer; white-space: nowrap;
  font: 600 14px/1 var(--od-font); color: var(--od-ink); }
.od-dock > output { cursor: default; color: var(--od-muted); padding: 8px 6px; font-variant-numeric: tabular-nums; }
.od-dock > button[hidden] { display: none; }
.od-dock > button:hover, .od-dock > button:focus-visible { background: var(--od-fill); }
.od-dock > .od-primary, .od-dock > .od-primary:hover, .od-dock > .od-primary:focus-visible { background: var(--od-blue); color: #fff; }
.od-ctl { display: flex; align-items: center; gap: 4px; font: 600 14px/1 var(--od-font); color: var(--od-ink); }
.od-ctl button { all: unset; box-sizing: border-box; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.od-ctl .od-step { display: flex; align-items: center; padding: 2px; border-radius: 999px; background: var(--od-fill); }
.od-ctl .od-nav { width: 28px; height: 28px; padding: 0; border-radius: 50%; display: grid; place-items: center; }
.od-ctl .od-nav svg { width: 11px; height: 11px; }
.od-ctl .od-count { all: unset; box-sizing: border-box; height: 28px; padding: 0 4px; border-radius: 999px; display: flex; align-items: center;
  justify-content: center; gap: 5px; font: 600 13px/1 var(--od-font); font-variant-numeric: tabular-nums; white-space: nowrap; }
.od-ctl .od-count::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--od-blue); flex: none; }
.od-ctl button:hover, .od-ctl button:focus-visible { background: var(--od-fill); }
.od-ctl .od-step button:hover, .od-ctl .od-step button:focus-visible { background: var(--od-fill); }
.od-ctl .od-eye { width: 32px; height: 32px; padding: 0; border-radius: 50%; display: grid; place-items: center; color: var(--od-muted);
  transition: background-color .15s ease, color .15s ease; }
.od-ctl .od-eye svg { width: 17px; height: 17px; }
.od-ctl .od-eye[aria-checked="true"] { color: var(--od-blue); background: color-mix(in srgb, var(--od-blue) 14%, transparent); }

/* option rows and the comment field, the same look as the kit's options in a popover */
.od-opts { display: grid; gap: 10px; }
.od-opt { all: unset; box-sizing: border-box; position: relative; overflow: hidden; display: flex; align-items: flex-start; gap: 10px; padding: 12px;
  border-radius: 14px; border: 2px solid transparent; background: var(--od-card); box-shadow: var(--od-shadow); cursor: pointer;
  font: 15px/1.3 var(--od-font); color: var(--od-ink); transition: border-color .18s ease; }
.od-opt:hover, .od-opt:focus-visible { border-color: color-mix(in srgb, var(--od-blue) 35%, transparent); }
.od-opt[aria-selected="true"] { border-color: var(--od-blue); }
.od-radio { width: 20px; height: 20px; margin-top: -0.5px; border-radius: 50%; border: 1.5px solid var(--od-line); flex: none; display: grid; place-items: center; }
.od-opt[aria-selected="true"] .od-radio { border-color: var(--od-blue); background: var(--od-blue); }
.od-opt[aria-selected="true"] .od-radio::after { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #fff; }
.od-name { font-weight: 600; min-width: 0; }
.od-name .od-num { color: var(--od-muted); font-weight: 500; font-variant-numeric: tabular-nums; margin-right: 6px; }
.od-name small { display: block; font-size: 12px; font-weight: 500; margin-top: 2px; color: var(--od-muted); }
.od-dot:focus-visible, .od-pop :focus-visible, .od-dock :focus-visible, .od-ctl :focus-visible { outline: none !important; }

@media (max-width: 600px) {
  .od-pop { left: 8px !important; right: 8px; top: auto !important; bottom: calc(8px + env(safe-area-inset-bottom, 0px)); width: auto !important;
    min-width: 0; max-width: none; max-height: 60vh !important; border-radius: 18px; transform-origin: bottom center; transform: translateY(16px); }
  .od-body textarea:not(.k-comment) { font-size: 16px; } /* 16 px stops iOS zoom on focus */
}
@media (prefers-reduced-motion: reduce) {
  .od-dot, .od-pop, .od-pop.od-show, .od-ctl .od-eye, .od-opt { transition: none !important; }
  .od-dot.od-pulse::after { animation: none; }
}`;
  const svg = (d, w = 1.7) => `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const BUBBLE = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2h7A1.5 1.5 0 0 1 11 3.5v4A1.5 1.5 0 0 1 9.5 9H6L3.5 11V9h-1A1.5 1.5 0 0 1 1 7.5v-4A1.5 1.5 0 0 1 2.5 2Z" fill="currentColor"/></svg>';

  const EYE_D = 'M1.5 8S3.9 3.5 8 3.5 14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z';
  const eyeSvg = (slash) => `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="${EYE_D}"/><circle cx="8" cy="8" r="2.1"/>${slash ? '<path d="M2.5 2.5l11 11"/>' : ''}</svg>`;
  const EYE = eyeSvg(false), EYE_OFF = eyeSvg(true);

  window.OptionDots = (o = {}) => {
    const d = document, root = o.root || d.body, host = root.host, themeEl = o.theme || host || d.documentElement;
    const key = o.key || 'od-hidden:' + location.pathname, DOCK = 72, M = 8;
    const sheetMQ = matchMedia('(max-width: 600px)'), darkMQ = matchMedia('(prefers-color-scheme: dark)');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const el = (t, c, html) => { const n = d.createElement(t); if (c) n.className = c; if (html) n.innerHTML = html; return n; };
    const btn = (c, html, label) => { const b = el('button', c, html); b.type = 'button'; if (label) { b.setAttribute('aria-label', label); b.title = label; } return b; };
    const recs = [];
    let hidden = false, shown = null, cur = null, raf = 0, placeNow = false, knobT = 0;
    try { hidden = localStorage.getItem(key) === '1'; } catch {}

    const style = el('style'); style.textContent = CSS; (host ? root : d.head).append(style);
    const layer = el('div', 'od-layer'), pop = el('div', 'od-pop'), head = el('div', 'od-head'), body = el('div', 'od-body'), knob = el('div', 'od-knob');
    pop.setAttribute('role', 'dialog'); pop.append(head, body, knob); root.append(layer, pop);

    // The dock part: back, "n / N" (blue dots), next, Hide dots.
    const ctl = el('div', 'od-ctl'); ctl.setAttribute('role', 'group'); ctl.setAttribute('aria-label', 'Option dots');
    const back = btn('od-nav', svg('M7.5 2.5 4 6l3.5 3.5'), 'Back to the previous dot to pick  ['), next = btn('od-nav', svg('M4.5 2.5 8 6l-3.5 3.5'), 'Next dot to pick  ]');
    const count = o.list ? btn('od-count', '', 'Every group') : el('output', 'od-count');
    const grp = el('div', 'od-step'); grp.append(back, count, next);
    const eye = btn('od-eye'); eye.setAttribute('role', 'switch'); eye.setAttribute('aria-label', 'Hide dots');
    ctl.append(grp, eye);
    back.onclick = () => step(-1); next.onclick = () => step(1);
    if (o.list) count.onclick = o.list;
    eye.onclick = () => setHidden(!hidden);

    const box = (r) => { if (typeof r.target === 'function') return r.target() || {}; const t = r.target; return t && t.isConnected ? { t, r: t.getBoundingClientRect() } : {}; };
    const order = (a, b) => (a.t && b.t && a.t !== b.t ? (a.t.compareDocumentPosition(b.t) & 4 ? -1 : 1) : 0);
    const blues = () => recs.filter((r) => r.pick).map((r) => Object.assign(r, { t: box(r).t })).filter((r) => r.t).sort(order);

    function sync() {
      const list = blues();
      recs.forEach((r) => {
        r.el.dataset.kind = r.pick ? 'pick' : 'note';
        r.el.setAttribute('aria-label', (r.pick ? 'Options for ' : 'Comment on ') + r.label);
        if (r.pick) r.el.textContent = r.n != null ? r.n : list.indexOf(r) + 1; else r.el.innerHTML = BUBBLE;
      });
      eye.setAttribute('aria-checked', String(hidden)); eye.innerHTML = hidden ? EYE_OFF : EYE;
      eye.title = (hidden ? 'Show dots' : 'Hide dots') + '  ( . )';
      if (!o.list || o.count) count.textContent = o.count ? o.count() : `${cur && list.includes(cur) ? list.indexOf(cur) + 1 : '–'} / ${list.length}`;
      schedule();
    }
    function setHidden(v) {
      hidden = !!v; try { localStorage.setItem(key, hidden ? '1' : '0'); } catch {}
      if (hidden) close();
      sync();
    }

    function add(c) {
      const r = { pos: 'tr', ...c, el: btn('od-dot') };
      r.el.onclick = () => (o.select ? o.select(r) : shown === r ? close() : open(r));
      layer.append(r.el); recs.push(r); sync();
      return r;
    }

    function open(r) {
      if (shown && shown !== r && shown.onClose) shown.onClose();
      shown = r; if (r.pick && r.el) cur = r;
      head.replaceChildren();
      if (r.el) { const m = el('span', 'od-dot od-mini', r.el.innerHTML); m.dataset.kind = r.el.dataset.kind; head.append(m); }
      if (r.label) head.append(r.label);
      pop.setAttribute('aria-label', r.label || 'Options');
      body.replaceChildren(); if (r.render) r.render(body, r);
      recs.forEach((x) => x.el.setAttribute('aria-expanded', String(x === r)));
      body.scrollTop = 0; placeNow = true; place(); pop.classList.add('od-show'); sync();
      if (sheetMQ.matches && r.el) requestAnimationFrame(() => { // bring the target into the free part above the sheet
        const b = box(r).r, top = innerHeight - pop.offsetHeight - M;
        if (b && (b.top < M || b.bottom > top - M)) scrollBy(0, b.top - Math.max(12, (top - b.height) / 2));
      });
    }
    function close() {
      if (!shown) return;
      const r = shown; shown = null; pop.classList.remove('od-show');
      recs.forEach((x) => x.el.setAttribute('aria-expanded', 'false'));
      if (r.onClose) r.onClose();
    }
    function pulse(r) { r.el.classList.remove('od-pulse'); void r.el.offsetWidth; r.el.classList.add('od-pulse'); setTimeout(() => r.el.classList.remove('od-pulse'), 1500); }

    // Back and next: the blue dots in page order, wrapping at the ends. A dot off screen scrolls into view first.
    function step(dir) {
      if (o.step) return o.step(dir);
      const list = blues(); if (!list.length) return;
      let k = list.indexOf(cur); if (k < 0) k = dir > 0 ? -1 : 0;
      go(list[(k + dir + list.length) % list.length], true);
    }
    function go(r, openIt = true) {
      close(); if (r.pick) cur = r; sync();
      return new Promise((res) => {
        const { t, r: b } = box(r); if (!t) return res(false);
        const vh = innerHeight, tall = b.height > vh - DOCK - 16;
        const seen = tall ? b.top >= 0 && b.top < vh / 3 : b.top >= M && b.bottom <= vh - DOCK;
        const done = () => { pulse(r); if (openIt) open(r); res(true); };
        if (seen) return done();
        const smooth = !reduce.matches;
        t.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest', behavior: smooth ? 'smooth' : 'instant' });
        if (!smooth) return requestAnimationFrame(done);
        let fin = false; const f = () => { if (fin) return; fin = true; removeEventListener('scrollend', f, true); done(); };
        addEventListener('scrollend', f, true); setTimeout(f, 900); // 900 ms covers browsers without scrollend
      });
    }

    function place() {
      raf = 0;
      const vw = innerWidth, vh = innerHeight;
      // a fixed or sticky header at the top: other targets' dots stay below its bottom edge, so they never cover its controls
      const bar = d.elementsFromPoint(vw - 40, 2).find((n) => n !== host && !n.closest('.od-layer, .od-pop, .od-dock')
        && /fixed|sticky/.test(getComputedStyle(n).position) && n.offsetWidth >= vw / 2 && n.offsetHeight <= vh / 3);
      const barB = bar ? bar.getBoundingClientRect().bottom : 0;
      for (const r of recs) {
        const { t, r: b } = box(r), top = bar && !(t && bar.contains(t)) ? barB : 0;
        const on = !hidden && b && b.width > 0 && b.bottom > top + 22 && b.top < vh && b.right > 0 && b.left < vw;
        r.el.hidden = !on; r.r = b;
        if (!on) continue;
        // just outside the target's top corner (4 px gap); inside the corner when the target fills the width
        const tl = r.pos === 'tl', out = tl ? b.left >= 30 : b.right + 30 <= vw;
        const x = Math.min(Math.max(tl ? (out ? b.left - 26 : b.left + 8) : (out ? b.right + 4 : b.right - 30), 6), vw - 28);
        const y = out ? Math.min(Math.max(b.top - 26, top + 6), b.bottom - 22) : Math.min(Math.max(b.top + 8, top + 6), b.bottom - 30);
        r.el.style.translate = `${x}px ${y}px`;
      }
      if (shown && shown.el && shown.el.hidden && !hidden) return close();
      if (!shown || !placeNow || sheetMQ.matches) return;
      placeNow = false;
      // beside the target on the roomiest side (right, left, below, above), so the target stays in view
      const keep = body.scrollTop;
      pop.style.width = pop.style.maxHeight = '';
      let w = pop.offsetWidth, h = pop.offsetHeight, left, top;
      const b = shown.el ? box(shown).r : null;
      if (!b) { // no target (a list): centered just above the dock
        if (h > vh - DOCK - 2 * M) { pop.style.maxHeight = vh - DOCK - 2 * M + 'px'; h = pop.offsetHeight; }
        left = (vw - w) / 2; top = vh - DOCK - h;
      } else {
        const G = 12, GR = shown.pos === 'tl' ? G : 32, GL = shown.pos === 'tl' ? 32 : G; // 32 clears the dot
        const room = { right: vw - b.right - GR - M, left: b.left - GL - M, below: vh - b.bottom - G - DOCK, above: b.top - G - M };
        const low = h + M + DOCK <= vh ? vh - DOCK : vh - M; // stay above the dock when there is room
        const side = ['right', 'left'].find((s) => room[s] >= w) || ['right', 'left'].find((s) => room[s] >= 260)
          || ['below', 'above'].find((s) => room[s] >= Math.min(h, 320)) || 'inside';
        if (side === 'inside') { // the target fills the window: float at its top right, under the dot
          const max = vh - 2 * M - DOCK;
          if (h > max) { pop.style.maxHeight = max + 'px'; h = max; }
          left = vw - w - M; top = Math.min(Math.max(shown.el.getBoundingClientRect().bottom + 8, M), vh - DOCK - h);
        } else if (side === 'right' || side === 'left') {
          if (w > room[side]) { pop.style.width = room[side] + 'px'; w = pop.offsetWidth; h = pop.offsetHeight; }
          left = side === 'right' ? b.right + GR : b.left - GL - w;
          top = Math.min(Math.max(b.top, M), low - h);
        } else {
          const max = Math.max(room[side], 160);
          if (h > max) { pop.style.maxHeight = max + 'px'; h = max; }
          top = Math.min(Math.max(side === 'below' ? b.bottom + G : b.top - G - h, M), vh - h - M);
          left = Math.min(Math.max(b.left, M), vw - w - M);
        }
      }
      Object.assign(pop.style, { left: Math.max(left, M) + 'px', top: Math.max(top, M) + 'px' });
      body.scrollTop = keep;
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(place); };

    // Thin overlay knob: shows while the body scrolls or the pointer is at its right edge, fades 2 s later.
    function flash() {
      const ch = body.clientHeight, sh = body.scrollHeight;
      if (sh <= ch + 1) return knob.classList.remove('od-on');
      const len = Math.max(40, (ch * ch) / sh), y = body.offsetTop + 3 + (body.scrollTop / (sh - ch)) * (ch - 6 - len);
      Object.assign(knob.style, { height: len + 'px', transform: `translateY(${y}px)` });
      knob.classList.add('od-on'); clearTimeout(knobT);
      knobT = setTimeout(() => { if (!knob.classList.contains('od-drag')) knob.classList.remove('od-on'); }, 2000);
    }
    body.onscroll = flash;
    pop.onpointermove = (e) => { if (e.clientX > pop.getBoundingClientRect().right - 16) flash(); };
    knob.onpointerdown = (e) => {
      e.preventDefault(); knob.setPointerCapture(e.pointerId); knob.classList.add('od-drag');
      const y0 = e.clientY, s0 = body.scrollTop, k = body.scrollHeight / body.clientHeight;
      knob.onpointermove = (m) => { body.scrollTop = s0 + (m.clientY - y0) * k; };
      knob.onpointerup = knob.onpointercancel = () => { knob.onpointermove = null; knob.classList.remove('od-drag'); flash(); };
    };

    // Dark when the page background is dark, else a one-sided color-scheme, else the system setting.
    const cv = d.createElement('canvas').getContext('2d', { willReadFrequently: true });
    function theme() {
      let dark = null;
      for (const n of [d.body, d.documentElement]) {
        cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#0000'; cv.fillStyle = getComputedStyle(n).backgroundColor; cv.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = cv.getImageData(0, 0, 1, 1).data;
        if (a > 128) { dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 128; break; }
      }
      if (dark === null) { const cs = getComputedStyle(d.documentElement).colorScheme; if (/dark/.test(cs) !== /light/.test(cs)) dark = /dark/.test(cs); }
      themeEl.toggleAttribute('data-od-dark', dark ?? darkMQ.matches);
    }
    theme(); darkMQ.addEventListener('change', theme);
    const attrs = { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] };
    new MutationObserver(theme).observe(d.documentElement, attrs); new MutationObserver(theme).observe(d.body, attrs);

    addEventListener('scroll', (e) => { // only a scroll that moves the target re-places the popover
      const t = shown && shown.el && box(shown).t;
      if (t && performance.now() > api.freeze && (e.target === d || (e.target.contains && e.target.contains(t)))) placeNow = true;
      schedule();
    }, { passive: true, capture: true });
    addEventListener('resize', () => { placeNow = true; schedule(); });
    try { new ResizeObserver(schedule).observe(d.body); } catch {}
    new MutationObserver(schedule).observe(d.body, { childList: true, subtree: true });
    addEventListener('pointerdown', (e) => {
      if (!shown) return;
      const p = e.composedPath();
      if (p.includes(pop) || p.includes(ctl) || (shown.el && p.includes(shown.el)) || p.some((n) => n.hasAttribute && n.hasAttribute('data-od-keep'))) return;
      close();
    }, true);
    addEventListener('keydown', (e) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') return close();
      const t = e.composedPath()[0];
      if (!['.', '[', ']'].includes(e.key) || e.metaKey || e.ctrlKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
      if (e.key === '.') setHidden(!hidden); else step(e.key === ']' ? 1 : -1);
    });

    function dock(...buttons) {
      const k = el('div', 'od-dock'); k.setAttribute('role', 'toolbar'); k.setAttribute('aria-label', 'Options'); k.setAttribute('data-od-keep', '');
      k.append(ctl, ...buttons); root.append(k); return k;
    }
    const api = { add, open, close, go, step, sync, schedule, pulse, dock, setHidden, controls: ctl, count, pop, body, layer, freeze: 0,
      get hidden() { return hidden; }, get shown() { return shown; }, get current() { return cur; }, set current(r) { cur = r; sync(); } };
    sync();
    return api;
  };
})();
/* option-dots:end */
(() => {
  if (window.DevPanel) return;
  const KEY = 'devpanel', GO = 'devpanel:go', Q = new URLSearchParams(location.search);
  // Loaded from another origin (serve.mjs on 4799 inside a Vite app): the page is an SPA that routes itself.
  const me = document.currentScript, spa = !!me && new URL(me.src, location.href).origin !== location.origin;
  const forced = Object.fromEntries((Q.get('dv-pick') || '').split(',').map((s) => s.split(':')).filter((p) => p[1] > 0).map(([k, v]) => [k, +v]));
  const st = { picks: {}, notes: {}, groups: [] }, cfg = {};
  let key = KEY, base = ''; // base: the site this page belongs to (DevPanel.config({ site })), '' = the whole origin
  function load() {
    Object.assign(st, { picks: {}, notes: {}, groups: [] });
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved) Object.assign(st, saved);
      else if (!base) for (let i = 0; i < localStorage.length; i++) { // picks from the old per-page keys
        const k = localStorage.key(i), o = k.startsWith('devpanel:/') && JSON.parse(localStorage.getItem(k));
        if (o) { Object.assign(st.picks, o.picks); Object.assign(st.notes, o.notes); }
      }
    } catch {}
    delete st.hidden; // Hide dots lives in the shared overlay now
  }
  load();
  const save = () => { if (Q.has('dv-pick')) return; try { localStorage.setItem(key, JSON.stringify(st)); } catch {} };
  const groups = []; // groups registered on this page; st.groups holds every group seen on the site
  // Paths compare without index.html or a trailing slash, but navigation uses the path as written:
  // /memory/ and /memory serve the same file, yet only /memory/ resolves its relative images and CSS.
  const norm = (p) => String(p || '/').replace(/\/index\.html?$/, '/').replace(/(.)\/+$/, '$1');
  const here = () => norm(location.pathname);
  const home = (m) => m.page ? norm(m.page[0]) : null;
  const isHere = (m) => !!m.page && m.page.map(norm).includes(here());
  const inBase = (p) => (norm(p) + '/').startsWith(base);
  const meta = (id) => st.groups.find((m) => m.id === id);
  // Site order: pages in the order they were first seen, groups in the order they were added; unknown page last.
  function site() {
    const pages = [...new Set(st.groups.map(home))].sort((a, b) => (a === null) - (b === null));
    return pages.flatMap((p) => st.groups.filter((m) => home(m) === p));
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let host, sh, od, hl, gls, panel, picksOut, copyBtn, open = null, lit = null, glowA = null, raf = 0;
  let previewT = 0, hoverT = 0, busyN = 0;
  let curId = null, goN = 0, sayT = 0, posText = ''; // back/next: the current group
  let listOpen = false; // the count button's list of every group on the site

  const CSS = `
:host { all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; color-scheme: light;
  --blue: #007aff; --ink: #1d1d1f; --muted: rgba(60,60,67,.6); --sep: rgba(0,0,0,.09);
  font: 13px/1.35 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif; color: var(--ink);
  -webkit-font-smoothing: antialiased; }
:host([data-od-dark]) { color-scheme: dark; --blue: #0a84ff; --ink: #f5f5f7; --muted: rgba(235,235,245,.6); --sep: rgba(255,255,255,.1); }
* { box-sizing: border-box; outline: none !important; -webkit-tap-highlight-color: transparent; }
button, textarea { font: inherit; color: inherit; }
button { cursor: pointer; border: 0; background: none; padding: 0; }
[hidden] { display: none !important; }

/* changed-element glow: four thin red lines on the target's edges, a soft glow, ends that fade out. No fill.
   It pulses once (fade in, then out) per hover of a dock option or a dot; paint only, so the page never moves. */
.hl { position: absolute; inset: 0; opacity: 0; --red: #ff3b30; }
:host([data-od-dark]) .hl { --red: #ff453a; }
.gl { position: absolute; left: 0; top: 0; background: var(--red); box-shadow: 0 0 6px 1px var(--red); }
.gl.h { height: 1px; -webkit-mask: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
  mask: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent); }
.gl.v { width: 1px; -webkit-mask: linear-gradient(180deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
  mask: linear-gradient(180deg, transparent, #000 24px, #000 calc(100% - 24px), transparent); }
.hl.hold { opacity: .4; }

/* the current group in the dock: name and note, options as a segmented control, comment field */
.od-dock.dv-has { width: min(720px, calc(100vw - 24px)); border-radius: 24px; justify-content: flex-start; gap: 6px 8px; }
.od-dock.dv-has > .od-ctl { margin-right: auto; }
.dv-panel { order: -1; flex: 1 0 100%; min-width: 0; display: grid; gap: 8px; padding: 8px 8px 4px; }
.dv-panel[hidden] { display: none; }
.dv-head { display: flex; align-items: center; gap: 8px 12px; min-width: 0; }
.dv-label { flex: 1 1 140px; min-width: 0; display: flex; align-items: center; gap: 8px; }
.dv-label > span:last-child { min-width: 0; }
.dv-label b { display: block; font: 600 14px/1.25 var(--od-font); color: var(--od-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dv-note { display: block; min-height: 16px; font: 500 12px/16px var(--od-font); color: var(--od-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dv-seg { flex: 0 1 auto; min-width: 0; overflow: hidden; display: flex; padding: 2px; gap: 2px; border-radius: 999px; background: var(--od-fill); }
.dv-seg button { position: relative; overflow: hidden; flex: 1 0 auto; height: 30px; padding: 0 12px; border-radius: 999px; white-space: nowrap;
  font: 600 13px/1 var(--od-font); color: var(--od-ink); transition: background-color .18s ease, color .18s ease; }
.dv-seg button:hover, .dv-seg button:focus-visible { background: color-mix(in srgb, var(--od-ink) 8%, transparent); }
.dv-seg button[aria-checked="true"] { background: var(--od-blue); color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.18); }
.dv-seg button .n { color: inherit; opacity: .55; font-variant-numeric: tabular-nums; margin-right: 5px; }
/* many options: a compact list of rounded rows instead of one row of segments */
.dv-seg.dv-list { flex-basis: 100%; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); max-height: 30vh;
  overflow-y: auto; border-radius: 14px; scrollbar-width: none; }
.dv-head:has(.dv-list) { flex-wrap: wrap; }
.dv-seg.dv-list button { border-radius: 12px; text-align: left; overflow: hidden; text-overflow: ellipsis; }
.dv-panel textarea { display: block; width: 100%; min-height: 38px; padding: 9px 12px; resize: none; overflow: hidden;
  font: 14px/1.4 var(--od-font); color: var(--od-ink); background: var(--od-card); border: .5px solid var(--od-line); border-radius: 12px; }
.dv-panel textarea:focus { border-color: var(--od-blue); }
.dv-panel textarea::placeholder { color: var(--od-muted); }

/* loading state: a sweep across the hovered option while a preview settles. .opt rows are the list of every group. */
.dv-seg button.loading::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 60%; pointer-events: none;
  animation: dv-sweep .8s linear infinite; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--blue) 16%, transparent), transparent); }
.opt { position: relative; overflow: hidden; display: grid; grid-template-columns: 12px 1fr auto; align-items: start; column-gap: 7px;
  width: 100%; text-align: left; padding: 5px 9px 6px 7px; border-radius: 8px; }
.opt:hover, .opt:focus-visible { background: var(--blue); color: #fff; }
.opt .ck { font-size: 11px; font-weight: 700; line-height: 18px; visibility: hidden; }
.opt[aria-selected="true"] .ck { visibility: visible; }
.opt .name { display: block; line-height: 18px; }
.opt .note { display: block; color: var(--muted); font-size: 12px; line-height: 1.3; margin-bottom: 1px; }
.opt .n { color: var(--muted); font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; padding-left: 10px; }
.opt:hover .note, .opt:hover .n, .opt:focus-visible .note, .opt:focus-visible .n { color: rgba(255,255,255,.82); }
@keyframes dv-sweep { from { transform: translateX(-100%); } to { transform: translateX(223%); } }
.sep { height: 1px; margin: 6px 9px; background: var(--sep); }
/* the list of every group: page path heads, the group's label, its pick as the note */
.ghead { padding: 6px 9px 4px; font-size: 12px; font-weight: 600; color: var(--muted); }
.ghead .here { font-weight: 400; }
.row .n { min-width: 22px; text-align: right; }
.row:disabled { cursor: default; opacity: .55; }
.row:disabled:hover { background: none; color: inherit; }
.row:disabled:hover .note, .row:disabled:hover .n { color: var(--muted); }
.od-dock > .picks.say { color: var(--ink); white-space: normal; max-width: 260px; }
@media (max-width: 600px) {
  .opt { padding: 9px 9px 9px 7px; }
  .od-dock > .picks:not(.say) { display: none; } /* room for back and next at phone width */
  .od-dock > button { padding: 8px 10px; }
  .dv-head { flex-wrap: wrap; }
  .dv-label { flex-basis: 100%; }
  .dv-seg { flex: 1 1 100%; }
  .dv-panel textarea { font-size: 16px; } /* 16 px stops iOS zoom on focus */
}
@media (prefers-reduced-motion: reduce) { .dv-seg button.loading::after { animation: none; left: 0; width: 100%; background: color-mix(in srgb, var(--blue) 8%, transparent); }
  .dv-seg button { transition: none; } }`;

  function mount() {
    if (host || !document.body) return;
    host = document.createElement('dev-panel');
    sh = host.attachShadow({ mode: 'open' });
    // A page view transition lays a snapshot over everything and takes the pointer (the cursor flips to an
    // arrow and clicks hit <html>) until it ends. Let the pointer pass through to the real page and menu.
    document.head.append(Object.assign(document.createElement('style'), { textContent: '::view-transition { pointer-events: none; }' }));
    sh.innerHTML = `<style>${CSS}</style><div class="hl"><div class="gl h"></div><div class="gl h"></div><div class="gl v"></div><div class="gl v"></div></div>`;
    hl = sh.querySelector('.hl'); gls = sh.querySelectorAll('.gl');
    if (Q.has('dv-clean')) host.style.display = 'none';
    document.body.appendChild(host);
    od = window.OptionDots({ root: sh, key: 'devpanel:hidden', step: go, count: () => posText,
      list: () => (listOpen ? od.close() : showList()), select: (r) => { const g = groups.find((x) => x.rec === r); if (g) show(g); } });
    od.count.setAttribute('aria-haspopup', 'dialog'); od.count.title = 'All groups on the site';
    const b = (cls, text, fn) => { const n = document.createElement('button'); n.type = 'button'; n.className = cls; n.textContent = text; n.onclick = fn; return n; };
    picksOut = document.createElement('output'); picksOut.className = 'picks';
    copyBtn = b('od-primary', 'Copy choices', copy);
    // Reset also forgets the site's group list; groups on other pages come back when their page is opened.
    const reset = b('', 'Reset', () => {
      st.picks = {}; st.notes = {}; st.groups = st.groups.filter((m) => groups.some((g) => g.id === m.id));
      save(); od.close(); groups.forEach((g) => setVar(g, 1)); open = null; sync();
    });
    panel = document.createElement('div'); panel.className = 'dv-panel'; panel.hidden = true;
    od.dock(panel, picksOut, reset, copyBtn);
    for (const g of groups) addDot(g);
    sync();
  }

  function addDot(g) {
    g.rec = od.add({ target: () => sample(g), label: g.label, pick: g.opts.length > 0, pos: g.pos });
    g.el = g.rec.el;
    g.el.onpointerenter = (e) => { if (e.pointerType !== 'touch') glow(g); };
    g.el.onpointerleave = unglow;
  }

  // One pulse of the red glow on a group's target per hover: fade in, then out, never looping, never staying on.
  // Reduced motion: a static faint glow while the pointer stays, then gone.
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  function glow(g, hold) {
    if (glowA) glowA.cancel();
    lit = g; place();
    hl.classList.toggle('hold', !!hold || still.matches);
    if (hold || still.matches) return;
    glowA = hl.animate([{ opacity: 0 }, { opacity: 0.45, offset: 0.4 }, { opacity: 0 }], { duration: 800, easing: 'ease-in-out' });
    const a = glowA; a.onfinish = () => { if (glowA === a) { glowA = null; lit = null; } };
  }
  function unglow() { if (still.matches) { hl.classList.remove('hold'); lit = null; } }

  const pick = (g) => st.picks[g.id] || 1;
  function setVar(g, i, force) {
    if (g.cur === i && !force) return; // never apply the same value twice
    const changed = g.cur !== i, attr = 'data-dv-' + g.id, root = document.documentElement;
    g.cur = i;
    if (i === 1 && g.current !== false) root.removeAttribute(attr); else root.setAttribute(attr, String(i));
    try { g.apply && g.apply(i); } catch (e) { console.error('[dev artifacts]', g.id, e); }
    if (changed) { previewT = performance.now(); if (od) od.freeze = previewT + 500; settle(g, i); }
    schedule();
  }
  // Hover previews wait 60 ms and apply only the last one, so a pass over the list doesn't flicker.
  const preview = (g, i) => { clearTimeout(hoverT); hoverT = setTimeout(() => setVar(g, i), 60); };

  // The loading state shows until the change has settled: fonts loaded, 2 frames, and the target's
  // transitions (and a page view transition) finished, at most 600 ms.
  function settle(g, i) {
    ++busyN;
    const el = open === g && panel.querySelector(`[data-i="${i}"]`);
    if (panel) panel.querySelectorAll('.loading').forEach((o) => o.classList.remove('loading'));
    if (el) el.classList.add('loading');
    const t = sample(g).t;
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const finite = (a) => a.effect && a.effect.getComputedTiming().endTime !== Infinity;
    const anims = () => Promise.all([...(t ? t.getAnimations({ subtree: true }) : []),
      ...document.getAnimations().filter((a) => /^::view-transition/.test(a.effect && a.effect.pseudoElement || ''))]
      .filter(finite).map((a) => a.finished.catch(() => {})));
    Promise.race([document.fonts.ready.then(frames).then(anims), new Promise((r) => setTimeout(r, 600))])
      .then(() => { if (el) el.classList.remove('loading'); });
  }

  // The dock panel of the current group: name and note, options (hover previews and pulses the glow, click keeps),
  // then the comment field. A green-dot group has only the comment field.
  function fill(g) {
    if (open !== g && open) { clearTimeout(hoverT); setVar(open, pick(open), true); } // drop the last group's preview
    open = g;
    const note = (i) => (g.opts[i - 1] && g.opts[i - 1].note) || (i === 1 && g.current !== false ? 'The site as it is now' : '');
    panel.innerHTML = `<div class="dv-head"><span class="dv-label"><span class="od-dot od-mini" data-kind="${g.opts.length ? 'pick' : 'note'}"></span>`
      + `<span><b>${esc(g.label)}</b><small class="dv-note"></small></span></span>`
      + (g.opts.length ? `<div class="dv-seg" role="radiogroup" aria-label="${esc(g.label)}">${g.opts.map((o, k) =>
        `<button type="button" role="radio" data-i="${k + 1}" aria-checked="${pick(g) === k + 1}" title="${esc(o.note || o.name)}"><span class="n">${k + 1}</span>${esc(o.name)}</button>`).join('')}</div>` : '')
      + `</div><textarea rows="1" placeholder="Comment on ${esc(g.label)}"></textarea>`;
    panel.hidden = false; panel.parentElement.classList.add('dv-has');
    const mini = panel.querySelector('.od-mini'), noteEl = panel.querySelector('.dv-note');
    mini.innerHTML = g.el ? g.el.innerHTML : '';
    const say = (i) => { noteEl.textContent = g.opts.length ? note(i) : 'Comment only'; };
    say(pick(g));
    const seg = panel.querySelector('.dv-seg'), ta = panel.querySelector('textarea');
    if (seg) {
      seg.onpointerover = (e) => {
        const b = e.target.closest('button'); if (!b || b.contains(e.relatedTarget)) return;
        say(+b.dataset.i); preview(g, +b.dataset.i); if (e.pointerType !== 'touch') glow(g);
      };
      seg.onpointerleave = (e) => { if (!inRect(seg, e)) { say(pick(g)); preview(g, pick(g)); unglow(); } }; // a leave with the pointer still inside is not real
      seg.onclick = (e) => {
        const b = e.target.closest('button'); if (!b) return;
        clearTimeout(hoverT);
        const i = +b.dataset.i; if (i === 1) delete st.picks[g.id]; else st.picks[g.id] = i;
        save(); setVar(g, i, true); say(i);
        seg.querySelectorAll('button').forEach((o) => o.setAttribute('aria-checked', o === b));
        sync();
      };
      // segments that do not fit in one row become a compact list
      requestAnimationFrame(() => seg.classList.toggle('dv-list', g.opts.length > 6 || seg.scrollWidth > seg.clientWidth + 1));
    }
    ta.value = st.notes[g.id] || '';
    const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
    ta.oninput = () => { const v = ta.value; if (v.trim()) st.notes[g.id] = v; else delete st.notes[g.id]; save(); grow(); };
    requestAnimationFrame(grow);
  }
  function show(g) { closeListFlag(); curId = g.id; sync(); }
  const closeListFlag = () => { if (listOpen) od.close(); };

  // The count button opens every group on the site, one head per page. A row goes to its group and opens its menu.
  function showList() {
    od.open({ label: 'All groups', onClose: () => { listOpen = false; od.count.setAttribute('aria-expanded', 'false'); }, render: (body) => {
      const all = site(), pages = [...new Set(all.map(home))];
      body.innerHTML = pages.map((p) => `<div class="ghead">${p === null ? 'Page not seen yet' : esc(p)}${p !== null && p === here() ? '<span class="here"> · this page</span>' : ''}</div>`
        + all.filter((m) => home(m) === p).map((m) => {
          const i = st.picks[m.id] || 1, name = m.opts && m.opts[i - 1];
          return `<button type="button" class="opt row" data-id="${esc(m.id)}" aria-selected="${m.id === curId}"${p === null ? ' disabled title="Open its page once so the dock knows where it is"' : ''}><span class="ck">✓</span><span><span class="name">${esc(m.label)}</span><span class="note">${m.opts && m.opts.length ? `${i} ${esc(name || '?')}` : 'Comment'}</span></span><span class="n">${all.indexOf(m) + 1}</span></button>`;
        }).join('')).join('<div class="sep"></div>');
      body.onclick = (e) => { const b = e.target.closest('.row'); if (b && !b.disabled) goTo(b.dataset.id, true); };
    } });
    listOpen = true; od.count.setAttribute('aria-expanded', 'true');
  }

  function sync() {
    if (!od) return;
    const all = site(), n = all.filter((m) => (st.picks[m.id] || 1) !== 1).length;
    const blue = all.filter((m) => m.opts && m.opts.length), k = blue.findIndex((m) => m.id === curId);
    if (!sayT) { picksOut.textContent = `${n} ${n === 1 ? 'pick' : 'picks'}`; picksOut.classList.remove('say'); }
    posText = `${k < 0 ? '–' : k + 1} / ${blue.length}`;
    for (const g of groups) if (g.rec) g.rec.n = blue.findIndex((m) => m.id === g.id) + 1;
    od.sync();
    // the dock shows the current group; with none yet, the first group on this page (a blue one first)
    if (curId === null && groups.length) curId = (groups.find((x) => x.opts.length) || groups[0]).id;
    const g = groups.find((x) => x.id === curId);
    for (const x of groups) if (x.el) x.el.setAttribute('aria-current', String(x === g));
    if (!g) { panel.hidden = true; panel.parentElement.classList.remove('dv-has'); open = null; }
    else if (open !== g) fill(g);
    else panel.querySelector('.od-mini').innerHTML = g.el ? g.el.innerHTML : '';
  }
  // A short message in the dock's picks slot, such as a group that never showed up.
  function say(text) {
    clearTimeout(sayT); picksOut.textContent = text; picksOut.classList.add('say');
    sayT = setTimeout(() => { sayT = 0; sync(); }, 4000);
  }

  // Back and next walk every blue-dot group on the site in site order and wrap at the ends. A group on another page
  // navigates there first. A group already on screen only flashes; one off screen scrolls to the middle first.
  // The popover opens on the group it lands on.
  function go(d) {
    const list = site().filter((m) => m.page && m.opts && m.opts.length); if (!list.length) return;
    let k = list.findIndex((m) => m.id === curId);
    if (k < 0) { const f = list.findIndex(isHere); k = Math.max(f, 0) - d; } // start on this page
    goTo(list[(k + d + list.length) % list.length].id, true);
  }
  function goTo(id, reopen) {
    const m = meta(id); if (!m) return;
    od.close(); curId = id; sync();
    if (!m.page || isHere(m)) return arrive(id, reopen);
    const path = m.page[0];
    try { sessionStorage.setItem(GO, JSON.stringify({ id, open: reopen, t: Date.now() })); } catch {}
    if (cfg.navigate) cfg.navigate(path);
    else if (!spa) return location.assign(path);
    else { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate', { state: null })); }
    arrive(id, reopen, true);
  }
  // Wait for the group's target to render (an SPA route, a list after a fetch), at most 5 s.
  // After a route change with no DOM change in 600 ms, the app did not route: load the page for real.
  function arrive(id, reopen, routed) {
    const n = ++goN, t0 = performance.now();
    let moved = false;
    const mo = new MutationObserver(() => { moved = true; });
    const end = () => { clearInterval(iv); mo.disconnect(); try { sessionStorage.removeItem(GO); } catch {} };
    const check = () => {
      if (n !== goN) return end();
      const g = groups.find((x) => x.id === id), s = g && sample(g);
      if (s && s.r && s.r.width > 0 && g.rec) { end(); return od.go(g.rec, false).then(() => { if (n !== goN) return; spot(g); if (reopen) show(g); }); }
      const t = performance.now() - t0;
      if (routed && !moved && !cfg.navigate && t > 600) { clearInterval(iv); mo.disconnect(); return location.reload(); }
      if (t > 5000) { end(); const m = meta(id); say(`${m ? m.label : id} is not on ${here()}`); }
    };
    mo.observe(document.body, { childList: true, subtree: true });
    const iv = setInterval(check, 100);
    check();
  }
  const spot = (g) => glow(g);

  // A target that matches many elements (every card) gets its dot, outline, and menu on one sample:
  // the first match in view, picked again on every frame. The options still style every match.
  // sample: 'all' outlines the box around all matches instead.
  const inView = (r) => r.width > 0 && r.bottom > 36 && r.top < innerHeight - 20 && r.right > 0 && r.left < innerWidth;
  function sample(g) {
    const els = [...document.querySelectorAll(g.target)], rs = els.map((t) => t.getBoundingClientRect());
    if (g.sample === 'all' && els.length > 1) {
      const live = rs.filter((r) => r.width > 0);
      if (!live.length) return {};
      const l = Math.min(...live.map((r) => r.left)), t = Math.min(...live.map((r) => r.top));
      const rt = Math.max(...live.map((r) => r.right)), b = Math.max(...live.map((r) => r.bottom));
      return { t: els[0], r: { left: l, top: t, right: rt, bottom: b, width: rt - l, height: b - t } };
    }
    const k = Math.max(0, rs.findIndex(inView));
    return { t: els[k], r: rs[k] };
  }

  const box = (el, x, y, w, h) => { el.style.transform = `translate(${x}px, ${y}px)`; el.style.width = w + 'px'; el.style.height = h + 'px'; };
  const inRect = (el, e) => { const r = el.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };

  // The glow lines follow the pulsing group's target; a group's page is the first page its target shows on.
  function place() {
    raf = 0;
    for (const g of groups) {
      const { r } = sample(g), m = meta(g.id);
      if (m && !m.page && r && r.width > 0) { m.page = [location.pathname]; save(); sync(); }
      g.r = r;
    }
    const r = lit && lit.r;
    hl.hidden = !(r && r.width > 0);
    if (hl.hidden) return;
    const P = 4, E = 24; // lines sit 4 px outside the edges and run 24 px past the corners, fading at the ends
    box(gls[0], r.left - P - E, r.top - P, r.width + 2 * (P + E), 1);
    box(gls[1], r.left - P - E, r.bottom + P - 1, r.width + 2 * (P + E), 1);
    box(gls[2], r.left - P, r.top - P - E, 1, r.height + 2 * (P + E));
    box(gls[3], r.right + P - 1, r.top - P - E, 1, r.height + 2 * (P + E));
  }
  const schedule = () => { if (!raf && od) raf = requestAnimationFrame(place); };

  function md() {
    const all = site(), many = new Set(all.map(home)).size > 1; // name the page only when there are several
    return all.map((m) => {
      const i = st.picks[m.id] || 1, note = (st.notes[m.id] || '').trim(), co = !(m.opts && m.opts.length);
      let s = `- ${m.label}${many && m.page ? ` (${home(m)})` : ''}${co ? (note ? ':' : '') : `: ${i} ${m.opts[i - 1] || '?'}`}`;
      if (note) { const [first, ...rest] = note.split('\n'); s += (co ? ' ' : ' - ') + first + rest.map((l) => '\n  ' + l).join(''); }
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

  addEventListener('scroll', () => schedule(), { passive: true, capture: true });
  addEventListener('resize', () => schedule());
  // While a page view transition runs, Chrome sends every click to <html>. Hand it to the option or dot under the pointer.
  addEventListener('click', (e) => {
    if (!open || e.composedPath()[0] !== document.documentElement) return;
    const b = [...panel.querySelectorAll('[data-i]'), ...od.body.querySelectorAll('.opt'), ...od.layer.children].find((el) => !el.hidden && inRect(el, e));
    if (b) b.click();
  }, true);
  const boot = () => {
    mount();
    try { new ResizeObserver(schedule).observe(document.body); } catch {}
    // targets an app renders later (board cards after a fetch) get their dot as soon as they appear
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    const find = (id) => id && groups.find((x) => x.id === id);
    const g = find(Q.get('dv-open')), h = find(Q.get('dv-hl'));
    if (g) setTimeout(() => show(g), 50);
    if (h) setTimeout(() => glow(h, true), 50);
    // back or next loaded this page: finish the trip to its group
    let go = null; try { go = JSON.parse(sessionStorage.getItem(GO)); } catch {}
    if (go && Date.now() - go.t < 15000) { curId = go.id; sync(); arrive(go.id, go.open); }
  };
  addEventListener('popstate', () => { sync(); }); // an SPA route change: "this page" moved
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot);

  // The tab title lives only in this injected code; an SPA that rewrites <title> gets it set back.
  let titleMo;
  function setTitle(t) {
    const put = () => { if (document.title !== t) document.title = t; };
    put();
    if (titleMo) titleMo.disconnect();
    titleMo = new MutationObserver(put);
    titleMo.observe(document.head, { childList: true, subtree: true, characterData: true });
  }
  setTimeout(() => cfg.title || console.warn("DevPanel: no title. Add DevPanel.config({ title: '<project> > <topic>' }) to variants.js"), 1500);

  window.DevPanel = {
    group(cfg) {
      if (!cfg || !cfg.id || !cfg.target || !Array.isArray(cfg.options)) throw new Error('DevPanel.group needs id, target, options');
      if (!/^[a-z0-9-]+$/.test(cfg.id)) throw new Error('DevPanel id must be lowercase letters, digits, or dashes: ' + cfg.id);
      if (base && cfg.page && ![].concat(cfg.page).some(inBase)) return null; // a group of another site on this server
      const g = { ...cfg, label: cfg.label || cfg.id, pos: cfg.dot || 'tr',
        opts: cfg.current === false ? cfg.options : [{ name: 'Current' }, ...cfg.options] };
      if (forced[g.id]) st.picks[g.id] = forced[g.id];
      if (pick(g) > g.opts.length) delete st.picks[g.id];
      g.cur = 1; // the page starts on option 1
      groups.push(g);
      let m = meta(g.id); if (!m) st.groups.push(m = { id: g.id, page: null });
      Object.assign(m, { label: g.label, opts: g.opts.map((o) => o.name) });
      if (cfg.page) m.page = [].concat(cfg.page);
      save();
      if (g.opts.length && pick(g) !== 1) setVar(g, pick(g));
      if (od) { addDot(g); sync(); }
      return g;
    },
    // title: '<project> > <topic>' for the browser tab, kept while the overlay runs (the site's own <title> returns on reload).
    // site: a base path such as '/memory/', or a list of them: each base is its own site with its own store,
    // count, back and next, and Copy choices. A page outside every base uses the whole-origin store.
    config(c) {
      Object.assign(cfg, c);
      if (c.title) setTitle(c.title);
      if (!('site' in c)) return;
      if (groups.length) throw new Error('Call DevPanel.config({ site }) before DevPanel.group');
      base = [].concat(c.site || []).map((b) => norm(b).replace(/\/?$/, '/')).filter((b) => (here() + '/').startsWith(b))
        .sort((a, b) => b.length - a.length)[0] || '';
      key = base ? KEY + '@' + base : KEY; load(); sync();
    },
    markdown: md,
    open: (id) => { const g = groups.find((x) => x.id === id); if (g) show(g); },
    next: () => go(1), back: () => go(-1), list: () => showList(),
    groups: () => groups.map((g) => ({ id: g.id, label: g.label, target: g.target, page: meta(g.id).page, options: g.opts.map((o) => o.name) })),
  };
})();
