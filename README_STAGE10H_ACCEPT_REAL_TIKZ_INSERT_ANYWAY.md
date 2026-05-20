# Stage 10H: accept real TikZ + insert anyway

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/image-to-tikz-service.js`
- `js/asset-service.js`
- `css/lai-stage10a-image-to-tikz.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage10h-accept-real-tikz-and-insert-anyway-1`

## What this fixes

The backend can now return real TikZ, but the previous frontend guard could still
reject useful TikZ as a generic placeholder.

Stage 10H makes the filter strict and transparent:

- accepts any real `tikzpicture` with drawing commands;
- rejects only the known bad rectangle/label placeholder family;
- stores the latest raw AI text and extracted TikZ in a visible report;
- adds:
  - `Open returned TikZ`
  - `Insert returned anyway`
  - `Copy TikZ`

## Expected behavior

If the backend returns car-like TikZ with body/wheels, it should be accepted and
inserted by `Remake + insert TikZ`.

If Latexai still rejects something, the returned TikZ is no longer lost. Use
`Open returned TikZ` or `Insert returned anyway`.

## Test

Included:

`tests/stage10h-accept-real-tikz-insert-anyway.test.cjs`

Run:

```bash
node tests/stage10h-accept-real-tikz-insert-anyway.test.cjs
```
