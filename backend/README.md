# Lumina LaTeX Backend — Stage 1A

This optional backend gives the static Lumina LaTeX Editor two capabilities that should not run directly in browser code:

1. AI provider proxy for OpenAI / Anthropic / Gemini.
2. TeX compilation through a trusted server process.

## Local install

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

Then set these in the app UI:

```text
AI proxy URL:       http://localhost:3000/api/lumina/ai
Compile backend:   http://localhost:3000/api/lumina/latex/compile
```

## LaTeX requirements

The compile endpoint shells out to one of:

```text
pdflatex, xelatex, lualatex, latexmk
```

Install TeX Live locally or use the included Dockerfile. On Debian/Ubuntu a reasonable local install is:

```bash
sudo apt-get install latexmk texlive-latex-base texlive-latex-recommended texlive-latex-extra texlive-fonts-recommended texlive-bibtex-extra
```

## Docker

```bash
docker build -t lumina-latex-backend .
docker run --rm -p 3000:3000 --env-file .env lumina-latex-backend
```

## Security notes

This is a starting backend, not a full Overleaf security sandbox. For public deployment:

- Run the backend in an isolated container.
- Keep `ALLOW_SHELL_ESCAPE=false` unless you know exactly why you need it.
- Use rate limits and request-size limits.
- Restrict `ALLOWED_ORIGINS` to your site.
- Keep provider keys only in `.env` on the backend host.
- Consider stronger sandboxing before allowing arbitrary public users to compile TeX.
