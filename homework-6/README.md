# Homework 6 — Multi-Agent Banking Pipeline

> **Created by**: Denys Ostrometskyi
> **Date Submitted**: 2026-06-22
> **AI Tools Used**: Claude Code (Opus 4.8 coordinator + Sonnet subagents, superpowers / subagent-driven), context7 MCP

A file-driven, multi-agent pipeline that validates, fraud-screens, and settles banking
transactions. An orchestrator loads raw transactions, then three agents process each one and write
the final outcome to `shared/results/`. Every transaction — settled, flagged, or rejected — ends up
in `shared/results/`.

This project is also the realization of the four meta-agents from `TASKS.md`: a specification
workflow, a code-generation workflow (using context7 for library lookups), a unit-test workflow
backed by a coverage gate that blocks pushes below 80%, and a documentation workflow.

## Two agent layers

This submission has **two distinct layers of agents**:

- **Meta-agents (build time)** — four Claude Code workflows that *create* the project artifacts:
  `/write-spec` (specification), `/generate-pipeline` (code), `/write-tests` (tests + coverage
  gate), `/write-docs` (documentation). They are reusable workflow recipes in `.claude/commands/`.
- **Runtime agents (run time)** — the three pipeline agents below that *process* transactions.
  They are deterministic TypeScript functions and **do not call an LLM**, which keeps the pipeline
  reproducible and fully testable.

The project itself was built with Claude Code / superpowers using a subagent-driven workflow
(Opus coordinator + Sonnet subagents); the slash commands formalize those build workflows so they
can be re-run. See `agents.md` for the full mapping.

## Agents
- **Transaction Validator** — checks required fields, positive amount, ISO 4217 currency.
- **Fraud Detector** — risk-scores high-value, structuring, cross-border, off-hours; flags score ≥ 50.
- **Settlement Processor** — charges a 0.5% fee (ROUND_HALF_UP) and settles cleared transactions.

## Architecture

```
sample-transactions.json
        |
        v
   [ integrator ]  --writes-->  shared/input/
        |
        v
  shared/input  --> [ Validator ]            --reject-->  shared/results/
                          |  validated
                          v
                    [ Fraud Detector ]       --flag---->  shared/results/
                          |  cleared
                          v
                    [ Settlement Processor ] --settled-->  shared/results/
```

Agents communicate only through JSON files in `shared/` (input → processing → output → results);
routing is driven by each message's `target_agent` field. A rejected or flagged transaction
short-circuits straight to `shared/results/`.

## Tech stack
| Concern | Choice |
|---|---|
| Language | TypeScript / Node.js |
| Money | decimal.js (ROUND_HALF_UP) |
| Tests | Jest + ts-jest (coverage gate 80%, target ≥ 90%) |
| MCP | @modelcontextprotocol/sdk + context7 |

## MCP servers
- **context7** — used during development to look up library docs (decimal.js, MCP TS SDK);
  see `research-notes.md`.
- **pipeline-status** (custom, `mcp/server.ts`) — exposes tools `get_transaction_status`,
  `list_pipeline_results`, and resource `pipeline://summary`.

See `HOWTORUN.md` to run, test, and exercise the MCP server.
