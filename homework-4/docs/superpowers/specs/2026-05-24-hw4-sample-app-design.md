# Homework 4 — Sample Application Design

**Date:** 2026-05-24
**Scope:** Task 5 only — the small Express "Users & Auth" API that the 4-agent
pipeline operates on. The pipeline orchestration (single-command runner, the four
`*.agent.md` agents, and their skills) is a **separate, follow-up design** and is
intentionally out of scope here.

## Purpose

Provide a small, self-contained REST API with deliberately seeded defects so the
homework-4 pipeline (Bug Researcher → Research Verifier → Bug Planner → Bug Fixer
→ Security Verifier → Unit Test Generator) has concrete, real targets to find,
fix, security-review, and test. The same app must demonstrate a clear
**before** (defects present) and **after** (defects fixed, tests green) state.

## Stack

- **Language/runtime:** plain JavaScript on Node (no TypeScript build step).
- **Runtime dependencies (2):** `express`, `better-sqlite3`.
- **Test dependencies:** built-in `node:test` runner + `supertest` for HTTP.
- **Tokens/hashing:** Node built-in `crypto` (HMAC token, password hashing) — no
  extra dependency such as `jsonwebtoken` or `bcrypt`.

Rationale: keeps dependencies minimal (a TASKS.md requirement) while a real
SQLite database makes the seeded SQL-injection a textbook, scannable vulnerability
rather than a contrived `eval` simulation.

## Architecture

```
src/
├── app.js          # builds & exports the express app (no listen) — used by tests
├── server.js       # entry point: app.listen (npm start)
├── db.js           # better-sqlite3 init + schema + seed data
├── auth.js         # token + password helpers (crypto)
├── routes/
│   ├── auth.js     # /auth/register, /auth/login
│   └── users.js    # /users/:id, /users/search, /users
tests/
├── auth.test.js
└── users.test.js
```

- `app.js` exports the configured Express app without calling `listen`, so
  `supertest` can drive it in-process. `server.js` is the only place that binds a
  port.
- `db.js` creates the schema and seeds a few users on startup. For tests it
  supports an in-memory SQLite database so each test run is isolated.
- Each unit has one clear purpose and a small surface: routes depend on `db.js`
  and `auth.js`; nothing depends on `server.js`.

## Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/auth/register` | `{email, password, name}` → create user | no |
| POST | `/auth/login` | `{email, password}` → `{token}` | no |
| GET | `/users/:id` | fetch a user profile | token |
| GET | `/users/search?q=` | search users by name/email | token |
| GET | `/users?limit=&offset=` | paginated user list | token |

## Seeded defects (before-state)

Each defect is documented in `context/bugs/XXX/bug-context.md` for the pipeline.

### Logical bugs (≥2)

- **BUG-1 — pagination:** `GET /users` mishandles `limit`/`offset` (default `limit`
  not applied when the param is missing, and an off-by-one in `offset`), so the
  endpoint returns the wrong window of rows.
- **BUG-2 — login email case-sensitivity:** registration stores the email
  verbatim and login compares it exactly, so a user registered as `User@x.com`
  cannot log in with `user@x.com`. Expected behaviour: email match is
  case-insensitive.

### Security issues (≥1; two seeded for material)

- **SEC-1 — SQL injection:** `GET /users/search` builds its SQL by concatenating
  the raw `q` value into the query string, allowing injection.
- **SEC-2 — hardcoded secret + plaintext passwords:** the HMAC token secret is a
  hardcoded literal in source, and passwords are stored/compared in plaintext
  (no hashing).

### Intended fixes (after-state, applied by the pipeline)

- BUG-1 → correct limit default and offset math.
- BUG-2 → normalize email to lower-case on register and on login lookup.
- SEC-1 → parameterized query (prepared statement bind parameters).
- SEC-2 → read the secret from an environment variable; hash passwords with
  `crypto.scrypt`/`pbkdf2` and compare with a constant-time check.

## Testing

- `npm test` runs the `node:test` suite via `supertest` against an in-memory DB.
- Before the pipeline: tests assert intended behaviour and therefore **fail** on
  the seeded logical bugs (red), documenting the defect.
- After the pipeline: the same tests pass (green); the Unit Test Generator adds
  further tests for the changed code following the FIRST principles.

## Run commands

- `npm start` — start the API on a local port (`server.js`).
- `npm test` — run the test suite.

## Out of scope (next design)

- The single-command pipeline runner and orchestration mechanism.
- The four `*.agent.md` agent definitions and per-agent model selection.
- The `research-quality-measurement` and `unit-tests-FIRST` skills.
