# Stage 19N1Q8 — Normalize AI proxy URL

Fixes frontend AI proxy 404 errors caused by stale/relative/base backend URLs.

## Expected frontend badge

`latex-stage19n1q8-normalized-ai-proxy-url-20260529-1`

## Key behavior

- AI backend proxy URL now defaults to the deployed Cloud Run AI route:
  `https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/ai`
- If the user enters only the base Cloud Run URL, `/api/lumina`, `/api/lumina/memory`, `/api/lumina/latex/compile`, or `/api/lumina/ai/status`, the frontend normalizes it to `/api/lumina/ai`.
- AIProvider stores the normalized URL in localStorage and includes the URL in 404 error messages.

## Correct Settings values

Memory backend URL: `https://lumina-latex-backend-zugntkn2la-ue.a.run.app`

AI backend proxy URL: `https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/ai`

Compile backend URL: `https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/latex/compile`
