# Stage 19W39 — compile jobs Load failed fallback

This frontend patch keeps the Stage 19W36 GitHub diagnostics and fixes the compile-provider behavior seen on Safari/iPad where `/compile/jobs` can fail with the generic browser error `Load failed` even though the direct `/api/lumina/latex/compile` endpoint works.

Changes:
- Treat `Load failed` / network/CORS-style failures during compile-job creation or polling as job endpoint transport failures.
- Automatically falls back to the direct `/api/lumina/latex/compile` endpoint instead of surfacing `Compile provider error: Load failed`.
- When the compile URL field changes, also syncs `backendStatusUrl` to the same backend host.
- Cache-busts `compiler-provider.js`, `preview.js`, and `main.js`.

Recommended app setting:
- Compile URL: `https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/latex/compile`
- Use compile jobs may be either on or off; with this patch, if jobs transport fails, direct compile is attempted.
