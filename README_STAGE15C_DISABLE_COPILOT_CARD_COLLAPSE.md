# Stage 15C: disable Copilot card collapse

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/ui-cleanup-service.js`
- `css/lai-stage15a-ui-cleanup.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage15c-disable-copilot-card-collapse-1`

## What this fixes

Stage 15A/15B still left blank horizontal bars in the Copilot tab on iPad/Safari.

Stage 15C removes the source of the problem entirely:

- no Copilot card collapsing;
- unwraps old Stage 15A/15B card wrappers;
- removes old blank card headers;
- forces old hidden card bodies visible;
- keeps only safe UI cleanup: tab stabilization, compact mode, panel scrolling.

## New button

Near the right-panel tabs:

```txt
Restore Copilot tools
```

Use it if Safari keeps a stale DOM state after refresh.

## Test

Included:

`tests/stage15c-disable-copilot-card-collapse.test.cjs`

Run:

```bash
node tests/stage15c-disable-copilot-card-collapse.test.cjs
```
