# Stage 4G: core rewrite path that always inserts `\lai{...}`

Upload/replace these files:

- `index.html`
- `js/project-model.js`
- `js/editor.js`
- `js/copilot.js`
- `js/patch-manager.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage4g-core-lai-rewrite-1`

This removes the overlay/enforcer approach. The normal core Copilot flow now handles
`Rewrite selected LaTeX as patch` directly and must insert:

```tex
% BEGIN LAI-OLD ...
% old selected source
% END LAI-OLD ...

\lai{
new rewritten source
}
```

Successful test: the Copilot output says `Stage 4G applied rewrite ... wrapped in \lai{...}`.
If it does not mention Stage 4G, the browser is serving old JS.
