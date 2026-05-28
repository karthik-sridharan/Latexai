# Stage 19N1J — Per-Round Visible Context + Memory Injection

Frontend-only debug/behavior stage.

## What changed

- The Devil’s Advocate debate runner now inserts a visible memory-context block into every agent prompt.
- The block is generated from the backend-selected/bandit-ranked memory evidence already returned with the selected branch.
- For each agent call, the frontend re-ranks those memory evidence items using the agent role, debate round, task type, focus/query, and recent transcript terms.
- The memory block is inserted into `payload.prompt`, so it is guaranteed visible to the AI model.
- The prompt-debug tab also shows `visibleMemoryContext` in the payload for easier inspection.

## Important behavior

Stage 19N1J does **not** run a fresh backend bandit query before every critic/advocate/editor call. It uses the memories selected during branch planning and then does a lightweight frontend role/round re-ranking for visibility.

This means:

- critic rounds see weakness/gap/citation/assumption-relevant memories first;
- advocate rounds see strength/defense/revision memories first;
- editor rounds see patch/LaTeX/apply/edit memories first;
- equation-focused prompts prioritize equation/math/derivation memories when present.

## Test

Open:

```text
/index.html?laiPromptDebug=1&v=19n1j
```

Run the Devil’s Advocate branch workflow. In the prompt-debug tab, each agent prompt should contain:

```text
=== BANDIT-SELECTED MEMORY CONTEXT FOR THIS AGENT ===
```

If the backend did not return memory summaries, the block will explicitly say that only memory ids were available.
