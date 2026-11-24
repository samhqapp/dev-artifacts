# dev-artifacts

Show design options live on your local site. Click a dot, try each look, copy your picks.

```text
  +-------------------------------------------------------------+
  |  Your site                                                  |
  |  +----------------------------+ (1)                         |
  |  |  Email field               |  ^ dot                      |
  |  +----------------------------+                             |
  |                                                             |
  |                                                             |
  | ( - < 1/3 ●●● > [(1) Email  Current|Soft|Pill] [c] [Open 3|Archived 0] [Focus On|Off] [eye] Clear [Copy choices] )
  +-------------------------------------------------------------+
                               dock
```

It needs Node 22 or newer. It has no npm packages and no build step. It adds nothing to your site.

## Quick start

0. Get the code.

   ```sh
   git clone https://github.com/samhqapp/dev-artifacts.git
   ```

1. Copy the two template files into a new folder. Keep this folder outside your site.

   ```sh
   mkdir options
   cp dev-artifacts/templates/variants.js dev-artifacts/templates/variants.css options/
   ```

2. Open `options/variants.js`. Change `target` to a CSS selector from your site, such as `.hero input`.
   Then write your options in `options/variants.css` (see "Writing options" below).

3. Start the server. Give it your site folder.

   ```sh
   node dev-artifacts/serve.mjs ./my-site --variants options/variants.js --css options/variants.css
   ```

   It prints a link like `http://127.0.0.1:PORT/`. Open it in your browser.

The server only listens on your own computer. When you edit a file, the page reloads by itself.

To see every kind of group on a demo page: `node serve.mjs examples/demo --variants templates/presets.js --css templates/presets.css`.

## How it works

- The page gets no markers. Hover a group's row in the dock, or step to it, and thin red guide lines point at its
  section. Only a group with just a comment field (`options: [], current: false`) gets a small green dot, and the
  eye button (shown only then) hides those dots.
- The dots and dock are `dots.js`, shared with other tools. Edit it there and run `node dots-sync.mjs devpanel.js`.
- The dock, popovers, comment fields and hints use the artifact kit's own classes and tokens (`k-dock`, `k-seg`,
  `k-comment`, `k-hint`), copied in by `dots-sync.mjs` from `kit.css` (`$KIT_CSS`, else `~/.agents/artifact-kit/kit.css`).
- The **dock** spans the window with 16 px gutters. Row 1 is fixed: minimize, back / count / next, an **overall
  comment** on the whole page, Open / Archived, Focus, the eye, Clear, "…" and Copy choices at the right. Below it
  sits every group of the page at once: its name and its first 3 options as a segmented control (hover one for its
  note). With more options, a 4th item "…" (it shows the pick when the pick is further down) opens the popover with
  the full list; a click on the group's name opens it too. The groups wrap onto more rows; past 40% of the window
  they scroll. Options never show twice, and nothing has a number.
  The popover depends on the kind, picked from the options (set `kind` to force one; `templates/presets.js` has one of each):

  | Kind | When | Popover |
  |---|---|---|
  | `select` | up to 7 options | a list |
  | `many` | 8 or more | a list with a filter field |
  | `images` | any option has `img` | a thumbnail grid and a big preview; click the preview for full size |
  | note | `options: [], current: false` | a green dot and a comment field |

- Hover an option to preview it. Click it to keep it. Arrow keys change the pick at once (in the dock row and in the
  popover). Enter closes the popover; Esc closes it and keeps the pick. The popover grows to 70% of the window, then
  scrolls with a thin overlay knob, and the pick scrolls into view when it opens.
- Comments and the overall comment save on every key. A group whose option names change starts fresh (a new round),
  with no notice: its old pick and comment move to **Archived**, where each shows its old text and an Unarchive
  button that puts it back. A group the variants file dropped goes there too (Unarchive is off for it).
  Groups that did not change keep theirs.
- Hovering a group's dock row draws thin, faint red guide lines along the section's four edges. They grow out past the
  section (to the screen edge when it is off screen), glow once and fade, about 1 second. No fill; the page never moves.
- **Back** and **next** (keys `[` and `]`) only move the focus: the group's row is marked, the page scrolls smoothly to
  it, and its lines flash. A group on another page takes you to that page first.
