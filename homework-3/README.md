# Homework 3 — Specification-Driven Design

> **Student:** Denys Ostrometskyi
> **Date submitted:** 2026-05-17
> **AI tools used:** Claude Code (Opus 4.7), with a structured interview-mode workflow described below.

---

## Task summary

This homework asks for a **specification package** — no code. The deliverable is a layered, traceable specification for a finance-oriented feature, plus agent rules, editor rules, and this README.

Domain chosen: **MFI Loan Decision & Disbursement Service** for the Ukrainian microfinance market. Slice: the vertical from a submitted application to either a rejection or money on the borrower's payment card.

Files delivered in this directory:

| File | Purpose |
|---|---|
| [`specification.md`](./specification.md) | Layered specification: high-level → mid-level → non-functional → context → low-level tasks, with edge cases, verification, and performance as first-class sections |
| [`agents.md`](./agents.md) | Behavioural rules for any AI agent implementing the spec |
| [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) | Project-local editor/AI rules for this homework |
| [`README.md`](./README.md) | This file — student info, rationale, industry-practice notes |

---

## Why this domain

The instructor's example domain is "virtual card lifecycle". I picked a different but adjacent fintech domain — **Ukrainian microfinance lending** — for two reasons:

1. It is a domain I **understand as a user** (everyone in Ukraine has seen "Швидкокредит / Moneyveo / Є Гроші" advertising and has formed opinions about how it should and should not work). I have **not** worked on this product professionally, so the spec is not a write-up of an internal system — it is a synthesis from public sources and personal experience.
2. The microloan lifecycle has unusually rich layering: it is regulated by NBU with specific numerical caps (1%/day cap on the daily rate, mandatory APR disclosure, 14-day withdrawal right) and by AML law (≥ 5-year statutory retention; the spec adopts 7 years as an internal buffer). It has multiple internal stakeholders (scoring, fraud, treasury, compliance), many edge cases (failed payouts, lost webhooks, account takeover, regulatory changes mid-flow), and hard performance constraints (sub-30s scoring for a mobile-first audience). This gives every layer of the spec real, non-fabricated content.

The slice covers the most decision-rich step — **scoring → offer → signature → disbursement** — leaving onboarding, servicing, repayment, and collections to their own slices (listed as deferred work in `specification.md` Appendix B).

---

## Rationale — how the spec was shaped

### Layered, traceable, no-prose-for-prose's-sake

The spec is structured so that each layer either constrains or refines the layer above it:

- **High-Level Objective** sets the user/business outcome and a one-sentence scope boundary.
- **Mid-Level Objectives** (`MO-1`…`MO-7`) are observable outcomes — each says "after success, this state exists in the world".
- **Non-Functional & Policy** turns regulator rules into numeric constraints on the design (1%/day cap, 14-day withdrawal, AML ≥ 5y statutory + 7y internal buffer).
- **Performance Targets** turns "the borrower waits on a loading screen" into specific p95/p99 numbers, OTP TTLs, retry policies.
- **Edge Cases** are not an afterthought; they have IDs (`F-1`, `T-2`, `S-3`…) referenced from the Low-Level Tasks and the Verification matrix.
- **Verification** maps every MO to a verification approach.
- **Low-Level Tasks** end with mechanical Definitions of Done, each referencing the MO it serves.

The intent is that an implementer (human or AI) can trace any line of code back to a task → MO → high-level outcome, and conversely can answer "where in the spec do we say *not* to do X?" without scrolling.

### Choosing performance targets

Numbers in the spec are labelled "assumed targets" and are justified, not arbitrary:

- **30s p95 scoring latency** — Ukrainian microfinance is mobile-first; UX research at consumer-credit firms shows abandonment climbs sharply after 30s on a loader.
- **OTP TTL of 5 min, 3 attempts** — standard banking-grade balance between SMS delivery latency and brute-force resistance.
- **14-day withdrawal handling** — directly from Ukrainian consumer-credit law.
- **Throughput of 1k–10k applications/day per MFI** — derived from public market data: ~24k/day across all Ukrainian MFIs (Delo.ua reporting on >700k microcredits/month; full link in `specification.md` Appendix B [3]).

