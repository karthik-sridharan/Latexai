# Stage 19L6b — Selector Render Fix

Changed frontend files:

- `developer-debate-branches.html`

Purpose:

- Make the selected branch/planner output explicit in the developer page.
- Add a visible `Stage 19L6b render-fix` marker in the page header.
- Add a `Selector field check` panel showing whether the response includes:
  - `selectedBranch`
  - `selectedBranches`
  - `executionPlan`
  - `realAgentRunPayload`
  - `branches`
  - `trajectory`
- Render the literal field name `selectedBranch` in the selected plan section.
- Robustly render fallback branch data when the selected branch is nested in `realAgentRunPayload`.

Deploy by overwriting `developer-debate-branches.html`, then open:

`developer-debate-branches.html?v=19l6b2`

Click `Generate + evaluate + rollout + select`.
