---
name: dev-artifacts
description: Show design options live on a local website or web app with the dev-artifacts overlay (blue and green dots, options in the dock, Copy choices) instead of building a separate options page. Use when asked to give options or variations for a local website, web app, landing page, or site section, or to preview looks on the dev server.
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
2. Write the options. One group per section; option 1 is "Current". Copy the fitting kind from
   `<repo>/templates/presets.js` (flat, select, many, images, comment only, footer); more patterns in `<repo>/recipes.md`.
   Always set the topic first in `variants.js`: `DevPanel.config({ topic: 'buy dialog' })` (1-3 words, never a
   bare "ui", "site", or "options"). The server adds the `<project> > <Orca tab>` prefix itself.
3. Check every option in one call, then look at every shot:
   `node <repo>/serve.mjs <site dir> --variants v.js --css v.css --shot <scratch>/shots --each --sizes 1440x900,390x844`
   Add `--open <group>` to check one group in the dock. Fix what looks wrong and shoot again only after a change.
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

- Dots and dock come from `<repo>/dots.js`, the one shared overlay (the artifact kit uses it too). Edit only
  that file, then run `node <repo>/dots-sync.mjs <file>` for each copy (devpanel.js and any other file with its markers).
- It is built from the artifact kit's classes and hints (`dots-sync.mjs` copies the kit.css rules in). Do not restyle it per site.
- The dock shows one select button for the current group. 2-3 short options sit right in the dock as a segmented
  control; more open a popover (a list, a list with a filter at 8+, or a picture grid when options have `img`).
  A blue dot is a group to pick; a green dot is a comment-only group (`options: [], current: false`).
- Back, next (`[` `]`) and a blue dot click scroll smoothly to the group and open its popover. Arrow keys work inside.
- Hovering an option or a dot draws faint red guide lines past the section's edges for about 1 second (no fill, no shift).
- `-` shrinks the dock to a capsule; `h` hides it, a corner handle brings it back. A spacer keeps the footer above the dock.
- The "2 / 5" count is the site total of blue dots. Clicking it lists every group by page with its pick; a row goes there.
- Picks, comments, and Copy choices cover the whole site (one store per origin, or per `site`, see below).

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
- It follows the site's light or dark look and draws thin scroll bars that fade out.