Where a number cannot be sourced from regulation or public market data, the spec uses an industry-standard default (e.g., payout retry 5s/30s/5min — common PSP guidance) and labels it as such.

### Choosing verification depth

For each MO, the verification approach is the *cheapest mechanism that actually proves the property*:

- For pure data-shape properties (offer fields, role-based redaction) — schema tests and a role × field matrix.
- For idempotency and state correctness — property-based tests over retry sequences and transition sequences.
- For external-system resilience — chaos tests against each adapter.
- For audit integrity — replay tests (an audit log that cannot reconstruct the system is not an audit log).

The intent is that the verification list cannot be padded with "we have tests" — each entry names a specific mechanism that fails distinctively when the property fails.

---

## Industry best practices applied — where they appear

The spec embeds the practices below. Each row points to the section that operationalises the practice.

| Practice | Where it appears |
|---|---|
| **OpenAPI 3.1 as source of truth, contract tests in CI** | `specification.md` Task 1, Task 11; `agents.md` §1, §4 |
| **PCI scope minimisation — no PAN, only PSP tokens** | `specification.md` §5.2; `agents.md` §2.2 |
| **PII-redacted logs with enumerated safe fields** | `specification.md` §5.2; `agents.md` §2.2 |
| **Idempotency-Key on all writes, deterministic external-call keys** | `specification.md` Task 1, Task 7, §5.3; `agents.md` §2.3 |
| **Tagged-union state machine, illegal states unrepresentable** | `specification.md` Task 2, §7.3; `agents.md` §2.4 |
| **Server-enforced authorisation (deny-by-default), no client trust** | `specification.md` §5.2; `agents.md` §2.5 |
| **Append-only hash-chained audit log with daily integrity check** | `specification.md` Task 8, §5.2, §8.1; `agents.md` §2.6 |
| **Reason-code disclosure split (borrower vs. internal) to prevent gaming the scoring system** | `specification.md` §3, §5.2, Task 4; `agents.md` §2.5 |
| **Policy versioning with `effective_from`; old offers honoured at old rates** | `specification.md` Task 10, §5.1, §7.4 (L-3); `agents.md` §2.7 |
| **Circuit breakers and explicit graceful degradation on external failure** | `specification.md` §5.3, §7.2 (T-1…T-7), Task 3, Task 7; `agents.md` §1 |
| **Property-based testing for money arithmetic, state, retries** | `specification.md` §8.1; `agents.md` §4 |
| **Chaos testing per external adapter** | `specification.md` §8.1, Task 11; `agents.md` §4 |
| **AML statutory minimum retention (5y per Law 361-IX), internal 7-year buffer, pseudonymisation on right-to-erasure** | `specification.md` §5.1, §5.4, Task 8 |
| **Pure renderers + snapshot tests for regulator-mandated artefacts** | `specification.md` Task 5; `agents.md` §2.8 |
| **Webhook signature validation, idempotency on provider transaction id** | `specification.md` Task 7, §7.2 (T-6, T-7); `agents.md` §6 |
| **Reconciliation job for missing webhooks** | `specification.md` Task 7, §5.3, §7.3 (S-2) |
| **Compliance review checkpoints as part of release** | `specification.md` §8.3 |
| **Money as Decimal + integer minor units, never float** | `specification.md` Task 2; `agents.md` §2.1 |
| **Manual-review SLA with breach alerting** | `specification.md` §6, Task 9 |

These practices are deliberately spread across the spec rather than collected into a "best practices" appendix — they should bite where the design lives, not in a list nobody re-reads.

---

## AI tools used — process notes

The spec was produced in a single Claude Code session in **interview mode**:

