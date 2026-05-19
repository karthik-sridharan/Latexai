# Stage 5C: restore pre-5A UI + unobtrusive preview text selection

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/lai-stage4l-lai-guard.js`
- `js/lai-stage4m-compile-safe-lai.js`
- `js/lai-stage5c-preview-selection-bridge.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage5c-restore-ui-preview-selection-1`

## What changed

- Removes the Stage 5A panel entirely.
- Restores the clean preview/PDF layout from before Stage 5A.
- Adds no visible block above the preview.
- Enables text selection in Draft preview.
- When real preview text is selected, it automatically finds/selects the matching source and sets Copilot to the rewrite workflow.

## How to use

1. Switch to Draft preview if PDF text is not selectable.
2. Select a paragraph/theorem text in the preview.
3. The matching source block is selected in the editor.
4. Copilot workflow is set to `Rewrite selected LaTeX as patch`.
5. Tap Ask Copilot.

## Important

Native PDF rendering on iPad/Safari often behaves like an image/canvas and does not expose selectable text to JavaScript. This script cannot force text extraction from an image-like PDF viewer. It works when the preview exposes real selectable text, especially Draft preview.
