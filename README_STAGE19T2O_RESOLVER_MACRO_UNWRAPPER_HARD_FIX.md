# Stage 19T2O — Resolver macro unwrapper hard fix

This stage fixes the source-scanned Resolve AI edits buttons when visible `\lai{...}` safe insertion blocks are detected but **Keep red/new** appears to do nothing.

## Root cause

Stage 19T2N still had a resolver safety guard that scanned the whole post-resolution document and rejected ordinary tab characters or pre-existing legacy text. The resolver then aborted before rewriting the active editor, so the visible `\lai{...}` macro remained.

## Fix

- Stop rejecting normal tab indentation in resolver output.
- Validate only the kept resolver text plus structural-command preservation, not the entire document.
- Add a short sync suppression window so a stale textarea cannot immediately re-import the old `\lai{...}` text during resolver refresh.
- Route accepted text through the public editor `setText` path as well as direct textarea assignment.
- Unwrap common safe-insertion `\lai{% ... }` blocks so the leading TeX whitespace guard `%` does not remain after **Keep red/new**.

## Expected badge

`latex-stage19t2o-resolver-macro-unwrapper-hard-fix-20260530-1`

## Test

1. Insert a safe compiled edit that produces:

```tex
% --- Latexai safe compiled edit: Parametric case ---
\lai{%
Some accepted AI explanation.
}
% --- end Latexai safe compiled edit ---
```

2. Click **Refresh edits**.
3. Click **Keep red/new**.

Expected result: the entire wrapper and `\lai{...}` macro disappear, leaving only:

```tex
Some accepted AI explanation.
```
