#!/usr/bin/env node
// Copies dots.js into each given file, between its option-dots markers, so every copy stays the same as the one source.
// Usage: node dots-sync.mjs <file>...   A file needs both markers once: "/* option-dots:start" and "/* option-dots:end */".
// A file with kit-css markers ("/* kit-css:start" and "/* kit-css:end */") also gets the artifact kit's tokens and its
// dock, segmented control, comment field, and hint rules, cut from kit.css ($KIT_CSS, else
// ~/.agents/artifact-kit/kit.css) as a String.raw constant KIT_CSS, with :root as :host for a shadow root.
// Without that file the vendored copy stays as it is.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const src = readFileSync(new URL('./dots.js', import.meta.url), 'utf8').trim();
const A = '/* option-dots:start', B = '/* option-dots:end */', KA = '/* kit-css:start', KB = '/* kit-css:end */';
const KIT = process.env.KIT_CSS || join(homedir(), '.agents/artifact-kit/kit.css');
const TAKE = /^\.k-(dock|seg|comment|hint|copy|nav)\b/;

// Top-level rules of kit.css (comments dropped, @media blocks skipped).
function kitCss() {
  if (!existsSync(KIT)) return null;
  const css = readFileSync(KIT, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i); if (open < 0) break;
    let depth = 1, j = open + 1;
    while (depth && j < css.length) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    const sel = css.slice(i, open).trim(), body = css.slice(open + 1, j - 1).trim().replace(/\s*\n\s*/g, ' ');
    i = j;
    if (sel === ':root') out.push(`:host { ${body} }`);
    else if (sel === ':root[data-theme="dark"]') out.push(`:host([data-od-dark]) { ${body.replace(/\s*color-scheme: dark\s*/, ' ')} }`);
    else if (!sel.startsWith('@') && sel.split(',').every((s) => TAKE.test(s.trim()))) out.push(`${sel} { ${body} }`);
  }
  if (out.join('').includes('`')) throw new Error('kit.css has a backtick; it cannot go in String.raw');
  return out.join('\n');
}
const kit = kitCss();

for (const f of process.argv.slice(2)) {
  let s = readFileSync(f, 'utf8'), i = s.indexOf(A), j = s.indexOf(B);
  if (i < 0 || j < i) { console.error(`${f}: no option-dots markers`); process.exitCode = 1; continue; }
  s = `${s.slice(0, i)}${A}: a copy of dev-artifacts/dots.js. Edit that file, then run dots-sync.mjs. */\n${src}\n${s.slice(j)}`;
  i = s.indexOf(KA); j = s.indexOf(KB);
  if (i >= 0 && j > i && kit) s = `${s.slice(0, i)}${KA}: cut from the artifact kit's kit.css by dots-sync.mjs. Do not edit. */\nconst KIT_CSS = String.raw\`\n${kit}\`;\n${s.slice(j)}`;
  else if (i >= 0 && !kit) console.warn(`${f}: ${KIT} not found, kept the vendored kit CSS`);
  writeFileSync(f, s);
  console.log(`synced ${f}`);
}
