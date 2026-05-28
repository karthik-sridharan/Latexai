# Stage 19N1D-rev2 — Prompt Files + At-Least-One Target Coverage

This frontend-only revision updates the main-editor Devil's Advocate branch workflow.

## Changes

1. Revises the final editor instruction from “exactly one block per target” to:
   - at least one `\lai{...}` coverage block per requested target section/unit;
   - multiple `\lai{...}` blocks are allowed when a target needs multiple changes;
   - exactly one `No edits recommended` block is used only when no edit is needed for that target.

2. Moves the debate prompt templates out of JavaScript into text files under:

```text
prompt/devils-advocate-branch-runner/
```

3. Adds runtime prompt loading from static `.txt` files with cache busting.

## New prompt files

```text
prompt/devils-advocate-branch-runner/base-context.txt
prompt/devils-advocate-branch-runner/coverage-branch.txt
prompt/devils-advocate-branch-runner/coverage-multisection.txt
prompt/devils-advocate-branch-runner/citation-reviewer.txt
prompt/devils-advocate-branch-runner/critic.txt
prompt/devils-advocate-branch-runner/advocate.txt
prompt/devils-advocate-branch-runner/synthesizer.txt
prompt/devils-advocate-branch-runner/editor.txt
prompt/devils-advocate-branch-runner/default-step.txt
```

## Deploy changed files

```text
index.html
js/real-agent-branch-workflow-service.js
prompt/devils-advocate-branch-runner/*.txt
README_STAGE19N1D_REV2_PROMPT_FILES_AND_AT_LEAST_ONE_COVERAGE.md
```

Open the app with:

```text
?v=19n1d-rev2
```

## Expected behavior

For target mode = whole paper or user-selected targets, the final editor agent is instructed to output at least one section-labeled `\lai{...}` block for every requested target. Sections requiring no change should receive:

```latex
\lai{\paragraph{Target section: <exact section title>} No edits recommended.}
```

Sections requiring multiple changes may receive multiple blocks with the same target section label.
