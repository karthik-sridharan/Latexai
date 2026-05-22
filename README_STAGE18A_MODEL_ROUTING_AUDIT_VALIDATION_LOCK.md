# Stage 18A — Model routing audit + validation lock

Stage string:

```txt
stage18a-model-routing-audit-validation-lock-1
```

This stage does **not** duplicate the existing model selectors. Instead, it audits and hardens the model routing already present in Latexai.

## What changed

- Added a central frontend `ModelRegistryService`.
- Added backend `/api/lumina/models` and richer `/api/lumina/ai/status` model metadata.
- Added validation/repair for unsupported provider/model selections before AI calls.
- Added request-level `modelRoutingAudit` metadata so each AI call records the requested model, final model, route key, and fallback reason.
- Added route keys for:
  - default / Copilot
  - paper-level AI
  - citation AI
  - presentation export
  - figure/TikZ generation
  - slide repair
  - diagnostics
  - competitive review ranking
  - competitive review improvement
  - Devil’s Advocate supporter
  - Devil’s Advocate critic
  - Devil’s Advocate synthesis
- Converted Devil’s Advocate agent model text fields into registry-backed selects.
- Preserved the explicit per-agent model routing bypass so the generic paper route does not override individual debate agents.
- Competitive Review now uses the `competitive-improvement` route key for the improvement workflow.
- The backend no longer hard-fails unsupported model aliases where a safe allowed fallback exists; it returns `modelFallback` metadata instead.

## Files changed

- `index.html`
- `css/lai-stage18a-model-registry.css`
- `js/model-registry-service.js`
- `js/model-provider-service.js`
- `js/ai-provider.js`
- `js/ai-routing-inspector-service.js`
- `js/competitive-paper-review-service.js`
- `js/devils-advocate-debate-service.js`
- `js/feature-flag-service.js`
- `js/right-panel-organizer-service.js`
- `server.mjs`
- `backend/server.mjs`
- `tests/stage18a-model-routing-audit-validation-lock.test.cjs`

## Expected visual behavior

In Settings, the **AI / Model configuration** area should now include:

- Backend model registry
- Model/provider routing
- AI model routing inspector

Devil’s Advocate should show provider/model dropdowns for the supporter, critic, and synthesis agents.

## Expected safety behavior

If a workflow tries to use an unsupported model, Latexai should repair to a supported model and expose the fallback in routing diagnostics instead of stopping with an error like:

```txt
Unsupported model for openai: gpt-4.1
```
