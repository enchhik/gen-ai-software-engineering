# Homework 4 — Pipeline & Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 6-agent pipeline (4 required + 2 helpers), two skills,
four symptom-only bug-context files, and a Node orchestrator
(`scripts/run-pipeline.js`) per the design spec
`homework-4/docs/superpowers/specs/2026-06-14-hw4-pipeline-design.md`.

**Architecture:** A Node script runs once per `npm run pipeline`. For each
bug-context directory it invokes `claude -p` headless six times in a fixed
chain. Each invocation gets the agent body + any required skill inlined into
`--append-system-prompt`, a per-agent `--allowedTools` allowlist, and the
model named in the agent's YAML frontmatter. Fixes accumulate across bugs;
the orchestrator auto-commits after each successful bug.

**Tech Stack:** Node ≥ 20 (ESM), `child_process.spawnSync`, `claude` CLI
headless. No new npm dependencies for the orchestrator.

**Working directory for all tasks:** `homework-4/`. Run commands from there
unless noted.

---

## File map

| Path | Responsibility |
|---|---|
| `homework-4/src/db.js` | **modified** — seed insert calls `hashPassword` so the SEC-2 fix won't break login |
| `homework-4/skills/research-quality-measurement.md` | quality levels + criteria used by Research Verifier |
| `homework-4/skills/unit-tests-FIRST.md` | FIRST principles with node:test + supertest examples used by Test Generator |
| `homework-4/agents/bug-researcher.agent.md` | role, model, output paths |
| `homework-4/agents/research-verifier.agent.md` | same; loads research-quality skill |
| `homework-4/agents/bug-planner.agent.md` | same |
| `homework-4/agents/bug-fixer.agent.md` | same; only agent with Edit on `src/` |
| `homework-4/agents/security-verifier.agent.md` | same; no Edit at all |
| `homework-4/agents/unit-test-generator.agent.md` | same; loads FIRST skill; Edit only on `tests/` |
| `homework-4/context/bugs/BUG-1/bug-context.md` | **rewritten** — symptom only |
| `homework-4/context/bugs/BUG-2/bug-context.md` | **rewritten** — symptom only |
| `homework-4/context/bugs/SEC-1/bug-context.md` | **rewritten** — symptom only |
| `homework-4/context/bugs/SEC-2/bug-context.md` | **rewritten** — symptom + post-fix invariant |
| `homework-4/scripts/pipeline-lib.js` | pure helpers (frontmatter parse, bug listing, prompt builders) — unit-tested |
| `homework-4/scripts/run-pipeline.js` | orchestrator entry point |
| `homework-4/tests/pipeline-lib.test.js` | unit tests for the pure helpers |
| `homework-4/package.json` | add `"pipeline"` npm script |

---

## Task 1: Refactor `db.js` to hash at insert (SEC-2 prep)

**Why:** Once SEC-2's Bug Fixer replaces `hashPassword` with real hashing,
the plaintext-seeded rows will no longer verify. If `db.js` instead calls
`hashPassword(plainPassword)` at insert time, then while `hashPassword` is
the identity (now) behaviour is unchanged; once `hashPassword` becomes real,
the seed is hashed automatically.

**Files:**
- Modify: `homework-4/src/db.js`

- [ ] **Step 1: Modify `homework-4/src/db.js`**

Replace the inner body of `createDb`'s `if (count === 0)` block. Specifically
add an import of `hashPassword` at the top and call it on the seed password
before `insert.run`. The full updated file:

