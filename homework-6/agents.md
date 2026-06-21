# agents.md — Multi-Agent Banking Pipeline

## Project context
A deterministic, file-driven banking transaction pipeline. Three runtime agents communicate via
JSON files in `shared/`. Built and maintained with AI agents (Claude Code) per the four meta-agent
workflow in `TASKS.md` (specification, code generation, tests + coverage gate, documentation).

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
