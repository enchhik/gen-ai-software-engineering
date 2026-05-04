# Homework 2: Intelligent Customer Support System

Lean REST API for support tickets built with TypeScript, Express, Zod, in-memory storage, deterministic auto-classification, and bulk import from CSV, JSON, and XML.

## What is implemented

- `POST /tickets` create ticket
- `GET /tickets` list tickets with filters
- `GET /tickets/:id` fetch single ticket
- `PUT /tickets/:id` partial update
- `DELETE /tickets/:id` delete ticket
- `POST /tickets/:id/auto-classify` classify existing ticket
- `POST /tickets/import` bulk import from `csv`, `json`, `xml`
- optional `?auto_classify=true` on create and bulk import

## Stack

- Node.js
- TypeScript
- Express
- Zod
- `csv-parse`
- `fast-xml-parser`
- `multer`
- Jest
- Supertest

## Project structure

```text
src/
  app.ts
  server.ts
  errors.ts
  classifier.ts
  models/ticket.ts
  store/ticketStore.ts
  importers/
tests/
  unit/
  integration/
  performance/
  fixtures/
docs/
  SPEC.md
  PLAN.md
  API_REFERENCE.md
  ARCHITECTURE.md
  TESTING_GUIDE.md
```

## Quick start

```bash
npm install
npm run dev
```

Server default URL:

```text
http://localhost:3000
```

Build and run compiled output:

```bash
npm run build
npm start
```

See [HOWTORUN.md](./HOWTORUN.md) for detailed setup, curl examples, and demo commands.

## Tests and coverage

Run all tests:

```bash
npm test
```

Run coverage:

```bash
npm run test:coverage
```

Latest verified coverage result:

```text
All files | Statements 97.6% | Branches 91.13% | Functions 100% | Lines 98.22%
```

## Sample data

Fixtures live in `tests/fixtures/`:

- `sample_tickets.csv`
- `sample_tickets.json`
- `sample_tickets.xml`
- `invalid_tickets.csv`
- `invalid_tickets.json`
- `invalid_tickets.xml`

## API examples

Create ticket:

```bash
curl -X POST http://localhost:3000/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust-1",
    "customer_email": "alice@example.com",
    "customer_name": "Alice",
    "subject": "Login issue",
    "description": "I cannot login to my account for several days.",
    "metadata": {
      "source": "web_form",
      "browser": "Chrome 120",
      "device_type": "desktop"
    }
  }'
```

Bulk import with auto-classification:

```bash
curl -X POST "http://localhost:3000/tickets/import?auto_classify=true" \
  -F "file=@tests/fixtures/sample_tickets.csv"
```

Full endpoint details are in [docs/API_REFERENCE.md](./docs/API_REFERENCE.md).

## Project context

- [docs/SPEC.md](./docs/SPEC.md) — lean specification, source of truth for implementation
- [docs/PLAN.md](./docs/PLAN.md) — TDD phase-by-phase implementation plan

## AI tools and models used

| Artifact | Model |
|---|---|
| Code (app.ts, classifier.ts, importers, store) | Claude Sonnet 4.6 |
| Unit and integration tests | Claude Sonnet 4.6 |
| README.md, HOWTORUN.md, API_REFERENCE.md, TESTING_GUIDE.md | Claude Sonnet 4.6 |
| ARCHITECTURE.md (Mermaid diagrams, design tradeoffs) | Claude Opus 4.7 |

Every prompt used `docs/SPEC.md` as the context source of truth.

## Request flow

```mermaid
flowchart LR
  Client --> Express[Express route in app.ts]
  Express --> Validation[Zod validation]
  Validation --> Store[In-memory ticket store]
  Express --> Importers[CSV / JSON / XML importers]
  Express --> Classifier[Keyword classifier]
  Store --> Response[JSON response]
```
