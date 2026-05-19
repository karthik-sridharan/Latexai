# Stage 7D: PDF region selection

Upload/replace:

- `index.html`
- `.nojekyll`
- `css/lai-stage7d-pdf-region-selection.css`
- `js/pdf-region-selection-service.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage7d-pdf-region-selection-1`

## What this adds

A `Region` button is added to the PDF preview toolbar.

Workflow:

1. Compile and switch to PDF preview.
2. Click `Region`.
3. Drag a rectangle over a PDF page.
4. The app captures:
   - page number
   - rectangle coordinates
   - cropped PNG of that region
   - extractable PDF text inside the region, when available
5. Use:
   - `Find source` to map extracted region text to LaTeX source.
   - `Ask Copilot` to prepare a Copilot prompt.
   - `Download crop` to save the selected region image.
   - `Clear` to remove the region.

## Modular behavior

This service does not edit project files directly.

It delegates to:

- `SelectionService` for source selection.
- `Copilot` for AI interaction.
- `PatchService` indirectly through the existing Copilot rewrite flow.

## Limitations

If the selected PDF region has no extractable text, `Find source` cannot map it automatically.
The crop is still captured and downloadable. A later multimodal AI workflow can use
`PDFRegionSelectionService.getCurrentRegion().cropDataUrl`.

## Test

Included:

`tests/stage7d-pdf-region-selection.test.cjs`

Run:

```bash
node tests/stage7d-pdf-region-selection.test.cjs
```
