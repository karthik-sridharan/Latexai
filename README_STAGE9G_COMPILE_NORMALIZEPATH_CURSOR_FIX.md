# Stage 9G: compile normalizePath + direct TikZ cursor fix

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/compiler-provider.js`
- `js/asset-service.js`
- `js/tikz-maker-service.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage9g-compile-normalizepath-cursor-fix-1`

## What this fixes

### 1. Compile provider error

Stage 9F called `normalizePath(...)` in `compiler-provider.js`, but the helper was
missing. Stage 9G adds it.

### 2. Direct TikZ insert going to the end

The TikZ direct insert flow could capture a generic target that had already fallen
back to `\end{document}`. Stage 9G changes the capture path to prefer the remembered
cursor in the real root document before falling back.

It also prevents generated TikZ include files from overwriting the remembered source
cursor from `main.tex`.

## Test

Included:

`tests/stage9g-compile-normalizepath-cursor-fix.test.cjs`

Run:

```bash
node tests/stage9g-compile-normalizepath-cursor-fix.test.cjs
```
