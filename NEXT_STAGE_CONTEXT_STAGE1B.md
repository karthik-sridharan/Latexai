# Next stage context — Stage 1C

Stage 1B deliberately avoided adding flashy UI features. It created the architectural seams needed to avoid a migration later.

Recommended Stage 1C goal: **Production compile pipeline**.

Suggested tasks:

1. Move compile logic from `backend/server.mjs` into `backend/providers/compile-texlive.mjs`.
2. Add `POST /api/lumina/latex/compile/jobs` that returns a real `compileJobId`.
3. Add `GET /api/lumina/latex/compile/jobs/:jobId` for status/result polling.
4. Add streaming progress over WebSocket or SSE using the reserved sync/compile contracts.
5. Improve sandbox policy: per-job workspace, timeout, file size limits, no shell escape by default, output whitelist.
6. Add robust TeX log parser with click-to-line diagnostics.
7. Add true binary asset import/export for images and PDFs.
8. Keep the frontend compile call inside `js/compiler-provider.js`.

Do not bypass the provider interfaces in future stages.
