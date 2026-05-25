# Stage 19E4 — Open GitHub left-panel hard refresh

Fixes an Open GitHub workflow bug where the editor source could load the selected GitHub repository, but the left Source tree / project title / document map could remain visually stuck on the previously loaded project.

Changes:
- Adds `State.replaceProjectFromExternalSource(...)` for GitHub loads, bypassing the old full-project guard merge path that could reintroduce stale files.
- Makes Open GitHub use the exact selected repository as the complete active project.
- Forces the file tree, root file selector, active-file pill, project title, editor, and draft preview to repaint immediately and again on short delayed ticks for iPad/Safari.
- Keeps backend/API settings preserved.
- Does not require backend changes.

Deploy:
Upload the patch files preserving paths, then open with `?v=19e4`.
