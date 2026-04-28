# Lumina LaTeX Editor — Stage 1D Deploy Notes

Stage 1D adds a real backend compile runner while preserving the same static frontend deployment model.

## Static frontend

Deploy these files to your GitHub Pages folder, for example `/Latexai/`:

```text
index.html
css/
js/
prompts/
examples/
```

On GitHub Pages, the app will still run in draft-preview mode if the compile URL remains the default relative `/api/lumina/latex/compile`.

## Backend

The backend is in `backend/`. It exposes real compile endpoints and an AI proxy. The recommended run mode is Docker, because the Dockerfile installs TeX Live.

```bash
cd backend
cp .env.example .env
docker build -t lumina-latex-backend:stage1d .
docker run --rm -p 3000:3000 --env-file .env lumina-latex-backend:stage1d
```

Then in the frontend Settings panel set:

```text
Compile backend URL: http://localhost:3000/api/lumina/latex/compile
```

For production, host the backend separately and use the production URL:

```text
https://your-backend.example.com/api/lumina/latex/compile
```

Click **Test backend** before compiling. It calls:

```text
GET /api/lumina/latex/status
```

## Security defaults

- Shell escape is off.
- Project size and file count are limited.
- Compile commands have a timeout.
- PDF/log output size is limited.
- Temporary workspaces are cleaned up.
- API keys stay on the backend.

For public multi-user deployment, put this behind authentication and add stronger per-user quotas/container isolation.
