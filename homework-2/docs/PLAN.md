# Homework 2 - Lean Implementation Plan

**Goal:** Implement the support ticket REST API from [`SPEC.md`](SPEC.md) without production-style over-engineering.

**Principle:** Keep the design simple, testable, and assignment-focused. Use TDD for behavior. Do not add repository interfaces, controller classes, request-id middleware, complex logging, Docker, CI, database adapters, or framework abstractions unless the assignment explicitly needs them.

---

## Working Rules

- Work inside `homework-2/`.
- Use `docs/SPEC.md` as the source of truth.
- Implement in small TDD cycles:
  1. write failing test,
  2. run it and confirm RED,
  3. write minimal code,
  4. run it and confirm GREEN,
  5. refactor only if needed.
- Actual model and effort usage is documented below from the saved screenshots in `docs/screenshots/`.
- Claude Sonnet 4.6 with medium effort was used for most code, test, and documentation phases.
- OpenAI Codex GPT-5.4 with medium effort was used for the later implementation and verification phases.
- Claude Opus 4.7 with high effort was used only for final review.

## Target File Structure

```text
src/
├── app.ts
├── server.ts
├── errors.ts
├── classifier.ts
├── models/
│   └── ticket.ts
├── store/
│   └── ticketStore.ts
└── importers/
    ├── csvImporter.ts
    ├── jsonImporter.ts
    └── xmlImporter.ts

tests/
├── unit/
├── integration/
├── performance/
└── fixtures/
```

## Actual AI Model Usage

| Work | Tool | Model | Effort | Evidence |
|---|---|---|---|---|
| Phase 1-2 - Scaffold and Ticket Model | Claude Code | Claude Sonnet 4.6 | Medium | `docs/screenshots/phase-1-2.png` |
| Phase 3 - Classifier | Claude Code | Claude Sonnet 4.6 | Medium | `docs/screenshots/phase-3.png` |
| Phase 4-5 - Importers and Store | Claude Code | Claude Sonnet 4.6 | Medium | `docs/screenshots/phase-4-5.png` |
| Phase 6 - Express API | Claude Code | Claude Sonnet 4.6 | Medium | `docs/screenshots/phase-6.png` |
| Phase 7 - Bulk Import API | OpenAI Codex | GPT-5.4 | Medium | `docs/screenshots/phase-7.png` |
| Phase 8 - Fixtures, Lifecycle, Performance | OpenAI Codex | GPT-5.4 | Medium | `docs/screenshots/phase-8-coverage.png` |
| Phase 9 - Coverage | OpenAI Codex | GPT-5.4 | Medium | `docs/screenshots/phase-9-check-coverage.png` |
| Phase 10 - Documentation | Claude Code | Claude Sonnet 4.6 / Claude Opus 4.7 | Medium / High | `docs/screenshots/phase-10.png`, `docs/screenshots/phase-11-review.png` |
| Phase 11 - Final Review | Claude Code | Claude Opus 4.7 | High | `docs/screenshots/phase-11-review.png` |
| Final review fixes | Claude Code | Claude Sonnet 4.6 | Medium | `docs/screenshots/fix-and-final-review.png` |

## Phase 1 - Scaffold

**Model/Effort used:** Claude Sonnet 4.6, medium effort

Create:

- `package.json`
- `tsconfig.json`
- `jest.config.ts`
- `tests/setup.ts` if needed

Install only what the lean spec needs:

```bash
npm install express zod csv-parse fast-xml-parser multer
npm install -D typescript ts-node ts-jest jest @types/jest @types/node @types/express @types/multer supertest @types/supertest
```

Expected scripts:

```json
{
  "dev": "ts-node src/server.ts",
  "build": "tsc -p tsconfig.json",
  "start": "node dist/server.js",
  "test": "jest",
  "test:coverage": "jest --coverage"
}
```

Verify:

```bash
npm run build
npm test
```

At this stage, `npm test` may report no tests. That is acceptable before Phase 2.

## Phase 2 - Ticket Model

**Model/Effort used:** Claude Sonnet 4.6, medium effort

Create tests first:

- `tests/unit/ticket.model.test.ts`

Cover:

- valid create input applies defaults;
- invalid email fails;
- subject length fails;
- description length fails;
- invalid category fails;
- invalid priority fails;
- invalid status fails;
- `metadata.browser` is required;
- invalid `metadata.device_type` fails.

Then implement:

- `src/models/ticket.ts`

Verify:

```bash
npm test -- tests/unit/ticket.model.test.ts
```

## Phase 3 - Classifier

**Model/Effort used:** Claude Sonnet 4.6, medium effort

Create tests first:

- `tests/unit/classifier.test.ts`

Cover:

- urgent, high, low, and medium priority;
- each category rule;
- `suggestion` maps to `feature_request` and low priority;
- default `other` with confidence `0.3`;
- keyword deduplication;
- confidence reaches `1` with 3+ unique matches.

Then implement:

- `src/classifier.ts`

Verify:

```bash
npm test -- tests/unit/classifier.test.ts
```

