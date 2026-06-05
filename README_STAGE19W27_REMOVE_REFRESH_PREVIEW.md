Stage 19W27 — Remove Refresh Preview editor helper
====================================================

Frontend-only cleanup.

Changes:
- Removed the `Refresh preview` button from the editor helper toolbar.
- Kept the remaining stable editor helpers:
  - Indent
  - Outdent
  - Format selection
  - always-on auto-indent
  - environment status
- Updated stage/cache-busting marker.

Expected marker:

  latex-stage19w27-remove-refresh-preview-20260604-1

Backend unchanged.
