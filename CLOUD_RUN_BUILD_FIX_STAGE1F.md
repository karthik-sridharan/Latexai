# Stage 1F Cloud Run Build Fix

This hotfix removes the direct `@express-rate-limit/core` / `express-rate-limit` dependency and replaces it with a tiny in-memory rate limiter in `backend/server.mjs`.

Why: Google Cloud Build failed during `npm install --omit=dev` because npm could not resolve `@express-rate-limit/core@^8.1.0` from the registry. The backend only needs basic request limiting, so removing that package avoids the external dependency issue and makes Cloud Run builds more reliable.

Retry from `backend/`:

```bash
gcloud builds submit --tag "$IMAGE" .
```
