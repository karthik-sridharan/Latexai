# Stage 16B: competitive paper review

Changed files:

- `index.html`
- `js/feature-flag-service.js`
- `js/competitive-paper-review-service.js`
- `css/lai-stage16b-competitive-review.css`
- `prompt/ai-competitive-paper-review.txt`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage16b-competitive-paper-review-1`

## What this adds

A feature-gated Copilot card:

```txt
Competitive paper review
```

The first version does not automatically download competitor papers. Users paste competitor URLs plus notes/abstracts.

UI fields:

- Competitor paper URLs
- Competitor notes / abstracts / titles
- Target venue
- Target audience
- Comparison modes
- Extra instructions

Actions:

- Run competitive review
- Copy report
- Add report to `/reviews`
- Insert roadmap comments

The AI report asks for:

- ranked competitor papers
- current draft position
- weaknesses relative to each competitor
- concrete edits
- predicted rank shift
- suggested `\laiold{...}\lai{...}` edit blocks
