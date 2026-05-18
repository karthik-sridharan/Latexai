# Stage 4C: force \lai wrapping for rewrite-selection

Upload/replace:

- `js/copilot.js`
- `js/patch-manager.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage4c-force-lai-rewrite-1`

## Fix

Stage 4B applied the rewrite, but some AI responses/buttons could still be
normalized as ordinary replacement patches, so the source changed without
`\lai{...}`.

Stage 4C forces `\lai{...}` wrapping for every `Rewrite selected LaTeX as patch`
application path, including parsed JSON patches, fallback patches, and the
Insert/Replace buttons when an active rewrite patch exists.

Expected source after rewrite:

```tex
% BEGIN LAI-OLD id=... path=...
% old selected text
% END LAI-OLD id=...

\lai{
new rewritten text
}
```

You should see the Copilot status mention `Stage 4C` after auto-apply.
