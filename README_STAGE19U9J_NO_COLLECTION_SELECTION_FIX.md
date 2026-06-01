# Stage 19U9J — Paper AI No-Collection Selection Fix

This frontend-only patch fixes the Paper AI collection synthesis selector.

## Bug fixed

In stage 19U9I, choosing `No collection` could revert back to the default/current literature collection within the watchdog refresh cycle.

Root cause: the selector helper treated the empty string as missing and fell back to `KnowledgeContextService.selectedCollectionId(...)` or the globally selected literature collection.

## Fix

- Empty string is now treated as an explicit persisted selection meaning `No collection`.
- The per-feature selector stores the empty string when the user chooses `No collection`.
- Refresh preserves the DOM value exactly instead of replacing empty with the default collection.
- The linked Knowledge Context selector is also cleared when present.
- The service script URL was version-bumped to avoid browser cache reuse.

## Changed files

- `index.html`
- `js/collection-synthesis-paper-ai-service.js`
- `README_STAGE19U9J_NO_COLLECTION_SELECTION_FIX.md`

## Expected behavior

1. Open a Paper AI card.
2. In Literature collection context, choose `No collection`.
3. Wait several seconds.
4. The selector should remain on `No collection` and the next AI run should not attach collection synthesis context unless a collection is selected again.
