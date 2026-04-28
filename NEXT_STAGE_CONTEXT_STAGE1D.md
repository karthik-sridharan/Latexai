# Next Stage Context — after Stage 1D

Recommended next stage: **Stage 1E Copilot Fix/Patch Workflows**.

Stage 1D established the real compile backend. Stage 1E should focus on AI-assisted editing with safety and review:

- Feed structured compile diagnostics into Copilot.
- Add tasks: fix current error, explain log, rewrite selection, create theorem/proof/table, Beamer frame generation.
- Ask backend AI provider for a structured patch instead of raw text when possible.
- Show patch preview before applying.
- Add accept/reject controls and rollback snapshot.
- Keep provider selector for OpenAI / Claude / Gemini through backend only.

Stage 1F should then upgrade the editor to CodeMirror 6 with syntax highlighting, line numbers, autocomplete, and better mobile behavior.
