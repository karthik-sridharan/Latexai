# Stage 5A: Preview/PDF mark to source

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/lai-stage5a-preview-source-marker.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage5a-preview-source-marker-1`

## What this adds

A small panel in the Preview tab:

`Preview/PDF mark → source`

Workflow:

1. Select text in the Preview/Draft/PDF area, or tap a preview paragraph/block.
2. Tap `Capture preview`.
3. Tap `Find source`.
4. The matching LaTeX source block is selected in the editor.
5. Tap `Rewrite marked` to prepare Copilot, or `Ask rewrite` to immediately ask Copilot.

Stage 4N still handles the rewrite:
- old source gets commented
- replacement is wrapped in `\lai{...}`
- root macro is inserted before compile

## Notes

- Exact text matches work best.
- For math-heavy PDF text, select a full surrounding paragraph/theorem so token matching has context.
- If preview matching fails, select the source directly and tap `Capture source`.
