# Stage 12A: AI citation filler

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/citation-ai-service.js`
- `css/lai-stage12a-citation-ai.css`
- `prompt/ai-citation-filler.txt`

Also keep/upload the existing `prompt/` files from Stage 11G if they are not already present.

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage12a-ai-citation-filler-1`

## What this adds

A new **AI citation filler** card appears in the Copilot panel.

Users can write:

```tex
\citeai{paper about online learning regret bounds}
```

Then:

1. Click `Scan \citeai`
2. Click `Run citation AI`
3. Review the output
4. Click `Apply citation plan`

or use `Run + apply`.

## What apply does

For each AI suggestion:

- replaces exact `\citeai{...}` placeholders with `\cite{key}`
- creates/uses an existing `.bib` file, falling back to `references.bib`
- appends missing BibTeX entries

## Safety note

Stage 12A does not yet verify citations online. The UI explicitly warns users to verify citations before relying on them. Citation verifier is a later stage.

## Test

Included:

`tests/stage12a-ai-citation-filler.test.cjs`

Run:

```bash
node tests/stage12a-ai-citation-filler.test.cjs
```
