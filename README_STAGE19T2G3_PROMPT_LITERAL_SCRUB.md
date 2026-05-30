# Stage 19T2G3 — prompt literal scrub

Stage: `latex-stage19t2g3-prompt-literal-scrub-20260530-1`

Prompt templates and AI-bound instruction strings were scrubbed to avoid teaching agents literal internal editor change-marker macro names. UI and deterministic compiler code may still contain those names because they implement/preview local editor behavior, but AI-bound prompts should use neutral wording such as 'internal editor change-tracking wrappers'.
