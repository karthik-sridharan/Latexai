# Stage 19U6 — External literature metadata enrichment (frontend)

Stage marker:

`latex-stage19u6-external-literature-metadata-enrichment-20260531-1`

This stage updates the knowledge preview UI to surface richer backend metadata.

## Added behavior

- Knowledge preview cards now show enriched metadata when present:
  - arXiv id,
  - DOI,
  - Semantic Scholar paper id,
  - DBLP key,
  - canonical author graph keys,
  - enrichment sources used.
- Prompt context sent to review agents includes those identifiers and canonical author keys.
- Score breakdown display includes DOI, Semantic Scholar, and author-graph boost terms.
- The safe edit protocol is unchanged: retrieved metadata only guides agents; source edits still go through `LATEXAI_BLOCK_PATCH -> Safe Edit Compiler -> app-managed \\lai`.
