# Agents Guide — MFI Loan Decision & Disbursement

This document configures any AI coding agent that implements the work specified in `specification.md`. It defines tech assumptions, domain rules, code style, verification expectations, and how the agent must treat edge cases.

The agent MUST read `specification.md` before any task and treat it as the source of truth. This file is the *behavioural* layer that sits on top of the spec.

---

## 1. Stack assumptions

The agent should assume, unless the task says otherwise:

- **Language:** TypeScript on Node.js (current LTS). `strict` mode on; no implicit `any`.
- **Framework:** NestJS for HTTP (modules, providers, dependency injection); `class-validator` / `class-transformer` for request validation.
- **Persistence:** MySQL 8.x / MariaDB via Prisma ORM; schema and migrations managed by Prisma Migrate.
- **Async:** Node's native non-blocking I/O; all I/O is `async`/`await`. No synchronous DB or HTTP calls in request handlers.
- **HTTP clients:** native `fetch` (undici) with an explicit per-call timeout, wrapped in an `opossum` circuit breaker per external dependency (bureau, fraud, PSP, SMS).
- **Money:** integer minor units (`kopiyky`, stored as `BigInt`) for storage; `decimal.js` for arithmetic. Never the JS `number`/float in money paths.
- **Time:** UTC everywhere; ISO-8601 strings at boundaries. Never rely on the server's local timezone.
- **Config:** `@nestjs/config` with a schema-validated (Zod) settings object; secrets from the environment, never from files in the repo.
- **Testing:** `vitest` as the runner; `fast-check` for property tests; `testcontainers` (Node) for integration tests against a real MySQL; `schemathesis` (language-agnostic, run against the live app) for contract fuzzing of the OpenAPI surface.
- **OpenAPI:** OpenAPI 3.1 is the source of truth (`specs/loan-decision-api.yaml`). The NestJS-generated OpenAPI is checked against it in CI and the build fails on drift.

The agent must not silently substitute different libraries. If a task seems to require a new library, the agent surfaces this as a question, with rationale.

---

## 2. Domain rules the agent must not violate

These are hard rules. Any code suggestion that breaks one of these is wrong, even if it compiles and passes tests.

### 2.1 Money

- Money is `decimal.js` (arithmetic/display) and `BigInt` minor units (storage). No JS `number`/float anywhere in money paths.
- Every monetary value carries an explicit currency code (ISO 4217, e.g. `"UAH"`).
- Rounding uses banker's rounding (`decimal.js` `ROUND_HALF_EVEN`) unless the regulator's formula specifies otherwise (effective rate calc — follow the formula exactly).

### 2.2 PII

- The agent must never write code that logs:
  - PAN, CVV, card expiry
  - OTP code (any form, including hashed at log site)
  - Passport number, RNOKPP, full name, date of birth
- Stable internal IDs (`application_id`, `loan_id`, `decision_seq`) are safe to log.
- Linter rule: any new field added to a logger call goes through an `is_logsafe` audit.

### 2.3 Idempotency

- Every write endpoint requires an `Idempotency-Key` header.
- Idempotency is enforced **server-side**, not by client behaviour.
- External calls to PSP, SMS provider, bureau, fraud service all carry deterministic idempotency keys derived from `application_id + step + attempt_seq`. The agent must not invent timestamp-based keys.

### 2.4 State transitions

- `Loan` state transitions follow the state machine in `specification.md` §7.3.
- Transitions are implemented as **pure functions** returning either the next state or a typed transition error. There is no `loan.state = "..."` mutation in business code.
- Illegal transitions are unrepresentable at the type level (discriminated unions on a literal `status` field, not a bare `string`).

### 2.5 Decision disclosure

- Two distinct fields exist throughout the codebase:
  - `reason_category`: borrower-safe, ~5 enum values.
  - `reason_codes_detail`: internal-only, fine-grained.
- Any new DTO that includes `reason_codes_detail` and is reachable by a borrower-facing endpoint is a defect. The agent must add a unit test asserting redaction whenever it introduces a new response model.

### 2.6 Audit log

- Every state-changing operation emits an `AuditEvent`. There is no exception, including admin overrides and reconciliation jobs.
- Audit writes are part of the same transaction as the state change. If the audit write would fail, the state change must not be committed.

### 2.7 Policy versioning

- The decision uses the **policy version active at application submission**, not the current policy at decision time.
- Already-signed offers reference the exact policy version id. The agent must not "refresh" the policy for an already-issued offer.

