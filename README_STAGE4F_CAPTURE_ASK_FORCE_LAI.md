# Stage 4F: captured Ask handler that forces `\lai{...}`

Upload/replace these files:

- `index.html`
- `js/lai-rewrite-enforcer.js`

Open with:

`https://karthik-sridharan.github.io/Latexai/?v=stage4f-capture-ask-force-lai-1`

## Why this should fix it

This does not rely on the older Copilot patch path. For the workflow
`Rewrite selected LaTeX as patch`, it captures the Ask button before the old
handler runs, calls the AI proxy, and directly edits `#sourceEditor` with:

```tex
% BEGIN LAI-OLD ...
% old selected source
% END LAI-OLD ...

\lai{
new rewritten source
}
```

The Copilot panel must say `Stage 4F`. If it does not, the new file is not loaded.

## Test

1. Open the cache-busted URL above.
2. Select text in the source editor.
3. Select `Rewrite selected LaTeX as patch`.
4. Tap Ask Copilot.
5. The Copilot output should say `Stage 4F applied rewrite...`.
6. The source should contain `\lai{`.
