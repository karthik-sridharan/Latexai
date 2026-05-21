# Stage 17J9 — right panel organizer visible catch-all fix

This stage fixes the case where Expand all / Collapse all updates the organizer report but some visible Copilot cards remain outside any collapsible group.

Changes:

- Adds `documentAiCard` to the Paper AI group.
- Adds `copilotContextChips` to the Core Copilot group.
- Adds catch-all groups for any remaining direct children in Copilot or Settings.
- Keeps Stage 17J8's controlled button shell, avoiding native `<details>`.
- Uses a new state key: `latexai:right-panel-sections:v4`.

Verification:

- Local Chromium DOM smoke test confirms no visible non-toolbar children remain outside organizer groups after collapse.
- Mouse-event checks confirm bulk collapse/expand and individual group header toggles.
