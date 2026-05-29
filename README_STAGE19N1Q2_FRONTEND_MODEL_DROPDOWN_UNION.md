# Stage 19N1Q2 — Frontend Model Dropdown Union Fix

This is a frontend-only patch for the settings/Copilot provider-model picker.

## Problem

After Stage 19N1Q, the backend model registry can report only the current/default allowed model, such as `gpt-4.1-mini`. The frontend treated that conservative backend list as the entire selectable list, so Settings showed only one OpenAI model and did not expose Gemini Flash choices.

## Fix

- Keeps the curated frontend OpenAI GPT model list visible even when backend `/models` returns only one default model.
- Keeps the curated frontend Gemini model list visible, including Flash/Flash-Lite choices.
- Still marks backend-reported models as `allowed`; other frontend-listed models remain selectable and are routed to the backend.
- Keeps the optional custom model override for OpenAI GPT model IDs and Gemini model IDs.
- Updates cache-busting query strings for `js/ai-provider.js` and `js/model-registry-service.js`.

## Changed files

- `index.html`
- `js/ai-provider.js`
- `js/model-registry-service.js`

## Test

Open:

```text
/index.html?v=19n1q2
```

Then:

1. Go to Settings.
2. Click Refresh backend models.
3. In Copilot / AI provider, choose OpenAI. The model dropdown should list multiple GPT models, not only `gpt-4.1-mini`.
4. Choose Gemini / Google. The model dropdown should list Gemini Flash/Flash-Lite models.
5. Optional: type an exact custom model ID in Custom model override.
