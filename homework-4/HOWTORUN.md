# How to run

All commands run from `homework-4/` unless noted. Node ≥ 20 required.

## 1. Install

```bash
cd homework-4
npm install
```

Builds the `better-sqlite3` native binding on first install.

## 2. Run the test suite

```bash
npm test
```

Post-pipeline expected: **54 / 54 passing**, 0 failures.

## 3. Run the sample app

```bash
npm start
```

Listens on `http://localhost:3000` (override with `PORT=4310`). Persists to
`data.sqlite` in the working directory (gitignored).

Example calls:

```bash
# register
curl -s -X POST http://localhost:3000/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"new@example.com","password":"pw","name":"New"}'

# login with seeded user
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"alice@example.com","password":"alice-pass"}' | jq -r .token)

# fetch a profile
curl -s http://localhost:3000/users/1 -H "Authorization: Bearer $TOKEN"

# paginated list
curl -s "http://localhost:3000/users?limit=5&offset=2" \
  -H "Authorization: Bearer $TOKEN"

# search
curl -s "http://localhost:3000/users/search?q=alice" \
  -H "Authorization: Bearer $TOKEN"
```

For SEC-2 production use, set the token secret in the environment:

```bash
export AUTH_SECRET=$(openssl rand -hex 32)
npm start
```

## 4. Run the 4-agent pipeline

### Prerequisites

- `claude` CLI installed and authenticated locally (`claude /login` or
  `ANTHROPIC_API_KEY`).
- Clean git working tree. The pipeline auto-commits after each successful
  bug; uncommitted changes would mix with pipeline-generated commits.

### Commands

```bash
# All four bugs sequentially (~30–45 min wall-clock, non-trivial credit cost)
npm run pipeline

# Single bug (cheaper smoke test, ~5–10 min)
npm run pipeline -- BUG-2
```

Valid bug ids: `BUG-1`, `BUG-2`, `SEC-1`, `SEC-2`.

### What you should see

- Per-step lines like `[BUG-2] bug-researcher (claude-sonnet-4-6) ...`.
- A per-bug auto-commit `fix(homework-4): apply pipeline-generated fix for <ID>`.
- All six artifacts under `context/bugs/<ID>/` after each successful chain:
  `bug-context.md`, `research/codebase-research.md`,
  `research/verified-research.md`, `implementation-plan.md`,
  `fix-summary.md`, `security-report.md`, `test-report.md`.
- Final `npm test` exit code printed (only on full runs).

### Where logs go

`homework-4/context/runs/<ISO timestamp>/<BUG_ID>/<agent>.log` — captured
stdout+stderr per agent invocation.

### When something goes wrong

- `claude: command not found` → install/configure the CLI.
- Any agent exits non-zero → inspect its `.log` for the failure mode; the
  chain for that bug aborts and the next bug starts.
- "Boundary violation" message → the agent wrote outside its allowed scope.
  The orchestrator aborts the chain and asks you to inspect manually with
  `git status` / `git diff`; nothing is auto-deleted.

## 5. Cost expectation

A full default run is 6 agents × 4 bugs = 24 `claude -p` invocations.

| Agent | Model | Why |
|---|---|---|
| Bug Researcher | `claude-sonnet-4-6` | reasoning + code-base reading |
| Research Verifier | `claude-opus-4-7` | fact-checking |
| Bug Planner | `claude-sonnet-4-6` | structured before/after spec |
| Bug Fixer | `claude-haiku-4-5-20251001` | routine apply-plan |
| Security Verifier | `claude-opus-4-7` | vulnerability discovery |
| Unit Test Generator | `claude-haiku-4-5-20251001` | FIRST-shaped tests |

On a Claude Pro plan this consumes a meaningful slice of the weekly
allowance (roughly 30–60% per full run). Use `npm run pipeline -- BUG-2`
first as a smoke test to confirm the orchestrator works before paying for
the whole sweep.
