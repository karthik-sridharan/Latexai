# Stage 17L — Restore figure drawing tab

Stage string: `stage17l-restore-figure-drawing-tab-1`

This stage fixes a regression introduced by the right-panel organizer work: the organizer could globally grab cards by ID and move them into Copilot groups even when those cards belonged to the dedicated Figures tab.

## Fixes

- Prevents cross-tab card stealing in `right-panel-organizer-service.js` by requiring ID-matched cards to be contained inside the target panel before moving them.
- Keeps `figureEditorCard`, `tikzMakerCard`, and `imageToTikzCard` inside the dedicated `Figures` tab.
- Adds scroll containment to `#assetsTab` so the Draw figure canvas, TikZ maker, and Image → TikZ tools remain fully reachable on iPad/Safari.
- Exposes `AssetService.ensureAssetTab()` and has the figure editor call it before mounting, so the Draw figure card can recover if script order changes.

## Expected visual behavior

Open the `Figures` tab. You should see:

1. Draw figure
2. AI TikZ maker
3. Image → TikZ remaker
4. Image assets / snippet preview / project images

The `Figures` tab should scroll vertically if the drawing canvas or controls exceed the panel height.
