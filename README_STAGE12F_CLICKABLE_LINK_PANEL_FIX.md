# Stage 12F: clickable citation link panel fix

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/citation-verifier-service.js`
- `css/lai-stage12b-citation-verifier.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage12f-clickable-link-panel-fix-1`

## What this fixes

Stage 12E rendered `<a>` tags, but in the app panel they could still behave like plain text if another panel/editor handler swallowed the click.

Stage 12F makes links reliable by:

- rendering the verifier output as a normal `<div>` instead of `<pre>`
- adding `class="citation-click-link"` and `data-url`
- adding a delegated click handler on the verifier output panel
- stopping propagation so app/panel handlers do not swallow clicks
- explicitly opening the URL in a new tab
- falling back to `window.location.href` if pop-up/new-tab opening is blocked

## Test

Included:

`tests/stage12f-clickable-link-panel-fix.test.cjs`

Run:

```bash
node tests/stage12f-clickable-link-panel-fix.test.cjs
```
