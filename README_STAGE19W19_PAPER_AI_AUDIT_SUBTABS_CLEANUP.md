# Stage 19W19 — Paper AI title and Audit AI subtab cleanup

Frontend-only patch.

Marker: `latex-stage19w19-paper-ai-audit-subtabs-cleanup-20260604-1`

Changes:

- Fixes the duplicate Paper AI title. The outer Paper AI shell heading is hidden, leaving one visible `Goal-driven Paper AI` title in the unified panel.
- Stops the title from flipping between `Goal-driven Improver` and `Goal-driven Paper AI`.
- Reorganizes the Audit AI tab into explicit subtabs:
  - `Audit AI Edits`
  - `History / Comments`
- Moves `paperAiPolishCard` only into `Audit AI Edits`.
- Moves `aiCommentsCard`, `aiRevisionCard`, and `aiReportBrowserCard` only into `History / Comments`.
- Disables legacy Copilot organizer drawers for Audit AI so they cannot create empty duplicate shells or move Audit AI Edits into History/Comments.

Backend unchanged.

Validation:

- `node --check js/stage19w10-workflow-tabs-service.js`
- `node --check js/stage19w16-left-tool-tabs-service.js`
- `node --check js/right-panel-organizer-service.js`
- HTML parser smoke check for `index.html`
