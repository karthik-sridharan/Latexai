# Stage 13E: multi-format talk export

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/presentation-export-service.js`
- `css/lai-stage13a-presentation-export.css`
- `prompt/ai-paper-to-presentation-export.txt`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage13e-multiformat-talk-export-1`

## What this adds

The Paper → Presentation exporter now supports selectable export formats:

- JSON
- HTML
- Beamer TeX

Users can choose one, two, or all three.

## New actions

- `Add selected to /talk`
- `Download selected`
- `Run + add to /talk`
- `Run + download selected`

## Project paths

Selected talk files are written under:

```txt
talk/<deck>.presentation.json
talk/<deck>.html
talk/<deck>.beamer.tex
```

Generated figure placeholder assets are written under:

```txt
figures/<deck>-fig-XX.svg
```

The HTML and Beamer exports reference those figure assets.

## Note about figures

Stage 13E creates deterministic SVG placeholder assets for figure/diagram blocks. A later stage can connect this to AI image/TikZ generation so actual figures are generated before export.

## Test

Included:

`tests/stage13e-multiformat-talk-export.test.cjs`

Run:

```bash
node tests/stage13e-multiformat-talk-export.test.cjs
```
