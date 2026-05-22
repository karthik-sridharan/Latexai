# Stage 17W — Compile result shape preservation

Stage string: `stage17w-compile-result-shape-preserve-errors-1`

This stage fixes a compile-result interpretation bug introduced by the missing-PDF guard stages.

## Root cause

The Cloud Run job endpoint returns a wrapper object like:

```json
{
  "ok": true,
  "status": "completed",
  "jobId": "latex-...",
  "result": {
    "ok": false,
    "success": false,
    "status": "failed",
    "log": "! Undefined control sequence..."
  }
}
```

The wrapper `ok: true` means the job API request completed, not that TeX compiled successfully. Previous frontend stages allowed the wrapper status to overwrite the nested TeX result, so failed LaTeX compiles were reported as "completed without returning a PDF".

## Fixes

- Nested `result` now owns TeX success/failure state.
- Wrapper `jobId`, `progress`, and job status are retained only as diagnostics.
- Failed TeX results are returned immediately with their `log`, `stderr`, `exitCode`, and `problems` intact.
- Direct fallback failures preserve the actual LaTeX error instead of being replaced by a missing-PDF message.
- Raw PDF responses from direct endpoints are accepted when a backend returns `application/pdf` directly.

## Changed files

- `index.html`
- `js/compiler-provider.js`
- `js/compiler-provider-preload.js`
- `tests/stage17w-compile-result-shape-preserve-errors.test.cjs`

## Tests

```bash
node --check js/compiler-provider.js
node --check js/compiler-provider-preload.js
node tests/stage17w-compile-result-shape-preserve-errors.test.cjs
```
