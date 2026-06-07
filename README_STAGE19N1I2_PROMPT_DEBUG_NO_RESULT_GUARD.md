# Stage 19N1I2 — Prompt Debug No-Result Guard

Frontend-only temporary debug fix.

## What changed

When `index.html?laiPromptDebug=1` is enabled, the prompt-debug tab opens before the actual AI/backend-recorded result exists. If the user cancels the real-AI confirmation, or if the run is only being used for prompt inspection, the old `Run full preview` flow continued into the cleaner step and produced:

```text
No real-agent result yet.
```

This stage makes the flow more robust:

- The prompt-debug tab still opens and records built prompts.
- `Run full preview` now checks whether `runSelectedBranch()` actually produced a backend-recorded result before calling the cleaner.
- In prompt-debug mode, if no result exists, it skips LAI cleaner/insertion preview instead of failing noisily.
- The cleaner button has a clearer error message explaining that a completed run is needed.

## Enable prompt debug

Open:

```text
/index.html?laiPromptDebug=1&v=19n1i2
```

Then run Devil's Advocate branch runner.

## Notes

For a full no-cost end-to-end run, use `dry_run_no_model_calls`. For real AI prompts and responses, use `call_ai_proxy_expensive` and accept the confirmation dialog.
