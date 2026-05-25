# Stage 19E3 — Open GitHub specific repo selection fix

Fixes a Stage 19E2 issue where `Open GitHub` could still load the most recently attached/newly-created Latexai repo instead of the older repo typed by the user.

Root cause: after the Open GitHub prompt set `git.owner/git.repo`, `loadFromGithub()` called `pullGitSetup()`, which could read stale Git panel inputs and overwrite the explicit prompt selection.

Fix:
- `pullGitSetup({ keepRepoSelection: true })` preserves the repo/branch/folder selected by the prompt.
- `Load attached` still reads the currently attached Git settings.
- `Open GitHub` now reliably loads the owner/repo entered by the user.

No backend redeploy is required.
