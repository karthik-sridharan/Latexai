# Stage 19N1E — Final-editor-only deduplicated section edits

This is a frontend-only patch on top of Stage 19N1D-rev2.

## Why

The multi-round Devil's Advocate workflow was inserting repeated red `\lai{...}` edits because the insertion stage could collect candidate `\lai` blocks from several agents: citation reviewer, critic, synthesizer, and editor. Those agents often repeated the same citation-gap or related-work suggestion in slightly different wording. The final PDF therefore showed many duplicate edits.

A second feedback loop also caused repeats: if the user reran the debate after applying red `\lai` edits, the next prompt could include those previous edits as if they were part of the original paper.

## What changed

1. The insertion step now prefers only the final editor agent's parseable `\lai{...}` blocks.
2. Earlier reviewer/critic/advocate/synthesizer outputs are used as debate context, not as direct insertion sources.
3. If the final editor fails to return parseable `\lai` blocks, the old cleaner output is used only as fallback.
4. The frontend deduplicates insertion blocks by target section and normalized body text.
5. If a section has real edits, contradictory `No edits recommended` blocks for the same section are dropped.
6. Already-applied exact or near-exact `\lai` blocks are skipped before generating a new insertion draft.
7. Visible AI edit blocks from previous runs are stripped from the visible debate prompt context, so the next debate does not repeat old red edits.
8. Prompt templates now explicitly instruct non-editor agents not to output final `\lai` blocks and instruct the editor to consolidate duplicate suggestions.

## Changed files

- `js/real-agent-branch-workflow-service.js`
- `prompt/devils-advocate-branch-runner/citation-reviewer.txt`
- `prompt/devils-advocate-branch-runner/critic.txt`
- `prompt/devils-advocate-branch-runner/advocate.txt`
- `prompt/devils-advocate-branch-runner/synthesizer.txt`
- `prompt/devils-advocate-branch-runner/editor.txt`
- `prompt/devils-advocate-branch-runner/coverage-branch.txt`
- `prompt/devils-advocate-branch-runner/coverage-multisection.txt`

## Test

Open the app with:

```text
?v=19n1e
```

Use:

```text
Target mode = whole paper or selected sections
Visible prompt context = whole paper truncated + selected focus
Debate rounds = 2
Insertion mode = targeted or append
```

After `Run full preview`, the preview should show fewer blocks and the warning should mention Stage 19N1E final-editor-only deduplication. The applied PDF should not contain repeated near-identical red suggestions.
