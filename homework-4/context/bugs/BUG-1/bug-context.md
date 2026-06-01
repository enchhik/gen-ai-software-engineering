# BUG-1 — `GET /users` pagination

**Symptom:** `GET /users` returns the wrong window of rows.

- When the `limit` query param is missing, the endpoint returns every row
  instead of the expected default of 10.
- When `offset` is supplied, results are shifted by one.

**Location:** `src/routes/users.js`, the `/` handler.

**Failing tests:**
- `tests/users.routes.test.js` → "GET /users applies a default limit of 10"
- `tests/users.routes.test.js` → "GET /users honours offset correctly"

**Expected behaviour:** default `limit` is 10; `offset` is applied verbatim.
