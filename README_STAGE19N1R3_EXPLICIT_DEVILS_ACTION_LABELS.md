# Stage 19N1R3 — Explicit Devil’s Advocate action labels

Frontend-only hotfix.

## Problem
The UI used short implementation labels (`Apply targeted`, `Apply append`) while the testing instructions referred to the user-facing actions as `Insert localized edits` and `Append final improvement plan`. This made it look like the actions were missing.

## Fix
- Renames `Apply targeted` to `Insert localized edits`.
- Renames `Apply append` to `Append final improvement plan`.
- Renames `Copy targeted` to `Copy localized edits`.
- Adds an action-map note above the buttons explaining which action inserts targeted `\laiold`/`\lai` edits and which appends the final improvement plan before `\end{document}`.
- Updates the stage badge.

Expected badge:

```text
latex-stage19n1r3-explicit-devils-action-labels-20260529-1
```

No backend redeploy required.
