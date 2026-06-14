# BUG-1 Security Report

## Scope

Files scanned in connection with the BUG-1 fix:

- `src/routes/users.js` (lines 1–39) — file changed by the fix
- `src/auth.js` (lines 1–37) — imported by `users.js` via `requireAuth`

The change introduced by BUG-1 modifies only the `GET /` handler in
`src/routes/users.js` (lines 18–29), replacing the limit/offset
computation. No other files were touched by the fix.

## Findings

### F-1 — Unbounded `limit` enables resource exhaustion (DoS)

- **Severity:** MEDIUM
- **Location:** `src/routes/users.js:22`, used at
  `src/routes/users.js:26–27`
- **Description:** `limit` is parsed from `req.query.limit` with
  `parseInt(req.query.limit, 10) || 10` and passed unchanged to
  `LIMIT ?` in the SQL query. There is no upper bound or sanity cap.
  A caller can request `?limit=100000000` and force the server to
  materialize the full `users` table into memory and a JSON response.
  On a sufficiently large table this exhausts memory / event-loop time
  and is a plausible denial-of-service vector for an authenticated user.
- **Attack input:** `GET /users/?limit=100000000` with any valid
  bearer token.
- **Suggested remediation:** Clamp `limit` to a maximum (e.g.
  `Math.min(limit, 100)`) and reject non-positive values.

### F-2 — Negative `limit` / `offset` accepted and forwarded to SQLite

- **Severity:** LOW
- **Location:** `src/routes/users.js:22` and `src/routes/users.js:25`
- **Description:** `parseInt('-1', 10)` returns `-1`, which is truthy,
  so the `|| 10` / `|| 0` fallbacks do **not** trigger for negative
  numeric strings. SQLite treats a negative `LIMIT` as "no limit",
  reintroducing the very behaviour BUG-1(a) was meant to remove: a
  request such as `?limit=-1` once again returns every row in the
  table. A negative `OFFSET` is silently treated as `0` by SQLite but
  is still unexpected input the endpoint accepts without validation.
- **Attack input:** `GET /users/?limit=-1` with a valid bearer token —
  bypasses the new default page size and exposes the full user list
  in one response (same effect as the pre-fix bug).
- **Suggested remediation:** Validate that the parsed `limit` and
  `offset` are finite non-negative integers before use; coerce
  invalid values to the defaults.

### F-3 — `parseInt` accepts trailing garbage in numeric query params

- **Severity:** INFO
- **Location:** `src/routes/users.js:22`, `src/routes/users.js:25`
- **Description:** `parseInt('10; DROP TABLE users', 10)` returns
  `10`. The value is bound as a parameter to a prepared statement, so
  this is **not** a SQL injection vector, but it does mean the
  endpoint silently accepts inputs that look malformed. Combined with
  F-2, this makes it harder to spot abusive clients in logs.
- **Suggested remediation:** Use `Number.isInteger(Number(value))` (or
  a schema validator such as `zod`) and 400 on invalid input.

### F-4 — Pre-existing SQL injection in `/users/search` (out of fix scope, in same file)

- **Severity:** CRITICAL
- **Location:** `src/routes/users.js:8–16` (specifically the template
  literal at lines 12–13)
- **Description:** `q` is taken straight from `req.query.q`,
  string-interpolated into the SQL, and executed via
  `db.prepare(sql).all()`. Any authenticated client can supply
  `q=' OR 1=1 --` to dump the full `users` table, or chain a UNION
  SELECT to read arbitrary tables the DB user has access to. This is
  flagged in the source as `SEC-1` and was **not** addressed by the
  BUG-1 change but lives in the same handler module.
- **Attack input:** `GET /users/search?q=%27%20OR%201%3D1%20--` with a
  valid bearer token.
- **Suggested remediation:** Use a parameterised statement, e.g.
  `db.prepare("SELECT id, email, name FROM users WHERE name LIKE ? OR email LIKE ?").all('%'+q+'%', '%'+q+'%')`.

### F-5 — Pre-existing hardcoded auth secret and plaintext passwords

- **Severity:** HIGH
- **Location:** `src/auth.js:4` (`SECRET = 'hw4-super-secret-key'`),
  `src/auth.js:7–13` (`hashPassword` returns plaintext;
  `verifyPassword` does a non-constant-time `===` comparison)
- **Description:** The HMAC secret used to sign and verify session
  tokens is committed into the repository, so anyone with read access
  to the source can forge tokens for any user (including
  `requireAuth`-protected routes such as the BUG-1 handler).
  Passwords are stored and compared as plaintext. The equality check
  in `verifyPassword` is also vulnerable to timing analysis on a
  remote attacker model. Tagged `SEC-2` in the source; outside the
  BUG-1 change but reachable through every route that calls
  `requireAuth`, including the modified `GET /users/`.
- **Attack inputs:**
  1. Forge a bearer token by HMAC-signing
     `{"sub":"admin"}` with the leaked `SECRET` and call any
     authenticated endpoint.
  2. Read `users.password` directly from the DB (or via F-4) to
     recover everyone's plaintext password.
- **Suggested remediation:** Read the secret from `process.env`,
  refuse to start if it is missing, hash passwords with
  `crypto.scrypt` (random per-user salt), and compare digests with
  `crypto.timingSafeEqual`.

## No-Issue Areas

- `src/routes/users.js:31–36` — the `GET /:id` handler binds
  `req.params.id` as a positional parameter to a prepared statement;
  no injection surface and no behaviour change from the fix.
- `src/auth.js:15–28` — `signToken` / `verifyToken` themselves use a
  prepared HMAC and a strict equality check on signatures; the
  weakness is the secret (see F-5), not these functions' structure.
  No additional issue beyond F-5 in this range.
- `src/auth.js:30–37` — `requireAuth` correctly rejects requests
  without a verifiable bearer token; nothing in the BUG-1 change
  weakens this gate.

## References

- `src/routes/users.js:8` — `r.get('/search', ...)` declaration
- `src/routes/users.js:12–13` — string-interpolated SQL (F-4)
- `src/routes/users.js:14` — `db.prepare(sql).all()` execution of F-4
- `src/routes/users.js:18` — `r.get('/', ...)` declaration (BUG-1 fix)
- `src/routes/users.js:22` — `limit = parseInt(...) || 10` (F-1, F-2, F-3)
- `src/routes/users.js:25` — `offset = parseInt(...) || 0` (F-2, F-3)
- `src/routes/users.js:26–27` — prepared statement bound with
  `(limit, offset)` (F-1, F-2)
- `src/routes/users.js:31–36` — `GET /:id` handler (no-issue area)
- `src/auth.js:4` — hardcoded `SECRET` (F-5)
- `src/auth.js:7–9` — `hashPassword` returns plaintext (F-5)
- `src/auth.js:11–13` — `verifyPassword` non-constant-time `===` (F-5)
- `src/auth.js:30–37` — `requireAuth` middleware (no-issue area)
