# Specification — Multi-Agent Banking Pipeline

## 1. High-Level Objective

A file-driven multi-agent pipeline that validates, fraud-screens, and settles banking
transactions, writing every outcome to `shared/results/`.

## 2. Mid-Level Objectives

- Transactions failing field, amount, or currency checks are rejected with a reason and written to
  `shared/results/`.
- Transactions scoring `>= 50` on fraud risk are flagged and never settled.
- Cleared transactions are settled with a 0.5% fee (ROUND_HALF_UP, 2 decimal places) and a net amount.
- Every agent operation is logged with an ISO 8601 timestamp, agent name, transaction id, and outcome.
- All input transactions appear in `shared/results/` exactly once (settled, flagged, or rejected).

## 3. Implementation Notes

- **Money:** `decimal.js`, never `float`/`number`; `ROUND_HALF_UP` at 2 decimal places.
- **Currency:** ISO 4217 allow-list (USD, EUR, GBP, JPY, …).
- **Audit trail:** every operation logged as `timestamp | agent | transaction_id | outcome`.
- **PII:** account numbers, names, and descriptions are never logged in plaintext.
- **Communication:** JSON messages through `shared/input`, `shared/processing`, `shared/output`,
  `shared/results`; routing between agents is driven by the message `target_agent` field.

## 4. Context

- **Beginning state:** `sample-transactions.json` (8 raw records).
- **Ending state:** `shared/results/` populated, a pipeline summary report, test coverage `>= 90%`.

## 5. Low-Level Tasks

```
Task: Transaction Validator
Prompt: "Create a validator that rejects missing required fields, non-positive amounts, and
         non-ISO-4217 currencies; otherwise mark validated and route to fraud_detector."
File to CREATE: agents/transaction_validator.ts
Function to CREATE: validateTransaction(msg: AgentMessage): AgentMessage
Details: required fields transaction_id, timestamp, source_account, destination_account, amount,
         currency, transaction_type; amount > 0; currency in ISO 4217. On failure → results with
         status=rejected and a reason.

Task: Fraud Detector
Prompt: "Create a fraud detector that scores high-value (>=10k:+50), structuring (9k-10k:+30),
         cross-border (country != US:+20), off-hours (00-05 UTC:+15); flag if score>=50, else clear
         and route to settlement_processor."
File to CREATE: agents/fraud_detector.ts
Function to CREATE: detectFraud(msg: AgentMessage): AgentMessage
Details: short-circuit flagged transactions straight to results with risk_score and reason.

Task: Settlement Processor
Prompt: "Create a settlement processor that charges a 0.5% fee (ROUND_HALF_UP, 2 dp), computes the
         net amount, marks the transaction settled with settled_at, and routes to results."
File to CREATE: agents/settlement_processor.ts
Function to CREATE: settleTransaction(msg: AgentMessage): AgentMessage
Details: fee = amount * 0.005 rounded half-up to 2 dp; net = amount - fee.
```

## Expected outcomes (8 sample transactions)

| txn | amount | result |
|---|---|---|
| TXN001 | 1500.00 USD | settled (fee 7.50, net 1492.50) |
| TXN002 | 25000.00 USD | flagged (score 50) |
| TXN003 | 9999.99 USD | settled (score 30; fee 50.00, net 9949.99) |
| TXN004 | 500.00 EUR/DE | settled (score 20; fee 2.50, net 497.50) |
| TXN005 | 75000.00 USD | flagged (score 50) |
| TXN006 | 200.00 XYZ | rejected (currency) |
| TXN007 | -100.00 GBP | rejected (amount) |
| TXN008 | 3200.00 USD | settled (fee 16.00, net 3184.00) |

All 8 land in `shared/results/` (settled 4 / flagged 2 / rejected 2).
