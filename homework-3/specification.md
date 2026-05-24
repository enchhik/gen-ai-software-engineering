# MFI Loan Decision & Disbursement Service — Specification

> Ingest the information from this file, implement the Low-Level Tasks, and generate the code that will satisfy the High and Mid-Level Objectives.
>
> **Domain:** Ukrainian microfinance organisation (МФО). **Slice:** the vertical from a submitted loan application to either a rejection or money on the borrower's card.
> **Out of scope for this slice:** application form & onboarding (steps before submission), active-loan servicing, repayment, collections, restructuring.

---

## 1. High-Level Objective

Decide, in seconds, whether a Ukrainian retail borrower is eligible for a short-term consumer microloan, present a regulator-compliant offer, capture an electronic signature, and disburse funds to the borrower's payment card — with full auditability, anti-fraud controls, and explicit handling of partial-failure states.

**Scope boundary (one sentence):** This specification covers the transition `application.submitted → loan.disbursed | loan.rejected | loan.manual_review`; it does not cover form-based onboarding before submission, nor anything that happens after the borrower has received money.

---

## 2. Mid-Level Objectives

Each objective is **observable** — there is a state in the world that changes when it succeeds.

1. **MO-1 — Multi-source scoring.** The system collects identity, external credit-bureau, internal history, and fraud signals for a submitted application and produces a single decision artifact (`approved` / `counter_offer` / `manual_review` / `soft_decline` / `hard_decline` / `technical_decline`) within the configured latency budget.
2. **MO-2 — Regulator-compliant offer.** When a decision is `approved` or `counter_offer`, the system renders a contract offer containing all NBU-mandated disclosures (effective annual rate, preliminary information form, total amount payable, schedule, penalty terms, 14-day withdrawal right) and persists it as an immutable artifact.
3. **MO-3 — Electronic signature via SMS OTP.** The borrower signs the offer using a one-time code sent to the phone number captured during application; the signed offer becomes a binding contract artifact with a verifiable signature event in the audit log.
4. **MO-4 — Idempotent card disbursement.** The system transfers the loan principal to the borrower's verified card via a card-payout PSP, retries safely on transient failures, and only marks the loan as `disbursed` after a confirmed payout — never on signature alone.
5. **MO-5 — Explainability with controlled disclosure.** The system records the full set of reason codes that drove each decision and exposes them by role: full detail to compliance and audit, redacted general categories to the borrower and customer service.
6. **MO-6 — Full audit trail.** Every state transition, scoring input, decision, OTP event, payout attempt, and policy override is persisted immutably for at least the AML statutory minimum (5 years per Law of Ukraine 361-IX); the system targets 7 years as an internal policy buffer for audit and dispute handling.
7. **MO-7 — Bounded blast radius for external failures.** If the credit bureau, fraud service, SMS provider, or PSP is unavailable, the system degrades gracefully into a `technical_decline` or `manual_review` state — never an inconsistent loan.

---

## 3. Stakeholders

| Role | Type | Read | Write | Notes |
|---|---|---|---|---|
| **Borrower** | End-user | Own application, status, offer, decision (general category only) | Submit application, sign offer, retry OTP | Sees a general category — never raw reason codes |
| **Scoring officer** | Internal ops | Borderline / `manual_review` cases with full reason codes | Approve / override / decline `manual_review` cases | Has SLA of 1 business day |
| **Anti-fraud officer** | Internal ops | Fraud signals, device/IP graph, multi-account links | Flag, block, escalate, override fraud decision | Read across borrowers, not just one application |
| **Treasury / financial control** | Internal ops | Payout transactions, PSP reconciliation, daily settlement | Trigger manual payout retry, mark payout as resolved | Reconciles with PSP daily |
| **Compliance / AML** | Compliance | All decisions, sanctions hits, offer artifacts, retention logs | File regulatory reports, freeze accounts | Has access to full reason codes |
| **Customer service** | Internal ops | Application status, OTP/payout problems, general decline category | Resend OTP, trigger PSP retry, escalate | **Cannot** see raw scoring reason codes |
| **Auditor** | Compliance | **Read-only** across decisions, logs, contracts, OTP events, payouts | Nothing | Internal and external auditors |
| **Risk / product manager** | Configuration | Decision policy, cut-offs, counter-offer rules, NBU caps | Update policy (with effective-from date, never retroactive) | Changes do not affect already-signed offers |
| **NBU (regulator)** | External | Not a direct system user | Receives generated reports on a schedule | Channel: regulatory reporting export |
| **Integration developer** | Internal tech | Integration logs, technical status, sandbox environment | Sandbox writes only | **No** business-data access |
| **Security / admin** | Internal tech | All access logs, security events | Manage roles, access, incident response | Cannot view PII without break-glass + audit |

