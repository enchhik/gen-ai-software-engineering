# Homework 2 - Intelligent Customer Support System: Lean Specification

**Date:** 2026-05-03
**Author:** Denis
**Status:** Draft v2 - lean scope
**Source requirements:** [`../TASKS.md`](../TASKS.md)

This document is the Context layer for implementation prompts. It intentionally keeps the design small enough for a homework project while still covering every required feature.

---

## 1. Goal

Build a REST API for support tickets that can:

1. Create, list, read, update, and delete tickets.
2. Bulk import tickets from CSV, JSON, and XML files.
3. Auto-classify tickets by category and priority using deterministic keyword rules.
4. Provide tests with >85% coverage.
5. Provide the required documentation and sample data.

Out of scope: authentication, database persistence, real LLM classification, frontend UI, Docker, CI, rate limiting.

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js 20 LTS |
| Language | TypeScript, strict mode |
| HTTP framework | Express |
| Validation | Zod |
| CSV parsing | `csv-parse` |
| XML parsing | `fast-xml-parser` |
| File upload | `multer` memory storage |
| IDs | `crypto.randomUUID()` |
| Tests | Jest + ts-jest + supertest |

`package.json` scripts: `dev`, `build`, `start`, `test`, `test:coverage`.

No dedicated repository interface, controller layer, request-id middleware, or structured logging library is required. Keep the code direct and readable.

## 3. Storage

Use an in-memory `Map<string, Ticket>` in `src/store/ticketStore.ts`.

Data does not survive process restart. This is acceptable for the homework.

## 4. Project Structure

```text
homework-2/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── errors.ts
│   ├── classifier.ts
│   ├── models/
│   │   └── ticket.ts
│   ├── store/
│   │   └── ticketStore.ts
│   └── importers/
│       ├── csvImporter.ts
│       ├── jsonImporter.ts
│       └── xmlImporter.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── performance/
│   └── fixtures/
│
├── docs/
│   ├── SPEC.md
│   ├── PLAN.md
│   ├── API_REFERENCE.md
│   ├── ARCHITECTURE.md
│   ├── TESTING_GUIDE.md
│   └── screenshots/test_coverage.png
│
├── README.md
├── HOWTORUN.md
├── package.json
├── tsconfig.json
└── jest.config.ts
```

### File Responsibilities

- `app.ts`: Express app, routes, validation, error responses.
- `server.ts`: starts the app on `PORT`.
- `errors.ts`: small `HttpError` helper and error response formatting.
- `models/ticket.ts`: Zod schemas and TypeScript types.
- `store/ticketStore.ts`: in-memory CRUD, filtering, and import insertion.
- `classifier.ts`: pure keyword classifier plus helper to apply classification to a ticket.
- `importers/*`: pure parsers for CSV, JSON, XML.

## 5. Data Model

### 5.1 Enums

```ts
category: 'account_access' | 'technical_issue' | 'billing_question' | 'feature_request' | 'bug_report' | 'other'
priority: 'urgent' | 'high' | 'medium' | 'low'
status: 'new' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
metadata.source: 'web_form' | 'email' | 'api' | 'chat' | 'phone'
metadata.device_type: 'desktop' | 'mobile' | 'tablet'
```

### 5.2 Ticket

```ts
type Ticket = {
  id: string;
  customer_id: string;
  customer_email: string;
  customer_name: string;
  subject: string;        // 1-200 chars
  description: string;    // 10-2000 chars
  category: Category;
  priority: Priority;
  status: Status;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  assigned_to: string | null;
  tags: string[];
  metadata: {
    source: Source;
    browser: string;       // required; use "n/a" for non-browser sources
    device_type: Device;
  };
  last_classification: Classification | null;
};
```

### 5.3 Classification

```ts
type Classification = {
  category: Category;
  priority: Priority;
  confidence: number;     // 0-1
  reasoning: string;
  keywords: string[];
  classified_at: string;
};
```

### 5.4 Input Rules

- `CreateTicketInput` excludes server fields: `id`, `created_at`, `updated_at`, `resolved_at`, `last_classification`.
- On create, default `category = other`, `priority = medium`, `status = new`, `assigned_to = null`, `tags = []`.
- `UpdateTicketInput` is a partial create input.
- `metadata.browser` is required to match the assignment model; use `"n/a"` where no browser exists.
- `id`, timestamps, and `resolved_at` are managed by the server.
- Setting status to `resolved` sets `resolved_at`; changing away from `resolved` clears it.

## 6. Endpoints

| Method | Path | Notes |
|---|---|---|
| `POST` | `/tickets` | Create ticket. `?auto_classify=true` runs classifier after creation. |
| `POST` | `/tickets/import` | Multipart upload field `file`. Supports CSV/JSON/XML. `?auto_classify=true` classifies successful imports. |
| `GET` | `/tickets` | List tickets. Filters: `category`, `priority`, `status`, `assigned_to`. |
| `GET` | `/tickets/:id` | Return one ticket or 404. |
| `PUT` | `/tickets/:id` | Partial update. Manual category/priority update is allowed. |
| `DELETE` | `/tickets/:id` | Delete ticket. |
| `POST` | `/tickets/:id/auto-classify` | Classify existing ticket and update category, priority, last_classification. |

### 6.1 Status Codes

- `201`: ticket created.
- `200`: successful read/update/classification/import.
- `204`: successful delete.
- `207`: import completed with some failed rows.
- `400`: validation or malformed file error.
- `404`: ticket not found.
- `415`: unsupported import format.

