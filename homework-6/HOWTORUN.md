# How to run — Homework 6

## Prerequisites
- Node.js 20+

## Setup
1. `cd homework-6`
2. `npm install`
3. `npm run install-hooks`   # installs the git pre-push coverage gate

## Run the pipeline
4. `npm run pipeline`        # processes sample-transactions.json into shared/results/

   Expected summary: total 8, settled 4, flagged 2, rejected 2.

## Validate only (no processing)
5. `npm run validate`        # prints total/valid/invalid + rejection table (TXN006, TXN007)

## Tests & coverage
6. `npm test`                # all unit + integration tests (28 tests)
7. `npm run test:cov`        # coverage report (target ≥ 90%, gate 80%)
8. `npm run check-coverage`  # the gate; exits non-zero if line coverage < 80%

## Coverage gate (blocks push < 80%)
- Claude Code: a `PreToolUse` hook in `.claude/settings.json` runs the gate before any `git push`.
- Terminal: the git `pre-push` hook (installed in step 3) runs the gate before any push.

## MCP server
9. Configure `mcp.json` in your client (it defines both `context7` and `pipeline-status`).
10. After a pipeline run, call:
    - tool `get_transaction_status` (e.g. `transaction_id: "TXN001"`)
    - tool `list_pipeline_results`
    - resource `pipeline://summary`

## Slash commands (Claude Code)
- `/run-pipeline` — clears shared/, runs the pipeline, reports results.
- `/validate-transactions` — dry-run validation report.
- `/write-spec` — regenerate the specification from the template.
