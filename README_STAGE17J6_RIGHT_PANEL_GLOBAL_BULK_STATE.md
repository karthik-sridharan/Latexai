# Stage 17J6 — Right panel global Expand all / Collapse all

Fixes the remaining right-panel organizer issue where the Stage 17J5 bulk command could collapse Copilot groups while leaving Settings groups open.

## Change

- Treat every **Expand all** / **Collapse all** toolbar button as a right-panel-wide command.
- Applying collapse/expand now writes forced state for both `copilot` and `settings`.
- The report should show both Copilot and Settings groups as `collapsed, body hidden` after pressing **Collapse all**.

## Stage

`stage17j6-right-panel-organizer-global-bulk-state-1`
