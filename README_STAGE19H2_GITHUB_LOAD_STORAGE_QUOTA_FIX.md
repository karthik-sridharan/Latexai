# Stage 19H2 — GitHub Load Browser Storage Quota Fix

This frontend-only hotfix prevents GitHub project loading from failing with `The quota has been exceeded` on iPad/Safari or other browsers with small `localStorage` quotas.

## Problem

Large GitHub repositories can load correctly from the GitHub backend, but then fail while the frontend tries to autosave the entire project into browser `localStorage`. The source editor may never receive the project or an alert may show:

```text
GitHub load failed:
The quota has been exceeded.
```

## Fix

- `project-store.js` now uses a compact browser autosave fallback.
- Large/binary file contents are omitted from local browser autosave, while the live in-memory project remains complete.
- `saveLocal` no longer throws quota errors during GitHub load.
- `state.js` makes the full-project guard cache best-effort and compact.
- Legacy local-storage autosave now reports skipped storage instead of throwing.

Durable storage remains GitHub: users should use **Save GitHub** or **Checkpoint** for large projects.

## No backend redeploy required

This is frontend-only.
