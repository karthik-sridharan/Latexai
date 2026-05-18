# Stage 4B: auto-apply Copilot rewrite into source with \lai

Upload/replace:

- `js/copilot.js`
- `js/patch-manager.js`

Open with:

`https://karthik-sridharan.github.io/Latexai/?v=stage4b-auto-apply-lai-rewrite-1`

## What this fixes

Stage 4A generated a patch preview in the right panel, but did not automatically
edit the file. Stage 4B changes the behavior for `Rewrite selected LaTeX as patch`:

1. Select text in the source editor.
2. Choose `Rewrite selected LaTeX as patch`.
3. Ask Copilot.
4. The selected source is replaced immediately.
5. The old source is commented out.
6. The new AI source is wrapped in `\lai{...}`.

Expected source:

```tex
% BEGIN LAI-OLD id=... path=...
% old selected text
% END LAI-OLD id=...

\lai{
new AI rewrite
}
```

The `Insert text` and `Replace selection` buttons also now apply an active patch
instead of dumping raw JSON into the editor.

## Notes

- Other patch workflows still show patch review unless you press Apply.
- Rewrite-selection auto-apply still leaves the Copilot response visible as an
  applied status message.
