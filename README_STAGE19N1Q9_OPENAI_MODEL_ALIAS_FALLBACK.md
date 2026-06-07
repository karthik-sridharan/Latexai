# Stage 19N1Q9 — OpenAI model alias/fallback repair

Stage badge: `latex-stage19n1q9-openai-model-alias-fallback-20260529-1`

This stage removes the stale OpenAI model choices `gpt-5.1` and `gpt-5.1-mini` from the frontend model dropdowns and route picker. Any saved browser route/model selection using those names is automatically repaired:

- `gpt-5.1-mini` → `gpt-5.4-mini`
- `gpt-5.1` → `gpt-5.4`

Changed files:

- `index.html`
- `js/ai-provider.js`
- `js/model-registry-service.js`
- `js/model-provider-service.js`
- `backend/server.mjs` (kept in the frontend full-source tree for consistency)

After deployment, reload the Latexai page and open Settings → Model/provider routing. The OpenAI dropdown should no longer offer `gpt-5.1-mini`.
