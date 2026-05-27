# Stage 19L0 — Contextual Bandit Memory Selection Frontend

This stage forwards contextual-bandit memory-selection settings to the backend `/api/lumina/memory/ranked-context` endpoint.

No visible UI is added. The default policy is backend UCB.

## Optional localStorage overrides

You can test policies from the browser console:

```js
localStorage.setItem('latexai:memory-selection-policy', 'ucb');
localStorage.setItem('latexai:memory-bandit-ucb-beta', '0.20');
```

Other policies:

```js
localStorage.setItem('latexai:memory-selection-policy', 'greedy');
localStorage.setItem('latexai:memory-selection-policy', 'epsilon_greedy');
localStorage.setItem('latexai:memory-bandit-epsilon', '0.10');
localStorage.setItem('latexai:memory-selection-policy', 'thompson');
localStorage.setItem('latexai:memory-bandit-thompson-alpha', '0.25');
localStorage.setItem('latexai:memory-selection-policy', 'softmax');
localStorage.setItem('latexai:memory-bandit-softmax-temperature', '0.25');
```

Exploration pool size:

```js
localStorage.setItem('latexai:memory-bandit-exploration-pool-size', '24');
```

Reset to default:

```js
localStorage.removeItem('latexai:memory-selection-policy');
localStorage.removeItem('latexai:memory-bandit-epsilon');
localStorage.removeItem('latexai:memory-bandit-ucb-beta');
localStorage.removeItem('latexai:memory-bandit-thompson-alpha');
localStorage.removeItem('latexai:memory-bandit-softmax-temperature');
localStorage.removeItem('latexai:memory-bandit-exploration-pool-size');
```

Deploy Stage 19L0 backend first, then this frontend.
