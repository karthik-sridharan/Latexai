# Stage 19N1R5 — Safe Devil’s Advocate apply/insertion guard

This frontend-only hotfix protects the Devil’s Advocate **Insert localized edits** / **Append final improvement plan** actions from replacing `main.tex` with a fragment-only LAI preview.

## Fixes

- Detects whether the active source is a complete LaTeX document.
- Detects whether the insertion draft is only a fragment.
- If the draft is a fragment, reconstructs a complete document by inserting the LAI blocks into the existing active source.
- Blocks unsafe applies that would remove `\documentclass`, `\begin{document}`, or `\end{document}`.
- Blocks applies that would put `\usepackage` before `\documentclass`.
- Changes the confirmation text so the action is not described as blindly replacing the source.

Expected badge:

```text
latex-stage19n1r5-safe-devils-apply-insertion-guard-20260529-1
```

No backend redeploy is needed.
