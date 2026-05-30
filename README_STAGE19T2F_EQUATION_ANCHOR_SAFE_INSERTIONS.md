# Stage 19T2F — Equation Anchor Safe Insertions

Expected frontend badge: `latex-stage19t2f-equation-anchor-safe-insertions-20260530-1`.

This stage extends the raw LaTeX block patch protocol UI/prompting.

## Main changes

- The final editor prompt now receives both safe body paragraph targets and display-equation anchor targets like `eq_003`.
- Equation anchors are clearly labeled as anchor-only: use `insert_after_block` / `insert_before_block`, never `replace_block`.
- Equation coverage mode now asks for `LATEXAI_BLOCK_PATCH_BEGIN` blocks instead of legacy `\lai` comments.
- The prompt explicitly tells the AI not to prefix explanatory text with `%`, because comment-only edits are invisible and rejected by the backend.
