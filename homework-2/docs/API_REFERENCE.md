# API Reference

Base URL:

```text
http://localhost:3000
```

## Data model summary

### Enums

```text
category: account_access | technical_issue | billing_question | feature_request | bug_report | other
priority: urgent | high | medium | low
status: new | in_progress | waiting_customer | resolved | closed
metadata.source: web_form | email | api | chat | phone
metadata.device_type: desktop | mobile | tablet
```

### Ticket create body

```json
{
  "customer_id": "cust-1",
  "customer_email": "alice@example.com",
  "customer_name": "Alice",
  "subject": "Login issue",
  "description": "I cannot login to my account for several days.",
  "category": "other",
  "priority": "medium",
  "status": "new",
  "assigned_to": null,
  "tags": [],
  "metadata": {
    "source": "web_form",
    "browser": "Chrome 120",
    "device_type": "desktop"
  }
}
```

Server-managed fields in responses:

- `id`
- `created_at`
- `updated_at`
- `resolved_at`
- `last_classification`

## Error format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": []
  }
}
```

## Endpoints

### `POST /tickets`

Creates a ticket.

Query params:

- `auto_classify=true` optional

Example:

```bash
curl -X POST "http://localhost:3000/tickets?auto_classify=true" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust-1",
    "customer_email": "alice@example.com",
    "customer_name": "Alice",
    "subject": "Critical login error",
    "description": "Cannot login, critical production down issue.",
    "metadata": {
      "source": "web_form",
      "browser": "Chrome 120",
      "device_type": "desktop"
    }
  }'
```

Success: `201 Created`

### `POST /tickets/import`

Bulk import from multipart upload field `file`.

Supported extensions:

- `.csv`
- `.json`
- `.xml`

Query params:

- `auto_classify=true` optional

Example:

```bash
curl -X POST "http://localhost:3000/tickets/import?auto_classify=true" \
  -F "file=@tests/fixtures/sample_tickets.csv"
```

Successful response:

```json
{
  "total": 50,
  "successful": 50,
  "classified": 50,
  "failed": []
}
```

Partial success response: `207 Multi-Status`

```json
{
  "total": 2,
  "successful": 1,
  "classified": 0,
  "failed": [
    {
      "row": 2,
      "error": "Invalid request body",
      "raw": {
        "customer_email": "not-an-email"
      }
    }
  ]
}
```

Failure modes:

- `400` malformed file or invalid row payload
- `415` unsupported file extension

### `GET /tickets`

Lists tickets.

Supported filters:

- `category`
- `priority`
- `status`
- `assigned_to`

Example:

```bash
curl "http://localhost:3000/tickets?category=technical_issue&priority=medium"
```

Success: `200 OK`

### `GET /tickets/:id`

Fetches one ticket by id.

Example:

```bash
curl http://localhost:3000/tickets/<ticket-id>
```

Success: `200 OK`

Not found: `404`

### `PUT /tickets/:id`

Partially updates a ticket.

Example:

```bash
curl -X PUT http://localhost:3000/tickets/<ticket-id> \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "assigned_to": "agent-42"
  }'
```

Notes:

- manual category override is supported
- manual priority override is supported
- setting `status` to `resolved` sets `resolved_at`

Success: `200 OK`

### `DELETE /tickets/:id`

Deletes a ticket.

Example:

```bash
curl -X DELETE http://localhost:3000/tickets/<ticket-id>
```

Success: `204 No Content`

### `POST /tickets/:id/auto-classify`

Classifies an existing ticket and updates:

- `category`
- `priority`
- `last_classification`

Example:

```bash
curl -X POST http://localhost:3000/tickets/<ticket-id>/auto-classify
```

Response shape:

```json
{
  "ticket": {},
  "classification": {
    "category": "account_access",
    "priority": "urgent",
    "confidence": 1,
    "reasoning": "Matched keywords: login. Category: account_access, Priority: urgent.",
    "keywords": ["login"],
    "classified_at": "2026-05-03T00:00:00.000Z"
  }
}
```

## Classifier behavior summary

Priority keywords:

- `urgent`: `can't access`, `cannot access`, `critical`, `production down`, `security`
- `high`: `important`, `blocking`, `asap`
- `low`: `minor`, `cosmetic`, `suggestion`, `suggestions`
- default: `medium`

Category keywords:

- `account_access`: `login`, `password`, `2fa`, `sign in`, `signin`, `locked out`
- `technical_issue`: `error`, `crash`, `exception`, `not working`, `broken`
- `billing_question`: `payment`, `invoice`, `refund`, `charge`, `subscription`
- `feature_request`: `feature request`, `would be nice`, `could you add`, `enhancement`, `suggestion`, `suggestions`
- `bug_report`: `bug`, `reproduce`, `steps to reproduce`, `regression`
