// variants.js: the options to show on the page. Keep this file OUTSIDE the site repo; serve.mjs injects it.
// One DevPanel.group per section. Option 1 is always "Current" (the site as it is), so your first option is 2.
// Picking option i sets data-dv-<id>="<i>" on <html>; style each option in variants.css with that attribute.
// Put the recommended option first (option 2). Give every option a one-line note that says what it looks like.

DevPanel.group({
  id: 'input',                 // lowercase letters, digits, dashes; used in data-dv-input and in --open input
  label: 'Email field',        // shown in the menu and in Copy choices
  target: '.hero input',       // the element the badge sits on; scrolled into view by --shot
  options: [
    { name: 'Soft ring', note: 'Light gray fill, blue ring on focus' },
    { name: 'Pill', note: 'Fully round ends, hairline border' },
  ],
  // dot: 'tl',                // badge on the top-left corner instead of top-right
  // current: false,           // no automatic "Current"; your first option is then 1
  // apply(i) { },             // for changes CSS can't do (text, DOM order); also called with 1 to undo
});
