# Homework 4 — Pipeline & Agents Design

**Date:** 2026-06-14
**Scope:** Tasks 1–4 of TASKS.md — the 4-agent (in practice 6-agent) pipeline,
the two required skills, the bug-context files, and the orchestrator. Task 5
(the sample app) is already implemented per the earlier app design spec
(`2026-05-24-hw4-sample-app-design.md`).

## Purpose

Build the agentic pipeline that processes the four seeded defects in the
sample app (`homework-4/src/`) and produces all required artifacts:
`verified-research.md`, `fix-summary.md`, `security-report.md`,
`test-report.md` per bug. The pipeline must be runnable with a single command
and load its agents and skills automatically.

## Pipeline shape

For each `<BUG_ID>` in `context/bugs/`, the orchestrator runs six agents in a
fixed chain:

```
Bug Researcher
  → Research Verifier
  → Bug Planner
  → Bug Fixer
  → Security Verifier
  → Unit Test Generator
```

The four agents `research-verifier`, `bug-fixer`, `security-verifier`,
`unit-test-generator` satisfy the required-4 from TASKS.md. The two helper
agents `bug-researcher` and `bug-planner` exist so that the verifier has a
research file to verify and the fixer has a plan to apply — they are not in
the required-4 but are necessary for the chain to be runnable without manual
intervention.

## Orchestration mechanism

A single Node script `homework-4/scripts/run-pipeline.js`, invoked as
`npm run pipeline [-- <BUG_ID>]`. The script invokes `claude -p` headless once
per agent per bug.

For each step it:

1. Reads the agent definition `agents/<agent>.agent.md` (frontmatter + body)
   and parses out the model and any skill references.
