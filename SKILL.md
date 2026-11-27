---
name: dev-artifacts
description: Show design options live on a local website or web app with the dev-artifacts overlay (every option group in the dock, Copy choices) instead of building a separate options page. Use when asked to give options or variations for a local website, web app, landing page, or site section, or to preview looks on the dev server.
---

# dev-artifacts

Options shown on the real page, beside the real content. Cheaper than a separate options page.
`<repo>` below is the folder of this file. Read `<repo>/README.md` only when a step here is not enough.

## Which way

- **Default: a local options page.** Copy `<repo>/templates/choice-page.html` into `<scratch>/<name>/index.html`, put the
  images beside it, run `node <repo>/serve.mjs <scratch>/<name> --port 0` in the background with a deadline, open the URL.
  The server adds the kit (dock, comments, Final, Copy choices), dark only, and the tab title. Example: `<repo>/examples/choice`.
- **Live overlay** (the steps below): only when the owner asks to see the options on the real site.
- **Cloud artifact**: only when the owner asks for one.

Other modes:

- **Live mode** (the steps below): deciding about a website. The options sit on the real site in the dock.
- **Options mode**: deciding about a component or tool, such as the dock itself. One kit panel per option, side by
  side, recommended first, each with the real page in one dark frame set to that option. Write a spec like
  `<repo>/examples/accent-options.mjs`, run `node <repo>/options.mjs spec.mjs --out <scratch>/opts --port 0` in the
  background with a deadline, and open the printed URL. Each option sets `DevPanel.config` values (`set`), URL
  params (`params`), and an optional starting store (`seed`). Frames are real renders, never drawn copies.

- Website or web app that runs locally: live mode.
- A quick one-time pick with no site behind it (which repos, which items, a short list of choices):
  write a `page.js` like `<repo>/templates/quick-page.js`, run `node <repo>/quick.mjs page.js out.html`,
  and open the file. One HTML file, Preact + htm (JSX-like) inlined, no build, no network, Copy choices included.
