# Stage 18X6 — Memory CORS / iPad Fetch Fix

This frontend-only patch fixes the iPad `Load failed` diagnostics problem for the hidden memory backend.

## What changed

- Memory diagnostics now performs a simple GET without `Content-Type` and without `cache: no-store`.
- Competitive-review memory calls and reviewer/rebuttal memory calls no longer force JSON headers on GET requests.
- POST memory writes still use `Content-Type: application/json`.
- This reduces unnecessary browser preflight failures on iPad/Safari/Brave when calling the separate Cloud Run memory backend.

## Files

- `index.html`
- `js/backend-url-settings-service.js`
- `js/competitive-paper-review-service.js`
- `js/reviewer-rebuttal-simulator-service.js`
- `js/right-panel-organizer-service.js`

## Test

Open:

```text
https://karthik-sridharan.github.io/Latexai/?v=18x6
```

Set Memory backend URL to:

```text
https://lumina-latex-backend-zugntkn2la-ue.a.run.app
```

Then click **Test memory backend** in Settings.
