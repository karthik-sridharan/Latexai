# Stage 9B: TikZ JSON sanitizer fix

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/tikz-maker-service.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage9b-tikz-json-sanitizer-fix-1`

## What this fixes

Stage 9A could incorrectly save AI output like this:

```tex
\begin{tikzpicture}
json
{ "slides": [...] }
\end{tikzpicture}
```

That happened when the model returned a slide/diagram JSON schema instead of TikZ.
The old sanitizer then wrapped the raw JSON inside a `tikzpicture`.

Stage 9B fixes this:

- accepts ```json fences
- parses JSON-ish AI output
- detects JSON accidentally placed inside a tikzpicture
- converts simple `blockDiagram` JSON into real TikZ nodes/arrows
- if conversion is not possible, creates a safe placeholder TikZ figure
- never wraps raw JSON into a tikzpicture

## Test

Included:

`tests/stage9b-tikz-json-sanitizer.test.cjs`

Run:

```bash
node tests/stage9b-tikz-json-sanitizer.test.cjs
```
