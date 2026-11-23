---
name: dev-artifacts
description: Show design options live on a local website or web app with the dev-artifacts overlay (numbered badges, option menu, Copy choices) instead of building a separate options page. Use when asked to give options or variations for a local website, web app, landing page, or site section, or to preview looks on the dev server.
---

# dev-artifacts

Options shown on the real page, beside the real content. Cheaper than a separate options page.
`<repo>` below is the folder of this file. Read `<repo>/README.md` only when a step here is not enough.

## Which way

- Website or web app that runs locally: use this skill.
- A quick one-time pick with no site behind it (which repos, which items, a short list of choices):
  write a `page.js` like `<repo>/templates/quick-page.js`, run `node <repo>/quick.mjs page.js out.html`,
  and open the file. One HTML file, Preact + htm (JSX-like) inlined, no build, no network, Copy choices included.
- Native app (it can't run in a browser), or the user asks for a page: build a published options page instead.

## Before you start

Read the private context file named in your agent config, if it exists. It holds this user's feedback on
the overlay. Generic improvements go into this repo; user-specific notes stay in that context file.

## Steps

1. Copy `<repo>/templates/variants.js` and `variants.css` into a scratch folder outside the site repo.
2. Write the options. One group per section; option 1 is "Current". Patterns: `<repo>/recipes.md`.
3. Check every option in one call, then look at every shot:
   `node <repo>/serve.mjs <site dir> --variants v.js --css v.css --shot <scratch>/shots --each --sizes 1440x900,390x844`
   Add `--open <group>` to check one group's menu. Fix what looks wrong and shoot again only after a change.
4. Start the server for the user: `node <repo>/serve.mjs <site dir> --variants v.js --css v.css`
   (run it in the background with a deadline). Open the printed URL in the default browser.
5. Ask the user to paste the text from **Copy choices**, and wait for it.
6. Move the picked CSS into the real site files, written the site's way (no `data-dv-*`).
   Stop the server and delete the scratch folder.

For Vite or Next dev servers, see "Vite or Next dev" in the README; `--shot` covers static sites only.

## Rules for options

- Put the recommended option first (option 2). Name it plainly and give a one-line `note` that says
  what it looks like, such as "Gray fill, no border, blue ring on focus".
- Every option works in light and dark, and at phone width with no sideways scroll (`--shot` warns).
- No browser focus rings. A custom focus look uses a fill or ring, never the default outline.
- Borders show on all four sides, at an even width, in every state.
- Use the site's own colors, fonts, and tokens, so the option looks like it belongs.
- Never ship the overlay, the variants files, or a look the user has not picked.

## The overlay (already built; do not re-code it)

- Badges float just outside the section, dim at rest; hover lights the section with a padded highlight.
- The menu opens beside the section and never covers it; on a phone it is a bottom sheet.
- Each group has a comment field that grows; the dock has Copy choices, Hide dots (`.` key), and Reset.
- The dock's back and next (`[` and `]` keys) go to each group in page order: off screen it scrolls there,
  on screen it flashes the highlight and pulses the badge. Click the "2 / 3" count to open that group's menu.
- It follows the site's light or dark look and draws thin scroll bars that fade out.
