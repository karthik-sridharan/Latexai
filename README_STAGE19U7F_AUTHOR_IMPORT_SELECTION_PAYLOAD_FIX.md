# Stage 19U7F — Author import selection payload fix

Fixes literature.html author import selection.

Changes:
- `Import selected` now sends selected paper objects with `selected:true`.
- It also sends `selectedPaperIds` so the backend can filter explicitly.
- Stage marker updated to `latex-stage19u7f-author-import-selection-payload-fix-20260531-1`.