```js
import Database from 'better-sqlite3';
import { hashPassword } from './auth.js';

const SEED = [
  ['alice@example.com',   'Alice',    'alice-pass'],
  ['bob@example.com',     'Bob',      'bob-pass'],
  ['Carol@example.com',   'Carol',    'carol-pass'],
  ['dave@example.com',    'Dave',     'dave-pass'],
  ['eve@example.com',     'Eve',      'eve-pass'],
  ['frank@example.com',   'Frank',    'frank-pass'],
  ['grace@example.com',   'Grace',    'grace-pass'],
  ['heidi@example.com',   'Heidi',    'heidi-pass'],
  ['ivan@example.com',    'Ivan',     'ivan-pass'],
  ['judy@example.com',    'Judy',     'judy-pass'],
  ['mallory@example.com', 'Mallory',  'mallory-pass'],
  ['oscar@example.com',   'Oscar',    'oscar-pass'],
];

export function createDb(path = ':memory:') {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      password TEXT NOT NULL
    );
  `);
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO users (email, name, password) VALUES (?, ?, ?)');
    const tx = db.transaction((rows) => {
      for (const [email, name, plain] of rows) {
        insert.run(email, name, hashPassword(plain));
      }
    });
    tx(SEED);
  }
  return db;
}
```

- [ ] **Step 2: Verify tests still pass**

From `homework-4/`: `npm test`
Expected: same as before — 19 total, 16 pass, 3 fail (the seeded reds).
`hashPassword` is still the identity, so behaviour is unchanged.

- [ ] **Step 3: Commit**

```bash
git add homework-4/src/db.js
git commit -m "refactor(homework-4): hash seeded passwords at insert (SEC-2 prep)"
```

---

## Task 2: Skill — research-quality-measurement

**Files:**
- Create: `homework-4/skills/research-quality-measurement.md`

- [ ] **Step 1: Create the file**

```markdown
# Research Quality Measurement

This skill defines the labels and criteria the Research Verifier uses when
writing `verified-research.md`.

## Quality levels

Use **exactly one** of these labels, in descending order of confidence:

- **EXCELLENT** — every file:line reference in the research is correct;
  every code snippet matches source verbatim; the named root cause fully
  explains the observed symptom; nothing is speculative.
- **GOOD** — all file:line references correct; at most one minor snippet
  discrepancy (e.g. whitespace, comment drift) with no semantic impact; the
  named root cause explains the symptom.
- **ACCEPTABLE** — at most one wrong or missing file:line reference; root
  cause is plausible but missing one supporting detail; planning can still
  proceed.
- **WEAK** — multiple references are wrong, missing, or vague; or the named
  root cause does not fully account for the symptom. Planning should not
  proceed until research is redone.
- **INVALID** — research is empty, contradicts the source, or names files
  that do not exist. Reject and re-run the researcher.

## Verifier output format

`verified-research.md` must contain these sections in order:

1. **Verification Summary** — pass/fail and one of the labels above.
2. **Verified Claims** — bullet list of each researcher claim that was
   checked against source, with the verifier's confirmation.
3. **Discrepancies Found** — each mismatch between the research and source,
   with file:line and the diff.
4. **Research Quality Assessment** — restate the label, with the reasoning
   that places it at that level (which criteria were met, which were not).
5. **References** — every file:line consulted during verification.

The label drives Planner behaviour: EXCELLENT/GOOD/ACCEPTABLE → proceed;
WEAK/INVALID → orchestrator aborts the chain for this bug.
```

- [ ] **Step 2: Commit**

```bash
git add homework-4/skills/research-quality-measurement.md
git commit -m "feat(homework-4): add research-quality-measurement skill"
```

---

## Task 3: Skill — unit-tests-FIRST

**Files:**
- Create: `homework-4/skills/unit-tests-FIRST.md`

- [ ] **Step 1: Create the file**

```markdown
# FIRST Principles for Unit Tests

The Unit Test Generator must produce tests that satisfy each FIRST letter
and explain how in `test-report.md`.

## The five letters

- **F — Fast.** A single test must run in under 100 ms on a developer
  machine. Use the in-memory database (`createDb(':memory:')`); never touch
  the file-backed `data.sqlite`. Never sleep.
- **I — Independent.** Tests must not depend on each other's order or
  shared state. Each test builds its own app via
  `createApp(createDb(':memory:'))`. Do not reuse a token issued by one test
  in another.
- **R — Repeatable.** Same input → same output, every time. No reliance on
  the system clock, randomness, or the network. Use `signToken({…})` for
  test tokens, not real login flows that involve hashing time.
- **S — Self-validating.** Every test ends with an `assert.*` (or
  `assert.deepEqual`). A test that prints output and expects a human to
  judge is not self-validating.
- **T — Timely.** Tests are written immediately after (or before) the
  changed code, not weeks later. The Test Generator writes them as part of
  the same pipeline pass that produced the fix.

## Stack template

For this project the test stack is `node:test` + `supertest` against the
in-memory app:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { signToken } from '../src/auth.js';

