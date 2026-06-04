# Stage 19W18 — Audit AI, Paper AI direct mode, Figures and Presentation tabs

Marker: `latex-stage19w18-audit-paperai-figures-presentation-tabs-20260604-1`

Frontend-only cleanup.

Changes:
- Main left tabs are now Project, Audit AI, Paper AI, Literature, Figures, Presentation, Context / MCTS, Settings.
- Copilot is renamed to Audit AI and no longer shows the old core Copilot prompt controls.
- Audit AI contains Audit AI Edits plus History / Comments.
- Paper AI gets review/debate rounds = -1 for direct prompt/edit with no reviews, replacing the old core Copilot use case.
- Figures tab is restored and owns Image assets / Draw figure / TikZ / Image-to-TikZ tools.
- Presentation is a separate tab and no longer lives under Audit AI/Copilot.
- Right panel remains Preview / Logs only.

Backend unchanged.
