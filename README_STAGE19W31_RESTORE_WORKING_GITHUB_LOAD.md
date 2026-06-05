# Stage 19W31 — restore working GitHub load path

This patch is built on top of Stage 19W30 full frontend source, but backs out the recent frontend-only changes to `js/file-tree.js` that altered GitHub load error handling and branch fallback.

Why: GitHub repository loading worked in the latest stable baseline before the drawer cleanup/branch-fallback patches. The backend token and repository permissions were verified from GitHub, so this restores the previous request path instead of continuing to diagnose backend auth.

Kept from recent stages:
- Settings drawer cleanup from Stage 19W29/19W30.
- Dedicated GitHub backend settings drawer.
- Latest frontend files from Stage 19W30 everywhere except the GitHub load implementation in `js/file-tree.js`.

Changed:
- `js/file-tree.js` restored to the last known working Stage 19W28 GitHub load behavior.
- Removed the Stage 19W30 client-side branch fallback path from the live implementation.
- Restored the original `gitFetch` failure behavior so only HTTP failures throw, matching the working frontend behavior.

Validation:
```bash
node --check js/file-tree.js
node --check js/backend-url-settings-service.js
node --check js/right-panel-organizer-service.js
```
