# Stage 18H — Editor direct surface stability

Stage marker: `stage18h-editor-direct-surface-stability-1`

This stage fixes the Safari/iPad instability introduced by the live syntax-overlay editor prototype.

## Fixes

- Keeps `#sourceEditor` as the single visible/editable surface.
- Restores readable text color and Safari `-webkit-text-fill-color`.
- Disables the experimental textarea-under-overlay highlighter by default.
- Automatically disables the overlay on Safari/iPad.
- Cleans stale syntax overlay classes and stale source-selection hidden-text classes when the editor regains focus.
- Preserves shortcuts:
  - Cmd/Ctrl+B wraps selected environment name in `\begin{...}` / `\end{...}`.
  - Cmd/Ctrl+[ comments selected/current lines.
  - Cmd/Ctrl+] uncomments one level.

## Why

The previous overlay made the live textarea nearly transparent. Safari could repaint that text as dark-on-dark and leave an old selection/editor overlay after clicking the right panel, causing cursor/edit-location mismatch.

Syntax coloring should be revisited with a real editor component such as CodeMirror rather than a transparent textarea overlay.
