# Stage 19G — Edit Outcome and Reward Logging

This stage adds hidden outcome/reward logging for future AlphaGo-style debate learning.

## Frontend changes

Changed/added files:

- `index.html`
  - Updates the visible stage marker to Stage 19G.
  - Loads `js/reward-logging-service.js`.

- `js/reward-logging-service.js`
  - New hidden service that posts reward/outcome signals to the memory backend.
  - Provides `LuminaLatex.RewardLoggingService` with:
    - `logReward(eventType, rewardValue, options)`
    - `logEditOutcome(actionType, outcome, options)`
    - `logGithubOutcome(kind, result, options)`
    - `logCompileOutcome(status, options)`
  - Uses the existing Memory backend URL setting.
  - Does not add UI.

- `js/competitive-paper-review-service.js`
  - Logs rewards for full cited review completion.
  - Logs edit outcomes for competitive `\lai` insert/append actions.
  - Records validation success/failure from the Stage 19B safety pass.

- `js/reviewer-rebuttal-simulator-service.js`
  - Logs reward/outcome signals for rebuttal and final synthesis.

- `js/file-tree.js`
  - Logs GitHub open/save/checkpoint/auto-checkpoint outcomes.

## How to verify

After uploading the frontend and deploying the Stage 19G backend, open:

```text
https://karthik-sridharan.github.io/Latexai/?v=19g
```

Run a workflow such as:

- Full Cited Review
- AI remake + insert `\lai` edits
- AI remake + append `\lai` plan
- Reviewer/Rebuttal final synthesis
- Save GitHub
- Checkpoint

Then check Neon:

```sql
select 'edit_outcomes' as table_name, count(*) from edit_outcomes
union all
select 'reward_events', count(*) from reward_events;
```

Inspect recent rewards:

```sql
select event_type, reward_label, count(*), avg(reward_value)
from reward_events
group by event_type, reward_label
order by count(*) desc, event_type;
```