---

## 4. Context — Borrower Lifecycle Overview

This specification implements **steps 5–7** of the full borrower journey. The other steps are listed for context only.

```
1.  Borrower lands on site, uses calculator                  (out of scope — onboarding)
2.  Registration / login                                     (out of scope — onboarding)
3.  Application form completed                               (out of scope — onboarding)
4.  Card verification (1 UAH test charge)                    (out of scope — onboarding)
─── application.submitted ────────────────────────────────────────────────────
5.  Scoring & decision                                       ◀── in scope
6.  Offer presentation & SMS e-signature                     ◀── in scope
7.  Card payout                                              ◀── in scope
─── loan.disbursed | loan.rejected | loan.manual_review ─────────────────────
8.  Active-loan servicing (balance, accruals)                (out of scope — servicing)
9.  Repayment                                                (out of scope — servicing)
10. Closure / extension / restructuring                      (out of scope — servicing)
11. Collections / default                                    (out of scope — servicing)
```

### Beginning context (state at slice entry)

- A persisted `Application` record with: borrower personal data, RNOKPP (Ukrainian tax ID), passport reference, phone, card token (verified via 1 UAH test charge), requested amount, requested term, IP, device fingerprint, application timestamp.
- A registered borrower account with credentials.
- Verified card token (PCI-compliant: no PAN stored, only the PSP token).
- Existing services available (out of scope to build, but assumed):
  - Credit Bureau adapter (НБУ-licensed bureau, e.g. UBKI / IBCH)
  - Fraud / device-intelligence service
  - SMS provider for OTP
  - Card-payout PSP (Visa Direct / Mastercard Send)
  - Sanctions / PEP screening service
  - Identity verification service (liveness / document)

### Ending context (state at slice exit)

Exactly one of:

- **Disbursed:** `Loan` record with state `disbursed`, signed `Contract` artifact, `PayoutTransaction` with confirmed PSP receipt, full audit trail; clock for interest accrual starts at the payout-confirmed timestamp.
- **Rejected:** `Application` with terminal state `rejected_soft` or `rejected_hard` or `rejected_technical`, decision artifact with reason codes, no contract, no payout.
- **Manual review pending:** `Application` with state `manual_review`, queued for a scoring or anti-fraud officer with an SLA timer running.

---

## 5. Non-Functional Requirements & Policy

### 5.1 Regulatory (NBU)

| Requirement | Rule | Source / rationale |
|---|---|---|
| **Max daily interest rate** | ≤ 1.0% per calendar day | Law on Consumer Lending, art. 8 § 5; enforced by NBU (see Appendix B, [1]) |
| **APR disclosure** | Effective annual rate must be calculated and shown on the offer screen | Law on Consumer Lending; NBU "Know your rights" guidance (Appendix B, [2]) |
| **Preliminary information form** | Standardised disclosure must be presented before signing | NBU consumer-protection rules (Appendix B, [2]) |
| **14-day withdrawal right** | Borrower may unilaterally cancel within 14 calendar days of signing; returns principal + interest for actual days used | Law on Consumer Lending; NBU guidance (Appendix B, [2]) |
| **AML retention** | Statutory minimum: **5 years** for identification and transaction records per Law of Ukraine 361-IX on AML. Internal policy adopted by this spec: **7 years** as a buffer for audit, regulator inspection, and civil-claim windows. | Law 361-IX; internal policy buffer |
| **Sanctions screening** | Borrower must be checked against UA / OFAC / EU / UN sanctions lists at the decision step | NBU AML / FATF |
| **Policy effective-from** | Policy changes apply only to applications submitted **after** the effective-from timestamp; offers already signed are immutable | Civil Code / regulator stability |

### 5.2 Security

