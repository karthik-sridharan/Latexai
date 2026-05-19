# Stage 9A: AI TikZ maker

Upload/replace:

- `index.html`
- `.nojekyll`
- `css/lai-stage9a-tikz-maker.css`
- `js/asset-service.js`
- `js/tikz-maker-service.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage9a-ai-tikz-maker-1`

## What this adds

The `Figures` tab now includes an `AI TikZ maker` card.

Workflow:

1. Type a prompt, for example:
   `draw a three-layer neural network with input, hidden, output nodes and arrows`
2. Click `Generate TikZ`.
3. Review/edit the generated TikZ source.
4. Click:
   - `Save TikZ` to save it as `figures/... .tex`
   - `Save + insert` to save and insert a LaTeX figure snippet using `\input{...}`

## Modular behavior

TikzMakerService does not edit project files directly.

It uses:

- `AIProvider` for AI generation.
- `AssetService.addTextAsset(...)` to save TikZ source.
- `AssetService.insertInputFigureSnippet(...)` to insert the figure snippet.
- `AssetService.ensureTikzPackage()` to add `\usepackage{tikz}` to the root preamble.

## AssetService additions

Stage 9A adds:

```js
AssetService.addTextAsset(path, text, options)
AssetService.ensurePackage(packageName)
AssetService.ensureTikzPackage()
AssetService.inputFigureSnippet(options)
AssetService.insertInputFigureSnippet(options)
```

## Test

Included:

`tests/stage9a-ai-tikz-maker.test.cjs`

Run:

```bash
node tests/stage9a-ai-tikz-maker.test.cjs
```
