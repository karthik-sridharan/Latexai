# Stage 11E: paper-level AI in-place LAI edits

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/document-ai-service.js`
- `css/lai-stage11a-document-ai.css`
- all files in `prompt/`, including:
  - `prompt/ai-document-common.txt`
  - `prompt/ai-review-and-suggestions.txt`
  - `prompt/ai-total-remake-plan.txt`
  - `prompt/ai-ranking-acceptance-improver.txt`
  - `prompt/ai-competitive-agent-improver.txt`
  - `prompt/ai-inplace-rewrite-format.txt`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage11e-paper-ai-inplace-lai-edits-1`

## What this adds

Paper-level AI now supports two modes:

1. `Append as final AI section`
2. `In-place with LAI comments`

In-place mode asks AI to return exact JSON edits:

```json
{
  "edits": [
    {
      "path": "main.tex",
      "oldText": "exact existing LaTeX",
      "newText": "replacement LaTeX",
      "reason": "why"
    }
  ]
}
```

Latexai only applies edits where `oldText` is an exact substring of the target file.

Applied edits become:

```tex
% BEGIN LAI-OLD id=... path=...
% old content
% END LAI-OLD id=...

\lai{
new content
}
```

## Safety

- No fuzzy matching.
- Non-exact edits are skipped.
- Prompt files remain developer-managed frontend files in `/prompt/`.
- Old content is preserved as comments.

## Test

Included:

`tests/stage11e-paper-ai-inplace-lai-edits.test.cjs`

Run:

```bash
node tests/stage11e-paper-ai-inplace-lai-edits.test.cjs
```
