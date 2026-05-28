# Stage 19N1 — Configurable Devil's Advocate Debate Rounds

Frontend-only stage built on top of Stage 19N0F.

## What changed

- Adds a `Debate rounds` control to the main-editor Devil's Advocate branch runner.
- Expands the real-agent execution sequence from a fixed single-pass chain into:

```text
optional reviewer/citation-reviewer setup
critic round 1
advocate round 1
critic round 2
advocate round 2
...
synthesizer
editor
```

- Round 2+ prompts include the prior debate transcript, including earlier reviewer setup and all previous critic/advocate outputs.
- Synthesizer and editor prompts include the full prior transcript and the selected branch context.
- Keeps Stage 19N0F compile fixes: append before `\end{document}`, visible `\lai` macros, and escaping unescaped author-list ampersands in inserted AI regions.

## Prompt behavior

For each real model call, the frontend builds a role-specific prompt from:

1. selected branch title/type/rationale/target sections,
2. latex edit hint,
3. memory ids selected by the branch planner,
4. paper summary,
5. review/report signal,
6. current LaTeX source excerpt,
7. prior debate transcript.

For round 1, the critic/advocate establishes the first attack/defense.
For round 2 and later, the agent is explicitly told to use the prior transcript and not restart from scratch.

## Test

Open the app with:

```text
?v=19n1
```

Then:

1. Go to Copilot tab.
2. Set Debate rounds to 2.
3. Keep `dry_run_no_model_calls` first.
4. Click `Run selected branch` or `Run full preview`.
5. Confirm the output list includes critic r1, advocate r1, critic r2, advocate r2, synthesizer, editor.
6. Switch to `call_ai_proxy_expensive` only when ready to pay for the expanded number of model calls.
