# Stage 19T2D — Body-only Safe Edit Targets

Expected frontend stage: `latex-stage19t2d-body-only-safe-edit-targets-20260530-1`.

The Devil's Advocate final editor now sees a safe body-prose target map rather than full raw source/preamble. Preamble, macro definitions, theorem declarations, bibliography setup, command-heavy blocks, and environment boundaries are hidden from the edit proposal prompt. The frontend remains a client of the generic Safe Edit Compiler API so the same module can later be reused by Rewrite, Improve, Competitive Review, Citation AI, and MCTS edit workflows.
