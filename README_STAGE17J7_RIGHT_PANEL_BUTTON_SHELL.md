# Stage 17J7 — right-panel organizer controlled button shell

Stage string: `stage17j7-right-panel-organizer-button-shell-1`

This stage replaces the right-panel organizer's native `<details>` groups with a controlled shell:

- group container: `<div class="right-panel-group" data-rpo-open="true|false">`
- group header: `<button type="button" class="right-panel-group-summary" data-rpo-group-toggle="tab:key">`
- group body: `<div class="right-panel-group-body">`

Why: Stage 17J4-J6 mixed native `<details>` toggles, forced hidden/body state, and delayed organize passes. On iPad/Safari this could leave bulk buttons working only partially, while individual section headers stopped toggling. Stage 17J7 removes native details from the path so bulk buttons and individual group headers use the same `setGroupOpen` function.

Behavior to verify after deploy:

1. Open Copilot. Click **Collapse all**. All Copilot section bodies should hide.
2. Click **Expand all**. All Copilot section bodies should show.
3. Click an individual Copilot section header. Only that section should toggle.
4. Open Settings. Repeat the same checks.
5. Click **Copy report**. Collapsed sections should report `collapsed, body hidden`.

The stage also clears the old `latexai:right-panel-sections:forced-tab-state:v1` localStorage key so stale Stage 17J5/J6 forced state cannot keep individual group headers from opening or closing.
