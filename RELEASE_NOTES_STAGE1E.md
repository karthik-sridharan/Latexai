# Lumina LaTeX Editor — Stage 1E Release Notes

Stage: `latex-stage1e-copilot-workflows-20260428-1`

Stage 1E builds on the Stage 1D backend compile runner and adds structured LaTeX Copilot workflows.

## Added

- Copilot workflow selector for error fixing, log explanation, selected-text rewriting, new sections, Beamer outlines, and table/alignment help.
- Context chips showing active file, selection size, root file, and diagnostic count before each AI call.
- Structured Copilot context contract: `lumina-latex-copilot-context-v1`.
- Reviewable patch contract: `lumina-latex-ai-patch-v1`.
- Patch preview card with simple diff, summary, target path, operation, Apply, and Discard.
- Patch operations: `replace-selection`, `insert-at-cursor`, `find-replace`, and `replace-file`.
- Local fallback suggestions when the AI proxy is unavailable.
- Backend AI status and workflow metadata routes.

## Preserved

- Static GitHub Pages fallback for draft preview.
- Stage 1D backend compile runner and TeX Live job API.
- Backend-only API key storage for OpenAI, Anthropic, and Gemini.
- Reserved WebSocket and sync contracts.

## Recommended next stage

Stage 1F should upgrade the editor layer to CodeMirror 6 for syntax highlighting, line numbers, search, mobile-friendly editing, and better click-to-line behavior.
