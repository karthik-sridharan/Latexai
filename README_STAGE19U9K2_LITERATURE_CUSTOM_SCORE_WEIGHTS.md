# Stage 19u9k2 — Literature custom hybrid score weights

Frontend-only patch for `literature.html`.

## What changed

Adds a custom hybrid-score weighting panel to the Search / retrieve tab. Users can set weights for:

- semantic score
- lexical/title/snippet boosts
- author text boosts
- author graph / pinned-author boosts
- identifier boosts such as arXiv / DOI / URL / Semantic Scholar id
- S2 / DBLP / canonical author-key metadata signals
- other backend score components
- optional server hybrid score weight

Defaults are equal weights for normalized local components and zero for server hybrid, so the custom score starts as a transparent local linear combination rather than simply duplicating the backend rank.

## Behavior

- `Hybrid search` requests a wider backend candidate pool, up to 25 candidates.
- The frontend computes normalized component values from `semanticScore`, `scoreBreakdown`, and metadata badges.
- Results are reranked locally by the user-provided linear combination.
- The user can change weights and click `Apply weights / rerank current results` without refetching.
- Auto-apply is on by default.
- Each result card shows custom score, server hybrid score, semantic score, normalized component values, and the original backend rank.

## Changed files

- `literature.html`

## Expected stage marker

`latex-stage19u9k2-literature-custom-score-weights-20260601-1`
