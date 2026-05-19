# Stage 10D: image AI backend diagnostics

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/image-to-tikz-service.js`
- `js/asset-service.js`
- `css/lai-stage10a-image-to-tikz.css`
- `docs/IMAGE_TO_TIKZ_BACKEND_CONTRACT.md`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage10d-image-ai-backend-diagnostics-1`

## Why the backend appears not to work

The frontend can send the selected image as a data URL, but the AI proxy/backend must
forward that image to a vision-capable model. If the backend flattens the request to
plain text, the model never sees the image. Then it can only respond with generic
text/TikZ based on the filename or prompt.

## What this stage adds

In `Figures → Image → TikZ remaker`:

- `Diagnose backend`
- `Copy report`

The diagnostic report shows:

- AI proxy URL / provider / model
- selected image path and data URL size
- whether the frontend sent Responses-style `input_image`
- whether the frontend sent Chat-style `image_url`
- raw model response
- likely diagnosis

## Backend contract

See:

`docs/IMAGE_TO_TIKZ_BACKEND_CONTRACT.md`

This documents the image payload formats the backend should forward to the model.

## Test

Included:

`tests/stage10d-image-ai-backend-diagnostics.test.cjs`

Run:

```bash
node tests/stage10d-image-ai-backend-diagnostics.test.cjs
```
