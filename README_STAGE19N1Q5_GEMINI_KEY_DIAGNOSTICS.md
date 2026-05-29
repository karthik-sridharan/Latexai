# Stage 19N1Q5 — Gemini key diagnostics and backend env aliases

Badge after deploy:

```text
latex-stage19n1q5-gemini-key-diagnostics-and-env-aliases-20260529-1
```

This stage is for the case where Gemini was selected in the frontend and the backend still reported that `GEMINI_API_KEY` was not set.

## Changed files

```text
index.html
server.mjs
backend/server.mjs
backend/providers/ai-gemini.mjs
backend/security/ai-gemini.mjs
```

## What changed

1. Gemini key lookup now trims whitespace and accepts any of these backend environment variables:

```text
GEMINI_API_KEY
GOOGLE_API_KEY
GOOGLE_GENERATIVE_AI_API_KEY
GOOGLE_AI_API_KEY
```

2. `/api/lumina/ai/status` now reports non-secret provider environment diagnostics. It only reports whether each expected env var is present; it never returns the key value.

3. The Gemini missing-key error now names all accepted env aliases, instead of implying only one name is valid.

4. The browser badge/cache string is bumped so Safari/iPad loads the patched files.

## Quick backend check

```bash
curl -s "$BACKEND/api/lumina/ai/status" | python3 -m json.tool | grep -A12 -i gemini
```

You should see Gemini configured as true, and one of the accepted env names present as true.

## Important

A Google AI Studio key is the correct kind of key for the Gemini Generative Language API. If the backend still says no key is set, the running Cloud Run revision is either missing the env var, using a different variable name, or the frontend is pointed at a different backend URL than the service you updated.
