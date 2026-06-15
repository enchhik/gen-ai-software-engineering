# 🤖 Homework 4: 4-Agent Pipeline

> **Student**: Denys Ostrometskyi
> **Date Submitted**: 2026-06-15
> **AI Tools Used**: Claude Code (CLI + headless mode), Anthropic Claude models (Opus 4.7, Sonnet 4.6, Haiku 4.5)

---

## 📋 Project Overview

A six-agent pipeline that processes seeded defects in a small Express
"Users & Auth" REST API. One command (`npm run pipeline`) walks each bug
through the chain **Bug Researcher → Research Verifier → Bug Planner → Bug
Fixer → Security Verifier → Unit Test Generator**, producing real fixes,
real tests, and a structured paper trail per bug.

Four defects ship in `src/` as the pipeline's working material:

| Id | Type | Location | Symptom |
|---|---|---|---|
| **BUG-1** | logic | `src/routes/users.js` `/` | `?limit=` default missing, `+1` off-by-one in offset |
| **BUG-2** | logic | `src/routes/auth.js` `/login` | case-sensitive email lookup |
| **SEC-1** | security | `src/routes/users.js` `/search` | SQL injection via string concatenation |
| **SEC-2** | security | `src/auth.js` | hardcoded HMAC secret + plaintext password storage |

After `npm run pipeline` runs to completion, all four are fixed in source
and the test suite goes from 19 / 16 pass / 3 fail to **54 / 54 pass / 0
fail** (the Test Generator adds ~35 new tests across the four chains).

See `HOWTORUN.md` for the exact commands.

---

## 🏗️ Architecture

### Sample application — `src/`

Plain JavaScript ESM on Node ≥ 20. Two runtime dependencies: `express` for
HTTP, `better-sqlite3` for a real SQLite database (so SEC-1 is a genuine
SQL-injection target). Tokens and hashing use Node's built-in `crypto` —
no `jsonwebtoken`, no `bcrypt`.

- `src/app.js` — `createApp(db)` factory, used by tests via `supertest`.
- `src/server.js` — entry point; binds the port.
- `src/db.js` — schema + 12-user seed (Carol is intentionally mixed-case).
- `src/auth.js` — password helpers, HMAC token sign/verify, `requireAuth`
  middleware.
- `src/routes/auth.js` — `POST /auth/{register,login}`.
- `src/routes/users.js` — `GET /users`, `GET /users/search`, `GET /users/:id`.

### Pipeline — `scripts/run-pipeline.js`

A Node orchestrator that invokes `claude -p` headless once per agent per
bug. For each step it:

1. Reads the agent definition from `agents/<name>.agent.md` (YAML
   frontmatter + body).
2. Reads any required skill from `skills/`.
3. Builds the system prompt by inlining agent body + skill + path
   restrictions, and the user prompt naming the current bug.
4. Spawns `claude -p` with the agent's model and a per-agent `--allowedTools`
   list, capturing logs.
5. After the agent finishes, checks that only paths within the agent's
   allowed scope were touched (snapshot-based diff — pre-existing untracked
   files are ignored).
6. On success, moves to the next agent. On failure, aborts the chain for
   that bug and continues with the next bug.
7. After each successful chain, makes a narrow auto-commit (`src/`,
   `tests/`, `context/bugs/<ID>/` only).

The two required skills are loaded by **inlining** the markdown into the
system prompt, not via Claude Code's `--setting-sources` discovery. This is
deterministic, fits the homework's `skills/*.md` deliverable shape, and is
explicit in the run logs.

### Agents — `agents/*.agent.md`

Each agent is a markdown file with YAML frontmatter naming the model. The
body describes the agent's role, the files it may read, the files it must
write, an explicit "forbidden" list, and a short "how to work" section. The
orchestrator parses the frontmatter at runtime.

### Skills — `skills/*.md`

- `skills/research-quality-measurement.md` — five-level quality scale used
  by the Research Verifier (`EXCELLENT` … `INVALID`) plus the required
  section structure of `verified-research.md`.
- `skills/unit-tests-FIRST.md` — `node:test` + `supertest` worked example
  for each FIRST letter, used by the Unit Test Generator when writing tests
  and the `test-report.md`.

---

## 🧠 Model Selection per Agent

TASKS.md asks for an explicit model choice per agent and a justification.
"Stronger reasoning model for research verification and security review,
faster/cheaper model for routine fixes or test scaffolding."

| Agent | Model | Why |
|---|---|---|
| Bug Researcher | `claude-sonnet-4-6` | code-base search + synthesis; needs reasoning but not Opus altitude |
| Research Verifier | `claude-opus-4-7` | TASKS.md: "research verification" → stronger reasoning |
| Bug Planner | `claude-sonnet-4-6` | structured before/after planning |
| Bug Fixer | `claude-haiku-4-5-20251001` | TASKS.md: "routine fixes" → faster/cheaper |
| Security Verifier | `claude-opus-4-7` | TASKS.md: "security review" → stronger reasoning |
| Unit Test Generator | `claude-haiku-4-5-20251001` | TASKS.md: "test scaffolding" → faster/cheaper |

