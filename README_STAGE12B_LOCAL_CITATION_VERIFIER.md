# Stage 12B: local citation verifier

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/citation-verifier-service.js`
- `css/lai-stage12b-citation-verifier.css`

Also keep/upload the Stage 12A files if not already present:

- `js/citation-ai-service.js`
- `css/lai-stage12a-citation-ai.css`
- `prompt/ai-citation-filler.txt`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage12b-local-citation-verifier-1`

## What this adds

A new **Local citation verifier** card appears in the Copilot panel.

It checks locally for:

- missing citation keys
- duplicate BibTeX keys
- unused BibTeX entries
- weak/incomplete BibTeX entries
- remaining `\citeai{...}` placeholders

Weak entries are flagged if they are missing fields such as:

- title
- author/editor
- year/date
- venue field
- DOI / URL / eprint / arXiv information

## Important limitation

Stage 12B is local only. It does not verify online existence or correctness of a citation. That should be Stage 12D with backend/web support.

## Test

Included:

`tests/stage12b-local-citation-verifier.test.cjs`

Run:

```bash
node tests/stage12b-local-citation-verifier.test.cjs
```
