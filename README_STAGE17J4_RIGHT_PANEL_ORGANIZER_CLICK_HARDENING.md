# Stage 17J4: right panel organizer click hardening

Changed files:

- `index.html`
- `js/right-panel-organizer-service.js`
- `css/lai-stage17j-right-panel-sections.css`
- `tests/stage17j4-right-panel-organizer-click-hardening.test.cjs`

## What this fixes

The previous build could make **Expand all** / **Collapse all** appear to do nothing for two reasons:

1. `index.html` was cut off inside the Stage 17J fallback loader, leaving a malformed inline script at the end of the file.
2. The organizer only grouped later optional feature cards. The original visible Settings controls, such as Compile backend URL, compiler provider, TeXlyre settings, and the core Copilot prompt controls, stayed outside the collapsible groups. So the buttons could toggle internal groups while the visible content stayed open.

Stage 17J4 fixes both problems.

## Behavior after this patch

In Settings:

- A `Compile / backend settings` section wraps the main Settings controls.
- **Collapse all** closes that section and hides the compile/backend controls.
- **Expand all** opens it again.

In Copilot:

- A `Core Copilot prompt` section wraps the provider/model/prompt controls.
- **Collapse all** visibly hides the core Copilot controls and all optional Copilot workflow sections.

The button handler is also hardened by:

- using explicit `data-rpo-action` and `data-rpo-tab` attributes;
- keeping backward-compatible `data-rpo-expand`, `data-rpo-collapse`, and `data-rpo-refresh` attributes;
- using document-level delegated handlers for click, pointerup, and keyboard activation;
- forcing `<details open>`, `hidden`, `aria-expanded`, and inline display state together;
- raising the toolbar z-index and explicitly enabling pointer events;
- adding a repaired fallback loader that loads the organizer even if an old feature-loader cache or saved feature flag state interferes.

## Test

Run:

```bash
node --check js/right-panel-organizer-service.js
node tests/stage17j4-right-panel-organizer-click-hardening.test.cjs
```

I also ran a local browser-level smoke check with Chromium/Playwright against a minimal DOM. The smoke check verified that Settings **Collapse all** closes all Settings groups, including `Compile / backend settings`, and **Expand all** reopens them.

## Cache-busted URL

After deploying, open:

```text
https://karthik-sridharan.github.io/Latexai/?v=stage17j4-right-panel-organizer-click-hardening-1
```