The Haiku assignments are load-bearing on the upstream agents: Bug Fixer
relies on the Planner producing concrete file:line + before/after blocks
(otherwise Haiku struggles), and Test Generator relies on the FIRST skill
being precise enough to act as a template. If either upstream slips, the
fix is to swap the Haiku model line to `claude-sonnet-4-6` in the agent's
frontmatter — single-line change.

---

## 🚀 How to Run

Concise version below; full details in `HOWTORUN.md`.

```bash
cd homework-4
npm install
npm test                        # 54 / 54 pass after pipeline
npm start                       # http://localhost:3000

# Full pipeline (cost: ~30–60% of weekly Claude Pro budget)
npm run pipeline

# Smoke (single bug, much cheaper)
npm run pipeline -- BUG-2
```

Prereqs: Node ≥ 20, `claude` CLI logged in.

---

## 📦 Pipeline Outputs

Each bug's directory under `context/bugs/<ID>/` holds the full chain of
artifacts:

```
context/bugs/BUG-1/
├── bug-context.md                          # human-authored symptom report
├── research/
│   ├── codebase-research.md                # Bug Researcher
│   └── verified-research.md                # Research Verifier (per skill)
├── implementation-plan.md                  # Bug Planner
├── fix-summary.md                          # Bug Fixer
├── security-report.md                      # Security Verifier
└── test-report.md                          # Unit Test Generator (per FIRST)
```

Per-run logs are kept under `context/runs/<ISO timestamp>/<BUG_ID>/`. They
are intentionally not auto-committed (transient).

---

## ⚠️ Known limitations from the pipeline run

A fair and intentionally non-edited list of findings the Security Verifier
itself surfaced or that remained after Bug Fixer's apply step:

- **SEC-2 fallback secret retained.** The Bug Fixer rewrote
  `src/auth.js` so `SECRET` reads from `process.env.AUTH_SECRET`, but it
  kept the original hardcoded literal as a fallback. The Security Verifier
  flagged this as **HIGH** in `context/bugs/SEC-2/security-report.md` (F-1)
  — an attacker running without `AUTH_SECRET` set would silently sign with
  the public default. A fail-fast version would be the correct fix; the
  pipeline produced the looser one because Bug Fixer (Haiku) followed the
  Planner's literal "env fallback" plan rather than escalating.
- **`verifyPassword` is brittle on malformed input.** Same SEC-2 report
  (F-2, **MEDIUM**) — a corrupted `salt:hash` row throws instead of
  returning false. Not currently reachable through the seeded data, but
  the report documents it for follow-up.
- **`verifyToken` HMAC comparison is not constant-time.** Pre-existing
  before the pipeline ran; not in scope of any seeded bug; left as-is so
  the homework doesn't drift outside what the pipeline actually decided.
- **Stale `// BUG-1(a) / (b):` comments** in `src/routes/users.js`. Bug
  Fixer changed the code but did not strip the seed-time descriptive
  comments. Cosmetic, but visible in code review.

Left in place on purpose. The point of the homework is to show what the
agentic pipeline actually produced, including the spots where a cheap
model fell short of an Opus reviewer's bar.

---

## 🤖 AI Tools Used

- **Claude Code (CLI + headless)** — drove the planning, brainstorming,
  and per-task implementation through interactive sessions; the
  orchestrator script (`scripts/run-pipeline.js`) shells out to
  `claude -p` to run each pipeline agent in isolation.
- **Claude Opus 4.7** — Research Verifier and Security Verifier.
- **Claude Sonnet 4.6** — Bug Researcher and Bug Planner; also the
  driver model during the interactive development session.
- **Claude Haiku 4.5** — Bug Fixer and Unit Test Generator.
- **Manual verification** — every claim from the pipeline was re-checked
  against source code and test output before committing. The two
  "Important" findings the Security Verifier flagged on its own output
  (the fallback secret and the malformed-hash crash) were specifically
  reproduced before deciding to leave them documented rather than fixed.

---

## 📸 Screenshots

See `docs/screenshots/README.md` for an annotated index. Key captures:

- `09-pipeline-bug2-success.png` — initial smoke run on BUG-2.
- `10-work-agents-pipeline.png` — full `npm run pipeline` over all four
  bugs, ending with `Final npm test exit code: 0`.
- `11-success-pipeline.png` — post-run quality review of the generated
  artifacts.

---

<div align="center">

*This project was completed as part of the AI-Assisted Development course.*

</div>
