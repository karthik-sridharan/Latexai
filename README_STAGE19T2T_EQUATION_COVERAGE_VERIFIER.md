# Stage 19T2T — Equation coverage verifier

Stage string:

`latex-stage19t2t-equation-coverage-verifier-20260530-1`

This frontend stabilization stage fixes the failure where a Focus/query such as `explain every equation` could generate only an introduction or appendix edit while the audit panel correctly reported `0/N` equation-anchor patches.

## Changes

- Treats math/equation coverage as a binding explicit user request, not merely a prompt hint.
- The final editor prompt now requires one `OPERATION: insert_after_block` raw patch per listed equation id when equation coverage mode is active.
- The synthesizer handoff must preserve equation coverage as an independent request.
- The post-editor coverage verifier now checks missing equation ids in addition to missing named sections and appendices.
- If equation ids are missing, the verifier calls the configured synthesis model to produce only the missing equation raw patch blocks.
- The coverage audit now reports `matched/expected` equation-anchor patches and fails unless all detected target equations are covered.

## Expected behavior

For a whole-paper request like:

`Explain every equation right under it.`

Final Synthesis should include patches like:

```text
LATEXAI_BLOCK_PATCH_BEGIN
PATCH_ID: eq-explain-1
OPERATION: insert_after_block
TARGET_BLOCK_ID: eq_001
TARGET_SECTION: Least Squares
BEGIN_NEW_LATEX
...
END_NEW_LATEX
LATEXAI_BLOCK_PATCH_END
```

and the audit should report `N/N equation-anchor patch(es)`.
