# Stage 19T1 — Safe Devil's Advocate LAI insertion sanitizer

Expected frontend badge:

`latex-stage19t1-safe-devils-lai-insertion-sanitizer-20260530-1`

This frontend-only hotfix fixes a bad insertion mode observed after knowledge-aware Devil's Advocate runs.

## Fixed

- Blocks generated insertion drafts that still contain source-context scaffolding such as:
  - `[important excerpt from this section]`
  - `[section ending excerpt]`
  - `[section excerpt truncated by Latexai]`
  - `BEGIN LAI-ACTIONABLE-EDIT` / `END LAI-ACTIONABLE-EDIT`
- Decodes double-escaped AI newline sequences in generated edit fragments so literal `\n` is not inserted as LaTeX source.
- Drops structured edit objects that copied prompt excerpts instead of producing paper-ready text.
- Tightens the final editor prompt to forbid excerpt placeholders and literal backslash-n text in `latex` / `oldLatex` fields.
- Keeps the Stage 19T knowledge-aware retriever integration unchanged.

## Test

1. Deploy this frontend.
2. Reload the original paper source.
3. Run Devil's Advocate with knowledge retriever enabled.
4. Preview insertion.
5. Confirm no preview contains `[important excerpt ...]`, `[section ending ...]`, or literal `\n` source text.
6. Insert localized edits.
7. Compile PDF.

If the model still produces copied excerpt placeholders, the frontend blocks insertion and asks you to rerun instead of corrupting the source.
