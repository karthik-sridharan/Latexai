# Stage 19N1N — Source-scanned LAI resolver

Frontend-only patch.

## Problem fixed

The **Resolve AI edits** refresh could miss visible `\lai{...}` or `\laiold{...}` blocks because the resolver only recognized older marker-paired rewrite blocks and effectively depended on a narrow internal representation.

## New behavior

`Refresh edits` now scans the current editable `.tex` source directly for:

- paired replacement blocks: `\laiold{old} ... \lai{new}`
- standalone inserted edits: `\lai{new}`
- standalone old-content blocks: `\laiold{old}`
- legacy marker blocks with `% BEGIN LAI-OLD ...`

The scan runs over the current project `.tex` files and first flushes the active editor text into project state, so the resolver is based on the visible source rather than stale cached state.

## Resolution semantics

- Paired `\laiold` + `\lai`:
  - Keep red/new: keep the `\lai` content as normal text.
  - Keep blue/old: keep the `\laiold` content as normal text.

- Standalone `\lai{...}`:
  - Keep red/new: keep the inserted AI text as normal text.
  - Keep blue/old: reject/remove the standalone insertion.

- Standalone `\laiold{...}`:
  - Keep blue/old: keep the old text as normal text.
  - Keep red/new: remove the old-only marker.

## Files changed

- `index.html`
- `js/document-ai-service.js`

## Test

Open:

```text
/index.html?v=19n1n
```

Then paste or generate any combination of:

```latex
\lai{Inserted text}

\laiold{Old text}
\lai{New text}
```

Go to Copilot → Paper-level AI → Resolve AI edits → Refresh edits.
The dropdown should list all unresolved source-level LAI edits with file and line numbers.