- **PCI scope minimisation:** the system never stores PAN, CVV, or expiry. Only PSP-issued card tokens.
- **PII at rest:** encrypted with a managed KMS key; passport scans and selfies are stored in object storage with per-object encryption and short-lived signed URLs.
- **PII in logs:** PAN, CVV, OTP code, passport number, RNOKPP are **forbidden** in application logs; only stable internal IDs are logged. Reason codes are logged as enum values, never as free-form strings.
- **OTP secrecy:** OTP is single-use, never logged, never returned in API responses, transmitted only via the SMS provider.
- **Authentication:** internal users use SSO with MFA; service-to-service uses short-lived, narrowly-scoped JWTs.
- **Authorisation:** role-based, enforced at the API gateway and re-checked in service code (deny-by-default). The "general category vs. full reason codes" split is enforced server-side; the client cannot escalate.
- **Audit log integrity:** append-only, hash-chained, with at least one out-of-band replica per business day.

### 5.3 Reliability

- The slice must not produce an inconsistent loan under partial failure. Specifically:
  - A signed offer with a failed payout must leave the `Loan` in state `disbursement_failed`, not `disbursed`.
  - A successful payout with a missing PSP webhook must reconcile to `disbursed` within the daily reconciliation window.
  - A duplicate signature attempt (e.g. the borrower pressed twice) must not produce two loans.
- All cross-service writes are idempotent, keyed by `application_id` + `attempt_seq`.
- All external calls have a circuit breaker; when open, the application moves to `technical_decline` or `manual_review` (not error to the user).

### 5.4 Privacy

- A borrower may request export or deletion of personal data; deletion does not remove records required for AML retention (statutory ≥ 5 years; internal target 7 years per §5.1), but they are pseudonymised and access-restricted.
- Marketing consents are stored separately and never required for the credit decision itself.

---

## 6. Performance Targets

These are **assumed targets** appropriate to Ukrainian retail microfinance UX (fast, mobile-first, expectation of "money in a few minutes").

| Metric | Target | Rationale |
|---|---|---|
| `POST /applications/{id}/decide` p95 latency | ≤ 30 s | Borrower waits on a loading screen; longer feels broken |
| `POST /applications/{id}/decide` p99 latency | ≤ 60 s | Tail dominated by bureau timeouts; longer → `technical_decline` |
| Manual-review queue resolution | ≤ 1 business day p95 | Industry-standard SLA, satisfies borrower expectation |
| Offer TTL (time-to-sign) | 30 minutes default; configurable 15–60 min | Risk signals can change; do not let an offer survive a session change |
| OTP TTL | 5 minutes | Long enough for SMS delays, short enough to bound brute force |
| OTP attempts per offer | 3 | Three-strikes; further attempts require new OTP |
| Resend OTP cooldown | 60 s | Anti-flooding |
| Payout request p95 | ≤ 60 s (PSP-bound) | Card payout APIs typically respond in seconds |
| Payout retry policy | 3 attempts, exponential backoff (5s, 30s, 5min) | Standard PSP recommendation |
| Reconciliation window for missing webhook | ≤ 24h, alert at 4h | One full business day with mid-day escalation |
| Throughput (steady) | 1,000–10,000 applications / day per MFI | Ukrainian market reporting indicates >700k microcredits/month, ≈24k/day across all MFIs (Appendix B, [3]); a single mid-sized MFI sits in the 1k–10k range |
| Throughput (peak) | 3× steady, sustained for up to 2 hours | Payday spikes; size capacity accordingly |
| Audit log write availability | 99.99% (4-nines) | A lost audit event is a compliance incident |
| Decision API availability | 99.9% | Standard for financial customer-facing API |

---

## 7. Edge Cases & Failure Modes

These are first-class requirements. Each row states the trigger and the **expected behaviour** including the user-visible outcome and the compliance/audit implication.

### 7.1 Fraud & abuse

| # | Trigger | Expected behaviour |
|---|---|---|
| F-1 | Documents that belong to a different person (mismatch with liveness selfie) | `hard_decline`; reason `identity_mismatch`; flagged for AML review; borrower sees generic decline; device & phone added to internal block list |
| F-2 | Card not owned by borrower (cardholder name mismatch from PSP verification) | `hard_decline`; reason `card_ownership_failed`; borrower sees "card verification failed" |
| F-3 | Multi-account from same device / IP within 24 hours | `manual_review`; anti-fraud officer reviews account graph |
| F-4 | Same person re-applies with a different phone within 24 hours of a decline | Linked via passport / RNOKPP; treated as a single applicant; new application receives the prior decline outcome unless 30+ days have passed |
| F-5 | Account takeover signal (login from new device + immediate loan application) | Step-up: require selfie + liveness before scoring; if skipped, `manual_review` |

