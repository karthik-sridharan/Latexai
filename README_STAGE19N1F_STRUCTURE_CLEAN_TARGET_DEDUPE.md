# Stage 19N1F — Structure-clean target detection and stronger section-edit deduplication

Frontend-only patch on top of Stage 19N1E.

## Problem fixed

After applying visible `\lai{...}` edits, the next run could parse headings inside those edits, especially
`\paragraph{Target section: ...}`, as if they were real document sections. That made whole-paper and salient
runs target old AI edits and repeat them. In addition, final editor output could still contain multiple near-identical
variants for the same target section.

## Changes

- Document target detection now ignores headings inside prior `\lai{...}` / `\laiold{...}` blocks and Latexai suggestion wrappers.
- Detected targets skip titles beginning with `Target section:`.
- Target inference maps noisy labels like `Target section: Contributions. No edits recommended...` back to the actual requested target `Contributions`.
- Insertion deduplication now uses per-target near-duplicate detection, not only exact-string matching.
- If a section has actual edits, contradictory `No edits recommended` markers for that same section are dropped.
- Excessive variants for one target are capped to the first two non-overlapping edits.
- Prompt templates now tell the final editor to consolidate transcript suggestions and avoid producing multiple paraphrases of the same edit.

## Deploy

Deploy changed files:

```text
js/real-agent-branch-workflow-service.js
prompt/devils-advocate-branch-runner/coverage-branch.txt
prompt/devils-advocate-branch-runner/coverage-multisection.txt
prompt/devils-advocate-branch-runner/citation-reviewer.txt
prompt/devils-advocate-branch-runner/critic.txt
prompt/devils-advocate-branch-runner/advocate.txt
prompt/devils-advocate-branch-runner/synthesizer.txt
prompt/devils-advocate-branch-runner/editor.txt
README_STAGE19N1F_STRUCTURE_CLEAN_TARGET_DEDUPE.md
```

Open with cache busting:

```text
?v=19n1f
```

## Test

1. Open the main app with `?v=19n1f`.
2. Use the Devil's Advocate branch runner.
3. Click **Refresh detected targets**.
4. Confirm old AI `Target section:` markers are not listed as targetable document units.
5. Run with whole-paper or salient targets.
6. Check insertion preview: repeated paraphrases for the same target should be collapsed.
