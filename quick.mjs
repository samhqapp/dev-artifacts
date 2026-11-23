#!/usr/bin/env node
// Quick one-off pick page: one HTML file, Preact + htm (JSX-like) inlined, no build, no network.
// Usage: node quick.mjs <page.js> <out.html>
// page.js sets `const TITLE = '...'` and `const GROUPS = [...]` (see templates/quick-page.js), and may
// define `function Extra()` to render more below the groups.
import { readFileSync, writeFileSync } from 'node:fs';

const [page, out] = process.argv.slice(2);
if (!page || !out) { console.error('usage: node quick.mjs <page.js> <out.html>'); process.exit(1); }
const here = (f) => new URL(f, import.meta.url);
// The vendored module ends with `export{a as h,...}`; turn it into a global so it runs inline.
const lib = readFileSync(here('templates/preact-htm.js'), 'utf8')
  .replace(/export\{([^}]*)\};?\s*$/, (_, list) => 'window.preact={' + list.split(',').map((p) => { const [a, b] = p.split(' as '); return `${b}:${a}`; }).join(',') + '};');
const shell = readFileSync(here('templates/quick.html'), 'utf8');
const pageSrc = readFileSync(page, 'utf8');
const m = pageSrc.match(/const TITLE\s*=\s*['"`]([^'"`]*)/);
writeFileSync(out, shell
  .replace('<!--TITLE-->', () => (m ? m[1] : 'Pick'))
  .replace('/*LIB*/', () => '(()=>{' + lib + '})();')
  .replace('/*PAGE*/', () => pageSrc));
console.log(out);