### 7.2 Technical failures

| # | Trigger | Expected behaviour |
|---|---|---|
| T-1 | Credit bureau timeout (> configured budget) | `technical_decline` if no other strong negative signals; or `manual_review` if borderline by other signals |
| T-2 | PSP / payout provider timeout | Payout retry policy (5s / 30s / 5min); after retries exhausted → `disbursement_failed`; treasury notified |
| T-3 | SMS provider down | OTP cannot be sent; offer issuance blocked; borrower sees "try again in a few minutes"; system retries OTP send only on user-initiated resend |
| T-4 | OTP not delivered (delivery report negative) | Offer fall-back to alternate channel only if alternate phone exists in record; otherwise borrower retries; never voice-of-OTP automatically |
| T-5 | Liveness / document service down | Step-up checks unavailable → either skip if risk signals are clean OR `manual_review` if step-up was requested |
| T-6 | Duplicate webhook from PSP | Webhook is idempotent on PSP `transaction_id`; second delivery is acknowledged, has no side effect |
| T-7 | Webhook references unknown `transaction_id` | Logged, alerted; no state change; reconciliation job will pick up actual state from PSP API |

### 7.3 Inconsistent states (critical — explicit state machine)

The `Loan` record must support these states with strict transitions:

```
            ┌─────────────────────────────────────┐
            ▼                                     │
  offer_issued ──signed──► signed_not_disbursed ──┴─►disbursement_pending
                                                          │
                                  ┌───────────────────────┤
                                  ▼                       ▼
                              disbursed           disbursement_failed
                                  ▲                       │
                                  └── reconciled ─────────┘
                                                  (from disbursed_webhook_missing)
```

| # | Trigger | Expected behaviour |
|---|---|---|
| S-1 | Borrower clicks "Sign" twice (network retry) | Idempotency key on signature endpoint; second call returns the first response; no duplicate loan |
| S-2 | PSP payout succeeded but webhook lost | Reconciliation job queries PSP daily; on confirmation moves state to `disbursed`; if not confirmed within 24h → ops alert |
| S-3 | PSP payout failed but transient | Retry policy; after exhaust → `disbursement_failed`; borrower notified; the signed contract is **rescinded** (offer marked `cancelled_due_to_payout_failure`); audit log records the cancellation |
| S-4 | Concurrent applications by same borrower | Borrower has at most one application in any non-terminal state at a time; second submission is rejected with `another_application_in_flight` |
| S-5 | Borrower edits application data while scoring is running | Edit is rejected during `scoring_in_progress`; if scoring already finished, edit invalidates the result and triggers a re-score |

### 7.4 Legal / regulatory

| # | Trigger | Expected behaviour |
|---|---|---|
| L-1 | Borrower exercises 14-day withdrawal right | Triggers a `withdrawal` workflow (out of slice in detail, but slice persists the right and exposes a hook); offer remains in audit |
| L-2 | Sanctions or PEP hit detected **after** disbursement | Triggered by re-screening job; loan flagged `compliance_hold`; compliance officer notified; loan continues to accrue but operations are gated by compliance |
| L-3 | NBU rate or policy change mid-day | New policy applies only to applications submitted after `effective_from`; previously signed offers are honoured at the old rate; the system stores the rate that was in force at offer issuance, not "current" |
| L-4 | Effective annual rate calculation rounding dispute | The system stores both the borrower-facing rounded figure and the exact internal calculation; on dispute, the exact figure is authoritative |

### 7.5 Borrower special cases

| # | Trigger | Expected behaviour |
|---|---|---|
| B-1 | Borrower dies between submission and disbursement (notified by relative / state register) | Application moves to `terminated_irrevocably`; no payout; reason `applicant_deceased` |
| B-2 | Borrower starts personal bankruptcy proceedings | Hard block; `hard_decline`; reason `insolvency_proceedings`; flagged for compliance |
| B-3 | Borrower changes passport / phone / card mid-flow | Treated as a material change → invalidate scoring, require re-verification, possibly new application |
| B-4 | Borrower's card token expires mid-flow | Payout step requires a re-validated card; offer is extended once with a fresh card-verification step |

