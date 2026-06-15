# Homework 6 — AI-Powered Multi-Agent Banking Pipeline — Design

**Date:** 2026-06-15
**Author:** Denys Ostrometskyi
**Status:** Approved (brainstorm) — ready for implementation planning
**Source of truth:** `homework-6/TASKS.md`

---

## 1. Two distinct layers (do not conflate)

`TASKS.md` has **two different sets of "agents"**. This design keeps them strictly separate.

### Layer A — 4 meta-agents (AI/automation workflows that *create* the system; these are deliverables-as-process)

| Meta-agent | Role | Realized in task(s) |
|---|---|---|
| Agent 1 — Specification | Produces `specification.md` (+ `write-spec` skill) | Task 1 |
| Agent 2 — Code generation | Generates the pipeline code (+ context7 usage) | Task 2 |
| Agent 3 — Unit tests | Test suite + coverage gate that blocks push <80% | **Task 3 (hook) + Task 5 (suite)** |
| Agent 4 — Documentation | README/docs incl. author name | Task 5 |

> **Note (TASKS.md quirk):** the meta-agent table calls Agent 3 "Unit tests", but writing the
> actual test suite lives in Task 5, while Task 3 contributes only the coverage-gate hook and the
> two skills. So meta-Agent 3 spans **two tasks**: hook (Task 3) + test suite (Task 5). This is
> intentional and matches the task headers; it is not a contradiction.

### Layer B — 3 pipeline agents (runtime agents of the *generated* system)

`Transaction Validator → Fraud Detector → Settlement Processor`

Meta-Agent 2 (code generation) is what *produces* these three pipeline agents. They operate at
runtime; the meta-agents operate at build time.

---

## 2. Cross-cutting decisions

- **Stack:** Node.js / TypeScript.
- **Money:** decimal library (candidate `decimal.js`; final choice confirmed via context7 — see Task 4).
  Never use `float`/`number` for amounts.
- **Currency:** ISO 4217 validation (USD, EUR, GBP, JPY, …).
- **Audit log:** every agent operation logged with ISO 8601 timestamp, agent name, transaction ID, outcome.
- **PII:** account numbers and names are sensitive — never logged in plaintext.
- **Execution model:** orchestrator + modules. Agents are TypeScript modules the orchestrator
  (`integrator.ts`) calls **sequentially**. Communication is via JSON files (real protocol + audit trail).
  Chosen over independent polling processes because it is deterministic and testable to ≥90% coverage.

---

## 3. Directory layout (`homework-6/`)

```
homework-6/
├── .claude/
│   ├── commands/        write-spec.md, run-pipeline.md, validate-transactions.md
│   └── settings.json    PreToolUse hook (coverage gate)
├── agents/              transaction_validator.ts, fraud_detector.ts, settlement_processor.ts
├── integrator.ts        orchestrator
├── mcp/server.ts        custom MCP server (TypeScript)
├── scripts/             check-coverage script (shared by both hooks) + pre-push installer
├── shared/              input/  processing/  output/  results/
├── tests/               unit per agent + 1 integration test
├── docs/screenshots/    5 required screenshots
├── specification.md  agents.md  research-notes.md  README.md  HOWTORUN.md
├── mcp.json
└── sample-transactions.json   (already present, 8 records)
```

Plus a git `pre-push` hook installed into `.git/hooks/pre-push` (installed via a script; documented in `HOWTORUN.md`).

---

## 4. File-based protocol (`shared/`)

Single set of four directories for the whole pipeline (exactly as in `TASKS.md`):

```
shared/
├── input/       ← orchestrator drops initial messages
├── processing/  ← agent moves a message here while working
├── output/      ← agent writes result here for the next agent
└── results/     ← final outcomes land here
```

Standard message format (per `TASKS.md`): `message_id`, `timestamp`, `source_agent`,
`target_agent`, `message_type`, `data`. Routing between agents is driven by `target_agent`.

Flow for one transaction:

```
sample-transactions.json
   → shared/input/TXNxxx.json
   → Validator        (input → processing → output)
   → Fraud Detector   (output → processing → output)
   → Settlement       (output → processing → results)
```

