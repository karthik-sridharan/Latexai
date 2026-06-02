# Stage 19W10 — Right-panel workflow tabs and debug-only diagnostics

Marker:

```text
latex-stage19w10-right-panel-workflow-tabs-debug-cleanup-20260602-1
```

## Goal

Clean up the main LatexAI right panel so normal writing workflows are not mixed with developer diagnostics.

## What changed

- Added primary right-panel tabs:
  - Preview
  - Logs
  - Copilot
  - Paper AI
  - Literature
  - Project
  - Settings
- Scoped Copilot as **AI Copilot — Local editing assistant**.
- Added a Paper AI tab with subtabs:
  - Total Remake
  - Review / Rebuttal
  - Devil’s Advocate
  - Competitive
- Dynamically moves existing workflow cards into the correct subtab:
  - `documentAiCard` → Total Remake
  - `reviewerRebuttalCard` → Review / Rebuttal
  - `realAgentBranchCard` → Devil’s Advocate
  - `competitiveReviewCard` → Competitive
- Added a Literature tab and moves citation tools there:
  - `citationAiCard`
  - `citationVerifierCard`
- Added a Project tab and moves block/MCTS context there:
  - `projectBlockContextCard`
- Added Settings → Developer / diagnostics area.
- Hides diagnostic cards unless URL contains `?debug=1`:
  - AI workflow dashboard
  - regression checklist
  - context-policy logging dashboard
  - backend diagnostics
  - release verifier
  - AI routing inspector
- Keeps cards mounted in the DOM and moves them instead of deleting them, so existing services and event handlers remain stable.

## Debug behavior

Normal mode:

```text
index.html
```

Diagnostics are hidden.

Debug mode:

```text
index.html?debug=1
```

Developer / diagnostics appears inside Settings.

## Files changed

```text
index.html
css/lai-stage19w10-workflow-tabs.css
js/stage19w10-workflow-tabs-service.js
README_STAGE19W10_RIGHT_PANEL_WORKFLOW_TABS.md
```

## Validation run

```text
node --check js/stage19w10-workflow-tabs-service.js
node --check js/project-block-context-service.js
node --check js/context-policy-dashboard-service.js
node --check js/reviewer-rebuttal-simulator-service.js
HTML parser smoke check
static stage marker / panel / card-routing checks
```

## Manual test checklist

1. Open the app normally without `debug=1`.
2. Confirm the right panel tabs include Preview, Logs, Copilot, Paper AI, Literature, Project, Settings.
3. Open Copilot and confirm it only shows local editing controls plus local output.
4. Open Paper AI and switch between subtabs:
   - Total Remake
   - Review / Rebuttal
   - Devil’s Advocate
   - Competitive
5. Confirm each workflow appears only in its selected subtab.
6. Open Literature and confirm Citation AI / verifier cards appear there when loaded.
7. Open Project and confirm Project block context + MCTS-lite appears there when loaded.
8. Confirm AI dashboard, regression checklist, and context-policy dashboard are hidden in normal mode.
9. Reload with `?debug=1` and confirm Settings → Developer / diagnostics shows the hidden diagnostic cards.
10. Run a simple workflow from each visible tab to verify buttons still work after card re-homing.
