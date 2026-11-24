/* Dev artifacts (DevPanel): a dev-only overlay that shows design options live on a real site.
   DevPanel.group({ id, label, target, options: [{ name, note?, img? }], kind?, page?: '/about' | ['/a', '/b'], dot?: 'tr'|'tl',
     current?: false, sample?: 'first'|'all', apply?(i) })
   Option 1 is "Current" (no attribute) unless current: false. Picking option i > 1 sets data-dv-<id>="<i>" on <html>.
   A group with options gets a blue dot. `options: [], current: false` makes a comment-only group with a green dot.
   kind picks how the dock shows the options (default: chosen from the options):
     'flat'   2-3 short options as one segmented row in the dock (the kit's look),
     'select' a select button in the dock; its popover lists the options,
     'many'   the same with a filter field (8 or more options),
     'images' a grid of thumbnails with a big preview (any option with img).
   Every popover ends with the group's comment field. A group without `page` belongs to the page where its target first
   shows up. Picks, comments, and the list of groups are kept for the whole site (one localStorage key per origin).
   DevPanel.config({ topic: 'buy dialog' }) names the page: the tab title is '<prefix> > <topic>', where serve.mjs puts the
   prefix ('<project> > <Orca tab>', or the repo folder name) in front of this file. An old `title` is read as the topic
   (its last ' > ' part). DevPanel.config({ site: '/memory/' | ['/a/', '/b/'] }) splits one server into separate sites,
   each with its own store; groups whose `page` is on another site are skipped. Call it before DevPanel.group.
   DevPanel.config({ navigate(path) }) lets an app route itself; otherwise an SPA gets pushState + popstate and a
   static site a normal page load. Everything lives in one shadow root, so no style leaks in or out. Never ship this file.
   The dots come from the shared option-dots overlay (dots.js, copied in below). The dock: minimize, back, count, next,
   the current group (a select button, or a segmented row), comment, Hide dots, Copy choices. Minimized it is a small
   capsule; hidden (key h) only a corner handle shows. An empty spacer the dock's height ends the page, so its footer
   can scroll above the dock. Hovering an option or a dot, or arriving at a group, shows faint red guide lines once.
   URL params: ?dv-open=<id> opens a group, ?dv-hl=<id> holds the guide lines (for screenshots),
   ?dv-pick=<id>:<i>[,<id>:<i>] forces options (nothing is saved), ?dv-clean hides the whole overlay.
   Keys: . hides the dots, h hides the dock, ] and [ go to the next and previous blue dot on any page, arrows and Enter
   move and pick inside a popover, Escape closes it. */
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
     plain: true draws blue dots without a number.
     select(rec): a dot click calls it instead of opening the popover (dev-artifacts shows the group in the dock).
   od.add({ target, label, pick, render(body, rec), onClose(), pos: 'tr'|'tl', n }) -> rec
     target: an element, or a function that returns { t: element, r: rect }. pick: true blue, false green.
     render fills the popover body each time it opens. n: the number on a blue dot (default: its place on the page).
   od.open(rec): rec may carry anchor (a dock button: the popover grows up out of it) and reveal() (a rect the popover
     must not cover: the page scrolls it into the free part). od.close(), od.go(rec, open) -> Promise, od.step(d), od.sync(), od.controls, od.dock(...buttons).
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
.od-dot.od-plain { width: 14px; height: 14px; margin: 4px; font-size: 0; } /* no number: a small plain dot in the 22 px spot */
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
  width: max-content; min-width: 260px; max-width: min(380px, calc(100vw - 16px)); max-height: 70vh; overflow: hidden;
  border-radius: 14px; background: var(--od-pop); color: var(--od-ink); border: .5px solid var(--od-line); box-shadow: 0 12px 32px rgba(0,0,0,.2);
  backdrop-filter: blur(24px) saturate(1.6); -webkit-backdrop-filter: blur(24px) saturate(1.6); font: 14px/1.45 var(--od-font); text-align: left;
  transform-origin: top left; opacity: 0; transform: translateY(-4px) scale(.98); visibility: hidden; pointer-events: none;
  transition: opacity var(--od-close) var(--od-out), transform var(--od-close) var(--od-out), visibility 0s linear var(--od-close); }
