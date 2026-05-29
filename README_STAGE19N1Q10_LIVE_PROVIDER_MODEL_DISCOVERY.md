# Stage 19N1Q10 — live provider model discovery

This stage keeps the OpenAI/Gemini model dropdowns restricted to currently available text-generation models.

Changes:

- Frontend no longer merges stale local OpenAI/Gemini model IDs into dropdowns once the backend returns `/api/lumina/models`.
- Custom model override is disabled for OpenAI/Gemini so stale values such as `gpt-5.1-mini` cannot override the dropdown.
- Backend `/api/lumina/models` queries:
  - OpenAI `GET /v1/models` using `OPENAI_API_KEY`, filtered to text-generation models usable by Latexai.
  - Gemini `GET /v1beta/models` using the configured Gemini key, filtered to current `generateContent` text-output models.
- Deprecated Gemini 1.5/2.0 models and special audio/image/embedding/live models are excluded from Latexai dropdowns.

Expected frontend badge:

```text
latex-stage19n1q10-live-provider-model-discovery-20260529-1
```
