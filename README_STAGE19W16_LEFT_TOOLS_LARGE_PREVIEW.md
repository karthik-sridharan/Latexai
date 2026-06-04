# LatexAI Stage 19W16 — Left-tool tabs + large right Preview/Logs

Stage marker:

```text
latex-stage19w16-left-tools-large-preview-20260604-1
```

## Goal

Make the PDF/draft preview much larger by moving user-facing workflow tabs out of the right panel.

New layout:

```text
Left panel  = Project + tools
Center      = LaTeX source editor
Right panel = Preview / Logs only
```

The center editor and right preview/log panels now use comparable scaling, closer to Prism/Overleaf-style layouts.

## What changed

- Right panel now only has:
  - Preview
  - Logs
- Left panel now has tool tabs:
  - Project
  - Copilot
  - Paper AI
  - Literature
  - Audit Edits
  - Context / MCTS
  - Settings
- The old right-side Project workflow has been renamed to **Context / MCTS**.
- The actual project/file tree and document map now live under the left **Project** tab.
- Copilot, Paper AI, Literature, Context/MCTS, Settings, and Audit Edits are moved to the left panel at runtime while preserving DOM ids for existing services.
- PDF/Draft preview and logs fill the right panel height and width.

## Changed files

```text
index.html
css/lai-stage19w16-left-tools-preview-layout.css
js/stage19w16-left-tool-tabs-service.js
js/stage19w10-workflow-tabs-service.js
js/right-panel-organizer-service.js
README_STAGE19W16_LEFT_TOOLS_LARGE_PREVIEW.md
```

## Validation run

```text
node --check js/stage19w16-left-tool-tabs-service.js
node --check js/stage19w10-workflow-tabs-service.js
node --check js/right-panel-organizer-service.js
HTML parser smoke check for index.html
static checks: right panel has only Preview/Logs buttons; Stage 19W16 service is loaded
```

## Manual test plan

1. Deploy changed frontend files.
2. Hard refresh the app.
3. Confirm the right panel only shows **Preview** and **Logs**.
4. Confirm the left panel has tabs:
   - Project
   - Copilot
   - Paper AI
   - Literature
   - Audit Edits
   - Context / MCTS
   - Settings
5. Open Project and confirm source tree/document map appear.
6. Open Paper AI and confirm the unified Goal-driven Paper AI panel appears.
7. Open Context / MCTS and confirm block context/MCTS-lite tools appear.
8. Open Audit Edits and confirm \lai / \laiold audit tools appear.
9. Switch right panel Preview/PDF/Logs and confirm it remains large and similar scale to the editor.
10. Test `?debug=1` and confirm developer diagnostics remain under left Settings.
