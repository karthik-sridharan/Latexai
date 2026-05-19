# Stage 4I hard LAI guard

Upload/replace:

- `index.html`
- `js/lai-stage4i-lai-guard.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage4i-hard-lai-guard-1`

## Visible check

In the Copilot panel you should see a red badge:

`LAI Guard Stage 4I active`

If you do not see that badge, the new index/script did not load.

## What this does

This is a hard guard around the editor and Copilot output. For the workflow:

`Rewrite selected LaTeX as patch`

it captures the selected source before Copilot runs. If any path changes the source
without `\lai{...}`, the guard rewrites that change into:

```tex
% BEGIN LAI-OLD id=... path=...
% old selected source
% END LAI-OLD id=...

\lai{
new rewritten source
}
```

It also adds the `\lai` macro and `xcolor` to the root file when possible.

## Test

1. Select source text in the editor.
2. Choose `Rewrite selected LaTeX as patch`.
3. Ask Copilot.
4. Confirm the red badge is visible.
5. The Copilot output should say `Stage 4I applied with \lai{...}`.
6. The source should contain both `BEGIN LAI-OLD` and `\lai{`.