### 7.6 Concurrency

| # | Trigger | Expected behaviour |
|---|---|---|
| C-1 | Two scoring jobs for same application start | Single-flight lock by `application_id`; second job aborts with no side effect |
| C-2 | Borrower hits "Resend OTP" rapidly | Cooldown of 60s; further requests in the cooldown return 429 with `retry_after` |
| C-3 | Stale scoring result (e.g. from a retried job) writes after the canonical job | Decision record is keyed by `application_id` + monotonic `decision_seq`; only the highest seq is considered current |

---

## 8. Verification

How we know each Mid-Level Objective is met.

### 8.1 Verification matrix

| Objective | Verification approach |
|---|---|
| **MO-1 — Scoring** | Contract tests against the Decision API schema; fixture-based scoring tests for each outcome category (golden inputs → expected category, never asserting exact reason codes — those are policy); latency assertion at p95 from a synthetic load harness |
| **MO-2 — Offer compliance** | Schema validation that every issued offer contains all required NBU disclosure fields; checksum across the rendered text vs. the persisted artifact (offer cannot drift) |
| **MO-3 — E-signature** | Event-store test: a successful signature produces exactly one `OfferSigned` event with verifiable HMAC; replay test: replaying a signature event does not produce a second contract |
| **MO-4 — Disbursement idempotency** | Property-based test: any sequence of retries of a single payout produces at most one successful transaction on the PSP side, asserted via PSP sandbox; integration test for the lost-webhook reconciliation path |
| **MO-5 — Controlled disclosure** | Role-based test matrix: for each role × decision-detail field, assert allowed/denied; static analysis lint rule that prevents `reason_codes_detail` from being serialised in any DTO returned to a borrower-facing endpoint |
| **MO-6 — Audit trail** | Audit-log replay reconstructs the state of any application from events alone; daily integrity-check job validates the hash chain; retention check ensures no record older than 7y is purged prematurely |
| **MO-7 — Bounded blast radius** | Chaos test: kill each external dependency one at a time; assert no application reaches `disbursed` with missing prerequisites; assert circuit breakers open within 30s of sustained failure |

### 8.2 Acceptance criteria style

Each Low-Level Task ends with **Definition of Done** bullets. These are not aspirational; they must be mechanically checkable by a reviewer or an AI agent. Examples:

- *"Given an application that the bureau adapter times out for, when scoring runs with no other strong negative signals, then the persisted decision MUST be `technical_decline` and the reason code MUST be `bureau_timeout`."*
- *"Given a signed offer for which the PSP returns a non-retryable failure, when the payout step completes, then the loan state MUST be `disbursement_failed` and an event of type `OfferCancelledDueToPayoutFailure` MUST exist with the same `application_id`."*

### 8.3 Compliance review checkpoints

Beyond automated tests, the spec requires three human checkpoints before each release:

1. **Compliance review** of the rendered offer artifact against the current NBU template.
2. **Anti-fraud review** of the active scoring policy and any new reason codes.
3. **Auditor sign-off** of the audit-log schema if the schema changes.

---

## 9. Low-Level Tasks

Each task ties back to one or more Mid-Level Objectives. Tasks are listed in approximate implementation order; dependencies are noted explicitly.

### Task 1 — Decision API contract (OpenAPI 3.1)

> Serves: MO-1, MO-2, MO-5.

**Prompt to AI:**
> Create `specs/loan-decision-api.yaml` as a complete OpenAPI 3.1 specification for the Decision & Disbursement service. Cover endpoints for application submission ingest, decision retrieval, offer retrieval, signature, and payout status. Define request/response schemas with strict validation. Define error envelopes with stable error codes. Include role-based response variants for fields containing reason codes.

**File:** `specs/loan-decision-api.yaml`
**Details:**
- Endpoints: `POST /applications/{id}/decide`, `GET /applications/{id}/decision`, `GET /applications/{id}/offer`, `POST /applications/{id}/sign`, `POST /applications/{id}/resend-otp`, `GET /loans/{id}/payout-status`, `POST /webhooks/psp` (internal-only), `GET /admin/applications/{id}` (officer-facing).
- Error codes are an enumerated, documented list — no free-form strings.
- `reason_codes` field exists in two flavours: `reason_category` (borrower-visible enum of ~5 values) and `reason_codes_detail` (officer-visible array of fine-grained enums).
- All write endpoints accept and require an `Idempotency-Key` header.

