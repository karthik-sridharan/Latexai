# Stage 10A: image to TikZ remaker

Upload/replace:

- `index.html`
- `.nojekyll`
- `css/lai-stage10a-image-to-tikz.css`
- `js/image-to-tikz-service.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage10a-image-to-tikz-remaker-1`

## What this adds

The `Figures` tab now includes:

```txt
Image → TikZ remaker
```

Workflow:

1. Choose a project image asset.
2. Optionally type instructions.
3. Click `Remake as TikZ`.
4. The generated TikZ is placed into the existing AI TikZ maker source box.
5. Review/edit it.
6. Click `Insert TikZ directly`, or use `Remake + insert`.

## Modular behavior

`ImageToTikzService` does not edit project files directly.

It delegates to:

- `AssetService.imageAssets()` to list image assets.
- `AssetService.assetDataUrl(...)` to read image content.
- `AIProvider` for AI reconstruction.
- `TikzMakerService.extractTikz(...)` to sanitize AI output.
- `TikzMakerService.saveTikz({ direct: true })` for direct source insertion.

## Note

The frontend sends a multimodal-friendly payload containing the selected image data URL.
If the current AI backend does not support image input yet, this stage falls back to a
simple editable placeholder TikZ figure rather than failing.

## Test

Included:

`tests/stage10a-image-to-tikz-remaker.test.cjs`

Run:

```bash
node tests/stage10a-image-to-tikz-remaker.test.cjs
```
