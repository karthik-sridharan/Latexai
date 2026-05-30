# Stage 19T2A — Safe Edit Compiler blocked-state UI

Expected frontend stage: `latex-stage19t2a-safe-edit-compiler-blocked-ui-20260530-1`.

This patch keeps Stage 19T2's deterministic Safe Edit Compiler but improves the blocked-edit path:

- `prepare-lai-insertion` responses with `ok:false` are now rendered as a normal blocked validation report instead of a raw red JSON blob.
- Unsafe compiler responses disable localized/apply/copy buttons.
- The UI clearly states that no source changes were made.
- Full-source drafts from rejected proposals are not rendered as visual LAI previews.

This is intended fail-closed behavior: invalid AI edit proposals are rejected before insertion.
