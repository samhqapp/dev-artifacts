# Recipes

Common option sets. Copy the group into `variants.js` and the CSS into `variants.css`, then change the
selector (`T`) to your target and swap the colors for the site's own tokens. `currentColor` mixes keep
each option right in light and dark.

## Text field

```js
DevPanel.group({ id: 'input', label: 'Text field', target: 'T', options: [
  { name: 'Soft fill', note: 'Gray fill, no border, ring on focus' },
  { name: 'Hairline', note: 'Clear field, thin border all around' },
  { name: 'Underline', note: 'Only a bottom line' },
  { name: 'Pill', note: 'Round ends, thin border' },
] });
```

```css
html[data-dv-input="2"] T { background: color-mix(in srgb, currentColor 6%, transparent); border: 1px solid transparent; border-radius: 10px; }
html[data-dv-input="3"] T { background: transparent; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 8px; }
html[data-dv-input="4"] T { background: transparent; border: 0; border-bottom: 1px solid color-mix(in srgb, currentColor 30%, transparent); border-radius: 0; padding-inline: 0; }
html[data-dv-input="5"] T { border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 999px; padding-inline: 18px; }
html[data-dv-input] T:focus { outline: none; border-color: #007aff; box-shadow: 0 0 0 3px rgba(0, 122, 255, .2); }
```

## Button

```js
DevPanel.group({ id: 'button', label: 'Main button', target: 'T', options: [
  { name: 'Solid', note: 'Filled accent color, white text' },
  { name: 'Gloss', note: 'Accent with a light top edge' },
  { name: 'Outline', note: 'Accent border and text, no fill' },
  { name: 'Pill', note: 'Solid with round ends' },
] });
```

```css
html[data-dv-button="2"] T { background: #007aff; color: #fff; border: 0; border-radius: 10px; }
html[data-dv-button="3"] T { background: linear-gradient(180deg, #4da3ff, #007aff 55%); color: #fff; border: 0; border-radius: 10px; box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 1px 2px rgba(0,0,0,.2); }
html[data-dv-button="4"] T { background: transparent; color: #007aff; border: 1px solid #007aff; border-radius: 10px; }
html[data-dv-button="5"] T { background: #007aff; color: #fff; border: 0; border-radius: 999px; padding-inline: 22px; }
```

## Card

```js
DevPanel.group({ id: 'card', label: 'Cards', target: 'T', options: [
  { name: 'Flat', note: 'Hairline border, no shadow' },
  { name: 'Lifted', note: 'Soft shadow, no border' },
  { name: 'Tinted', note: 'Light fill, no border or shadow' },
] });
```

```css
html[data-dv-card="2"] T { border: 1px solid color-mix(in srgb, currentColor 12%, transparent); box-shadow: none; border-radius: 14px; }
html[data-dv-card="3"] T { border: 0; border-radius: 14px; box-shadow: 0 0 0 .5px rgba(0,0,0,.05), 0 2px 6px rgba(0,0,0,.08), 0 14px 36px rgba(0,0,0,.12); }
html[data-dv-card="4"] T { border: 0; box-shadow: none; border-radius: 14px; background: color-mix(in srgb, currentColor 5%, transparent); }
```

## Header

```js
DevPanel.group({ id: 'header', label: 'Header', target: 'T', options: [
  { name: 'Glass', note: 'Sticky, blurred see-through bar' },
  { name: 'Hairline', note: 'Sticky, solid with a thin bottom line' },
  { name: 'Floating', note: 'Round capsule that floats below the top edge' },
] });
```

```css
html[data-dv-header="2"] T { position: sticky; top: 0; z-index: 10; background: color-mix(in srgb, Canvas 70%, transparent); backdrop-filter: blur(20px) saturate(1.8); }
html[data-dv-header="3"] T { position: sticky; top: 0; z-index: 10; background: Canvas; border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent); }
html[data-dv-header="4"] T { position: sticky; top: 12px; z-index: 10; margin-inline: auto; max-width: min(960px, calc(100% - 24px)); border-radius: 999px; padding-inline: 20px; background: color-mix(in srgb, Canvas 75%, transparent); backdrop-filter: blur(20px) saturate(1.8); box-shadow: 0 0 0 .5px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.1); }
```

## Text change

CSS can't change words; use `apply`. It is called with 1 too, so keep the original.

```js
const h = document.querySelector('T'), was = h.textContent;
DevPanel.group({ id: 'title', label: 'Title', target: 'T', options: [{ name: 'Shorter' }, { name: 'Question' }],
  apply(i) { h.textContent = [was, 'Short title.', 'Want a short title?'][i - 1]; } });
```
