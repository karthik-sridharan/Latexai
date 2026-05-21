# Stage 17J8 — right panel organizer browser-verified click fix

Stage string: `stage17j8-right-panel-organizer-browser-verified-1`

This stage fixes the remaining expand/collapse problem against the actual deployed Stage 17EF/17J3 source line.

## What changed

- Repairs the truncated `index.html` fallback loader at the end of the file.
- Replaces native `<details>` sections with controlled `div` shells and explicit button headers.
- Adds the missing core groups:
  - `copilot/Core Copilot prompt`
  - `settings/Compile / backend settings`
- Uses a fresh state key, `latexai:right-panel-sections:v3`, so stale Stage 17J4–17J7 state cannot keep overriding clicks.
- Clears the old forced-state key, `latexai:right-panel-sections:forced-tab-state:v1`.
- Handles clicks through capture-phase delegated listeners plus direct pointer/mouse/touch/key handlers.
- Keeps a copyable organization report with `collapsed, body hidden` status.

## Browser smoke check performed

A local Chromium DOM smoke check injected the real Stage 17J8 organizer service and CSS into representative Copilot/Settings right-panel markup, then dispatched native mouse events to:

1. Collapse all Copilot groups.
2. Toggle an individual Copilot header.
3. Collapse all Settings groups.
4. Toggle an individual Settings header.

All checks passed. In this container, Chromium blocks direct `file:` and `localhost` navigation by policy, so the smoke test used an `about:blank` DOM harness while still executing the actual Stage 17J8 service and CSS.

## Manual check after deployment

Open:

```text
https://karthik-sridharan.github.io/Latexai/?v=stage17j8-right-panel-organizer-browser-verified-1
```

Then verify:

- Copilot → Collapse all hides every Copilot group body.
- Copilot → a single group header toggles only that group.
- Settings → Collapse all hides every Settings group body, including Compile / backend settings.
- Settings → a single group header toggles only that group.
- Copy report shows collapsed rows as `collapsed, body hidden`.
