# Stage 19T2Z — Paper AI raw-patch contract repair

Frontend hardening for paper-level AI after the Stage 19T2W all-feature raw-patch rewiring.

Fixes:
- Removes contradictory append-only wording from the shared Document AI prompt when mode is `inplace`.
- Makes paper-level in-place workflows request concrete `LATEXAI_BLOCK_PATCH` source edits, not review notes.
- Explicitly forbids model-produced `append_review_note`; section/end-of-document changes should use `insert_before_section` or `append_before_end_document`.
- Reminds the model to split large section edits into multiple blocks and avoid preamble commands such as `\newtheorem`.
- Keeps app/backend ownership of `\lai{...}` insertion and resolver acceptance.
