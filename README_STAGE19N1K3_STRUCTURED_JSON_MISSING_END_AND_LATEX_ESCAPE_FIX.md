# Stage 19N1K3 — Structured JSON Missing-END Marker + LaTeX Escape Repair

Frontend-only hotfix for the Devil's Advocate structured editor output workflow.

## Problem

The final editor sometimes returned a structured block beginning with:

```text
LATEXAI_STRUCTURED_EDIT_JSON_BEGIN
{
  "ok": true,
  "editMode": "mixed",
  "edits": [...]
}
```

but either omitted `LATEXAI_STRUCTURED_EDIT_JSON_END` or used raw LaTeX backslashes inside JSON strings. The UI then showed `blocks=0` / no usable structured edits even though the raw final editor output visibly contained JSON.

## Fixes

- Accepts `LATEXAI_STRUCTURED_EDIT_JSON_BEGIN` even if the end marker is missing, as long as a complete JSON object follows it.
- Extracts JSON objects more robustly around `edits`, `sectionEdits`, `equationEdits`, `patches`, `items`, and root-array outputs.
- Adds a loose JSON repair pass for common model mistakes:
  - raw LaTeX backslashes in JSON strings, such as `\theta`, `\psi`, `\[`;
  - trailing commas before `}` or `]`;
  - smart quotes.
- Keeps blocking insertion if no complete parseable edit schema exists, instead of guessing from prose.
- Updates the editor prompt file to explicitly require valid JSON and double-escaped LaTeX backslashes.

## Changed files

```text
js/real-agent-branch-workflow-service.js
prompt/devils-advocate-branch-runner/editor.txt
README_STAGE19N1K3_STRUCTURED_JSON_MISSING_END_AND_LATEX_ESCAPE_FIX.md
```

## Test

Open:

```text
/index.html?laiPromptDebug=1&v=19n1k3
```

Run the Devil's Advocate branch workflow with the structured schema enabled. If the final editor output contains `LATEXAI_STRUCTURED_EDIT_JSON_BEGIN` and a complete JSON object, the structured edit preview should parse and show edit rows instead of `blocks=0`.
