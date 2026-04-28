FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    LUMINA_COMPILE_RUNNER=native-texlive \
    ALLOW_SHELL_ESCAPE=false \
    COMPILE_TIMEOUT_MS=30000 \
    MAX_PROJECT_BYTES=4000000 \
    MAX_PROJECT_FILES=120 \
    MAX_PDF_BYTES=16000000

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-science \
    texlive-bibtex-extra \
    latexmk \
    ghostscript \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app /tmp/texmf-var /tmp/texmf-config /tmp/texmf-cache

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
