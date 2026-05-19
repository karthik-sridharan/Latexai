# Stage 9E: direct TikZ insert, no PNG

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/asset-service.js`
- `js/tikz-maker-service.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage9e-direct-tikz-insert-no-png-1`

## What this fixes

TikZ is LaTeX source, not an image.

Earlier stages could allow a path like `figures/mlp.png`, then save TikZ source
inside that `.png` project file and insert:

```tex
\begin{figure}[t]
  \centering
  \input{figures/mlp.png}
  ...
\end{figure}
```

That is wrong.

Stage 9E changes the behavior:

1. The primary action is now:

```txt
Insert TikZ directly
```

which inserts the generated `tikzpicture` directly into the current `.tex` file
inside a `figure` environment.

2. `\usepackage{tikz}` is added to the root file preamble automatically.

3. If the user chooses to save TikZ as a separate file, the path is forced to
`.tex`/`.tikz`. If the user types `mlp.png`, it becomes `mlp.tex`.

4. The optional external-file action is now:

```txt
Save .tex + \input
```

and it will use `\input{figures/mlp.tex}`, not `.png`.

## Expected direct insertion

```tex
\begin{figure}[t]
  \centering
  \begin{tikzpicture}
    ...
  \end{tikzpicture}
  \caption{...}
  \label{fig:...}
\end{figure}
```

## Test

Included:

`tests/stage9e-direct-tikz-insert-no-png.test.cjs`

Run:

```bash
node tests/stage9e-direct-tikz-insert-no-png.test.cjs
```
