# Stage 5F: independent PDF zoom

Upload/replace:

- `index.html`
- `.nojekyll`
- `css/lai-stage5e-layout.css`
- `js/lai-stage4l-lai-guard.js`
- `js/lai-stage4m-compile-safe-lai.js`
- `js/lai-stage5c-preview-selection-bridge.js`
- `js/lai-stage5e-panel-scroll-pdf-viewer.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage5f-pdf-independent-zoom-1`

## What changed

The PDF preview in the right panel now has independent zoom controls:

- `−`
- zoom percent
- `+`
- `Fit width`
- `Open PDF`

Zooming changes only the PDF preview inside the right panel, not the whole page.

## Gestures

- On desktop/trackpad: Ctrl/command pinch-wheel inside the PDF panel zooms the PDF.
- On iPad: two-finger pinch inside the PDF pages area attempts to zoom the PDF panel and prevent page zoom.
- Buttons are the reliable fallback on iPad if Safari still captures the pinch gesture.

## Existing behavior preserved

- Each panel remains constrained to the visible screen and scrolls independently.
- Multi-page PDF.js rendering remains enabled.
- Stage 4N/5D `\lai{...}` rewrite behavior remains enabled.
