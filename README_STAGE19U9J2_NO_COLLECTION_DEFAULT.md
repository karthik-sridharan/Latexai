# Stage 19U9J2 — Paper AI No-Collection Default

This is a small frontend-only hotfix on top of Stage 19U9J.

## Goal

Paper-level AI collection synthesis controls should start with **No collection** selected by default.

Previously, when no per-feature choice had been saved yet, the Paper AI selector could inherit the standalone Literature / Knowledge Context global selected collection. That made the default appear as the current/default collection rather than explicit no-collection context.

## Behavior after this patch

- Every Paper AI collection selector starts as **No collection** when there is no saved per-feature selection.
- If the user selects a collection for a Paper AI feature, that per-feature choice is still remembered.
- If the user selects **No collection**, that explicit empty selection is still remembered and preserved across refresh/watchdog updates.
- The standalone literature page/global collection can still have its own selected/default collection; it no longer controls the initial Paper AI default.

## Changed files

- `index.html`
- `js/collection-synthesis-paper-ai-service.js`
- `README_STAGE19U9J2_NO_COLLECTION_DEFAULT.md`

## Expected stage marker

```text
latex-stage19u9j2-paper-ai-no-collection-default-20260601-1
```

## Verification

1. Replace the changed files and redeploy the frontend.
2. Open the main LatexAI editor.
3. Open a Paper AI surface with the Literature collection context panel.
4. Confirm the Project collection dropdown starts as **No collection**.
5. Select a real collection and refresh; that feature should remember the selected collection.
6. Select **No collection** and wait several seconds; it should stay on **No collection**.
