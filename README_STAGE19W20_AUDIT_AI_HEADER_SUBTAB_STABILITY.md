# Stage 19W20 — Audit AI header + subtab stability

Marker: `latex-stage19w20-audit-ai-header-subtab-stability-20260604-1`

Frontend-only hotfix.

Changes:

- Stabilizes the Audit AI tab heading so it no longer flips back to the old `AI Copilot / Local editing assistant` label.
- Updates the initial Audit AI panel heading in `index.html`.
- Updates the workflow-tab normalizer so it preserves `Audit AI` instead of rewriting the heading on refresh ticks.
- Adds an Audit AI card router that keeps:
  - `paperAiPolishCard` under `Audit AI Edits`
  - `aiCommentsCard`, `aiRevisionCard`, and `aiReportBrowserCard` under `History / Comments`
- Adds a MutationObserver plus delayed routing passes so cards created late by feature services are moved into the correct Audit AI subtab.

Validation:

- `node --check js/stage19w10-workflow-tabs-service.js`
- `node --check js/stage19w16-left-tool-tabs-service.js`
- `node --check js/right-panel-organizer-service.js`
- HTML parser smoke check for `index.html`
