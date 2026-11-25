/* Dev artifacts (DevPanel): a dev-only overlay that shows design options live on a real site.
   DevPanel.group({ id, label, target, options: [{ name, note?, img? }], kind?, page?: '/about' | ['/a', '/b'], dot?: 'tr'|'tl',
     current?: false, sample?: 'first'|'all', apply?(i) })
   Option 1 is "Current" (no attribute) unless current: false. Picking option i > 1 sets data-dv-<id>="<i>" on <html>.
   No markers on the page. A group with `options: []` is skipped (comments go in the dock's overall comment).
   Every group sits in the dock at once: its name, the first 3 options, "…" for the rest. kind picks the popover
   (default: chosen from the options):
     'flat'   2-3 short options, no popover list,
     'select' its popover lists the options,
     'many'   the same with a filter field (8 or more options),
     'images' a grid of thumbnails with a big preview (any option with img).
   Every popover ends with the group's comment field. A group without `page` belongs to the page where its target first
   shows up. Picks, comments, and the list of groups are kept for the whole site (one localStorage key per origin).
   The tab title is exactly '<project> > <Orca tab>' (or the repo folder name), which serve.mjs puts in front of this
   file; an old `topic` or `title` config is ignored. DevPanel.config({ site: '/memory/' | ['/a/', '/b/'] }) splits one server into separate sites,
   each with its own store; groups whose `page` is on another site are skipped. Call it before DevPanel.group.
   DevPanel.config({ navigate(path) }) lets an app route itself; otherwise an SPA gets pushState + popstate and a
   static site a normal page load. Everything lives in one shadow root, so no style leaks in or out. Never ship this file.
   The dock comes from the shared option-dots overlay (dots.js, copied in below). Row 1: back, count, next,
   the overall comment, Open/Archived, Focus, the eye, Clear, "…", Copy choices (nothing in it ever moves); then one row per group. The eye (or key h)
   morphs the dock into a round glass eye button at the bottom right; a click on it morphs it back. An empty spacer the dock's height ends the page, so
   its footer can scroll above the dock. Hovering a dock row, or arriving at a group, shows faint red guide lines once.
   A group whose options changed, or that is gone, moves its old pick and comment to Archived.
   URL params: ?dv-open=<id> opens a group, ?dv-hl=<id> holds the guide lines (for screenshots),
   ?dv-pick=<id>:<i>[,<id>:<i>] forces options (nothing is saved), ?dv-clean hides the whole overlay.
   Keys: h hides the dock, ] and [ go to the next and previous group on any page, arrows and Enter
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
.od-ctl .od-count[data-many]::before { content: none; } /* more than 7 items: arrows and "3 / 158" only, no dot */
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
      count.toggleAttribute('data-many', +count.textContent.split('/').pop() > 7); // more than 7: no dots, only the number
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
:host { --page: #000000; --card: #1c1c1e; --inset: #000000; --ink: #f2f2f7; --muted: rgba(235,235,245,.6); --line: rgba(84,84,88,.6); --blue: #0a84ff; --blue-ink: #4da3ff; --blue-bg: rgba(10,132,255,.16); --red: #ff6961; --red-bg: rgba(255,69,58,.16); --amb: #ff9f0a; --amb-bg: rgba(255,159,10,.16); --grn: #30d158; --grn-bg: rgba(48,209,88,.14); --gry: rgba(235,235,245,.6); --gry-bg: rgba(142,142,147,.18); --dock: rgba(40,40,44,.6); --dock-hi: rgba(255,255,255,.14); --seg: rgba(118,118,128,.32); --seg-on: #636366; --shadow: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.3); --zebra: rgba(255,255,255,.035); --sep: rgba(84,84,88,.42); --soft: rgba(255,255,255,.06); --sw-off: rgba(120,120,128,.4); --ref-open: #3fb950; --ref-merged: #a371f7; --ref-draft: #8b949e; --ref-closed: #f85149; --ref-mine: #ff922b; --pop: rgba(44,44,48,.94); --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", system-ui, sans-serif; --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace; --fs-title: 44px; --fs-h2: 28px; --fs-slide: 34px; --fs-body: 17px; --fs-sm: 15px; --fs-kicker: 13px; --k-ease: linear(0, 0.022, 0.075, 0.147, 0.228, 0.31, 0.391, 0.467, 0.537, 0.601, 0.657, 0.708, 0.751, 0.789, 0.822, 0.85, 0.874, 0.895, 0.912, 0.927, 0.939, 0.949, 0.958, 0.965, 0.971, 0.976, 0.98, 0.984, 0.987, 0.989, 0.991, 0.993, 0.994, 0.995, 0.996, 0.997, 0.997, 0.998, 0.998, 0.998, 1); --k-ease-close: cubic-bezier(.22, 1, .36, 1); --k-open: 380ms; --k-close: 220ms; --k-fade: 100ms; --k-morph-in: 150ms; --k-morph-out: 100ms; --k-words-at: 40ms; --k-stagger: 12ms; --gutter-l: max(16px, env(safe-area-inset-left, 0px)); --gutter-r: max(16px, env(safe-area-inset-right, 0px)); --m-canvas: #09090b; --m-text: #f4f4f7; --m-sec: rgba(244,244,247,.66); --m-tile: #18181c; --m-line: rgba(255,255,255,.14); --m-glass: rgba(20,20,25,.78); --m-on: #34c759; --m-red: #f14c35; --m-knob: #ffffff; color-scheme: dark; }
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
.k-dots[data-many] { display: none; }
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
  const TITLE = String(window.__dvTitle || ''); // '<project> > <Orca tab>', set by serve.mjs in front of this file
  const forced = Object.fromEntries((Q.get('dv-pick') || '').split(',').map((s) => s.split(':')).filter((p) => p[1] > 0).map(([k, v]) => [k, +v]));
  // overall: the dock's comment on the whole page. old: picks and comments of past rounds, shown in Archived.
  const st = { picks: {}, notes: {}, groups: [], fin: {}, old: [], overall: '' };
  // DevPanel.config values; ?dv-set={json} sets them for one page (the options page frames), with its own store.
  const cfg = {};
  try { Object.assign(cfg, JSON.parse(Q.get('dv-set') || '{}')); } catch {}
  let key = KEY + SET, base = ''; // base: the site this page belongs to (DevPanel.config({ site })), '' = the whole origin
  function load() {
    Object.assign(st, { picks: {}, notes: {}, groups: [], fin: {}, old: [], overall: '' });
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved) Object.assign(st, saved);
      else if (!base) for (let i = 0; i < localStorage.length; i++) { // picks from the old per-page keys
        const k = localStorage.key(i), o = k.startsWith('devpanel:/') && JSON.parse(localStorage.getItem(k));
        if (o) { Object.assign(st.picks, o.picks); Object.assign(st.notes, o.notes); }
      }
    } catch {}
    delete st.hidden; // Hide dots lives in the shared overlay now
    // an older store kept the last round in st.last: it is Archived now
    for (const [id, l] of Object.entries(st.last || {})) st.old.push({ id, label: (st.groups.find((m) => m.id === id) || {}).label || id, pick: l.pick, note: l.note || '' });
    delete st.last;
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
  // Rounds, with no notice: a group whose options changed starts fresh, and so does a group the variants file dropped.
  // Its typed pick and comment become an old-round item in Archived; Unarchive puts them back while the group exists.
  function retire(id, m) {
    const p = st.picks[id], n = st.notes[id];
    if (p || n) st.old.push({ id, label: m.label || id, pick: p ? (m.opts || [])[p - 1] || null : null, note: n || '' });
    delete st.picks[id]; delete st.notes[id]; delete st.fin[id];
  }
  function unarchive(k) {
    const o = st.old[k], g = o && groups.find((x) => x.id === o.id); if (!g) return;
    const i = o.pick ? g.opts.findIndex((x) => x.name === o.pick) + 1 : 0;
    if (o.note) st.notes[g.id] = st.notes[g.id] ? st.notes[g.id] + '\n' + o.note : o.note;
    if (i > 0) { if (i === 1 && g.current !== false) delete st.picks[g.id]; else st.picks[g.id] = i; setVar(g, i, true); }
    st.old.splice(k, 1); save(); od.close(); sync();
  }
  // Groups the variants file no longer has: their pick and comment go to Archived, the rest is dropped.
  function prune() {
    const ids = new Set(groups.map((g) => g.id)), keep = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => ids.has(k)));
    for (const m of st.groups) if (!ids.has(m.id)) retire(m.id, m);
    st.groups = st.groups.filter((m) => ids.has(m.id));
    st.picks = keep(st.picks); st.notes = keep(st.notes); st.fin = keep(st.fin); save();
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let host, sh, od, hl, gls, dockEl, rows, overall, knob, handle, spacer, lb, sayOut, copyBtn, copyT = 0, popG = null, hovG = null;
  let lit = null, stillT = 0, raf = 0, hoverT = 0, curId = null, goN = 0, sayT = 0, posText = '', listOpen = false, rowsKey = '', rowsCur = null;
  let dockState = 'open', focusOn = 'on', arch = false, pager, more, fz, nUsable = -1;
  try { dockState = localStorage.getItem(DOCK_KEY) === 'hide' ? 'hide' : 'open'; } catch {}
  try { focusOn = localStorage.getItem(FOCUS_KEY) === 'off' ? 'off' : 'on'; } catch {}
  // Open shows the groups not yet final, Archived the final ones (the kit's Final switch). Copy choices takes only open ones.
  const fin = (id) => !!(st.fin && st.fin[id]);
  const inSet = (m) => fin(m.id) === arch;

  // How the dock shows a group's options; see the header.
  const kind = (g) => !g.opts.length ? 'note' : g.kind || (g.opts.some((o) => o.img) ? 'images' : g.opts.length >= 8 ? 'many'
    : g.opts.length <= 3 && g.opts.reduce((n, o) => n + o.name.length, 0) <= 36 ? 'flat' : 'select');
  // The first 3 options sit inline in the dock; the rest are behind "…".
  // (fewer when the row is too narrow, see renderRows)
  const inlineN = (g) => Math.min(g.opts.length, g.fitN || 3);
  const hasMore = (g) => g.opts.length > inlineN(g);

  const svg = (d, w = 1.6) => `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const CHEV = svg('M3 4.5 6 7.5l3-3');
  const EYEI = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8S3.9 3.5 8 3.5 14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2.1"/></svg>';
  // "…" drawn as three dots on the middle line: the text glyph sits on the baseline and looks low
  const DOTS = '<svg class="dv-dots" viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.4" fill="currentColor"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="13" cy="8" r="1.4" fill="currentColor"/></svg>';

  const CHECK = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.8 7.4l2.7 2.7L11.2 4.4" pathLength="1" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const EASE2 = 'cubic-bezier(.2, .8, .2, 1)'; // the kit's easing for every move below

  const CSS = `
