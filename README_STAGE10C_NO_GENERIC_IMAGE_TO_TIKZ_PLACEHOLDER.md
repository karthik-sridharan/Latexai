# Stage 10C: no generic image-to-TikZ placeholder

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/image-to-tikz-service.js`
- `js/asset-service.js`
- `css/lai-stage10a-image-to-tikz.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage10c-no-generic-image-to-tikz-placeholder-1`

## What this fixes

The previous stage could still insert a useless generic TikZ placeholder:

```tex
\draw[rounded corners, thick] (0,0) rectangle (5,2.2);
\node ... {Remake figures/...png as TikZ};
```

That happens when the AI backend does not actually inspect the image and returns
unusable output. Stage 10C refuses to insert that generic rectangle placeholder.

## New behavior

- If the backend returns real TikZ, it is used.
- If the backend returns the generic rectangle placeholder:
  - with a meaningful instruction like `simple car`, Latexai creates an editable
    local TikZ fallback for that description;
  - without a meaningful instruction, Latexai does not insert anything and asks
    for a short description.
- `Remake+insert TikZ` now asks for a short description if the instructions box is blank.
- The AI payload includes both common multimodal formats:
  - Responses-style `input_image`
  - Chat-style `image_url`

## For your car sketch

Use:

```txt
Figures → Image → TikZ remaker
Instructions: simple car
Remake + insert TikZ
```

or click `Remake+insert TikZ` and enter `simple car` when prompted.

Expected insertion is editable TikZ for a car, not the original PNG and not a
generic rectangle.

## Test

Included:

`tests/stage10c-no-generic-image-to-tikz-placeholder.test.cjs`

Run:

```bash
node tests/stage10c-no-generic-image-to-tikz-placeholder.test.cjs
```
