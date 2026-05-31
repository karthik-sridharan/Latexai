# Latexai Stage 19T2W — Raw patch protocol for all paper AI features

Stage badge:

```text
latex-stage19t2w-raw-patch-all-paper-ai-features-20260531-1
```

This stage generalizes the Stage 19T2 raw LaTeX block-patch workflow beyond Devil's Advocate.

## Design contract

AI agents should not return source-edit JSON and should not emit `\lai` / `\laiold` wrappers.

Instead, paper-editing agents return normal prose/report text plus explicit raw patch blocks:

```text
LATEXAI_BLOCK_PATCH_BEGIN
PATCH_ID: edit-1
OPERATION: replace_block | insert_after_block | insert_before_block | insert_before_section | append_before_end_document | no_edit
TARGET_BLOCK_ID: optional safe block id
TARGET_SECTION: optional exact section title
RATIONALE: short reason
BEGIN_NEW_LATEX
Raw visible LaTeX/prose body content goes here.
END_NEW_LATEX
LATEXAI_BLOCK_PATCH_END
```

The app then sends those blocks to the backend Safe Edit Compiler. The compiler validates the target and content, creates the visible `\lai{...}` / `\laiold{...}` markup, and returns full-source insertion drafts. The frontend applies only compiler-produced drafts.

## Features rewired in this stage

1. **Document AI / Paper-level AI**
   - In-place mode now prompts for `LATEXAI_BLOCK_PATCH` instead of JSON.
   - Append mode wraps the generated review section as an `append_before_end_document` raw patch and sends it through the Safe Edit Compiler.

2. **Competitive paper review**
   - Final review prompt requests raw patch blocks instead of `latexai_actionable_edits` JSON.
   - Inline insertion and append-plan buttons now use the shared safe-edit pipeline.
   - If a report lacks valid raw patches, the backend repair path can attempt to convert the report into raw patch blocks.

3. **Reviewer / rebuttal simulator**
   - Final synthesis now asks for raw patch blocks, not JSON actionable edits.
   - New buttons: **Preview final edits** and **Apply final edits**.
   - Applying final edits goes through the Safe Edit Compiler and produces app-managed `\lai` blocks.

4. **Copilot selected rewrite**
   - Rewrite-selection prompt now asks for raw replacement LaTeX/prose instead of JSON.
   - The app still wraps the selected replacement using deterministic old/new markup.

## New shared service

`js/lai-safe-edit-pipeline-service.js`

Exposes:

- `compileRawPatch(...)`
- `applyCompiledDraft(...)`
- `compileAndApply(...)`
- `rawPatchBlock(...)`
- `rawPatchProtocolInstructions(...)`

## Backend requirement

Use Stage 19T2V or later backend, because section-level and append-before-end-document operations must be accepted by the Safe Edit Compiler.