.od-pop.od-up:not(.od-show) { transform: translateY(6px) scale(.97); } /* anchored to a dock button: grows up out of it */
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
    min-width: 0; max-width: none; max-height: 70vh !important; border-radius: 18px; transform-origin: bottom center; transform: translateY(16px); }
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
    const key = o.key || 'od-hidden:' + location.pathname, M = 8;
    let DOCK = 72, dockEl = null;
    // room the dock takes at the bottom of the window: its real top edge when it shows, else 72 px
    const dockRoom = () => { const r = dockEl && dockEl.getBoundingClientRect(); return (DOCK = r && r.height ? innerHeight - r.top + M : dockEl ? M : 72); };
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
        r.el.classList.toggle('od-plain', !!(o.plain && r.pick));
        if (r.pick) r.el.textContent = o.plain ? '' : r.n != null ? r.n : list.indexOf(r) + 1; else r.el.innerHTML = BUBBLE;
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
      if (r.anchor) r.anchor.setAttribute('aria-expanded', 'true');
      pop.classList.toggle('od-up', !!r.anchor);
      body.scrollTop = 0; placeNow = true; place(); pop.classList.add('od-show'); sync();
      // r.reveal() names the rect the popover must not cover (a dock popover's group target)
      if ((sheetMQ.matches && r.el) || r.reveal) requestAnimationFrame(() => { // bring the target into the free part above the popover
        const b = r.reveal ? r.reveal() : box(r).r, p = pop.getBoundingClientRect(); if (!b || !b.width) return;
        // the floor is the popover's top when the target is under it, else the dock's top
        const under = sheetMQ.matches || !(b.right < p.left || b.left > p.right), top = under ? (sheetMQ.matches ? innerHeight - pop.offsetHeight - M : p.top) : innerHeight - dockRoom();
        if (b.top < M || b.bottom > top - M) scrollBy({ top: b.top - Math.max(12, (top - b.height) / 2), behavior: reduce.matches ? 'instant' : 'smooth' });
      });
    }
    function close() {
      if (!shown) return;
      const r = shown; shown = null; pop.classList.remove('od-show');
      recs.forEach((x) => x.el.setAttribute('aria-expanded', 'false'));
      if (r.anchor) r.anchor.setAttribute('aria-expanded', 'false');
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
        dockRoom();
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
      dockRoom();
      let w = pop.offsetWidth, h = pop.offsetHeight, left, top;
      const b = shown.el ? box(shown).r : null, a = shown.anchor && shown.anchor.getBoundingClientRect();
      if (a) { // a dock button: just above it, its left edge on the button's, grown out of the button's middle
        if (h > a.top - 2 * M) { pop.style.maxHeight = a.top - 2 * M + 'px'; h = pop.offsetHeight; }
        left = Math.min(Math.max(a.left - 6, M), vw - w - M); top = a.top - M - h;
        pop.style.transformOrigin = `${Math.round(a.left + a.width / 2 - left)}px 100%`;
      } else if (!b) { // no target (a list): centered just above the dock
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
      k.append(ctl, ...buttons); root.append(k); dockEl = k; return k;
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
/* kit-css:start: cut from the artifact kit's kit.css by dots-sync.mjs. Do not edit. */
const KIT_CSS = String.raw`
:host { --page: #f2f2f7; --card: #ffffff; --inset: #f2f2f7; --ink: #1c1c1e; --muted: rgba(60,60,67,.62); --line: rgba(60,60,67,.16); --blue: #007aff; --blue-ink: #0062cc; --blue-bg: rgba(0,122,255,.09); --red: #d70015; --red-bg: rgba(255,59,48,.09); --amb: #b25000; --amb-bg: rgba(255,159,10,.13); --grn: #248a3d; --grn-bg: rgba(52,199,89,.12); --gry: rgba(60,60,67,.62); --gry-bg: rgba(120,120,128,.13); --dock: rgba(255,255,255,.66); --dock-hi: rgba(255,255,255,.7); --seg: rgba(120,120,128,.16); --seg-on: #ffffff; --shadow: 0 1px 2px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.06); --zebra: rgba(120,120,128,.06); --sep: rgba(60,60,67,.1); --soft: rgba(120,120,128,.09); --sw-off: rgba(120,120,128,.24); --ref-open: #1a7f37; --ref-merged: #8250df; --ref-draft: #6e7781; --ref-closed: #cf222e; --ref-mine: #e8590c; --pop: rgba(255,255,255,.94); --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", system-ui, sans-serif; --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace; --fs-title: 44px; --fs-h2: 28px; --fs-slide: 34px; --fs-body: 17px; --fs-sm: 15px; --fs-kicker: 13px; --k-ease: linear(0, 0.022, 0.075, 0.147, 0.228, 0.31, 0.391, 0.467, 0.537, 0.601, 0.657, 0.708, 0.751, 0.789, 0.822, 0.85, 0.874, 0.895, 0.912, 0.927, 0.939, 0.949, 0.958, 0.965, 0.971, 0.976, 0.98, 0.984, 0.987, 0.989, 0.991, 0.993, 0.994, 0.995, 0.996, 0.997, 0.997, 0.998, 0.998, 0.998, 1); --k-ease-close: cubic-bezier(.22, 1, .36, 1); --k-open: 380ms; --k-close: 220ms; --k-fade: 100ms; --k-morph-in: 150ms; --k-morph-out: 100ms; --k-words-at: 40ms; --k-stagger: 12ms; --gutter-l: max(16px, env(safe-area-inset-left, 0px)); --gutter-r: max(16px, env(safe-area-inset-right, 0px)); --m-canvas: #09090b; --m-text: #f4f4f7; --m-sec: rgba(244,244,247,.66); --m-tile: #18181c; --m-line: rgba(255,255,255,.14); --m-glass: rgba(20,20,25,.78); --m-on: #34c759; --m-red: #f14c35; --m-knob: #ffffff; }
:host([data-od-dark]) { --page: #000000; --card: #1c1c1e; --inset: #000000; --ink: #f2f2f7; --muted: rgba(235,235,245,.6); --line: rgba(84,84,88,.6); --blue: #0a84ff; --blue-ink: #4da3ff; --blue-bg: rgba(10,132,255,.16); --red: #ff6961; --red-bg: rgba(255,69,58,.16); --amb: #ff9f0a; --amb-bg: rgba(255,159,10,.16); --grn: #30d158; --grn-bg: rgba(48,209,88,.14); --gry: rgba(235,235,245,.6); --gry-bg: rgba(142,142,147,.18); --dock: rgba(40,40,44,.6); --dock-hi: rgba(255,255,255,.14); --seg: rgba(118,118,128,.32); --seg-on: #636366; --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.3); --zebra: rgba(255,255,255,.035); --sep: rgba(84,84,88,.42); --soft: rgba(255,255,255,.06); --sw-off: rgba(120,120,128,.4); --ref-open: #3fb950; --ref-merged: #a371f7; --ref-draft: #8b949e; --ref-closed: #f85149; --ref-mine: #ff922b; --pop: rgba(44,44,48,.94);  }
.k-hint { font-size: 16px; color: var(--muted); margin: 0 0 16px; max-width: 80ch; text-wrap: pretty; }
.k-comment { display: block; width: 100%; margin-top: 12px; font: inherit; font-size: 16px; line-height: 1.4; color: var(--ink); background: var(--card); border: .5px solid var(--line); border-radius: 12px; padding: 11px 14px; min-height: 46px; resize: none; overflow: hidden; outline: none; box-shadow: var(--shadow); field-sizing: content; }
.k-comment::placeholder { color: var(--muted); }
.k-comment:focus { border-color: var(--blue); }
.k-final-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 16px 0 0; padding: 0 2px; font-size: var(--fs-sm); font-weight: 500; }
.k-final-bar > label { cursor: pointer; color: var(--ink); user-select: none; }
.k-final { position: relative; flex: none; width: 42px; height: 26px; padding: 0; border: 0; border-radius: 13px; cursor: pointer; background: var(--sw-off); transition: background-color .2s ease; }
.k-final::after { content: ""; position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.28), 0 0 0 .5px rgba(0,0,0,.06); transition: transform .2s cubic-bezier(.3,.7,.3,1); }
.k-final[aria-checked="true"] { background: var(--blue); }
.k-final[aria-checked="true"]::after { transform: translateX(16px); }
.k-final:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; border-radius: 13px; }
.k-dots button[hidden] { display: none; }
.k-dock { position: fixed; left: 0; right: 0; margin-inline: auto; width: max-content; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 20; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; padding: 6px; max-width: calc(100vw - 24px); border-radius: 999px; background: var(--dock); backdrop-filter: blur(28px) saturate(1.8); -webkit-backdrop-filter: blur(28px) saturate(1.8); border: .5px solid var(--line); box-shadow: var(--shadow), inset 0 1px 0 var(--dock-hi); }
.k-dock button { font: inherit; font-size: 14px; font-weight: 600; line-height: 1; color: var(--ink); background: transparent; border: 0; border-radius: 999px; padding: 8px 14px; cursor: pointer; white-space: nowrap; }
.k-dock .k-nav { width: 32px; height: 32px; padding: 0; font-size: 20px; display: grid; place-items: center; }
.k-dock .k-nav:disabled { opacity: .3; cursor: default; }
.k-dock output { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; padding: 0 4px; white-space: nowrap; min-width: 40px; text-align: center; }
.k-dots { display: flex; align-items: center; gap: 2px; }
.k-dots button { width: 14px; height: 14px; padding: 0; display: grid; place-items: center; }
.k-dots button::after { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--muted); opacity: .45; transition: transform .2s ease, opacity .2s ease; }
.k-dots button[aria-current="true"]::after { opacity: 1; background: var(--blue); transform: scale(1.35); }
.k-seg { display: flex; align-items: center; background: var(--seg); border-radius: 999px; padding: 2px; }
.k-seg button { padding: 6px 10px; }
.k-seg-label { font-size: 14px; font-weight: 600; color: var(--muted); padding: 0 6px 0 10px; white-space: nowrap; }
.k-seg button[aria-pressed="true"] { background: var(--seg-on); box-shadow: 0 1px 3px rgba(0,0,0,.18); }
.k-dock .k-copy { background: var(--blue); color: #fff; }`;
/* kit-css:end */
  const Q = new URLSearchParams(location.search), SET = Q.has('dv-set') ? ':' + Q.get('dv-set') : ''; // ?dv-set: a frame's own store
  const KEY = 'devpanel', GO = 'devpanel:go', DOCK_KEY = 'devpanel:dock' + SET, FOCUS_KEY = 'devpanel:focus' + SET;
  // Loaded from another origin (serve.mjs on 4799 inside a Vite app): the page is an SPA that routes itself.
  const me = document.currentScript, spa = !!me && new URL(me.src, location.href).origin !== location.origin;
  const PREFIX = String(window.__dvTitlePrefix || ''); // '<project> > <Orca tab>', set by serve.mjs in front of this file
  const forced = Object.fromEntries((Q.get('dv-pick') || '').split(',').map((s) => s.split(':')).filter((p) => p[1] > 0).map(([k, v]) => [k, +v]));
  const st = { picks: {}, notes: {}, groups: [], fin: {}, last: {} };
  // Look and behavior settings (DevPanel.config). markers: 'dot' (a small plain dot), 'none' (only the guide lines), 'dock'
  // (dots only while the dock is open). arrows: 'groups', or 'options' (back and next change the pick; Shift for groups).
  // inline: options shown in the dock, 3 (then "…"), 'fit' (one row) or 'all'. rounds: 'auto' or 'ask'.
  // ?dv-set={json} sets them for one page (the options page frames), with its own store.
  const cfg = { markers: 'dot', arrows: 'groups', inline: 3, rounds: 'auto' };
  try { Object.assign(cfg, JSON.parse(Q.get('dv-set') || '{}')); } catch {}
  let key = KEY + SET, base = ''; // base: the site this page belongs to (DevPanel.config({ site })), '' = the whole origin
  function load() {
    Object.assign(st, { picks: {}, notes: {}, groups: [], fin: {}, last: {} });
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
  // Only groups the variants file registers now: a stored group that was removed never counts or copies.
  function site() {
    const live = st.groups.filter((m) => groups.some((g) => g.id === m.id));
    const pages = [...new Set(live.map(home))].sort((a, b) => (a === null) - (b === null));
    return pages.flatMap((p) => live.filter((m) => home(m) === p));
  }
  // Groups the owner can use on this page right now: in the current view (Open or Archived) and with a target here.
  const onPage = (g) => { const m = meta(g.id); return m && m.page ? isHere(m) : !!document.querySelector(g.target); };
  const usable = () => groups.filter((g) => inSet(g) && onPage(g));
  // Every dock count, the pager, the list, back and next use this one set: blue groups the variants file defines now that
  // the owner can reach (a known page, or a target on this page), in site order. Green comment dots never count.
  const browsable = () => site().filter((m) => m.opts && m.opts.length && (m.page || document.querySelector(groups.find((g) => g.id === m.id).target)));
  // Rounds: a group whose options changed (or that is gone) starts fresh; its old pick and comment move to st.last,
  // which "Restore last round" in the "…" menu puts back. Untouched groups keep theirs.
  let round = null, pending = [];
  function retire(id, oldOpts) {
    if (!round) { round = []; st.last = {}; }
    round.push(id);
    if (st.picks[id] || st.notes[id]) st.last[id] = { pick: st.picks[id] ? (oldOpts || [])[st.picks[id] - 1] || null : null, note: st.notes[id] || '' };
    delete st.picks[id]; delete st.notes[id]; delete st.fin[id];
  }
  const lastLive = () => Object.keys(st.last || {}).filter((id) => groups.some((g) => g.id === id));
  function restoreLast() {
    let n = 0;
    for (const id of lastLive()) {
      const g = groups.find((x) => x.id === id), l = st.last[id], i = l.pick ? g.opts.findIndex((o) => o.name === l.pick) + 1 : 0;
      if (l.note && !st.notes[id]) st.notes[id] = l.note;
      if (i > 0) { if (i === 1 && g.current !== false) delete st.picks[id]; else st.picks[id] = i; setVar(g, i, true); }
      n++;
    }
    st.last = {}; save(); od.close(); shownG = null; sync(); say(`Last round is back for ${n} group${n === 1 ? '' : 's'}.`);
  }
  // Drop everything stored for groups the variants file no longer has (also from the last round).
  function prune() {
    const ids = new Set(groups.map((g) => g.id)), keep = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => ids.has(k)));
    st.groups = st.groups.filter((m) => ids.has(m.id));
    st.picks = keep(st.picks); st.notes = keep(st.notes); st.fin = keep(st.fin); st.last = keep(st.last); save();
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let host, sh, od, hl, gls, dockEl, grp, pill, handle, spacer, lb, sayOut, copyBtn, shownG = null, popG = null;
  let lit = null, stillT = 0, raf = 0, hoverT = 0, curId = null, goN = 0, sayT = 0, posText = '', listOpen = false;
  let dockState = 'open', focusOn = 'on', arch = false, pager, more, fz, nUsable = -1;
  try { dockState = ['open', 'min', 'hide'].includes(localStorage.getItem(DOCK_KEY)) ? localStorage.getItem(DOCK_KEY) : 'open'; } catch {}
  try { focusOn = localStorage.getItem(FOCUS_KEY) === 'off' ? 'off' : 'on'; } catch {}
  // Open shows the groups not yet final, Archived the final ones (the kit's Final switch). Copy choices takes only open ones.
  const fin = (id) => !!(st.fin && st.fin[id]);
  const inSet = (m) => fin(m.id) === arch;

  // How the dock shows a group's options; see the header.
  const kind = (g) => !g.opts.length ? 'note' : g.kind || (g.opts.some((o) => o.img) ? 'images' : g.opts.length >= 8 ? 'many'
    : g.opts.length <= 3 && g.opts.reduce((n, o) => n + o.name.length, 0) <= 36 ? 'flat' : 'select');
  // How many options sit inline in the dock (cfg.inline); the rest are behind "…". 'fit' keeps one row (about 40 letters).
  function inlineN(g) {
    if (cfg.inline === 'all') return g.opts.length;
    if (cfg.inline !== 'fit') return Math.min(g.opts.length, +cfg.inline || 3);
    let n = 0, w = 0; for (const o of g.opts) { w += o.name.length + 3; if (w > 40 && n) break; n++; } return n;
  }
  const hasMore = (g) => g.opts.length > inlineN(g);
  const needsPop = (g) => kind(g) === 'note' || hasMore(g);

  const svg = (d, w = 1.6) => `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const CHEV = svg('M3 4.5 6 7.5l3-3'), UP = svg('M3 7.5 6 4.5l3 3'), MIN = svg('M3 6h6');
  const BUBBLE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3h9A1.5 1.5 0 0 1 14 4.5v5a1.5 1.5 0 0 1-1.5 1.5H8l-3 2.5V11H3.5A1.5 1.5 0 0 1 2 9.5v-5A1.5 1.5 0 0 1 3.5 3Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  const DOCKI = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="9.5" width="11" height="4" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6 6.5 8 4.5l2 2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const CSS = `
:host { all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; color-scheme: light; --dv-red: #ff3b30;
  font: 14px/1.35 var(--od-font); color: var(--od-ink); -webkit-font-smoothing: antialiased; }
:host([data-od-dark]) { color-scheme: dark; --dv-red: #ff453a; }
* { box-sizing: border-box; outline: none !important; -webkit-tap-highlight-color: transparent; }
button, textarea, input { font: inherit; color: inherit; }
button { cursor: pointer; border: 0; background: none; padding: 0; }
[hidden] { display: none !important; }
svg { display: block; flex: none; }

/* guide lines: four thin faint red lines on the target's edges, like the guide lines on a chart. They shoot out about a
   third of the window past the target (to the window's edge when it is off screen) and fade at their ends. No fill.
   Paint only, so the page never moves. */
.hl { position: absolute; inset: 0; opacity: 0; }
.gl { position: absolute; left: 0; top: 0; background: var(--dv-red); }
.gl.h { height: 1px; -webkit-mask: linear-gradient(90deg, transparent, #000 var(--e), #000 calc(100% - var(--e)), transparent);
  mask: linear-gradient(90deg, transparent, #000 var(--e), #000 calc(100% - var(--e)), transparent); }
.gl.v { width: 1px; -webkit-mask: linear-gradient(180deg, transparent, #000 var(--e), #000 calc(100% - var(--e)), transparent);
  mask: linear-gradient(180deg, transparent, #000 var(--e), #000 calc(100% - var(--e)), transparent); }
.hl.hold { opacity: .5; }

/* Focus: the current group's target stays sharp, the rest of the page takes a light veil of the page's own color
   (like the kit's opacity .8). One box with a huge shadow, so it is paint only. */
.fz { position: absolute; left: 0; top: 0; border-radius: 10px; box-shadow: 0 0 0 200vmax var(--fz); opacity: 0; transition: opacity 160ms ease; }
.fz.on { opacity: 1; }

/* the dock: the kit's capsule. Order: minimize, pager (back, count, dots, next), the group, Open/Archived, Focus,
   Hide dots, Clear, Copy choices. On a phone, Open/Archived, Focus and Clear move into the "…" menu. */
.od-dock { gap: 6px; flex-wrap: wrap; }
.od-dock.dv-wrap { border-radius: 24px; }
.od-ctl { display: contents; }
/* two classes each: the shared overlay's ".od-ctl button { all: unset }" would reset a one-class order */
.od-dock .dv-min { order: 0; } .od-dock .od-step { order: 1; } .od-dock .dv-grp { order: 2; } .od-dock .dv-arch { order: 3; }
.od-dock .dv-focus { order: 4; } .od-dock .od-eye { order: 5; } .od-dock .dv-clear { order: 6; } .od-dock .dv-more { order: 7; }
.od-dock .dv-say { order: 8; } .od-dock .od-primary { order: 9; }
.od-dock .dv-ib.dv-more { display: none; font-size: 18px; letter-spacing: 1px; }
:host([data-last]) .od-dock .dv-ib.dv-more { display: grid; } /* "Restore last round" lives there */
/* markers: 'none' hides the dots (the guide lines still show), 'dock' shows them only while the dock is open */
:host([data-markers="none"]) .od-dot, :host([data-markers="dock"]:not([data-dock="open"])) .od-dot { display: none !important; }
.dv-ask { all: unset; cursor: pointer; margin-left: 8px; padding: 4px 10px; border-radius: 999px; background: var(--od-fill); font-weight: 600; }
.dv-ask:hover { background: var(--seg); }
.od-dock .dv-moreo { letter-spacing: .5px; }
/* the tooltip over an inline option: its one-line note */
.dv-tip { position: fixed; left: 0; top: 0; z-index: 2147483003; max-width: 260px; padding: 6px 9px; border-radius: 8px; pointer-events: none;
  background: var(--od-pop); color: var(--od-ink); border: .5px solid var(--od-line); box-shadow: var(--od-shadow);
  font: 500 12px/1.3 var(--od-font); opacity: 0; transition: opacity .12s ease; }
.dv-tip.on { opacity: 1; transition-delay: .25s; }
.od-ctl .od-step { background: none; padding: 0; gap: 0; }
.od-step .k-dots { display: flex; gap: 2px; margin: 0 2px; }
.od-step .k-dots[hidden] { display: none; }
/* ".od-ctl button { all: unset }" would undo the kit's dot buttons */
.od-step .k-dots button { width: 14px; height: 14px; padding: 0; display: grid; place-items: center; cursor: pointer; border-radius: 50%; }
/* no hover pills: hover changes only the text color, like the kit's dock */
.od-dock .od-ctl button:hover, .od-dock .od-ctl .od-step button:hover, .od-dock .od-ctl .od-eye[aria-checked="true"] { background: none; }
.od-dock .k-seg button:not([aria-pressed="true"]):not(.dv-sel):not(.dv-lab):hover, .od-dock .dv-ib:hover, .od-dock .od-nav:hover:not(:disabled),
  .od-dock .dv-clear:hover, .od-dock .od-count:hover { color: var(--od-blue); }
.od-dock .k-dots button:hover::after { opacity: .8; }
.dv-xs { display: grid; gap: 10px; justify-items: start; }
.dv-xs .k-seg button, .dv-xs .k-clear { font: 600 14px/1 var(--od-font); color: var(--ink); border-radius: 999px; padding: 8px 14px; }
.dv-xs .k-seg button { padding: 6px 10px; }
.od-body .k-final-bar { margin-top: 12px; padding: 10px 2px 0; border-top: .5px solid var(--sep); font-size: 14px; }
.od-ctl .od-nav, .dv-ib, .od-dock > .dv-ib { width: 32px; padding: 0; height: 32px; border-radius: 50%; display: grid; place-items: center; color: var(--od-ink); }
.od-ctl .od-nav svg { width: 12px; height: 12px; }
.od-ctl .od-count { height: 32px; padding: 0 6px; font: 600 14px/1 var(--od-font); min-width: 44px; }
.od-ctl .od-count::before { content: none; }
.od-ctl .od-eye { transition: none; }
.dv-ib svg { width: 16px; height: 16px; }
.dv-min svg { width: 13px; height: 13px; }
.od-ctl .od-count[aria-expanded="true"] { color: var(--od-blue); }
.od-dock > .od-primary:hover { background: var(--od-blue); filter: brightness(1.08); }
.dv-ib[data-on="true"] { color: var(--od-blue); }
.dv-say { color: var(--od-ink); font: 500 13px/1.3 var(--od-font); max-width: 240px; padding: 0 6px; }

/* the current group: the kit's segmented control (k-seg). Its label (k-seg-label), then the options (flat) or a select
   button with the pick (the other kinds). The pick sits on the kit's raised thumb. */
.dv-grp { display: flex; align-items: center; gap: 2px; min-width: 0; max-width: 100%; }
.dv-track.k-seg { flex-wrap: wrap; min-width: 0; max-width: 100%; }
.od-dock.k-dock.dv-wrap .dv-track { border-radius: 18px; }
.od-dock .dv-lab.k-seg-label { display: flex; align-items: center; gap: 7px; min-width: 0; max-width: 240px; padding: 6px 6px 6px 8px; background: none; }
.dv-lab span:last-child { overflow: hidden; text-overflow: ellipsis; }
.od-dock .dv-lab:hover { background: none; color: var(--ink); }
.od-dock .dv-sel, .od-dock .dv-sel:hover { background: var(--seg-on); box-shadow: 0 1px 3px rgba(0,0,0,.18); }
.od-dock .dv-sel { display: flex; align-items: center; gap: 8px; min-width: 150px; max-width: 280px; padding: 6px 10px 6px 12px; }
.dv-sel span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; text-align: left; }
.dv-sel svg { width: 11px; height: 11px; color: var(--od-muted); transition: rotate var(--od-open) var(--od-out); }
.dv-sel[aria-expanded="true"] svg { rotate: 180deg; }

/* minimized capsule and the corner handle */
.dv-pill, .dv-handle { position: fixed; z-index: 2147483001; pointer-events: auto; display: flex; align-items: center; justify-content: center;
  background: var(--od-dock); color: var(--od-ink); border: .5px solid var(--od-line); box-shadow: var(--od-shadow), inset 0 1px 0 var(--od-hi);
  backdrop-filter: blur(28px) saturate(1.8); -webkit-backdrop-filter: blur(28px) saturate(1.8); }
.dv-pill { left: 0; right: 0; margin-inline: auto; width: max-content; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); gap: 8px;
  height: 40px; padding: 0 12px 0 10px; border-radius: 999px; font: 600 14px/1 var(--od-font); font-variant-numeric: tabular-nums; }
.dv-pill svg { width: 11px; height: 11px; color: var(--od-muted); }
.dv-handle { right: 12px; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); width: 32px; height: 32px; border-radius: 50%; color: var(--od-muted); }
.dv-handle svg { width: 16px; height: 16px; }
.dv-pill:hover, .dv-handle:hover { color: var(--od-ink); background: var(--od-pop); }
.dv-in { animation: dv-in var(--od-open) var(--od-out); }
@keyframes dv-in { from { opacity: 0; transform: translateY(6px) scale(.97); } }

/* popover content: plain rows like a macOS menu, a filter for long lists, a thumbnail grid for images */
.od-pop.dv-wide { max-width: min(660px, calc(100vw - 16px)); }
.dv-list { display: grid; gap: 1px; margin: 0 -6px; }
.dv-row { display: grid; grid-template-columns: 14px 1fr; column-gap: 8px; align-items: start; width: 100%; text-align: left;
  padding: 7px 10px 7px 8px; border-radius: 8px; position: relative; overflow: hidden; }
.dv-row:hover, .dv-row.on { background: var(--od-fill); }
.dv-row .ck { font-size: 12px; font-weight: 700; line-height: 20px; color: var(--od-blue); visibility: hidden; }
.dv-row[aria-selected="true"] .ck { visibility: visible; }
.dv-row b { display: block; font: 500 14px/20px var(--od-font); }
.dv-row[aria-selected="true"] b { font-weight: 600; }
.dv-row small { display: block; font: 12.5px/1.35 var(--od-font); color: var(--od-muted); }
.dv-filter { position: sticky; top: -8px; z-index: 1; margin: -8px -14px 6px; padding: 8px 14px 6px; background: var(--od-pop); }
.dv-filter input { width: 100%; height: 34px; padding: 0 12px; border: 0; border-radius: 10px; background: var(--od-fill); font: 14px var(--od-font); color: var(--od-ink); }
.dv-filter input::placeholder { color: var(--od-muted); }
.dv-none { padding: 10px 4px; color: var(--od-muted); }
.dv-imgs { display: grid; grid-template-columns: minmax(0, 1fr) 210px; gap: 14px; align-items: start; }
.dv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 6px; }
.dv-tile { display: grid; gap: 4px; text-align: left; min-width: 0; padding: 3px; border-radius: 10px; position: relative; overflow: hidden; }
.dv-tile .th { aspect-ratio: 4 / 3; border-radius: 7px; background: var(--od-fill) center / cover no-repeat; box-shadow: inset 0 0 0 .5px var(--od-line);
  display: grid; place-items: center; font: 600 12px/1 var(--od-font); color: var(--od-muted); }
.dv-tile span:last-child { font: 500 12px/1.3 var(--od-font); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 2px 1px; }
.dv-tile:hover, .dv-tile.on { background: var(--od-fill); }
.dv-tile[aria-selected="true"] .th { box-shadow: 0 0 0 2px var(--od-blue); }
.dv-tile[aria-selected="true"] span:last-child { font-weight: 600; }
.dv-pv { margin: 0; position: sticky; top: 0; display: grid; gap: 6px; }
.dv-pv .th { aspect-ratio: 4 / 3; border-radius: 10px; background: var(--od-fill) center / contain no-repeat; box-shadow: inset 0 0 0 .5px var(--od-line);
  cursor: zoom-in; display: grid; place-items: center; color: var(--od-muted); font-weight: 600; }
.dv-pv b { font: 600 14px/1.3 var(--od-font); }
.dv-pv small { display: block; font: 12.5px/1.35 var(--od-font); color: var(--od-muted); }
.od-body .k-comment { font-size: 15px; margin-top: 10px; min-height: 40px; padding: 9px 12px; box-shadow: none; background: var(--inset); }
.od-body .k-hint { font-size: 13px; margin: 0 0 8px; line-height: 1.4; }
.od-body .k-hint + .dv-list, .od-body .k-hint + .dv-imgs { margin-top: 2px; }
/* the list of every group: page heads, then a row per group with its pick as the note */
.dv-ghead { padding: 8px 8px 4px; font: 600 12px/1.3 var(--od-font); color: var(--od-muted); }
.dv-ghead i { font-style: normal; font-weight: 400; }
.dv-row:disabled { cursor: default; opacity: .5; background: none; }
/* full-size image */
.dv-lb { position: fixed; inset: 0; z-index: 2147483005; pointer-events: auto; display: grid; place-items: center; gap: 10px; padding: 24px;
  background: rgba(0,0,0,.7); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); cursor: zoom-out;
  opacity: 0; transition: opacity var(--od-close) ease; }
.dv-lb.show { opacity: 1; transition: opacity var(--od-open) ease; }
.dv-lb img { max-width: 100%; max-height: calc(100vh - 90px); border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,.45); }
.dv-lb p { margin: 0; color: #fff; font: 600 14px/1.3 var(--od-font); }
/* loading sweep on the hovered option while its preview settles */
.loading::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 60%; pointer-events: none;
  animation: dv-sweep .8s linear infinite; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--od-blue) 16%, transparent), transparent); }
