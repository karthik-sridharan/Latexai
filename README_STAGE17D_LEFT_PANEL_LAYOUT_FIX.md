# Stage 17D: left panel layout fix

Changed files:

- `index.html`
- `css/lai-stage17d-left-panel-layout.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage17d-left-panel-layout-fix-1`

## What this fixes

The left panel Source tree and Document map cards could visually overlap, especially on iPad/Safari with many project files.

This patch:

- makes the left panel a stacked flex column;
- confines the source tree to an internal scroll area;
- keeps Add template / Download file inside the Source tree card;
- gives Document map its own fixed card space;
- lets the whole left panel scroll vertically if needed;
- uses `100dvh` for iPad/Safari viewport behavior.

No AI calls, no compile jobs, no feature flags.
