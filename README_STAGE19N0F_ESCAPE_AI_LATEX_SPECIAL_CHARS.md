# Stage 19N0F — Escape AI-generated LaTeX special characters before apply

Frontend-only fix on top of 19N0E.

## Why

The real-agent append/targeted drafts can include bibliography prose such as:

```tex
Newey, W. K., & McFadden, D.
```

A bare `&` outside an alignment/table environment causes LaTeX:

```text
Misplaced alignment tab character &
```

## Fix

Before applying or copying a branch-run draft, the frontend now sanitizes the changed/inserted region and converts unescaped `&` to `\&`. The sanitizer is scoped to the diff between the old active source and the generated draft so normal existing alignment/table content is not rewritten.

This stage keeps the 19N0E fix that moves appended `\lai{...}` suggestions before `\end{document}`.

## Test

1. Open the main app with `?v=19n0f`.
2. Run full preview.
3. Apply append or apply targeted.
4. Search the applied inserted region for `&`; author-list ampersands should appear as `\&`.
5. Compile PDF. The previous `Misplaced alignment tab character &` error should be gone.
