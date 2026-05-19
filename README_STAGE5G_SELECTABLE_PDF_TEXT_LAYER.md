# Stage 5G: selectable PDF text layer

Upload/replace:

- `index.html`
- `.nojekyll`
- `css/lai-stage5e-layout.css`
- `js/lai-stage4l-lai-guard.js`
- `js/lai-stage4m-compile-safe-lai.js`
- `js/lai-stage5c-preview-selection-bridge.js`
- `js/lai-stage5e-panel-scroll-pdf-viewer.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage5g-selectable-pdf-text-layer-1`

## What changed

Stage 5F already had independent PDF zoom. Stage 5G adds a selectable text layer
on top of each PDF.js-rendered page.

This means:
- the PDF remains multi-page and scrollable
- zoom controls still affect only the PDF panel
- when PDF.js can extract text, the user can select text directly on the PDF page
- selected PDF text is routed through the existing preview/source bridge to select
  the matching LaTeX source block and set Copilot to the rewrite workflow

## Notes

Text selection depends on the PDF containing extractable text. If the PDF page is
actually an image scan, no browser text-layer can recover selectable text without OCR.
