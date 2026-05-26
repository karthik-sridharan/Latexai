# Stage 19I — Agent-role-specific context policy backend

This backend stage adds role-aware memory retrieval for Latexai debate/review agents.

## New tables

- `agent_context_profiles`: static/default context profiles for critic, defender, editor, evaluator, citation auditor, and notation auditor roles.
- `agent_context_usage_stats`: per-agent/per-task memory selection stats, currently tracking how often each memory was selected for each role.

## New endpoints

- `POST /api/lumina/memory/agent-context`
  - Input: project/paper scope, agent role, task type, workflow, query, limit.
  - Output: role-specific memory context with an `agentContextProfile` block.

- `GET /api/lumina/memory/debug/agent-context-profiles`
  - Shows installed default profiles and selection stats.

## Purpose

Stage 19I is the first step where Latexai stops feeding the same generic memory to every LLM agent. Critic, defender, editor, evaluator, citation-auditor, and notation-auditor agents now receive different context policies.

Stage 19J can build on the selection stats and reward logs to learn a non-neural context scoring policy.
