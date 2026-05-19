# Stage 4E: editor-level forced `\lai{...}` guard

Upload/replace:

- `index.html`
- `js/editor.js`
- `js/copilot.js`
- `js/patch-manager.js`

Open with:

`https://karthik-sridharan.github.io/Latexai/?v=stage4e-editor-forced-lai-guard-1`

## Why this fixes the persistent no-`\lai` issue

Earlier fixes applied `\lai{...}` in the Copilot/PatchManager path. Your app was
still sometimes applying the rewrite through the ordinary editor replace path.
That changes the selected source but bypasses the patch wrapper.

Stage 4E adds a lowest-level guard in `editor.js`:

- If the current Copilot task is `Rewrite selected LaTeX as patch`, and
- a nonempty editor selection is being replaced, then
- the editor itself transforms the replacement into:

```tex
% BEGIN LAI-OLD id=... path=...
% old selected source
% END LAI-OLD id=...

\lai{
new rewritten source
}
```

This means even if the Copilot result falls through to `Editor.replaceSelection`
or `Editor.replaceRange`, the source should still get `\lai{...}`.

## Test

1. Select source text.
2. Choose `Rewrite selected LaTeX as patch`.
3. Ask Copilot.
4. The source should contain `\lai{`.

If it still does not, check that the loaded URL is the Stage 4E cache-busting URL
and that `index.html` was replaced too.