### 2.8 Regulatory disclosures

- Every offer artifact contains every NBU-mandated field listed in `specification.md` §5.1. The renderer is pure and snapshot-tested. Removing a field is a defect, even if a test passes by other means.

---

## 3. Code style

- **Naming:** `camelCase` for variables and functions, `PascalCase` for types and classes, `UPPER_SNAKE_CASE` for constants; no Hungarian notation.
- **Functions:** small, single-purpose. A function over 40 lines or with > 3 levels of nesting is a refactoring signal, not a goal.
- **Public APIs:** every exported function has explicit parameter and return types and a short TSDoc comment stating what it does and what it returns. No "obvious" comments ("returns the user"); explain non-obvious invariants or constraints.
- **Errors:** typed error classes, not strings. Each external integration has its own error-class family.
- **Comments:** only for non-obvious *why*. Never explain *what* the code does — the code does that.
- **Tests:** one logical assertion per test where feasible; descriptive names; `Given / When / Then` structure in test bodies for non-trivial flows.

---

## 4. Verification & testing expectations

The agent treats the spec's verification matrix (§8) as binding. Specifically:

- Every Low-Level Task ends with mechanical Definitions of Done. The agent's PR must demonstrate each DoD passes (CI link or test name).
- The agent does not mark a task complete on "looks right". It runs the tests and quotes the output.
- Contract tests run against the OpenAPI spec, not against the implementation. If a test fails because the implementation does not match the spec, the **implementation** changes — not the spec — unless the task is a spec change.
- Property-based tests are required for: state machine, money arithmetic, idempotency, retry sequences.
- Chaos tests are required for every external integration. The pattern is: kill the dependency for N seconds, assert the system either degrades gracefully (per the spec) or fails closed.

---

## 5. How the agent must treat edge cases

The edge cases enumerated in `specification.md` §7 are **first-class requirements**, not afterthoughts. The agent must:

1. Before writing code for a task, list the edge cases from §7 that touch the task and outline how each is handled.
2. Write a test for each before writing implementation code. Test names match the spec ID (e.g. `test_T_1_bureau_timeout_yields_technical_decline`).
3. When implementing, prefer the path that fails closed (no loan disbursed under uncertainty) over the path that creates inconsistent state.

If the agent encounters a situation the spec does not cover, it does not invent behaviour. It surfaces the gap with:
- a concrete proposed default (with rationale),
- the cost of getting it wrong,
- a suggested spec amendment.

---

## 6. Security defaults

- All external calls go over TLS. Plain HTTP is rejected at startup unless `ENV=local-dev`.
- Service-to-service authentication uses short-lived, narrowly-scoped JWTs; never long-lived shared secrets in code.
- Webhook handlers validate provider signatures before reading any payload field.
- Rate limits at the API gateway. Application-level rate limits for OTP send and resend (per spec §6).
- No raw SQL string interpolation. Use the Prisma client; if raw SQL is unavoidable, use parameterised `$queryRaw` tagged templates, never `$queryRawUnsafe` with interpolated input.
- Dependency vulnerabilities are blocking; the CI gate fails on a known critical CVE.

---

## 7. Performance defaults

- Every request handler has a timeout. No infinite waits on external calls.
- Backpressure: if the scoring queue depth exceeds the configured threshold, new applications receive `technical_decline` with reason `service_overloaded` rather than being silently delayed. (Better to fail fast than to keep a borrower waiting on a loader for minutes.)
- Database queries that touch >1000 rows are paginated. No "load all then filter" patterns.
- Background jobs (reconciliation, integrity check) run on dedicated workers, never in the request thread.

---

## 8. Documentation expectations

- Every public API endpoint has an entry in the OpenAPI spec with at least one example.
- Every new error code is added to the enumerated error-code documentation in the same PR.
- The README is updated when:
  - A new external dependency is added.
  - The dev setup steps change.
  - A new role gains access to a new endpoint.

The agent is not asked to write extensive prose docs. Code, tests, and the OpenAPI spec are the primary documentation.

---

## 9. When in doubt

Order of authority, highest to lowest:

1. NBU regulation (if cited in `specification.md` §5.1).
2. `specification.md`.
3. This `agents.md`.
4. Established codebase patterns.
5. The agent's general best-practice instincts.

If the agent perceives a conflict between (1) and (2)–(5), it stops and asks the human reviewer. It does not silently follow the regulator and break the spec, and it does not silently follow the spec and break the regulator.
