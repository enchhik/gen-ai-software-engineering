# BUG-1 — `GET /users` pagination

**Symptom:** `GET /users` returns the wrong window of rows. Two interacting
sub-defects:

- (a) When the `limit` query param is missing, no default of 10 is applied.
- (b) `offset` is shifted by one before reaching the SQL.

Observable: a bare `GET /users` returns 11 rows (ids 2..12) — defect (b)
consumes the first row even when no `offset` was supplied — instead of the
expected 10 (ids 1..10). `?offset=2&limit=3` returns ids 4,5,6 instead of
the expected 3,4,5.

**Location:** `src/routes/users.js`, the `/` handler.

**Failing tests:**
- `tests/users.routes.test.js` → "GET /users applies a default limit of 10"
- `tests/users.routes.test.js` → "GET /users honours offset correctly"

**Expected behaviour:** default `limit` is 10; `offset` is applied verbatim.
