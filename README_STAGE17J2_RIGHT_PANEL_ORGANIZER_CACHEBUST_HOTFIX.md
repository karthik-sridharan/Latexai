# Stage 17J2: right panel organizer cache-bust hotfix

Changed files:

- `index.html`
- `js/feature-flag-service.js`
- `js/right-panel-organizer-service.js`
- `css/lai-stage17j-right-panel-sections.css`

## Fix

Stage 17J correctly added the organizer feature, but `index.html` still referenced the feature flag loader with the old cache key:

```txt
js/feature-flag-service.js?v=stage15j-feature-flag-registry-guarded-loader-1
```

On GitHub Pages/Safari this could load the old cached registry, so the feature flag **Right panel collapsible sections** did not appear and the organizer script did not load.

Stage 17J2:

- cache-busts `feature-flag-service.js`;
- cache-busts the organizer JS/CSS;
- adds a tiny fallback loader for `right-panel-organizer-service.js` if a cached feature loader misses it;
- adds one more delayed organization pass for late-loading cards.

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage17j2-right-panel-organizer-cachebust-hotfix-1`
