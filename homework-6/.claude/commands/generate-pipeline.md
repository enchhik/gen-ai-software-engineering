---
description: Agent 2 — generate the multi-agent transaction pipeline code
---

Code-generation meta-agent (Agent 2). Generate the runtime pipeline that processes
transactions, following `specification.md` and the design doc.

Steps:
1. Read `specification.md` and `docs/superpowers/specs/2026-06-15-banking-pipeline-design.md`
   for the business rules.
2. Use **context7** to look up the current API for the chosen libraries
   (`decimal.js` money handling, MCP TypeScript SDK). Record at least 2 queries in
   `research-notes.md`.
3. Generate the runtime agents in `agents/`:
   - `transaction_validator.ts` — required fields, positive amount, ISO 4217 currency.
   - `fraud_detector.ts` — risk score (high-value, structuring, cross-border, off-hours); flag ≥ 50.
   - `settlement_processor.ts` — 0.5% fee (decimal.js, ROUND_HALF_UP), net amount, `settled`.
4. Generate the orchestration: `lib/pipeline.ts`, `lib/sharedIo.ts`, `integrator.ts`
   (file-based protocol via `shared/{input,processing,output,results}`, routing by `target_agent`).
5. Keep runtime agents as pure deterministic functions `(msg: AgentMessage) => AgentMessage` —
   no LLM calls at runtime, no I/O inside the agent functions.
6. Verify: `npm run pipeline` writes all transactions to `shared/results/`.
