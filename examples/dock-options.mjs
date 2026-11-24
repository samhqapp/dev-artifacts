// The options page about the dock itself: node options.mjs examples/dock-options.mjs --out <dir>
// Every frame is the demo site with the real devpanel.js and the presets, set to that option.
const oldCta = ['Current', 'Buy now', 'Get it for $14.99', 'Start using it'];
// the store as it was before the Button text options changed: one pick and one comment
const lastRound = { store: { picks: { cta: 3 }, notes: { cta: 'Shorter, please' }, fin: {}, last: {},
  groups: [{ id: 'cta', page: null, label: 'Button text', opts: oldCta, sig: oldCta.join('\n') }] } };

export default {
  topic: 'dock options',
  site: './demo', variants: '../templates/presets.js', css: '../templates/presets.css',
  size: [1240, 720],
  lead: 'Each frame is the real dock on the demo site. Click inside a frame to try it, or open it full size.',
  groups: [
    { name: 'On-page markers', hint: 'What marks a part of the page that has options.', options: [
      { name: 'No markers', recommended: true, sub: 'Only the red guide lines, when you hover the dock or step to a group',
        set: { markers: 'none' }, params: { 'dv-hl': 'title' } },
      { name: 'Small blue dot', sub: 'A plain dot with no number at each part with options', set: { markers: 'dot' } },
      { name: 'Dots while the dock is open', sub: 'The dots hide when the dock is made small (shown here)',
        set: { markers: 'dock' }, seed: { dock: 'min' } },
    ] },
    { name: 'The ‹ › buttons', hint: 'What back and next step through.', options: [
      { name: 'Step through groups', recommended: true, sub: 'Next goes to the next part of the page with options', set: { arrows: 'groups' } },
      { name: 'Step through options', sub: "Next picks the group's next option; Shift with next goes to the next group", set: { arrows: 'options' } },
    ] },
    { name: 'Inline option count', hint: 'How many options sit in the dock before "…" (Accent color has 15).', options: [
      { name: 'First 3, then "…"', recommended: true, sub: 'Your idea. "…" opens the full list', set: { inline: 3 }, params: { 'dv-hl': 'accent' } },
      { name: 'As many as fit one row', sub: 'Then "…" for the rest', set: { inline: 'fit' }, params: { 'dv-hl': 'accent' } },
      { name: 'Every option', sub: 'The dock grows to more rows', set: { inline: 'all' }, params: { 'dv-hl': 'accent' } },
    ] },
    { name: 'Round reset', hint: 'The Button text options changed since the last load. Its old pick and comment were "Buy now" and "Shorter, please".', options: [
      { name: 'Automatic, with Restore', recommended: true, sub: 'Changed groups start fresh; "…" has Restore last round',
        set: { rounds: 'auto' }, params: { 'dv-hl': 'cta' }, seed: lastRound },
      { name: 'Ask first', sub: 'A small bar asks to clear the old comments', set: { rounds: 'ask' }, params: { 'dv-hl': 'cta' }, seed: lastRound },
    ] },
  ],
};
