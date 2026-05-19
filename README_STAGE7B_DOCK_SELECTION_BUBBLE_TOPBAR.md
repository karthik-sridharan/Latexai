# Stage 7B: dock selection bubble in topbar blank space

Upload/replace:

- `index.html`
- `.nojekyll`
- `css/lai-stage7a-selection-action-bubble.css`
- `js/selection-action-bubble.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage7b-dock-selection-bubble-topbar-1`

## What changed

Stage 7A placed the selection action bubble near the selection, which could cover
the right-panel tabs and preview/editor controls.

Stage 7B moves the bubble into the unused center space of the topbar, between the
Lumina LaTeX logo/title and the top-right buttons.

It still appears only when there is an active selection, but it no longer floats
over the editor, preview, Copilot tabs, or file tree.

## Test

Included:

`tests/stage7b-dock-selection-bubble.test.cjs`

Run:

```bash
node tests/stage7b-dock-selection-bubble.test.cjs
```
