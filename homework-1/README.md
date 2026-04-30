# 🏦 Homework 1: Banking Transactions API

> **Student Name**: Denys Ostrometsky
> **Date Submitted**: 2026-04-28
> **AI Tools Used**: Claude Code (Opus 4.7)

---

## 📋 Project Overview

A minimal REST API for banking transactions, built with **Node.js + Express** and validated with **zod**. Storage is fully in-memory (an array) — no database required. All four required endpoints are implemented, plus **two bonus features** from Task 4 (Account Summary and CSV Export). The project ships with **21 Jest + supertest tests** that all pass.

---

## ✅ Features Implemented

### Required (Tasks 1-3)
- `POST /transactions` — create a transaction (deposit / withdrawal / transfer); server-generated `id` and `timestamp`; default `status = "completed"`
- `GET /transactions` — list with combinable filters: `?accountId=`, `?type=`, `?from=`, `?to=` (date range is **inclusive of the end day**)
- `GET /transactions/:id` — fetch single transaction (404 if absent)
- `GET /accounts/:accountId/balance` — balance computed on the fly from completed transactions, returned **per currency** (e.g. `{"USD": 799.5, "EUR": 200}`)
- Validation per `TASKS.md`:
  - amount: positive, ≤ 2 decimal places
  - account: format `ACC-XXXXX` (5 alphanumeric)
  - currency: full ISO 4217 whitelist (~150 codes)
  - type-specific cross-field rules (deposit needs `toAccount`, transfer needs both, etc.)
- Structured errors: `{ "error": "Validation failed", "details": [{ "field", "message" }] }`

### Bonus
- 🌟 **A.** `GET /accounts/:accountId/summary` — total deposits/withdrawals per currency, transaction count, most-recent timestamp
- 🌟 **C.** `GET /transactions/export?format=csv` — CSV download with proper escaping

### Quality of life
- `GET /health` — for smoke testing / probes
- 21 automated tests (Jest + supertest)
- `nodemon` dev mode
- `demo/` folder with `run.sh`, `sample-requests.http`, `sample-data.json`

---

## 🏗️ Architecture & Decisions

```
homework-1/
├── src/
│   ├── index.js           # Express app factory + listener (split for testability)
│   ├── storage.js         # in-memory array + add/list/findById/reset
│   ├── models/
│   │   └── transaction.js # createTransaction() — server-controls id, timestamp, status
│   ├── validators/
│   │   ├── iso4217.js     # currency whitelist
│   │   └── schema.js      # zod schemas + formatZodErrors()
│   └── routes/
│       ├── transactions.js
│       └── accounts.js
├── tests/
│   └── transactions.test.js
└── demo/
    ├── run.sh
    ├── sample-requests.http
    └── sample-data.json
```

Key decisions (and *why*):

| Decision | Why |
|---|---|
| **App factory `buildApp()` separate from `listen()`** | Lets supertest spin up the app per test without binding a port |
| **Balance is computed, not stored** | The spec only persists `transactions[]`. Computing on demand keeps the model honest and avoids state drift |
| **Balance returned per currency** | A single account can hold multi-currency transactions in this model. Collapsing them into one number would silently lose information |
| **Server ignores client-supplied `id` / `timestamp`** | Prevents trivial spoofing; matches normal REST conventions |
| **Status defaults to `completed`** | Spec doesn't define lifecycle; for in-memory synchronous storage there is no "pending" state |
| **ISO 4217 as a whitelist** | Spec example showed only USD/EUR/GBP/JPY but standard has ~150. Whitelist is explicit and easy to audit |
| **Date range inclusive of end day** | `to=2024-01-31` includes `2024-01-31T23:59:59` — the user-friendlier interpretation. Also handles ISO datetime values |
| **Transfer cannot have `from === to`** | Subtle but easy validation slip. Made explicit in the schema |

---

## 🧪 Test Coverage (21 tests)

- **POST**: deposit happy path, bad account, negative amount, >2 decimals, invalid currency, transfer-self, ignores client-supplied id/timestamp
- **GET list**: all, filter by accountId, filter by type, combined, date range
- **GET :id**: 200 + 404
- **Unknown routes**: 404 fallback with structured body
- **Balance**: math correctness (deposit + transfer + withdrawal), 400 on bad account, **multi-currency aggregation**
- **Summary** (Bonus A): structure check
- **Export** (Bonus C): content-type, CSV header, **escape of commas / quotes / newlines / CR**

```bash
npm test
# Test Suites: 1 passed, 1 total
# Tests:       21 passed, 21 total
```

---

## 🤖 AI-Assisted Development

This project was built end-to-end via **Claude Code** in plan mode. Detailed prompt-by-prompt log: see [`docs/ai-usage.md`](./docs/ai-usage.md). High level:

1. **Project research** — Claude read `README.md`, `TASKS.md`, `.gitignore`, `git remote/branch` to derive a 20-item pitfalls checklist (saved as a planning doc).
2. **Stack decision** — Claude proposed FastAPI as recommended; I chose Node + Express.
3. **Scaffolding** — Claude generated `package.json`, `src/`, validators, routes, tests, demo files in one pass.
4. **Verification** — `npm test` (21/21 passing) and live `curl` smoke test confirmed correctness before commit.
5. **Compliance review + gap-fill** — Claude self-mapped `TASKS.md` requirements to file/lines, surfaced 8 minor gaps; 4 of them were addressed in a follow-up commit.

What I verified myself:
- Validation rules vs. `TASKS.md` requirements (regex for `ACC-XXXXX`, ≤2 decimals, ISO 4217)
- Balance math by hand on the smoke test
- That the server actually responds (not just the tests)

See [`docs/screenshots/`](./docs/screenshots/) for both AI-interaction captures (project research → plan → review) and live demo captures (server running + sample API requests/responses for every endpoint, including bonuses).

---

<div align="center">

*This project was completed as part of the AI-Assisted Development course.*

</div>