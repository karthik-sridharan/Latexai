# Stage 18A — Model routing audit + validation lock

Stage string: `stage18a-model-routing-audit-validation-lock-1`

This stage does not add another duplicate model-selection UI. It stabilizes and audits the model selectors that already exist.

## Main changes

- Adds `ModelRegistryService`, a central provider/model registry.
- Fetches backend `/api/lumina/models` and `/api/lumina/ai/status` when available.
- Repairs unsupported or stale frontend model choices before an AI request is sent.
- Converts workflow route model fields to controlled dropdowns rather than free-text fields.
- Adds explicit route keys for:
  - default/copilot,
  - paper-level AI,
  - citations,
  - presentation export,
  - figures/TikZ,
  - slide repair,
  - diagnostics,
  - competitive ranking,
  - competitive improvement,
  - devil’s advocate supporter,
  - devil’s advocate critic,
  - devil’s advocate synthesis.
- Devil’s Advocate per-agent model selectors are now validated by role-specific routes.
- Competitive Review declares the `competitive-improvement` route for its AI call.
- The AI request body now includes `context.modelRoutingAudit` with requested/final provider/model and fallback reason.
- The backend now exposes model registry metadata and falls back to an allowed model instead of throwing `Unsupported model for ...` for model-name mismatches.
- The AI routing inspector now reports model registry information and registry repair notes.

## Expected behavior

If a stale route or agent row contains an unsupported model such as `gpt-4.1` on a backend that only allows `gpt-4.1-mini`, the request should be repaired to the backend default/allowed model and the repair should be visible in the model routing audit/report rather than stopping the workflow.

## Files changed

- `index.html`
- `js/ai-provider.js`
- `js/copilot.js`
- `js/feature-flag-service.js`
- `js/model-registry-service.js`
- `js/model-provider-service.js`
- `js/ai-routing-inspector-service.js`
- `js/devils-advocate-debate-service.js`
- `js/competitive-paper-review-service.js`
- `js/right-panel-organizer-service.js`
- `css/lai-stage18a-model-registry.css`
- `server.mjs`
- `backend/server.mjs`
- `tests/stage18a-model-routing-audit-validation-lock.test.cjs`
