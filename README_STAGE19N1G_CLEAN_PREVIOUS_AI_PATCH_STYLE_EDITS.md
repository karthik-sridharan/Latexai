# Latexai Stage 19N1G — Clean Previous AI Suggestions + Patch-Style Edits

Frontend-only patch on top of Stage 19N1F.

## Why this stage exists

After several Devil's Advocate branch runs, the active source can contain old visible `\lai{...}` suggestions and old `Target section: ...` markers. Those markers can be re-read as paper text or even as targetable structure, causing repeated red edits in later runs.

Stage 19N1G adds two safeguards:

1. A source cleanup action before rerunning the debate.
2. A patch-style final-editor contract so final output is paper-ready text, not review advice.

## User-visible changes

In the main-editor Copilot tab, the Devil's Advocate branch runner now includes:

- `Clean previous AI suggestions`
- duplicate-heading warnings before run/target refresh
- stronger final-editor-only insertion filtering

## Prompt contract changes

The final editor should no longer output visible advice such as:

- `Add a paragraph ...`
- `Insert after ...`
- `Replace the current paragraph with ...`
- `Consider citing ...`

Instead, the editor must output actual patch-style LaTeX:

```latex
\lai{%
% Target section: <exact section title>
<actual LaTeX-ready inserted text>
}
```

or true replacement patches:

```latex
\laiold{<short exact old text>}\lai{%
% Target section: <exact section title>
<actual LaTeX-ready replacement text>
}
```

If no edit is recommended:

```latex
\lai{%
% Target section: <exact section title>
\emph{No edits recommended.}
}
```

The target label is a LaTeX comment inside `\lai`, so it helps the insertion engine without showing as red paper text.

## Filtering changes

Before insertion, the frontend now drops likely advisory/non-patch `\lai` blocks, deduplicates per target, and drops contradictory no-edit blocks when actual edits exist for the same section.

## Files changed

- `js/real-agent-branch-workflow-service.js`
- `prompt/devils-advocate-branch-runner/coverage-branch.txt`
- `prompt/devils-advocate-branch-runner/coverage-multisection.txt`
- `prompt/devils-advocate-branch-runner/citation-reviewer.txt`
- `prompt/devils-advocate-branch-runner/critic.txt`
- `prompt/devils-advocate-branch-runner/advocate.txt`
- `prompt/devils-advocate-branch-runner/synthesizer.txt`
- `prompt/devils-advocate-branch-runner/default-step.txt`
- `prompt/devils-advocate-branch-runner/editor.txt`

## Test

Open the app with:

```text
?v=19n1g
```

Recommended test flow:

1. Click `Clean previous AI suggestions` if the source already contains red AI edits.
2. Click `Refresh detected targets` and check that old `Target section: ...` labels do not appear as targets.
3. Run full preview in dry-run first.
4. Then run real mode if ready.
5. Check insertion preview: blocks should be actual inserted/replacement text, not review instructions.
