# Stage 19T3A — Unified safe edit protocol hardening

This stage hardens the unified raw-patch/app-managed-`\lai` protocol across paper-level AI, competitive review, reviewer/rebuttal, and Devil's Advocate final edits.

Expected frontend badge:

`latex-stage19t3a-unified-safe-edit-protocol-hardening-20260531-1`

Main frontend change: `LaiSafeEditPipelineService` now extracts only `LATEXAI_BLOCK_PATCH_BEGIN ... LATEXAI_BLOCK_PATCH_END` blocks from Markdown reports before calling the backend safe compiler, so full reports are not accidentally treated as source-edit payloads.