:host { all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; color-scheme: dark; --dv-red: #ff453a;
  font: 14px/1.35 var(--od-font); color: var(--od-ink); -webkit-font-smoothing: antialiased; }
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

/* the dock: almost the full width (16 px gutters). Row 1 is fixed: pager (back, count, dots, next), the overall
   comment, Open/Archived, Focus, the eye (hides the dock), Clear, "…", Copy choices at the right. Dark only. Below it every group of the page, "Name  opt opt opt …", wrapping; past 40% of the window they scroll.
   On a phone row 1 keeps back and next, "…" and Copy choices; the comment takes its own line. */
.od-dock.k-dock { left: var(--gutter-l); right: var(--gutter-r); width: auto; max-width: none; margin: 0; border-radius: 22px;
  justify-content: flex-start; gap: 6px; }
.od-ctl { display: contents; }
/* two classes each: the shared overlay's ".od-ctl button { all: unset }" would reset a one-class order */
.od-dock .od-eye { display: none !important; } /* no dots on the page: the dock's own eye (dv-eye) hides the dock */
.od-dock .od-step { order: 1; } .od-dock .dv-overall { order: 2; } .od-dock .dv-arch { order: 3; } .od-dock .dv-focus { order: 4; }
.od-dock .dv-eye { order: 5; } .od-dock .dv-clear { order: 6; } .od-dock .dv-more { order: 7; } .od-dock .od-primary { order: 9; }
.od-dock .dv-rows { order: 10; }
.od-dock .od-count, .od-dock .dv-arch button, .od-dock .dv-clear { font-variant-numeric: tabular-nums; justify-content: center; text-align: center; }
/* no dots on the page: the guide lines point at each group */
.od-dot.od-plain { display: none !important; }
.od-dock .dv-overall { flex: 1 1 220px; min-width: 160px; margin: 0; min-height: 32px; max-height: 108px; overflow-y: auto; padding: 5px 12px;
  font: 400 14px/20px var(--od-font); border-radius: 16px; background: var(--seg); border-color: transparent; box-shadow: none; scrollbar-width: none; }
.od-dock .dv-overall:focus { border-color: var(--blue); }
.dv-dots { width: 16px; height: 16px; }
.od-dock .dv-moreo { display: inline-flex; align-items: center; gap: 6px; }
.od-dock .dv-moreo .dv-dots { width: 14px; height: 14px; }
.dv-rows { flex: 1 1 100%; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 6px; max-height: 40vh; overflow-y: auto;
  overscroll-behavior: contain; scrollbar-width: none; padding: 6px 0 0; border-top: .5px solid var(--sep); }
.dv-rows::-webkit-scrollbar { display: none; }
.dv-rows[hidden] { display: none; }
/* a group never breaks over two lines and never clips: when it is too wide (a phone) its long labels end in "…"
   (the tooltip shows the full name), and "…" for the rest always stays whole */
