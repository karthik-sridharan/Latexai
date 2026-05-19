# Stage 8C: figure asset compile + cursor insertion fix

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/asset-service.js`
- `js/compiler-provider.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage8c-figure-asset-compile-cursor-fix-1`

## What this fixes

### 1. Figure/image did not show up after compile

The image file was saved in project state as `base64`, but the compile payload builder
only read textual fields such as `text`, `content`, `source`, etc. So image files could
be omitted from the actual Cloud Run compile payload.

Stage 8C fixes this in two places:

- `compiler-provider.js` now converts file objects with `base64` into data URLs:
  `data:image/png;base64,...`
- `asset-service.js` also stores a data URL compatibility fallback in `file.text`
  and `file.content`.

### 2. Insert snippet always went to the end

When the user placed the cursor in the source editor and then clicked `Insert selected`
in the right panel, the editor lost focus. The old code only used the cursor if the
editor still had focus; otherwise it inserted before `\end{document}`.

Stage 8C now uses `NS.Editor.getSelection()` / remembered cursor even after focus has
moved to the right panel.

## Test

Included:

`tests/stage8c-figure-asset-compile-cursor.test.cjs`

Run:

```bash
node tests/stage8c-figure-asset-compile-cursor.test.cjs
```