2. Reads any required skill files from `homework-4/skills/`.
3. Builds the system prompt by concatenating: the agent body, the skill body
   (if any), and a short path-restriction block ("you may only write under
   `context/bugs/<BUG_ID>/...`", etc.).
4. Builds the user prompt naming the current `<BUG_ID>` and the artifacts the
   agent must produce.
5. Spawns `claude -p <userPrompt> --model <model> --append-system-prompt
   <systemPrompt> --allowedTools <list>`, with stdout/stderr captured to
   `context/runs/<ISO>/<BUG_ID>/<agent>.log`.
6. Checks exit code. Non-zero → abort the chain for this bug, move to the
   next bug, mark the run as failed.

Skill loading is by **inlining**, not by Claude Code's auto-discovery:
`claude -p` would require skills under `.claude/skills/<name>/SKILL.md` and a
`--setting-sources project` flag. Inlining is deterministic, keeps the skill
files in `homework-4/skills/` where TASKS.md expects them as deliverables, and
makes the prompt explicit in the log.

## Agents

Each agent lives at `homework-4/agents/<name>.agent.md` with YAML frontmatter
naming the model. The body describes its role, inputs, outputs, the
path-restriction rules, and (where relevant) the skill it must use.

Model assignment (per TASKS.md wording — "stronger reasoning for research
verification and security review, faster/cheaper for routine fixes or test
scaffolding"):

| Agent | Model | Reason (per TASKS.md or judgment) |
|---|---|---|
| `bug-researcher.agent.md` | `claude-sonnet-4-6` | code-base search + synthesis; needs reasoning but not at Opus altitude |
| `research-verifier.agent.md` | `claude-opus-4-7` | "research verification" → stronger reasoning |
| `bug-planner.agent.md` | `claude-sonnet-4-6` | structured planning |
| `bug-fixer.agent.md` | `claude-haiku-4-5-20251001` | "routine fixes" → faster/cheaper |
| `security-verifier.agent.md` | `claude-opus-4-7` | "security review" → stronger reasoning |
| `unit-test-generator.agent.md` | `claude-haiku-4-5-20251001` | "test scaffolding" → faster/cheaper |

The Haiku assignments depend on the Bug Planner producing concrete
file:line + before/after plans and on the FIRST skill being precise. If
either is loose, Fixer or Test Generator can be upgraded to Sonnet 4.6 by
editing one frontmatter line.

### Per-agent role, inputs, outputs, tools

| Agent | Reads | Writes | `--allowedTools` | Path restriction (in system prompt) |
|---|---|---|---|---|
| Bug Researcher | `bug-context.md`, `src/`, `tests/` | `research/codebase-research.md` | `Read,Glob,Grep,Write,Bash` | Write only under `context/bugs/<BUG>/research/`. Bash is read-only (`npm test`, grep). No source edits. |
| Research Verifier | `research/codebase-research.md`, `src/`, `tests/` | `research/verified-research.md` (per the `research-quality-measurement` skill) | `Read,Glob,Grep,Write` | Write only `verified-research.md`. No Bash. |
| Bug Planner | `verified-research.md`, `src/`, `tests/` | `implementation-plan.md` | `Read,Glob,Grep,Write` | Write only `implementation-plan.md`. |
| Bug Fixer | `implementation-plan.md`, `src/`, `tests/` | `src/*`, `tests/*` (per plan), `fix-summary.md` | `Read,Glob,Grep,Write,Edit,Bash` | Edit only under `src/`. Write only `fix-summary.md` (+ new test files only if the plan says so — usually leaves tests to the Test Generator). Bash for `npm test`. |
| Security Verifier | `fix-summary.md`, changed `src/` files (via `git diff`), all of `src/` for sweep | `security-report.md` | `Read,Glob,Grep,Write,Bash` | Write only `security-report.md`. **No Edit at all** (TASKS.md: "report only, no code edits"). Bash for `git diff` / grep. |
| Unit Test Generator | `fix-summary.md`, changed `src/` files, existing `tests/*` | new tests under `tests/`, `test-report.md` (per the `unit-tests-FIRST` skill) | `Read,Glob,Grep,Write,Edit,Bash` | Edit/Write only under `tests/` + `context/bugs/<BUG>/test-report.md`. Must not touch `src/`. Bash for `npm test`. |

Path restrictions are enforced via the system prompt's "Forbidden:" block;
`--allowedTools` only restricts the tool type, not the path.

## Skills

Two skills live at `homework-4/skills/`:

- `research-quality-measurement.md` — defines quality levels for the
  research artifact: `EXCELLENT`, `GOOD`, `ACCEPTABLE`, `WEAK`, `INVALID`,
  with criteria for each (every file:line reference correct, every code
  snippet exact, root cause identified, etc.). The Research Verifier must
  cite a level and supporting reasoning in `verified-research.md`.
- `unit-tests-FIRST.md` — defines FIRST (Fast, Independent, Repeatable,
  Self-validating, Timely) with a worked example using `node:test` +
  `supertest` against `createApp(createDb(':memory:'))`. Test Generator must
  produce tests that satisfy each letter and explain how in
  `test-report.md`.

Each skill is a normal Markdown file with a top-level title and explicit
sections. No `.claude/skills/` directory; orchestrator reads and inlines.

## Bug-context files

The orchestrator processes every directory under `context/bugs/*`. Each
directory has a `bug-context.md` describing observable symptoms only — no
file paths, no expected fixes. Researcher's job is to localize the cause.

| ID | bug-context.md content (symptom-only) |
|---|---|
| BUG-1 | "Two tests in `tests/users.routes.test.js` are failing: one expects the default page size to be 10 but observes a different count; the other expects `?offset=2&limit=3` to return user ids `[3,4,5]` but observes a different list. Locate the cause and prepare a fix." |
| BUG-2 | "One test in `tests/auth.routes.test.js` is failing: registering with `Carol@example.com` and then logging in with `carol@example.com` returns 401 instead of 200. The intended behaviour is case-insensitive email match. Locate the cause and prepare a fix." |
| SEC-1 | "Pre-pipeline manual security audit flagged a potential input-handling weakness in one of the read endpoints of the public API. Identify the exact location and nature of the issue. Tests are currently green; the weakness is not visible from existing unit tests." |
| SEC-2 | "Pre-pipeline manual security audit flagged concerns about secret management and credential storage in the authentication module. Identify the exact weaknesses." |

For SEC-* the bug-context names an area (read endpoints / auth) but not a
file or handler — Researcher must locate.

For SEC-2 the symptom additionally contains the invariant: **"After the fix
the existing login test (`POST /auth/login returns a token for valid
credentials`) using seeded credentials (`alice@example.com` / `alice-pass`)
must continue to pass."** This forces the Planner to consider that the seed
needs to keep working, without naming the seed file.

## Pre-pipeline app refactor (one-time)

The current `homework-4/src/db.js` inserts plaintext passwords directly. As
soon as SEC-2's fix changes `hashPassword` from identity to real hashing, the
seeded rows become unverifiable.

Therefore, before the pipeline is invoked, `src/db.js` is updated so the
seed insertion calls `hashPassword` on the literal passwords at insert time:

```js
insert.run(email, name, hashPassword(plainPassword));
```

In the current (before-pipeline) state `hashPassword` is identity, so behaviour
is unchanged — the existing tests still pass with the same colour. After the
SEC-2 fix `hashPassword` will be a real scrypt-based hash and the seeded
fixtures are hashed automatically. The Planner does not need to know about
`db.js`; the code structure itself preserves the invariant.

This is a separate small commit before the pipeline runs.

## Outer iteration

```
npm run pipeline             # process every directory under context/bugs/
npm run pipeline -- BUG-1    # process only BUG-1
```

Bugs are processed in deterministic order (lexicographic: BUG-1, BUG-2,
SEC-1, SEC-2). Fixes accumulate across the run — there is no git reset
between bugs. After each successful bug the orchestrator makes a single auto
commit with a fixed message format:

```
fix(homework-4): apply pipeline-generated fix for BUG-1

Pipeline artifacts: context/bugs/BUG-1/
```

If a bug fails (any agent in its chain exits non-zero), the orchestrator
records the failure, skips the auto-commit for that bug, and continues to the
next bug. Pipeline overall exit code is non-zero if any bug failed.

## Final verification

After the last bug, the orchestrator runs `npm test` once more and writes its
output to `context/runs/<ISO>/final-test-report.txt`. If any test is red it
also writes the failing test names to `final-test-report.txt` and exits
non-zero. Otherwise the file contains "all 19 tests pass" (or whatever the
post-fix count is once the Test Generator adds tests).

## Run logs and artifacts

```
context/runs/<ISO timestamp>/
├── <BUG_ID>/
│   ├── researcher.log
│   ├── research-verifier.log
│   ├── planner.log
│   ├── fixer.log
│   ├── security-verifier.log
│   └── test-generator.log
└── final-test-report.txt
```

Per-bug artifacts (the actual deliverables) live at
`context/bugs/<BUG_ID>/`:

```
context/bugs/BUG-1/
├── bug-context.md
├── research/
│   ├── codebase-research.md
│   └── verified-research.md
├── implementation-plan.md
├── fix-summary.md
├── security-report.md
└── test-report.md
```

## Cost & time expectation (for HOWTORUN)

A full default run is 6 agents × 4 bugs = 24 LLM invocations: 8 Opus, 8
Sonnet, 8 Haiku. Realistic wall-clock ~30–60 minutes and a non-trivial
amount of credit. HOWTORUN must warn about this and offer the one-bug form
(`npm run pipeline -- BUG-1`) as a cheaper smoke test.

## Prerequisites (for HOWTORUN)

- `claude` CLI installed and authenticated locally (`claude login` or
  `ANTHROPIC_API_KEY`).
- Node ≥ 20, `npm install` already run in `homework-4/`.
- Clean git working tree (the pipeline auto-commits after each successful
  bug; uncommitted changes would mix with pipeline-generated commits).

## Out of scope (handled elsewhere or not required)

- Resume mode (`--from <agent>` after a partial failure). Manual re-run of
  the single bug suffices for the homework.
- Parallelism across bugs. Sequential is simpler and matches the
  accumulating-fixes model.
- Auto-discovery of skills via `--setting-sources`. Inlining covers the same
  outcome.
- Bug Detector / automatic bug-context generation from test failures. Out of
  scope of TASKS.md's required-4.
- README and HOWTORUN content (separate authoring step after the pipeline
  works).
- Screenshots (manual artefact after a successful run).