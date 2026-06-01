# Stage 19U9J4 — Strict Paper AI No Collection Defaults

This frontend-only hotfix makes every Paper AI knowledge/literature collection selector start in the explicit `No collection` state.

It also runs a one-time localStorage migration so old saved selector values from earlier 19u9i/19u9j deployments do not keep restoring the old global/default Literature collection.

Changed files:

- `index.html`
- `js/knowledge-context-service.js`
- `js/collection-synthesis-paper-ai-service.js`

Expected frontend stage marker:

```text
latex-stage19u9j4-strict-no-collection-defaults-20260601-1
```

Behavior after deploy:

- Paper-level AI knowledge selector starts as `No collection`.
- Paper-level AI collection synthesis selector starts as `No collection`.
- Other Paper AI feature cards start as `No collection`.
- Retrieval mode now defaults to `automatic + legacy pins`, not `automatic + selected collection`.
- Manually choosing a collection after this deployment is remembered on later reloads.
