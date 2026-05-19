# Stage 4H: simple hard `\lai{...}` rewrite

Upload/replace:

- `index.html`
- `js/project-model.js`
- `js/editor.js`
- `js/copilot.js`
- `js/patch-manager.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage4h-simple-hard-lai-rewrite-1`

This adds a direct core editor method `applyLaiRewriteFromSelection` and forces both the rewrite workflow and the Replace selection button to use it. The selected source is replaced with commented old source plus `\lai{...}`. The root macro is also added automatically.

If the Copilot output does not say `Stage 4H`, the new JS did not load.
