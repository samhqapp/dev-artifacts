// Example page for quick.mjs. Copy it, edit TITLE, LEAD and GROUPS, then:
//   node quick.mjs page.js out.html && open out.html
const TITLE = 'project > topic';
const LEAD = 'One plain line on what to pick and why.';
const GROUPS = [
  // One pick from a few options; `rec` marks the recommended one (picked by default).
  { id: 'layout', title: 'Layout', desc: 'How the list sits on the page.', options: [
    { id: 'grid', label: 'Grid', desc: 'Cards side by side.', rec: true },
    { id: 'list', label: 'List', desc: 'One row per item.' },
  ] },
  // A table of rows with one switch per column; null = not possible here (`why` shows on hover).
  { id: 'items', title: 'Items', desc: 'Turn on the ones to keep.', rowHead: 'Item', cols: ['Keep', 'Publish'], rows: [
    { id: 'a', label: 'Item A', desc: 'Short note', on: [true, false] },
    { id: 'b', label: 'Item B', desc: 'Short note', on: [false, null], why: 'Cannot be published.' },
  ] },
];
// Optional: function Extra() { return html`<p>More content below the groups.</p>`; }
