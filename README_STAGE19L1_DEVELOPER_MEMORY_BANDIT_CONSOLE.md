# Stage 19L1 — Developer Memory Bandit Console

This frontend-only stage adds a separate developer browser page for selecting the Latexai memory-learning / contextual-bandit policy and tuning hyperparameters without using the JavaScript console.

## New page

Open this on the same deployed frontend origin as the main Latexai app:

```text
/developer-memory-bandit.html
```

The page stores settings in the same `localStorage` namespace read by the main app. After saving settings, the next AI call in `index.html` will send them to the backend `/api/lumina/memory/ranked-context` endpoint.

## Settings exposed

- `latexai:memory-selection-policy`
  - `greedy`
  - `epsilon_greedy`
  - `ucb`
  - `thompson`
  - `softmax`
- `latexai:memory-bandit-epsilon`
- `latexai:memory-bandit-ucb-beta`
- `latexai:memory-bandit-thompson-alpha`
- `latexai:memory-bandit-softmax-temperature`
- `latexai:memory-bandit-exploration-pool-size`
- `latexai:memory-bandit-top-k`

## Backend settings exposed

- `lumina-latex.memory.backendUrl`
- `lumina-latex.memory.proxyToken`
- `latexai:memory-enabled`

## Added top-K support

`js/ai-workflow-memory-service.js` now reads `latexai:memory-bandit-top-k` and uses it as the `/ranked-context` `limit`, clamped to 1--24. Default remains 6.

## Debug support

The page can call:

```text
/api/lumina/memory/debug/context-scores
```

with the selected policy and hyperparameters and displays:

- selected memories
- base learned score
- final bandit score
- exploration bonus
- times used
- average reward
- exploration flag
- raw JSON

## Deploy

Deploy the frontend files only. No backend redeploy is required if Stage 19L0 backend is already deployed.
