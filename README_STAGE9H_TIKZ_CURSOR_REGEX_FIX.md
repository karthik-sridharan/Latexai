# Stage 9H: TikZ cursor regex fix

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/asset-service.js`
- `js/tikz-maker-service.js`
- `js/compiler-provider.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage9h-tikz-cursor-regex-fix-1`

## What this fixes

Direct TikZ insertion was still going to the end because the cursor memory was not
being captured reliably.

There were two causes:

1. `isDocumentRootText(...)` in `asset-service.js` had incorrectly escaped regexes.
   Stage 9H fixes it to match literal LaTeX commands like `\documentclass` and
   `\begin{document}`.

2. Cursor tracking was running too early on pointer/click events. On iPad/Safari,
   the textarea caret can update after the event handler runs. Stage 9H captures
   the caret again after 0ms, 60ms, and 180ms.

Also, TikZ insertion now remembers the cursor in any normal `.tex` source file, not
only root files, while still ignoring generated TikZ-only include files.

## Test

Included:

`tests/stage9h-tikz-cursor-regex-fix.test.cjs`

Run:

```bash
node tests/stage9h-tikz-cursor-regex-fix.test.cjs
```
