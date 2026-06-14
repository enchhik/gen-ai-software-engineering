# Homework 4 — Screenshots

Captures from the homework-4 design and execution session on 2026-06-14.

## Dialog scrollback (Claude Code session)

| File | What it shows |
|---|---|
| `01-brainstorming-orchestration.png` | Brainstorming the pipeline orchestration mechanism: `claude` CLI headless vs Anthropic SDK, six-agent composition, per-bug iteration. |
| `02-subagent-task-execution.png` | Subagent-driven execution of plan tasks with green/red test blocks and per-task commits. |
| `03-helper-tests-passing.png` | Pipeline helper library (Task 6) with all 10 unit tests passing. |
| `04-orchestrator-self-review.png` | Self-audit of the orchestrator plan: boundary guard, narrow `git add` scope, partial-run skip for final verification. |
| `05-screenshot-incident-fix.png` | The incident where the first orchestrator deleted pre-existing untracked files, plus the fix (snapshot-based boundary check, no destructive rollback). |

## IDE and pipeline run

| File | What it shows |
|---|---|
| `06-ide-project-structure.png` | The `homework-4/` project tree in the IDE (Cursor) showing agents, skills, scripts, src and tests. |
| `07-bug-researcher-output.png` | Live `tail -f` of the Bug Researcher agent's log during the BUG-2 pipeline run, including the root-cause summary. |
| `08-pipeline-artifacts.png` | The pipeline-generated artifacts on disk: `codebase-research.md`, `verified-research.md`, `fix-summary.md`, etc. |
| `09-pipeline-bug2-success.png` | `npm run pipeline -- BUG-2` end-to-end: all six agents (Researcher → Verifier → Planner → Fixer → Security Verifier → Test Generator) complete and the auto-commit lands. |
