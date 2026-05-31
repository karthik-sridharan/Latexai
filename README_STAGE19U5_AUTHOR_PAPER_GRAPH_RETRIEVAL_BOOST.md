# Stage 19U5 — Author-paper graph retrieval boost (frontend)

This frontend stage displays the Stage 19U5 backend author-graph ranking signals in the existing knowledge-context preview cards.

## What changed

- Stage marker: `latex-stage19u5-author-paper-graph-retrieval-boost-20260531-1`.
- Knowledge requests now send pinned paper metadata (`title`, `authors`, `url`, `arxiv_id`) to the backend.
- The preview card header shows when `authorGraphRanking` is active.
- Existing score breakdown / why-retrieved UI now surfaces graph reasons such as:
  - author graph node match
  - shares author with pinned paper
  - coauthor neighborhood

The final edit flow is unchanged: literature context informs the agents, and source edits still go through `LATEXAI_BLOCK_PATCH` → Safe Edit Compiler → app-managed `\lai`.