test('describe what behaviour you are pinning', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users/1')
    .set('Authorization', `Bearer ${signToken({ id: 1, email: 'alice@example.com' })}`);
  assert.equal(res.status, 200);
});
```

## test-report.md required sections

1. **Tests Added** — file:line for each new test, with the FIRST-letter
   justification for each.
2. **Test Run Result** — `npm test` exit code and pass/fail summary.
3. **Coverage Rationale** — which changed lines in the fix are covered by
   which new test.
```

- [ ] **Step 2: Commit**

```bash
git add homework-4/skills/unit-tests-FIRST.md
git commit -m "feat(homework-4): add unit-tests-FIRST skill"
```

---

## Task 4: Six agent definition files

**Files:**
- Create: `homework-4/agents/bug-researcher.agent.md`
- Create: `homework-4/agents/research-verifier.agent.md`
- Create: `homework-4/agents/bug-planner.agent.md`
- Create: `homework-4/agents/bug-fixer.agent.md`
- Create: `homework-4/agents/security-verifier.agent.md`
- Create: `homework-4/agents/unit-test-generator.agent.md`

Each file uses YAML frontmatter naming the model. The model values are the
exact model ids: `claude-opus-4-7`, `claude-sonnet-4-6`,
`claude-haiku-4-5-20251001`.

- [ ] **Step 1: Create `homework-4/agents/bug-researcher.agent.md`**

```markdown
---
model: claude-sonnet-4-6
role: Bug Researcher
---

# Bug Researcher

You investigate a single seeded bug in the `homework-4/` sample app and
produce a research document that names the file:line of the cause and the
code path that produces the symptom.

## Inputs you may read
- `context/bugs/<BUG_ID>/bug-context.md` — the symptom report
- All of `src/` and `tests/` (read only)

## Output you must write
- `context/bugs/<BUG_ID>/research/codebase-research.md`

Required sections in your output:
1. **Symptom Restated** — one paragraph
2. **Reproduction** — exact command(s) to reproduce (e.g. `npm test
   --filter <name>` or a `curl` line); the observed and expected outputs
3. **Likely Cause** — file:line + the relevant code snippet copied verbatim
4. **Supporting Evidence** — other file:line references that corroborate
5. **Open Questions** — anything you couldn't confirm

## Forbidden
- Editing any file under `src/` or `tests/`
- Writing any file outside `context/bugs/<BUG_ID>/research/`
- Running tests that mutate state outside the in-memory DB

## How to work
Start by reproducing the symptom with `npm test`. Use `grep` and `Read` to
trace the failing test's assertion back to the handler that produced the
observed value. Quote source exactly — the Research Verifier will check
every file:line.
```

- [ ] **Step 2: Create `homework-4/agents/research-verifier.agent.md`**

```markdown
---
model: claude-opus-4-7
role: Research Verifier
---

# Research Verifier

You fact-check the Bug Researcher's output for a single bug and rate its
quality using the `research-quality-measurement` skill (inlined below).

## Inputs you may read
- `context/bugs/<BUG_ID>/research/codebase-research.md`
- All of `src/` and `tests/` (read only)

## Output you must write
- `context/bugs/<BUG_ID>/research/verified-research.md` — exactly the
  section structure defined in the skill.

## Forbidden
- Editing any file under `src/`, `tests/`, or `context/bugs/<BUG_ID>/`
  except `verified-research.md`
- Running tests or any Bash

## How to work
For every file:line reference and every code snippet in the research,
locate the source and confirm a verbatim match. List discrepancies. Then
pick exactly one quality label per the skill and justify it.
```

- [ ] **Step 3: Create `homework-4/agents/bug-planner.agent.md`**

