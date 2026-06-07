# Stage 19N1R6 — No-op apply guard and visible edit fallback

This frontend hotfix prevents the Devil's Advocate insertion actions from silently accepting a no-op.

Fixes:
- Blocks fragment-only overwrites from replacing the full LaTeX source.
- Detects when Insert localized edits / Append final improvement plan would leave the source unchanged.
- Detects when the applied draft adds no visible `\lai` / `\laiold` edit blocks.
- If the final structured edit schema/report contains useful text but the insertion draft is a no-op, inserts a conservative visible fallback block before `\end{document}`.
- If no visible edit can be built, throws a clear error instead of pretending the apply succeeded.

Expected badge:

```text
latex-stage19n1r6-noop-apply-visible-edit-fallback-20260529-1
```
