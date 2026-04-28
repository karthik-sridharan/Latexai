# Optional backend image. It is intentionally not tiny because real LaTeX package
# coverage is the hardest part of Overleaf-like compilation.
FROM node:20-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    latexmk \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-bibtex-extra \
    texlive-xetex \
    texlive-luatex \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server.mjs ./
EXPOSE 3000
CMD ["npm", "start"]