**Definition of Done:**
- Spec passes `redocly lint` with zero warnings.
- Schemathesis can generate cases for every operation.
- A documented example exists for every 2xx and 4xx response.

---

### Task 2 — Domain model & state machine

> Serves: MO-1, MO-4, MO-6, MO-7.

**Prompt to AI:**
> Create domain types for `Application`, `Decision`, `Offer`, `Contract`, `Loan`, `PayoutTransaction`, and `AuditEvent`. Encode the state machine for `Loan` with the transitions described in §7.3. Make illegal transitions impossible to express (state-as-type, not state-as-string).

**File:** `src/domain/loan-state.ts` (and adjacent type files)
**Details:**
- `Loan` is a discriminated union over states; transitions are pure functions returning the next state or a typed error.
- All money fields use a `decimal.js` value, never the JS `number`/float. Amounts are stored as integer minor units (`kopiyky`, `BigInt`) plus currency code.
- All timestamps are stored in UTC (ISO-8601 at API boundaries); offer- and signature-related timestamps additionally carry the policy version id active at that moment.

**Definition of Done:**
- Property-based tests demonstrate that no sequence of valid transitions can land in an undefined state.
- Linter rule forbids the JS `number` type for monetary values in any module under `src/domain/money/`.

---

### Task 3 — Scoring orchestrator

> Serves: MO-1, MO-7.

**Prompt to AI:**
> Implement the scoring orchestrator that, given an `application_id`, runs identity checks, calls the credit-bureau adapter, queries internal history, runs anti-fraud checks, and combines all signals into one `Decision` object with a category and a detailed reason-code list. Each external call has a timeout and a circuit breaker.

**File:** `src/services/scoring.service.ts`
**Details:**
- Each external integration is a separate adapter behind an interface; the orchestrator does not know about HTTP.
- A single-flight lock by `application_id` prevents concurrent scoring (edge case C-1).
- On any external call exhausting its retry budget, the decision is `technical_decline` unless other strong signals already classify the application.
- Decision is written with a monotonic `decision_seq`; previous attempts remain in the audit log.

**Definition of Done:**
- p95 latency ≤ 30 s under the synthetic-load harness with seeded fixtures.
- Chaos test (kill bureau adapter) results in no `disbursed` outcomes and no inconsistent state.

---

### Task 4 — Reason-code policy & redaction

> Serves: MO-5.

**Prompt to AI:**
> Implement the reason-code redaction layer. Detailed reason codes are categorised into a small set of borrower-facing categories. Implement a single redaction function used by every borrower-facing serializer; add a lint rule that forbids returning `reason_codes_detail` from any handler whose response is consumed by the borrower role.

**File:** `src/services/decision-redaction.service.ts`
**Details:**
- Categories: `not_eligible`, `verification_failed`, `try_later`, `technical_issue`, `under_review`.
- Mapping table is in code and versioned; changes require a policy migration.
- Static analysis hook (`grep` plus a typed marker) flags any new DTO that exposes `reason_codes_detail` to a non-internal role.

**Definition of Done:**
- The role-based test matrix from §8.1 passes for every (role × field) cell.
- A new `reason_codes_detail` exposure cannot land without an explicit policy decision in the migration history.

---

### Task 5 — Offer renderer with NBU disclosures

> Serves: MO-2.

**Prompt to AI:**
> Implement the offer renderer. Given a `Decision` of category `approved` or `counter_offer`, produce an `Offer` artifact containing all NBU-mandated fields (effective annual rate, total amount payable, schedule, penalty terms, withdrawal right, lender details, consent text). Persist the rendered text plus a structured representation plus a SHA-256 of both. The renderer is pure — same inputs produce the same artifact bytes.

**File:** `src/services/offer-renderer.service.ts`
**Details:**
- Effective annual rate is computed using the regulator's defined formula; store both the borrower-displayed rounded value and the exact internal value.
- Offer carries the `policy_version_id` and `nbu_template_id` active at issuance.
- Offer TTL is 30 minutes by default, configurable per product 15–60 min.

**Definition of Done:**
- Schema test asserts presence of every NBU-mandated field.
- Snapshot test detects any unintentional change in the rendered text.
- Same offer rendered twice has bit-identical bytes.

