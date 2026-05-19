# Stage 4J always-visible LAI guard

Upload/replace:

- `index.html`
- `js/lai-stage4j-lai-guard.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage4j-always-visible-lai-guard-1`

## Visible check

You should see a fixed red badge at the top-right of the page:

`LAI Guard Stage 4J active`

This badge does not depend on the Copilot panel. If you do not see it, the new
script is not being loaded by the page.

## Rewrite test

1. Select source text.
2. Choose the rewrite workflow.
3. Ask Copilot.
4. The badge should change to green:
   `Stage 4J applied \lai{...}`
5. The source should contain:

```tex
% BEGIN LAI-OLD ...
% old selected source
% END LAI-OLD ...

\lai{
new rewritten source
}
```
