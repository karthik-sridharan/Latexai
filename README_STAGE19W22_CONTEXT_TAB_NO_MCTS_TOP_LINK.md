# Stage 19W22 — Context tab rename and top-link cleanup

Marker: `latex-stage19w22-context-tab-no-mcts-top-link-20260604-1`

Frontend-only cleanup.

Changes:
- Renamed the left tab from `Context / MCTS` to `Context`.
- Renamed the internal header for that tool area to `Context` / `Block context and planning`.
- Removed the top-bar `MCTS Lab` button because top-bar sister-app links should only open separate HTML applications.
- Kept the underlying context/search/MCTS-lite machinery mounted in the Context tab.

Backend unchanged.
