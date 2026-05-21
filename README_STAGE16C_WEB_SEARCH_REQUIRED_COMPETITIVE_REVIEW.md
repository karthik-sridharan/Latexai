# Stage 16C: web-search-required competitive review

Changed frontend files:

- `index.html`
- `js/feature-flag-service.js`
- `js/competitive-paper-review-service.js`
- `css/lai-stage16b-competitive-review.css`
- `prompt/ai-competitive-paper-review.txt`

Changed backend files:

- `server.mjs`
- `backend/server.mjs`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage16c-web-search-required-competitive-review-1`

## What this changes

Competitive paper review now requires a web-search-capable AI backend.

Frontend:

- Adds `Check web search`.
- Shows web-search status.
- Refuses to run competitive review unless `/api/lumina/ai/status` reports web search availability.
- Sends `webSearchRequired: true` and `requiredTools: ["web_search"]`.

Backend:

- Adds web-search capability info to `/api/lumina/ai/status`.
- For OpenAI Responses API calls, adds:

```js
tools: [{ type: "web_search" }]
tool_choice: "auto"
```

- Rejects competitive review if web search is required but provider is not OpenAI.
- Rejects if `OPENAI_WEB_SEARCH_ENABLED=false`.

## Environment

Default:

```txt
OPENAI_WEB_SEARCH_ENABLED=true
OPENAI_WEB_SEARCH_TOOL=web_search
```

Use `OPENAI_WEB_SEARCH_ENABLED=false` to explicitly disable web-search workflows.