.od-dock .dv-g.k-seg { flex: 0 1 auto; flex-wrap: nowrap; min-width: 0; max-width: 100%; overflow: hidden; }
.od-dock .dv-g > * { flex: 0 1 auto; min-width: 0; }
.od-dock .dv-g > .dv-lab { flex-shrink: 2; min-width: 48px; }
.od-dock .dv-g > .dv-o { min-width: 36px; text-overflow: ellipsis; white-space: nowrap; }
.od-dock .dv-g > .dv-moreo, .od-dock .dv-g.dv-fit > * { flex: none; } /* dv-fit: measuring the row's full width */
/* the current group: its name bolder and full white (a text stroke, so the width never changes), the other groups at 60% */
.od-dock .dv-g { transition: opacity 220ms ease; }
.od-dock .dv-g:not([aria-current="true"]) { opacity: .6; }
.od-dock .dv-g .dv-lab { -webkit-text-stroke: .4px transparent; transition: color 220ms ease, -webkit-text-stroke-color 220ms ease; }
.od-dock .dv-g[aria-current="true"] .dv-lab { color: var(--od-ink); -webkit-text-stroke-color: currentColor; }
.dv-lab[data-note]::after { content: ""; flex: none; width: 5px; height: 5px; border-radius: 50%; background: var(--od-blue); }
.dv-oldt { padding: 0 8px; font: 500 13px/1.3 var(--od-font); max-width: 420px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.od-dock .dv-unarch { background: var(--seg-on); box-shadow: 0 1px 3px rgba(0,0,0,.18); }
.od-dock .dv-unarch:disabled { opacity: .4; cursor: default; }
/* the rows' overlay knob: no track, thin, fades 2 s after a scroll */
.dv-knob { position: absolute; right: 3px; top: 0; width: 4px; border-radius: 2px; background: var(--od-ink); opacity: 0; pointer-events: none;
  transition: opacity .4s ease; }
.dv-knob.on { opacity: .3; transition-duration: .12s; }
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
.od-ctl .od-count[aria-expanded="true"] { color: var(--od-blue); }
.od-dock > .od-primary:hover { background: var(--od-blue); filter: brightness(1.08); }
.dv-ib[data-on="true"] { color: var(--od-blue); }
/* a short message floats above the dock's right end, so row 1 never moves for it */
.dv-say { position: absolute; right: 12px; bottom: calc(100% + 8px); max-width: 320px; padding: 7px 10px; border-radius: 10px;
  background: var(--od-pop); color: var(--od-ink); border: .5px solid var(--od-line); box-shadow: var(--od-shadow); font: 500 13px/1.3 var(--od-font); }

/* each group: the kit's segmented control (k-seg). Its label (k-seg-label), then the first options, "…" for the rest,
   or a select button with the comment (a comment group). The pick sits on the kit's raised thumb. */
.od-dock .dv-lab.k-seg-label { display: flex; align-items: center; gap: 7px; min-width: 0; max-width: 240px; padding: 6px 6px 6px 8px; background: none; }
.dv-lab span:last-child { overflow: hidden; text-overflow: ellipsis; }
.od-dock .dv-lab:hover { background: none; color: var(--ink); }
.od-dock .dv-sel, .od-dock .dv-sel:hover { background: var(--seg-on); box-shadow: 0 1px 3px rgba(0,0,0,.18); }
.od-dock .dv-sel { display: flex; align-items: center; gap: 8px; min-width: 150px; max-width: 280px; padding: 6px 10px 6px 12px; }
.dv-sel span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; text-align: left; }
.dv-sel svg { width: 11px; height: 11px; color: var(--od-muted); transition: rotate var(--od-open) var(--od-out); }
.dv-sel[aria-expanded="true"] svg { rotate: 180deg; }

/* the hidden dock: a round glass eye button in the dock's bottom-right corner; the dock morphs into it and back */
.dv-handle { position: fixed; z-index: 2147483001; pointer-events: auto; display: grid; place-items: center;
  right: var(--gutter-r); bottom: calc(16px + env(safe-area-inset-bottom, 0px)); width: 44px; height: 44px; border-radius: 50%;
  background: var(--od-dock); color: var(--od-ink); border: .5px solid var(--od-line); box-shadow: var(--od-shadow), inset 0 1px 0 var(--od-hi);
  backdrop-filter: blur(28px) saturate(1.8); -webkit-backdrop-filter: blur(28px) saturate(1.8); }
.dv-handle svg { width: 20px; height: 20px; }
.dv-handle:hover { color: var(--od-blue); }
.dv-eye svg { width: 18px; height: 18px; }

/* popover content: plain rows like a macOS menu, a filter for long lists, a thumbnail grid for images */
.od-pop.dv-wide { max-width: min(660px, calc(100vw - 16px)); }
.dv-list { display: grid; gap: 2px; margin: 0 -8px; }
.dv-row { display: grid; grid-template-columns: 16px 1fr; column-gap: 10px; align-items: start; width: 100%; text-align: left;
  padding: 8px 12px 8px 10px; border-radius: 10px; position: relative; overflow: hidden; transition: background-color 120ms ease; }
.dv-row:hover, .dv-row.on { background: var(--dv-hov); }
.dv-row[aria-selected="true"] { background: var(--dv-sel); }
.dv-row .ck { height: 20px; display: grid; place-items: center; color: var(--od-ink); visibility: hidden; }
.dv-row .ck svg { width: 12px; height: 12px; }
.dv-row[aria-selected="true"] .ck { visibility: visible; }
.dv-row b { display: block; font: 500 15px/20px var(--od-font); letter-spacing: -.01em; }
.dv-sw { display: inline-block; width: 10px; height: 10px; margin-right: 6px; border-radius: 50%; vertical-align: -0.5px;
  box-shadow: inset 0 0 0 .5px rgba(0,0,0,.2); }
.dv-row small { display: block; margin-top: 1px; font: 400 13px/18px var(--od-font); color: var(--od-muted); }
.dv-filter { position: sticky; top: -8px; z-index: 1; margin: -8px -14px 6px; padding: 8px 14px 6px; background: rgb(30,30,33); }
.dv-filter input { width: 100%; height: 34px; padding: 0 12px; border: .5px solid rgba(255,255,255,.08); border-radius: 10px; background: rgba(255,255,255,.06); font: 14px var(--od-font); color: var(--od-ink); }
.dv-filter input::placeholder { color: var(--od-muted); }
.dv-none { padding: 10px 4px; color: var(--od-muted); }
.dv-imgs { display: grid; grid-template-columns: minmax(0, 1fr) 210px; gap: 14px; align-items: start; }
.dv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 6px; }
.dv-tile { display: grid; gap: 4px; text-align: left; min-width: 0; padding: 3px; border-radius: 10px; position: relative; overflow: hidden; }
.dv-tile .th { aspect-ratio: 4 / 3; border-radius: 7px; background: var(--od-fill) center / cover no-repeat; box-shadow: inset 0 0 0 .5px var(--od-line);
  display: grid; place-items: center; font: 600 12px/1 var(--od-font); color: var(--od-muted); }
.dv-tile span:last-child { font: 500 12px/1.3 var(--od-font); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 2px 1px; }
.dv-tile { transition: background-color 120ms ease; }
.dv-tile:hover, .dv-tile.on { background: var(--dv-hov); }
.dv-tile[aria-selected="true"] { background: var(--dv-sel); }
.dv-pv { margin: 0; position: sticky; top: 0; display: grid; gap: 6px; }
.dv-pv .th { aspect-ratio: 4 / 3; border-radius: 10px; background: var(--od-fill) center / contain no-repeat; box-shadow: inset 0 0 0 .5px var(--od-line);
  cursor: zoom-in; display: grid; place-items: center; color: var(--od-muted); font-weight: 600; }
.dv-pv b { font: 600 14px/1.3 var(--od-font); }
.dv-pv small { display: block; font: 12.5px/1.35 var(--od-font); color: var(--od-muted); }
.od-body .k-comment { font-size: 15px; margin-top: 10px; min-height: 40px; padding: 9px 12px; box-shadow: none; border-radius: 12px;
  background: rgba(255,255,255,.05); border: .5px solid rgba(255,255,255,.08); }