## Phase 4 - Importers

**Model/Effort used:** Claude Sonnet 4.6, medium effort

Create tests first:

- `tests/unit/csv.importer.test.ts`
- `tests/unit/json.importer.test.ts`
- `tests/unit/xml.importer.test.ts`

Cover:

- valid CSV/JSON/XML parsing;
- invalid/malformed file behavior;
- metadata parsing;
- tags parsing;
- empty valid files where relevant.

Then implement:

- `src/importers/csvImporter.ts`
- `src/importers/jsonImporter.ts`
- `src/importers/xmlImporter.ts`

Keep importers pure. They should not know about Express or storage.

Verify:

```bash
npm test -- tests/unit
```

## Phase 5 - In-Memory Store

**Model/Effort used:** Claude Sonnet 4.6, medium effort

Create tests first:

- `tests/unit/ticketStore.test.ts`

Cover:

- create generates UUID and timestamps;
- get by id;
- list all;
- filter by category/priority/status/assigned_to;
- update refreshes `updated_at`;
- setting `resolved` sets `resolved_at`;
- changing away from `resolved` clears `resolved_at`;
- delete removes the ticket.

Then implement:

- `src/store/ticketStore.ts`

Verify:

```bash
npm test -- tests/unit/ticketStore.test.ts
```

## Phase 6 - Express API

**Model/Effort used:** Claude Sonnet 4.6, medium effort

Create integration tests first:

- `tests/integration/tickets.api.test.ts`

Cover:

- `POST /tickets` returns `201`;
- invalid body returns `400`;
- `GET /tickets` lists tickets;
- filters work;
- `GET /tickets/:id` returns `404` for missing ticket;
- `PUT /tickets/:id` updates ticket;
- manual category/priority override works;
- `DELETE /tickets/:id` returns `204`;
- `POST /tickets/:id/auto-classify` returns `{ ticket, classification }`.

Then implement:

- `src/errors.ts`
- `src/app.ts`
- `src/server.ts`

Keep route handlers in `app.ts` unless the file becomes genuinely hard to read.

Verify:

```bash
npm test -- tests/integration/tickets.api.test.ts
```

## Phase 7 - Bulk Import API

**Model/Effort used:** OpenAI Codex GPT-5.4, medium effort

Extend integration tests for:

- CSV import success;
- JSON import success;
- XML import success;
- invalid file returns `400`;
- unsupported format returns `415`;
- mixed valid/invalid rows returns `207`;
- `?auto_classify=true` sets `last_classification` and `classified`.

Then implement import route behavior in `src/app.ts` using the existing importers and store.

Verify:

```bash
npm test -- tests/integration/tickets.api.test.ts
```

## Phase 8 - Fixtures, Lifecycle, Performance

**Model/Effort used:** OpenAI Codex GPT-5.4, medium effort

Create required fixtures:

- `tests/fixtures/sample_tickets.csv` with 50 tickets;
- `tests/fixtures/sample_tickets.json` with 20 tickets;
- `tests/fixtures/sample_tickets.xml` with 30 tickets;
- invalid CSV/JSON/XML fixtures.

Create:

- `tests/integration/lifecycle.test.ts`
- `tests/performance/benchmarks.test.ts`

Cover:

- full ticket lifecycle;
- bulk import with auto-classification;
- 20+ concurrent creates;
- combined filtering by category and priority;
- lightweight benchmark checks.

Verify:

```bash
npm test
```

## Phase 9 - Coverage

**Model/Effort used:** OpenAI Codex GPT-5.4, medium effort

Run:

```bash
npm run test:coverage
```

If below 85%, add focused tests for required uncovered behavior. Do not add meaningless coverage-only tests.

Save screenshot:

```text
docs/screenshots/test_coverage.png
```

## Phase 10 - Documentation

Generate after code and tests are stable.

| File | Model | Effort | Notes |
|---|---|---|---|
| `README.md` | Claude Sonnet 4.6 | Medium | overview, features, AI tools, project structure |
| `HOWTORUN.md` | Claude Sonnet 4.6 | Medium | install, run, test, coverage, demo commands |
| `docs/API_REFERENCE.md` | Claude Sonnet 4.6 | Medium | endpoints, examples, cURL |
| `docs/ARCHITECTURE.md` | Claude Opus 4.7 | High | Mermaid diagrams, data flow, tradeoffs |
| `docs/TESTING_GUIDE.md` | Claude Sonnet 4.6 | Medium | test pyramid, fixtures, manual checklist |

Include at least 3 Mermaid diagrams across the documentation set.

## Phase 11 - Final Review

**Model/Effort used:** Claude Opus 4.7, high effort

Ask Claude to review against:

- `homework-2/TASKS.md`
- `homework-2/docs/SPEC.md`
- root `README.md` submission requirements

Check:

- all endpoints implemented;
- CSV/JSON/XML import works;
- auto-classification works;
- manual override works;
- tests pass;
- coverage >85%;
- required docs exist;
- required sample data exists;
- screenshots are present.
