# Stage 4N: remove debug badges

Upload/replace:

- `index.html`
- `.nojekyll`
- `js/lai-stage4l-lai-guard.js`
- `js/lai-stage4m-compile-safe-lai.js`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage4n-remove-debug-badges-1`

## What changed

- Removed the static HTML diagnostic badge.
- Disabled the top-right Stage 4L rewrite guard badge.
- Disabled the top-right Stage 4M macro guard badge.

## What still works

- Rewrite guard still forces `\lai{...}`.
- Old source is still commented.
- Root macro is still inserted before compile when needed.
