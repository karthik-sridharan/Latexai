# Stage 19T2R — User request coverage verifier

Badge: `latex-stage19t2r-user-request-coverage-verifier-20260530-1`

This stage fixes a Devil's Advocate prompt-coverage failure where the model saw the whole paper but still satisfied only one part of a multi-part Focus/query.

Fixes:

- Injects explicit appendix-request context into the actual base prompt template.
- Removes the Jensen-specific instruction and replaces it with generic appendix-topic inference from the Focus/query.
- Adds generic named-section request context, e.g. if the user asks to add an Introduction section and none exists.
- Adds a final frontend coverage verifier pass. If the editor output omitted an explicit appendix or named-section request, the verifier asks the configured synthesis model for only the missing raw patch block(s), then appends those blocks before backend safe compilation.
- Keeps raw LaTeX block patch protocol and Safe Edit Compiler fail-closed behavior.

Use with backend Stage 19T2R for correct `insert_before_section` placement.
