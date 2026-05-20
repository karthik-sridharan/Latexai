# Stage 10F: image-to-TikZ backend-first prompt fix

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/image-to-tikz-service.js`
- `js/asset-service.js`
- `css/lai-stage10a-image-to-tikz.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage10f-image-to-tikz-try-backend-before-description-1`

## What this fixes

After the Stage 10E backend deploy, the backend can now inspect images. However,
Stage 10D/10C still forced a manual description popup before `Remake+insert TikZ`
when the instructions box was blank.

Stage 10F changes the flow:

1. `Remake+insert TikZ` first calls the image backend.
2. If the backend returns real TikZ, it inserts that directly.
3. Only if the backend fails or returns the generic rectangle placeholder does
   Latexai ask for a short fallback description.

So you should no longer see the description popup before the backend has been tried.

## Test

Included:

`tests/stage10f-image-to-tikz-backend-first-prompt-fix.test.cjs`

Run:

```bash
node tests/stage10f-image-to-tikz-backend-first-prompt-fix.test.cjs
```
