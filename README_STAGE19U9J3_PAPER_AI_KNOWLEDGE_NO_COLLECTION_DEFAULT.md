# Stage 19U9J3 — Paper-level AI Knowledge Selector No-Collection Default

This frontend-only hotfix addresses the remaining card-specific default behavior in the Paper-level AI card.

## Problem

Stage 19U9J2 changed the new Collection Synthesis selector so Paper AI collection synthesis starts at **No collection**. However, the Paper-level AI card also mounts the older `KnowledgeContextService` control surface. That control surface used the global Literature page selected collection as a fallback, so the Paper-level AI card could still start with a concrete collection selected even when the synthesis selector defaulted to **No collection**.

## Fix

`js/knowledge-context-service.js` now treats an empty collection selection as an explicit value and defaults Paper AI knowledge-context collection selectors to **No collection** instead of falling back to `latexai:literature-selected-collection:v1`.

The collection synthesis service is left compatible with the existing behavior: selecting **No collection** in the synthesis selector also clears the linked knowledge selector when present.

## Changed files

- `index.html`
- `js/knowledge-context-service.js`
- `js/collection-synthesis-paper-ai-service.js`
- `README_STAGE19U9J3_PAPER_AI_KNOWLEDGE_NO_COLLECTION_DEFAULT.md`

## Expected stage marker

```text
latex-stage19u9j3-paper-ai-knowledge-no-collection-default-20260601-1
```

## Verification

1. Redeploy the frontend.
2. Open the main LatexAI editor.
3. Open the Paper-level AI card.
4. Confirm both collection-related dropdowns start as **No collection**:
   - Knowledge/literature context Project collection
   - Literature collection context Project collection
5. Wait several seconds for watchdog refreshes. Both should remain **No collection**.
6. Manually pick a collection; refresh/reopen and confirm the manual choice persists.
7. Manually switch back to **No collection**; confirm it persists and does not fall back to the Literature page global collection.