```markdown
---
model: claude-sonnet-4-6
role: Bug Planner
---

# Bug Planner

You produce a concrete, file:line, before/after implementation plan for the
Bug Fixer.

## Inputs you may read
- `context/bugs/<BUG_ID>/research/verified-research.md`
- All of `src/` and `tests/` (read only)

## Output you must write
- `context/bugs/<BUG_ID>/implementation-plan.md`

Required structure:
1. **Goal** — one sentence
2. **Affected Files** — exact paths
3. **Changes** — for each affected file: a fenced code block titled
   `before` and another titled `after`, both copied verbatim from / written
   for the source. No "etc.", no ellipses.
4. **Verification Command** — the exact `npm test` (or `npx node --test`)
   invocation that should turn green once the changes are applied
5. **Invariants** — any test or behaviour that must continue to hold after
   the fix (copy these from the bug-context if it lists them)

## Forbidden
- Editing source or tests
- Writing anything outside `implementation-plan.md`

## How to work
Read the verified research. If the verified quality is WEAK or INVALID,
write a single-line `implementation-plan.md` that says
`STATUS: ABORT — research quality is too low to plan from.` and exit. The
orchestrator will skip the rest of the chain.

Otherwise, write a plan precise enough that the Bug Fixer can apply it
mechanically with no judgement calls.
```

- [ ] **Step 4: Create `homework-4/agents/bug-fixer.agent.md`**

```markdown
---
model: claude-haiku-4-5-20251001
role: Bug Fixer
---

# Bug Fixer

You apply an implementation plan literally and document the changes.

## Inputs you may read
- `context/bugs/<BUG_ID>/implementation-plan.md`
- All of `src/` and `tests/`

## Output you must write
- Edits to `src/` exactly as specified by the plan
- `context/bugs/<BUG_ID>/fix-summary.md`

Required structure of `fix-summary.md`:
1. **Changes Made** — for each modified file: location, before, after,
   `npm test` result captured after this change
2. **Overall Status** — pass / partial / fail
3. **Manual Verification** — exact `curl` or test command a reviewer can
   run to confirm the fix
4. **References** — back-link to `implementation-plan.md` and the verified
   research

## Forbidden
- Editing tests (the Test Generator does that later)
- Writing files outside `src/` and `fix-summary.md`
- Deviating from the plan — if the plan is wrong, write a fix-summary with
  status `fail` and a one-paragraph explanation, then exit. Do not
  improvise.

## How to work
For each "after" block in the plan: open the file, replace the matching
"before" with the "after". After every change run `npm test`. Capture the
exit code and the failing-test list (if any) in the fix-summary.
```

- [ ] **Step 5: Create `homework-4/agents/security-verifier.agent.md`**

```markdown
---
model: claude-opus-4-7
role: Security Verifier
---

# Security Verifier

You scan the changed code (and surrounding modules) for vulnerabilities and
produce a report. You do not edit code.

## Inputs you may read
- `context/bugs/<BUG_ID>/fix-summary.md`
- All of `src/` and `tests/`
- Output of `git diff --staged` and `git diff HEAD` for context

## Output you must write
- `context/bugs/<BUG_ID>/security-report.md`

Required structure:
1. **Scope** — files and ranges scanned
2. **Findings** — for each: severity
   (`CRITICAL`/`HIGH`/`MEDIUM`/`LOW`/`INFO`), file:line, description,
   suggested remediation
3. **No-Issue Areas** — files scanned with nothing found
4. **References** — every file:line cited

Categories to consider for each scanned function: injection (SQL, command,
path), hardcoded secrets, insecure comparisons (timing, equality of
hashes), missing input validation, unsafe dependency calls, XSS/CSRF where
HTTP responses are involved.

## Forbidden
- **Any** code edit. You may not use `Edit`.
- Writing anywhere except `security-report.md`.

## How to work
Start from the files named in the fix-summary, then expand to imported
modules. Treat each finding as the conclusion of a chain that names a
concrete attack input and the line of source that allows it.
```

- [ ] **Step 6: Create `homework-4/agents/unit-test-generator.agent.md`**

```markdown
---
model: claude-haiku-4-5-20251001
role: Unit Test Generator
---

# Unit Test Generator

You add unit tests covering the changed code, following the FIRST skill
(inlined below).

## Inputs you may read
- `context/bugs/<BUG_ID>/fix-summary.md`
- All of `src/` and `tests/`

## Output you must write
- One or more new files under `homework-4/tests/` covering the changes
  named in the fix-summary (or edits to an existing test file in the same
  directory)
- `context/bugs/<BUG_ID>/test-report.md` — the section structure defined in
  the FIRST skill

## Forbidden
- Editing any file under `src/`
- Writing tests for code that wasn't changed by this bug
- Writing files outside `tests/` and `context/bugs/<BUG_ID>/test-report.md`

## How to work
Read the fix-summary's "Changes Made" section. For each changed code path,
write a test that pins the new behaviour using
`createApp(createDb(':memory:'))` + supertest (HTTP-level) or by importing
the helper directly (unit-level). Run `npm test` and record the result.
Reject any test that violates a FIRST letter — rewrite or drop it.
```

