# Stage 19I2 — Reviewer/Rebuttal Buttons and Role Context Fix

This frontend-only hotfix fixes two Stage 19I issues:

1. Reviewer/Rebuttal Simulator buttons could appear visible but fail to trigger reliably after right-panel/card refreshes. The service now installs a delegated click handler for the simulator buttons.
2. Reviewer/Rebuttal Simulator context requests used noncanonical role labels such as `simulated_reviewer_agent`, `defender_rebuttal_agent`, and `editor_synthesis_agent`. The backend Stage 19I context profiles use canonical roles (`critic`, `defender`, `editor`, `evaluator`, `citation_auditor`, `notation_auditor`). The simulator now maps review/rebuttal/synthesis steps to those roles so Neon `agent_context_usage_stats` updates after reviewer/rebuttal workflows.

No backend redeploy is required if Stage 19I backend is already deployed.
