# Stage 18X3 — Memory backend URL resolution fix

Fixes hidden memory writes on GitHub Pages when `compileProxyUrl` is still the default relative `/api/lumina/latex/compile` but the AI backend URL is an absolute Cloud Run URL.

The memory client now prefers the absolute AI backend URL and skips static GitHub `/api/...` relative URLs, so competitive review and reviewer/rebuttal memory POSTs reach `/api/lumina/memory` on Cloud Run/Neon.

Upload paths:
- `index.html`
- `js/competitive-paper-review-service.js`
- `js/reviewer-rebuttal-simulator-service.js`

Then open with `?v=18x3`.
