# Stage 19T3C — Paper Remake Section Patch Hardening

This frontend stage tightens paper-level AI total-remake in-place prompts and keeps the app-managed raw patch / safe compiler / `\lai` flow.

Key changes:
- In-place total remake is instructed to produce paper-ready rewritten sections, not a meta "Remake Plan" section.
- Prompt explicitly forbids "Remake Plan", "Step-by-Step Rewrite Strategy", and "Expected Outcomes" sections unless the user explicitly asks for a plan.
- For new sections, the prompt directs the model to use `insert_before_section` or `append_before_end_document`, not `replace_block` without a real block id.
- Raises in-place output budget to reduce truncation for multi-section rewrite proposals.
- Keeps 19T3B macro autoinjection rules.
