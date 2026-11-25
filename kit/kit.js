/* Artifact Kit v1. No dependencies. Include with a script tag (src="kit.js"), or inline this file in one.
   Never write a closing script tag in this file: it ends an inlined copy early.
   It fetches kit.css (next to this file) and injects it as a <style>, then wires the page from data attributes.
   Attributes: see README.md. Public API: window.Kit = { choices(), go(i), view(v), anim(), focus(), lightbox(i), items(), set() }; a k-anim event on document reports Play, Pause or Off. */
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
  'use strict';
  const d = document, root = d.documentElement;
  const el = (tag, cls, text) => { const n = d.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const $$ = (s, r = d) => [...r.querySelectorAll(s)];

  /* 1. Styles. Hold the first paint until kit.css is in, so there is no flash of unstyled page.
     Without JS, or if the fetch fails, the markup still reads as plain HTML. */
  const here = d.currentScript && d.currentScript.src;
  // Transitions turn on one frame after the styles land (see html:not(.k-ready) in kit.css).
  const ready = () => requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('k-ready')));
  if (!here || d.getElementById('kit-css')) ready();
  let cssIn = Promise.resolve(); // comment fields measure their height again once kit.css is in (init may run before it)
  if (here && !d.getElementById('kit-css')) {
    const hold = el('style'); hold.textContent = 'html{visibility:hidden}'; (d.head || root).appendChild(hold);
    const release = () => { hold.remove(); ready(); };
    const timer = setTimeout(release, 2500);
    cssIn = fetch(new URL('kit.css', here)).then(r => (r.ok ? r.text() : Promise.reject(r.status)))
      .then(css => { const s = el('style'); s.id = 'kit-css'; s.textContent = css; (d.head || root).appendChild(s); })
      .catch(() => {}).finally(() => { clearTimeout(timer); release(); });
  }

  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const ms = v => parseFloat(getComputedStyle(root).getPropertyValue(v)) || 0; // a kit motion token (--k-open, --k-close) in ms

  /* 1a. Animation: Play, Pause or Off, saved per page and set on <html> here, before first paint, so a reload never flashes motion.
     Default Play, or Off when the system asks for reduced motion. kit.css freezes (pause) or removes (off) CSS motion;
     this code holds Web Animations; page JS loops listen to the k-anim event or read Kit.anim(). */
  const animKey = 'kit-anim:' + location.pathname;
  let anim, onMotion = () => {}, sawAnimate = false;
  try { anim = localStorage.getItem(animKey); } catch {}
  if (!['play', 'pause', 'off'].includes(anim)) anim = reduce.matches ? 'off' : 'play';
  root.dataset.anim = anim;
  /* Pause freezes loops in place; a one-shot animation (an entrance) jumps to its end, so nothing is left frozen half visible. Off ends or removes all. */
  const freeze = a => {
    if (anim === 'play') return;
    const end = a.effect && a.effect.getComputedTiming().endTime;
    try { if (anim === 'off' || end !== Infinity) a.finish(); else a.pause(); } catch { a.cancel(); }
  };
  const animate0 = Element.prototype.animate;
  if (animate0) Element.prototype.animate = function (...args) { const a = animate0.apply(this, args); sawAnimate = true; freeze(a); onMotion(); return a; };
  /* 1b'. Focus switch: On (one part sharp, the rest dimmed) or Off (nothing dimmed), saved per page and set on <html> before first paint.
     Off only drops the dimming; arrow keys, back and next still move between parts. */
  const focusKey = 'kit-focus:' + location.pathname;
  let focusOn = 'on';
  try { if (localStorage.getItem(focusKey) === 'off') focusOn = 'off'; } catch {}
  root.dataset.focus = focusOn;
  const api = (window.Kit = { choices: () => '', go() {}, view() {}, anim: () => anim, focus: () => focusOn });

  function init() {
    root.classList.add('k-js');
    const cfg = d.querySelector('[data-kit]') || d.body;
    /* data-round on the kit root starts each review round with empty state; a comment-only group has no option
       fingerprint, so without it an answered round's comment comes back. */
    const key = 'kit:' + (d.title || location.pathname) + (cfg.dataset.round ? '@' + cfg.dataset.round : '');
    const saved = store.get(key), saveState = () => store.set(key, saved);
    saved.picks = saved.picks || {}; saved.notes = saved.notes || {}; saved.fin = saved.fin || {}; saved.fp = saved.fp || {};
    /* A republished page keeps its title, so stored state is tied to a fingerprint of the options it was saved for.
       When the options change, the old pick, comment or Final state is dropped. */
    const gfp = g => $$('[data-option]', g).filter(o => !o.classList.contains('k-keep')).map(o => o.dataset.option).join('|') + (g.hasAttribute('data-keep') ? '|keep' : '');
    const stale = (f, k, fp) => { if (saved.fp[f + ':' + k] === fp) return; delete saved[f][k]; saved.fp[f + ':' + k] = fp; saveState(); };

    /* 1b. Final row. Every .k-part, and every .k-group outside a part, gets a footer row: "Final" left, a switch right
       (a button with role=switch, so Space and Enter toggle it). A stored value wins over data-final.
       A group inside a part follows its part, and data-final on such a group finalizes the part. */
    const all = $$('.k-part'), items = [];
    let parts = all, arch = false;
    const mkItem = (elm, k, fp) => {
      stale('fin', k, fp);
      const it = { el: elm, k, btn: el('button', 'k-final') };
      it.own = () => saved.fin[k] ?? !!(elm.hasAttribute('data-final') || elm.querySelector('[data-final]'));
      it.btn.type = 'button'; it.btn.id = 'k-f-' + items.length; it.btn.setAttribute('role', 'switch');
      it.btn.onclick = () => {
        saved.fin[k] = !it.own(); saveState(); it.btn.setAttribute('aria-checked', String(it.own()));
        // The item (or its part, when it was the part's last open item) folds its height away, then leaves the view.
        const p = elm.closest('.k-part'), solo = p && p !== elm && !items.some(o => o !== it && p.contains(o.el) && !o.el.classList.contains('k-gone'));
        const go = solo ? p : elm;
        if (anim !== 'play' || slides()) return refresh();
        go.style.overflow = 'hidden';
        go.animate([{ height: go.offsetHeight + 'px', opacity: getComputedStyle(go).opacity }, { height: '0px', opacity: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 0 }],
          { duration: ms('--k-close'), easing: getComputedStyle(root).getPropertyValue('--k-ease-close').trim() }).finished.then(() => { go.style.overflow = ''; refresh(); }, () => { go.style.overflow = ''; refresh(); });
      };
      const lab = el('label', '', 'Final'); lab.htmlFor = it.btn.id;
      const bar = el('div', 'k-final-bar'); bar.append(lab, it.btn); elm.append(bar);
      items.push(it); return it;
    };
    /* A part that holds a comment-only group gets no toggle of its own: each group in it has its own,
       and the part shows in a view while any of its groups does (see refresh). */
    const pitems = all.map((p, j) => {
      const gs = $$('.k-group', p), nm = p.dataset.part || 'Part ' + (j + 1);
      if (p.querySelector('.k-group[data-comment-only]')) return null;
      return mkItem(p, 'part:' + nm, nm + ':' + (gs.length ? gs.map(gfp).join(';') : p.textContent.length));
    });
    const emit = st => d.dispatchEvent(new CustomEvent('kit:change', { detail: { name: st.name, el: st.el, note: st.ta.value, final: st.item.own() } }));

    /* 2. Option groups: <div class="k-group" data-group="Name"> holding .k-options > [data-option="Name"] */
    const groups = $$('.k-group').map((g, gi) => {
      const name = g.dataset.group || 'Group ' + (gi + 1), co = g.hasAttribute('data-comment-only'), fp = co ? 'comment' : gfp(g);
      const item = pitems[all.indexOf(g.closest('.k-part'))] || mkItem(g, 'group:' + name, fp);
      stale('picks', name, fp); stale('notes', name, fp);
      const grid = g.querySelector('.k-options') || g;
      let keeps = null;
      if (g.hasAttribute('data-keep')) {
        keeps = el('div', 'k-options k-keeps'); grid.after(keeps);
        [['Keep as is', 'Leave it exactly as it is now.'], ['Keep as is, show more options', 'Keep the current one and show a new set of options.']].forEach(([n, t]) => {
          const o = el('div', 'k-option k-keep'); o.dataset.option = n; o.append(el('p', 'k-line', t)); keeps.append(o);
        });
      }
      const opts = [...$$(':scope > [data-option]', grid), ...(keeps ? [...keeps.children] : [])];
      const ta = el('textarea', 'k-comment'); ta.rows = 1; ta.id = 'k-c-' + gi;
      ta.placeholder = g.dataset.comment || 'Comment on your pick'; ta.setAttribute('aria-label', 'Comment on ' + name);
      const grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + ta.offsetHeight - ta.clientHeight + 'px'; }; // + borders (border-box)
      const multi = g.hasAttribute('data-multi'); // data-multi: options toggle on their own; pick is a sorted index list or null
      const st = { name, el: g, co, opts, ta, item, grow, multi, pick: null };
      const choose = i => {
        if (multi) { const s = new Set(st.pick || []); s.has(i) ? s.delete(i) : s.add(i); st.pick = s.size ? [...s].sort((a, b) => a - b) : null; }
        else st.pick = i;
        opts.forEach((o, j) => o.setAttribute('aria-checked', String(multi ? !!st.pick && st.pick.includes(j) : j === i)));
        saved.picks[name] = st.pick; saveState();
      };
      g.setAttribute('role', multi ? 'group' : 'radiogroup'); g.setAttribute('aria-label', name);
      opts.forEach((o, i) => {
        const head = el('div', 'k-option-head'), nm = el('div', 'k-name');
        nm.append(el('span', 'k-num', String(i + 1)), d.createTextNode(o.dataset.option));
        if (o.hasAttribute('data-recommended')) nm.append(el('small', 'k-rec', 'Recommended'));
        if (o.dataset.sub) nm.append(el('small', '', o.dataset.sub));
        head.append(el('span', 'k-radio'), nm);
        head.firstChild.setAttribute('aria-hidden', 'true');
        o.prepend(head); o.tabIndex = 0; o.setAttribute('role', multi ? 'checkbox' : 'radio'); o.setAttribute('aria-checked', 'false');
        o.addEventListener('click', e => { if (!e.target.closest('a,button,textarea,input,select,.k-zoomable')) choose(i); }); // an image opens the preview, not a pick
        o.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && e.target === o) { e.preventDefault(); choose(i); } });
      });
      ta.addEventListener('input', () => { grow(); saved.notes[name] = ta.value; saveState(); emit(st); });
      if (co) {
        /* Comment-only group: no options. At the end, the comment field at full width, then the group's own Final row. */
        g.removeAttribute('role'); g.setAttribute('role', 'group');
        if (!g.dataset.comment) ta.placeholder = 'Comment';
        const note = el('div', 'k-note'); note.append(ta, item.btn.parentNode); g.append(note);
        item.btn.addEventListener('click', () => emit(st));
      } else if (item.btn.parentNode.parentNode === g) item.btn.parentNode.before(ta); // the Final row stays the footer
      else g.append(ta);
      const sp = saved.picks[name];
      if (multi) { if (Array.isArray(sp)) sp.filter(i => opts[i]).forEach(choose); }
      else if (sp != null && opts[sp]) choose(sp);
      if (saved.notes[name]) { ta.value = saved.notes[name]; grow(); }
      return st;
    });

    cssIn.then(() => groups.forEach(g => g.ta.value && g.grow()));

    /* 2b. Option dots (the shared OptionDots overlay, copied in at the top of this file): a [data-dot="Label"] box puts a dot
       on its parent element, and the dot's popover shows the box. A box with options makes a blue dot, a comment-only
       group a green one. The box goes back to its place when the popover closes, so Copy choices and Final still see it. */
    let od = null;
    const dotBoxes = $$('[data-dot]');
    if (dotBoxes.length && window.OptionDots) {
      od = window.OptionDots({ key: 'kit-dots:' + location.pathname });
      dotBoxes.forEach(b => {
        const mark = d.createComment('dot'); b.before(mark); b._part = b.closest('.k-part'); let t = 0;
        od.add({ target: mark.parentElement, label: b.dataset.dot, pick: !!b.querySelector('[data-option]'),
          render: body => { clearTimeout(t); body.append(b); groups.forEach(g => b.contains(g.el) && g.grow()); },
          onClose: () => { t = setTimeout(() => mark.after(b), ms('--k-close') + 40); } });
      });
    }
    const inPart = (p, n) => p.contains(n) || (n.closest('[data-dot]') || {})._part === p; // a dot box may sit in the popover

    /* Copy format: "- Group: N Option name - comment", later comment lines indented two spaces. */
    /* Only open groups print: a finalized group (or one in a finalized part) is already answered. */
    /* A comment-only group prints "- Group: comment", with no pick part. */
    api.choices = () => groups.filter(g => !g.item.own()).map(g => {
      const lines = g.ta.value.trim().split('\n'), rest = lines.slice(1).map(l => '\n  ' + l).join('');
      const head = `- ${g.name}`;
      if (g.co) return head + (lines[0] ? ': ' + lines[0] : '') + rest;
      const nm = i => `${i + 1} ${g.opts[i].dataset.option}`;
      const pick = g.pick == null ? 'No pick' : g.multi ? g.pick.map(nm).join(', ') : nm(g.pick);
      return `${head}: ${pick}${lines[0] ? ' - ' + lines[0] : ''}${rest}`;
    }).join('\n') || 'No open items.';
    /* Sync hooks for page code (for example a shared database). items() reports each group and whether the viewer
       saved a value in this browser; set() shows an outside value without saving it locally, so a later local edit wins. */
    api.items = () => groups.map(g => ({ name: g.name, el: g.el, note: g.ta.value, final: g.item.own(),
      localNote: g.name in saved.notes, localFinal: g.item.k in saved.fin }));
    api.set = (name, v) => {
      const g = groups.find(x => x.name === name); if (!g) return;
      if (typeof v.note === 'string') { g.ta.value = v.note; g.grow(); }
      if (typeof v.final === 'boolean') { g.item.el.toggleAttribute('data-final', v.final); refresh(); }
    };

    /* 3. Detail rows and phone mockups */
    $$('.k-row').forEach(r => {
      const dt = r.querySelector(':scope > .k-detail'); if (!dt) return;
      const inner = el('div', 'k-detail-in'); inner.append(...dt.childNodes); dt.append(inner); // see .k-detail-in in kit.css
      // A click inside the open detail (to select or scroll its text) does not close the row.
      r.tabIndex = 0; r.addEventListener('click', e => { if (!e.target.closest('.k-detail, a, button')) r.classList.toggle('k-open'); });
      r.addEventListener('keydown', e => { if (e.target === r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); r.classList.toggle('k-open'); } });
    });
    // Matrix marks are drawn by CSS, so screen readers get their meaning here.
    const mk = { 'k-y': 'Yes', 'k-n': 'No', 'k-p': 'Partly', 'k-u': 'Not checked' };
    $$('.k-mk').forEach(e => { const k = Object.keys(mk).find(c => e.classList.contains(c)); if (k && !e.hasAttribute('aria-label')) { e.setAttribute('role', 'img'); e.setAttribute('aria-label', mk[k]); } });
    // A .k-table stacks into cards on a phone (kit.css): each cell gets its column's header as data-label.
    $$('.k-table table').forEach(t => { const h = $$('thead th', t).map(th => th.textContent.trim());
      $$('tbody tr', t).forEach(tr => [...tr.cells].forEach((c, i) => { if (h[i] && !c.dataset.label) c.dataset.label = h[i]; })); });
    /* 3a. Inbox rail: the sidebar's content moves into .k-side-in. A mouse that rests 40 ms on the rail, keyboard focus,
       or a tap opens it as a floating panel (aria-expanded); leaving it (80 ms), Esc, a tap outside or a row click closes it.
       While closed, a tap or click on the rail only opens it, so a touch never jumps to a thread it cannot read yet. */
    $$('.k-side').forEach(s => {
      const inn = el('div', 'k-side-in'); inn.append(...s.childNodes); s.append(inn);
      // Each row: an id column (icon and number, pinned) and the words, which fade in one row after another.
      $$('.k-th', inn).forEach((r, i) => {
        const k = r.querySelector('.k-kind'), id = el('span', 'k-th-id'), body = el('span', 'k-th-body');
        if (k) { if (k.dataset.state) id.dataset.state = k.dataset.state; id.append(...$$(':scope > .k-oct, :scope > .k-ref', k)); }
        body.append(...r.childNodes); body.style.setProperty('--i', i); r.append(id, body);
      });
      // Closed, each section label shows a short form over the id column ("Pull requests" -> "PRs"); data-short overrides.
      $$(':scope > .k-kicker', inn).forEach(k => { const t = k.textContent.trim(); if (!k.dataset.short) k.dataset.short = /^pull requests$/i.test(t) ? 'PRs' : t.split(/\s+/)[0]; });
      // Each label becomes one moving label (kit.css): the short form swaps vertically into the long one; a label that is
      // the same in both ("Issues") stays whole and only moves.
      $$(':scope > .k-kicker', inn).forEach(k => {
        const l = k.textContent.trim(), sh = k.dataset.short, m = el('span', 'k-kk');
        m.setAttribute('aria-hidden', 'true');
        if (sh === l) m.append(el('span', '', l));
        else { const tail = el('span', 'k-kk-t'); tail.append(el('span', 'k-kk-s', sh), el('span', 'k-kk-l', l)); m.append(tail); }
        k.replaceChildren(el('span', 'k-kk-sr', l), m);
      });
      new ResizeObserver(() => s.style.setProperty('--k-ph', inn.offsetHeight + 'px')).observe(inn); // the shadow and edge layers take the panel's height
      let t = 0;
      let shut = 0; // a pointer that comes back while the rail is still closing reopens it at once, from where it is
      const set = o => { clearTimeout(t); if (!o && s.classList.contains('k-open')) shut = Date.now(); s.classList.toggle('k-open', o); s.setAttribute('aria-expanded', String(o)); };
      const later = (o, ms) => { clearTimeout(t); t = setTimeout(() => set(o), ms); };
      set(false);
      // Hover intent: data-open-delay and data-close-delay (ms) on the .k-side override 40 and 80.
      const od = +(s.dataset.openDelay ?? 40), cd = +(s.dataset.closeDelay ?? 80);
      s.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') later(true, Date.now() - shut < 300 ? 0 : od); });
      s.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') later(false, cd); });
      s.addEventListener('focusin', () => set(true));
      s.addEventListener('focusout', e => { if (!s.contains(e.relatedTarget)) set(false); });
      s.addEventListener('keydown', e => { if (e.key === 'Escape') { set(false); document.activeElement.blur(); } });
      let wasOpen = false; // state at pointerdown: the focus that a press gives a row opens the panel before the click lands
      s.addEventListener('pointerdown', () => { wasOpen = s.classList.contains('k-open'); }, true);
      s.addEventListener('click', e => {
        if (e.detail && !wasOpen) { e.preventDefault(); e.stopImmediatePropagation(); set(true); } // e.detail 0: keyboard
        else if (e.target.closest('.k-th')) setTimeout(() => { set(false); document.activeElement.blur(); });
      }, true);
      document.addEventListener('pointerdown', e => { if (!s.contains(e.target)) set(false); });
    });
    /* 3b. Avatars: <a class="k-av" data-login="x"> gets its GitHub link, the first letter, and the GitHub image over it;
       an image that fails to load is removed, so the letter shows. */
    $$('.k-av[data-login]').forEach(a => {
      const l = a.dataset.login;
      if (a.tagName === 'A' && !a.getAttribute('href')) { a.href = 'https://github.com/' + l; a.target = '_blank'; a.rel = 'noopener'; }
      if (!a.title) a.title = '@' + l;
      if (!a.childNodes.length) { a.textContent = l[0]; const im = el('img'); im.alt = ''; im.dataset.noZoom = ''; im.onerror = () => im.remove(); im.src = `https://github.com/${l}.png?size=48`; a.append(im); }
    });
    const phones = $$('.k-phone[data-h]'), fit = () => phones.forEach(p => {
      const w = +p.dataset.w || 390, s = p.clientWidth / w, sc = p.querySelector('.k-screen'), h = +p.dataset.h;
      p.style.height = h * s + 'px'; if (sc) { sc.style.width = w + 'px'; sc.style.height = h + 'px'; sc.style.transform = `scale(${s})`; }
    });
    if (phones.length) { if (window.ResizeObserver) phones.forEach(p => new ResizeObserver(fit).observe(p)); addEventListener('resize', fit); fit(); }

    /* 3a. Tall images: an image much taller than its card's box (natural height/width over 2x the box's) shows its top part,
       with a blur fade and a "Click to see all" hint at the bottom (k-tall on the figure). Short or wide images stay contained. */
    const tall = img => {
      const f = img.closest('.k-shot'); if (!f || f.classList.contains('k-cover') || !img.naturalWidth) return;
      const r = (getComputedStyle(img).aspectRatio.match(/[\d.]+/g) || []).slice(-2).map(Number), box = r.length === 2 && r[0] ? r[1] / r[0] : .75;
      // 2x, not less: a phone screenshot (about 9:19.5) in a 4:5 box stays whole; a long page or a 3000 px settings window is cut.
      const t = img.naturalHeight / img.naturalWidth > 2 * box;
      f.classList.toggle('k-tall', t);
      if (t && !f.querySelector(':scope > .k-more')) (img.parentElement === f ? img : img.parentElement).after(el('span', 'k-more', 'Click to see all'));
    };
    /* Every image in .k-wrap or .k-shot (and any img[data-zoom]) becomes .k-zoomable and opens the preview panel on a click,
       Enter or Space. data-no-zoom, or a link around the image, opts out. Images added later are marked too. */
    const mark = () => {
      $$('.k-shot img, .k-wrap img, img[data-zoom]').forEach(img => {
        if (img.classList.contains('k-zoomable') || img.closest('a, [data-no-zoom], .k-lb')) return;
        img.classList.add('k-zoomable'); img.tabIndex = 0; img.setAttribute('role', 'button');
        img.setAttribute('aria-label', 'Open preview' + (img.alt ? ': ' + img.alt : ''));
        img.addEventListener('load', () => tall(img)); if (img.complete) tall(img);
      });
      // An HTML mockup with data-zoom="Title" opens in the same panel: a live copy of the node, scaled like an image.
      $$('[data-zoom]:not(img)').forEach(n => {
        if (n.classList.contains('k-zoomable') || n.closest('.k-lb')) return;
        n.classList.add('k-zoomable'); n.tabIndex = 0; n.setAttribute('role', 'button');
        n.setAttribute('aria-label', 'Open preview' + (n.dataset.zoom ? ': ' + n.dataset.zoom : ''));
      });
    };
    mark(); new MutationObserver(mark).observe(d.body, { childList: true, subtree: true });
    cssIn.then(() => $$('img.k-zoomable').forEach(tall));
    /* A video in a .k-shot plays full screen with controls on a click, Enter or Space (the preview panel is for images). */
    $$('.k-shot video').forEach(v => {
      v.tabIndex = 0; v.setAttribute('role', 'button');
      const big = () => { v.controls = true; const f = v.requestFullscreen || v.webkitEnterFullscreen; if (f) Promise.resolve(f.call(v)).catch(() => { v.controls = false; }); };
      v.addEventListener('click', () => { if (!d.fullscreenElement) big(); });
      v.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !d.fullscreenElement) { e.preventDefault(); big(); } });
    });
    d.addEventListener('fullscreenchange', () => { if (!d.fullscreenElement) $$('.k-shot video').forEach(v => { v.controls = false; }); });
    /* Copy a doc: button.k-copydoc[data-copy] copies the text of an element (data-copy="#id", a <script type="text/markdown">
       or <template>) or of a file published beside the page (data-copy="path.md", fetched at start, so the copy runs inside the
       click). An empty button gets the copy icon. A bubble left of the button says "Copied" for 1.5 s. */
    $$('.k-copydoc[data-copy]').forEach(b => {
      const src = b.dataset.copy; let text = '';
      b.type = 'button';
      if (!b.firstElementChild) b.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8.5" rx="1.8"/><path d="M10.5 3.5v-.3A1.7 1.7 0 0 0 8.8 1.5H4.2A1.7 1.7 0 0 0 2.5 3.2v5.6a1.7 1.7 0 0 0 1.7 1.7h.3"/></svg>';
      const n = src[0] === '#' ? d.querySelector(src) : null;
      (n ? Promise.resolve((n.content || n).textContent) : fetch(src).then(r => r.ok ? r.text() : '')).then(t => { text = t || ''; }, () => {});
      const done = msg => { b.dataset.msg = msg; b.classList.add('k-done'); clearTimeout(b.kitT); b.kitT = setTimeout(() => b.classList.remove('k-done'), 1500); };
      const manual = () => { const ta = el('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; d.body.append(ta); ta.select(); let ok = false; try { ok = d.execCommand('copy'); } catch {} ta.remove(); b.focus(); done(ok ? 'Copied' : 'Copy blocked'); };
      b.addEventListener('click', () => {
        if (!text) return done('Still loading');
        try { navigator.clipboard.writeText(text).then(() => done('Copied'), manual); } catch { manual(); }
      });
    });
    const vis = () => $$('.k-zoomable').filter(n => n.getClientRects().length);
    d.addEventListener('click', e => { const t = e.target.closest && e.target.closest('.k-zoomable'); if (t) preview(t); });
    d.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.metaKey && !e.ctrlKey && !e.altKey && e.target.matches && e.target.matches('.k-zoomable')) { e.preventDefault(); preview(e.target); }
    });

    /* 3b. Preview panel: a modal <dialog> over a dimmed, blurred page. The image grows from its thumbnail (about 220 ms; a fade
       or a cut when Animation is Off or the system asks for reduced motion) and shrinks back on close. Wheel or pinch zooms at
       the pointer, drag pans, double-click (or Z) toggles fit and 100%, keys + - 0 1, arrows pan when zoomed and go to the
       previous or next visible image of the page when not. Esc, the close button or a click on the backdrop closes it, and focus
       returns to the thumbnail. While it is open, the kit's arrow keys and hover focus pause. */
    let lb;
    function preview(img) {
      if (!lb) lb = mkPreview();
      if (root.classList.contains('k-lb-open')) return;
      const list = vis(), k = list.indexOf(img);
      lb.open(k < 0 ? [img] : list, Math.max(0, k));
    }
    api.lightbox = i => { const l = vis(); if (l[i || 0]) preview(l[i || 0]); };
    // The visible rect of a thumbnail's picture (object-fit: contain leaves room beside it).
    const shown = t => {
      const r = t.getBoundingClientRect(), nw = t.naturalWidth, nh = t.naturalHeight;
      if (getComputedStyle(t).objectFit !== 'contain' || !nw) return r;
      const s = Math.min(r.width / nw, r.height / nh);
      return { left: r.left + (r.width - nw * s) / 2, top: r.top + (r.height - nh * s) / 2, width: nw * s, height: nh * s, bottom: r.bottom, right: r.right };
    };
    function mkPreview() {
      const dlg = el('dialog', 'k-lb'), im = el('img', 'k-lb-img'), box = el('div', 'k-lb-img k-lb-dom'), x = el('button', 'k-lb-x', '×'), bar = el('div', 'k-lb-bar'), cap = el('output');
      const btn = (t, label, fn) => { const b = el('button', '', t); b.type = 'button'; b.setAttribute('aria-label', label); b.onclick = fn; return b; };
      const prevB = btn('‹', 'Previous image', () => show(i - 1)), nextB = btn('›', 'Next image', () => show(i + 1));
      const zoomB = btn('100%', 'Switch between fit and 100%', () => zoomTo(near(fit) ? 1 : fit));
      const dl = el('a', '', 'Download'); dl.setAttribute('download', '');
      const share = navigator.share ? btn('Share', 'Share image', () => navigator.share({ title: cap.textContent, url: im.src }).catch(() => {})) : null;
      dlg.setAttribute('aria-label', 'Image preview'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.onclick = () => close();
      im.alt = ''; im.draggable = false;
      bar.append(prevB, cap, nextB, zoomB, dl); if (share) bar.append(share);
      dlg.append(im, box, bar, x); d.body.append(dlg);
      let list = [], cur = im, dw = 1, dh = 1, i = 0, s = 1, fit = 1, tx = 0, ty = 0, moved = 0, wt = 0, pinch = null, grow = false, closing = false;
      const motion = () => anim === 'play' && !reduce.matches;
      const onScreen = r => r.width && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      // Jump the image (no transition) onto the thumbnail's visible rect.
      const toThumb = () => { const r = shown(list[i]); if (!onScreen(r)) return false; s = r.width / nw(); tx = r.left; ty = r.top; cur.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`; return true; };
      const pts = new Map(), W = () => dlg.clientWidth, H = () => dlg.clientHeight, nw = () => cur === im ? im.naturalWidth || 1 : dw, nh = () => cur === im ? im.naturalHeight || 1 : dh;
      const near = v => Math.abs(s - v) < .005, zoomed = () => nw() * s > W() + 1 || nh() * s > H() + 1;
      const quick = () => { dlg.classList.add('k-drag'); clearTimeout(wt); wt = setTimeout(() => !pts.size && dlg.classList.remove('k-drag'), 160); };
      const apply = () => {
        const w = nw() * s, h = nh() * s;
        tx = w <= W() ? (W() - w) / 2 : Math.min(0, Math.max(W() - w, tx));
        ty = h <= H() ? (H() - h) / 2 : Math.min(0, Math.max(H() - h, ty));
        cur.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
        zoomB.textContent = Math.round(s * 100) + '%';
      };
      const zoomTo = (v, px = W() / 2, py = H() / 2) => {
        v = Math.min(Math.max(v, Math.min(fit, 1)), Math.max(fit, 1) * 6);
        tx = px - (px - tx) * v / s; ty = py - (py - ty) * v / s; s = v; apply();
      };
      const reset = () => {
        const pad = W() < 600 ? 12 : 40;
        fit = Math.min(2, (W() - 2 * pad) / nw(), (H() - 150) / nh());
        if (grow) { // grow from the thumbnail: jump onto it with no transition, then animate to the fit
          grow = false; clearTimeout(wt); dlg.classList.add('k-drag');
          const ok = toThumb(); void cur.offsetWidth; dlg.classList.remove('k-drag');
          if (ok) { s = fit; apply(); return; }
        }
        s = fit; quick(); apply();
      };
      im.onload = reset;
      function show(k) {
        if (list[i]) list[i].style.visibility = '';
        i = (k + list.length) % list.length;
        const n = list[i], dom = n.tagName !== 'IMG', url = dom ? '' : n.currentSrc || n.src, fig = n.closest('figure'), t = fig && fig.querySelector('figcaption b');
        const name = (t && t.textContent) || (dom ? n.dataset.zoom : n.alt);
        if (dom) { // a live copy of the mockup at its own layout size (no page zoom), scaled like an image
          const z = parseFloat(getComputedStyle(n).zoom) || 1, c = n.cloneNode(true);
          c.classList.remove('k-zoomable'); c.removeAttribute('tabindex'); c.removeAttribute('role');
          c.style.cssText += `;zoom:1;margin:0;width:${n.getBoundingClientRect().width / z}px`;
          box.replaceChildren(c); box.hidden = false; im.hidden = true; cur = box; dw = c.offsetWidth || 1; dh = c.offsetHeight || 1;
        } else { box.hidden = true; box.replaceChildren(); im.hidden = false; cur = im; }
        n.style.visibility = 'hidden'; // the thumbnail lifts out of the page into the panel
        cap.textContent = `${i + 1} / ${list.length}` + (name ? ' · ' + name : '');
        prevB.hidden = nextB.hidden = list.length < 2;
        dl.hidden = dom; if (!dom) { dl.href = url; dl.setAttribute('download', url.split('/').pop().split('?')[0] || 'image'); }
        if (dom) reset(); else if (im.src === url && im.complete) reset(); else im.src = url;
      }
      const step = k => { show(k); list[i].scrollIntoView({ block: 'nearest' }); }; // keep the thumbnail in view, so close shrinks back onto it
      prevB.onclick = () => step(i - 1); nextB.onclick = () => step(i + 1);
      function close() {
        if (closing || !dlg.open) return; closing = true;
        if (!motion()) return dlg.close();
        dlg.classList.remove('k-drag'); toThumb(); dlg.classList.remove('k-show'); setTimeout(() => dlg.close(), ms('--k-close'));
      }
      dlg.addEventListener('cancel', e => { e.preventDefault(); close(); }); // Esc
      dlg.addEventListener('close', () => {
        closing = false; dlg.classList.remove('k-show'); root.classList.remove('k-lb-open');
        const n = list[i]; if (n) { n.style.visibility = ''; if (n.isConnected) n.focus({ preventScroll: true }); }
      });
      dlg.addEventListener('wheel', e => {
        e.preventDefault(); quick();
        const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
        zoomTo(s * Math.exp(-dy * (e.ctrlKey ? .01 : .0025)), e.clientX, e.clientY);
      }, { passive: false });
      dlg.addEventListener('pointerdown', e => {
        if (e.target.closest('button, a')) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; dlg.classList.add('k-drag');
        try { dlg.setPointerCapture(e.pointerId); } catch {}
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, s }; }
      });
      dlg.addEventListener('pointermove', e => {
        const p = pts.get(e.pointerId); if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
        if (pts.size === 1) { tx += dx; ty += dy; apply(); }
        else if (pts.size === 2 && pinch) { // two fingers: zoom by their spread, pan by their midpoint
          const [a, b] = [...pts.values()]; tx += dx / 2; ty += dy / 2;
          zoomTo(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
        }
      });
      const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) dlg.classList.remove('k-drag'); };
      dlg.addEventListener('pointerup', up); dlg.addEventListener('pointercancel', up);
      dlg.addEventListener('click', e => { if (e.target === dlg && moved < 6) close(); });
      dlg.addEventListener('dblclick', e => { if (cur.contains(e.target)) zoomTo(near(fit) ? (fit < 1 ? 1 : fit * 2) : fit, e.clientX, e.clientY); });
      dlg.addEventListener('keydown', e => {
        e.stopPropagation(); // the page's arrow keys must not move parts behind the panel
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const k = e.key, pan = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] }[k];
        if (k === '+' || k === '=') zoomTo(s * 1.25);
        else if (k === '-' || k === '_') zoomTo(s / 1.25);
        else if (k === '0') zoomTo(fit);
        else if (k === '1') zoomTo(1);
        else if (k === 'z' || k === 'Z') zoomTo(near(fit) ? 1 : fit);
        else if (pan && zoomed()) { tx += pan[0]; ty += pan[1]; apply(); }
        else if (k === 'ArrowLeft' || k === 'ArrowRight') step(i + (k === 'ArrowLeft' ? -1 : 1));
        else return;
        e.preventDefault();
      });
      addEventListener('resize', () => dlg.open && reset());
      return { open(l, k) {
        list = l; i = 0; grow = motion(); closing = false;
        dlg.showModal(); root.classList.add('k-lb-open'); x.focus({ preventScroll: true }); show(k);
        void dlg.offsetWidth; dlg.classList.add('k-show');
      } };
    }

    /* 3c. Popovers: any [data-pop] element. data-pop="#id" shows a <template>; any other value is a key in window.KitPops,
       a map the page sets in an inline script before kit.js starts (any script at the end of <body> does):
       { key: { title, text, rows: { Label: value }, href, link, state, mine } }. state and mine color a .k-ref;
       href fills an <a> that has none. Hover or keyboard focus shows it; a tap shows it first, a second tap follows the link. */
    const popEls = $$('[data-pop]'), pops = window.KitPops || {};
    if (popEls.length) {
      const pop = el('div', 'k-pop'); pop.id = 'k-pop'; pop.setAttribute('role', 'tooltip'); d.body.append(pop);
      let cur = null, t = 0;
      const entry = n => { const k = n.dataset.pop; return k[0] === '#' ? d.querySelector(k) : pops[k]; };
      const place = n => {
        const r = n.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
        let y = r.bottom + 8; if (y + h > innerHeight - 16) y = Math.max(16, r.top - h - 8);
        pop.style.left = Math.min(Math.max(16, r.left), innerWidth - w - 16) + 'px'; pop.style.top = y + 'px';
      };
      const hide = () => { pop.classList.remove('k-show'); if (cur) cur.removeAttribute('aria-describedby'); cur = null; };
      const show = n => {
        const e = entry(n); if (!e) return;
        pop.replaceChildren();
        if (e.content) pop.append(e.content.cloneNode(true));
        else {
          if (e.title) pop.append(el('h4', '', e.title));
          if (e.text) pop.append(el('p', '', e.text));
          const rows = Object.entries(e.rows || {});
          if (rows.length) { const dl = el('dl'); rows.forEach(([k, v]) => dl.append(el('dt', '', k), el('dd', '', v))); pop.append(dl); }
          const href = e.href || n.href;
          if (href) { const a = el('a', '', e.link || 'Open ↗'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; pop.append(a); }
        }
        cur = n; n.setAttribute('aria-describedby', 'k-pop'); place(n); pop.classList.add('k-show');
      };
      popEls.forEach(n => {
        const e = entry(n); if (!e) return;
        if (!e.content) {
          if (e.state) n.dataset.state = e.state;
          if (e.mine) n.dataset.mine = '';
          if (e.href && n.tagName === 'A' && !n.getAttribute('href')) { n.href = e.href; n.target = '_blank'; n.rel = 'noopener'; }
        }
        if (!n.matches('a[href], button, [tabindex]')) n.tabIndex = 0;
        n.addEventListener('mouseenter', () => { clearTimeout(t); t = setTimeout(() => show(n), 120); });
        n.addEventListener('mouseleave', () => { clearTimeout(t); t = setTimeout(hide, 200); });
        n.addEventListener('focus', () => show(n));
        n.addEventListener('blur', () => setTimeout(() => { if (!pop.contains(d.activeElement)) hide(); }, 150));
        n.addEventListener('click', ev => { if (cur !== n) { ev.preventDefault(); show(n); } });
      });
      pop.addEventListener('mouseenter', () => clearTimeout(t));
      pop.addEventListener('mouseleave', () => { t = setTimeout(hide, 200); });
      d.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
      d.addEventListener('click', e => { if (cur && !pop.contains(e.target) && !e.target.closest('[data-pop]')) hide(); });
      addEventListener('scroll', () => cur && place(cur), { passive: true });
    }

    /* 3d. Flow charts: .k-flow > .k-lane > .k-node (see README). Each node gets its icon and time bar; one SVG layer draws
       every arrow from the live card boxes, so the arrow ends touch their cards at any width. Hover, focus or a tap opens
       one overlay card that grows from the node's box with its .k-node-more text. */
    const SVGNS = 'http://www.w3.org/2000/svg';
    const ICONS = {
      camera: '<path d="M2 5.5h2.4l1.2-1.8h4.8l1.2 1.8H14v7.3H2z"/><circle cx="8" cy="9" r="2.3"/>',
      model: '<path d="M8 1.8l5.6 3.1v6.2L8 14.2l-5.6-3.1V4.9z"/><path d="M2.4 4.9L8 8l5.6-3.1M8 8v6.2"/>',
      vision: '<path d="M1.4 8S3.8 3.6 8 3.6 14.6 8 14.6 8 12.2 12.4 8 12.4 1.4 8 1.4 8z"/><circle cx="8" cy="8" r="2.1"/>',
      code: '<path d="M5.6 4.4L2 8l3.6 3.6M10.4 4.4L14 8l-3.6 3.6"/>',
      server: '<path d="M4.6 12.6h7a2.9 2.9 0 0 0 .4-5.8 4.1 4.1 0 0 0-7.9-.4 3.1 3.1 0 0 0 .5 6.2z"/>',
      list: '<path d="M6 4.3h8M6 8h8M6 11.7h8M2.4 4.3h.1M2.4 8h.1M2.4 11.7h.1"/>',
    };
    const icon = name => { const v = d.createElementNS(SVGNS, 'svg'); v.setAttribute('class', 'k-ic'); v.setAttribute('viewBox', '0 0 16 16'); v.setAttribute('aria-hidden', 'true'); v.innerHTML = ICONS[name] || ICONS.code; return v; };
    const kindIcon = n => n.dataset.icon || ({ model: 'model', vision: 'vision', server: 'server' })[n.dataset.kind] || 'code';
    $$('.k-flow-key > span[data-kind]').forEach(s => { if (s.dataset.kind !== 'time') s.prepend(icon(kindIcon(s))); });
    $$('.k-flow').forEach((flow, fi) => {
      const scale = +flow.dataset.scale || 0;
      if (flow.dataset.cols) flow.style.setProperty('--k-cols', flow.dataset.cols);
      const nodes = $$('.k-lane > .k-node', flow), byId = {};
      nodes.forEach(n => {
        byId[n.dataset.id] = n; n.tabIndex = 0;
        [['col', '--c'], ['span', '--s'], ['nspan', '--ns']].forEach(([a, v]) => { if (n.dataset[a]) n.style.setProperty(v, n.dataset[a]); });
        if (n.hasAttribute('data-dec')) { n.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><polygon points="50,1 99,30 50,59 1,30"/></svg>'); return; }
        const b = n.querySelector(':scope > b'), top = el('span', 'k-node-top'); top.append(icon(kindIcon(n)));
        if (b) { b.before(top); top.append(b); } else n.prepend(top);
        const t = el('span', 'k-time'), ms = parseFloat(n.dataset.ms);
        if (isNaN(ms) || !scale) t.classList.add('k-none'); else { const i = el('i'); i.style.setProperty('--w', Math.min(100, ms / scale * 100).toFixed(1) + '%'); t.append(i); }
        const more = n.querySelector(':scope > .k-node-more'); if (more) more.before(t); else n.append(t);
      });
      // Edges: [from, to, label, wide route, narrow route, dashed]. Routes: auto (side by side: straight; else down with one bend), over, rail.
      const E = [];
      nodes.forEach(n => (n.dataset.to || '').split(/\s+/).filter(Boolean).forEach(t => E.push([n.dataset.id, t])));
      $$('.k-edge', flow).forEach(e => E.push([e.dataset.from, e.dataset.to, e.dataset.label, e.dataset.route || 'auto', e.dataset.narrow || e.dataset.route || 'auto', e.hasAttribute('data-dash')]));
      E.forEach(e => { if (e[3] === 'over' && byId[e[0]]) byId[e[0]].parentElement.classList.add('k-top'); });
      const svg = d.createElementNS(SVGNS, 'svg'); svg.setAttribute('class', 'k-flow-lines'); svg.setAttribute('aria-hidden', 'true');
      const mk = `k-arr${fi}`;
      svg.innerHTML = '<defs>' + ['', '-hot'].map(h => `<marker id="${mk}${h}"${h ? ' class="k-hot"' : ''} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker>`).join('') + '</defs><g></g>';
      flow.prepend(svg);
      const g = svg.querySelector('g');
      // A decision's box is its diamond, so the arrows meet the diamond's points, not the empty button corners.
      const box = n => { const r = (n.hasAttribute('data-dec') ? n.querySelector(':scope > svg') : n).getBoundingClientRect(), o = flow.getBoundingClientRect();
        const lane = n.closest('.k-lane');
        return { l: r.left - o.left, t: r.top - o.top, r: r.right - o.left, b: r.bottom - o.top, cx: (r.left + r.right) / 2 - o.left, cy: (r.top + r.bottom) / 2 - o.top,
          lane, lt: lane.getBoundingClientRect().top - o.top }; };
      const pathOf = (p, rad = 10) => { let s = `M${p[0][0]} ${p[0][1]}`;
        for (let i = 1; i < p.length; i++) { const [x, y] = p[i];
          if (i < p.length - 1) { const [px, py] = p[i - 1], [nx, ny] = p[i + 1];
            const r = Math.min(rad, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2);
            s += `L${x - Math.sign(x - px) * r} ${y - Math.sign(y - py) * r}Q${x} ${y} ${x + Math.sign(nx - x) * r} ${y + Math.sign(ny - y) * r}`; } else s += `L${x} ${y}`; }
        return s; };
      // (x, y) is the anchor; ax and ay pick which point of the label box sits there. The label sits on a knock-out in the color behind it.
      const label = (txt, x, y, ax, ay, band) => {
        const t = d.createElementNS(SVGNS, 'text'); t.textContent = txt; g.append(t);
        const w = t.getComputedTextLength() + 12, h = 18, l = x - w * ax, top = y - h * ay;
        t.setAttribute('x', l + 6); t.setAttribute('y', top + 13);
        const r = d.createElementNS(SVGNS, 'rect'); if (band) r.setAttribute('class', 'k-inband');
        Object.entries({ x: l, y: top, width: w, height: h, rx: 6 }).forEach(([k, v]) => r.setAttribute(k, v)); g.insertBefore(r, t);
      };
      const draw = () => {
        g.replaceChildren(); if (!flow.getClientRects().length) return;
        const wide = flow.clientWidth >= 1100, B = {}; nodes.forEach(n => { B[n.dataset.id] = box(n); });
        const rail = Math.max(...Object.values(B).map(b => b.r)) + 16, labs = [];
        for (const [a, b, txt, rw = 'auto', rn = 'auto', dash] of E) {
          const A = B[a], C = B[b]; if (!A || !C) continue;
          const mode = wide ? rw : rn; let pts, lab = null;
          if (mode === 'over') { const y = Math.min(A.t, C.t) - 22; pts = [[A.cx, A.t], [A.cx, y], [C.cx, y], [C.cx, C.t - 1]]; lab = [(A.cx + C.cx) / 2, y, .5, .5, true]; }
          else if (mode === 'rail') pts = [[A.r, A.cy], [rail, A.cy], [rail, C.cy], [C.r + 1, C.cy]];
          else if (Math.abs(A.cy - C.cy) < 12) { const dir = C.cx > A.cx ? 1 : -1, y = A.cy; pts = [[dir > 0 ? A.r : A.l, y], [dir > 0 ? C.l - 1 : C.r + 1, y]]; lab = [(pts[0][0] + pts[1][0]) / 2, y - 5, .5, 1, true]; }
          // Narrow: into another lane, bend in the gap above that lane and enter the card near its right edge, clear of the lane name.
          else if (!wide && A.lane !== C.lane) { const my = C.lt - 20, tx = C.r - 28; pts = [[A.cx, A.b], [A.cx, my], [tx, my], [tx, C.t - 1]]; lab = [(A.cx + tx) / 2, my, .5, .5, false]; }
          else if (Math.abs(A.cx - C.cx) < 3) { pts = [[A.cx, A.b], [A.cx, C.t - 1]]; lab = [A.cx + 10, (A.b + C.t) / 2, 0, .5, false]; }
          else { const my = (A.b + C.t) / 2; pts = [[A.cx, A.b], [A.cx, my], [C.cx, my], [C.cx, C.t - 1]]; lab = [(A.cx + C.cx) / 2, my, .5, .5, false]; }
          const p = d.createElementNS(SVGNS, 'path'); p.setAttribute('d', pathOf(pts)); p.setAttribute('marker-end', `url(#${mk})`);
          p.dataset.a = a; p.dataset.b = b; if (dash) p.classList.add('k-dash'); g.append(p);
          if (txt && lab) labs.push([txt, ...lab]);
        }
        labs.forEach(l => label(...l)); // after every line, so no line crosses a label
      };
      draw(); addEventListener('resize', draw); if (d.fonts) d.fonts.ready.then(draw);
      if (window.ResizeObserver) new ResizeObserver(draw).observe(flow);

      // Hover or tap lights the card's own arrows (paint only).
      const hot = (id, on) => g.querySelectorAll(`[data-a="${id}"],[data-b="${id}"]`).forEach(p => { p.classList.toggle('k-hot', on); p.setAttribute('marker-end', `url(#${mk}${on ? '-hot' : ''})`); });
      const big = el('div', 'k-node k-flow-big'); big.setAttribute('role', 'note'); flow.append(big);
      let cur = null, pinned = false, wait = 0;
      const open = n => {
        clearTimeout(wait); if (cur === n) return; if (cur) { hot(cur.dataset.id, false); cur.classList.remove('k-on'); }
        cur = n; n.classList.add('k-on');
        if (n.dataset.kind) big.dataset.kind = n.dataset.kind; else delete big.dataset.kind;
        big.replaceChildren(...[...n.children].filter(c => c.tagName !== 'svg').map(c => c.cloneNode(true)));
        const o = flow.getBoundingClientRect(), r = n.getBoundingClientRect(), vw = root.clientWidth, pad = 12;
        const dock = d.querySelector('.k-dock'), floor = (dock ? Math.min(innerHeight, dock.getBoundingClientRect().top) : innerHeight) - pad;
        const w = Math.min(Math.max(r.width, 400), vw - 2 * pad);
        big.classList.remove('k-anim', 'k-shut'); big.classList.add('k-open');
        Object.assign(big.style, { left: '0px', top: '0px', width: w + 'px', height: 'auto' });
        const h = Math.max(big.offsetHeight, r.height);
        let x = r.left; if (x + w > vw - pad) x = Math.max(pad, r.right - w); // near the right edge: grow left
        let y = r.top; if (y + h > floor) y = Math.max(pad, r.bottom - h);     // near the bottom or the dock: grow up
        Object.assign(big.style, { left: r.left - o.left + 'px', top: r.top - o.top + 'px', width: r.width + 'px', height: r.height + 'px' });
        void big.offsetWidth; big.classList.add('k-anim');
        Object.assign(big.style, { left: x - o.left + 'px', top: y - o.top + 'px', width: w + 'px', height: h + 'px' });
        hot(n.dataset.id, true);
      };
      const shut = () => {
        clearTimeout(wait); if (!cur) return; const n = cur; cur = null; pinned = false; hot(n.dataset.id, false); n.classList.remove('k-on');
        const o = flow.getBoundingClientRect(), r = n.getBoundingClientRect();
        big.classList.add('k-shut');
        Object.assign(big.style, { left: r.left - o.left + 'px', top: r.top - o.top + 'px', width: r.width + 'px', height: r.height + 'px' });
        const done = () => { if (!cur) big.classList.remove('k-open'); };
        if (anim === 'play' && !matchMedia('(prefers-reduced-motion: reduce)').matches) setTimeout(done, 110); else done();
      };
      nodes.forEach(n => {
        n.addEventListener('mouseenter', () => { if (!pinned) { clearTimeout(wait); wait = setTimeout(() => open(n), 50); } });
        n.addEventListener('mouseleave', e => { clearTimeout(wait); if (!pinned && !big.contains(e.relatedTarget)) shut(); });
        n.addEventListener('focus', () => { if (!pinned && n.matches(':focus-visible')) open(n); }); // keyboard only; a tap opens on click
        n.addEventListener('click', () => { open(n); pinned = true; });
      });
      big.addEventListener('click', () => { pinned = true; });
      big.addEventListener('mouseleave', e => { if (!pinned && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.k-node') === cur)) shut(); });
      d.addEventListener('click', e => { if (cur && !e.target.closest('.k-flow .k-node')) shut(); });
      d.addEventListener('keydown', e => { if (e.key === 'Escape' && cur) shut(); });
      // Arrow keys move between steps in flow order; Enter or Space pins the open card.
      flow.addEventListener('keydown', e => {
        const i = nodes.indexOf(d.activeElement); if (i < 0) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(nodes[i]); pinned = true; return; }
        const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!k) return;
        e.preventDefault(); e.stopPropagation(); nodes[Math.min(nodes.length - 1, Math.max(0, i + k))].focus();
      });
    });

    /* 3e. Stacked bar charts: .k-stackbar with a .k-sb-key (one span[data-c] per segment state) and .k-sb-row[data-v] rows.
       data-v lists segment lengths in axis units, in key order; data-max is the axis end, data-mark the dashed line,
       data-ticks the axis labels (data-unit is added to each). Segments grow from the left when Animation is Play. */
    $$('.k-stackbar').forEach(sb => {
      const max = +sb.dataset.max || 100, unit = sb.dataset.unit || '', cs = $$('.k-sb-key > span[data-c]', sb).map(s => s.dataset.c);
      const pct = v => Math.max(0, Math.min(100, v / max * 100)) + '%';
      $$('.k-sb-row[data-v]', sb).forEach(r => {
        const bar = el('span', 'k-sb-bar');
        r.dataset.v.trim().split(/\s+/).forEach((v, i) => { if (!+v) return; const s = el('i'); s.dataset.c = cs[i] || 'blue'; s.style.width = pct(+v); bar.append(s);
          if (anim === 'play') s.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }); });
        const m = r.dataset.mark || sb.dataset.mark; if (m) { const s = el('s'); s.style.left = pct(+m); bar.append(s); }
        const b = r.querySelector(':scope > b'); if (b) b.after(bar); else r.prepend(bar);
      });
      if (sb.dataset.ticks) {
        const ts = sb.dataset.ticks.split(',').map(Number), row = el('div', 'k-sb-row k-sb-axis'), ax = el('div', 'k-sb-ax');
        ts.forEach((t, i) => { const s = el('span', i % 2 && ts.length > 3 && i < ts.length - 1 ? 'k-minor' : '', t + unit); s.style.left = pct(t); ax.append(s); });
        row.append(el('b'), ax); sb.append(row);
      }
    });

    /* 4. Parts: focus reading in the long page, one slide at a time in slides view */
    /* `parts` holds only the visible parts (see refresh), so dots, count, back/next and focus skip the hidden ones. */
    let cur = -1, lock = 0, tick = 0, dots = [], count, prev, next;
    const ths = $$('.k-th[href^="#"]'); // inbox rows, see below
    const slides = () => root.dataset.view === 'slides';
    const enter = p => {
      p.classList.remove('k-enter'); void p.offsetWidth;
      [...p.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 8)));
      p.classList.add('k-enter'); setTimeout(() => p.classList.remove('k-enter'), 900);
    };
    const paint = () => {
      all.forEach(p => p.classList.toggle('k-focus', p === parts[cur]));
      ths.forEach(a => { a.setAttribute('aria-current', String(!!parts[cur] && a.hash === '#' + parts[cur].id)); a.classList.toggle('k-gone', !parts.some(p => '#' + p.id === a.hash)); });
      if (count) count.textContent = `${parts.length ? cur + 1 : 0} / ${parts.length}`;
      dots.forEach((b, j) => { const k = parts.indexOf(all[j]); b.hidden = k < 0; b.setAttribute('aria-current', String(k === cur)); });
      if (dots[0]) dots[0].parentNode.toggleAttribute('data-many', parts.length > 7); // more than 7: arrows and the number only
      if (prev) { prev.disabled = cur <= 0; next.disabled = cur >= parts.length - 1; }
    };
    const setFocus = (i, animate) => {
      if (!parts.length) return;
      i = Math.max(0, Math.min(parts.length - 1, i));
      if (i === cur) return; cur = i; paint();
      if (animate && anim === 'play') enter(parts[i]);
    };
    const go = i => {
      if (!parts.length) return;
      i = Math.max(0, Math.min(parts.length - 1, i)); setFocus(i, slides());
      if (slides()) scrollTo({ top: 0, behavior: 'auto' });
      else { lock = Date.now() + 700; parts[i].scrollIntoView({ behavior: anim === 'play' ? 'smooth' : 'auto', block: 'start' }); }
    };
    const fromScroll = () => {
      if (!parts.length || slides() || Date.now() < lock) return;
      const line = innerHeight * .4; let k = 0;
      parts.forEach((p, j) => { if (p.getBoundingClientRect().top <= line) k = j; });
      if (scrollY + innerHeight >= root.scrollHeight - 4) k = parts.length - 1;
      if (scrollY < 4) k = 0; // at the very top the first part is in focus, even when it is short
      setFocus(k);
    };
    api.go = go;
    /* Inbox: a .k-th row (href="#<part id>") moves focus to its part; the row of the part in focus gets aria-current. */
    ths.forEach(a => a.addEventListener('click', e => { const i = parts.indexOf(document.getElementById(a.hash.slice(1))); if (i >= 0) { e.preventDefault(); go(i); } }));
    /* Hover: a mouse that stays 55 ms near a part focuses it (page view only). The hitbox is the whole page width, and a gap
       between parts belongs to the nearest part, so the pointer is never in a dead zone. The timer starts once per target,
       so moving inside it does not restart it. pointermove does not fire while the page scrolls, and a scroll cancels the timer. */
    let dwell = 0, armed = -1;
    const disarm = () => { clearTimeout(dwell); armed = -1; };
    const nearest = y => { let k = -1, best = Infinity; parts.forEach((p, j) => { const r = p.getBoundingClientRect(), dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0; if (dy < best) { best = dy; k = j; } }); return k; };
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || slides() || Date.now() < lock || e.target.closest('.k-dock') || root.classList.contains('k-lb-open')) return;
      const k = nearest(e.clientY); if (k < 0 || k === armed) return;
      disarm(); armed = k; if (k !== cur) dwell = setTimeout(() => setFocus(k), 55);
    });
    document.documentElement.addEventListener('pointerleave', disarm);
    addEventListener('scroll', () => { disarm(); if (!tick) tick = requestAnimationFrame(() => { tick = 0; fromScroll(); }); }, { passive: true });
    addEventListener('resize', fromScroll);
    all.forEach(p => { p.addEventListener('click', () => !slides() && setFocus(parts.indexOf(p))); p.addEventListener('focusin', () => !slides() && setFocus(parts.indexOf(p))); });
    addEventListener('keydown', e => {
      if (!parts.length || e.metaKey || e.ctrlKey || e.altKey || e.target.closest('textarea,input,select') || root.classList.contains('k-lb-open')) return; // the preview owns the arrow keys while open
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || (e.key === 'PageDown' && slides())) { e.preventDefault(); go(cur + 1); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || (e.key === 'PageUp' && slides())) { e.preventDefault(); go(cur - 1); }
    });

    /* 5. View switch: slides and long page from one source. #slides in the address bar opens slides. */
    const views = (cfg.dataset.views || 'both') === 'both' && all.length > 1;
    const setView = v => {
      root.dataset.view = v === 'slides' && views ? 'slides' : 'page';
      $$('.k-dock [data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === root.dataset.view)));
      if (parts.length) { paint(); if (slides()) { if (anim === 'play') enter(parts[cur]); scrollTo({ top: 0, behavior: 'auto' }); } else fromScroll(); }
    };
    api.view = v => { setView(v); try { location.hash = root.dataset.view; } catch {} };
    addEventListener('hashchange', () => setView(location.hash === '#slides' ? 'slides' : 'page'));

    /* 6. Mockup Dark/Light toggle (data-mockup-toggle on the [data-kit] element) */
    const setMockup = v => {
      root.dataset.mockup = v; saved.mockup = v; saveState();
      $$('.k-dock [data-mockup]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mockup === v)));
    };

    /* 7. Dock: back, count, dots, next | view | mockup | Copy choices */
    const dock = el('div', 'k-dock'); dock.setAttribute('role', 'toolbar'); dock.setAttribute('aria-label', 'Page controls');
    const seg = (label, items, attr, onPick) => {
      const s = el('div', 'k-seg'); s.setAttribute('role', 'group'); s.setAttribute('aria-label', label);
      items.forEach(([v, t]) => { const b = el('button', '', t); b.type = 'button'; b.dataset[attr] = v; b.setAttribute('aria-pressed', 'false'); b.onclick = () => onPick(v); s.append(b); });
      return s;
    };
    if (all.length > 1) {
      prev = el('button', 'k-nav', '‹'); next = el('button', 'k-nav', '›');
      prev.type = next.type = 'button'; prev.setAttribute('aria-label', 'Back'); next.setAttribute('aria-label', 'Next');
      count = el('output'); const dd = el('div', 'k-dots');
      dots = all.map((p, j) => { const b = el('button'); b.type = 'button'; b.title = p.dataset.part || 'Part ' + (j + 1); b.setAttribute('aria-label', b.title); b.onclick = () => go(parts.indexOf(p)); dd.append(b); return b; });
      prev.onclick = () => go(cur - 1); next.onclick = () => go(cur + 1);
      dock.append(prev, count, dd, next);
    }
    if (views) dock.append(seg('View', [['page', 'Page'], ['slides', 'Slides']], 'view', api.view));
    /* Open/Archived switch. Open shows what is not finalized, Archived what is. */
    const sw = items.length ? seg('Items', [['open', 'Open'], ['archived', 'Archived']], 'arch', v => { arch = v === 'archived'; refresh(); scrollTo({ top: 0, behavior: 'auto' }); }) : null;
    if (sw) dock.append(sw);
    $$('.k-seg[data-dock]').forEach(s => dock.append(s)); // a page's own switch (it handles its own buttons)
    const empty = el('p', 'k-hint k-empty'); empty.hidden = true; cfg.append(empty);
    function refresh() {
      const was = parts[cur];
      items.forEach(it => {
        const own = it.own();
        it.el.classList.toggle('k-gone', own !== arch);
        it.btn.setAttribute('aria-checked', String(own));
        it.btn.title = own ? 'Final. Turn off to move back to Open' : 'Turn on to move to Archived';
      });
      all.forEach((p, j) => { if (!pitems[j]) p.classList.toggle('k-gone', !items.some(it => inPart(p, it.el) &&!it.el.classList.contains('k-gone'))); });
      parts = all.filter(p => !p.classList.contains('k-gone'));
      cur = parts.length ? Math.max(0, parts.indexOf(was)) : -1;
      const n = items.filter(it => it.own()).length;
      sw.children[0].textContent = 'Open ' + (items.length - n); sw.children[1].textContent = 'Archived ' + n;
      sw.children[0].setAttribute('aria-pressed', String(!arch)); sw.children[1].setAttribute('aria-pressed', String(arch));
      empty.hidden = items.some(it => !it.el.classList.contains('k-gone'));
      empty.textContent = arch ? 'Nothing is archived yet.' : 'Everything is finalized. See Archived.';
      paint(); if (!slides()) fromScroll();
    }
    if (cfg.hasAttribute('data-mockup-toggle')) dock.append(seg('Mockup appearance', [['dark', 'Dark'], ['light', 'Light']], 'mockup', setMockup));
    if (all.length > 1) {
      const fSeg = seg('Focus', [['on', 'On'], ['off', 'Off']], 'focus', v => {
        focusOn = v; root.dataset.focus = v; try { localStorage.setItem(focusKey, v); } catch {}
        $$('button', fSeg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.focus === v)));
      });
      $$('button', fSeg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.focus === focusOn)));
      const fl = el('span', 'k-seg-label', 'Focus'); fl.setAttribute('aria-hidden', 'true'); fSeg.prepend(fl); // "On | Off" alone would not say what it switches
      dock.append(fSeg);
    }
    /* Animation switch, after the other switches and before Clear. It shows only on a page with motion: data-motion on the
       [data-kit] element (needed for JS-only loops), a page @keyframes rule, or an element.animate() call. */
    const animSeg = seg('Animation', [['play', 'Play'], ['pause', 'Pause'], ['off', 'Off']], 'anim', v => {
      anim = v; root.dataset.anim = v; try { localStorage.setItem(animKey, v); } catch {}
      d.getAnimations().forEach(a => { if (v !== 'play') freeze(a); else if (a.playState === 'paused') a.play(); });
      pressAnim(); d.dispatchEvent(new CustomEvent('k-anim', { detail: { state: v } }));
    });
    const pressAnim = () => $$('button', animSeg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.anim === anim)));
    const keyframes = () => [...d.styleSheets].some(s => { try { return [...s.cssRules].some(r => r.type === CSSRule.KEYFRAMES_RULE && !r.name.startsWith('k-')); } catch { return false; } });
    const addAnim = () => {
      if (animSeg.isConnected || !(cfg.hasAttribute('data-motion') || sawAnimate || keyframes())) return;
      pressAnim(); dock.insertBefore(animSeg, dock.querySelector('.k-clear, .k-copy')); if (!dock.isConnected) d.body.append(dock);
    };
    let fb;
    if (groups.length || items.length) {
      /* Two clicks within 3 s empty every pick, comment and Final in place, with no reload. The empty values are saved,
         so they win over data-final and over notes that page code loads (localNote), and kit:change lets that code clear its shared copy. */
      const clear = el('button', 'k-clear', 'Clear'); clear.type = 'button'; let armed = 0;
      clear.onclick = () => {
        if (!armed) { clear.textContent = 'Clear all?'; armed = setTimeout(() => { armed = 0; clear.textContent = 'Clear'; }, 3000); return; }
        clearTimeout(armed); armed = 0; clear.textContent = 'Clear';
        items.forEach(it => { saved.fin[it.k] = false; it.el.removeAttribute('data-final'); $$('[data-final]', it.el).forEach(n => n.removeAttribute('data-final')); });
        groups.forEach(g => { g.ta.value = ''; g.grow(); saved.notes[g.name] = ''; delete saved.picks[g.name]; g.pick = null; g.opts.forEach(o => o.setAttribute('aria-checked', 'false')); });
        saveState(); if (items.length) refresh(); groups.forEach(emit);
      };
      dock.append(clear);
    }
    if (groups.length) {
      const copy = el('button', 'k-copy', 'Copy choices'); copy.type = 'button';
      const flash = t => { copy.textContent = t; setTimeout(() => { copy.textContent = 'Copy choices'; }, 1600); };
      const manual = text => {
        fb = fb || d.body.appendChild(Object.assign(el('textarea', 'k-fallback'), { readOnly: true }));
        fb.value = text; fb.hidden = false; fb.focus(); fb.select(); flash('Press Cmd+C');
        fb.onblur = () => { fb.hidden = true; };
      };
      /* The clipboard write must start inside the click handler, so no await comes before it. */
      copy.onclick = () => {
        const text = api.choices();
        try { navigator.clipboard.writeText(text).then(() => { if (fb) fb.hidden = true; flash('Copied'); }, () => manual(text)); } catch { manual(text); }
      };
      dock.append(copy);
    }
    if (od) dock.insertBefore(od.controls, dock.querySelector('.k-clear, .k-copy'));
    if (dock.children.length) d.body.append(dock);
    // Check for motion now and once all styles are in; hold what already runs when the saved state is Pause or Off.
    const settle = () => { addAnim(); d.getAnimations().forEach(freeze); };
    onMotion = addAnim; settle(); addEventListener('load', settle);

    /* 8. Start */
    setMockup(cfg.dataset.mockup || saved.mockup || 'dark');
    cur = 0; if (items.length) refresh(); else paint();
    setView(location.hash === '#slides' ? 'slides' : (cfg.dataset.view === 'slides' ? 'slides' : 'page'));
    if (parts.length && anim === 'play') enter(parts[0]);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();
