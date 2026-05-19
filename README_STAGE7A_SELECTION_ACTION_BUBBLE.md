# Stage 7A: contextual selection action bubble

Upload/replace:

- `index.html`
- `.nojekyll`
- `css/lai-stage7a-selection-action-bubble.css`
- `js/selection-action-bubble.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage7a-selection-action-bubble-1`

## What this adds

A small floating action bubble appears after source/draft/PDF text selection.

Actions:

- `Rewrite`
- `Improve`
- `Ask rewrite`
- `Explain`
- `Find source`

## Modular behavior

This stage does **not** mutate source files directly.

It delegates to:

- `SelectionService` for source/draft/PDF selection capture and freezing.
- `Copilot` for AI request setup.
- `PatchService` indirectly through Copilot/PatchManager for edits.

## Expected behavior

1. Select source text.
2. A small bubble appears.
3. Click in the right panel.
4. Source selection remains visibly highlighted.
5. Click `Rewrite` or `Improve`.
6. Copilot tab opens with the selected source preserved and workflow set to `Rewrite selected LaTeX as patch`.

For draft/PDF text:

1. Select text in draft/PDF preview.
2. Bubble appears.
3. Click `Find source`.
4. SelectionService attempts to map preview text to source and freezes the source selection.

## Test

Included:

`tests/stage7a-selection-action-bubble.test.cjs`

Run:

```bash
node tests/stage7a-selection-action-bubble.test.cjs
```
