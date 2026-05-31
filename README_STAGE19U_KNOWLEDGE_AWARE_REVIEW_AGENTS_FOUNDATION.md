# Stage 19U — Knowledge-aware review agents foundation

This frontend stage adds a shared knowledge/literature retrieval bridge for AI workflows that previously used only the current paper context.

## Added

- `js/knowledge-context-service.js`: shared retrieval service for `/api/lumina/research/context-for-paper`.
- Paper-level AI toggle: `Use knowledge/literature context for Paper-level AI`.
- Reviewer/rebuttal simulator toggle: `Use knowledge/literature context`.
- Competitive review/improver toggle: `Use knowledge/literature context for competitive review/improver`.
- Retrieved context is injected as a separate prompt block, not mixed into source text.
- Final source edits still use the existing raw `LATEXAI_BLOCK_PATCH` protocol; the app/backend still manage `\lai`/`\laiold`.

## Safety

This stage does not directly mutate LaTeX source with retrieved snippets. It only adds retrieved literature context to AI prompts, and all edits still flow through the Safe Edit Compiler.
