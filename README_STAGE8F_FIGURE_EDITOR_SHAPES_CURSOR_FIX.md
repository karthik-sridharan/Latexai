# Stage 8F: figure editor shapes + cursor insertion fix

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/figure-editor-service.js`
- `js/asset-service.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage8f-figure-editor-shapes-cursor-fix-1`

## What this fixes

### 1. Line / box / circle / arrow disappear after pointer-up

Stage 8E used a PNG data URL snapshot and restored it asynchronously while drawing
the final shape. The async image restore could repaint over the final shape after
you released the pointer.

Stage 8F uses synchronous canvas `ImageData` snapshots instead:

- `ctx.getImageData(...)`
- `ctx.putImageData(...)`

Final shapes are now committed synchronously.

### 2. Save + insert still inserts at the end

AssetService previously inserted `\usepackage{graphicx}` before inserting the figure.
That changed the file text, so the code assumed the captured cursor was stale and
fell back to inserting near `\end{document}`.

Stage 8F inserts the snippet at the captured cursor first, then ensures `graphicx`.

## Test

Included:

`tests/stage8f-figure-editor-shapes-cursor.test.cjs`

Run:

```bash
node tests/stage8f-figure-editor-shapes-cursor.test.cjs
```
