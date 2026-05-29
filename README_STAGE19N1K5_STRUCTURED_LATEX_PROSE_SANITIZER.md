# Stage 19N1K5 — Structured LaTeX Prose Sanitizer

Frontend-only hotfix after Stage 19N1K4.

## Problem

Structured editor JSON was recovered and inserted, but equation-explanation prose could contain raw text identifiers such as `eq_025`. In LaTeX text mode, the underscore causes compile errors like `Missing $ inserted`.

## Fix

- Adds a structured-output sanitizer before converting JSON edits into `\lai{...}` blocks.
- Escapes unescaped underscores outside math mode and outside comments.
- Leaves `$...$`, `\(...\)`, `\[...\]`, and display-math content untouched.
- Keeps earlier Stage 19N1K4 JSON salvage behavior.
- Updates the editor prompt to avoid raw equation ids / raw underscore identifiers in paper text.

## Test

Open:

```text
/index.html?laiPromptDebug=1&v=19n1k5
```

Run the equation-explanation workflow, then compile. Raw `eq_025`-style text should become `eq\_025` inside inserted `\lai` prose and should not trigger `Missing $ inserted`.
