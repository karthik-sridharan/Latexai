# Stage 13B: Presentation Maker compatible exporter

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/presentation-export-service.js`
- `css/lai-stage13a-presentation-export.css`
- `prompt/ai-paper-to-presentation-export.txt`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage13b-presentation-maker-compatible-export-1`

## What this fixes

Stage 13A exported semantic slides like:

```json
{
  "title": "Slide title",
  "bullets": ["point 1"],
  "latex": "..."
}
```

Presentation Maker imported the title but did not know how to render `bullets`/`latex`, so slides appeared title-only.

Stage 13B exports Presentation Maker compatible slides with visible blocks:

```json
{
  "deckTitle": "...",
  "summary": "...",
  "slides": [
    {
      "slideType": "single",
      "headingLevel": "h2",
      "bgColor": "#ffffff",
      "fontColor": "#000000",
      "inheritTheme": true,
      "title": "Slide title",
      "lede": "...",
      "leftBlocks": [
        {
          "mode": "panel",
          "title": "Key points",
          "content": "\\begin{itemize}\n\\item point 1\n\\end{itemize}"
        }
      ],
      "rightBlocks": [],
      "notesTitle": "Speaker notes",
      "notesBody": "..."
    }
  ]
}
```

## Extra helper

The new `Convert current JSON` button can take older Stage 13A semantic JSON in the output box and convert it to the Presentation Maker block schema.

## Test

Included:

`tests/stage13b-presentation-maker-compatible-export.test.cjs`

Run:

```bash
node tests/stage13b-presentation-maker-compatible-export.test.cjs
```
