# Stage 13G: talk package validator + ZIP export

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/presentation-export-service.js`
- `css/lai-stage13a-presentation-export.css`
- `prompt/ai-paper-to-presentation-export.txt`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage13g-talk-package-validator-zip-1`

## What this adds

The Paper → Presentation exporter now has:

- `Build package`
- `Validate package`
- `Download package ZIP`
- `Add package to /talk`

## Package contents

The package includes selected formats:

```txt
talk/<deck>.presentation.json
talk/<deck>.html
talk/<deck>.beamer.tex
```

Plus package metadata:

```txt
talk/<deck>.manifest.json
talk/README-<deck>.md
```

And selected figure assets:

```txt
figures/<deck>-fig-XX.svg
figures/<deck>-fig-XX.tikz.tex
```

## Validator checks

It checks:

- selected export files exist
- deck is Presentation Maker compatible
- HTML references existing SVG assets
- Beamer references existing TikZ assets
- Beamer includes graphicx/tikz/amsmath
- no empty package files
- no duplicate paths
- SVG/TikZ assets pass the same safety checks

## ZIP

The ZIP exporter is implemented client-side with a simple no-compression ZIP writer, so no external library is required.

## Test

Included:

`tests/stage13g-talk-package-validator-zip.test.cjs`

Run:

```bash
node tests/stage13g-talk-package-validator-zip.test.cjs
```
