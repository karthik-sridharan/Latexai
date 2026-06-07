# Stage 19T2E — Raw LaTeX Block Patch Protocol Frontend

Expected frontend stage: `latex-stage19t2f-equation-anchor-safe-insertions-20260530-1`.

The Devil's Advocate editor prompt now asks for raw LaTeX patch blocks rather than JSON strings containing LaTeX. This preserves backslashes in equations/theorems and lets the backend deterministically wrap/validate the edits before apply.

The frontend parser recognizes raw patch blocks for preview, but source changes are still gated by the backend Safe Edit Compiler.
