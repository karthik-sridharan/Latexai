# Stage 15I: release/deploy verifier

Changed files:

- `index.html`
- `js/release-verify-service.js`
- `css/lai-stage15i-release-verify.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage15i-release-deploy-verifier-1`

## What this adds

A **Release/deploy verifier** card in Settings.

It checks:

- which app stage is actually loaded;
- query `v` cache-buster;
- DOM stage markers;
- loaded script/CSS version params;
- current deployed `index.html` fetched with cache bypass;
- whether expected recent JS/CSS files are referenced and reachable.

Buttons:

- Verify deployment
- Copy report
- Reload cache-busted
- Open safe mode

It does not compile and does not call AI.
