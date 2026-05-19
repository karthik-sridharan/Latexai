# Stage 8E: native figure editor

Upload/replace:

- `index.html`
- `.nojekyll`
- `css/lai-stage8e-figure-editor.css`
- `js/figure-editor-service.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage8e-native-figure-editor-1`

## What this adds

The `Figures` tab now gets a native drawing editor.

Tools:

- Pen
- Line
- Arrow
- Box
- Circle
- Text
- Eraser
- Undo
- Clear

Actions:

- `Save PNG`
- `Save + insert`
- `Download PNG`

## Modular behavior

The figure editor does not directly mutate project files.

It delegates to:

- `AssetService.addImageDataUrl(...)` to save the canvas as a PNG asset.
- `AssetService.insertFigureSnippet(...)` to insert the LaTeX figure snippet.

This keeps image/figure storage centralized for later stages:

- AI TikZ maker
- image to TikZ remaker
- presentation-maker figure editor port

## Test

Included:

`tests/stage8e-native-figure-editor.test.cjs`

Run:

```bash
node tests/stage8e-native-figure-editor.test.cjs
```
