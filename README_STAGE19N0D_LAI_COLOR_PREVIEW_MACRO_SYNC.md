# Stage 19N0d — LAI color preview + macro sync fix

Frontend-only patch on top of Stage 19N0c.

## Fixes

- Adds a visual colored LAI preview inside the main-editor Devil's Advocate branch runner.
- Explains that the editor shows raw `\lai{...}` source; colors appear in the PDF after compile.
- Ensures applied targeted/append drafts contain the Latexai color macros and `xcolor` package so `\lai{...}` renders red and `\laiold{...}` renders blue.
- Ensures `\laishowchangestrue` is active after applying a branch-run draft.
- Clarifies that `\laiold{...}` only appears for replacement old/new edits; pure insertions normally produce only `\lai{...}`.

## Changed files

- `index.html`
- `js/real-agent-branch-workflow-service.js`
- `css/lai-stage19n0-real-agent-branch-workflow.css`
