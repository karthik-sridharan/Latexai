# Stage 19T2U — Equation coverage batched verifier hardening

Frontend-only stabilization stage for Devil's Advocate / paper edit workflows.

## Why

Stage 19T2T added equation-coverage auditing, but a real run could still produce only a few equation-anchor patches, for example `3/21`, because the coverage verifier made one large model call and accepted partial model output.

## What changed

- Updates frontend stage badge to `stage19t2u-equation-coverage-batched-verifier-20260531-1`.
- Treats explicit "explain every equation" / "immediately below every displayed equation" requests as strict per-equation coverage requirements.
- Splits missing equation coverage into small verifier batches of 5 equation ids.
- Recomputes missing equation ids after each batch so the verifier does not duplicate ids already covered.
- Adds a deterministic compile-safe fallback for any equation ids still missing after the configured verifier model returns partial output.
- Keeps the safe compiler and visible `\lai{...}` resolution workflow unchanged.

## Expected behavior

For a source with 21 detected display equations and the Focus/query:

`Explain every displayed equation immediately below it.`

Final Synthesis should eventually contain one raw patch per equation anchor:

```text
OPERATION: insert_after_block
TARGET_BLOCK_ID: eq_001
...
OPERATION: insert_after_block
TARGET_BLOCK_ID: eq_021
```

The Stage 19T2U audit should no longer allow a partial `3/21` result to look acceptable; if the model omits ids, fallback patches are appended so the user can accept/reject/edit them through normal `\lai` resolution.
