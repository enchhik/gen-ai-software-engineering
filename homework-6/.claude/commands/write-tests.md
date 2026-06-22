---
description: Agent 3 — generate unit tests and keep coverage above the gate
---

Unit-test meta-agent (Agent 3). Generate and maintain the test suite, then enforce the
coverage gate.

Steps:
1. Write/extend tests in `tests/` (Jest + ts-jest): a unit test per runtime agent
   (`transaction_validator`, `fraud_detector`, `settlement_processor`) plus money/audit/sharedIo
   helpers and at least one full-pipeline integration test.
2. Isolate tests from the real `shared/` directory (use temp dirs).
3. Run `npm run test:cov` and read the coverage report.
4. Keep coverage **above the 80% gate**, target ≥ 90%. Add tests for any uncovered branch.
5. Confirm the gate passes: `npm run check-coverage` (exits non-zero below 80%).
6. The same gate is enforced by the `pre-push` hook and the Claude Code `PreToolUse` hook —
   do not weaken the threshold.
