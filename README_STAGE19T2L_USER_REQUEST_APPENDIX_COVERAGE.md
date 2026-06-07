# Stage 19T2L — user request appendix coverage guard

This frontend hotfix keeps the working Stage 19T2K raw-patch apply path and adds request-completeness handling for multi-part Focus/query instructions.

## Fixes

- Detects explicit appendix requests in Focus/query, review text, or paper summary.
- Carries an `append_before_end_document` requirement into branch planning, synthesizer handoff, and final editor prompts.
- Adds a specific Jensen's inequality appendix instruction when the Focus/query mentions Jensen.
- Preserves appendix patches during frontend preview/apply instead of routing them into an ordinary section.
- Annotates append patches with `% Target action: append_before_end_document` so targeted insertion places them immediately before `\end{document}`.

## Expected badge

`latex-stage19t2l-user-request-appendix-coverage-20260530-1`

## Smoke test

Use Focus/query:

`Add explanation for every equation below or above it. Add an appendix that has theorem statement and explanation of Jensen's inequality.`

The final editor output should contain equation explanation patches plus at least one patch with:

```text
OPERATION: append_before_end_document
```

The preview/apply path should insert that appendix block before `\end{document}`.
