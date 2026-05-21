# Stage 15J: feature flag registry + guarded optional-script loader

Changed files:

- `index.html`
- `js/feature-flag-service.js`
- `css/lai-stage15j-feature-flags.css`

Open:

`https://karthik-sridharan.github.io/Latexai/?v=stage15j-feature-flag-registry-guarded-loader-1`

## What this adds

A central feature registry in Settings:

- Presentation/talk export
- Citation AI
- Citation verifier
- Active standalone compile root
- Standalone path fixer
- Backend diagnostics
- Model/provider routing
- Regression checklist
- Release/deploy verifier
- Experimental UI cleanup

Optional scripts no longer execute directly from `<script src=... defer>`.
They are represented as inert placeholders and loaded by `FeatureFlagService` only when enabled.

## Buttons

- Save flags
- Disable experimental features
- Enable stable defaults
- Disable last added stage
- Copy feature report

## Safety

- `?safe=1` disables all optional feature scripts before they execute.
- Experimental UI cleanup is disabled by default.
- No MutationObservers.
- No intervals.
- No compile jobs.
- No AI calls.