- The AI asked focused questions, one topic at a time (domain choice → slice scope → borrower journey → scoring inputs → scoring outputs → offer/signature → disbursement → stakeholders → performance numbers → edge cases).
- The human supplied substance from personal knowledge, opinions as a user, and live web research for regulator citations (e.g., NBU 1%/day cap, 14-day withdrawal right, market-size data for throughput sizing).
- The AI formalised each answer into spec language and pushed back where the human's framing was incomplete (e.g., "you described 3 functions — is the score a 4th, or part of one of the others?").
- The AI proposed structure (9 sections, table-per-stakeholder, edge-case ID scheme); the human approved or pushed back per section.

What was verified manually:

- NBU citations are verified against National Bank of Ukraine public pages: the 2025-12-01 enforcement notice confirming the 1%/day cap under art. 8 § 5 of the Law on Consumer Lending, and the "Know your rights — Credits" page covering APR disclosure, preliminary information form, and the 14-day withdrawal right. Full URLs in `specification.md` Appendix B [1], [2].
- The AML retention rule is anchored on Law of Ukraine 361-IX (statutory minimum 5 years for identification/transaction records). The spec adopts 7 years as an internal buffer (`specification.md` §5.1, Appendix B [4]); this is explicitly labelled as policy, not as a statutory baseline.
- Market throughput numbers come from Delo.ua's market reporting (>700k microcredits/month); the link is in `specification.md` Appendix B [3].
- The slice scope (steps 5–7 of the borrower journey) was anchored against a real Ukrainian MFI's public terms of service to make sure the described flow matches actual practice (specifically the Visa-Direct-style card payout, 1 UAH card verification, and SMS-OTP electronic signature).

What was deliberately *not* verified by me:

- Specific PSP payout SLAs are based on industry-standard PSP guidance, not on one specific Ukrainian PSP's contract. The spec labels these as assumed.
- The exact NBU template for the "preliminary information form" is referenced but not reproduced verbatim — that would belong in an appendix not required by the homework brief.

---

## Challenges

- **Scoping a vertical slice that is rich but bounded.** First draft tried to cover the full lifecycle (11 steps) at uniform depth — too thin everywhere. Solution: keep the lifecycle overview at one page, deep-dive only steps 5–7. The deferred slices are listed explicitly in Appendix B so the spec does not pretend they don't exist.
- **Distinguishing real edge cases from generic security boilerplate.** The instructor's brief explicitly warns against "a generic security essay". Edge cases are scoped to this slice (failed payouts, lost webhooks, mid-flow data changes, concurrency on a single borrower) and each one has an expected behaviour, not just a description.
- **Performance numbers without making them up.** Where regulation gave a number, I used it. Where the market gave a number, I cited it. Where neither was available, I used industry-standard defaults and labelled them as assumed.
- **Avoiding writing the spec from a real workplace product.** I work in registry-data analytics at Opendatabot, and the easy path would be to spec a system I work on. I deliberately picked an adjacent domain where I am a user, not a builder.

---

## How to verify this submission

Since this homework produces no code:

1. **Read `specification.md` top to bottom.** It should make sense without prior context.
2. **Spot-check cross-references.** Pick a task in §9, follow it to the MO it serves in §2, then to the edge-case IDs in §7 and the verification entries in §8.
3. **Confirm cross-cutting requirements are first-class.** Edge cases (§7), Verification (§8), Performance (§6) are their own sections — not paragraphs inside Implementation Notes.
4. **Read `agents.md`.** Confirm it states stack assumptions, domain rules, code style, verification expectations, and security defaults, and that it gives the AI a tie-breaking order of authority.
5. **Read `.claude/CLAUDE.md`.** Confirm it constrains the AI to *not* scaffold code under `src/`, `tests/`, etc., per this homework's no-code nature.

---

<div align="center">

*This homework was completed as part of the GenAI and Agentic AI for Software Engineering course.*

</div>
