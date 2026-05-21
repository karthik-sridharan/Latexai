# Stage 15D: freeze hotfix / disable UI cleanup

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/ui-cleanup-service.js`
- `css/lai-stage15a-ui-cleanup.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage15d-freeze-hotfix-disable-ui-cleanup-1`

## Why this exists

Stage 15A/15B/15C used MutationObservers and repeated DOM cleanup around the Copilot tab. On Safari/iPad this can trigger mutation loops and make the page appear frozen.

Stage 15D disables that system.

## What remains

Only safe behavior remains:

- right-tab click handling;
- one-time cleanup of stale Stage 15A/15B wrappers;
- no card collapsing;
- no MutationObservers;
- no intervals;
- no `inert`.

This should restore the site to a stable state while keeping Stage 14B compile/path-fixer functionality.
