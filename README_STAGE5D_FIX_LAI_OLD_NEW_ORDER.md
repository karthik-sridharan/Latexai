# Stage 5D: fix old/new order in \lai rewrite

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/lai-stage4l-lai-guard.js`
- `js/lai-stage4m-compile-safe-lai.js`
- `js/lai-stage5c-preview-selection-bridge.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage5d-fix-lai-old-new-order-1`

## What this fixes

In some preview-selection flows, the old Copilot/editor path already replaced the
source before the LAI guard ran. The guard then sometimes used stale Copilot panel
text and could reverse the blocks.

Stage 5D makes the editor diff authoritative:

- commented `LAI-OLD` block = the pre-Copilot selected source
- `\lai{...}` block = the newly inserted Copilot rewrite

Expected:

```tex
% BEGIN LAI-OLD ...
% old/original source
% END LAI-OLD ...

\lai{
new Copilot rewrite
}
```

## Existing already-inverted blocks

This fixes future rewrites. If you have an already-inverted block, manually swap
the commented text and the `\lai{...}` body once, or ask me for a repair tool next.
