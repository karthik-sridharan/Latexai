# Stage 19W11 — Block suggestion apply / accept / reject pipeline frontend

Stage marker:

```text
latex-stage19w11-block-suggestion-apply-feedback-20260602-1
```

This frontend stage upgrades the **Project block context + MCTS-lite** card so outputs are actionable.

## Added UI actions

For block-local citation suggestions:

```text
Preview
Apply as \lai edit
Reject
Show evidence JSON
```

For related-work plans:

```text
Preview related-work edit
Apply related-work plan as \lai block
Reject plan
```

For MCTS-lite branches:

```text
Preview branch edit
Apply winning branch / Apply branch
Reject branch
```

## Behavior

- Preview calls `/api/lumina/block-suggestions/apply-preview`.
- Apply inserts the returned safe `\laiold` / `\lai` markup into the active source.
- Localized suggestions replace the detected source span with safe markup.
- Append-mode suggestions are inserted before `\end{document}` when possible.
- Apply/reject/useful feedback is logged through `/api/lumina/block-suggestions/feedback`.

## Validation

Local checks run:

```text
node --check js/project-block-context-service.js
node --check js/stage19w10-workflow-tabs-service.js
node --check js/context-policy-dashboard-service.js
node --check js/reviewer-rebuttal-simulator-service.js
static index/css marker checks
```