.od-body .k-comment:focus { border-color: rgba(255,255,255,.22); }

/* The popover: a deep, dark glass like a macOS Control Center menu. It grows out of its group in 220 ms (scale .96 and a
   fade) and shrinks back in 150 ms. A hairline highlight on the top edge, a layered soft shadow. */
:host([data-od-dark]) { --od-pop: rgba(24,24,27,.82); --dv-ease: cubic-bezier(.2,.8,.2,1); --dv-sel: rgba(255,255,255,.1); --dv-hov: rgba(255,255,255,.055); }
.od-pop { border-radius: 18px; border: .5px solid rgba(255,255,255,.1);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 0 0 .5px rgba(0,0,0,.55), 0 2px 6px rgba(0,0,0,.2), 0 14px 32px rgba(0,0,0,.32), 0 32px 80px rgba(0,0,0,.4);
  backdrop-filter: blur(44px) saturate(1.9); -webkit-backdrop-filter: blur(44px) saturate(1.9);
  transform: scale(.96); transition: opacity 150ms ease, transform 150ms var(--dv-ease), visibility 0s linear 150ms; }
.od-pop.od-up:not(.od-show) { transform: scale(.96); }
.od-pop.od-show { transition: opacity 160ms ease, transform 220ms var(--dv-ease), visibility 0s; }
.od-head { padding: 14px 16px 2px; font-size: 12px; letter-spacing: .02em; }
/* the pick's fill slides between options: one ghost fill under the content (glide()) */
.k-seg, .dv-list, .dv-grid { position: relative; isolation: isolate; }
.dv-ghost { position: absolute; left: 0; top: 0; z-index: -1; pointer-events: none; transform-origin: 0 0; }
.dv-gliding, .dv-gliding:hover { background: transparent !important; box-shadow: none !important; }
/* the pager number rolls: the new index slides in, the old one (data-old) slides out */
.dv-roll { display: inline-block; overflow: hidden; line-height: 1; height: 1em; }
.dv-num { display: inline-block; position: relative; }
.dv-num::after { content: attr(data-old); position: absolute; left: 0; right: 0; top: 0; text-align: center; opacity: 0; }
.dv-ok { display: inline-flex; align-items: center; gap: 5px; }
.dv-ok svg { width: 14px; height: 14px; }
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
  .od-dock .dv-ib.dv-eye { margin-left: auto; }
  .od-dock .dv-overall { order: 9; flex-basis: 100%; }
  .od-dock .od-primary { order: 8; }
  .dv-oldt { max-width: 160px; }
  .dv-imgs { grid-template-columns: 1fr; }
  .dv-pv { position: static; order: -1; grid-template-columns: 112px 1fr; align-items: center; }
  .dv-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .dv-filter input, .od-body textarea { font-size: 16px; } /* 16 px stops iOS zoom on focus */
  .dv-row { padding: 9px 12px 9px 10px; }
  .od-pop, .od-pop.od-up:not(.od-show) { border-radius: 20px; transform: translateY(12px); }
}
@media (prefers-reduced-motion: reduce) { .loading::after { animation: none; width: 100%; background: color-mix(in srgb, var(--od-blue) 8%, transparent); }
  .dv-sel svg, .dv-lb, .dv-lb.show { transition: none; }
  /* every move becomes a plain fade */
  .od-pop, .od-pop.od-up:not(.od-show), .od-pop.od-show { transform: none !important; }
  .od-pop { transition: opacity 150ms ease, visibility 0s linear 150ms !important; }
  .od-pop.od-show { transition: opacity 160ms ease, visibility 0s !important; } }`;

  const mk = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html) n.innerHTML = html; return n; };
  const ib = (cls, html, label, fn) => { const b = mk('button', cls, html); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.onclick = fn; return b; };

  function mount() {
    if (host || !document.body) return;
    host = document.createElement('dev-panel');    sh = host.attachShadow({ mode: 'open' });
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
    // dark only, whatever the site or system uses: the shared overlay's theme check writes to a spare element
    host.setAttribute('data-od-dark', '');
    od = window.OptionDots({ root: sh, theme: document.createElement('i'), key: 'devpanel:hidden', step: go, count: () => posText, plain: true,
      list: () => (listOpen ? od.close() : showList()), select: (r) => { const g = groups.find((x) => x.rec === r); if (g) dotClick(g); } });
    sh.append(sh.getElementById('dv-css')); // kit, then the shared overlay's style, then this one, so later wins ties
    od.count.setAttribute('aria-haspopup', 'dialog'); od.count.title = 'Every group on the site';
    sayOut = mk('output', 'dv-say'); sayOut.hidden = true;
    copyBtn = mk('button', 'od-primary k-copy', 'Copy choices'); copyBtn.type = 'button'; copyBtn.onclick = copy;
    copyBtn.title = 'Copies the pick and comment of every open group as a list, one line per group, to paste in chat';
    // the overall comment: on the whole page, for a spoken walkthrough. Saved on every key; Copy choices puts it first.
    overall = mk('textarea', 'k-comment dv-overall'); overall.rows = 1; overall.value = st.overall || '';
    overall.placeholder = 'Overall comment on the whole page'; overall.setAttribute('aria-label', 'Overall comment');
    overall.oninput = () => { st.overall = overall.value.trim() ? overall.value : ''; save(); };
    rows = mk('div', 'dv-rows'); rows.setAttribute('role', 'group'); rows.setAttribute('aria-label', 'Option groups');
    knob = mk('div', 'dv-knob');
    wireRows();
    const eye = ib('dv-ib dv-eye', EYEI, 'Hide the dock  ( h )', () => setDock('hide'));
    // the kit's pager: one small dot per group between the count and next; a click goes to that group
    const step = od.controls.querySelector('.od-step');
    pager = mk('div', 'k-dots'); step.insertBefore(pager, step.lastChild);
    pager.onclick = (e) => { const b = e.target.closest('button'); if (b) goTo(b.dataset.id, true); };
    // "…": the keys; on a phone also Open/Archived, Focus and Clear
    const act = (t, fn) => { const b = mk('button', 'k-clear', t); b.type = 'button'; b.onclick = () => { od.close(); fn(); }; return b; };
    more = ib('dv-ib dv-more', DOTS, 'More', () => (more.getAttribute('aria-expanded') === 'true' ? od.close() : od.open({
      label: 'More', anchor: more, render: (b) => {
        const phone = matchMedia('(max-width: 600px)').matches, x = mk('div', 'dv-xs');
        b.innerHTML = `<p class="k-hint">${phone ? 'Final groups move to Archived. Focus dims the rest of the page. Clear empties every pick and comment.'
          : 'Keys: [ and ] go to the last or next group. Arrow keys change the pick of the group in focus. h hides the dock.'}</p>`;
        if (phone) { x.append(...extras()); b.append(x); }
        updX();
      } })));
    dockEl = od.dock(eye, overall, ...extras(), more, sayOut, copyBtn, rows, knob); dockEl.classList.add('k-dock');
    updX();
    handle = ib('dv-handle', EYEI, 'Show the dock  ( h )', () => setDock('open'));
    sh.append(handle);
    // a new dock size (shown again, or the window resized) refits the rows to the width
    try { new ResizeObserver(() => { renderRows(); updX(); fit(); }).observe(dockEl); } catch {}
    for (const g of groups) addDot(g);
    rollCount();
    setDock(dockState, true);
    sync();
    // the dock enters with a short rise and fade, once per page load
    if (!clean && !dockEl.hidden) dockEl.animate(still.matches ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(14px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: EASE2 });
  }

  // The kit's Open/Archived switch, Focus switch and Clear button. Built twice: in the dock, and in the phone's "…" menu.
  function extras() {
    const seg = (cls, label, items, onPick, lab) => {
      const s = mk('div', 'k-seg ' + cls); s.setAttribute('role', 'group'); s.setAttribute('aria-label', label);
      if (lab) { const l = mk('span', 'k-seg-label', lab); l.setAttribute('aria-hidden', 'true'); s.append(l); }
      for (const [v, t] of items) { const b = mk('button', '', t); b.type = 'button'; b.dataset.v = v; b.onclick = () => onPick(v); s.append(b); }
      return s;
    };
    const segs = (cls) => [...sh.querySelectorAll('.' + cls)].map((s) => [s, '[aria-pressed="true"]']);
    const a = seg('dv-arch', 'Groups', [['open', 'Open'], ['archived', 'Archived']], (v) => glide(segs('dv-arch'), () => {
      arch = v === 'archived'; curId = null; od.close(); sync(); od.sync();
      if (!site().some(inSet) && !(arch && st.old.length)) say(arch ? 'Nothing is archived yet.' : 'Everything is final. See Archived.');
    }));
    const f = seg('dv-focus', 'Focus', [['on', 'On'], ['off', 'Off']], (v) => glide(segs('dv-focus'), () => {
      focusOn = v; try { localStorage.setItem(FOCUS_KEY, v); } catch {} updX(); schedule();
    }), 'Focus');
    const c = mk('button', 'k-clear dv-clear', clearText); c.type = 'button'; c.onclick = clearAll;
    c.title = 'Two clicks empty every pick, comment and Final. Undo shows for 5 seconds after.';
    return [a, f, c];
  }
  function updX() {
    if (!sh) return;
    const all = browsable(), n = all.filter((m) => fin(m.id)).length;
    sh.querySelectorAll('.dv-arch').forEach((s) => {
      s.children[0].textContent = 'Open ' + (all.length - n); s.children[1].textContent = 'Archived ' + (n + st.old.length);
      s.children[0].setAttribute('aria-pressed', String(!arch)); s.children[1].setAttribute('aria-pressed', String(arch));
    });
    sh.querySelectorAll('.dv-focus button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === focusOn)));
    sh.querySelectorAll('.dv-clear').forEach((b) => { b.textContent = clearText; });
    // row 1 never moves: each changing text keeps the width of its widest value (tabular digits, so 8 is as wide as any)
    const d = (x) => String(x).replace(/\d/g, '8'), tot = d(all.length + st.old.length);
    lockW(od.count, [`${d(all.length)} / ${d(all.length)}`]);
    sh.querySelectorAll('.dv-arch').forEach((s) => { lockW(s.children[0], ['Open ' + tot]); lockW(s.children[1], ['Archived ' + tot]); });
    sh.querySelectorAll('.dv-clear').forEach((b) => lockW(b, ['Clear', 'Clear all?', 'Undo']));
    lockW(copyBtn, ['Copy choices', 'Copied']);
  }
  function lockW(b, texts) {
    if (!b.offsetParent) return; // hidden: measured again when the dock shows
    const t = b.innerHTML; b.style.minWidth = '';
    b.style.minWidth = Math.max(...texts.map((x) => ((b.textContent = x), b.offsetWidth))) + 'px'; b.innerHTML = t;
  }
  // The pick's fill slides from the old option to the new one: one ghost fill under the content moves with FLIP
  // (transform only). pairs: [box, selector of the picked element]. Reduced motion: the fill fades in.
  function glide(pairs, change) {
    const vis = (a) => a && a.offsetParent && a.getBoundingClientRect().width > 0;
    const before = pairs.map(([box, sel]) => { const a = box && box.querySelector(sel); return vis(a) ? a.getBoundingClientRect() : null; });
    change();
    pairs.forEach(([box, sel], k) => {
      const r0 = before[k], b = box && box.isConnected && box.querySelector(sel);
      if (!r0 || !vis(b)) return;
      const r1 = b.getBoundingClientRect(); if (Math.abs(r0.left - r1.left) < 1 && Math.abs(r0.top - r1.top) < 1) return;
      box.querySelectorAll(':scope > .dv-ghost').forEach((n) => n.remove());
      box.querySelectorAll('.dv-gliding').forEach((n) => n.classList.remove('dv-gliding'));
      const p = box.getBoundingClientRect(), cs = getComputedStyle(b), gh = mk('i', 'dv-ghost');
      Object.assign(gh.style, { left: r1.left - p.left - box.clientLeft + box.scrollLeft + 'px', top: r1.top - p.top - box.clientTop + box.scrollTop + 'px',
        width: r1.width + 'px', height: r1.height + 'px', background: cs.backgroundColor, boxShadow: cs.boxShadow, borderRadius: cs.borderRadius });
      box.prepend(gh); b.classList.add('dv-gliding');
      const a = still.matches ? gh.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 })
        : gh.animate([{ transform: `translate(${r0.left - r1.left}px, ${r0.top - r1.top}px) scale(${r0.width / r1.width}, ${r0.height / r1.height})` },
          { transform: 'none' }], { duration: 260, easing: EASE2 });
      a.onfinish = a.oncancel = () => { gh.remove(); b.classList.remove('dv-gliding'); };
    });
  }
  // The pager number rolls: the new index slides in, the old one slides out. The count's text stays "2 / 5".
  function rollCount() {
    let last = null;
    const c = od.count, OBS = { childList: true, characterData: true, subtree: true };
    const mo = new MutationObserver(() => {
      if (c.querySelector('.dv-num')) return; // our own wrap, or lockW putting it back
      const m = c.textContent.match(/^(\d+)( \/ .*)$/); if (!m) { last = null; return; }
      mo.disconnect(); c.innerHTML = `<span class="dv-roll"><span class="dv-num">${m[1]}</span></span>${esc(m[2])}`; mo.observe(c, OBS);
      const n = +m[1], was = last; last = n;
      if (was === null || was === n || !c.offsetParent) return;
      const sp = c.querySelector('.dv-num'), y = (n > was ? 1 : -1) * 14; // one line of the 1em clip (14 px)
      sp.dataset.old = was;
      if (still.matches) return sp.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
      const T = { duration: 280, easing: EASE2 };
      sp.animate([{ transform: `translateY(${y}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], T);
      // the old number rides on the new one's span, so a fixed -y offset carries it from the spot up and out
      sp.animate([{ transform: `translateY(${-y}px)`, opacity: 1 }, { transform: `translateY(${-y}px)`, opacity: 0 }], { ...T, pseudoElement: '::after' });
    });
    mo.observe(c, OBS);
  }
  // Clear: two clicks within 3 s (the kit's "Clear all?"), then Undo for 5 s. Never a browser confirm.
  let clearText = 'Clear', clearArm = 0, undo = null, undoT = 0;
  function clearAll() {
    const set = (t) => { clearText = t; updX(); };
    if (undo) { clearTimeout(undoT); Object.assign(st, undo); undo = null; save(); groups.forEach((g) => setVar(g, pick(g), true)); overall.value = st.overall; sync(true); return set('Clear'); }
    if (!clearArm) { set('Clear all?'); clearArm = setTimeout(() => { clearArm = 0; set('Clear'); }, 3000); return; }
    clearTimeout(clearArm); clearArm = 0;
    undo = JSON.parse(JSON.stringify({ picks: st.picks, notes: st.notes, fin: st.fin, old: st.old, overall: st.overall }));
    Object.assign(st, { picks: {}, notes: {}, fin: {}, old: [], overall: '' }); save(); od.close(); groups.forEach((g) => setVar(g, 1)); overall.value = ''; sync(true);
    set('Undo'); undoT = setTimeout(() => { undo = null; set('Clear'); }, 5000);
  }

  // open: the full dock. hide: only the round eye button in the dock's bottom-right corner. Kept after a reload.
  // The dock morphs into the button and back: a clip shrinks it into its own corner (they share that corner) while it
  // fades into the button. Reduced motion: a plain fade.
  function setDock(s, quiet, temp) {
    if (host.hasAttribute('data-empty') && !temp) return; // no groups here: only the button shows
    if (!temp) { dockState = s; try { localStorage.setItem(DOCK_KEY, s); } catch {} }
    if (s !== 'open') od.close();
    const open = s === 'open', moving = !quiet && dockEl.hidden === open;
    for (const n of [dockEl, handle]) n.getAnimations().forEach((a) => a.cancel());
    const done = () => { dockEl.hidden = !open; handle.hidden = open; fit(); schedule(); };
    if (!moving) return done();
    dockEl.hidden = handle.hidden = false;
    const r = dockEl.getBoundingClientRect(), T = { duration: 260, easing: getComputedStyle(dockEl).getPropertyValue('--od-ease').trim() || 'ease-out' };
    const full = 'inset(0px 0px 0px 0px round 22px)', dot = `inset(${r.height - 44}px 0px 0px ${r.width - 44}px round 22px)`;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const d = still ? [{ opacity: 1 }, { opacity: 0 }] : [{ clipPath: full, opacity: 1 }, { opacity: 1, offset: .55 }, { clipPath: dot, opacity: 0 }];
    const b = still ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0 }, { opacity: 0, offset: .45 }, { opacity: 1 }];
    if (open) { d.reverse(); b.reverse(); d.forEach((k) => k.offset && (k.offset = 1 - k.offset)); b.forEach((k) => k.offset && (k.offset = 1 - k.offset)); }
    dockEl.animate(d, T).onfinish = done; handle.animate(b, T);
    fit();
  }
  function fit() {
    if (!dockEl) return;
    const s = host.hasAttribute('data-empty') ? 'hide' : dockState;
    const n = s === 'open' ? dockEl : null, h = n ? n.getBoundingClientRect().height : 0;
    spacer.style.height = h ? Math.ceil(h + 32) + 'px' : '0'; // 16 px under the dock and 16 px of air above it
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
    const els = [...(rowEls.get(g.id) || rows).querySelectorAll(`[data-i="${i}"]`), ...(popG === g ? od.body.querySelectorAll(`[data-i="${i}"]`) : [])];
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
    save();
    if (!sayT && sayOut && !sayOut.hidden) { sayOut.hidden = true; fit(); } // a lasting message goes on the next pick
    glide([[rowEls.get(g.id), '.dv-o[aria-pressed="true"]'], [popG === g && od.body.querySelector('.dv-list, .dv-grid'), '[aria-selected="true"]']], () => {
      if (popG === g) { od.body.querySelectorAll('[data-i]').forEach((o) => { o.setAttribute('aria-selected', String(+o.dataset.i === i)); o.classList.toggle('on', +o.dataset.i === i); }); pvShow(g, i); }
      sync(); // the row first, so the loading state lands on its new buttons
    });
    setVar(g, i, true);
  }
  // One step through a group's options: picks it at once (saved, applied, guide lines), the same as a click.
  function stepPick(g, d) {
    const i = Math.min(Math.max(pick(g) + d, 1), g.opts.length);
    if (i !== pick(g)) choose(g, i);
    glow(g);
    if (popG === g) activate(g, od.body.querySelector(`[data-i="${i}"]`), false);
  }

  // One dock row per group: its name, the first 3 options, "…" for the rest (it carries a pick past them, so the pick
  // always shows), or for a comment group a select button with the comment. A blue spot after the name: it has a comment.
  function rowHTML(g) {
    const k = kind(g), n = inlineN(g), p = pick(g);
    const o = (j) => `<button type="button" class="dv-o" data-i="${j}" aria-pressed="${p === j}">${swatch(g, j)}${esc(g.opts[j - 1].name)}</button>`;
    return `<button type="button" class="dv-lab k-seg-label" aria-haspopup="dialog"${st.notes[g.id] ? ' data-note' : ''} title="${k === 'note' ? 'Click to comment' : 'Click for the comment' + (hasMore(g) ? ', every option' : '') + ' and Final'}"><span>${esc(g.label)}</span></button>`
      + (k === 'note' ? `<button type="button" class="dv-sel" aria-haspopup="dialog" aria-expanded="${popG === g}"><span>${esc((st.notes[g.id] || '').trim().split('\n')[0] || 'Add a comment')}</span>${CHEV}</button>`
        : g.opts.slice(0, n).map((_, j) => o(j + 1)).join('')
          + (hasMore(g) ? `<button type="button" class="dv-o dv-moreo" aria-haspopup="dialog" aria-label="All ${g.opts.length} options" aria-pressed="${p > n}" data-tip="All ${g.opts.length} options">${p > n ? swatch(g, p) + esc(g.opts[p - 1].name) : ''}${DOTS}</button>` : ''));
  }
  // An old-round item in Archived: its old pick and comment, and Unarchive (off when its group is gone).
  function oldEl(o, k) {
    const live = groups.some((g) => g.id === o.id), el = mk('div', 'dv-g k-seg dv-oldg');
    const text = [o.pick, (o.note || '').trim().replace(/\s*\n\s*/g, ' / ')].filter(Boolean).join(' - ') || 'No pick';
    el.innerHTML = `<span class="dv-lab k-seg-label"><span>${esc(o.label)}</span></span><span class="dv-oldt" title="${esc(text)}">${esc(text)}</span>`
      + `<button type="button" class="dv-unarch" data-k="${k}"${live ? ' title="Put this pick and comment back"' : ' disabled title="This group is not in the variants file any more"'}>Unarchive</button>`;
    return el;
  }
  // The rows keep one element per group, so a popover anchored on a row stays put while the row redraws.
  const rowEls = new Map();
  function renderRows() {
    const a = sh.activeElement, inRow = a && rows.contains(a) ? a.closest('[data-id]') : null;
    const fid = inRow && inRow.dataset.id, fi = inRow && (a.dataset.i ? `[data-i="${a.dataset.i}"]` : '.' + a.classList[0]);
    const want = [];
    for (const g of usable().filter(inSet)) {
      let el = rowEls.get(g.id); if (!el) { el = mk('div', 'dv-g k-seg'); el.dataset.id = g.id; rowEls.set(g.id, el); }
      if (g.fitW !== rows.clientWidth) { g.fitW = rows.clientWidth; g.fitN = 3; } // a new width: try 3 again
      const h = rowHTML(g); if (el._h !== h) { el.innerHTML = h; el._h = h; }
      el.setAttribute('aria-current', String(g.id === curId)); want.push(el);
    }
    if (arch) st.old.forEach((o, k) => want.push(oldEl(o, k)));
    if (want.length !== rows.children.length || want.some((el, i) => rows.children[i] !== el)) rows.replaceChildren(...want);
    rows.hidden = !want.length;
    // a row too wide for the dock moves its last inline options behind "…"; only then do labels end in "…"
    for (const el of want) {
      const g = el.dataset.id && groups.find((x) => x.id === el.dataset.id); if (!g || !g.opts.length) continue;
      el.classList.add('dv-fit');
      while (g.fitN > 1 && el.scrollWidth > el.clientWidth + 1) { g.fitN--; el.innerHTML = el._h = rowHTML(g); }
      el.classList.remove('dv-fit');
    }
    if (fid && !(a && a.isConnected)) { const r = rowEls.get(fid); (r && (r.querySelector(fi) || r.querySelector('.dv-lab')))?.focus({ preventScroll: true }); }
    // back and next: keep the current row in view inside the rows (never scrollIntoView: it would move the page)
    if (rowsCur !== curId) {
      rowsCur = curId;
      const c = rowEls.get(curId);
      if (c && c.isConnected) {
        const cr = c.getBoundingClientRect(), rr = rows.getBoundingClientRect();
        if (cr.top < rr.top) rows.scrollTop += cr.top - rr.top - 6; else if (cr.bottom > rr.bottom) rows.scrollTop += cr.bottom - rr.bottom + 6;
      }
    }
  }
  // One set of handlers on the rows: hover previews and lights the group's guide lines, a click picks or opens the popover.
  function wireRows() {
    const gOf = (n) => { const r = n && n.closest && n.closest('[data-id]'); return r && groups.find((x) => x.id === r.dataset.id); };
    rows.onpointerover = (e) => {
      const g = gOf(e.target); if (!g) return;
      if (hovG && hovG !== g && popG !== hovG) setVar(hovG, pick(hovG), true); // drop the last group's preview
      hovG = g;
      if (e.pointerType !== 'touch') glow(g);
      const b = e.target.closest('button'); if (!b || b.contains(e.relatedTarget)) return;
      if (!b.classList.contains('dv-o')) return tipFor(null);
      // a label cut with "…" on a narrow dock: the tooltip names it in full
      const cut = b.scrollWidth > b.clientWidth + 1, nm = b.dataset.i ? g.opts[b.dataset.i - 1].name : '';
      tipFor(b, b.dataset.tip || [cut && nm, optNote(g, +b.dataset.i)].filter(Boolean).join(' - '));
      if (b.dataset.i) preview(g, +b.dataset.i);
    };
    rows.onpointerleave = () => { tipFor(null); if (hovG && popG !== hovG) unpreview(hovG); hovG = null; };
    rows.onclick = (e) => {
      const u = e.target.closest('.dv-unarch'); if (u) return unarchive(+u.dataset.k);
      const b = e.target.closest('button'), g = gOf(e.target); if (!b || !g) return;
      tipFor(null);
      if (b.dataset.i) { curId = g.id; return choose(g, +b.dataset.i); }
      if (popG === g) od.close(); else popFor(g, kind(g) === 'note');
    };
    // the overlay knob: no track, shows while scrolling or with the pointer on the rows, fades 2 s after
    let kt = 0;
    const showKnob = () => {
      const ch = rows.clientHeight, sh_ = rows.scrollHeight;
      if (sh_ <= ch + 1) return knob.classList.remove('on');
      const h = Math.max(36, ch * ch / sh_);
      knob.style.height = h + 'px';
      knob.style.transform = `translateY(${rows.offsetTop + rows.scrollTop / (sh_ - ch) * (ch - h)}px)`;
      knob.classList.add('on'); clearTimeout(kt); kt = setTimeout(() => knob.classList.remove('on'), 2000);
    };
    rows.onscroll = showKnob; rows.onpointerenter = showKnob;
  }
  // One line about an option: its note, or for option 1 "The site as it is now".
  const optNote = (g, i) => (g.opts[i - 1] || {}).note || (i === 1 && g.current !== false ? 'The site as it is now' : '');
  // A small round swatch when the option's value (`color`, else its note) is a CSS color such as #f0654f or rgb(...).
  const swatch = (g, i) => {
    const o = g.opts[i - 1] || {}, c = String(o.color || o.note || '').trim();
    return /^(#[0-9a-f]{3,8}|(rgb|hsl|hwb|lab|lch|oklab|oklch)a?\(.+\))$/i.test(c) && window.CSS.supports('color', c)
      ? `<i class="dv-sw" style="background:${esc(c)}"></i>` : '';
  };
  // The small tooltip over an inline dock option (its one-line note), so the popover is not needed to read it.
  let tip;
  function tipFor(b, text) {
    if (!tip) { tip = mk('div', 'dv-tip'); tip.setAttribute('role', 'tooltip'); sh.append(tip); }
    // a re-rendered dock under a still pointer fires pointerover again, so an open popover always wins
    if (!b || !text || popG) return tip.classList.remove('on');
    tip.textContent = text; tip.classList.add('on');
    const r = b.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(r.left + r.width / 2 - w / 2, 8), innerWidth - w - 8) + 'px';
    tip.style.top = r.top - tip.offsetHeight - 8 + 'px';
  }
  const focusNote = () => { const ta = od.body.querySelector('textarea'); if (ta) ta.focus({ preventScroll: true }); };

  // The group's popover: options by kind, then the comment field. It grows up out of the dock's group.
  function popFor(g, note) {
    if (dockState !== 'open') setDock('open');
    if (curId !== g.id) show(g);
    tipFor(null);
    const k = kind(g), row = rowEls.get(g.id), swap = !!popG && popG !== g && od.pop.classList.contains('od-show');
    od.pop.classList.toggle('dv-wide', k === 'images');
    od.open({ label: g.label, anchor: row && row.isConnected ? row : dockEl, reveal: () => sample(g).r, render: (b) => fillPop(g, b, k),
      onClose: () => { if (popG === g) popG = null; unpreview(g); row?.querySelector('.dv-sel')?.setAttribute('aria-expanded', 'false'); } });
    popG = g; listOpen = false;
    row?.querySelector('.dv-sel')?.setAttribute('aria-expanded', 'true');
    // one group's popover to the next: a quick re-grow from the new group; the rows stagger in, 15 ms apart, at most 8
    if (!still.matches) {
      if (swap) od.pop.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: EASE2 });
      [...od.body.querySelectorAll('.dv-row, .dv-tile')].slice(0, 8).forEach((n, j) => n.animate([{ opacity: 0, transform: 'translateY(5px)' },
        { opacity: 1, transform: 'none' }], { duration: 240, delay: 50 + j * 15, easing: EASE2, fill: 'backwards' }));
    }
    const f = od.body.querySelector('.dv-filter input');
    if (note) requestAnimationFrame(focusNote);
    else if (f && matchMedia('(hover: hover)').matches) f.focus({ preventScroll: true });
    else activate(g, od.body.querySelector(`[data-i="${pick(g)}"]`), false);
  }
  function fillPop(g, body, k) {
    const p = pick(g);
    const row = (o, j) => `<button type="button" class="dv-row" role="option" data-i="${j}" aria-selected="${p === j}"><span class="ck">${CHECK}</span><span><b>${swatch(g, j)}${esc(o.name)}</b>${optNote(g, j) ? `<small>${esc(optNote(g, j))}</small>` : ''}</span></button>`;
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
    ta.oninput = () => { const v = ta.value; if (v.trim()) st.notes[g.id] = v; else delete st.notes[g.id]; save(); grow(); renderRows(); };
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
      // focus on a dock row: every arrow steps through that group's options
      const r = arrow && t && rows.contains(t) && t.closest('[data-id]'), g = r && groups.find((x) => x.id === r.dataset.id);
      if (!g || !g.opts.length) return;
      e.preventDefault(); curId = g.id; stepPick(g, /Right|Down/.test(e.key) ? 1 : -1);
      return (r.querySelector(`.dv-o[data-i="${pick(g)}"]`) || r.querySelector('.dv-moreo') || r.querySelector('.dv-lab')).focus({ preventScroll: true });
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
    pager.hidden = blue.length < 2 || blue.length > 7; // more than 7 groups: "‹ 3 / 158 ›", no dots
    pager.innerHTML = blue.map((g) => `<button type="button" data-id="${esc(g.id)}" title="${esc(g.label)}" aria-label="${esc(g.label)}" aria-current="${g.id === curId}"></button>`).join('');
    for (const g of groups) if (g.rec) g.rec.n = blue.findIndex((m) => m.id === g.id) + 1;
    od.sync(); updX();
    // nothing to browse and nothing here: no dock, only the corner handle (not saved, so the dock comes back with groups)
    const none = !here_.length && !browsable().length;
    if (none !== host.hasAttribute('data-empty')) { host.toggleAttribute('data-empty', none); setDock(none ? 'hide' : dockState, true, true); }
    handle.title = none ? 'No option groups on this page' : 'Show the dock  ( h )'; nUsable = here_.length;
    const g = groups.find((x) => x.id === curId);
    for (const x of groups) if (x.el) x.el.setAttribute('aria-current', String(x === g));
    renderRows(); fit();
  }
  // A short message in the dock, such as a group that never showed up.
  // ms 0: it stays until the next message or a pick
  function say(text, ms = 4000) {
    clearTimeout(sayT); sayOut.textContent = text; sayOut.hidden = false; fit();
    if (ms) sayT = setTimeout(() => { sayT = 0; sayOut.hidden = true; fit(); }, ms);
  }
  // Back and next walk every group on the site in site order and wrap at the ends. They only move the focus: the
  // group's dock row is marked, the page scrolls to its target, and its guide lines flash. A group on another page
  // navigates there first.
  function go(d) {
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

  // The overall comment first ("- Overall: ..."), then one line per open group; later comment lines indented 2 spaces.
  function md() {
    const all = site().filter((m) => !fin(m.id)), many = new Set(all.map(home)).size > 1; // name the page only when there are several
    const ov = (st.overall || '').trim();
    return (ov ? ['- Overall: ' + ov.split('\n').join('\n  ')] : []).concat(all.map((m) => {
      const i = st.picks[m.id] || 1, note = (st.notes[m.id] || '').trim(), co = !(m.opts && m.opts.length);
      let s = `- ${m.label}${many && m.page ? ` (${home(m)})` : ''}${co ? (note ? ':' : '') : `: ${i} ${m.opts[i - 1] || '?'}`}`;
      if (note) { const [first, ...rest] = note.split('\n'); s += (co ? ' ' : ' - ') + first + rest.map((l) => '\n  ' + l).join(''); }
      return s;
    })).join('\n');
  }
  async function copy() {
    const text = md();
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; sh.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch {} ta.remove();
    }
    // a short check morph: the check draws itself while "Copied" fades in, then the label fades back
    clearTimeout(copyT);
    copyBtn.innerHTML = `<span class="dv-ok">${CHECK}Copied</span>`;
    const ok = copyBtn.firstChild, path = ok.querySelector('path');
    ok.animate([{ opacity: 0, transform: still.matches ? 'none' : 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: EASE2 });
    if (!still.matches) path.animate([{ strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDasharray: 1, strokeDashoffset: 0 }], { duration: 260, delay: 60, easing: EASE2, fill: 'backwards' });
    copyT = setTimeout(() => { copyBtn.innerHTML = '<span>Copy choices</span>'; copyBtn.firstChild.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 }); }, 1400);
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
    const b = [...sh.querySelectorAll('.od-body [data-i], .od-dock button, .dv-handle'), ...od.layer.children].find((el) => !el.hidden && inR(el));
    if (b) b.click();
  }, true);
  // The Focus veil takes the page's own background color, so the rest of the page fades toward it (the kit dims to .8).
  function veil() {
    if (!host) return;
    const bg = [document.body, document.documentElement].map((n) => getComputedStyle(n).backgroundColor)
      .find((c) => c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) || '#fff';
    host.style.setProperty('--fz', `color-mix(in srgb, ${bg} 28%, transparent)`);
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(veil, 50));
  const boot = () => {
    prune(); // the variants file ran before boot: anything stored for a group it no longer has goes
    mount(); veil();
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

  // The tab title '<project> > <Orca tab>' lives only in this injected code; an SPA that rewrites <title> gets it set back.
  if (TITLE) {
    const put = () => { if (document.title !== TITLE) document.title = TITLE; };
    put();
    new MutationObserver(put).observe(document.head || document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  const KINDS = ['flat', 'select', 'many', 'images'];
  window.DevPanel = {
    group(c) {
      if (!c || !c.id || !c.target || !Array.isArray(c.options)) throw new Error('DevPanel.group needs id, target, options');
      if (!/^[a-z0-9-]+$/.test(c.id)) throw new Error('DevPanel id must be lowercase letters, digits, or dashes: ' + c.id);
      if (c.kind && !KINDS.includes(c.kind)) throw new Error(`DevPanel kind must be one of ${KINDS.join(', ')}: ${c.kind}`);
      if (base && c.page && ![].concat(c.page).some(inBase)) return null; // a group of another site on this server
      if (!c.options.length) return null; // comment-only groups are gone (the overall comment covers it): skip quietly
      const g = { ...c, label: c.label || c.id, pos: c.dot || 'tr',
        opts: c.current === false ? c.options : [{ name: 'Current' }, ...c.options] };
      g.cur = 1; // the page starts on option 1
      groups.push(g);
      let m = meta(g.id); if (!m) st.groups.push(m = { id: g.id, page: null });
      // a new round for this group when its options changed since the last load (no sig yet: an old store, keep it)
      const sig = g.opts.map((o) => o.name).join('\n');
      if (m.sig && m.sig !== sig) retire(g.id, m);
      Object.assign(m, { label: g.label, opts: g.opts.map((o) => o.name), sig });
      if (forced[g.id]) st.picks[g.id] = forced[g.id];
      if (pick(g) > g.opts.length) delete st.picks[g.id];
      if (c.page) m.page = [].concat(c.page);
      save();
      if (g.opts.length && pick(g) !== 1) setVar(g, pick(g));
      if (od) { addDot(g); sync(); }
      return g;
    },
    // site: a base path such as '/memory/', or a list of them: each base is its
    // own site with its own store, count, back and next, and Copy choices. A page outside every base uses the whole-origin store.
    config(c) {
      Object.assign(cfg, c);
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
