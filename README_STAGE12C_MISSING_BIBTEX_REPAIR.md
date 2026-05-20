# Stage 12C: missing BibTeX repair

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/citation-ai-service.js`
- `js/citation-verifier-service.js`
- `css/lai-stage12b-citation-verifier.css`
- `prompt/ai-missing-bibtex-repair.txt`

Keep/upload existing Stage 12A/12B files if not present.

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage12c-missing-bibtex-repair-1`

## What this fixes

If `\citeai{...}` was replaced by `\cite{key}` but the corresponding BibTeX entry was not added, Stage 12C gives the local verifier a repair action.

New verifier buttons:

- `Add missing BibTeX with AI`
- `Verify + add missing BibTeX`

It uses the local verifier's missing-key list, asks AI for BibTeX entries for those exact keys, and appends them to the existing `.bib` file.

## Also improved

The citation filler now also scans the raw AI output for `@article`, `@book`, etc. BibTeX blocks. This helps when AI returns BibTeX outside the exact JSON field expected by Stage 12A.

## Test

Included:

`tests/stage12c-missing-bibtex-repair.test.cjs`

Run:

```bash
node tests/stage12c-missing-bibtex-repair.test.cjs
```
