---
description: Generate a project specification from the homework-6 template
---

Generate `homework-6/specification.md` following the 5-section template from TASKS.md:

1. **High-Level Objective** — one sentence on what the pipeline does.
2. **Mid-Level Objectives** — 4–5 concrete, testable requirements.
3. **Implementation Notes** — decimal money (decimal.js, ROUND_HALF_UP), ISO 4217 currency,
   audit trail (timestamp, agent, transaction id, outcome), no PII in logs.
4. **Context** — beginning state: sample-transactions.json; ending state: results in
   shared/results/, a summary report, coverage ≥ 90%.
5. **Low-Level Tasks** — one entry per agent (transaction_validator, fraud_detector,
   settlement_processor) with Prompt / File to CREATE / Function to CREATE / Details.

Use the concrete business rules from docs/superpowers/specs/2026-06-15-banking-pipeline-design.md.
