# Stage 19N0c — Apply jump/source sync fix

Frontend-only fix for the main-editor Devil's Advocate branch runner.

## Fixes

- Apply targeted/appended LAI draft now updates the active editor through `LuminaLatex.Editor.setText` when available.
- After applying, the editor jumps to the first inserted/changed `\lai` area.
- Status now reports the approximate line where the applied draft landed.
- This makes it clear where targeted/append drafts were applied.

## Changed files

- `index.html`
- `js/real-agent-branch-workflow-service.js`
- `README_STAGE19N0C_APPLY_JUMP_SOURCE_SYNC_FIX.md`
