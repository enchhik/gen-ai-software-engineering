# How To Run

## Prerequisites

- Node.js
- npm

The project was verified with the existing `package.json` scripts and local test suite.

## Install

```bash
npm install
```

## Run in development mode

```bash
npm run dev
```

This starts:

```text
http://localhost:3000
```

## Build

```bash
npm run build
```

Compiled output goes to `dist/`.

## Run compiled server

```bash
npm start
```

## Run tests

All tests:

```bash
npm test
```

Coverage:

```bash
npm run test:coverage
```

Latest verified coverage:

```text
Statements 97.6%
Branches 91.13%
Functions 100%
Lines 98.22%
```

## Useful manual checks

Create a ticket:

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

List tickets:

```bash
curl http://localhost:3000/tickets
```

Auto-classify on create:

```bash
curl -X POST "http://localhost:3000/tickets?auto_classify=true" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust-2",
    "customer_email": "bob@example.com",
    "customer_name": "Bob",
    "subject": "Critical login error",
    "description": "Cannot login, critical production down issue.",
    "metadata": {
      "source": "web_form",
      "browser": "Chrome 120",
      "device_type": "desktop"
    }
  }'
```

Bulk import from fixture:

```bash
curl -X POST "http://localhost:3000/tickets/import?auto_classify=true" \
  -F "file=@tests/fixtures/sample_tickets.csv"
```

## Sample data locations

- `tests/fixtures/sample_tickets.csv`
- `tests/fixtures/sample_tickets.json`
- `tests/fixtures/sample_tickets.xml`
- `tests/fixtures/invalid_tickets.csv`
- `tests/fixtures/invalid_tickets.json`
- `tests/fixtures/invalid_tickets.xml`
