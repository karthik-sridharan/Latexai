# Stage 12D: citation links and AI audit

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/citation-verifier-service.js`
- `css/lai-stage12b-citation-verifier.css`
- `prompt/ai-citation-audit.txt`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage12d-citation-links-ai-audit-1`

## What this adds

The local citation verifier now has:

- `Show online links`
- `Run AI audit`
- `Verify + links + audit`

`Show online links` builds links from local BibTeX metadata:

- DOI -> `https://doi.org/...`
- arXiv/eprint -> `https://arxiv.org/abs/...`
- URL field -> direct URL
- otherwise a Google Scholar search URL from title/author/year

`Run AI audit` asks AI to inspect the local verifier report and generated links. It does not claim online verification; it produces an actionable review of missing, duplicate, weak, or suspicious entries.

## Important limitation

This is still not true online verification. It only builds links from existing fields and asks AI to audit the local metadata. Backend/web verification can be added later.
