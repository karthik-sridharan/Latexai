# Stage 17R — Compile job 400 direct fallback

Stage string: `stage17s-lai-insertion-safety-1`

This stage fixes a regression from Stage 17Q where the frontend could stop on a compile-jobs endpoint `HTTP 400` before trying the direct compile endpoint.

## Problem

Some configured Cloud Run backends expose:

- `POST /api/lumina/latex/compile`

but do not support, or reject, the job endpoint:

- `POST /api/lumina/latex/compile/jobs`

Stage 17Q correctly rejected "success without PDF", but if `/compile/jobs` returned `HTTP 400`, the frontend surfaced only:

```txt
Compile provider error: HTTP 400
```

and did not try the direct compile endpoint.

## Fix

- Detect unsupported/failed job endpoints (`400`, `404`, `405`, `501`).
- Fall back to `compileUrl` direct compile immediately.
- Preserve the reason in `jobCompileFallbackReason`.
- If direct compile also fails, return a real failed compile result with both the job error and the direct compile error.
- Preserve detailed HTTP response body text when available.

## Changed files

- `index.html`
- `js/compiler-provider.js`
- `js/compiler-provider-preload.js`
- `tests/stage17s-lai-insertion-safety.test.cjs`

## Test commands

```bash
node --check js/compiler-provider.js
node --check js/compiler-provider-preload.js
node tests/stage17s-lai-insertion-safety.test.cjs
```