- `-` shrinks the dock to a small capsule (count and chevron). Key `h` hides it fully; a small corner handle brings it
  back. Both are kept after a reload. An empty block the height of the dock is added after the page, so the footer
  always scrolls above it.
- The dock is the artifact kit's dock: the pager (one dot per group, click to go there), the overall comment,
  **Open / Archived** (the **Final** switch at the end of each popover moves a group to Archived), **Focus On / Off**
  (dims the rest of the page, paint only, kept after a reload), the eye button (hide the green dots, key `.`), **Clear**
  (two clicks, then Undo for 5 seconds) and **Copy choices** (open groups only). On a phone, Open / Archived, Focus,
  Clear, minimize and the eye sit in the `…` menu, and the overall comment takes its own line.
- The count covers only groups you can use on this page now. With no groups, only the corner handle shows. Stored
  picks of a group the variants file no longer has move to Archived. `examples/selfcheck.mjs` checks this.
- The "2 / 5" count opens the list of every group. Click it to see **every group**, grouped by page, with each one's current pick.
  Click a row to go there. Your picks and comments stay in your browser, for the whole site.

**Copy choices** gives the overall comment first, then one line per group, from every page. Paste it to the person or
coding agent who builds the site. When the site has more than one page, each line names its page.

```text
- Overall: feels calm, keep it
- Email field (/): 2 Soft ring - make the ring thinner
  and a bit lighter
- Main button (/settings): 1 Current
```

Never ship the overlay or your variants files. They are for development only.

## Writing options

`variants.js` lists the options. Option 1 is always "Current", so your first option is number 2.

```js
DevPanel.group({ id: 'input', label: 'Email field', target: '.hero input', options: [
  { name: 'Glow ring', note: 'Blue ring around the field' },
  { name: 'Pill', note: 'Fully round ends' },
] });
```

`variants.css` styles each option. When you pick option `i`, the page gets `data-dv-<id>="<i>"` on `<html>`.

```css
html[data-dv-input="2"] .hero input { box-shadow: 0 0 0 4px rgba(0,122,255,.25); }
html[data-dv-input="3"] .hero input { border-radius: 999px; }
```

Extra settings: `page: '/settings'` says which page the group is on (or a list, such as `['/a', '/b']`; the first one
is where back and next go). Without it, the group belongs to the page where you first saw it, so set `page` for groups
on pages you have not opened yet. `dot: 'tl'` puts the dot on the top-left corner. `current: false` removes the automatic "Current".
When `target` matches many elements, such as every card, the dot and outline sit on one card: the first one you can see.
Your options still change every card. `sample: 'all'` outlines all of them in one box instead.
`apply(i)` runs your own code for changes that CSS cannot do, such as new text. More ready examples are in `recipes.md`.

`DevPanel.config({ topic: 'email field' })` sets the browser tab title to `<prefix> > email field` while the overlay
runs. `serve.mjs` and `quick.mjs` get the prefix from `~/.agents/bin/orca-title` (or `DV_TITLE_CMD`) when it exists,
else the repo folder name. An old `title: 'a > b'` still works; its last part is the topic. The title is set again if
the site rewrites its own. Without a topic, the title stays and the console warns once.

One server, several separate sites (such as `/memory/` and `/throttlecontrol/`): put this first in `variants.js`, so
each site gets its own picks, count, back and next, and Copy choices. Groups whose `page` is on another site are skipped.

```js
DevPanel.config({ site: ['/memory/', '/throttlecontrol/'] });
```

Without `site`, the whole server is one site, and back and next move across all its pages.

## Screenshots

Take a screenshot of every option, and then look at them. This needs Chrome or Chromium on your computer.

```sh
node dev-artifacts/serve.mjs ./my-site --variants options/variants.js --css options/variants.css \
  --shot options/shots --each --sizes 1440x900,390x844
```

It starts the server, saves the images, prints their paths, and stops. A file name looks like `input-2-soft-ring-390x844.png`.

