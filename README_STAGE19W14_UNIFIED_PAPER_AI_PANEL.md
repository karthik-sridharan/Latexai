# Stage 19W14 — Unified Paper AI panel

This frontend patch removes Paper AI workflow subtabs and replaces them with one goal-driven Paper AI panel.

The unified panel routes to existing engines based on user choices:

- Objective = Full remake / reorganization -> Total Paper Remake
- Objective = Improve quality / acceptance -> Reviewer/Rebuttal simulator
- Objective = Stress-test with adversarial critique -> Devil’s Advocate branch runner
- Objective = Improve ranking -> Competitive Review
- Objective = Combined -> review/rebuttal + adversarial + competitive engines

Core controls:

- objective
- scope
- review/debate rounds
- output mode: report only / edits only / report + edits
- improvement focus
- budget
- reviewer count
- target venue/audience
- competitors for ranking objectives
- context toggles

Reviewer/Rebuttal report+edits and edits-only modes now automatically prepare a Safe Edit Compiler preview after the final editor/synthesis step, using the existing `\laiold` / `\lai` pipeline.

Expected marker: `latex-stage19w14-unified-paper-ai-panel-20260604-1`.
