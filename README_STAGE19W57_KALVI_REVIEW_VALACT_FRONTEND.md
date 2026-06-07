# Stage 19W57 frontend patch

Changed files:
- `literature.html`: Kalvi header/icon/style polish to match the Knowledge Graph visual language.
- `review.html`: Review Corpus now uses its own localStorage key, stores the review backend root for Value/Action, and reports the full failed URL when a fetch fails.
- `val-act.html`: normalizes backend root URLs, accepts either bare root or `/api/lumina`, prefers the Review Corpus backend root, and reports the full failed URL.

Expected frontend settings:
- Review Corpus backend API base: `https://review-corpus-backend-...run.app/api/lumina`
- Value/Action backend URL: `https://review-corpus-backend-...run.app` (bare root)
