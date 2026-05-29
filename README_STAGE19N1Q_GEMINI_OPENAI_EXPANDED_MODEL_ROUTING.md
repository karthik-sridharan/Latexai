# Stage 19N1Q — Gemini Provider Wiring + Expanded OpenAI GPT Model Routing

This stage wires the existing Gemini provider option through the AI proxy and expands OpenAI model routing beyond only `gpt-4.1-mini`.

## What changed

### Backend

Changed files:

- `server.mjs`
- `backend/server.mjs`

Changes:

1. Gemini API calls are now enabled through the AI proxy when either of these backend environment variables is set:
   - `GEMINI_API_KEY`
   - `GOOGLE_API_KEY`

2. Gemini requests use Google Generative Language `generateContent` with:
   - `system_instruction`
   - `contents`
   - `generationConfig.temperature`
   - `generationConfig.maxOutputTokens`

3. Backend model registry now reports Gemini as a real provider with default models:
   - `gemini-2.5-flash`
   - `gemini-2.5-pro`
   - `gemini-1.5-flash`
   - `gemini-1.5-pro`

4. OpenAI allowed model defaults now include a broader curated GPT list:
   - `gpt-4.1-mini`
   - `gpt-4.1`
   - `gpt-4o-mini`
   - `gpt-4o`
   - `gpt-5-mini`
   - `gpt-5`
   - `gpt-5.1-mini`
   - `gpt-5.1`
   - `gpt-5.4`

5. OpenAI custom GPT model routing is enabled by default:
   - `OPENAI_ALLOW_ANY_GPT_MODEL=true`

   Any model matching `gpt...` is accepted and passed through to the OpenAI Responses API.

6. Gemini custom model routing can be enabled if needed:
   - `GEMINI_ALLOW_ANY_MODEL=true`

### Frontend

Changed files:

- `index.html`
- `js/ai-provider.js`
- `js/model-registry-service.js`

Changes:

1. The global stage badge is updated to:
   `latex-stage19n1q-gemini-openai-expanded-model-routing-20260529-1`

2. The visible model dropdown includes more OpenAI GPT models.

3. Gemini is preserved as a selectable provider and now works when the backend has a Gemini/Google API key.

4. Adds optional custom model override input:
   - Use this to type a model not shown in the dropdown.
   - For OpenAI, custom `gpt...` model names are allowed by the backend by default.
   - For Gemini, custom `gemini...` model names require `GEMINI_ALLOW_ANY_MODEL=true` on the backend.

5. The model registry accepts backend-reported `allowCustomModels`, `allowAnyGptModel`, and `customModelPattern` fields.

## Environment variables

Minimum for OpenAI:

```bash
OPENAI_API_KEY="..."
OPENAI_DEFAULT_MODEL="gpt-4.1-mini"
OPENAI_ALLOW_ANY_GPT_MODEL="true"
```

Minimum for Gemini:

```bash
GEMINI_API_KEY="..."
GEMINI_DEFAULT_MODEL="gemini-2.5-flash"
```

Optional Gemini custom pass-through:

```bash
GEMINI_ALLOW_ANY_MODEL="true"
```

Optional curated lists:

```bash
OPENAI_ALLOWED_MODELS="gpt-4.1-mini,gpt-4.1,gpt-4o-mini,gpt-4o,gpt-5-mini,gpt-5"
GEMINI_ALLOWED_MODELS="gemini-2.5-flash,gemini-2.5-pro"
```

## Test

After deploying backend and frontend, open:

```text
/index.html?v=19n1q
```

Then:

1. Settings → refresh backend model registry.
2. Confirm Gemini reports configured if `GEMINI_API_KEY` or `GOOGLE_API_KEY` is set.
3. In Copilot, choose:
   - Provider: `Gemini / Google`
   - Model: `gemini-2.5-flash`
4. Run a simple Copilot prompt.
5. Switch provider to OpenAI and test a non-mini GPT model from the dropdown or the custom model override.

## Backend smoke tests

```bash
curl -s "$BACKEND/api/lumina/ai/status" | python3 -m json.tool | head -80
```

Gemini test:

```bash
curl -s "$BACKEND/api/lumina/ai" \
  -H 'Content-Type: application/json' \
  -d '{
    "provider":"gemini",
    "model":"gemini-2.5-flash",
    "task":"latex-copilot",
    "payload":{"prompt":"Say Gemini is wired in one short sentence."}
  }' | python3 -m json.tool
```

OpenAI custom GPT model test:

```bash
curl -s "$BACKEND/api/lumina/ai" \
  -H 'Content-Type: application/json' \
  -d '{
    "provider":"openai",
    "model":"gpt-5.4",
    "task":"latex-copilot",
    "payload":{"prompt":"Say OpenAI custom GPT model routing is enabled in one short sentence."}
  }' | python3 -m json.tool
```

If the selected model is not available to the API key/project, the provider will return its normal model-not-found or access error. Latexai no longer blocks valid-looking `gpt...` model names before they reach the OpenAI API.
