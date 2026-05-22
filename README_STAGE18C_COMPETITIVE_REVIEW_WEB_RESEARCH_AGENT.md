# Stage 18C — Competitive Review web research agent

Stage string: `stage18c-competitive-review-web-research-agent-1`

This stage changes the Competitive Review URL workflow from a PDF-oriented extraction flow into a web-research-agent flow.

## Main behavior

- Competitor URLs are treated as web-search/source-discovery seeds.
- Latexai does **not** try to download or extract competitor PDFs.
- The AI backend must report web-search/open capability for this workflow.
- The AI agent is asked to gather public evidence such as title, authors, venue/date, abstract, related public pages, OpenReview/arXiv/Semantic Scholar/project/GitHub pages, review context, and snippets where available.
- Latexai caches structured competitor research profiles, not raw PDF text.

## Visual changes

In **Copilot → Competitive paper review**:

- `Fetch / extract papers` is replaced with `Research competitor papers`.
- Workflow step 2 is now `Web research`.
- URL placeholder text now says URLs are researched by the AI backend and PDFs are not extracted by Latexai.
- The status/output language uses `web research` and `research profiles` rather than `PDF extraction`.

## AI request contract

Competitive Review now sends:

```json
{
  "schema": "latexai-competitive-web-research-review-request-v1",
  "workflow": "competitive-web-review",
  "researchMode": "web-search-agent-no-pdf-extraction",
  "competitorUrls": ["..."],
  "requireWebSearch": true,
  "webSearchPolicy": {
    "required": true,
    "expectation": "AI backend must use web search/open tools to research competitor URLs as source-discovery seeds; do not require PDF extraction."
  }
}
```

The agent is expected to return a `latexai_competitor_research_profiles` JSON block when doing the research prepass.

## Files changed

- `index.html`
- `js/competitive-paper-review-service.js`
- `prompt/ai-competitive-paper-review.txt`
- `tests/stage18c-competitive-review-web-research-agent.test.cjs`