- [ ] **Step 7: Commit**

```bash
git add homework-4/agents/
git commit -m "feat(homework-4): add six agent definition files"
```

---

## Task 5: Rewrite four bug-context files (symptom-only)

**Files:**
- Modify: `homework-4/context/bugs/BUG-1/bug-context.md`
- Modify: `homework-4/context/bugs/BUG-2/bug-context.md`
- Modify: `homework-4/context/bugs/SEC-1/bug-context.md`
- Modify: `homework-4/context/bugs/SEC-2/bug-context.md`

- [ ] **Step 1: Overwrite `BUG-1/bug-context.md`**

```markdown
# BUG-1 — `GET /users` returns wrong rows

Two unit tests in `tests/users.routes.test.js` are failing:

- "GET /users applies a default limit of 10" — expects the default page
  size to be 10 but observes a different count.
- "GET /users honours offset correctly" — expects
  `?offset=2&limit=3` to return user ids `[3, 4, 5]` but observes a
  different list.

Locate the cause and prepare a fix. The fix must make both failing tests
pass without regressing any test that is currently green.
```

- [ ] **Step 2: Overwrite `BUG-2/bug-context.md`**

```markdown
# BUG-2 — login fails for users registered with mixed-case email

One unit test in `tests/auth.routes.test.js` is failing:

- "POST /auth/login matches email case-insensitively" — registers
  `Carol@example.com` (or relies on a seeded user with that casing) and
  then logs in with `carol@example.com`. Observes 401; expects 200 with a
  token.

The intended behaviour is that email comparison on login is
case-insensitive. Locate the cause and prepare a fix.
```

- [ ] **Step 3: Overwrite `SEC-1/bug-context.md`**

```markdown
# SEC-1 — input-handling weakness in a read endpoint

A pre-pipeline manual security audit flagged a potential input-handling
weakness in one of the read endpoints of the public API. Identify the
exact location and the nature of the issue.

Existing unit tests are currently green — the weakness is not visible from
the test suite. Treat the audit note as the only signal; do not assume the
weakness is the same as the failing-test bugs.

The Bug Fixer should produce a code change that closes the weakness
without changing the endpoint's observable behaviour for benign inputs.
```

- [ ] **Step 4: Overwrite `SEC-2/bug-context.md`**

```markdown
# SEC-2 — secret management and credential storage in the auth module

A pre-pipeline manual security audit flagged concerns about secret
management and credential storage in the authentication module. Identify
the exact weaknesses.

**Invariant the fix must preserve:** the existing test
"POST /auth/login returns a token for valid credentials" — which logs in
with the seeded credentials `alice@example.com` / `alice-pass` — must
continue to pass after the fix. The Planner must ensure that any change to
the credential format remains compatible with the seeded data.
```

- [ ] **Step 5: Commit**

```bash
git add homework-4/context/bugs/
git commit -m "docs(homework-4): rewrite bug-context files as symptom-only"
```

---

## Task 6: Pipeline helper library (with unit tests)

**Files:**
- Create: `homework-4/scripts/pipeline-lib.js`
- Create: `homework-4/tests/pipeline-lib.test.js`

- [ ] **Step 1: Write the failing test (`homework-4/tests/pipeline-lib.test.js`)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseAgentFrontmatter,
  buildSystemPrompt,
  buildUserPrompt,
} from '../scripts/pipeline-lib.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

test('parseAgentFrontmatter extracts model from YAML frontmatter', () => {
  const text = '---\nmodel: claude-opus-4-7\nrole: Foo\n---\n\n# Foo body';
  const { meta, body } = parseAgentFrontmatter(text);
  assert.equal(meta.model, 'claude-opus-4-7');
  assert.equal(meta.role, 'Foo');
  assert.equal(body.trim(), '# Foo body');
});

test('parseAgentFrontmatter throws when frontmatter is missing', () => {
  assert.throws(() => parseAgentFrontmatter('no frontmatter here'),
    /Missing frontmatter/);
});

