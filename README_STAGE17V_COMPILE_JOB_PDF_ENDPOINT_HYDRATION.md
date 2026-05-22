# Stage 17V — Compile job PDF endpoint hydration

Stage string: `stage17v-compile-job-pdf-endpoint-hydration-1`

This stage fixes the case where the LaTeX backend reports a compile job as completed/succeeded but does not inline a `pdfBase64`, `pdfBytesBase64`, or PDF data URL in the JSON response.

## Root cause

Some compile backends may keep the PDF behind the job endpoint instead of returning it inline, for example:

```text
POST /api/lumina/latex/compile/jobs -> { status: "completed", jobId: "..." }
GET  /api/lumina/latex/compile/jobs/:jobId/pdf -> application/pdf
```

Stage 17Q/17T correctly rejected “success with no PDF payload,” but it did not try this `/pdf` artifact endpoint before failing.

## Fix

The compiler provider now:

- recognizes nested PDF fields, including `artifacts.pdf.base64`-style payloads,
- if a successful job result has no inline PDF but has a `jobId`, fetches `/compile/jobs/{jobId}/pdf`,
- converts that raw PDF response into a previewable blob URL or base64 payload,
- preserves the Stage 17T endpoint repair behavior,
- keeps the Stage 17U right-panel horizontal review scroll behavior,
- only treats a missing PDF as failure after trying inline fields, nested fields, URL fields, and the job PDF endpoint.

## Changed files

- `index.html`
- `js/compiler-provider.js`
- `js/compiler-provider-preload.js`
- `tests/stage17v-compile-job-pdf-endpoint-hydration.test.cjs`
