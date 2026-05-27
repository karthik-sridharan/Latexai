# Stage 19M Frontend — Real-Agent Branch Runner

This stage extends `developer-debate-branches.html` with a controlled real-agent branch runner.

New UI elements:

- AI proxy URL
- AI proxy token
- real-run provider/model
- dry-run vs real AI proxy execution mode
- `Run selected branch with real agents`
- `Copy real-run record curl`
- `Stage 19M real-agent branch run` result panel

Default mode is `dry_run_no_model_calls`, so frontend testing is safe and cheap. To spend real model calls, switch Real agent mode to `call_ai_proxy_expensive` and confirm the prompt.

Workflow:

1. Generate + evaluate + rollout + select.
2. Confirm `Selected execution plan` is populated.
3. Click `Run selected branch with real agents`.
4. In dry-run mode, it produces synthetic outputs and records them through `/api/lumina/debate/run-real-agent-branch`.
5. In real mode, it calls the configured AI proxy once per planned agent step, then records the outputs.
