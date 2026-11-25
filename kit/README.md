# Artifact Kit

One shared look and one shared script for every owner page. A page needs only markup.

Files: `kit.css` (tokens, components, dark blocks), `kit.js` (focus reading, choices, dock, views), `kitcheck.mjs` (layout check), `example.html` (every component), `img/` (example images only), `flowchart/` and `stackedbar/` (full chart examples, with a reference screenshot each).

One source: the option dots and their dock part in `kit.js` are a copy of `../dots.js`, and the dock rules in `../devpanel.js` are cut from `kit.css`. After editing `dots.js` or `kit.css`, run `node dots-sync.mjs kit/kit.js devpanel.js` from the repo root. Never edit the copies. Cloud kit pages work in Light and Dark; local dev-artifacts pages are dark only.

## Use it on a published page

1. Publish your page as `.html`. Put this at the top, beside `<title>` and the viewport meta tag:

```html
<script src="kit.js"></script>
```

   The `<title>` is exactly the tab title from `../title.mjs` (`DV_TITLE_CMD`'s output, such as `project > tab`, else the repo folder name). Kit pages are `Kit > <topic>`. kitcheck fails on any other title.

2. Copy the kit files into your artifact on the server. Pass this `files` map to the Artifact tool, with `<kit url>` set to the published kit artifact (this folder, published with `example.html` as its page):

```json
{"kit.css": {"artifact": "<kit url>", "path": "kit.css"},
 "kit.js":  {"artifact": "<kit url>", "path": "kit.js"}}
```

3. Write markup only. Wrap the page in `<main class="k-wrap" data-kit>`. Copy patterns from `example.html`.

How loading works: `kit.js` fetches `kit.css` from the same folder and injects it as a `<style>`. The CSP blocks `<link rel="stylesheet">` for your own files, so this is the supported route. It holds the first paint until the CSS is in (2.5 s limit). Without JS, or if the fetch fails, the markup still reads as plain HTML.

If a host also blocks scripts from the artifact's own files, inline both at build time: paste `kit.css` into a `<style>` and `kit.js` into a `<script>` in your page. The page then works the same.

Before every publish, run `node <dev-artifacts>/kit/kitcheck.mjs <page.html>` and publish only on exit 0. It renders the page at 1440 and 390 px wide, Light and Dark, with every detail row open, saves the four screenshots, and lists each offender with its element and px: a card closer than 12 px to content above or below it, card content closer than 14 px to the card edge (inset lists and tables use their row padding; cover images are exempt), sideways overflow, clipped text, and crushed text (a squeezed column that wraps after every few characters). It serves the page's own folder; kit files missing there come from this folder. Fix an offender in the kit, not with page CSS, unless the page's own markup causes it. Screenshots: on a first publish or a layout change, look at the desktop Light and phone Dark shots; on a text-only update with exit 0, skip them; on a failure, look at each failing shot.

Name your own classes with a page prefix (for example `p-`), never short names like `.c` or `.rec`, and never the kit's `k-` prefix. Short names clash with page code.

Transitions stay off until `kit.js` adds `html.k-ready`, one frame after the styles land. An inlined kit gets it on load.

## Markup

| Class | Use |
|---|---|
| `k-wrap` | Page frame (gutter, max width). Add `data-kit` to it. |
| `k-part` | One reading part. Also one slide. Add `data-part="Name"` (dot tooltip). |
| `k-kicker`, `k-title` (44 px), `k-h2` (28 px, 34 px in slides), `k-lead`, `k-hint` | Text scale |
| `k-list` > `k-row` > `<span>label</span><span>value</span>` | Grouped inset list, label left, value right, soft zebra rows |
| `<table>` (wrap in `div.k-table` when it may be wide) | Card table with zebra rows and faint hairlines; on phones a `k-table` stacks each row into a card (first cell as title, then label-value rows from the headers), so nothing scrolls sideways |
| `div.k-table.k-mx` > `<table>`, cells `<i class="k-mk k-y"></i><small>note</small>` | Matrix: options as rows, features as columns. Marks: `k-y` green ✓, `k-n` red ✗, `k-p` amber ◐ partly, `k-u` gray ? not checked. `tr.k-rec` tints the recommended row. Explain the marks once in a `k-legend`. On phones each row becomes a card of feature, mark, note. |
| `k-steps` > `k-step` > `<b>1. Title</b><span>One or two sentences</span>` | Step cards for a flow, side by side, stacked on phones |
| `k-todo-head` + `k-todos` > `k-group[data-comment-only]` > `k-todo` > `<b>` + `<span>` | To-do cards under a group header ("Waiting for you"). Each card: text, full-width comment field, Final row. Wide columns (440 px minimum) fill the row; a lone card spans it. A bare `k-todo` in `k-todos` is a card without a comment. |
| `k-pending` | Dashed placeholder for content that arrives later |
| `pre.k-text` | Long draft or log: keeps line breaks, shows at least 5 and up to 18 lines, then scrolls inside its box. Works in a `k-detail` (kit.js wraps the detail in `k-detail-in`, so it collapses fully and opens unclipped; a click inside the open text does not close the row) or an option. |
| `k-ref` with `data-state="open / merged / draft / closed"`, `data-mine` | A reference number (PR, issue) colored by state, orange underline for the owner's own. `k-legend` explains them once in a row. |
| `data-pop="key"` or `data-pop="#template-id"` on any element | Popover on hover, focus or tap. See Popovers. |
| `k-row` + `<div class="k-detail"><p>...</p></div>` | Long detail, opens only on a click, tap or Enter (hover never changes layout) |
| `k-group` > `k-options` > `k-option` | Option panels, side by side, stacked on phones |
| `k-status k-red / k-amber / k-blue / k-green / k-gray` > `<h3>` + `k-list` | Tinted status group, state named once in the header |
| `k-shots` > `figure.k-shot` > `<img>` (or `<picture>` with Light/Dark `<source>`s around the `<img>`) + `<figcaption><b>Title</b><span>One detail line</span></figcaption>` | Screenshot card grid. `style="--ratio:4/5"` sets the image box. Add `k-cover` for thumbnails (cover); default is the full frame (contain). A contained image, or a mockup wrapped in `div.k-media`, keeps 14 px of room on every side, so nothing touches the divider or the card edge; the room beside a contained image takes the card color, never a dark bar. The caption sits under a faint hairline, with no shadow. Cover images stay edge to edge. `style="--shot-min:520px"` on `k-shots` sets the narrowest column (default 240 px). A very tall image (natural height/width more than 2x the box's) shows its top part with a blur fade and a "Click to see all" hint; phone screenshots in a 4/5 box stay whole. Every image opens the lightbox (see Image lightbox). |
| `figure.k-shot` > `div.k-media` > `video` | A clip beside screenshots (`autoplay muted loop playsinline`). A click, Enter or Space plays it full screen with controls. |
| `div.k-head` > (heading block) + `button.k-copydoc[data-copy][aria-label]` | Section header with icon actions on the right, copy last. `data-copy="#id"` copies the text of a `<script type="text/markdown" id>` or `<template>`; `data-copy="path.md"` copies a file published beside the page (fetched at start). An empty button gets the copy icon; "Copied" shows in a bubble for 1.5 s. |
| `k-shots` > `k-group[data-comment-only]` > `figure.k-shot` | Review one item at a time (for example 96 screenshots): each card gets its own full-width comment field and a Final row under it, no options. Placed straight in a `k-part`, the group is one comment card for the whole part. |
| Any block straight in a `k-part` | Spacing needs no wrapper. A block (list, grid, status group, comment card, page block) keeps 16 px from whatever is above it. A text block (`k-kicker`, `k-title`, `k-h2`, `k-lead`, `k-hint`, `k-line`, `k-todo-head`) after a block keeps 32 px, as it opens a new section. Text after text keeps its own small margins. |
| `k-phone[data-h]` > `k-screen` | Mockup drawn at 390 pt wide, scaled to the width. Helpers: `k-m-title`, `k-m-list`, `k-m-li`, `k-m-sw` (switch, add `on`). |
| `k-flow-key` + `k-flow[data-scale]` > `k-lane` > `<header><b>Lane</b><span>Fact</span></header>` + `k-node` | Flow chart: tinted lanes, step cards left to right, arrows with labels, a diamond decision, a dashed loop-back, hover or tap opens the full card. See Flow chart. |
| `k-stackbar` > `k-sb-key` + `k-sb-row[data-v]` > `<b>Name</b><em>Result</em>` | Stacked bar chart on one shared axis, with a dashed mark and axis labels. See Stacked bar chart. |
| `k-cols`, `k-stack`, `k-line`, `k-mono` | Layout and text helpers |
| `k-inbox`, `k-side`, `k-th`, `k-kind`, `k-oct`, `k-state`, `k-meta`, `k-at`, `k-av`, `k-tl`, `k-ev`, `k-target`, `k-tag`, `k-by`, `k-prose`, `k-reply` | GitHub thread replies: see Thread replies pattern. `k-prose` (Markdown-like text at body size) also works anywhere else. |

## Data attributes

| Attribute | On | Effect |
|---|---|---|
| `data-kit` | `k-wrap` | Page config root |
| `data-view="slides"` | `data-kit` element | Start in slides. Default is the long page. `#slides` in the address also opens slides. |
| `data-views="page"` | `data-kit` element | Turn the Page/Slides switch off |
| `data-round="9"` | `data-kit` element | Review round. Saved picks, comments and Final states are kept per round, so a republished round never brings back the last round's answers. Change it on every republish that asks new questions. |
| `data-mockup-toggle` | `data-kit` element | Add the Dark/Light switch for `.k-phone` mockups (sets `data-mockup` on `<html>`) |
| `data-mockup="light"` | `data-kit` element | Start mockups in Light (default Dark) |
| `data-part="Name"` | `k-part` | Dot tooltip and name |
| `data-group="Name"` | `k-group` | Group name in Copy choices |
| `data-final` | `k-part`, `k-group` | Start finalized (in Archived). On a group inside a part it finalizes the whole part. The owner's click is saved and wins over this. Use it for every item the owner finalized. |
| `data-comment-only` | `k-group` | No options: a comment field and its own Final row. A part that holds one has no Final row; each group in it moves to Archived alone, and the part shows while any of its groups does. |
| `data-keep` | `k-group` | Add "Keep as is" and "Keep as is, show more options" panels |
| `data-multi` | `k-group` | Pick many: each option toggles on its own (rounded-square check). Copy choices lists every picked option in order. |
| `data-comment="Hint"` | `k-group` | Placeholder of the comment field (the kit adds one for every group) |
| `data-option="Name"` | `k-option` | Panel name. Number is the position. kit.js adds the name, radio and number. |
| `data-recommended` | `k-option` | Shows "Recommended" as plain blue text. List the recommended option first. |
| `data-sub="Text"` | `k-option` | Small grey line under the name |
| `data-w`, `data-h` | `k-phone` | Mockup width (default 390) and height in points |
| `data-motion` | `data-kit` element | Show the Animation switch. Needed when the only motion is a JS loop (rAF or timers). |

## Flow chart

Markup only; kit.js adds the icons, time bars and arrows, and redraws the arrows on every size change, so arrow ends touch their cards at any width. Full example: `flowchart/reference.html` (screenshot `reference.png`).

- `k-flow`: `data-scale="25"` is the full time bar in ms; `data-cols="6"` card columns per lane (default 6). Below 1100 px of flow width each lane has two columns and the cards wrap.
- `k-node`: `data-id` (for arrows), `data-kind` = `model` (blue), `vision` (green), `server` (amber), or none (plain code, gray). It sets the border, icon and bar color. `data-icon` = `camera`, `list`, `model`, `vision`, `server`, `code` overrides the icon. `data-ms` draws the time bar. `data-span`, `data-col` (leave a gap), `data-nspan` (span on narrow, 1 or 2; default 2). `data-ghost` dashed side path. `data-dec` diamond decision (only a `<b>` question).
- Card body: `<b>Name</b>`, `<span>` real values, then `<em>` (italic note, such as "RAM, CPU: measuring") or `<small>`, then `div.k-node-more` with `<p>` sentences and a `<code>` source line, shown only in the open card.
- Arrows: `data-to="id id"` on a node for plain arrows. A labelled or routed arrow is `<i class="k-edge" data-from data-to data-label data-route data-narrow data-dash>` in the flow. Routes: `auto` (straight, or down with one bend), `over` (loop over the top lane), `rail` (down the right side). `data-narrow` is the route on narrow widths.
- `k-flow-key` spans: `data-kind` = `model`, `vision`, `server`, `code` (icon added), or `time` (bar sample).

```html
<p class="k-flow-key"><span data-kind="model">Model file in the app</span><span data-kind="code">Plain code</span><span data-kind="time">A full bar is 25 ms</span></p>
<div class="k-flow" data-scale="25">
  <section class="k-lane"><header><b>Camera</b><span>10 frames a second</span></header>
    <div class="k-node" data-id="cam" data-icon="camera" data-ms="0.5" data-to="dec"><b>Camera</b><span>1280 x 720 · 30 fps</span><em>RAM, CPU: measuring</em>
      <div class="k-node-more"><p>Plain sentences for the open card.</p><code>AVCaptureSession</code></div></div>
    <div class="k-node" data-id="dec" data-dec data-nspan="1"><b>Full step?</b></div>
    <div class="k-node" data-id="watch" data-ghost data-ms="9.5" data-nspan="1"><b>Watch step</b><span>12% · 9.5 ms</span></div>
  </section>
  <section class="k-lane"><header><b>On-device vision</b><span>88% of frames</span></header>
    <div class="k-node" data-id="find" data-kind="model" data-span="2" data-ms="22.6"><b>Item finder</b><span>YOLOE-11s · 22.6 ms</span></div>
  </section>
  <i class="k-edge" data-from="dec" data-to="watch" data-label="No"></i>
  <i class="k-edge" data-from="dec" data-to="find" data-label="Yes"></i>
  <i class="k-edge" data-from="watch" data-to="cam" data-label="next frame" data-route="over" data-narrow="rail" data-dash></i>
</div>
```

## Stacked bar chart

One row per option on one shared axis. Put the question in a `k-h2` and one how-to-read line in a `k-hint` above it, and an optional `k-list` under it. Full example: `stackedbar/reference.html` (screenshot `reference.png`).

- `k-stackbar`: `data-max` axis end, `data-mark` dashed line (a row's own `data-mark` wins), `data-ticks="0,180,360"` axis labels, `data-unit=" s"` added to each label. Add `role="img"` and an `aria-label` with the answer. An optional `<h3>` names the chart.
- `k-sb-key`: one `span[data-c]` per segment state, in order. Colors: `soft` (light gray), `gray`, `blue`, `green`, `amber`, `red`. A span without `data-c` is a plain note ("Dashed line: ...").
- `k-sb-row[data-v="142 200 348"]`: segment lengths in axis units, in key order (0 skips one). `<b>` name left, `<em>` plain result right; on a phone the result moves under the bar and every second tick hides. Segments grow from the left when Animation is Play.

```html
<div class="k-stackbar" data-max="720" data-mark="690" data-ticks="0,180,360,540,720" data-unit=" s" role="img" aria-label="Build 21 stays cool for the whole run.">
  <p class="k-sb-key"><span data-c="soft">Cool</span><span data-c="amber">Warm</span><span data-c="red">Hot</span><span>Dashed line: end of the run (690 s)</span></p>
  <div class="k-sb-row" data-v="142 200 348"><b>Build 16</b><em>Hot at 342 s</em></div>
  <div class="k-sb-row" data-v="690"><b>Build 21</b><em>Never Hot</em></div>
</div>
```

## Final row

Every part, every group outside a part, and every comment card ends with a footer row: "Final" left, a macOS switch right (track and knob, system blue when on). It is a `button[role=switch]` with `aria-checked`; Tab reaches it, Space or Enter toggles it, and a click on the label toggles it too. On moves the item to Archived; Copy choices leaves it out.

## Image lightbox (preview panel)

Every image in `.k-wrap` or `.k-shot` (and any `img[data-zoom]`) opens on a click, Enter or Space (cursor `zoom-in`). No markup needed. Add `data-no-zoom` to an image to opt out; an image inside a link stays a link. Images added later work too. An HTML mockup with `data-zoom="Title"` (any element, not only `img`) opens in the same panel as a live copy of the node at its own layout size, so CSS motion keeps running; it zooms, pans and steps like an image, with no Download.

- It opens in a modal panel over a dimmed, blurred page, fit to the screen, grown from the thumbnail (about 220 ms; a fade or a cut when Animation is Off or the system asks for reduced motion), and shrinks back onto it on close.
- Wheel or trackpad pinch zooms at the pointer, drag pans, two-finger pinch and drag work on phones, double-click or Z switches fit and 100%. Keys: `+` `-` zoom, `0` fit, `1` 100%, arrows pan when zoomed; Left and Right step through the page's visible images when not.
- The bottom bar: back, "n / total · title" (the `figcaption <b>` title, or the alt text), next, the zoom (click: fit or 100%), Download, and Share where the browser has it.
- Esc, the round close button or a click on the backdrop closes it; focus returns to the thumbnail. While it is open, the kit's arrow keys and hover focus pause. A click on an image inside an option card opens it and does not pick the option.
- `Kit.lightbox(i)` opens the i-th visible image.

## Popovers

`data-pop="#id"` shows a `<template id="id">`. Any other value is a key in `window.KitPops`, which the page sets in a script at the end of `<body>` (it runs before kit.js starts):

```js
window.KitPops = { 876: { title: 'PR #876 · Settings window polish', text: 'One plain sentence.', rows: { By: 'You', State: 'Open' },
  href: 'https://github.com/o/r/pull/876', link: 'Open on GitHub ↗', state: 'open', mine: true } };
```

`state` and `mine` color a `k-ref`; `href` fills an `<a>` that has none. Hover (120 ms) or keyboard focus shows it, a tap shows it first and a second tap follows the link, Esc or a click outside hides it.

## Option dots

`<div data-dot="Name">` holding a `k-group` puts a dot on its parent element; the dot opens the group in a popover. A blue dot has options to pick; a green dot holds a comment-only group. The dock gets back and next over the blue dots (they scroll there and open the popover) and an eye button that hides the dots (a reload keeps it). The code is `../dots.js`, copied in at the top of kit.js (see One source above).

## Focus switch

The dock has "Focus On | Off" on every page with two or more parts, after the other switches and before Animation. Default On: the part in focus is sharp and the others sit at 80% opacity, so they stay easy to read. Off: nothing is dimmed. Arrow keys, back, next and dots still move between parts. The pick is saved per page (localStorage key `kit-focus:<path>`) and set as `data-focus` on `<html>` before first paint. Hover focuses a part after 55 ms; the fade in and out takes 120 ms.

## Animation switch

The dock has "Animation: Play | Pause | Off", after the other switches and before Clear. It shows when the page has motion: a page `@keyframes` rule, an `element.animate()` call, or `data-motion`. The pick is saved per page (localStorage key `kit-anim:<path>`) and set as `data-anim` on `<html>` before first paint. Default is Play, or Off when the system asks for reduced motion.

- Pause: CSS animations freeze in place. Web Animation loops pause; one-shot animations jump to their end.
- Off: no CSS animations, no transitions; Web Animations end. Focus dimming still works, at once.
- Open and close: every collapsible (rail panel, `k-detail` rows, popovers, lightbox, Archived moves) opens on `--k-ease` (gentle spring, no overshoot) over `--k-open` (380ms) and closes on `--k-ease-close` (ease-out quint) over `--k-close` (220ms). Words come in over `--k-morph-in` (150ms), from `--k-words-at` (40ms), rows `--k-stagger` (12ms) apart, and leave over `--k-morph-out` (100ms) before the surface shrinks. Heights fold (grid rows `1fr` to `0fr`, or a Web Animation), never snap. Use these tokens in page motion too; never a new duration.
- Rail motion (owner pick, 2026-11-16): clipped panel (clip-path, not width), spring open 380ms, quint close 220ms, hover waits 40ms to open and 80ms to close (`data-open-delay`, `data-close-delay` override them).
- Word morph (owner pick, 2026-11-16): vertical swap ("PRs" slides up and out, "Pull requests" slides up in) while the label moves to the left edge; row words slide in by 8px.
- Tuning one rail: set the tokens in the `k-side`'s style. A page's own dock switch is a `<div class="k-seg" data-dock role="group" aria-label="...">` of buttons with `aria-pressed`; kit.js moves it into the dock and the page handles its clicks.
- A JS loop must obey it: read `Kit.anim()` (`'play'`, `'pause'` or `'off'`) and listen to `document.addEventListener('k-anim', e => e.detail.state)`. On Pause, stop advancing time and keep the frame. On Off, stop and show the rest or end frame.

JS API: `Kit.choices()` returns the copy text, `Kit.go(i)` moves focus to part `i`, `Kit.view('slides' or 'page')`, `Kit.focus()` returns `'on'` or `'off'`, `Kit.lightbox(i)` opens the i-th visible image. For syncing with a shared database: `Kit.items()` lists each group (`name`, `el`, `note`, `final`, and `localNote`/`localFinal` when this browser saved a value), `Kit.set(name, {note, final})` shows an outside value without saving it locally, and every comment edit or Final click fires `kit:change` on `document` (`detail`: `name`, `el`, `note`, `final`).

To inline the kit, escape `</script` as `<\/script` in the pasted `kit.js`.

## What kit.js does

Focus reading (one part sharp, the rest lightly dimmed, or nothing dimmed with Focus Off; dock, arrow keys, click, hover (after a short dwell; the hitbox is the full page width, and a gap between parts belongs to the nearest part) or scroll move it; short fade and stagger, only when Animation is Play). One pick for each group (many with `data-multi`) with a growing comment field. Picks and comments are kept in localStorage. Slides and long page from the same markup. A Final switch row on every part, and on every group outside a part, moves it to Archived (a group inside a part follows its part) (saved in localStorage); the dock switch "Open N | Archived N" picks the view, and dots, count, back/next, focus and slides cover only the visible items. Floating dock: back, count, dots, next (with more than 7 visible items the dots hide and the dock shows only "‹ 3 / 158 ›"; the same rule holds for any option stepper on a page), view switch, Open/Archived switch, optional mockup switch, Focus switch, Animation switch (pages with motion), Clear, Copy choices. Saved state is tied to the option names: when a republished page changes a group's options, that group's pick, comment and Final state reset by themselves, and Clear (click twice within 3 s) empties every pick, comment and Final in place, data-final included. The empty values are saved, so notes that page code loads (a seed or a shared database) do not come back in this browser, and one `kit:change` event for each group lets that code clear its shared copy. A note that the database returns, even an empty one, must replace any seed note.

## Copy format

One line for each open group. Finalized groups (and groups in a finalized part) are left out. With nothing open, the text is `No open items.` Later comment lines are indented two spaces. A group with no comment has no dash part. A group with no pick says `No pick`. A comment-only group prints `- Name: comment`, with no pick part. A `data-multi` group joins its picks with commas.

```
- Settings layout: 2 Two columns - make the title smaller
  second line
- Voice player: No pick
- Thread shows: 1 Who asked, 3 State
```

The clipboard write starts inside the click handler. If it fails, the text appears in a box, already selected, and the button says "Press Cmd+C".

## Thread replies pattern

A page of draft replies to GitHub issues and pull requests (owner, 2026-11-15). The kit has every class it needs: write no page CSS and no page script. Copy the markup below (it is the last section of `example.html`) and change only the text, links and logins.

Rules, one line each:

- Layout: the long page (no `data-view`). `k-inbox` holds the sidebar `k-side` (sticky on a desktop, stacked on top on a phone) and one `k-part` for each thread. Each sidebar row is `a.k-row.k-th` with `href="#<part id>"`; kit.js moves focus to that part on a click and marks the row of the part in focus. A row whose part is archived hides. kit.js collapses the sidebar to a 72 px rail of icons and numbers (a sticky top bar on a phone); a resting mouse, keyboard focus or a tap morphs the rail into a floating panel over the threads, which never move.
- Option layout: text-heavy options (replies, drafts) stack as full-width cards, recommended first (default in `k-reply`, `data-stack` on any other `k-options`); visual options such as mockups stay side by side.
- Kind: the sidebar row and the thread header start with `.k-kind` (data-state as `k-ref`): the octicon `i.k-oct[data-icon]` (`issue`, `issue-closed`, `pr`, `pr-draft`, `pr-merged`, `pr-closed`, `commit`), the word "Issue" or "Pull request", the `k-ref` number, and the state as a plain word in `k-state`. A closed, completed issue uses `issue-closed` with `data-state="merged"` (purple, as on GitHub).
- Second line (`k-meta`): starts with "Yours" when the thread is the owner's, else "By @login", then one short phrase. The owner's numbers get `data-mine` (orange underline). "Yours" appears nowhere else.
- Names: every person, the owner too, is written `@login` (`@monalisa`), never "You" or "I". In the timeline and tables it is `a.k-at` to `https://github.com/<login>` with `target="_blank"`; in a sidebar row (itself a link) it is plain text.
- Avatars: `<a class="k-av" data-login="<login>"></a>`, empty. kit.js adds the link, the GitHub image and the first letter under it (shown when the image fails). It is opaque, with a ring in the color of the surface behind the avatar (the card; set `--ring` on the avatar when it sits on another surface). An event without a person (a commit) is `span.k-av` holding `i.k-oct`.
- Always shown, without a click: a `k-list` with Who asked, What they asked (one line), State, and Changed since; then the 3 reply options. Older timeline items are `k-row k-ev` rows, folded to one line, with the full text in a `k-detail`.
- The comment you reply to: `k-target` in the timeline (`k-tl`), with `p.k-tag` "You reply to this comment", the `k-by` line, and its text in `k-prose`.
- Page start: `k-kicker` "<project> · GitHub replies", a `k-title` that is the answer ("3 threads wait for your reply"), and a `k-lead` ("Pick one reply for each thread, add a comment if you want a change, then press Copy choices and paste it into the chat."), then the `k-inbox`.
- Pull request review: its inline comments are a `k-list` inside the `k-target`, one row each (file left, the ask in a few words right, the comment and a "Code line on GitHub" link in its `k-detail`).
- One reply group for each thread, never more (the owner picks one reply per thread). When the draft answers inline comments one by one, each option ends with a "Code comments, each posted as its own reply:" paragraph and a `ul` with one short answer for each.
- Reply options: `k-reply` (tinted, indented) > `p.k-tag` "Your reply to @login" > `k-group` > 3 `k-option`, the recommended first. Each option's text is `div.k-prose` at body size (paragraphs, `ul`, `code`), never `pre.k-text`. Prefer a list in an option (its column is narrow); a table the draft needs as evidence goes in `div.k-table`, where it scrolls sideways.
- The 3 options differ only in emphasis: full answer with numbers, short answer, answer plus a question. All state the same facts, taken from the draft. The question is an open point from the thread or the draft, never a new topic.
- No draft yet: `k-reply` holds `k-pending` "A reply draft is being written. Its 3 options appear here when it is ready."
- Copy choices: `data-group` is the thread name, `Pull request #2757` or `Issue #2648`. It copies as `- Pull request #2757: 1 Full answer - comment`.

```html
<p class="k-kicker">Project · GitHub replies</p>
<h1 class="k-title">2 threads wait for your reply</h1>
<p class="k-lead">Pick one reply for each thread, add a comment if you want a change, then press Copy choices and paste it into the chat.</p>
<div class="k-inbox">
  <nav class="k-side" aria-label="Threads">
    <p class="k-kicker">Pull requests</p>
    <div class="k-list">
      <a class="k-row k-th" href="#t-101">
        <span class="k-kind" data-state="draft"><i class="k-oct" data-icon="pr-draft"></i>Pull request <span class="k-ref" data-state="draft" data-mine>#101</span><span class="k-state">Draft</span></span>
        <span class="k-meta">Yours · @octocat asked for changes</span></a>
    </div>
    <p class="k-kicker">Issues</p>
    <div class="k-list">
      <a class="k-row k-th" href="#t-88">
        <span class="k-kind"><i class="k-oct" data-icon="issue"></i>Issue <span class="k-ref" data-state="open">#88</span><span class="k-state">Open</span></span>
        <span class="k-meta">By @octocat · the build fails on Linux</span></a>
    </div>
  </nav>
  <div>
    <section class="k-part" id="t-101" data-part="Pull request #101">
      <p class="k-kind" data-state="draft"><i class="k-oct" data-icon="pr-draft"></i>Pull request <a class="k-ref" data-state="draft" data-mine href="https://github.com/o/r/pull/101" target="_blank">#101</a><span class="k-state">Draft</span></p>
      <h2 class="k-h2">Frame pacing: wait for the display link</h2>
      <p class="k-meta">Yours · review by <a href="https://github.com/octocat" target="_blank">@octocat</a>: changes requested</p>
      <div class="k-list">
        <div class="k-row"><span>Who asked</span><span><a class="k-at" href="https://github.com/octocat" target="_blank">@octocat</a></span></div>
        <div class="k-row"><span>What they asked</span><span>Add a test, fix the env row, 2 code points</span></div>
        <div class="k-row"><span>State</span><span>Draft, changes requested</span></div>
        <div class="k-row"><span>Changed since</span><span>Commit 12a49ea fixes every point</span></div>
      </div>
      <div class="k-tl">
        <div class="k-list">
          <div class="k-row k-ev"><a class="k-av" data-login="monalisa"></a><span><a class="k-at" href="https://github.com/monalisa" target="_blank">@monalisa</a> opened this pull request <span class="k-meta">· Nov 15, 04:20</span></span>
            <div class="k-detail"><p>The display-link callback latches the present it woke.</p></div></div>
        </div>
        <div class="k-target">
          <p class="k-tag">You reply to this comment</p>
          <div class="k-by"><a class="k-av" data-login="octocat"></a><span><a class="k-at" href="https://github.com/octocat" target="_blank">@octocat</a> <span class="k-meta">requested changes · Nov 15, 07:15 · <a href="https://github.com/o/r/pull/101#pullrequestreview-1" target="_blank">Open on GitHub</a></span></span></div>
          <div class="k-prose"><p>No <code>DM_LATCH</code> row in <code>env_switches.tsv</code>. Add a timeline test through the callback.</p></div>
          <p class="k-meta">2 inline comments. Click one for its text and code line.</p>
          <div class="k-list">
            <div class="k-row"><span>nvn_mtl.m</span><span>The wait has no cap</span>
              <div class="k-detail"><p>Cap the wait at cb + period. <a href="https://github.com/o/r/pull/101#discussion_r1" target="_blank">Code line on GitHub</a></p></div></div>
            <div class="k-row"><span>frame-rate.md</span><span>The make line needs GAME=</span>
              <div class="k-detail"><p>Without GAME= the Makefile stops. <a href="https://github.com/o/r/pull/101#discussion_r2" target="_blank">Code line on GitHub</a></p></div></div>
          </div>
        </div>
        <div class="k-list">
          <div class="k-row k-ev"><span class="k-av"><i class="k-oct" data-icon="commit"></i></span><span>Since: commit 12a49ea, review fixes <span class="k-meta">· Nov 15, 14:12</span></span>
            <div class="k-detail"><p>Adds the env row, the test, the cap and GAME=.</p></div></div>
        </div>
      </div>
      <div class="k-reply">
        <p class="k-tag">Your reply to @octocat</p>
        <div class="k-group" data-group="Pull request #101" data-comment="Change anything in this reply?">
          <div class="k-options">
            <div class="k-option" data-option="Full answer" data-recommended data-sub="Each point with its numbers">
              <div class="k-prose"><p>Thanks for the review. Every point is fixed in 12a49ea.</p><ul><li><code>DM_LATCH</code> has its row, and <code>--check</code> passes.</li><li>New test <code>t_latch_cb.m</code>: 11 checks, 0 failed.</li></ul></div></div>
            <div class="k-option" data-option="Short answer" data-sub="One line and the commit">
              <div class="k-prose"><p>Thanks. Every point is fixed in 12a49ea: the env row and a timeline test (11 checks, 0 failed).</p></div></div>
            <div class="k-option" data-option="Answer plus a question" data-sub="Asks about the 120 Hz path">
              <div class="k-prose"><p>Thanks. Every point is fixed in 12a49ea.</p><p>One question: should the 120 Hz path go into a follow-up pull request?</p></div></div>
          </div>
        </div>
      </div>
    </section>
    <section class="k-part" id="t-88" data-part="Issue #88">
      <!-- same shape: k-kind, k-h2, k-meta "By @octocat · ...", the k-list, k-tl with a k-target, then k-reply -->
    </section>
  </div>
</div>
```
