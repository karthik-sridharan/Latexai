# Stage 19T2G — No internal change-markup in AI agent prompts

Expected frontend badge: `latex-stage19t2g2-agent-prompt-lai-airlock-20260530-1`.

This stage keeps Latexai internal change-markup wrappers as a deterministic editor/compiler implementation detail only. Devil's Advocate agents are prompted to return the raw LaTeX block patch protocol and are not shown or asked to produce internal change-markup macros.

Key points:

- Existing internal edit wrappers are stripped from prompt/payload source before sending source to agents.
- Internal change-markup macro definitions are removed from agent-visible source context.
- Equation-coverage and final-editor prompts refer to raw patch insertions, not internal visible-edit wrappers.
- The compiler/backend still owns wrapping, validation, and fail-closed source insertion.
