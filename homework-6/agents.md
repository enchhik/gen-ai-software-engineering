# agents.md — Multi-Agent Banking Pipeline

## Project context
A deterministic, file-driven banking transaction pipeline. The project has **two layers of agents**:
build-time **meta-agents** (Claude Code workflows that create the artifacts) and **runtime agents**
(deterministic TypeScript functions that process transactions). This split follows the four
meta-agent workflow in `TASKS.md`.

## Meta-agents (build/development time)
Claude Code workflows that *create* the homework artifacts. Each is a reusable slash command
in `.claude/commands/`:

| Meta-agent | Role | Slash command |
|---|---|---|
| Agent 1 — Specification | Produce `specification.md` from the template | `/write-spec` |
| Agent 2 — Code generation | Generate `agents/`, `lib/pipeline.ts`, `integrator.ts`, `research-notes.md` (with context7) | `/generate-pipeline` |
| Agent 3 — Unit tests | Generate tests, run coverage, keep the gate ≥ 80% (target ≥ 90%) | `/write-tests` |
| Agent 4 — Documentation | Generate/update `README.md`, `HOWTORUN.md` (incl. student name) | `/write-docs` |

The real build used Claude Code (Opus) as coordinator plus Sonnet subagents via the
superpowers / subagent-driven workflow; the slash commands formalize those workflows so they
can be re-run. They are deliverables/recipes — subagents did not need to invoke them while first
writing the code.

## Runtime pipeline agents (run time)
Deterministic TypeScript functions `(msg: AgentMessage) => AgentMessage`. **They do not call an LLM.**
They communicate via JSON files in `shared/`, routed by each message's `target_agent` field.

| Runtime agent | File |
|---|---|
| Transaction Validator | `agents/transaction_validator.ts` |
| Fraud Detector | `agents/fraud_detector.ts` |
| Settlement Processor | `agents/settlement_processor.ts` |

## Tech stack (authoritative — do not improvise)
- Language: TypeScript on Node.js
- Money: `decimal.js` (ROUND_HALF_UP, 2 dp) — never use `number`/float for amounts
- Tests: Jest + ts-jest, coverage gate 80% (target >= 90%)
- MCP: `@modelcontextprotocol/sdk` (custom server) + context7

## Domain rules
- Currency must be ISO 4217.
- Fraud flag threshold: risk score >= 50.
- Settlement fee: 0.5% ROUND_HALF_UP.
- Short-circuit: a rejected/flagged transaction goes straight to `shared/results/`.
- Every transaction must end in `shared/results/` exactly once.

## Code style
- Pure agent functions: `(msg: AgentMessage) => AgentMessage`; no I/O inside agents.
- File I/O and orchestration live in `lib/` and `integrator.ts`.
- No PII (account numbers, names, descriptions) in logs.

## Verification expectations
- `npm test` green; `npm run test:cov` >= 80% (aim >= 90%).
- `npm run pipeline` writes 8 results for the sample.

## Tie-breaking order of authority
1. `TASKS.md`  2. `specification.md`  3. this `agents.md`  4. design doc  5. agent judgement.
