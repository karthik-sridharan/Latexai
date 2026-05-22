# Stage 17Q — Compile PDF result guard

Stage string: `stage17q-compile-pdf-result-guard-1`

This stage fixes a compile-path regression where the frontend treated a backend/job response as successful even when no PDF payload was returned.

## Fixes

- Keeps `compileStatusUrl` synchronized with `compileUrl` when the compile URL changes.
- Repairs stale localStorage settings where `compileUrl` points at one Cloud Run backend but `compileStatusUrl` still points at an older backend.
- Recognizes `status: "succeeded"` as a terminal compile status.
- If a job endpoint reports success without a PDF, retries the direct compile endpoint.
- If both job and direct endpoints complete without a PDF, marks the compile as failed instead of showing `succeeded`.
- The preview layer now accepts multiple PDF payload shapes: `pdfBase64`, `pdfBytesBase64`, data URL, `pdfUrl`, `pdfBlobUrl`, or `outputUrl`.

## Changed files

- `index.html`
- `js/compiler-provider.js`
- `js/compiler-provider-preload.js`
- `js/preview.js`
- `tests/stage17q-compile-pdf-result-guard.test.cjs`

## Tests

```bash
node --check js/compiler-provider.js
node --check js/compiler-provider-preload.js
node --check js/preview.js
node tests/stage17q-compile-pdf-result-guard.test.cjs
```