.dv-o { position: relative; overflow: hidden; }
@keyframes dv-sweep { from { transform: translateX(-100%); } to { transform: translateX(223%); } }
@media (max-width: 600px) {
  .od-dock .dv-arch, .od-dock .dv-focus, .od-dock .dv-clear, .od-step .k-dots { display: none; }
  .od-dock .dv-ib.dv-more { display: grid; }
  .od-dock .dv-grp { order: -1; flex: 1 1 100%; }
  .dv-track { flex: 1; }
  .od-dock .dv-sel { flex: 1; min-width: 0; max-width: none; }
  .od-dock .dv-lab { max-width: 46%; }
  .dv-imgs { grid-template-columns: 1fr; }
  .dv-pv { position: static; order: -1; grid-template-columns: 112px 1fr; align-items: center; }
  .dv-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .dv-filter input, .od-body textarea { font-size: 16px; } /* 16 px stops iOS zoom on focus */
  .dv-row { padding: 9px 10px 9px 8px; }
}
@media (prefers-reduced-motion: reduce) { .loading::after { animation: none; width: 100%; background: color-mix(in srgb, var(--od-blue) 8%, transparent); }
  .dv-in { animation: none; } .dv-sel svg, .dv-lb, .dv-lb.show { transition: none; } }`;

  const mk = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html) n.innerHTML = html; return n; };
  const ib = (cls, html, label, fn) => { const b = mk('button', cls, html); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.onclick = fn; return b; };

  function mount() {
    if (host || !document.body) return;
    host = document.createElement('dev-panel');
    sh = host.attachShadow({ mode: 'open' });
    // A page view transition lays a snapshot over everything and takes the pointer (the cursor flips to an
    // arrow and clicks hit <html>) until it ends. Let the pointer pass through to the real page and menu.
    document.head.append(Object.assign(document.createElement('style'), { textContent: '::view-transition { pointer-events: none; }' }));
    sh.innerHTML = `<style>${KIT_CSS}</style><style id="dv-css">${CSS}</style><div class="fz"></div><div class="hl"><div class="gl h"></div><div class="gl h"></div><div class="gl v"></div><div class="gl v"></div></div>`;
    hl = sh.querySelector('.hl'); gls = sh.querySelectorAll('.gl'); fz = sh.querySelector('.fz');
    const clean = Q.has('dv-clean');
    if (clean) host.style.display = 'none';
    document.body.appendChild(host);
    // The end spacer: as tall as the dock and its margin, so the page's last line can scroll above the dock.
    spacer = document.createElement('div'); spacer.setAttribute('aria-hidden', 'true'); spacer.dataset.devPanel = 'spacer';
    spacer.style.cssText = 'display:block;height:0;margin:0;padding:0;border:0;flex:none;pointer-events:none';
    if (!clean) document.body.appendChild(spacer);
    host.dataset.markers = cfg.markers;
    od = window.OptionDots({ root: sh, key: 'devpanel:hidden', step: go, count: () => posText, plain: true,
      list: () => (listOpen ? od.close() : showList()), select: (r) => { const g = groups.find((x) => x.rec === r); if (g) dotClick(g); } });
    sh.append(sh.getElementById('dv-css')); // kit, then the shared overlay's style, then this one, so later wins ties
    od.count.setAttribute('aria-haspopup', 'dialog'); od.count.title = 'Every group on the site';
    sayOut = mk('output', 'dv-say'); sayOut.hidden = true;
    copyBtn = mk('button', 'od-primary k-copy', 'Copy choices'); copyBtn.type = 'button'; copyBtn.onclick = copy;
    copyBtn.title = 'Copies the pick and comment of every open group as a list, one line per group, to paste in chat';
    grp = mk('div', 'dv-grp');
    const min = ib('dv-ib dv-min', MIN, 'Minimize the dock', () => setDock('min'));
    // the kit's pager: one small dot per group between the count and next; a click goes to that group
    const step = od.controls.querySelector('.od-step');
    pager = mk('div', 'k-dots'); step.insertBefore(pager, step.lastChild);
    pager.onclick = (e) => { const b = e.target.closest('button'); if (b) goTo(b.dataset.id, true); };
    // "…": on a phone Open/Archived, Focus and Clear; on every width "Restore last round" after a new round
    more = ib('dv-ib dv-more', '…', 'More', () => (more.getAttribute('aria-expanded') === 'true' ? od.close() : od.open({
      label: 'More', anchor: more, render: (b) => {
        const phone = matchMedia('(max-width: 600px)').matches, n = lastLive().length, x = mk('div', 'dv-xs');
        b.innerHTML = `<p class="k-hint">${[phone && 'Final groups move to Archived. Focus dims the rest of the page. Clear empties every pick and comment.',
          n && `The options of ${n} group${n === 1 ? '' : 's'} changed, so ${n === 1 ? 'it' : 'they'} started fresh. Restore puts the last round's picks and comments back.`].filter(Boolean).join(' ')}</p>`;
        if (phone) x.append(...extras());
        if (n) { const r = mk('button', 'k-clear dv-restore', 'Restore last round'); r.type = 'button'; r.onclick = restoreLast; x.append(r); }
        b.append(x); updX();
      } })));
    dockEl = od.dock(min, grp, ...extras(), more, sayOut, copyBtn); dockEl.classList.add('k-dock');
    updX();
    pill = ib('dv-pill', '', 'Open the dock', () => setDock('open'));
    handle = ib('dv-handle', DOCKI, 'Show the dock  ( h )', () => setDock('open'));
    sh.append(pill, handle);
    try { const ro = new ResizeObserver(fit); ro.observe(dockEl); ro.observe(pill); } catch {}
    for (const g of groups) addDot(g);
    setDock(dockState, true);
    sync();
  }

  // The kit's Open/Archived switch, Focus switch and Clear button. Built twice: in the dock, and in the phone's "…" menu.
  function extras() {
    const seg = (cls, label, items, onPick, lab) => {
      const s = mk('div', 'k-seg ' + cls); s.setAttribute('role', 'group'); s.setAttribute('aria-label', label);
      if (lab) { const l = mk('span', 'k-seg-label', lab); l.setAttribute('aria-hidden', 'true'); s.append(l); }
      for (const [v, t] of items) { const b = mk('button', '', t); b.type = 'button'; b.dataset.v = v; b.onclick = () => onPick(v); s.append(b); }
      return s;
    };
    const a = seg('dv-arch', 'Groups', [['open', 'Open'], ['archived', 'Archived']], (v) => {
      arch = v === 'archived'; curId = null; shownG = null; od.close(); sync(); od.sync();
      if (!site().some(inSet)) say(arch ? 'Nothing is archived yet.' : 'Everything is final. See Archived.');
    });
    const f = seg('dv-focus', 'Focus', [['on', 'On'], ['off', 'Off']], (v) => {
      focusOn = v; try { localStorage.setItem(FOCUS_KEY, v); } catch {} updX(); schedule();
    }, 'Focus');
    const c = mk('button', 'k-clear dv-clear', clearText); c.type = 'button'; c.onclick = clearAll;
    c.title = 'Two clicks empty every pick, comment and Final. Undo shows for 5 seconds after.';
    return [a, f, c];
  }
  function updX() {
    if (!sh) return;
    const all = browsable(), n = all.filter((m) => fin(m.id)).length;
    sh.querySelectorAll('.dv-arch').forEach((s) => {
      s.children[0].textContent = 'Open ' + (all.length - n); s.children[1].textContent = 'Archived ' + n;
      s.children[0].setAttribute('aria-pressed', String(!arch)); s.children[1].setAttribute('aria-pressed', String(arch));
    });
    sh.querySelectorAll('.dv-focus button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === focusOn)));
    sh.querySelectorAll('.dv-clear').forEach((b) => { b.textContent = clearText; });
    host.toggleAttribute('data-last', lastLive().length > 0);
  }
  // Clear: two clicks within 3 s (the kit's "Clear all?"), then Undo for 5 s. Never a browser confirm.
  let clearText = 'Clear', clearArm = 0, undo = null, undoT = 0;
  function clearAll() {
    const set = (t) => { clearText = t; updX(); };
    if (undo) { clearTimeout(undoT); Object.assign(st, undo); undo = null; save(); groups.forEach((g) => setVar(g, pick(g), true)); shownG = null; sync(); return set('Clear'); }
    if (!clearArm) { set('Clear all?'); clearArm = setTimeout(() => { clearArm = 0; set('Clear'); }, 3000); return; }
    clearTimeout(clearArm); clearArm = 0;
    undo = JSON.parse(JSON.stringify({ picks: st.picks, notes: st.notes, fin: st.fin }));
    Object.assign(st, { picks: {}, notes: {}, fin: {} }); save(); od.close(); groups.forEach((g) => setVar(g, 1)); shownG = null; sync();
    set('Undo'); undoT = setTimeout(() => { undo = null; set('Clear'); }, 5000);
  }

  // open: the full dock. min: a small capsule with the count. hide: only a corner handle. Kept after a reload.
  function setDock(s, quiet, temp) {
    if (host.hasAttribute('data-empty') && !temp) return; // no groups here: only the handle shows
    if (!temp) { dockState = s; try { localStorage.setItem(DOCK_KEY, s); } catch {} }
    if (s !== 'open') od.close();
    const show = { open: dockEl, min: pill, hide: handle }[s];
    for (const n of [dockEl, pill, handle]) { n.hidden = n !== show; n.classList.remove('dv-in'); }
    host.dataset.dock = s; // markers: 'dock' shows the dots only while the dock is open
    if (!quiet) { void show.offsetWidth; show.classList.add('dv-in'); }
    fit(); schedule();
  }
  function fit() {
    if (!dockEl) return;
    const s = host.hasAttribute('data-empty') ? 'hide' : dockState;
    const n = s === 'open' ? dockEl : s === 'min' ? pill : null, h = n ? n.getBoundingClientRect().height : 0;
    spacer.style.height = h ? Math.ceil(h + 32) + 'px' : '0'; // 16 px under the dock and 16 px of air above it
    dockEl.classList.toggle('dv-wrap', dockEl.offsetHeight > 52);
  }

  function addDot(g) {
    g.rec = od.add({ target: () => (inSet(g) ? sample(g) : {}), label: g.label, pick: g.opts.length > 0, pos: g.pos });
    g.el = g.rec.el;
    g.el.onpointerenter = (e) => { if (e.pointerType !== 'touch') glow(g); };
  }
  // A dot click does what back and next do: the group becomes current, its lines show, its popover opens.
  function dotClick(g) {
    if (popG === g) return od.close();
    show(g); od.pulse(g.rec); glow(g);
    if (kind(g) === 'note') popFor(g, true); // the options are in the dock; only a comment group needs the popover
  }

  // The guide lines run once, about 1 s: they shoot out from the target's edges (180 ms), glow up and settle (300 ms),
  // then fade out fast (400 ms). A new hover on the same group starts them again only once they fade.
  // Reduced motion: still, faint lines for the same time, then gone.
  const still = matchMedia('(prefers-reduced-motion: reduce)'), GROW = 180, PEAK = 300, OUT = 400, T = GROW + PEAK + OUT;
  const OUTQ = 'cubic-bezier(.22, 1, .36, 1)';
  let glowAs = [];
  function glow(g, hold) {
    if (lit === g && glowAs.some((a) => a.playState === 'running' && a.currentTime < GROW + PEAK)) return; // fading: run again
    lit = g; place();
    glowAs.forEach((a) => a.cancel()); glowAs = []; clearTimeout(stillT); hl.classList.remove('hold');
    if (hold || still.matches) {
      hl.classList.add('hold');
      if (!hold) stillT = setTimeout(() => { hl.classList.remove('hold'); lit = null; }, T);
      return;
    }
    const r = g.r; if (!r || !r.width) return;
    // each line starts as long as the target's side and grows to its full length (scale, so it is paint only)
    gls.forEach((n, i) => {
      const h = i < 2, full = h ? n.offsetWidth : n.offsetHeight, side = h ? r.width + 8 : r.height + 8, s = Math.min(1, side / Math.max(full, 1));
      glowAs.push(n.animate([{ scale: h ? `${s} 1` : `1 ${s}`, easing: OUTQ }, { scale: '1 1', offset: GROW / T }, { scale: '1 1' }], { duration: T }));
    });
    const a = hl.animate([
      { opacity: 0, filter: 'none', easing: 'ease-out' },
      { opacity: .6, filter: 'none', offset: GROW / T, easing: 'ease-out' },
      { opacity: .95, filter: 'drop-shadow(0 0 3px rgba(255,59,48,.9))', offset: (GROW + PEAK * .4) / T, easing: 'ease-in-out' },
      { opacity: .6, filter: 'none', offset: (GROW + PEAK) / T, easing: 'cubic-bezier(.4, 0, 1, 1)' },
      { opacity: 0, filter: 'none' }], { duration: T });
    glowAs.push(a);
    a.onfinish = () => { if (glowAs.includes(a)) { glowAs = []; lit = null; } };
  }

  const pick = (g) => st.picks[g.id] || 1;
  function setVar(g, i, force) {
    if (g.cur === i && !force) return; // never apply the same value twice
    const changed = g.cur !== i, attr = 'data-dv-' + g.id, root = document.documentElement;
    g.cur = i;
    if (i === 1 && g.current !== false) root.removeAttribute(attr); else root.setAttribute(attr, String(i));
    try { g.apply && g.apply(i); } catch (e) { console.error('[dev artifacts]', g.id, e); }
    if (changed) { if (od) od.freeze = performance.now() + 500; settle(g, i); }
    schedule();
  }
  // Hover previews wait 60 ms and apply only the last one, so a pass over the list doesn't flicker.
  const preview = (g, i) => { clearTimeout(hoverT); hoverT = setTimeout(() => setVar(g, i), 60); };
  const unpreview = (g) => preview(g, pick(g));

  // The loading state shows until the change has settled: fonts loaded, 2 frames, and the target's
  // transitions (and a page view transition) finished, at most 600 ms.
  function settle(g, i) {
    if (!sh) return;
    sh.querySelectorAll('.loading').forEach((o) => o.classList.remove('loading'));
    const els = shownG === g ? [...sh.querySelectorAll(`.od-dock [data-i="${i}"], .od-body [data-i="${i}"]`)] : [];
    els.forEach((n) => n.classList.add('loading'));
    const t = sample(g).t;
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const finite = (a) => a.effect && a.effect.getComputedTiming().endTime !== Infinity;
    const anims = () => Promise.all([...(t ? t.getAnimations({ subtree: true }) : []),
      ...document.getAnimations().filter((a) => /^::view-transition/.test(a.effect && a.effect.pseudoElement || ''))]
      .filter(finite).map((a) => a.finished.catch(() => {})));
    Promise.race([document.fonts.ready.then(frames).then(anims), new Promise((r) => setTimeout(r, 600))])
      .then(() => els.forEach((n) => n.classList.remove('loading')));
  }
  function choose(g, i) {
    clearTimeout(hoverT);
    if (i === 1 && g.current !== false) delete st.picks[g.id]; else st.picks[g.id] = i;
    save(); setVar(g, i, true);
    if (!sayT && !pending.length && sayOut && !sayOut.hidden) { sayOut.hidden = true; fit(); } // a lasting message goes on the next pick
    sh.querySelectorAll('.od-dock [data-i], .od-body [data-i]').forEach((o) => o.setAttribute(o.hasAttribute('aria-pressed') ? 'aria-pressed' : 'aria-selected', String(+o.dataset.i === i)));
    if (popG === g) pvShow(g, i);
    if (shownG === g && hasMore(g)) fillDock(g); // the "…" item carries a pick past the inline ones
    sync();
  }
  // One step through a group's options: picks it at once (saved, applied, guide lines), the same as a click.
  function stepPick(g, d) {
    const i = Math.min(Math.max(pick(g) + d, 1), g.opts.length);
    if (i !== pick(g)) choose(g, i);
    glow(g);
    if (popG === g) activate(g, od.body.querySelector(`[data-i="${i}"]`), false);
  }

  // The dock part of the current group.
  function fillDock(g) {
    if (shownG && shownG !== g) { clearTimeout(hoverT); setVar(shownG, pick(shownG), true); } // drop the last group's preview
    shownG = g;
    const k = kind(g), n = inlineN(g), p = pick(g), focused = sh.activeElement && grp.contains(sh.activeElement);
    // Options show once: the first n inline here, the rest behind "…" (the popover's full list). The "…" item carries the
    // pick when it is past n, so the pick always shows.
    const o = (j) => `<button type="button" class="dv-o" data-i="${j}" aria-pressed="${p === j}">${esc(g.opts[j - 1].name)}</button>`;
    grp.innerHTML = `<div class="dv-track k-seg"><button type="button" class="dv-lab k-seg-label" aria-haspopup="dialog" title="${k === 'note' ? 'Click to comment' : 'Click for the comment' + (hasMore(g) ? ', every option' : '') + ' and Final'}"><span>${esc(g.label)}</span></button>`
      + (k === 'note' ? `<button type="button" class="dv-sel" aria-haspopup="dialog" aria-expanded="false"><span></span>${CHEV}</button>`
        : g.opts.slice(0, n).map((_, j) => o(j + 1)).join('')
          + (hasMore(g) ? `<button type="button" class="dv-o dv-moreo" aria-haspopup="dialog" aria-pressed="${p > n}" data-tip="All ${g.opts.length} options">${p > n ? esc(g.opts[p - 1].name) + ' ' : ''}…</button>` : ''))
      + `</div>`;
    const cm = ib('dv-ib dv-cm', BUBBLE, 'Comment', () => (popG === g ? focusNote() : popFor(g, true)));
    if (k !== 'note') grp.append(cm);
    const track = grp.firstChild, lab = track.firstChild, sel = track.querySelector('.dv-sel');
    lab.onclick = () => (popG === g ? od.close() : popFor(g, k === 'note'));
    lab.onpointerenter = (e) => { if (e.pointerType !== 'touch') glow(g); };
    if (sel) sel.onclick = () => (popG === g ? od.close() : popFor(g, true));
    if (k !== 'note') {
      track.onpointerover = (e) => {
        const b = e.target.closest('.dv-o'); if (!b || b.contains(e.relatedTarget)) return;
        tipFor(b, b.dataset.tip || optNote(g, +b.dataset.i));
        if (b.dataset.i) preview(g, +b.dataset.i);
        if (e.pointerType !== 'touch') glow(g);
      };
      track.onpointerleave = () => { tipFor(null); unpreview(g); };
      track.onclick = (e) => { const b = e.target.closest('.dv-o'); if (!b) return; tipFor(null); if (b.dataset.i) choose(g, +b.dataset.i); else popG === g ? od.close() : popFor(g); };
    }
    if (focused) (grp.querySelector(`.dv-o[data-i="${p}"]`) || grp.querySelector('.dv-moreo') || lab).focus({ preventScroll: true });
    updDock(g);
  }
  // One line about an option: its note, or for option 1 "The site as it is now".
  const optNote = (g, i) => (g.opts[i - 1] || {}).note || (i === 1 && g.current !== false ? 'The site as it is now' : '');
  // The small tooltip over an inline dock option (its one-line note), so the popover is not needed to read it.
  let tip;
  function tipFor(b, text) {
    if (!tip) { tip = mk('div', 'dv-tip'); tip.setAttribute('role', 'tooltip'); sh.append(tip); }
    if (!b || !text) return tip.classList.remove('on');
    tip.textContent = text; tip.classList.add('on');
    const r = b.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(r.left + r.width / 2 - w / 2, 8), innerWidth - w - 8) + 'px';
    tip.style.top = r.top - tip.offsetHeight - 8 + 'px';
  }
  function updDock(g) {
    const sel = grp.querySelector('.dv-sel span');
    if (sel) { const o = g.opts[pick(g) - 1]; sel.textContent = g.opts.length ? o.name : (st.notes[g.id] || '').trim().split('\n')[0] || 'Add a comment'; }
    const cm = grp.querySelector('.dv-cm'); if (cm) cm.dataset.on = String(!!st.notes[g.id]);
    fit();
  }
  const anchorOf = () => grp.querySelector('.dv-track');
  const focusNote = () => { const ta = od.body.querySelector('textarea'); if (ta) ta.focus({ preventScroll: true }); };

  // The group's popover: options by kind, then the comment field. It grows up out of the dock's group.
  function popFor(g, note) {
    if (dockState !== 'open') setDock('open');
    if (shownG !== g) show(g);
    tipFor(null);
    const k = kind(g);
    od.pop.classList.toggle('dv-wide', k === 'images');
    od.open({ label: g.label, anchor: anchorOf(), reveal: () => sample(g).r, render: (b) => fillPop(g, b, k),
      onClose: () => { if (popG === g) popG = null; unpreview(g); grp.querySelector('.dv-sel')?.setAttribute('aria-expanded', 'false'); } });
    popG = g; listOpen = false;
    grp.querySelector('.dv-sel')?.setAttribute('aria-expanded', 'true');
    const f = od.body.querySelector('.dv-filter input');
    if (note) requestAnimationFrame(focusNote);
    else if (f && matchMedia('(hover: hover)').matches) f.focus({ preventScroll: true });
    else activate(g, od.body.querySelector(`[data-i="${pick(g)}"]`), false);
  }
  function fillPop(g, body, k) {
    const p = pick(g);
    const row = (o, j) => `<button type="button" class="dv-row" role="option" data-i="${j}" aria-selected="${p === j}"><span class="ck">✓</span><span><b>${esc(o.name)}</b>${optNote(g, j) ? `<small>${esc(optNote(g, j))}</small>` : ''}</span></button>`;
    const tile = (o, j) => `<button type="button" class="dv-tile" role="option" data-i="${j}" aria-selected="${p === j}" title="${esc(o.note || o.name)}"><span class="th"${o.img ? ` style="background-image:url('${esc(o.img)}')"` : ''}>${o.img ? '' : esc(o.name)}</span><span>${esc(o.name)}</span></button>`;
    // the kit's visible hint: one line on how this popover works
    const hint = { many: 'Type to filter. Hover an option to see it on the page. Click or an arrow key picks it, Enter closes.',
      images: 'Hover a picture to see it on the page. Click or an arrow key picks it. Click the big picture to see it full size.',
      note: 'Write what should change here. Copy choices puts it under this group.' }[k]
      || 'Hover an option to see it on the page. Click or an arrow key picks it, Enter closes.';
    body.innerHTML = `<p class="k-hint">${hint}</p>` + (k === 'many' ? `<div class="dv-filter"><input type="search" placeholder="Filter ${g.opts.length} options" aria-label="Filter options"></div>` : '')
      + (k === 'images' ? `<div class="dv-imgs"><div class="dv-grid" role="listbox" aria-label="${esc(g.label)}">${g.opts.map((o, j) => tile(o, j + 1)).join('')}</div><figure class="dv-pv"><div class="th" title="Open full size"></div><figcaption><b></b><small></small></figcaption></figure></div>`
        : k === 'note' ? '' : `<div class="dv-list" role="listbox" aria-label="${esc(g.label)}">${g.opts.map((o, j) => row(o, j + 1)).join('')}</div><div class="dv-none" hidden>No option matches.</div>`)
      + `<textarea class="k-comment" rows="1" placeholder="Comment on ${esc(g.label)}"></textarea>`
      + `<div class="k-final-bar"><label for="dv-fin">Final</label><button type="button" id="dv-fin" class="k-final" role="switch" aria-checked="${fin(g.id)}" title="${fin(g.id) ? 'Final. Turn off to move back to Open' : 'Turn on to move to Archived'}"></button></div>`;
    // the kit's Final switch: the group leaves this view (Open or Archived) and the dock moves to the next one
    body.querySelector('.k-final').onclick = (e) => {
      const on = !fin(g.id); e.currentTarget.setAttribute('aria-checked', String(on));
      if (on) st.fin[g.id] = true; else delete st.fin[g.id];
      save(); setTimeout(() => { od.close(); sync(); od.sync(); }, 220); // let the knob slide first
    };
    const list = body.querySelector('.dv-list, .dv-grid'), ta = body.querySelector('textarea');
    if (list) {
      list.onpointerover = (e) => { const b = e.target.closest('[data-i]'); if (!b || b.contains(e.relatedTarget)) return; activate(g, b, true); if (e.pointerType !== 'touch') glow(g); };
      list.onpointerleave = () => { unpreview(g); pvShow(g, pick(g)); };
      list.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) choose(g, +b.dataset.i); };
    }
    const pv = body.querySelector('.dv-pv .th');
    if (pv) { pv.onclick = () => { const o = g.opts[(+pv.dataset.i || pick(g)) - 1]; if (o && o.img) lightbox(o); }; pvShow(g, p); }
    const f = body.querySelector('.dv-filter input');
    if (f) f.oninput = () => {
      const q = f.value.trim().toLowerCase(); let first = null;
      list.querySelectorAll('[data-i]').forEach((b) => { b.hidden = !!q && !b.textContent.toLowerCase().includes(q); if (!b.hidden && !first) first = b; });
      body.querySelector('.dv-none').hidden = !!first; activate(g, first, false);
    };
    ta.value = st.notes[g.id] || '';
    const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
    ta.oninput = () => { const v = ta.value; if (v.trim()) st.notes[g.id] = v; else delete st.notes[g.id]; save(); grow(); updDock(g); };
    requestAnimationFrame(grow);
  }
  // The keyboard and hover spot in a popover list: highlighted, kept in view, previewed on the page.
  function activate(g, b, prev) {
    od.body.querySelectorAll('.on').forEach((x) => x.classList.remove('on'));
    if (!b) return;
    b.classList.add('on'); b.scrollIntoView({ block: 'nearest' });
    if (prev) preview(g, +b.dataset.i);
    pvShow(g, +b.dataset.i);
  }
  function pvShow(g, i) {
    const pv = od.body.querySelector('.dv-pv'); if (!pv || popG !== g && popG) return;
    const o = g.opts[i - 1] || {}, th = pv.querySelector('.th');
    th.dataset.i = i; th.style.backgroundImage = o.img ? `url('${o.img.replace(/'/g, '%27')}')` : ''; th.textContent = o.img ? '' : o.name || '';
    pv.querySelector('b').textContent = o.name || ''; pv.querySelector('small').textContent = optNote(g, i);
  }
  function lightbox(o) {
    if (lb) lb.remove();
    lb = mk('div', 'dv-lb'); lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', o.name);
    lb.innerHTML = `<img alt="${esc(o.name)}" src="${esc(o.img)}"><p>${esc(o.name)}</p>`;
    const end = () => { const n = lb; if (!n) return; lb = null; n.classList.remove('show'); setTimeout(() => n.remove(), 200); };
    lb.onclick = end; lb.end = end; sh.append(lb); requestAnimationFrame(() => lb && lb.classList.add('show'));
  }
  // Arrow keys change the pick at once, in the open popover (a grid moves by row with up and down) and in the dock's
  // option row. Enter closes the popover (after picking a filtered match); Escape closes it and keeps the pick.
  addEventListener('keydown', (e) => {
    if (lb && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); return lb.end(); }
    if (e.metaKey || e.ctrlKey || e.altKey || !sh) return;
    const t = e.composedPath()[0], arrow = /^Arrow/.test(e.key);
    if (t && t.tagName === 'TEXTAREA') return;
    if (!popG) {
      // focus on the dock's group: every arrow steps through its options
      const g = shownG; if (!arrow || !g || !g.opts.length || !t || !grp.contains(t)) return;
      e.preventDefault(); return stepPick(g, /Right|Down/.test(e.key) ? 1 : -1);
    }
    if (t && t.closest && t.closest('.k-final, .k-clear')) return;
    const items = [...od.body.querySelectorAll('[data-i]')].filter((b) => !b.hidden); if (!items.length) return;
    const cur = items.findIndex((b) => b.classList.contains('on')), grid = od.body.querySelector('.dv-grid'), typing = t && t.tagName === 'INPUT';
    const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 1;
    const d = { ArrowDown: cols, ArrowUp: -cols, ArrowRight: typing ? 0 : 1, ArrowLeft: typing ? 0 : -1 }[e.key];
    if (d) {
      e.preventDefault();
      const b = items[Math.min(Math.max((cur < 0 ? (d > 0 ? -1 : items.length) : cur) + d, 0), items.length - 1)];
      activate(popG, b, false); choose(popG, +b.dataset.i); glow(popG);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (cur >= 0 && +items[cur].dataset.i !== pick(popG)) choose(popG, +items[cur].dataset.i);
      od.close();
    }
  }, true);

  function show(g) { curId = g.id; sync(); }

  // The count button opens every group on the site, one head per page. A row goes to its group and opens its popover.
  function showList() {
    if (dockState !== 'open') setDock('open');
    od.pop.classList.remove('dv-wide');
    od.open({ label: 'Every group', anchor: od.count, onClose: () => { listOpen = false; }, render: (body) => {
      const all = browsable().filter(inSet), pages = [...new Set(all.map(home))];
      body.innerHTML = `<p class="k-hint">Click a group to go to it. Copy choices copies every pick and comment as a list to paste in chat.</p><div class="dv-list">${pages.map((p) => `<div class="dv-ghead">${p === null ? 'Page not seen yet' : esc(p)}${p !== null && p === here() ? '<i> · this page</i>' : ''}</div>`
        + all.filter((m) => home(m) === p).map((m) => {
          const i = st.picks[m.id] || 1, name = m.opts && m.opts[i - 1];
          return `<button type="button" class="dv-row" data-id="${esc(m.id)}" aria-selected="${m.id === curId}"${p === null ? ' disabled title="Open its page once so the dock knows where it is"' : ''}><span class="ck">✓</span><span><b>${esc(m.label)}</b><small>${m.opts && m.opts.length ? esc(name || '?') : 'Comment'}</small></span></button>`;
        }).join('')).join('')}</div>`;
      body.querySelector('.dv-list').onclick = (e) => { const b = e.target.closest('.dv-row'); if (b && !b.disabled) goTo(b.dataset.id, true); };
    } });
    listOpen = true; popG = null;
  }

  function sync() {
    if (!od) return;
    // the count and pager cover the current view's part of browsable(); the dock's group is one usable on this page
    const here_ = usable(), blue = browsable().filter(inSet);
    if (curId !== null && !here_.some((g) => g.id === curId) && !blue.some((m) => m.id === curId)) curId = null;
    if (curId === null && here_.length) curId = (here_.find((g) => g.opts.length) || here_[0]).id;
    const k = blue.findIndex((m) => m.id === curId);
    posText = k < 0 ? `${blue.length}` : `${k + 1} / ${blue.length}`;
    od.controls.querySelector('.od-step').hidden = !blue.length; // no pager with nothing to page through
    pager.hidden = blue.length < 2;
    pager.innerHTML = blue.map((g) => `<button type="button" data-id="${esc(g.id)}" title="${esc(g.label)}" aria-label="${esc(g.label)}" aria-current="${g.id === curId}"></button>`).join('');
    for (const g of groups) if (g.rec) g.rec.n = blue.findIndex((m) => m.id === g.id) + 1;
    od.sync(); updX();
    // nothing to browse and nothing here: no dock, only the corner handle (not saved, so the dock comes back with groups)
    const none = !here_.length && !browsable().length;
    if (none !== host.hasAttribute('data-empty')) { host.toggleAttribute('data-empty', none); setDock(none ? 'hide' : dockState, true, true); }
    handle.title = none ? 'No option groups on this page' : 'Show the dock  ( h )'; nUsable = here_.length;
    const g = groups.find((x) => x.id === curId);
    for (const x of groups) if (x.el) x.el.setAttribute('aria-current', String(x === g));
    pill.innerHTML = `<span>${posText}</span>${UP}`;
    if (!g) { grp.hidden = true; shownG = null; }
    else { grp.hidden = false; if (shownG !== g) fillDock(g); else updDock(g); }
  }
  // A short message in the dock, such as a group that never showed up.
  // ms 0: it stays until the next message or a pick
  function say(text, ms = 4000) {
    clearTimeout(sayT); sayOut.textContent = text; sayOut.hidden = false; fit();
    if (ms) sayT = setTimeout(() => { sayT = 0; sayOut.hidden = true; fit(); }, ms);
  }
  // rounds: 'ask': a small bar in the dock instead of the automatic fresh start
  function askRound() {
    clearTimeout(sayT); sayOut.textContent = 'New round. Clear old comments?'; sayOut.hidden = false;
    const b = (t, fn) => { const x = mk('button', 'dv-ask', t); x.type = 'button'; x.onclick = () => { fn(); pending = []; sayOut.hidden = true; fit(); }; return x; };
    sayOut.append(b('Clear', () => { for (const [id, old] of pending) retire(id, old); save(); groups.forEach((g) => setVar(g, pick(g), true)); shownG = null; sync(); }), b('Keep', () => {}));
    fit();
  }

  // Back and next walk every blue-dot group on the site in site order and wrap at the ends. A group on another page
  // navigates there first. On arrival the group becomes current, its popover opens, and the page scrolls the target
  // smoothly into the free part above the popover (only when it is not already in view there).
  // arrows: 'options': back and next step the current group's options; with Shift they step groups.
  let shiftOn = false;
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, (e) => { shiftOn = e.shiftKey; }, true);
  function go(d) {
    if (cfg.arrows === 'options' && !shiftOn && shownG && shownG.opts.length) return stepPick(shownG, d);
    const list = browsable().filter(inSet); if (!list.length) return;
    let k = list.findIndex((m) => m.id === curId);
    if (k < 0) { const f = list.findIndex((m) => !m.page || isHere(m)); k = Math.max(f, 0) - d; } // start on this page
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
      if (s && s.r && s.r.width > 0 && g.rec) {
        end(); show(g);
        if (reopen && kind(g) === 'note') { popFor(g, true); od.pulse(g.rec); glow(g); return; } // the popover's reveal scrolls
        return od.go(g.rec, false).then(() => { if (n === goN) glow(g); });
      }
      const t = performance.now() - t0;
      if (routed && !moved && !cfg.navigate && t > 600) { clearInterval(iv); mo.disconnect(); return location.reload(); }
      if (t > 5000) { end(); const m = meta(id); say(`${m ? m.label : id} is not on ${here()}`); }
    };
    mo.observe(document.body, { childList: true, subtree: true });
    const iv = setInterval(check, 100);
    check();
  }

  // A target that matches many elements (every card) gets its dot, lines, and popover on one sample:
  // the first match in view, picked again on every frame. The options still style every match.
  // sample: 'all' frames the box around all matches instead.
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
  // The guide lines follow the lit group's target; a group's page is the first page its target shows on.
  function place() {
    raf = 0;
    for (const g of groups) {
      const { r } = sample(g), m = meta(g.id);
      if (m && !m.page && r && r.width > 0) { m.page = [location.pathname]; save(); sync(); }
      g.r = r;
    }
    if (usable().length !== nUsable) sync(); // a target appeared or went away (an SPA render)
    // Focus: a hole around the current group's target, the rest of the page veiled
    const c = groups.find((x) => x.id === curId), fr = c && inSet(c) && c.r;
    const fon = focusOn === 'on' && dockState !== 'hide' && !host.hasAttribute('data-empty') && !!fr && fr.width > 0;
    fz.classList.toggle('on', fon);
    if (fon) { const P = 6; box(fz, fr.left - P, fr.top - P, fr.width + 2 * P, fr.height + 2 * P); }
    const r = lit && lit.r;
    hl.hidden = !(r && r.width > 0);
    if (hl.hidden) return;
    // Lines run 35% of the window past each corner and fade over that last 35%. A target off screen gets lines long
    // enough to cross the whole window, so the lines in view still point at it.
    const P = 4, W = innerWidth, H = innerHeight, fx = Math.round(W * 0.35), fy = Math.round(H * 0.35);
    const ex = Math.max(fx, r.left > W ? r.left + 40 : 0, r.right < 0 ? W - r.right + 40 : 0);
    const ey = Math.max(fy, r.top > H ? r.top + 40 : 0, r.bottom < 0 ? H - r.bottom + 40 : 0);
    gls[0].style.setProperty('--e', fx + 'px'); gls[1].style.setProperty('--e', fx + 'px');
    gls[2].style.setProperty('--e', fy + 'px'); gls[3].style.setProperty('--e', fy + 'px');
    box(gls[0], r.left - P - ex, r.top - P, r.width + 2 * (P + ex), 1);
    box(gls[1], r.left - P - ex, r.bottom + P - 1, r.width + 2 * (P + ex), 1);
    box(gls[2], r.left - P, r.top - P - ey, 1, r.height + 2 * (P + ey));
    box(gls[3], r.right + P - 1, r.top - P - ey, 1, r.height + 2 * (P + ey));
  }
  const schedule = () => { if (!raf && od) raf = requestAnimationFrame(place); };

  function md() {
    const all = site().filter((m) => !fin(m.id)), many = new Set(all.map(home)).size > 1; // name the page only when there are several
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
  addEventListener('resize', () => { schedule(); fit(); });
  addEventListener('keydown', (e) => {
    const t = e.composedPath()[0];
    if (e.key !== 'h' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || !od || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
    setDock(dockState === 'hide' ? 'open' : 'hide');
  });
  // While a page view transition runs, Chrome sends every click to <html>. Hand it to the button under the pointer.
  addEventListener('click', (e) => {
    if (!od || e.composedPath()[0] !== document.documentElement) return;
    const inR = (el) => { const r = el.getBoundingClientRect(); return r.width && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
    const b = [...sh.querySelectorAll('.od-body [data-i], .od-dock button, .dv-pill, .dv-handle'), ...od.layer.children].find((el) => !el.hidden && inR(el));
    if (b) b.click();
  }, true);
  // The Focus veil takes the page's own background color, so the rest of the page fades toward it (the kit dims to .8).
  function veil() {
    if (!host) return;
    const bg = [document.body, document.documentElement].map((n) => getComputedStyle(n).backgroundColor)
      .find((c) => c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) || (host.hasAttribute('data-od-dark') ? '#000' : '#fff');
    host.style.setProperty('--fz', `color-mix(in srgb, ${bg} 28%, transparent)`);
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(veil, 50));
  const boot = () => {
    prune(); // the variants file ran before boot: anything stored for a group it no longer has goes
    mount(); veil();
    if (round) { const n = round.length; say(`New round: ${n} group${n === 1 ? '' : 's'} changed and started fresh. Restore last round is in the … menu.`, 0); }
    if (pending.length) askRound();
    try { new ResizeObserver(schedule).observe(document.body); } catch {}
    // targets an app renders later (board cards after a fetch) get their dot as soon as they appear
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    const find = (id) => id && groups.find((x) => x.id === id);
    const g = find(Q.get('dv-open')), h = find(Q.get('dv-hl'));
    if (g) setTimeout(() => (kind(g) === 'flat' ? show(g) : popFor(g, kind(g) === 'note')), 50);
    if (h) setTimeout(() => { show(h); glow(h, true); }, 50);
    // back or next loaded this page: finish the trip to its group
    let go = null; try { go = JSON.parse(sessionStorage.getItem(GO)); } catch {}
    if (go && Date.now() - go.t < 15000) { curId = go.id; sync(); arrive(go.id, go.open); }
  };
  addEventListener('popstate', () => { sync(); }); // an SPA route change: "this page" moved
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot);

  // The tab title '<prefix> > <topic>' lives only in this injected code; an SPA that rewrites <title> gets it set back.
  let titleMo;
  function setTitle() {
    const topic = cfg.topic || (cfg.title && PREFIX ? String(cfg.title).split(' > ').pop() : cfg.title);
    if (!topic) return;
    const t = PREFIX ? `${PREFIX} > ${topic}` : topic;
    const put = () => { if (document.title !== t) document.title = t; };
    put();
    if (titleMo) titleMo.disconnect();
    titleMo = new MutationObserver(put);
    titleMo.observe(document.head, { childList: true, subtree: true, characterData: true });
  }
  setTimeout(() => cfg.topic || cfg.title || console.warn("DevPanel: no topic. Add DevPanel.config({ topic: 'buy dialog' }) to variants.js"), 1500);

  const KINDS = ['flat', 'select', 'many', 'images'];
  window.DevPanel = {
    group(c) {
      if (!c || !c.id || !c.target || !Array.isArray(c.options)) throw new Error('DevPanel.group needs id, target, options');
      if (!/^[a-z0-9-]+$/.test(c.id)) throw new Error('DevPanel id must be lowercase letters, digits, or dashes: ' + c.id);
      if (c.kind && !KINDS.includes(c.kind)) throw new Error(`DevPanel kind must be one of ${KINDS.join(', ')}: ${c.kind}`);
      if (base && c.page && ![].concat(c.page).some(inBase)) return null; // a group of another site on this server
      const g = { ...c, label: c.label || c.id, pos: c.dot || 'tr',
        opts: c.current === false ? c.options : [{ name: 'Current' }, ...c.options] };
      if (forced[g.id]) st.picks[g.id] = forced[g.id];
      if (pick(g) > g.opts.length) delete st.picks[g.id];
      g.cur = 1; // the page starts on option 1
      groups.push(g);
      let m = meta(g.id); if (!m) st.groups.push(m = { id: g.id, page: null });
      // a new round for this group when its options changed since the last load (no sig yet: an old store, keep it)
      const sig = g.opts.map((o) => o.name).join('\n');
      if (m.sig && m.sig !== sig && (st.picks[g.id] || st.notes[g.id] || fin(g.id))) {
        if (cfg.rounds === 'ask') pending.push([g.id, m.opts]); else retire(g.id, m.opts);
      }
      Object.assign(m, { label: g.label, opts: g.opts.map((o) => o.name), sig });
      if (c.page) m.page = [].concat(c.page);
      save();
      if (g.opts.length && pick(g) !== 1) setVar(g, pick(g));
      if (od) { addDot(g); sync(); }
      return g;
    },
    // topic: names the page for the tab title. site: a base path such as '/memory/', or a list of them: each base is its
    // own site with its own store, count, back and next, and Copy choices. A page outside every base uses the whole-origin store.
    config(c) {
      Object.assign(cfg, c);
      if (c.topic || c.title) setTitle();
      if (!('site' in c)) return;
      if (groups.length) throw new Error('Call DevPanel.config({ site }) before DevPanel.group');
      base = [].concat(c.site || []).map((b) => norm(b).replace(/\/?$/, '/')).filter((b) => (here() + '/').startsWith(b))
        .sort((a, b) => b.length - a.length)[0] || '';
      key = base ? KEY + '@' + base : KEY; load(); sync();
    },
    markdown: md,
    open: (id) => { const g = groups.find((x) => x.id === id); if (g) (kind(g) === 'flat' ? show(g) : popFor(g, kind(g) === 'note')); },
    next: () => go(1), back: () => go(-1), list: () => showList(), dock: (s) => setDock(s),
    groups: () => groups.map((g) => ({ id: g.id, label: g.label, target: g.target, page: meta(g.id).page, options: g.opts.map((o) => o.name) })),
  };
})();
