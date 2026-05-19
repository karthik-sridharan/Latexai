# Stage 5B: restore clean Preview/PDF UI

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/lai-stage4l-lai-guard.js`
- `js/lai-stage4m-compile-safe-lai.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage5b-restore-preview-ui-1`

## What changed

This removes the Stage 5A `Preview/PDF mark → source` panel from the Preview tab.

The PDF/preview area goes back to the prior clean, scrollable layout.

## What remains working

- GitHub load/save tree from Stage 3J+
- Copilot source rewrite
- old source comments
- `\lai{...}` wrapping
- automatic root `\lai` macro injection before compile

## Why Stage 5A was removed

The current PDF preview is not reliably selectable text on iPad/Safari. It often behaves
like an image/canvas/PDF viewer, so trying to select text in it is not a good UI.

The next correct step should be a native PDF rectangle-marking tool, not text selection
inside the preview.
