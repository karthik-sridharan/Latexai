# Stage 18P — Competitive Review Memory Context Retrieval

This stage connects the hidden Latexai memory backend back into the competitive review agent.

## What changed

- Keeps memory invisible in the main UI.
- Before competitive review AI calls, fetches relevant backend memory from:
  - `/api/lumina/memory/context`
- Injects compact memory context into the AI prompt:
  - paper/project summaries
  - stored competitive-review facts
  - usage/success counts
  - retrieval scores
  - weighted memory graph edges
- Marks retrieved memories as used/successful through:
  - `/api/lumina/memory/use`
- Promotes final competitive-review memory into a backend-only `working` memory fact.
- Adds a graph edge from working memory to the durable paper fact with relation `working_cache_of`.

## Expected visual behavior

No new memory UI appears. The competitive review UI should look essentially the same.

## Expected backend behavior

After running a competitive review, memory counts should increase. After a second competitive review, `usageEvents` should increase because previous memories are retrieved and marked as used.

Test with:

```bash
curl https://YOUR_BACKEND_URL/api/lumina/memory/health
```

You should see nonzero counts for events, facts, usageEvents, edges, and summaries.

## Deployment

Upload/replace these files in the GitHub Pages frontend repo:

- `index.html`
- `js/competitive-paper-review-service.js`

Then hard refresh with a cache buster, for example:

```text
https://karthik-sridharan.github.io/YOUR_REPO/?v=18p
```
