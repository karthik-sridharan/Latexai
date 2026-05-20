# Stage 11G: resolve red/new vs blue/old AI edits

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/document-ai-service.js`
- `css/lai-stage11a-document-ai.css`
- all files in `prompt/`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage11g-resolve-laiold-lai-edits-1`

## What this adds

The Paper-level AI card now has a **Resolve AI edits** section.

For each in-place edit like:

```tex
% BEGIN LAI-OLD id=... path=...
\laiold{
old blue content
}
% END LAI-OLD id=...

\lai{
new red content
}
```

you can choose:

- `Keep red/new`
- `Keep blue/old`

The kept content is inserted back as plain LaTeX, so it becomes normal black text. The `\lai{...}`, `\laiold{...}`, and LAI markers are removed.

There are also bulk actions:

- `Keep all red/new`
- `Keep all blue/old`

## Test

Included:

`tests/stage11g-resolve-laiold-lai-edits.test.cjs`

Run:

```bash
node tests/stage11g-resolve-laiold-lai-edits.test.cjs
```
