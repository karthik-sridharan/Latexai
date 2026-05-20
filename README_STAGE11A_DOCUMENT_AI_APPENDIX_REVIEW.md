# Stage 11A: document-level AI append-only review

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/document-ai-service.js`
- `css/lai-stage11a-document-ai.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage11a-document-ai-appendix-review-1`

## What this adds

A new **Paper-level AI** card appears in the Copilot panel.

Stage 11A implements the safe append-only mode for the document-level features:

- Review and suggested improvements
- Total remake plan
- Ranking / acceptance improver
- Competitive agent improver

For now, all workflows append a final AI-generated section wrapped in `\lai{...}`.
They do not rewrite existing paper sections in place yet.

## Why append-only first

This makes the document-level system modular and safer:

- It uses AIProvider only.
- It collects project context without changing the file tree.
- It updates only the root LaTeX file.
- It preserves old paper content.
- It gives us a testable base before implementing harder in-place LAI rewrites.

## Test

Included:

`tests/stage11a-document-ai-appendix-review.test.cjs`

Run:

```bash
node tests/stage11a-document-ai-appendix-review.test.cjs
```
