# Stage 19L6 — Developer Branch Selector Frontend

Extends `/developer-debate-branches.html` with a cheap branch-selection and
real-agent-run planning panel.

## New controls

- Selection limit
- Record selection trajectory
- Planner mode
- Select best branch
- Generate + evaluate + rollout + select
- Copy select curl

## New output

- Selected execution plan
- Selected branch score/reasons
- Planned agent sequence
- Cost estimate
- Real-agent-run payload preview

No LLM call is made by this developer page. The generated payload is meant for
the next Stage 19M real-agent runner.
