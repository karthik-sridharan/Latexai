// Stage 1C provider seam for TeX Live compilation.
// server.mjs still exposes the working compile route, but future stages should move
// the implementation here so the API contract and sandbox policy are decoupled.
export const providerName = 'backend-texlive';
export const compileContract = {
  requestSchema: 'lumina-latex-compile-request-v1',
  responseSchema: 'lumina-latex-compile-response-v1',
  supportedEngines: ['pdflatex', 'xelatex', 'lualatex', 'latexmk'],
  defaultTimeoutMs: 25000,
  shellEscapeDefault: false
};