### 6.2 Error Response

Use one simple shape for errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": []
  }
}
```

### 6.3 Bulk Import Response

```json
{
  "total": 50,
  "successful": 47,
  "classified": 47,
  "failed": [
    { "row": 12, "error": "Invalid email", "raw": { "...": "..." } }
  ]
}
```

`classified` is `0` unless `?auto_classify=true` is used.

## 7. Classifier

Pure function:

```ts
classify(subject: string, description: string): Classification
```

### 7.1 Priority Rules

Walk in this order:

1. `urgent`: `"can't access"`, `"cannot access"`, `"critical"`, `"production down"`, `"security"`
2. `high`: `"important"`, `"blocking"`, `"asap"`
3. `low`: `"minor"`, `"cosmetic"`, `"suggestion"`
4. default: `medium`

### 7.2 Category Rules

Pick the category with the most keyword matches. Tie-break by listed order. Zero matches means `other`.

1. `account_access`: `login`, `password`, `2fa`, `sign in`, `signin`, `locked out`
2. `technical_issue`: `error`, `crash`, `exception`, `not working`, `broken`
3. `billing_question`: `payment`, `invoice`, `refund`, `charge`, `subscription`
4. `feature_request`: `feature request`, `would be nice`, `could you add`, `enhancement`, `suggestion`, `suggestions`
5. `bug_report`: `bug`, `reproduce`, `steps to reproduce`, `regression`

### 7.3 Confidence and Logging

- `confidence = min(1, unique_matched_keywords / 3)`.
- If no keywords match, `confidence = 0.3`.
- `keywords` contains matched substrings, deduplicated in match order.
- `reasoning` is a short human-readable explanation.
- Classification decisions can be logged with `console.info({ ticketId, classification }, 'classified')`.

Manual updates via `PUT /tickets/:id` may override `category` and `priority`. `last_classification` remains the last automated decision.

## 8. Import Formats

### 8.1 CSV

- Header row required.
- Headers match input fields.
- Nested metadata uses dotted headers: `metadata.source`, `metadata.browser`, `metadata.device_type`.
- `tags` is a semicolon-separated list.
- Malformed CSV returns `400`.

### 8.2 JSON

- Top-level value must be an array of objects.
- Invalid JSON or non-array root returns `400`.

### 8.3 XML

- Root element: `<tickets>`.
- Ticket elements: `<ticket>`.
- Tags shape: `<tags><tag>...</tag></tags>`.
- Malformed XML returns `400`.

### 8.4 Row Validation

Importers parse raw rows. The API then validates each row with `CreateTicketInputSchema`.

- Valid rows are created.
- Invalid rows are added to `failed`.
- Partial success returns `207`.
- Failed rows are not stored.

## 9. Test Strategy

Required coverage: overall >85%.

Recommended test layout:

```text
tests/
├── unit/
│   ├── ticket.model.test.ts        # 9 validation tests
│   ├── classifier.test.ts          # 10 classifier tests
│   ├── csv.importer.test.ts        # 6 CSV tests
│   ├── json.importer.test.ts       # 5 JSON tests
│   ├── xml.importer.test.ts        # 5 XML tests
│   └── ticketStore.test.ts         # basic store behavior
├── integration/
│   ├── tickets.api.test.ts         # CRUD + filtering + status codes
│   └── lifecycle.test.ts           # end-to-end scenarios
├── performance/
│   └── benchmarks.test.ts          # 5 benchmark-style tests
└── fixtures/
    ├── sample_tickets.csv          # 50 rows
    ├── sample_tickets.json         # 20 records
    ├── sample_tickets.xml          # 30 records
    └── invalid_*.{csv,json,xml}
```

Performance tests should be lightweight benchmark checks, not strict production SLAs. They should verify that the implementation handles:

- 20+ concurrent `POST /tickets`.
- Listing/filtering many in-memory tickets.
- Importing a larger CSV fixture.
- Running many classifier calls.

## 10. TDD Implementation Order

1. Project scaffold.
2. Zod schemas and model tests.
3. Classifier tests and implementation.
4. Importer tests and implementation.
5. In-memory store tests and implementation.
6. Express API integration tests and routes.
7. Bulk import integration tests.
8. Lifecycle and performance tests.
9. Coverage screenshot.
10. Documentation.

## 11. Documentation Deliverables

| File | Audience | Claude model |
|---|---|---|
| `README.md` | Developers | Claude Sonnet 4.6 |
| `HOWTORUN.md` | Reviewers / developers | Claude Sonnet 4.6 |
| `docs/API_REFERENCE.md` | API consumers | Claude Sonnet 4.6 |
| `docs/ARCHITECTURE.md` | Technical leads | Claude Opus 4.7 |
| `docs/TESTING_GUIDE.md` | QA engineers | Claude Sonnet 4.6 |

Include at least 3 Mermaid diagrams across the documentation set.

## 12. Screenshots

Required or strongly recommended screenshots in `docs/screenshots/`:

- `test_coverage.png`: coverage >85%.
- tests passing.
- server running.
- create ticket request.
- bulk import request.
- auto-classify request.
- Claude prompt using `SPEC.md`.
- Claude-generated tests or TDD workflow.

## 13. Context-Model-Prompt Usage

Every AI prompt should reference this file as the source of truth. If a prompt output conflicts with this spec, update the spec first or reject the output.
