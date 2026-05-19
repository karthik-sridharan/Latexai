# Stage 8G: figure Save+insert caret capture fix

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/asset-service.js`
- `js/figure-editor-service.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage8g-figure-insert-caret-capture-fix-1`

## What this fixes

Stage 8F fixed shape persistence, but `Save + insert` could still insert near the
end because saving the PNG creates/selects an asset file before the snippet is
inserted. That can lose the active source cursor.

Stage 8G fixes this by:

1. AssetService continuously remembers the source editor caret.
2. FigureEditorService captures the insertion target **before** calling
   `AssetService.addImageDataUrl(...)`.
3. `AssetService.insertFigureSnippet(...)` now accepts an explicit insertion path
   and insertion position.

So the order is now:

```txt
capture source cursor
save PNG asset
insert snippet at captured source cursor
ensure \usepackage{graphicx}
```

## Test

Included:

`tests/stage8g-figure-insert-caret-capture.test.cjs`

Run:

```bash
node tests/stage8g-figure-insert-caret-capture.test.cjs
```
