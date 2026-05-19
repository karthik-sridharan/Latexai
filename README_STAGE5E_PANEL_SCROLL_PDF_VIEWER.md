# Stage 5E: viewport-height panels + scrollable multi-page PDF viewer

Upload/replace:

- `index.html`
- `.nojekyll`
- `css/lai-stage5e-layout.css`
- `js/lai-stage4l-lai-guard.js`
- `js/lai-stage4m-compile-safe-lai.js`
- `js/lai-stage5c-preview-selection-bridge.js`
- `js/lai-stage5e-panel-scroll-pdf-viewer.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage5e-panel-scroll-pdf-viewer-1`

## Layout fix

- The whole app is constrained to the visible viewport.
- Left, editor, and right panels do not grow past the screen.
- Each panel scrolls internally when its content is longer than the visible area.
- The Preview tab no longer adds the Stage 5A panel.

## PDF preview fix

- Replaces the embedded native iframe behavior with a PDF.js multi-page scrollable viewer.
- This avoids iPad/Safari's common "only first PDF page visible" iframe behavior.
- Includes an `Open PDF` button inside the PDF viewer.

## Notes

- The PDF.js viewer renders pages to canvases, so it is scrollable and multi-page.
- Native text selection inside a compiled PDF is still browser/PDF-viewer dependent.
- Draft preview text selection from Stage 5C remains available.
