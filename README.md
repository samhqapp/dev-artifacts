# dev-artifacts

Show design options live on your local site. Click a dot, try each look, copy your picks.

```text
  +-------------------------------------------------------+
  |  Your site                                            |
  |  +----------------------------+  (1)  +-------------+ |
  |  |  Email field               |  ^    | 1 Current   | |
  |  +----------------------------+  |    | 2 Soft ring | |
  |                              badge    | 3 Pill      | |
  |                                       +-------------+ |
  |                                            menu       |
  |      [ 1 pick ] [ Copy choices ] [ Hide dots ] [ Reset ]
  +-------------------------------------------------------+
                          dock
```

It needs Node 22 or newer. It has no npm packages and no build step. It adds nothing to your site.

## Quick start

0. Get the code.

   ```sh
   git clone https://github.com/surajmandalcell/dev-artifacts.git
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

## How it works

- Each section with options gets a small blue **badge** just outside its top-right corner.
- Hover the badge to see the section outlined. Click it to open the **menu** next to the section. On a phone it is a bottom sheet.
- Hover an option to preview it. Click it to keep it. Type a comment if you like.
- The **dock** at the bottom shows how many picks you made. It has **Copy choices**, **Hide dots**, and **Reset**.
- Press the `.` key to hide or show the badges. Your picks stay in your browser, per page.

**Copy choices** gives one line per group. Paste it to the person or coding agent who builds the site.

```text
- Email field: 2 Soft ring - make the ring thinner
  and a bit lighter
- Main button: 1 Current
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

Extra settings: `dot: 'tl'` puts the badge on the top-left corner. `current: false` removes the automatic "Current".
`apply(i)` runs your own code for changes that CSS cannot do, such as new text. More ready examples are in `recipes.md`.

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
| `--open <group id>` | Show that group's menu open. |
| `--each` | One image for every option, with the overlay hidden. |
| `--page /path` | Which page of your site to open. |
| `--port 4799` | Use a fixed port. The default picks a free one. |
| `--scheme dark` | Take the shots in dark (or light) appearance. |
| `--run '<js>'` | Run this script on the page before a page shot, such as opening an item or a dialog. |
| `--proxy /api/=http://127.0.0.1:8080` | Forward that path to a local API, so a web app shows live data. Extra headers (a key or dev token) go in `DV_PROXY_HEADERS` as JSON, so they never show in `ps`. |

It warns you when a page scrolls sideways at one of the sizes. It finds Chrome by itself. To choose one, set `CHROME_PATH`.

You can also add these to any page address: `?dv-pick=<id>:<number>` forces an option, `?dv-open=<id>` opens a menu,
`?dv-clean` hides the overlay.

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

## Why not a separate options page

The options sit next to your real content, so nobody builds or publishes a second page.
We ran the same task 3 times each: dev-artifacts took about 93k tokens, 13 steps, and 1 minute. A separate published options page took about 125k tokens, 36 steps, and 4 minutes.

## License

MIT. See `LICENSE`.
