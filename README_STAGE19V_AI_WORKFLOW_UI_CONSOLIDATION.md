LatexAI Stage 19V — AI Workflow and UI Consolidation
=====================================================

Stage marker: latex-stage19v-ai-workflow-ui-consolidation-20260602-1

This patch implements the uploaded Stage 19V workflow cleanup plan:

- Renames the generic Paper-level AI card to **Total Paper Remake**.
- Removes the old four-option paper-level workflow selector from the UI.
- Keeps Total Paper Remake focused on whole-paper remake/reorganization with prompt, aggressiveness, output mode, insertion mode, target audience, target venue, style preferences, project memory, selected collections, and references.
- Moves review-style improvement into **Reviewer / Rebuttal Simulator** via workflow modes:
  - Quick review + improvements
  - Review only
  - Review + rebuttal
  - Review + rebuttal + revise
- Adds one-reviewer quick-improvement support.
- Keeps the optional final editor revision path and safe edit preview/apply buttons.
- Disables the legacy Devil's Advocate paper debate service and disables the old inert loader entry.
- Keeps Devil's Advocate work on the newer branch runner and adds target audience, target venue, improvement goal, critique level, and output mode UI controls.
- Scopes the main Copilot label/description as a local editing assistant.
- Updates dashboard/report/routing labels away from the legacy paper-level and legacy Devil's Advocate debate language.

Notes:

- Backend API behavior is unchanged; the backend patch only updates the stage marker and status payload with the workflow cleanup summary.
- Existing safe edit compiler and reviewer/rebuttal backend routes are reused.
- The old legacy devils-advocate-debate JS file is now a small no-op compatibility stub so saved projects or dashboard references do not crash.

Verification checklist:

1. Main right tab says AI workflows and Copilot says AI Copilot — local editing assistant.
2. Total Paper Remake card appears instead of Paper-level AI.
3. Total Paper Remake no longer shows Review / Ranking / Competitive agent options.
4. Reviewer/Rebuttal shows the workflow mode selector and can run quick one-reviewer improvement.
5. Reviewer/Rebuttal still supports review, rebuttal, final editor revision, preview final edits, and apply final edits.
6. Legacy Devil's Advocate paper debate card does not appear.
7. Devil's Advocate branch runner remains visible and has target audience, venue, improvement goal, critique level, rounds, and output mode controls.
8. Competitive Review remains its own card.
9. Citation AI / Knowledge Retriever remain separate.
