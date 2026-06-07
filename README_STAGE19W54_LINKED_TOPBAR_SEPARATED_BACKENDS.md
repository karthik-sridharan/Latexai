# Stage 19W54 — Chuvadi linked top bar with separated backends

This Chuvadi frontend package keeps the top-bar links to `literature.html` and `review.html`, assuming the Chuvadi editor, Literature Survey Assistant, and Review Corpus frontend pages are deployed in the same GitHub Pages folder.

Only backend separation is enforced: the Chuvadi backend package remains scoped to Chuvadi/editor routes, while the Literature Survey Assistant and Review Corpus can be deployed with their own backend services.

Changed from Stage 19W53:
- Restored top-bar `Literature Survey Assistant` link to `literature.html`.
- Restored top-bar `Review Corpus` link to `review.html`.
- Kept this Chuvadi frontend package from bundling the standalone `literature.html` and `review.html` pages.
- Left internal API names unchanged for compatibility.