---

## 5. Per-task plan

### Task 1 — Agent 1: Specification
- `specification.md` following the fixed 5-section template (High-Level Objective, Mid-Level
  Objectives, Implementation Notes, Context, Low-Level Tasks per agent).
- `agents.md` written from scratch (no starter `agents.md` shipped in `homework-6/`; use our
  homework-3 `agents.md` as a structural reference).
- Skill `write-spec` in `homework-6/.claude/commands/write-spec.md`.

### Task 2 — Agent 2: Pipeline
- Three pipeline agents: **Validator → Fraud Detector → Settlement Processor**.
- Single `shared/` directory set; routing via `target_agent`.
- **Short-circuit control flow:** when an agent rejects/flags a transaction, it goes straight to
  `shared/results/` with that status (`rejected`/`flagged`) and a reason field; downstream agents
  are skipped.
- **All transactions** (8/8) end in `shared/results/` — including rejected/flagged
  (`TASKS.md` lines 43 and 110). Verified by the deliverable check and the integration test.
- `research-notes.md` documents ≥2 context7 queries (see Task 4).

### Task 3 — Agent 3 (part 1): Skills & coverage gate
- Skills `run-pipeline` and `validate-transactions` in `homework-6/.claude/commands/`.
- Coverage gate implemented **twice**, both calling one shared coverage-check script:
  1. **Coverage gate hook** in `homework-6/.claude/settings.json` (required deliverable; visible in PR).
  2. git `pre-push` hook (real enforcement for any terminal push).
- Threshold: **block if coverage < 80%**.

> **Hook mechanism note:** `TASKS.md` requires the *behavior* ("blocks push if coverage < 80%"),
> not a specific event name. The settings.json gate is realized via a **`PreToolUse`** hook matching
> `git push`, because `PreToolUse` is the only Claude Code event that can deny an action *before*
> it runs (`PostToolUse` fires after the push and cannot block it). So `PreToolUse` is an
> implementation detail of "coverage gate hook", not an extra requirement.
> A third, complementary layer is Jest `coverageThreshold: 80`, which fails the *test run* under
> 80%; both hooks rely on it but it does not by itself block a push.

### Task 4 — MCP integration
- `mcp.json` configures **both** context7 and the custom server.
- context7 used during code generation; ≥2 queries documented in `research-notes.md`
  (e.g. decimal/money handling in Node, MCP TS SDK).
- Custom MCP server in **TypeScript** (`mcp/server.ts`):
  - Tool `get_transaction_status(transaction_id)` → status from `shared/results/`.
  - Tool `list_pipeline_results()` → summary of all processed transactions.
  - Resource `pipeline://summary` → latest run summary as text.

### Task 5 — Agent 4 (+ Agent 3 part 2): Tests & Documentation
- Jest test suite: unit tests per agent + 1 integration test for the full pipeline.
- Coverage **target ≥90%**; gate at 80% (from Task 3).
- Tests isolated from real `shared/` (temporary directories).
- `README.md`: author **Denys Ostrometskyi**, what the system does, one bullet per agent,
  ASCII architecture diagram, tech-stack table.
- `HOWTORUN.md`: numbered steps from setup to demo (incl. installing the `pre-push` hook).
- 5 screenshots in `docs/screenshots/`: `pipeline-run.png`, `test-coverage.png`,
  `skill-run-pipeline.png`, `hook-trigger.png`, `mcp-interaction.png`.

---

## 6. Deferred to `specification.md` (not fixed at brainstorm)

Concrete business rules are intentionally left to the spec / implementation:
- Exact fraud thresholds and risk-scoring weights.
- Settlement fee formulas and rounding mode.
- Full validation rule set.

These belong in `specification.md` §5 (Low-Level Tasks) once agents are being implemented.

---

## 7. Verification against TASKS.md (brainstorm checks)

- ✅ 4 meta-agents and 3 pipeline agents kept on separate layers (§1).
- ✅ All rejected/flagged transactions still land in `shared/results/` (§5, Task 2).
