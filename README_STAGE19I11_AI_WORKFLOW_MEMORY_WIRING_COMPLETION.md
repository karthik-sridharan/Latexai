# Stage 19I11 — AI Workflow Memory Wiring Completion

This frontend-only stage adds a shared `AIWorkflowMemoryService` wrapper around `LuminaLatex.AIProvider.ask`.

## Goal

Earlier Stage 19F–19I10 logging was strong for:

- Competitive Review
- Reviewer/Rebuttal Simulator
- Devil's Advocate Paper Debate

but several AI workflows still called the AI proxy without any generic Neon/memory trace.

Stage 19I11 wires the remaining AI calls by default:

- default Copilot
- Document AI / paper-level AI
- Citation AI
- Citation verifier AI
- Image-to-TikZ
- TikZ maker
- Presentation/talk export AI
- Paper AI polish
- diagnostics/model routing AI calls

## What is logged

For each non-specialized AI call, the wrapper:

1. Infers workflow, task type, and agent role.
2. Calls `/api/lumina/memory/agent-context` to record a role-specific context request.
3. Adds the context metadata to the AI request context.
4. Calls the original AI provider.
5. Logs `/api/lumina/memory/agent-run` with input/output summaries, context bundle data, status, latency, and metadata.
6. Logs a small positive reward for successful generic AI calls.

Specialized workflows are skipped to avoid duplicate logging:

- `competitive-review`
- `reviewer-rebuttal-simulator`
- `devils-advocate-paper-debate`

## Files changed

- `index.html`
- `js/ai-workflow-memory-service.js`

No backend redeploy is needed, assuming Stage 19I10 backend is already deployed.
