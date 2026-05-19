# Stage 8B: source display/edit sync fix

Upload/replace:

- `index.html`
- `.nojekyll`
- `css/lai-stage6-selection.css`
- `js/source-display-sync.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage8b-source-display-sync-fix-1`

## What this fixes

The persistent source-selection overlay could display text at slightly different
positions from the actual textarea editing surface. In particular, the overlay used
`pre-wrap` and a different font size, while the editor uses `white-space: pre`.

That can make the displayed line/text position differ from where editing actually
happens.

Stage 8B makes the overlay and line gutter match the textarea:

- same font size and line height
- same padding
- `white-space: pre`
- no wrapping
- same tab size
- horizontal-scroll-compatible overlay

It also adds a small `source-display-sync.js` module that copies computed editor
metrics to the overlay and line gutter after load, resize, selection, and file changes.

## Test

Included:

`tests/stage8b-source-display-sync.test.cjs`

Run:

```bash
node tests/stage8b-source-display-sync.test.cjs
```
