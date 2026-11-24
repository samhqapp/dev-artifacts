// An options page example: node options.mjs examples/accent-options.mjs --out <dir>
// Every frame is the demo site with the real devpanel.js and the presets, set to that option.
const accent = (i) => ({ 'dv-pick': `accent:${i}`, 'dv-clean': '' }); // force the pick, hide the overlay in the frame

export default {
  topic: 'accent color',
  site: './demo', variants: '../templates/presets.js', css: '../templates/presets.css',
  size: [1240, 720],
  lead: 'Each frame is the demo site with that accent color. Click inside a frame to try it, or open it full size.',
  groups: [
    { name: 'Accent color', hint: 'The color of the Buy button and the links.', options: [
      { name: 'Coral', recommended: true, sub: 'The samhq coral, #f0654f', params: accent(2) },
      { name: 'Blue', sub: 'System blue, #007aff', params: accent(3) },
      { name: 'Current', sub: 'The site as it is now', params: accent(1) },
    ] },
  ],
};
