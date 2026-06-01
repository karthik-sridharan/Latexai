# Stage 19U9I — Paper AI collection synthesis integration

This stage moves collection synthesis out of the standalone `literature.html` ingestion/search page and into the main LatexAI editor.

## Changed files

- `index.html`
  - Updates the frontend stage marker.
  - Loads `js/collection-synthesis-paper-ai-service.js` after `knowledge-context-service.js`.

- `js/collection-synthesis-paper-ai-service.js`
  - Adds a **Literature collection context** mini-panel inside paper-level AI feature cards.
  - Supports feature-local collection selection, synthesis mode, prompt/focus text, copy report, copy `\lai`, and append `\lai` to the current paper.
  - Can attach the generated synthesis to the next knowledge-aware AI prompt for that feature.
  - Uses the existing backend route `POST /api/lumina/research/collections/{collection_id}/synthesize`.

- `literature.html`
  - Keeps collection creation, search, bulk import, and curation.
  - Removes the visible standalone collection-synthesis controls, because synthesis is now part of LatexAI Paper AI workflows.

## Expected behavior

1. Use `literature.html` to create/populate a collection.
2. Return to `index.html`.
3. Open a Paper AI feature such as Paper-level AI, Competitive Review, or Reviewer/Rebuttal.
4. In that feature card, use **Literature collection context** to select the collection.
5. Click **Generate for this feature**.
6. Use the synthesis as a copied report, copied `\lai` block, appended `\lai` block, or attached context for the next AI run.

## Backend

No new backend route is required beyond Stage 19U9H. This frontend patch consumes the existing collection synthesis endpoint.
