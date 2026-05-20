# Stage 13F: AI figure assets for talk export

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/presentation-export-service.js`
- `css/lai-stage13a-presentation-export.css`
- `prompt/ai-paper-to-presentation-export.txt`
- `prompt/ai-presentation-figure-asset.txt`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage13f-ai-figure-assets-for-talk-export-1`

## What this adds

The Paper → Presentation exporter can now generate figure assets before exporting.

New figure options:

- Placeholder
- AI SVG/TikZ
- Save SVG
- Save TikZ

New action:

- `Generate figures`

## Paths

Generated figure assets are written under:

```txt
figures/<deck>-fig-XX.svg
figures/<deck>-fig-XX.tikz.tex
```

HTML exports use the SVG files.

Beamer exports use the TikZ files when TikZ is selected:

```tex
\resizebox{.82\linewidth}{!}{\input{../figures/<deck>-fig-XX.tikz.tex}}
```

## Safety

AI SVG is accepted only if it is standalone `<svg>...</svg>` and has no scripts, event handlers, foreignObject, or remote resources.

AI TikZ is accepted only if it is a `\begin{tikzpicture}...\end{tikzpicture}` block and has no `\input`, `\include`, `\write18`, etc.

If AI figure generation fails, Latexai falls back to deterministic placeholder SVG/TikZ.

## Test

Included:

`tests/stage13f-ai-figure-assets-for-talk-export.test.cjs`

Run:

```bash
node tests/stage13f-ai-figure-assets-for-talk-export.test.cjs
```
