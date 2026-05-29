# Stage 19N1Q4 — Branch runner uses Settings Devil’s Advocate model routes

Badge:

```text
latex-stage19n1q4-branch-runner-settings-devils-routes-20260529-1
```

## What changed

The **Devil’s Advocate branch runner** no longer asks for a Provider or Model inside the Copilot tab.

Instead, every branch-runner agent step inherits the existing settings from:

**Settings → Model/provider routing**

Specifically:

- reviewer/critic steps use **Devil’s advocate · critic**
- advocate/defender steps use **Devil’s advocate · supporter**
- synthesizer/editor/final-edit steps use **Devil’s advocate · synthesis**

The branch runner card now shows a read-only route summary so you can verify which provider/model will be used without editing it there.

## Files changed

```text
index.html
js/model-provider-service.js
js/real-agent-branch-workflow-service.js
README_STAGE19N1Q4_BRANCH_RUNNER_SETTINGS_DEVILS_ROUTES.md
```

## How to test

1. Deploy this frontend.
2. Open **Settings → Model/provider routing**.
3. Set the three Devil’s advocate rows to the provider/model you want.
4. Go to **Copilot → Devil’s Advocate branch runner**.
5. Confirm there are no Provider/Model text boxes in the branch runner.
6. Confirm the card displays the inherited critic/supporter/synthesis routes.
7. Run a branch in real-AI mode.
8. The agent output list should show each agent using the configured route for its role.
