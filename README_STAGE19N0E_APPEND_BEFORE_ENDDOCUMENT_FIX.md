# Stage 19N0e — Append Before `\end{document}` Fix

Frontend-only fix for the main-editor Devil’s Advocate branch runner.

## Problem

`Apply append` could use the Stage 19M2 append draft as-is. If the backend had appended cleaned `\lai{...}` blocks after `\end{document}`, the source technically changed but LaTeX ignored the appended edits during compile.

## Fix

The frontend now normalizes append drafts before preview/copy/apply:

- Ensures Latexai red/blue `\lai`/`\laiold` macros and `xcolor` are present.
- Detects any `\lai{...}` or `\laiold{...}` after the final `\end{document}`.
- Moves those blocks to immediately before `\end{document}`.
- Shows a note when append preview was normalized.
- Applies and copies the normalized draft, not the post-`\end{document}` raw draft.

## Changed files

- `index.html`
- `js/real-agent-branch-workflow-service.js`
- `css/lai-stage19n0-real-agent-branch-workflow.css`

Open the app with `?v=19n0e` after deployment.
