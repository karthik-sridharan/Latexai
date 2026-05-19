# Stage 6A-C: modular SelectionService + PatchService

Upload/replace:

- `index.html`
- `.nojekyll`
- `css/lai-stage6-selection.css`
- `css/lai-stage5e-layout.css`
- `js/selection-service.js`
- `js/patch-service.js`
- `js/patch-manager.js`
- `js/copilot.js`
- `js/lai-stage5e-panel-scroll-pdf-viewer.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage6abc-modular-selection-patchservice-1`

## What changed

This is the Stage 6A-C remodularization.

### Stage 6A: SelectionService

`js/selection-service.js` now owns selections:

- source selection
- draft selection
- PDF text-layer selection
- source selection freeze/restore
- persistent visual source highlight when focus moves to the right panel
- draft/PDF text → source block matching

When you select source text and tap controls in the right panel, the source range should remain visibly highlighted by an overlay.

### Stage 6B: Draft/PDF selection service

Draft/PDF selections are separate from source selections. When preview text can be selected, SelectionService tries to locate the corresponding source block and freezes that source selection.

### Stage 6C: PatchService

`js/patch-service.js` is now the single owner of the invariant:

```tex
% BEGIN LAI-OLD id=... path=...
% old/original source
% END LAI-OLD id=...

\lai{
new AI-written source
}
```

Copilot and PatchManager no longer build this structure directly. They call PatchService.

## Removed old patch guards

The older guard scripts are no longer loaded:

- `js/lai-stage4l-lai-guard.js`
- `js/lai-stage4m-compile-safe-lai.js`
- `js/lai-stage5c-preview-selection-bridge.js`

Their responsibilities are now folded into SelectionService and PatchService.

## Tests

Included:

- `tests/stage6-patch-service.test.cjs`

Run locally:

```bash
node tests/stage6-patch-service.test.cjs
```

Expected:

```txt
PASS Stage 6 PatchService invariants
```
