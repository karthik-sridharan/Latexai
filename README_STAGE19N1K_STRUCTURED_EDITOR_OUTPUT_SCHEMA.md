# Stage 19N1K — Structured Editor Output Schema

Frontend-only stage.

## Goal

The Devil's Advocate editor agent now returns a structured JSON edit plan before any optional `\\lai` mirror blocks. The frontend parses and validates this schema, previews it as a table, and uses it as the preferred source of insertions.

## Why

Earlier stages relied on scraping `\\lai{...}` from free-form model output. That was fragile because critic/advocate/synthesizer prose, repeated advice, or missing target labels could be accidentally inserted. Stage 19N1K makes the final editor output machine-readable first.

## New schema

The editor prompt asks for:

```text
LATEXAI_STRUCTURED_EDIT_JSON_BEGIN
{
  "ok": true,
  "editMode": "section_coverage | equation_coverage | mixed",
  "edits": [
    {
      "targetType": "section | equation",
      "targetId": "eq_001 or empty string",
      "targetSection": "exact section/unit title",
      "action": "insert_after | insert_before | replace | no_edit | append",
      "oldLatex": "short exact old text for replace actions",
      "latex": "LaTeX-ready paper text without outer \\lai wrapper",
      "note": "short internal note"
    }
  ],
  "warnings": []
}
LATEXAI_STRUCTURED_EDIT_JSON_END
```

## Frontend behavior

1. Parse structured JSON from the final editor output.
2. Show a structured edit preview table in the result and insertion preview.
3. Convert schema edits into safe `\\lai` / `\\laiold` blocks.
4. Prefer structured edits over legacy free-form `\\lai` scraping.
5. Fall back to legacy `\\lai` extraction only if JSON is missing or invalid.

## Test URL

```text
/index.html?v=19n1k
```

For prompt debugging:

```text
/index.html?laiPromptDebug=1&v=19n1k
```

## Recommended test

Use query:

```text
Explain all math equation. For every equation i want an edit below it.
```

Set equation coverage to forced, run a dry run first, then real AI. The debug tab should show the editor prompt requiring structured JSON. The insertion preview should show a structured edit schema table before applying.
