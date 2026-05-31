# Latexai Frontend Stage 19T2N — Resolver Direct Editor Apply

Stage badge:

`latex-stage19t2n-resolver-direct-editor-apply-20260530-1`

## Problem fixed

After Stage 19T2M, targeted AI insertion worked and source-scanned `\lai{...}` edits were detected, but clicking **Keep red/new** or **Keep blue/old** could appear to do nothing in the visible editor. The resolver updated project state, but the active editor surface could remain stale, so the visible `\lai{...}` block stayed on screen and later scans could re-sync the stale textarea back into state.

## Fix

The resolver now applies accepted/rejected edits through a direct source update path:

1. update the canonical project file,
2. force-open the edited file when needed,
3. directly overwrite `#sourceEditor.value`,
4. dispatch an `input` event so autosave/preview hooks see the new source,
5. render the editor, and
6. force the editor value once more to prevent stale render/adapter state from restoring the old `\lai{...}` markup.

## Additional resolver cleanup

Standalone safe-compiled insertion wrappers are now resolved as one unit. For blocks like:

```tex
% --- Latexai safe compiled edit: Section ---
\lai{...}
% --- end Latexai safe compiled edit ---
```

**Keep red/new** replaces the whole wrapper with the inner text, and **Keep blue/old** removes the whole wrapper.

## Expected behavior

After deployment:

- **Refresh edits** should list standalone `\lai{...}` edits.
- **Keep red/new** should immediately remove the `\lai{...}` wrapper from the visible source and leave the AI text as normal LaTeX.
- **Keep blue/old** should immediately remove/reject a standalone insertion.
- **Keep all red/new** and **Keep all blue/old** should visibly update the source without needing manual reload.
