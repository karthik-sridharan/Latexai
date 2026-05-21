# Stage 17N — Actionable Devil’s Advocate and Competitive Review LAI edits

Stage string: `stage17n-actionable-devils-competitive-lai-edits-1`

This stage changes Devil’s Advocate and Competitive Review insertion behavior from comment-only append blocks to visible LaTeX AI edit markup.

## Behavior

Both workflows now produce two classes of output:

1. A Markdown report/review that can still be saved under `/reviews`.
2. Actionable LaTeX suggestions that can be inserted into the paper with `\lai` / `\laiold`.

## New insertion actions

Competitive Review:

- `Insert \lai edits at matches` attempts exact-match insertion using the machine-readable `latexai_actionable_edits` JSON block or fallback `\laiold{...}\lai{...}` pairs.
- `Append \lai plan` inserts a visible high-level improvement plan before `\end{document}` in the root file, falling back to the active file if no root is found.

Devil’s Advocate:

- `Insert \lai edits at matches` does the same exact-match localized insertion for the final synthesis.
- `Append \lai plan` inserts the final plan visibly with `\lai{...}` rather than `%` comments.

## Safety rule

Localized edits are only applied when the old text or anchor is found as an exact source substring. Unmatched suggestions are skipped and can be appended as a visible plan instead.

## Prompt contract

Both workflows now ask the AI to include a fenced block labelled `latexai_actionable_edits` containing JSON of the form:

```json
{
  "actionableEdits": [
    {
      "mode": "replace",
      "path": "main.tex",
      "targetHint": "Introduction contribution paragraph",
      "oldText": "exact source substring",
      "newText": "replacement LaTeX",
      "confidence": 0.84
    }
  ],
  "appendPlan": "optional global improvement plan"
}
```
