# Stage 19N1K4 — Structured JSON Partial Salvage + LaTeX Command Escape Fix

Frontend-only hotfix for the Devil's Advocate branch runner structured editor output.

## Problem fixed

Stage 19N1K3 could still report:

- `No structured editor JSON was parsed`
- `blocks=0`

while the final editor output visibly began with:

```text
LATEXAI_STRUCTURED_EDIT_JSON_BEGIN
{
  "ok": true,
  "edits": [ ...
```

This happened when the model produced partial/truncated structured JSON, omitted the end marker, or used raw LaTeX commands such as `\theta`, `\text`, `\begin`, `\[`, or `\(` inside JSON strings.

## Changes

- Upgrades the stage marker to `stage19n1k4-jsonish-salvage-latex-command-escape-20260529-1`.
- Repairs LaTeX command backslashes more carefully inside JSON strings.
- Treats `\theta`, `\text`, `\tfrac`, `\begin`, `\Theta`, `\[`, and `\(` as LaTeX commands, not JSON control escapes.
- If the root JSON object is incomplete, scans the final editor output for complete individual edit objects inside the `edits` array.
- Salvages those complete edit objects rather than blocking insertion.
- Adds clearer warnings when object-level salvage is used.
- Updates the editor prompt to emphasize compact, complete JSON and no literal unescaped line breaks inside JSON strings.

## Deploy / test

Open with:

```text
/index.html?laiPromptDebug=1&v=19n1k4
```

Run the Devil's Advocate branch workflow again. If the final editor output starts with the structured JSON marker and contains at least one complete edit object, the structured preview should now show usable edits rather than `blocks=0`.
