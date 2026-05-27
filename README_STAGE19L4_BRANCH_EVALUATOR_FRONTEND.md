# Stage 19L4 — Developer Debate Branch Evaluator frontend

This stage extends `/developer-debate-branches.html` with branch value evaluation.

New buttons:

- `Evaluate current branches`: scores the currently generated Stage 19L3 branch list.
- `Generate + evaluate`: asks the backend to generate branches if needed and score them in one request.
- `Copy eval curl`: copies a direct request to `/api/lumina/debate/evaluate-branches`.

The evaluator is non-LLM and cheap. It displays value score, confidence, recommended action, gain/reviewer/memory support, risk/cost penalties, and explanation bullets.

Deploy after the Stage 19L4 backend.
