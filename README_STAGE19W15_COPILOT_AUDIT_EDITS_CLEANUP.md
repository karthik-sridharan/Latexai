# Stage 19W15 — Copilot Audit AI Edits cleanup

Marker: `latex-stage19w15-copilot-audit-edits-cleanup-20260604-1`

Frontend-only cleanup after the unified Paper AI panel.

## Changes

- Copilot tab now keeps only local editing plus the AI-edit audit/resolution workflow.
- Removed empty/noisy Copilot organizer drawers:
  - `Citations`
  - `Figures`
  - `Other Copilot controls`
- Renamed the old Copilot `Paper AI` drawer to `Audit AI Edits`.
- Renamed the old `AI edit review` card to `Audit AI Edits`.
- Clarified that this card only reviews, accepts, rejects, repairs, and cleans up `\lai` / `\laiold` edits.
- Removed literature-collection synthesis controls from the Audit AI Edits card; those controls belong to paper-improvement workflows, not the edit-audit workflow.
- Updated cache-busting for touched frontend scripts.

## Backend

Backend unchanged.

## Validation

- `node --check js/right-panel-organizer-service.js`
- `node --check js/paper-ai-polish-service.js`
- `node --check js/collection-synthesis-paper-ai-service.js`
- `node --check js/stage19w10-workflow-tabs-service.js`
- HTML parser smoke check for `index.html`

## Manual test

1. Deploy changed frontend files.
2. Hard refresh.
3. Open the Copilot tab.
4. Confirm there are no `Citations`, `Figures`, or `Other Copilot controls` drawers.
5. Confirm the old `Paper AI` drawer is now `Audit AI Edits`.
6. Confirm `Audit AI Edits` does not show literature-collection controls.
7. Confirm the Paper AI tab still shows the unified Goal-driven Paper AI panel.
