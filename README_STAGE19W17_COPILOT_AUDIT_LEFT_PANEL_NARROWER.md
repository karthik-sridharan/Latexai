LatexAI Stage 19W17 — Copilot audit placement and narrower left panel
====================================================================

Marker:
  latex-stage19w17-copilot-audit-left-panel-narrower-20260604-1

Frontend-only patch. Backend unchanged.

Changes
-------
- Removed Audit Edits as a top-level left tool tab.
- Kept Audit AI Edits inside the Copilot tab only.
- Moved the paperAiPolishCard into a Copilot audit wrapper after the Copilot output.
- Kept stale links/localStorage using audit compatible by redirecting audit -> copilot.
- Reduced the left panel width slightly so editor/preview get more room.
- The right panel remains Preview / Logs only.

Expected UI
-----------
Left tool tabs should be:
  Project, Copilot, Paper AI, Literature, Context / MCTS, Settings

Audit AI Edits should appear only inside Copilot.
