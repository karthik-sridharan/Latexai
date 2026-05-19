# Stage 4D: direct \lai rewrite path

Upload/replace:

- `js/copilot.js`
- `js/patch-manager.js`

Open with:

`https://karthik-sridharan.github.io/Latexai/?v=stage4d-direct-lai-rewrite-1`

## What this fixes

Stage 4C still allowed some rewrite flows to apply through the editor's ordinary
replace-selection path. That changed the source but did not insert `\lai{...}`.

Stage 4D bypasses the generic patch path for:

`Rewrite selected LaTeX as patch`

and directly applies the selected source rewrite with:

```tex
% BEGIN LAI-OLD ...
% old selected source
% END LAI-OLD ...

\lai{
new rewritten source
}
```

## Test

1. Select source text in the editor.
2. Choose `Rewrite selected LaTeX as patch`.
3. Ask Copilot.
4. The Copilot panel should say `Stage 4D`.
5. The actual source should contain `\lai{`.

If the source changes but still does not contain `\lai{`, the browser is serving
old cached JS. Use the cache-busting URL above and confirm the Copilot message says
`Stage 4D`.