| Flag | What it does |
|---|---|
| `--shot <folder>` | Take screenshots into this folder, then exit. Alone, it shoots the top of the page. |
| `--sizes 1440x900,390x844` | Window sizes to use. The default is a desktop and a phone. |
| `--open <group id>` | Show that group in the dock. |
| `--each` | One image for every option, with the overlay hidden. |
| `--page /path` | Which page of your site to open. |
| `--port 4799` | Use a fixed port. The default picks a free one. |
| `--scheme dark` | Take the shots in dark (or light) appearance. |
| `--run '<js>'` | Run this script on the page before a page shot, such as opening an item or a dialog. |
| `--proxy /api/=http://127.0.0.1:8080` | Forward that path to a local API, so a web app shows live data. Extra headers (a key or dev token) go in `DV_PROXY_HEADERS` as JSON, so they never show in `ps`. |

It warns you when a page scrolls sideways at one of the sizes. It finds Chrome by itself. To choose one, set `CHROME_PATH`.

You can also add these to any page address: `?dv-pick=<id>:<number>` forces an option, `?dv-open=<id>` puts a group in the dock,
`?dv-hl=<id>` holds the glow on, `?dv-clean` hides the overlay.

## Use with Vite or Next

Keep `serve.mjs` running on a fixed port. Your Vite or Next app loads the overlay files from it:

```sh
node dev-artifacts/serve.mjs ./my-site --variants options/variants.js --css options/variants.css --port 4799
```

Then add this one dev-only line to your app. It loads `devpanel.js` and `variants.js` from that server.

```jsx
// Vite (index.html or main.js):
if (import.meta.env.DEV) for (const s of ['devpanel.js', 'variants.js']) document.head.append(Object.assign(document.createElement('script'), { src: `http://127.0.0.1:4799/__dev/${s}`, async: false }))
// Next (app/layout.tsx, inside <body>):
{process.env.NODE_ENV === 'development' && <><Script src="http://127.0.0.1:4799/__dev/devpanel.js" strategy="afterInteractive" /><Script src="http://127.0.0.1:4799/__dev/variants.js" strategy="afterInteractive" /></>}
```

Load the CSS the same way, from `http://127.0.0.1:4799/__dev/variants.css`. The `--shot` command works on static sites only.

To go to a group on another route, the overlay changes the address with `history.pushState` and tells the app with a
`popstate` event. React Router and TanStack Router follow that. If your router does not, give it your own navigate
function in `variants.js`:

```js
DevPanel.config({ navigate: (path) => window.router.navigate({ to: path }) });
```

On a static site (served by `serve.mjs`), it just loads the other page.

## Quick pick pages

For a one-time choice with no site behind it, such as which repos to move or which items to keep:

```sh
cp templates/quick-page.js /tmp/pick/page.js     # edit TITLE, LEAD, GROUPS
node quick.mjs /tmp/pick/page.js /tmp/pick/pick.html && open /tmp/pick/pick.html
```

The result is one HTML file: Preact and htm (JSX-like templates) inlined, no build, no network. It has
one-pick groups, tables of switches, a comment per group, Light and Dark, and a Copy choices dock.
Picks are kept in the browser while you work. Preact (MIT) and htm (Apache-2.0) are vendored in
`templates/preact-htm.js`.

## Options mode

Live mode decides about a website. Options mode decides about a component or tool: a kit page with one panel per
option, side by side, recommended first, and each panel holds the real page in two frames (Light and Dark) running
the real `devpanel.js` with that option's setting. Each group has a comment field and a Final switch; the dock has
Copy choices and Focus.

```sh
node options.mjs examples/accent-options.mjs --out /tmp/accent-options --port 0   # prints the page URL
```

The spec names the site, variants, frame size, and groups; each option has `set` (config values), `params`
(URL params such as `dv-pick` or `dv-hl`), and `seed` (a starting store, such as old picks). It needs the artifact kit
(`KIT_DIR`, default `~/.agents/artifact-kit`). `serve.mjs` never adds the overlay to a kit page.

## Why not a separate options page

The options sit next to your real content, so nobody builds or publishes a second page.
We ran the same task 3 times each: dev-artifacts took about 93k tokens, 13 steps, and 1 minute. A separate published options page took about 125k tokens, 36 steps, and 4 minutes.

## License

MIT. See `LICENSE`.
