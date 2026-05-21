# Stage 14B: standalone compile path fixer

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/standalone-path-service.js`
- `css/lai-stage14b-path-fixer.css`

Keep Stage 14A files if not already present:

- `js/compile-root-service.js`
- `css/lai-stage14a-compile-root.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage14b-standalone-path-fixer-1`

## What this adds

Stage 14B checks/fixes relative paths inside the active standalone file before compile.

It scans:

```tex
\input{...}
\include{...}
\includegraphics{...}
\bibliography{...}
\addbibresource{...}
```

Important generated-talk fix:

```tex
\input{../figures/foo.tikz.tex}
```

inside:

```txt
talk/my-talk.beamer.tex
```

can be rewritten to:

```tex
\input{figures/foo.tikz.tex}
```

when the compiler runs from the project root.

## UI

New controls near compile settings:

```txt
Auto-fix active standalone figure/input paths before compile
Check standalone paths
Fix active standalone paths
```

## Test

Included:

`tests/stage14b-standalone-path-fixer.test.cjs`

Run:

```bash
node tests/stage14b-standalone-path-fixer.test.cjs
```
