# Stage 19T3A — Unified Safe AI Edit Protocol

This stage centralizes the source-edit protocol that was proven in the Devil's Advocate workflow and applies it across the paper-editing AI features.

## Contract

1. AI agents may write ordinary report prose, but every concrete source edit must be represented as `LATEXAI_BLOCK_PATCH_BEGIN ... LATEXAI_BLOCK_PATCH_END`.
2. AI agents must not emit `\lai`, `\laiold`, JSON edit schemas, full documents, or preamble rewrites.
3. The frontend sends the raw patch text to the backend Safe Edit Compiler.
4. The backend validates anchors/sections and produces compiler-managed visible `\lai{...}`/`\laiold{...}` drafts.
5. The frontend applies only compiler-produced drafts and then the existing Resolve AI Edits UI accepts/rejects `\lai` blocks.

## Unified frontend pieces

- `js/ai-provider.js`: central model call path, raw-patch contract injection for source-edit tasks, and OpenAI temperature retry/removal.
- `js/lai-safe-edit-pipeline-service.js`: central safe-edit bridge and preamble/full-document guards.
- `js/document-ai-service.js`: Document AI in-place/append rewired to raw patch + safe compiler.
- `js/competitive-paper-review-service.js`: Competitive review insert/append rewired to raw patch + safe compiler.
- `js/reviewer-rebuttal-simulator-service.js`: Reviewer/rebuttal final edits rewired to raw patch + safe compiler.
- `js/real-agent-branch-workflow-service.js`: Devil's Advocate keeps the same known-good raw patch workflow.
- `js/copilot.js`: selected rewrite strips model-supplied internal markup and lets the app create visible `\lai` markup for the selected range.

## Test summary

Local checks run for this package:

- Backend Python syntax/import check.
- Backend Safe Edit Compiler stress suite: 21/21 cases passed.
- Backend OpenAI adapter tests: GPT-5 temperature omitted and unsupported-temperature retry strips temperature.
- Frontend JavaScript syntax checks for AIProvider, safe-edit pipeline, Document AI, Competitive Review, Reviewer/Rebuttal, Copilot, Devil's Advocate, and branch workflow services.
- Frontend AIProvider unit tests: raw patch contract injection, no contract injection for citation tasks, and unsupported-temperature retry.

Chromium headless was attempted in the sandbox, but local/file URLs are blocked by the environment policy (`Your organization doesn't allow you to view this site`). The functional checks above were therefore run with Node/Python mocks rather than a live Chromium page.