test('buildSystemPrompt concatenates agent body and skill bodies with separators', () => {
  const out = buildSystemPrompt('AGENT', ['SKILL_A', 'SKILL_B']);
  assert.match(out, /AGENT/);
  assert.match(out, /SKILL_A/);
  assert.match(out, /SKILL_B/);
  // Skills are clearly delimited from the agent body
  assert.ok(out.indexOf('AGENT') < out.indexOf('SKILL_A'));
  assert.ok(out.indexOf('SKILL_A') < out.indexOf('SKILL_B'));
  assert.match(out, /---/);
});

test('buildSystemPrompt returns just the agent body when no skills', () => {
  assert.equal(buildSystemPrompt('AGENT', []).trim(), 'AGENT');
});

test('buildUserPrompt mentions the bug id and the bug-context path', () => {
  const p = buildUserPrompt('BUG-1');
  assert.match(p, /BUG-1/);
  assert.match(p, /context\/bugs\/BUG-1\/bug-context\.md/);
});
```

- [ ] **Step 2: Run, verify it fails**

From `homework-4/`: `npm test`
Expected: FAIL — `Cannot find module '../scripts/pipeline-lib.js'`.

- [ ] **Step 3: Implement `homework-4/scripts/pipeline-lib.js`**

```js
import fs from 'node:fs';
import path from 'node:path';

export function parseAgentFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('Missing frontmatter');
  const meta = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^(\w+):\s*(.+)$/);
    if (mm) meta[mm[1]] = mm[2].trim();
  }
  return { meta, body: m[2] };
}

export function readAgentFile(agentPath) {
  const text = fs.readFileSync(agentPath, 'utf8');
  return parseAgentFrontmatter(text);
}

export function listBugs(bugRoot) {
  return fs.readdirSync(bugRoot)
    .filter((name) => {
      const p = path.join(bugRoot, name);
      return fs.statSync(p).isDirectory()
        && fs.existsSync(path.join(p, 'bug-context.md'));
    })
    .sort();
}

export function readSkill(skillsDir, name) {
  return fs.readFileSync(path.join(skillsDir, `${name}.md`), 'utf8');
}

export function buildSystemPrompt(agentBody, skillBodies) {
  const parts = [agentBody.trimEnd()];
  for (const s of skillBodies) {
    parts.push('---', s.trimEnd());
  }
  return parts.join('\n\n');
}

export function buildUserPrompt(bugId) {
  return [
    `You are part of the homework-4 pipeline. Current bug: ${bugId}.`,
    `Bug context: \`context/bugs/${bugId}/bug-context.md\`.`,
    `Operate strictly within your role and path restrictions described in your system prompt.`,
    `When done, write your single output file and exit cleanly.`,
  ].join(' ');
}
```

- [ ] **Step 4: Run, verify it passes**

From `homework-4/`: `npm test`
Expected: 5 new tests pass. Prior suite state unchanged (still 3 expected
reds from the app's seeded bugs).

- [ ] **Step 5: Commit**

```bash
git add homework-4/scripts/pipeline-lib.js homework-4/tests/pipeline-lib.test.js
git commit -m "feat(homework-4): add pipeline helpers with frontmatter parser"
```

---

## Task 7: Orchestrator entry point

**Files:**
- Create: `homework-4/scripts/run-pipeline.js`

This task is integration-level; it shells out to `claude` and `git`. The
helpers from Task 6 are imported. No unit test here — the smoke test in
Task 9 exercises it end-to-end.

- [ ] **Step 1: Create `homework-4/scripts/run-pipeline.js`**

```js
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  readAgentFile,
  listBugs,
  readSkill,
  buildSystemPrompt,
  buildUserPrompt,
} from './pipeline-lib.js';

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const HW = path.resolve(SCRIPTS, '..');
const REPO = path.resolve(HW, '..');
const AGENTS = path.join(HW, 'agents');
const SKILLS = path.join(HW, 'skills');
const BUGS = path.join(HW, 'context/bugs');
const RUNS = path.join(HW, 'context/runs');

