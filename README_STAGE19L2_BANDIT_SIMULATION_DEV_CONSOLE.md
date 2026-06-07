# Stage 19L2 — Developer Bandit Simulation Console

This stage extends `/developer-memory-bandit.html` with an offline backend simulator.

The console can now run synthetic memory/action/reward simulations without using paid model calls and without writing to Neon.

## Added controls

- simulated AI-call rounds
- total synthetic memories
- initial active memories
- action-set growth frequency
- new memories per growth step
- reward noise
- task drift
- seed
- policy list to compare

The simulation calls:

```text
POST /api/lumina/memory/debug/simulate-bandit
```

and displays per-policy:

- average reward per round
- regret
- success/failure rates
- exploration rate
- unique memories selected
- final active memory count
- raw JSON
