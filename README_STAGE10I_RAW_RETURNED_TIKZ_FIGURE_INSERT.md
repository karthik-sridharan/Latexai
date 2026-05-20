# Stage 10I: insert raw returned TikZ as a figure

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/image-to-tikz-service.js`
- `js/asset-service.js`
- `css/lai-stage10a-image-to-tikz.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage10i-insert-raw-returned-tikz-figure-1`

## What this fixes

The backend diagnostic can already return exactly the desired raw TikZ. Stage 10I
uses that raw `tikzpicture` directly:

- extracts the raw `\begin{tikzpicture} ... \end{tikzpicture}` block from backend responses;
- prefers raw backend TikZ over helper parsers/fallbacks;
- reuses the latest valid diagnostic/remake TikZ for `Remake + insert TikZ`;
- inserts through `AssetService.insertDirectTikzFigure(...)`, which wraps the TikZ
  inside a `figure` environment and ensures `\usepackage{tikz}`;
- changes the override button to `Insert returned as figure`.

## Expected behavior

If Diagnose backend shows good raw TikZ, clicking `Remake + insert TikZ` should
insert that exact TikZ as a figure. You can also click `Insert returned as figure`.

## Test

Included:

`tests/stage10i-raw-returned-tikz-figure-insert.test.cjs`

Run:

```bash
node tests/stage10i-raw-returned-tikz-figure-insert.test.cjs
```
