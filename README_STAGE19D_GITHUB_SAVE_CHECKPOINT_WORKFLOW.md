# Stage 19D — GitHub Save and Checkpoint Workflow

Frontend-only stage. No backend redeploy is required if the Stage 19C GitHub sync backend is already deployed.

## What changed

- Adds a clearer GitHub save workflow in the file tree:
  - `Save GitHub` commits the current project files to the attached repository.
  - `Checkpoint` creates a named checkpoint commit.
- Shows the currently attached GitHub repository in the file-tree header.
- Keeps AI, memory, compile, and GitHub backend URLs/settings unchanged.
- Uses the existing GitHub backend `/autosave-commit` endpoint with `expectedHeadSha`, so stale local state does not silently overwrite a changed remote branch.
- Adds automatic GitHub checkpoints before risky source-changing AI actions:
  - Competitive Review → AI remake + insert `\lai` edits.
  - Competitive Review → AI remake + append `\lai` plan.
  - Reviewer/Rebuttal Simulator → final synthesis.

## Expected visual change

In the left file/project panel, the GitHub action row should include:

```text
Check  Load  Save GitHub  Checkpoint
```

The project-file header should also show the attached GitHub repo, e.g.

```text
GitHub: owner/repo @ main
```

## Deploy

Upload the patch files preserving paths, then open:

```text
https://karthik-sridharan.github.io/Latexai/?v=19d
```

## Backend

This stage uses the already-deployed GitHub sync backend. No GitHub backend changes are needed.
