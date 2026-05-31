# Stage 19T2M — Generic Appendix Request Coverage

This frontend hotfix removes the Stage 19T2L topic-specific Jensen appendix prompt path.

The frontend now treats appendix requests generically:

- Detects explicit appendix requests from the Focus/query or review text.
- Requires the final editor to emit an `append_before_end_document` RAW LATEX BLOCK PATCH.
- Instructs the editor to infer the appendix topic and requested contents from the original user request, including theorem statements, explanations, proof ideas, derivations, or examples when requested.
- Does not hard-code Jensen's inequality or any other particular appendix topic.
- Preserves append-before-end-document application so appendix content is inserted immediately before `\end{document}`.

Expected badge:

`latex-stage19t2m-generic-appendix-request-coverage-20260530-1`
