# Stage 19U9K — Paper AI collection context wiring

Frontend-only stage.

## Stage marker

`latex-stage19u9k-paper-ai-collection-context-wiring-20260601-1`

## Goal

Make selected literature collections affect the actual Paper AI calls, not just the UI preview / side synthesis panel.

## What changed

- `collection-synthesis-paper-ai-service.js` now patches `LuminaLatex.AIProvider.ask`.
- For supported paper-level workflows, the patch detects the active feature from the AI call metadata:
  - Paper-level AI / Document AI
  - Competitive review / improvement
  - Reviewer / rebuttal simulator
  - Devil's advocate debate
  - Branch workflow runner
  - Citation AI
  - Paper AI polish, when present
- If that feature has a selected collection, the AI payload receives a bounded collection context block containing:
  - collection id/name
  - feature label
  - synthesis mode
  - feature-specific focus prompt
  - paper titles, authors, years, URLs/ids where available
  - abstract/snippet evidence where stored
- If the user generated an attached synthesis for the feature, that synthesis is included too.
- If the feature is set to `No collection`, no collection context is injected.
- Stale prior synthesis is no longer restored/injected when the selector is `No collection`.
- The older Knowledge/literature selector and the newer Literature collection context selector are synchronized so either selector controls the run context.

## Files changed

- `index.html`
- `js/collection-synthesis-paper-ai-service.js`
- `js/knowledge-context-service.js`

## Verification checklist

1. Deploy frontend and confirm the stage marker contains `stage19u9k`.
2. Open Paper-level AI.
3. Leave collection as `No collection`; run Paper AI. No selected collection block should be injected.
4. Select a populated collection.
5. Run Paper AI without pressing `Generate for this feature`.
6. The AI request should still receive the selected collection paper records.
7. Optionally click `Generate for this feature`; keep `Attach generated synthesis` checked; run again.
8. The AI request should receive both the generated synthesis and the collection paper records.
9. Switch back to `No collection`; run again. No stale collection synthesis should be injected.
