# dev-artifacts

Show design options live on a website that runs locally, pick one, and paste the picks back to whoever
(or whichever coding agent) builds the site. No npm dependencies, no build step, nothing added to the site.

Each section with options gets a small numbered blue badge just outside its top-right corner. Hover the
badge to highlight the section with blueprint guide lines. Click it to open a menu beside the section (a
bottom sheet on a phone), so the section stays in view. Hover an option to preview it, click to keep it,
and add a comment. The dock at the bottom shows the picks count, **Copy choices**, Hide dots (or press
`.`), and Reset. Picks and comments stay in localStorage per page. Never ship it.

Copy choices gives one Markdown line per group, with comment lines indented under it:

```text
- Email field: 2 Soft ring - make the ring thinner
  and a bit lighter
- Main button: 1 Current
```

## Files

| File | What it is |
|---|---|
| `devpanel.js` | The overlay (one shadow root, no style leaks). API: `DevPanel.group(...)`. |
| `serve.mjs` | Static dev server that injects the overlay, live reload, and the `--shot` screenshot command. |
| `templates/` | Starter `variants.js` and `variants.css` with comments. |
| `recipes.md` | Ready option sets: text field, button, card, header, text change. |
| `SKILL.md` | Step-by-step recipe for coding agents. |

## Static sites

```sh
node serve.mjs <site dir> --variants variants.js --css variants.css [--port 0] [--page /path]
```

It prints the URL (127.0.0.1 only), injects the overlay, your variants JS, and your variants CSS before
`</body>` of every HTML page, and reloads the page when any file changes. Site files never reference it.

## Screenshots

```sh
node serve.mjs <site dir> --variants v.js --css v.css --shot out/ [--sizes 1440x900,390x844] [--open <group>] [--each]
```

Starts the server, takes screenshots with headless Chrome, prints the file paths, and exits.

- No flag: the page top with the overlay, one shot per size.
- `--open <group>`: that group's menu open, its section scrolled into view.
- `--each`: every option of every group (or only `--open <group>`), menu closed and overlay hidden,
  one file per option and size, such as `input-2-soft-ring-390x844.png`.
- It prints a warning when the page scrolls sideways at a size.

Chrome is found in this order: `$CHROME_PATH`, a Playwright `chromium_headless_shell` (in
`$PLAYWRIGHT_BROWSERS_PATH` or the default cache), then the system Chrome or Chromium. It talks to Chrome
over the DevTools protocol with the WebSocket built into Node 22.

URL params, for any browser: `?dv-pick=<id>:<i>[,<id>:<i>]` forces options without saving,
`?dv-open=<id>` opens a menu, `?dv-hl=<id>` shows the highlight, `?dv-clean` hides the overlay.

## Vite or Next dev

Keep `serve.mjs` running on a fixed port for the overlay files (`--port 4799`), then add one dev-only line:

```jsx
// Vite (index.html or main.js):
if (import.meta.env.DEV) for (const s of ['devpanel.js', 'variants.js']) document.head.append(Object.assign(document.createElement('script'), { src: `http://127.0.0.1:4799/__dev/${s}`, async: false }))
// Next (app/layout.tsx, inside <body>):
{process.env.NODE_ENV === 'development' && <><Script src="http://127.0.0.1:4799/__dev/devpanel.js" strategy="afterInteractive" /><Script src="http://127.0.0.1:4799/__dev/variants.js" strategy="afterInteractive" /></>}
```

Load the variant CSS the same way (`/__dev/variants.css`). `--shot` covers static sites only.

## Variants file

```js
// variants.js: one group per section. "Current" is added as option 1, so the first option here is 2.
DevPanel.group({ id: 'input', label: 'Input', target: '.hero input', options: [
  { name: 'Glow ring', note: 'Blue ring around the field' },
  { name: 'Pill' },
] });
// optional: dot: 'tl' (top left), current: false (no automatic "Current"), apply(i) for DOM changes (called with 1 too)
```

```css
/* variants.css: picking option i sets data-dv-<id>="<i>" on <html> */
html[data-dv-input="2"] .hero input { box-shadow: 0 0 0 4px rgba(0,122,255,.25); }
html[data-dv-input="3"] .hero input { border-radius: 999px; }
```

## License

MIT
