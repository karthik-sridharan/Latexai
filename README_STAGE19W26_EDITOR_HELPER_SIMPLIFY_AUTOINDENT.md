# Stage 19W26 — Editor helper simplification + always-on auto-indent

Marker: `latex-stage19w26-editor-helper-simplify-autoindent-20260604-1`

Frontend-only patch.

Changes:

- Removed the visible **Format doc** button from the editor toolbar.
- Removed the visible **Auto-indent** checkbox.
- Auto-indent on Enter is now always enabled.
- Kept the stable helpers:
  - Indent
  - Outdent
  - Format selection
  - Environment status
  - Refresh preview
- Kept syntax-color overlays disabled from Stage 19W25.

Rationale:

- Whole-document formatting can be too disruptive for a main toolbar action.
- Auto-indent is useful as a default behavior and does not need visible UI.
- The editor remains textarea-based and avoids overlay highlighting.