const CHAIN = [
  { file: 'bug-researcher.agent.md',      name: 'bug-researcher',      skills: [] },
  { file: 'research-verifier.agent.md',   name: 'research-verifier',   skills: ['research-quality-measurement'] },
  { file: 'bug-planner.agent.md',         name: 'bug-planner',         skills: [] },
  { file: 'bug-fixer.agent.md',           name: 'bug-fixer',           skills: [] },
  { file: 'security-verifier.agent.md',   name: 'security-verifier',   skills: [] },
  { file: 'unit-test-generator.agent.md', name: 'unit-test-generator', skills: ['unit-tests-FIRST'] },
];

const ALLOWED_TOOLS = {
  'bug-researcher':      'Read,Glob,Grep,Write,Bash',
  'research-verifier':   'Read,Glob,Grep,Write',
  'bug-planner':         'Read,Glob,Grep,Write',
  'bug-fixer':           'Read,Glob,Grep,Write,Edit,Bash',
  'security-verifier':   'Read,Glob,Grep,Write,Bash',
  'unit-test-generator': 'Read,Glob,Grep,Write,Edit,Bash',
};

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function autoCommit(bugId) {
  const add = spawnSync('git', ['add', '-A', 'homework-4/'], {
    cwd: REPO, stdio: 'inherit',
  });
  if (add.status !== 0) return false;
  const msg = `fix(homework-4): apply pipeline-generated fix for ${bugId}\n\nPipeline artifacts: homework-4/context/bugs/${bugId}/`;
  const commit = spawnSync('git', ['commit', '-m', msg], {
    cwd: REPO, stdio: 'inherit',
  });
  return commit.status === 0;
}

function runFinalTests(runDir) {
  const r = spawnSync('npm', ['test'], { cwd: HW, encoding: 'utf8' });
  const out = `exit=${r.status}\n\n--- stdout ---\n${r.stdout || ''}\n--- stderr ---\n${r.stderr || ''}`;
  fs.writeFileSync(path.join(runDir, 'final-test-report.txt'), out);
  console.log(`Final npm test exit code: ${r.status}`);
  return r.status === 0;
}

function runAgent(step, bugId, bugRunDir) {
  const { meta, body } = readAgentFile(path.join(AGENTS, step.file));
  const skillBodies = step.skills.map((s) => readSkill(SKILLS, s));
  const systemPrompt = buildSystemPrompt(body, skillBodies);
  const userPrompt = buildUserPrompt(bugId);
  const logPath = path.join(bugRunDir, `${step.name}.log`);
  const logFd = fs.openSync(logPath, 'w');
  console.log(`[${bugId}] ${step.name} (${meta.model}) ...`);
  const r = spawnSync('claude', [
    '-p', userPrompt,
    '--model', meta.model,
    '--append-system-prompt', systemPrompt,
    '--allowedTools', ALLOWED_TOOLS[step.name],
  ], { cwd: HW, stdio: ['ignore', logFd, logFd] });
  fs.closeSync(logFd);
  if (r.status !== 0) {
    console.error(`[${bugId}] ${step.name} FAILED (exit ${r.status}). See ${logPath}`);
    return false;
  }
  return true;
}

function main() {
  const argv = process.argv.slice(2);
  const onlyBug = argv[0] || null;
  const available = listBugs(BUGS);
  const bugs = onlyBug ? [onlyBug] : available;
  if (!bugs.length) {
    console.error('No bugs found under context/bugs/.');
    process.exit(2);
  }
  if (onlyBug && !available.includes(onlyBug)) {
    console.error(`Unknown bug: ${onlyBug}. Available: ${available.join(', ')}`);
    process.exit(2);
  }

  const ts = timestamp();
  const runDir = path.join(RUNS, ts);
  fs.mkdirSync(runDir, { recursive: true });
  console.log(`Run directory: ${runDir}`);

  let anyFailed = false;
  for (const bugId of bugs) {
    const bugRunDir = path.join(runDir, bugId);
    fs.mkdirSync(bugRunDir, { recursive: true });
    let chainOk = true;
    for (const step of CHAIN) {
      if (!runAgent(step, bugId, bugRunDir)) {
        chainOk = false;
        anyFailed = true;
        break;
      }
    }
    if (chainOk) {
      const ok = autoCommit(bugId);
      if (!ok) {
        console.error(`[${bugId}] auto-commit failed; nothing committed.`);
        anyFailed = true;
      } else {
        console.log(`[${bugId}] ✓ committed.`);
      }
    } else {
      console.log(`[${bugId}] ✗ chain incomplete; skipping commit.`);
    }
  }

  const testsOk = runFinalTests(runDir);
  process.exit(anyFailed || !testsOk ? 1 : 0);
}

