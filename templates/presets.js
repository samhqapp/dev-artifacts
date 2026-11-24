// presets.js: one example of every kind of group. Copy the one that fits. The demo runs it:
//   node serve.mjs examples/demo --variants templates/presets.js --css templates/presets.css
// The dock picks the kind from the options; set `kind` only to force one.
DevPanel.config({ topic: 'dev artifacts' });

// 2-3 short options: one segmented row in the dock (kind 'flat'). Hover previews, click picks.
DevPanel.group({
  id: 'title', label: 'Title weight', target: '.d-hero h1',
  options: [{ name: 'Light', note: 'Thin 300 weight, bigger' }, { name: 'Heavy', note: '800 weight, tighter' }],
});

// Short text options, 4-7 of them: a select button in the dock; its popover lists them (kind 'select').
DevPanel.group({
  id: 'cta', label: 'Button text', target: '.d-cta',
  options: [
    { name: 'Buy now', note: 'Direct, the shortest' },
    { name: 'Get it for $14.99', note: 'Shows the price on the button' },
    { name: 'Start using it', note: 'Talks about using, not paying' },
    { name: 'Download', note: 'For a free app' },
  ],
  apply(i) { document.querySelector('.d-cta').textContent = ['Buy', 'Buy now', 'Get it for $14.99', 'Start using it', 'Download'][i - 1]; },
});

// Many options, 8-20: the popover gets a filter field (kind 'many').
const ACCENTS = [['Coral', '#f0654f'], ['Blue', '#007aff'], ['Indigo', '#5856d6'], ['Purple', '#af52de'], ['Pink', '#ff2d55'],
  ['Red', '#ff3b30'], ['Orange', '#ff9500'], ['Yellow', '#ffcc00'], ['Green', '#34c759'], ['Mint', '#00c7be'], ['Teal', '#30b0c7'],
  ['Cyan', '#32ade6'], ['Brown', '#a2845e'], ['Graphite', '#8e8e93']];
DevPanel.group({
  id: 'accent', label: 'Accent color', target: '.d-cta', dot: 'tl', // the button text group has the top-right corner
  options: ACCENTS.map(([name, c]) => ({ name, note: c })),
  apply(i) { document.documentElement.style.setProperty('--d-accent', i > 1 ? ACCENTS[i - 2][1] : ''); },
});

// Images, 6-12: a thumbnail grid with a big preview; a click on the preview opens it full size (kind 'images').
// `img` is any image URL; these are small SVG pictures so the demo needs no files.
const SKY = [['Dawn', '#ffb199', '#ff0844'], ['Sea', '#a1c4fd', '#0061ff'], ['Forest', '#d4fc79', '#159957'], ['Dusk', '#c471f5', '#fa71cd'],
  ['Sand', '#fddb92', '#d1913c'], ['Night', '#3a3d5c', '#0f0c29'], ['Ice', '#e0f7fa', '#5ec8f2'], ['Ember', '#f6d365', '#fd3a69']];
const pic = ([, a, b]) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="600" cy="170" r="90" fill="#fff" opacity=".35"/><path d="M0 470 260 300l180 120 160-90 200 140v130H0z" fill="#000" opacity=".18"/></svg>`);
DevPanel.group({
  id: 'photo', label: 'Hero picture', target: '.d-photo',
  options: SKY.map((s) => ({ name: s[0], note: `${s[1]} to ${s[2]}`, img: pic(s) })),
  apply(i) { document.querySelector('.d-photo').style.backgroundImage = i > 1 ? `url("${pic(SKY[i - 2])}")` : ''; },
});

// A footer at the very bottom: the dock's end spacer lets the page scroll it above the dock.
DevPanel.group({
  id: 'footer', label: 'Footer', target: '.d-foot',
  options: [{ name: 'One line', note: 'Links and the copyright on one row' }, { name: 'Columns', note: 'Three columns of links' }],
});
