# Stage 18X4 — Separate Memory Backend URL + Settings-tab Backend URLs

This frontend-only stage fixes the backend URL split:

- AI calls continue to use the existing AI backend proxy URL.
- Hidden memory calls use a separate Memory backend URL, intended for the Neon-backed memory service.
- Backend proxy URL controls for AI, memory, and compile are now all in the Settings tab.
- Copilot keeps provider/model/workflow/prompt controls, but no longer owns backend URL fields.

## Files changed

- `index.html`
- `js/backend-url-settings-service.js` (new)
- `js/competitive-paper-review-service.js`
- `js/reviewer-rebuttal-simulator-service.js`
- `js/right-panel-organizer-service.js`
- `js/ai-provider.js`
- `js/copilot.js`
- `js/backend-diagnostics-service.js`
- `js/diagnostics.js`
- `js/regression-checklist-service.js`

## After upload

Open:

```text
https://karthik-sridharan.github.io/Latexai/?v=18x4
```

In Settings, set:

```text
AI backend proxy URL = your old working AI backend, ending in /api/lumina/ai
Memory backend URL = https://lumina-latex-backend-zugntkn2la-ue.a.run.app
Compile backend URL = your compiler backend endpoint, ending in /api/lumina/latex/compile
```

Then run Full Cited Review and check:

```bash
curl https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/memory/health
curl https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/memory/debug/scopes
```

The counts and scopes should increase after a successful review.
