# Stage 19N1R7 — Accept LAI without duplicate sections

Frontend-only hotfix for Devil's Advocate localized edits.

## Problem fixed

Devil's Advocate could correctly insert visible `\laiold{...}` / `\lai{...}` edits, but when the user accepted all new LAI edits, the resolved source could contain duplicated sections. The root cause was that section-level replacement suggestions were sometimes inserted additively near a section header instead of wrapping/replacing the actual old text in place. After acceptance, the original section remained and the accepted regenerated section appeared as a second copy.

## Changes

- Replacement-style Devil's Advocate edits now try to locate `oldLatex` in the current source and wrap that exact old text in place.
- If a generated `\lai{...}` body begins with a duplicate `\section{...}`/`\subsection{...}` heading matching the target section, the heading is stripped before localized insertion.
- The paper AI accept-all resolver also strips a leading duplicate section heading from accepted new text when resolving inside that same section.
- Full-document safety guards from Stage 19N1R5/R6 remain in place.

## Expected behavior

For an inserted edit like:

```tex
\laiold{Our method is simple and works well.}\lai{Our method is simple, but its novelty should be stated through an explicit comparison to the baseline setting.}
```

Accept all should produce only the new text, not both old and new and not a duplicated section.

## Badge

```text
latex-stage19n1r7-accept-lai-no-duplicate-sections-20260529-1
```