---

### Task 6 — OTP service & signature

> Serves: MO-3, MO-6.

**Prompt to AI:**
> Implement the OTP service: generate a 6-digit code, send via the SMS provider adapter, store only a salted hash, enforce a 5-minute TTL and 3-attempt limit, enforce a 60-second resend cooldown. Implement the signature endpoint that validates the OTP, marks the offer as signed, and records `OfferSigned` in the audit log with an HMAC over the offer hash, offer id, borrower id, and timestamp.

**File:** `src/services/otp.service.ts`, `src/services/signature.service.ts`
**Details:**
- OTP code is never returned in any API response, never logged in any form.
- After 3 failed attempts the offer is invalidated; the borrower may request a new offer (which re-runs the freshness check on scoring).
- Signature endpoint is idempotent on `Idempotency-Key`; duplicate calls return the original signature event (edge case S-1).

**Definition of Done:**
- Log scan finds zero occurrences of any OTP code value in test runs.
- Replay test: replaying the same signed event does not produce a second contract.

---

### Task 7 — Payout adapter & disbursement

> Serves: MO-4, MO-7.

**Prompt to AI:**
> Implement the card-payout adapter for a Visa-Direct-style PSP. Calls carry a deterministic `idempotency_key` derived from `application_id + payout_attempt_seq`. Retry policy is 3 attempts with exponential backoff (5s, 30s, 5min). On a successful PSP response, set the loan state to `disbursement_pending`; only the PSP webhook (or the reconciliation job) moves it to `disbursed`. Compute and store `interest_accrual_start_at` = payout-confirmed timestamp.

**File:** `src/adapters/psp-payout.adapter.ts`, `src/services/disbursement.service.ts`
**Details:**
- PSP webhook handler validates signature, looks up the payout by PSP `transaction_id`, is idempotent (edge case T-6).
- On exhausting retries with non-retryable failure → `disbursement_failed`, emit `OfferCancelledDueToPayoutFailure`.
- A daily reconciliation job queries PSP for any payout in `disbursement_pending` for > 4h; on confirmation, advances to `disbursed`.

**Definition of Done:**
- Property test: any retry sequence produces at most one successful PSP transaction.
- Integration test for the lost-webhook reconciliation path.

---

### Task 8 — Audit log

> Serves: MO-6.

**Prompt to AI:**
> Implement an append-only audit log keyed by `application_id`. Each event carries an event type, payload (with PII redaction rules applied), monotonic sequence number, timestamp, actor, and a hash chained to the previous event. Provide a daily integrity-check job and a replay function that reconstructs application state from events.

**File:** `src/services/audit-log.service.ts`
**Details:**
- Allowed event types are enumerated: `ApplicationSubmitted`, `ScoringStarted`, `ScoringCompleted`, `OfferIssued`, `OtpSent`, `OtpVerified`, `OfferSigned`, `PayoutRequested`, `PayoutSucceeded`, `PayoutFailed`, `OfferCancelledDueToPayoutFailure`, `ApplicationManualReviewQueued`, `ApplicationManualReviewDecided`, `ComplianceHoldApplied`.
- PII redaction rules forbid PAN, CVV, OTP, passport number; allow stable internal IDs.
- Retention: AML statutory minimum 5 years per Law 361-IX; internal target 7 years (see §5.1). Deletion is forbidden; pseudonymisation applied on right-to-erasure.

**Definition of Done:**
- Replay produces identical state to the live system across a corpus of 100 sample applications.
- Daily integrity-check job passes on a tampered fixture by detecting the tampering.

---

### Task 9 — Manual review console (officer-facing)

> Serves: MO-1, MO-5, MO-6.

**Prompt to AI:**
> Implement the officer-facing endpoints for the manual-review queue: list, claim, view full decision detail, approve, decline, override with reason. Each decision is recorded with the acting officer's id and a free-text justification field (this field is internal-only and audit-logged).

**File:** `src/services/manual-review.service.ts`
**Details:**
- SLA timer per item; items breach SLA at 1 business day and alert.
- Officer cannot view another officer's claim's payload until claim is released.
- Override decisions are persisted as a new `Decision` with `decision_seq + 1` and reason `manual_override`; the prior automated decision remains in the log.

