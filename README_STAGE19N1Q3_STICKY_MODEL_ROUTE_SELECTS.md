# Latexai frontend stage 19N1Q3 — sticky provider/model route selects

This patch fixes the Settings → Model/provider routing dropdown regression seen on iPad/Safari:

- Selecting a route provider such as Gemini no longer reverts back to OpenAI after the first click.
- Changing a provider immediately rebuilds that row’s model dropdown with that provider’s models.
- Route changes are autosaved as soon as the provider/model dropdown changes, while the existing Save routing button remains available.
- Backend model-registry refreshes now preserve the currently visible route choices instead of rebuilding the rows from old localStorage state.
- The `model-provider-service.js` script URL is cache-busted in `index.html`; the previous build still referenced an old stage18 cache key.

Changed files:

- `index.html`
- `js/model-provider-service.js`
- `js/model-registry-service.js`

Expected visible stage badge:

`latex-stage19n1q3-sticky-route-provider-model-selects-20260529-1`

Smoke test after deploy:

1. Open Settings → Model/provider routing.
2. In Default / Copilot, change Provider from OpenAI to Gemini / Google.
3. The same row should stay Gemini immediately.
4. Its Model dropdown should immediately show Gemini models such as `gemini-2.5-flash`, `gemini-2.5-pro`, etc., not OpenAI models.
5. Change the next row’s Provider. The first row should remain Gemini.
6. Reload the page. The chosen route should still be present because route changes autosave.
