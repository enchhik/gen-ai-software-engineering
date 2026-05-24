# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository context

Personal homework repository for the **GenAI and Agentic AI for Software Engineering** course by **Denys Ostrometskyi**. Forked from the instructor's template (`upstream`). Six homework assignments live in `homework-1/` … `homework-6/`, each with its own scope, tech stack, and required deliverables.

## Source of truth per homework

**Always read `homework-N/TASKS.md` before starting work on a homework.** Required files vary significantly between assignments:

- `homework-2` requires `src/`, tests, `HOWTORUN.md`, `docs/screenshots/`, `demo/`
- `homework-3` is no-code: requires `specification.md`, `agents.md`, editor/AI rules, `README.md` — no `HOWTORUN.md`, no `demo/`, no screenshots

Do not assume a fixed file structure. `TASKS.md` dictates deliverables.

## Getting a new homework

```bash
git fetch upstream
git checkout main
git merge --ff-only upstream/main
git push origin main
git checkout -b homework-N-submission
```

**Do not modify upstream-owned files** (root `README.md`, `homework-N/TASKS.md`, instructor templates such as `specification-TEMPLATE-example.md`). Editing them creates merge conflicts on the next upstream sync.

## PR requirements

PRs go from `homework-N-submission` → `main` **on the personal fork only** (never into the upstream repo).

A PR with a thin description will be rejected even if the code is correct. The PR body must stand on its own:

```
## Summary
- What was implemented (enough detail for a reader unfamiliar with the branch)

## AI Tools Used
- Tools, models, prompts/workflow, what was verified manually

## Challenges
- What was hard and how it was addressed

## How to Verify
- Exact steps to run and test the solution

## Screenshots
- Embedded key screenshots or links to docs/screenshots/
```

After opening: assign reviewer **Alexey-Popov**, add label `homework-N`.

## Working conventions

**Language:** code, comments, docs, and commit messages are English. **PR bodies and chat with the user are Ukrainian.** (PR descriptions follow the structure the instructor approved on the homework-2 PR: a `/cc @Alexey-Popov` line, a summary, an explicit `TASKS.md` compliance section, a how-to-verify section, and a Context → Model → Prompt breakdown of AI usage.)

**Commit messages:** Conventional Commits format — `<type>(<scope>): <subject>`.

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `style`, `perf`.
Scope: usually the homework directory (`homework-2`) or `repo` for cross-cutting changes.
Subject: imperative, lowercase, no trailing period.

Examples:
```
feat(homework-2): add ticket auto-classifier
fix(homework-2): handle empty CSV import
docs(homework-2): expand AI tool log in README
test(homework-2): cover XML importer edge cases
chore(repo): add CLAUDE.md with course conventions
```

**Date format:** ISO `YYYY-MM-DD` everywhere (READMEs, PR bodies, docs).

**Nested CLAUDE.md is encouraged:** put homework-specific guidance (stack commands, architecture notes, testing strategy) in `homework-N/CLAUDE.md` rather than this root file. Homework-3 explicitly requires editor/AI rules as a deliverable, which can live at `homework-3/CLAUDE.md` or `homework-3/.claude/`.
