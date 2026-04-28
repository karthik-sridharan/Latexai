# Next Stage Context — Stage 1D Recommendation

Recommended next stage: **Stage 1D AI Copilot Workflows**.

Good targets:

1. Improve Copilot task contracts for:
   - fix current compile error,
   - explain selected log block,
   - generate theorem/proof/table/figure snippets,
   - convert outline to article or Beamer,
   - create bibliography entries.
2. Send structured project context to the backend AI proxy:
   - active file,
   - selection,
   - root file,
   - last compile log,
   - top diagnostics,
   - project outline.
3. Add diff/patch preview before applying AI edits.
4. Keep provider selector backend-first for OpenAI, Anthropic/Claude, and Gemini.

Alternative Stage 1D: CodeMirror 6 editor integration. The Stage 1B/1C adapter seam already supports this without changing project state or compile logic.