- Native app (it can't run in a browser), or the user asks for a page: build a published options page instead.
- Claude Code mod (a pane or band drawn in the terminal): see "Claude mod (terminal UI)" below.

## Claude mod (terminal UI)

The same picker, drawn inside a mod's pane: a dock row with back and next, the group's options as
buttons, one comment per group, and Copy choices (the same `- Group: N Option - comment` list).
The owner judges the real pane with real-looking data, not a mockup.

1. Copy `<repo>/templates/mod-devpanel.tsx` into the mod's `hooks/` folder. Declare its state key as
   `Shaped<DevState>` in the mod's `PluginState` (spell the type out there: a contract file imports nothing).
2. Define the groups: `devPanel({ groups, heading })`, recommended option first, each with a one-line `note`.
   A group with `options: []` is comment only. In the pane hook, branch the drawing on `dev.pick(state, id)`,
   so every option really changes the tree, and draw `dev.dock(...)` at the bottom (the header comment shows the wiring).
3. Add a demo mode (a command argument or an env variable) that loads a fixture of real-looking data and
   shows the dock. No model calls in demo mode. Open the pane with `$.ui.open({ id, title, focus: true })`
   from the command, or the hotkeys go to the prompt box. When a group changes one tab of the pane, show that
   tab while the group is selected, so the user sees what they pick.
4. Prove it: `claude plugin validate <mod>`, then a `claude plugin test` that presses each option and checks the tree changes.
   Launch it for the user in a new terminal tab: `claude --plugin-dir <mod>`, then the demo command.
5. Tell the user the keys: `n` and `p` move between groups, digits pick, Tab reaches the comment field
   and Enter saves it. Ask them to press Copy choices (`y`) and paste the text. Keep a fallback command that prints the
   same text, for when the terminal clipboard does not work. Then build only the picked options.

## Before you start

Read the private context file named in your agent config, if it exists. It holds this user's feedback on
the overlay. Generic improvements go into this repo; user-specific notes stay in that context file.

## Steps

1. Copy `<repo>/templates/variants.js` and `variants.css` into a scratch folder outside the site repo.
2. Write the options. One group per section; option 1 is "Current". Copy the fitting kind from
   `<repo>/templates/presets.js` (flat, select, many, images, comment only, footer); more patterns in `<repo>/recipes.md`.
   The server sets the tab title to exactly `<project> > <Orca tab>`; never add a topic.
3. Check every option in one call, then look at every shot:
   `node <repo>/serve.mjs <site dir> --variants v.js --css v.css --shot <scratch>/shots --each --sizes 1440x900,390x844`
   Add `--open <group>` to check one group in the dock. Fix what looks wrong and shoot again only after a change.
4. Start the server for the user: `node <repo>/serve.mjs <site dir> --variants v.js --css v.css`
   in the background. Its exit condition is the pasted Copy choices, not a timer (see "An open pick is locked").
   Open the printed URL in the default browser.
5. Ask the user to paste the text from **Copy choices**, and wait for it.
6. Move the picked CSS into the real site files, written the site's way (no `data-dv-*`).
   Stop the server and delete the scratch folder.

For Vite or Next dev servers, see "Vite or Next dev" in the README; `--shot` covers static sites only.

## An open pick is locked

From the moment a page (overlay or options page) is shown until the user pastes its Copy choices, it is
locked. The user may be writing long comments in it, and the only copy lives in that browser tab. Nothing may
change it:

- Keep its server running: no timer, no idle stop, no restart on another port (picks and comments are stored per
  origin, so a new port shows an empty page). If it dies, restart it on the same port at once.
- Never change its groups, options, variants files, or the site files it serves. Never reload or re-open its tab.
  Work for the next round goes into new files and waits until the paste arrives.
- Any other page goes on its own new port, never on the locked page's port. Open it with `open-page`, which
  closes a same-title tab only on the same port.
- When the paste arrives, the lock ends: apply the picks, then change or stop the page.
- Before you report "page is open", check that the locked page still answers on its port.

## Rules for options

- Put the recommended option first (option 2). Name it plainly and give a one-line `note` that says
  what it looks like, such as "Gray fill, no border, blue ring on focus".
- Every option works at phone width with no sideways scroll (`--shot` warns).
- dev-artifacts is dark only, with no light styling and no light checks. The dock, the demo and the options pages are
  always dark. Take shots and run checks in Dark only (`--scheme dark`).
- No browser focus rings. A custom focus look uses a fill or ring, never the default outline.
- Borders show on all four sides, at an even width, in every state.
- Image preview (kit): it opens at Fit and never above real size; mark 2x renders `data-dpr="2"` (or an `@2x` name).
  One zoom holds for the whole page and stays after a reload. Arrows stay inside the image's own group.
- Use the site's own colors, fonts, and tokens, so the option looks like it belongs.
- Never ship the overlay, the variants files, or a look the user has not picked.

## The overlay (already built; do not re-code it)

- Dots and dock come from `<repo>/dots.js`, the one shared overlay (the artifact kit uses it too). Edit only
  that file, then run `node <repo>/dots-sync.mjs <file>` for each copy (devpanel.js and any other file with its markers).
- It is built from the artifact kit's classes and hints (`dots-sync.mjs` copies the kit.css rules in). Do not restyle it per site.
- More than 7 items (owner, 2026-11-25): a dock, pager, or option stepper with more than 7 groups, parts, or options
  shows only the arrows with the number in the middle, "‹ 3 / 158 ›", and no dots. Built into dots.js, kit.js and kit.css.
- The dock spans the window (16 px gutters). Row 1 is fixed: back / count / next, the overall comment,
  Open/Archived, Badges, Focus (two small switches), the eye, Clear, "…", Copy choices. Nothing in row 1 ever moves (each changing text keeps its
  widest width). The current group's name is bolder and white, and the other groups dim to 60%. Below it every group of the
  page sits at once, "Name  opt opt opt …", wrapping; past 40% of the window the rows scroll. On a phone row 1 keeps
  back, next, "…" and Copy choices; the rest is in "…". "…" in a row, or the group's name, opens the popover with
  the full list (a list, a list with a filter at 8+, or a picture grid when options have `img`). Options never
  show twice.
- A blue numbered dot sits on each group's section corner (an overlay, no layout change). A click opens a small dropdown
  with that group's options beside the section, not over it. The dock's Badges switch hides the dots. The red guide
  lines point at a group when you hover its dock row or step to it. A group with `options: []` is skipped.
- Options apply on a click or an arrow key only, never on hover (hover previews lag heavy pages).
- Back and next (`[` `]`) only move the focus: they mark the group's row, scroll the page to it and flash its lines.
  Arrow keys change the pick at once, in a dock row and in the popover; Enter closes the popover, Escape keeps the pick.
- The popover grows to 70% of the window, then scrolls with a thin overlay knob; the pick scrolls into view.
- Comments and the overall comment save on every key; Copy choices starts with `- Overall: ...`. When a group's
  options change (or the group goes), its old pick and comment move to Archived with no notice; Unarchive puts them back.
- Hovering a dock row draws faint red guide lines past the section's edges for about 1 second (no fill, no shift).
- The eye (or `h`) morphs the dock into a round glass eye button at the bottom right; a click morphs it back. A spacer keeps the footer above the dock.
- The "2 / 5" count is the site total of groups to pick. Clicking it lists every group by page with its pick; a row goes there.
- Picks, comments, and Copy choices cover the whole site (one store per origin, or per `site`, see below).

## Wallpaper choices

Any choice of a wallpaper or background picture uses the `wallpaper` group kind, never a short hand-picked option list:

```js
DevPanel.group({ id: 'hero-bg', label: 'Hero wallpaper', target: '.hero', kind: 'wallpaper',
  apply(url) { document.querySelector('.hero').style.backgroundImage = url ? `url("${url}")` : ''; } });
```

- It takes no `options`. `serve.mjs` lists every picture in `~/Pictures/local_wallpapers`, `local_wallpapers_gradients`,
  `depth`, and `unsplash` (read only; labels and groups from an `index.json` in the folder when it has one) and makes
  cached thumbnails with `sips` under `$AGENT_DATA_DIR/dev-artifacts/wall-thumbs`.
- The dock row shows the pick as a thumbnail plus Browse. Browse (or the name, or the dot) opens the gallery: a big dialog
  with search, groups on the left, a big preview on hover, the comment and Final. A click picks and calls `apply(url, { f, label })`
  at once (`url` is null for Current). Arrow keys move the pick; Esc, Enter, or Done close it.
- Copy choices writes `- Hero wallpaper: Frozen lake at dawn (unsplash/mountains-frozen-lake.jpg) - comment`.

## Live tuning (sliders)

When the owner wants to tune a number by eye (a size, an offset, a gap), use the `range` kind instead of a list of values:

```js
DevPanel.group({ id: 'shield-size', label: 'Shield size', target: '#safety', kind: 'range',
  min: 60, max: 160, step: 2, value: 100, unit: '%', format: (v) => `size ${v}%`,
  apply(v) { shield.style.setProperty('--shield-scale', v / 100); } });
```

- It takes no `options`. `value` is the baked value; the page keeps it in CSS, so bake the number into a custom property and
  let `apply(v)` set only that property (no motion replay, no layout change).
- The dock row shows the slider, the value, and a reset button. Every move saves and calls `apply(v)` at once; Reset calls it with `value`.
- Copy choices writes `format(v)` (or `v` plus `unit`), such as `- Shield size: size 118%`.

## One site with routes, or several sites

- One site with several pages or routes (a web app): back and next cross pages. This is the default.
- Several separate sites on one server (such as `/memory/` and `/throttlecontrol/`): they must never share a count,
  picks, or back and next. Give each site its own variants file with `DevPanel.config({ site: '/memory/' })`
  first, and run one `serve.mjs` per site on its own port with `--page /memory/`. Open each site in its own browser tab.
  One shared variants file works too: `DevPanel.config({ site: ['/memory/', '/throttlecontrol/'] })` plus a `page`
  on every group.
- An agent working on several separate sites does one site itself and hands each other site to its own agent tab
  (a handoff with the site path, its variants file, and its port). Each agent asks for its own Copy choices.

## Pages and routes

- Give each group a `page` (such as `page: '/settings/'`, written as the browser shows it) when its target is on another page or route.
  Without it, a group belongs to the page where it was first seen, so unseen pages would be missing from the count.
- SPA routes change with pushState + popstate (works with React Router and TanStack Router). For another router,
  add `DevPanel.config({ navigate: (path) => ... })` to `variants.js`. Static sites load the page.
- It is always dark and draws thin scroll bars that fade out.
