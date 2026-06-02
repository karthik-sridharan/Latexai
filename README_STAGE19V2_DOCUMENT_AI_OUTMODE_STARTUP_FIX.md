# Stage 19V2 — Document AI outMode startup fix

This frontend hotfix fixes the startup error:

```text
ReferenceError: Can't find variable: outMode at document-ai-service.js
```

Cause:
`updateActionLabels()` used `outMode` without declaring it after the Stage 19V Total Paper Remake UI cleanup.

Fix:
- Defines `const outMode = documentAiOutputMode();` inside `updateActionLabels()`.
- Updates the `document-ai-service.js` cache-busting query string in `index.html` so browsers do not keep loading an older cached script.

Expected marker:

```text
latex-stage19v2-document-ai-outmode-startup-fix-20260602-1
```

Changed files:

```text
index.html
js/document-ai-service.js
README_STAGE19V2_DOCUMENT_AI_OUTMODE_STARTUP_FIX.md
```
