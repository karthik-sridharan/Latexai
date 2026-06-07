# Stage 19N1I — Temporary Agent Prompt Debug Tab

Frontend-only temporary debugging stage on top of Stage 19N1H.

## Purpose

When the main app is opened with a special URL argument, the Devil's Advocate branch runner opens a separate browser tab during a debate run and streams the exact prompt built for each AI agent step.

This is meant for debugging why agents are not following a focus/query such as equation-by-equation explanations.

## Enable

Open the main app as:

```text
/index.html?laiPromptDebug=1&v=19n1i
```

Also accepted:

```text
/index.html?debugDebatePrompts=1&v=19n1i
/index.html?promptDebug=1&v=19n1i
/index.html?showAgentPrompts=1&v=19n1i
```

If the parameter is absent, the app behaves normally and does not open a debug tab.

## What appears in the debug tab

For each agent call, the debug tab shows:

- agent role
- debate round
- task type
- exact visible prompt string sent as `payload.prompt`
- AIProvider payload summary
- payload `latexSource` when included by the chosen payload mode
- response preview after the model call returns

Important: the model definitely sees `payload.prompt`. Other payload fields are visible to the model only if the AIProvider/proxy includes them in the model messages. This debug view is intended to make that distinction explicit.

## Testing

1. Deploy this frontend.
2. Open:

```text
/index.html?laiPromptDebug=1&v=19n1i
```

3. Go to Copilot → Devil's Advocate branch runner.
4. Use dry-run mode first.
5. Click `Run full preview` or `Run selected branch`.
6. A new tab should open and show prompts as each agent step is built.

If the browser blocks the new tab, allow pop-ups for the site and retry from a direct button click.

## Changed files

```text
js/real-agent-branch-workflow-service.js
README_STAGE19N1I_TEMP_PROMPT_DEBUG_TAB.md
```
