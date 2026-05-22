# Stage 17S — LaTeX-safe `\lai` insertion safety

Stage string: `stage17s-lai-insertion-safety-1`

This stage fixes two related regressions:

1. Devil's Advocate / Competitive Review could insert raw AI `newText` into `\lai{...}`. If the AI returned Markdown, unbalanced braces, preamble commands, raw underscores, raw ampersands, or code fences, previously compiling `.tex` files could stop compiling.
2. Stage 17Q made the frontend correctly reject “success without PDF,” but it could stop on a compile-job endpoint HTTP 400 before retrying the direct compile endpoint.

## Fixes

- Validate and normalize every AI actionable edit before insertion.
- Reject unsafe inline edits instead of inserting them.
- Escape common text-mode special characters in AI `newText` outside math mode.
- Reject unbalanced braces/environments and verbatim/`\verb` snippets inside `\lai` arguments.
- Reject matches in the root document preamble; visible `\lai`/`\laiold` edits are only inserted in the document body or in included section files.
- Prevent duplicate insertion inside an existing Latexai actionable edit block.
- Sanitize workflow metadata and target-hint comments so newlines or percent signs cannot leak into live LaTeX.
- Preserve append-plan behavior using Markdown-to-safe-LaTeX escaping.
- Include the Stage 17R direct-compile fallback for job endpoint HTTP 400/404/405/501 failures.

## Changed files

- `index.html`
- `js/compiler-provider.js`
- `js/compiler-provider-preload.js`
- `js/competitive-paper-review-service.js`
- `js/devils-advocate-debate-service.js`
- `tests/stage17s-lai-insertion-safety.test.cjs`

## Tests

```bash
node --check js/compiler-provider.js
node --check js/compiler-provider-preload.js
node --check js/competitive-paper-review-service.js
node --check js/devils-advocate-debate-service.js
node tests/stage17s-lai-insertion-safety.test.cjs
node tests/stage17r-compile-job-400-direct-fallback.test.cjs
```