**Definition of Done:**
- SLA-breach alert fires within 5 minutes of the timer threshold in tests.
- Role test: a customer-service user cannot see `reason_codes_detail` even via the officer endpoints.

---

### Task 10 — Policy engine & versioning

> Serves: MO-2, MO-7, edge case L-3.

**Prompt to AI:**
> Implement the policy engine that holds the current rates, caps, cut-offs, and counter-offer rules. Every policy change is a versioned migration with an `effective_from` timestamp. The decision service must use the policy version active at the application's submission time, not the "current" policy.

**File:** `src/services/policy.service.ts`
**Details:**
- Policies are immutable once `effective_from` has passed; previously signed offers reference the exact version id used.
- Risk / product manager role can stage and activate new policies; activation requires a second-pair sign-off (out of slice in detail, but interface is present).

**Definition of Done:**
- Replay test across a policy change boundary shows that applications before the boundary use the old rate and applications after use the new rate.
- Already-signed offers retain their original rate regardless of subsequent policy changes.

---

### Task 11 — Contract & integration tests

> Serves: all MOs.

**Prompt to AI:**
> Generate a contract-test suite using Schemathesis against `specs/loan-decision-api.yaml`. Build a fixture set covering all decision categories and all edge cases listed in §7. Cover three end-to-end flows: happy path, payout failure, manual-review approval.

**File:** `tests/contract/`, `tests/integration/`, `tests/fixtures/`
**Details:**
- Fixtures include synthetic borrowers for each fraud / technical / state / legal category.
- Reconciliation path is exercised in an integration test that simulates a lost webhook.
- Chaos suite kills each external dependency individually.

**Definition of Done:**
- All edge cases in §7 have at least one named test.
- The verification matrix in §8.1 is satisfied with green tests.
- Latency target from §6 is checked by the synthetic load harness in CI (smoke-level — full load runs nightly).

---

## Appendix A — Glossary

- **МФО / MFI** — мікрофінансова організація, non-bank consumer-credit provider under NBU supervision.
- **НБУ / NBU** — National Bank of Ukraine, the regulator.
- **APR** — annual percentage rate (effective annual rate).
- **PSP** — payment service provider; here, the card-payout processor (e.g. for Visa Direct / Mastercard Send).
- **BKI / БКІ** — credit bureau (e.g. UBKI, IBCH).
- **RNOKPP** — Ukrainian personal tax identification number.
- **PEP** — politically exposed person.
- **OTP** — one-time password.
- **AML** — anti-money-laundering.

## Appendix B — Sources

[1] National Bank of Ukraine, "До фінансової компанії застосовано заходи впливу за порушення вимог законодавства про захист прав споживачів фінансових послуг" (2025-12-01) — confirms enforcement of the 1%/day cap under art. 8 § 5 of the Law on Consumer Lending.
https://bank.gov.ua/ua/news/all/do-finansovoyi-kompaniyi-zastosovano-zahodi-vplivu-za-porushennya-vimog-zakonodavstva-pro-zahist-prav-spojivachiv-finansovih-poslug-21993

[2] National Bank of Ukraine, "Кредити — знай свої права" (consumer-credit rights page) — APR disclosure, preliminary information form, 14-day withdrawal right.
https://promo.bank.gov.ua/know-your-rights-loans/

[3] Delo.ua, "Життя в борг: в Україні видають понад 700 тисяч мікрокредитів щомісяця" — market-volume data used for the throughput rationale in §6.
https://delo.ua/news/zittya-v-borg-ukrayini-vidayut-ponad-700-tisyac-mikrokreditiv-shhomisyacya-451871/

[4] Law of Ukraine "Про запобігання та протидію легалізації (відмиванню) доходів, одержаних злочинним шляхом..." No. 361-IX — AML record-retention statutory minimum (5 years).

## Appendix C — Open questions deferred from this slice

The following are intentionally not specified here and would be specified in their own slices:

1. Detailed onboarding (form, card verification 1 UAH charge) — see "Onboarding slice".
2. Active-loan servicing (balance, accruals, statements) — see "Servicing slice".
3. Repayment, partial repayment, prepayment recalc — see "Repayment slice".
4. Collections / restructuring / default — see "Collections slice".
5. Right-of-withdrawal workflow (14-day) end-to-end — see "Withdrawal slice".
6. NBU reporting export format and schedule — see "Regulatory reporting slice".
