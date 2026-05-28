# Stage 19N1B — Section-aware debate targets

This stage fixes the main-editor Devil's Advocate branch runner behavior where the selected branch often targeted only `Introduction`, so real-agent edits were concentrated there even when the paper had many sections.

## What changed

- Adds a **Section scope** control to the Copilot Devil's Advocate branch runner:
  - selected branch target only
  - salient sections
  - first 6 sections
  - whole paper outline
- Extracts the active LaTeX document's section outline and section excerpts.
- Passes section-aware context to critic, advocate, synthesizer, and editor prompts.
- Overrides the selected branch/execution plan target sections on the frontend when the user chooses a broad section scope.
- Instructs the editor to produce section-labeled `\lai{...}` edits across multiple target sections instead of putting everything in the Introduction.

## Recommended test

1. Open the app with `?v=19n1b`.
2. Go to **Copilot → Devil's Advocate branch runner**.
3. Set **Debate rounds = 2**.
4. Set **Section scope = salient sections** or **first 6 sections**.
5. Use `dry_run_no_model_calls` first.
6. Then run real mode and verify the agent prompts/output mention multiple sections.
7. Prefer **append** mode for multi-section edits; it creates section-labeled visible `\lai` blocks before `\end{document}`.

## Notes

The backend branch selector may still choose a branch whose default target is `Introduction`. Stage 19N1B intentionally lets the frontend broaden the target sections before real-agent prompts are built.
