# Stage 18D — Competitive Review source-cited ranking report

Stage string: `stage18d-competitive-review-source-cited-ranking-report-1`

This stage keeps the Stage 18C web-research-agent design: competitor URLs are web-search/source-discovery seeds, not PDFs to extract.

New behavior:

- Builds a source ledger from each competitor web-research profile.
- Assigns source IDs such as `[S1]`, `[S2]`.
- Shows an evidence ledger status in the Competitive Review card.
- Sends the source ledger and evidence coverage into ranking, comparison, and roadmap prompts.
- Requires the AI to cite source IDs for substantive competitor claims.
- Saves `/reviews/...` reports with:
  - competitor web research profiles,
  - source evidence ledger,
  - evidence coverage,
  - competitor ranking prepass,
  - draft comparison prepass,
  - full report.
- Preserves Stage 17O/17N `\lai` / `\laiold` insertion and paper-level edit review integration.

No PDF extraction is introduced in this stage.
