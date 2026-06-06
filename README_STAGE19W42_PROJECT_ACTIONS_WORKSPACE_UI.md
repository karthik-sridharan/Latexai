# Stage 19W42 — Project actions workspace UI

This stage cleans up the Project tab around the new Project Workspace model.

## User-facing changes

- `Open GitHub` is renamed to `Open Project`.
- `Save local` is renamed to `Save Project` and now commits the active GitHub-backed project.
- A `Save comment for GitHub` input was added beside project actions.
- `Import` is renamed to `Import Project` and imports TeX/support files as a fresh project with fresh workspace identity/memory.
- `Export zip` is unchanged.
- Git-specific actions under the file tree (`Open GitHub`, `Save GitHub`, `Checkpoint`, `Load attached`) are removed from the visible file-tree UI.
- The file tree is now only the file browser.
- `Insert file`, `Insert folder`, and `Revert version` actions were added under Project files.
- Per-file download moved to a small `⇩` icon next to rename/delete.

## Backend dependency

For `Open Project` listing and `Revert version`, deploy the matching GitHub sync backend Stage 19W42.
The frontend falls back to manual owner/repo entry if project listing is unavailable.

## Notes

`New Project` still creates a GitHub repository with default project files and a fresh workspace/memory identity.
`Save Project` requires an attached GitHub-backed project; otherwise it saves locally and reports that the project is not GitHub attached.
