# Stage 18X5 — iPad Memory Diagnostics + Settings URL Cleanup

This frontend-only patch keeps the separate AI, memory, and compile backend URL model from Stage 18X4, but adds an iPad-friendly memory backend diagnostic in the Settings tab.

## Changes

- Adds **Test memory backend** to Settings.
- The test performs a browser-origin GET `/api/lumina/memory/health` and POST `/api/lumina/memory/scope`.
- This lets users verify GitHub Pages → Cloud Run memory writes without needing browser console.
- Memory auth is now independent from AI/compile auth; memory requests no longer reuse AI or compile tokens by default.
- Memory is enabled by default if no prior local setting exists.

## Expected Settings values

- AI backend proxy URL: the old working AI backend ending in `/api/lumina/ai`.
- Memory backend URL: `https://lumina-latex-backend-zugntkn2la-ue.a.run.app`
- Compile backend URL: the compiler route ending in `/api/lumina/latex/compile`.

## Verification

1. Open `https://karthik-sridharan.github.io/Latexai/?v=18x5`.
2. Go to Settings.
3. Click **Test memory backend**.
4. The status should say **Memory backend OK**.
5. In Cloud Shell, run:

```bash
curl https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/memory/debug/scopes
```

You should see a `settings-memory-test-project` scope.
