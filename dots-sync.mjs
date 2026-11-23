#!/usr/bin/env node
// Copies dots.js into each given file, between its option-dots markers, so every copy stays the same as the one source.
// Usage: node dots-sync.mjs <file>...   A file needs both markers once: "/* option-dots:start" and "/* option-dots:end */".
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('./dots.js', import.meta.url), 'utf8').trim();
const A = '/* option-dots:start', B = '/* option-dots:end */';
for (const f of process.argv.slice(2)) {
  const s = readFileSync(f, 'utf8'), i = s.indexOf(A), j = s.indexOf(B);
  if (i < 0 || j < i) { console.error(`${f}: no option-dots markers`); process.exitCode = 1; continue; }
  writeFileSync(f, `${s.slice(0, i)}${A}: a copy of dev-artifacts/dots.js. Edit that file, then run dots-sync.mjs. */\n${src}\n${s.slice(j)}`);
  console.log(`synced ${f}`);
}
