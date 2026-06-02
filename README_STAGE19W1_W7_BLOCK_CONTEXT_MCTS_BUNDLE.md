# LatexAI Frontend Stage 19W1-W7 — Block Context + MCTS Bundle

Stage marker:

```text
latex-stage19w1-w7-block-context-mcts-bundle-20260602-1
```

## Main UI addition

Adds a new card in the main editor Copilot tab:

```text
Project block context + MCTS-lite
```

Controls:

```text
Embed blocks
TopK
Block limit
Rollouts
Literature matches
OpenReview matches
MCTS goal
Analyze blocks
Match context
Citation suggestions
Related-work plan
Run MCTS-lite
```

## Reviewer/Rebuttal integration

When the user runs block context matching first, the Reviewer/Rebuttal simulator can append the latest block-local context summary into OpenReview corpus retrieval queries. This makes reviewer/rebuttal context more local to the current paper sections.

## New script

```text
js/project-block-context-service.js
```

## Changed scripts

```text
index.html
js/reviewer-rebuttal-simulator-service.js
```

## Tests run

- `node --check js/project-block-context-service.js`
- `node --check js/reviewer-rebuttal-simulator-service.js`
- Static check that `index.html` references the new project-block context script.
