# Stage 19N1R4 — Devil’s Advocate release hardening + regression verifier

Frontend stage badge: `latex-stage19n1r4-devils-release-hardening-verifier-20260529-1`

Adds:

- One-click **Verify setup** button in the Devil’s Advocate branch runner.
- Correct route checks for backend health, memory health, branch routes, saved runs, AI/key status, live provider models, and learned selector.
- Explicit transcript/dashboard sections: Transcript, Branch candidates, Structured LaTeX edits, Insertion preview, Saved run/model trace, Final synthesis.
- **Save /reviews artifact** button that creates a Markdown report under `/reviews` in the project so it can be committed with Save GitHub.
- **Compile after edit** button to immediately run Compile PDF after inserting localized edits or appending the final plan.

No backend redeploy is required for the frontend UI improvements, but the paired backend R4 zip updates `/health` and adds a non-destructive debug verifier endpoint.
