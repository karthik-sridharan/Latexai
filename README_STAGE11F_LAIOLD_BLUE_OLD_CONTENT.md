# Stage 11F: `\laiold{...}` blue old content

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/document-ai-service.js`
- `css/lai-stage11a-document-ai.css`
- all files in `prompt/`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage11f-laiold-blue-old-content-1`

## What changed from Stage 11E

Stage 11E preserved old content by commenting it out:

```tex
% BEGIN LAI-OLD ...
% old content
% END LAI-OLD ...
```

Stage 11F instead preserves old content as visible blue LaTeX:

```tex
% BEGIN LAI-OLD id=... path=...
\laiold{
old content
}
% END LAI-OLD id=...

\lai{
new content
}
```

The root file gets this macro if missing:

```tex
\usepackage{xcolor}
\long\def\laiold#1{{\color{blue}#1}}
```

The existing `\lai{...}` red new-content behavior is unchanged.

## Test

Included:

`tests/stage11f-laiold-blue-old-content.test.cjs`

Run:

```bash
node tests/stage11f-laiold-blue-old-content.test.cjs
```
