# Stage 8A: AssetService + image figure assets

Upload/replace:

- `index.html`
- `.nojekyll`
- `css/lai-stage8a-assets.css`
- `js/asset-service.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage8a-asset-service-image-figures-1`

## What this adds

A new `Figures` tab is added to the right panel.

The tab lets the user:

- upload a PNG/JPG/WebP/SVG image
- save it into the current project, usually under `figures/`
- avoid filename collisions automatically
- preview a LaTeX figure snippet
- insert the figure snippet into the current/root `.tex` file
- automatically add `\usepackage{graphicx}` to the root preamble if missing

## Why this stage exists

This is the modular foundation for the next figure-related stages:

- porting the presentation-maker figure editor
- saving drawn figures as `.png`
- prompt → TikZ figure maker
- image → TikZ remaker

Those future stages should call `AssetService` rather than manipulating project files directly.

## Current public API

```js
LuminaLatex.AssetService.addImageDataUrl(dataUrl, options)
LuminaLatex.AssetService.addImageFile(file, options)
LuminaLatex.AssetService.figureSnippet(options)
LuminaLatex.AssetService.insertFigureSnippet(options)
LuminaLatex.AssetService.ensureGraphicsPackage()
LuminaLatex.AssetService.imageAssets()
LuminaLatex.AssetService.uniquePath(path)
```

## Test

Included:

`tests/stage8a-asset-service.test.cjs`

Run:

```bash
node tests/stage8a-asset-service.test.cjs
```
