# Stage 7C: move selection bubble left by 3/4 inch

Upload/replace:

- `index.html`
- `.nojekyll`
- `css/lai-stage7a-selection-action-bubble.css`
- `js/selection-action-bubble.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage7c-move-selection-bubble-left-1`

## What changed

The docked selection bubble remains in the topbar blank space, but is shifted left by
about 3/4 inch, implemented as 72 CSS pixels.

The width is preserved by moving both the left and right edges left:

- desktop: `left = old left - 72px`, `right = old right + 72px`
- medium breakpoint: `left: 158px`, `right: 462px`

## Test

Included:

`tests/stage7c-move-selection-bubble-left.test.cjs`

Run:

```bash
node tests/stage7c-move-selection-bubble-left.test.cjs
```
