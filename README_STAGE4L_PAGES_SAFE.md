# Stage 4L Pages-safe LAI guard

Upload/replace:

- `index.html`
- `js/lai-stage4l-lai-guard.js`
- `.nojekyll`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage4l-pages-safe-lai-guard-1`

## Why this fixes the current problem

Your Actions page shows the GitHub Pages builds are failing, so the live site is
still the old Stage 3I deployment.

Stage 4K put the guard inline in `index.html`. That inline JavaScript included
LaTeX macro text containing `{%`, which Jekyll/Liquid can interpret as a Liquid
tag and fail the Pages build.

Stage 4L avoids that:

- `index.html` contains no inline guard JavaScript.
- The guard is external: `js/lai-stage4l-lai-guard.js`.
- `.nojekyll` is included so GitHub Pages should not run Jekyll/Liquid processing.

## Visual checks

After a successful Pages deployment:

1. You should see a blue static badge:
   `Stage 4L HTML served`

2. Then the external JS should add a red badge:
   `LAI Guard Stage 4L active`

If you do not see `Stage 4L HTML served`, Pages is not serving the new `index.html`.

If you see the blue badge but not the red badge, the HTML deployed but the JS did not load.
