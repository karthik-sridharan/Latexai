# Stage 17X — Compile log diagnostics surfacing

Stage string: `stage17x-compile-log-diagnostics-surfacing-1`

This stage fixes the remaining compile-debuggability issue after Stage 17W. The frontend was correctly detecting failed LaTeX jobs, but it still surfaced a generic status such as `Compile finished with diagnostics` and the copied boot report often showed `lastProblemCount: 0`.

## Changes

- Consolidates compile logs from nested backend result fields (`log`, `stdout`, `stderr`, `output`, `compileLog`, `buildLog`, `detail`, etc.).
- Parses TeX diagnostics from `-file-line-error` style lines such as `main.tex:42: Undefined control sequence`.
- Parses classic TeX errors beginning with `!` and nearby `l.<line>` source hints.
- Replaces generic failed compile messages with the first concrete LaTeX error when available.
- The Preview compile path now stores the full compile log in the Logs tab instead of only a generic status message.
- App diagnostics now include `lastProblems` and `compileLogTail`, so copied reports contain enough information to debug bad AI insertions.

## Files changed

- `index.html`
- `js/compiler-provider.js`
- `js/compiler-provider-preload.js`
- `js/preview.js`
- `js/diagnostics.js`
- `tests/stage17x-compile-log-diagnostics-surfacing.test.cjs`

## Tests

```bash
node --check js/compiler-provider.js
node --check js/compiler-provider-preload.js
node --check js/preview.js
node --check js/diagnostics.js
node tests/stage17x-compile-log-diagnostics-surfacing.test.cjs
```
