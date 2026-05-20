# Stage 10G: image-to-TikZ no-popup fix

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/image-to-tikz-service.js`
- `js/asset-service.js`
- `css/lai-stage10a-image-to-tikz.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage10g-image-to-tikz-no-popup-1`

## What this fixes

Stage 10F could still open this blocking fallback popup if the backend response was classified as generic:

```txt
The current AI backend may not be able to inspect image pixels...
```

Stage 10G removes that popup entirely.

New behavior:

1. `Remake+insert TikZ` calls the image backend.
2. If real TikZ comes back, it inserts it.
3. If the backend fails or returns the generic placeholder:
   - if the Instructions box has a meaningful hint, Latexai uses that for local fallback;
   - otherwise it does not insert anything and writes a status message asking the user to type a hint in the Instructions box.

## Test

Included:

`tests/stage10g-image-to-tikz-no-popup.test.cjs`

Run:

```bash
node tests/stage10g-image-to-tikz-no-popup.test.cjs
```