main();
```

- [ ] **Step 2: Manually verify the script's arg-parsing path**

Run from `homework-4/`:
```bash
node scripts/run-pipeline.js NONEXISTENT-BUG
```
Expected: exits with status 2 and prints `Unknown bug: NONEXISTENT-BUG. Available: BUG-1, BUG-2, SEC-1, SEC-2`. Does not call `claude` or write any logs.

If `claude` is not installed locally, this is the only verification possible without running a real pipeline pass. That is acceptable — actual claude-CLI invocation is verified by the manual smoke test (Task 9).

- [ ] **Step 3: Commit**

```bash
git add homework-4/scripts/run-pipeline.js
git commit -m "feat(homework-4): add pipeline orchestrator"
```

---

## Task 8: Wire `npm run pipeline`

**Files:**
- Modify: `homework-4/package.json`

- [ ] **Step 1: Add the `pipeline` script**

Open `homework-4/package.json` and add `"pipeline": "node scripts/run-pipeline.js"` to the `"scripts"` object. The updated `"scripts"` block:

```json
"scripts": {
  "start": "node src/server.js",
  "test": "node --test 'tests/**/*.test.js'",
  "pipeline": "node scripts/run-pipeline.js"
}
```

- [ ] **Step 2: Verify wiring**

From `homework-4/`:
```bash
npm run pipeline NONEXISTENT
```
Expected: exits non-zero with `Unknown bug: NONEXISTENT. Available: BUG-1, BUG-2, SEC-1, SEC-2`.

(`npm run pipeline -- BUG-1` is the form used when arg is a real bug; the
`--` separator lets npm pass the arg through. The error path doesn't need
`--`.)

- [ ] **Step 3: Commit**

```bash
git add homework-4/package.json
git commit -m "chore(homework-4): wire npm run pipeline"
```

---

## Task 9: Manual end-to-end smoke test (one bug)

**This task does not change code.** It costs LLM credits — a single bug run
is ~6 `claude -p` invocations. Run it once to confirm the orchestrator
works end-to-end before letting the full default pipeline run.

**Prerequisites:**
- `claude` CLI installed and logged in (`claude /login` or
  `ANTHROPIC_API_KEY`).
- Working tree clean (commit anything WIP first — the pipeline will create
  commits).

- [ ] **Step 1: Choose a bug to smoke-test**

Recommended: `BUG-2`. It's the simplest defect (single test, single
handler, smallest fix), so the pipeline finishes fastest and its result is
unambiguous.

- [ ] **Step 2: Run the pipeline for BUG-2**

From `homework-4/`:
```bash
npm run pipeline -- BUG-2
```

Expected:
- Console prints "Run directory: …/context/runs/<ISO>/" and then a per-step
  line per agent: `[BUG-2] bug-researcher (claude-sonnet-4-6) ...` etc.
- Six `.log` files appear under
  `homework-4/context/runs/<ISO>/BUG-2/<agent>.log`.
- These artifacts appear under `homework-4/context/bugs/BUG-2/`:
  `research/codebase-research.md`, `research/verified-research.md`,
  `implementation-plan.md`, `fix-summary.md`, `security-report.md`,
  `test-report.md`.
- `src/routes/auth.js` is modified (the login handler).
- A new commit `fix(homework-4): apply pipeline-generated fix for BUG-2`
  exists at HEAD.
- `npm test` shows the BUG-2 expected-red test is now green.

- [ ] **Step 3: If anything fails**

Inspect the `.log` file for the failing agent. Common issues:

- `claude: command not found` — the CLI isn't installed/in PATH.
- Exit 1 from `claude -p` early — check authentication.
- Fixer succeeds but tests don't go green — the Planner produced a loose
  plan and Haiku didn't follow it exactly; upgrade Bug Fixer's model to
  `claude-sonnet-4-6` in `agents/bug-fixer.agent.md` and re-run.
- Test Generator writes tests that violate FIRST — tighten
  `skills/unit-tests-FIRST.md` with another worked example and re-run.

There is no Step 4. This task is the validation step; if it passes, the
plan is complete.
