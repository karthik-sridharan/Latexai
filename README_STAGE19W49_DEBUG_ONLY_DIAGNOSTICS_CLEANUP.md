# Stage 19W49 — Debug-only diagnostics drawer cleanup

This frontend cleanup makes Settings diagnostics explicitly debug-only.

## Changes

- The Settings **Diagnostics** drawer is rendered only when the URL enables debug mode, such as `?debug=1`.
- The diagnostics drawer is removed from normal Settings mode.
- Feature flags / optional modules card is marked debug-only.
- Removed the obsolete **Legacy debate disabled** row from feature flags.
- Removed the obsolete **Experimental UI cleanup** row from feature flags.
- Kept diagnostic infrastructure available for debug deployments.
- Cache-busted `right-panel-organizer-service.js`, `feature-flag-service.js`, and `main.js`.

## Debug mode

Open the app with one of:

```text
?debug=1
?dev=1
?laiDebug=1
?luminaDebug=1
?diagnostics=1
```

Then Settings will show Diagnostics again.
