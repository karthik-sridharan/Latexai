# Stage 17H: debate agent model routing bypass fix

Changed files:

- `index.html`
- `js/model-provider-service.js`
- `js/devils-advocate-debate-service.js`

## What this fixes

The Devil's advocate debate card could show each agent set to `gpt-4.1-mini`, but the AI request was still routed through the generic **Paper-level AI** model route, whose default was `gpt-4.1`.

That produced:

```txt
Debate stopped: Unsupported model for openai: gpt-4.1
```

even when the visible agent rows said `gpt-4.1-mini`.

## Fix

- Devil debate calls now send explicit `provider` and `model` from the visible agent row.
- Devil debate calls set `modelRoutingBypass: true`.
- Model routing service now respects that bypass and does not override to the generic paper route.
- Debate status now says exactly which provider/model each agent is using.

Open:

```txt
https://karthik-sridharan.github.io/Latexai/?v=stage17h-debate-agent-model-routing-bypass-fix-1
```
