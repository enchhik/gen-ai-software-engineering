# BUG-2 — Security Report

## Scope

Files scanned for this review:

- `src/routes/auth.js` (full file, lines 1–33) — the file changed by the BUG-2 fix
- `src/auth.js` (full file, lines 1–37) — imported by `src/routes/auth.js` and exercised by both `/register` and `/login`

The diff under review is the single-line change at `src/routes/auth.js:25`,
switching the login lookup to
`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`. The surrounding modules
were also inspected, since the fix changes authentication-path behaviour.

## Findings

### F1 — Register/login email casing mismatch enables account-confusion / takeover (HIGH)

- **Location:** `src/routes/auth.js:12` (register) vs `src/routes/auth.js:25` (login)
- **Description:** After the BUG-2 fix, login matches emails
  case-insensitively (`LOWER(email) = LOWER(?)`), but the duplicate-email
  check in `/register` still uses a case-sensitive comparison
  (`SELECT id FROM users WHERE email = ?`). The `users.email` column is
  not normalised on insert (`src/routes/auth.js:14–16`).

  Concrete attack: an attacker registers `victim@example.com`. Later the
  legitimate user attempts to register and types `Victim@example.com` —
  the duplicate check passes (different bytes), and a second row is
  inserted with the same logical address. On `/login` with
  `victim@example.com`, the query
  `SELECT * FROM users WHERE LOWER(email) = LOWER(?)` returns the
  *first* matching row via better-sqlite3's `.get()` — which, depending
  on row order, may be the attacker's row. The attacker's password then
  authenticates as the legitimate identity.

  Even without takeover intent, this produces non-deterministic login
  results for users whose email differs only in case from another row.
- **Suggested remediation:** Normalise email at write time
  (e.g. `email.toLowerCase()` before the existence check and before
  `INSERT`), and/or add a `UNIQUE` index on `LOWER(email)` to the
  `users` table so the database enforces a single canonical row per
  address. Apply the same normalisation in `/login` (`email.toLowerCase()`
  on input) so the SQL `LOWER(?)` is not the only line of defence.

### F2 — Hardcoded HMAC secret (CRITICAL)

- **Location:** `src/auth.js:4` — `const SECRET = 'hw4-super-secret-key';`
- **Description:** The HMAC key used by `signToken` (`src/auth.js:17`)
  and `verifyToken` (`src/auth.js:24`) is a compile-time string baked
  into the repository. Anyone with read access to the source can mint
  arbitrary tokens for any `{ id, email }` payload and authenticate as
  any user via the `Bearer` header parsed in
  `requireAuth` (`src/auth.js:30–37`). This is acknowledged by the
  in-source `SEC-2` comment but unaddressed.
- **Suggested remediation:** Load the secret from `process.env.AUTH_SECRET`
  at module load, fail closed if unset, and rotate the leaked value out
  of git history.

### F3 — Plaintext password storage (CRITICAL)

- **Location:** `src/auth.js:7–9` (`hashPassword` returns its input);
  consumed at `src/routes/auth.js:16` during `/register`.
- **Description:** `hashPassword(plain) { return plain; }` stores the
  user-supplied password verbatim in `users.password`. A database leak
  or any read of `SELECT *` (which `/login` performs at
  `src/routes/auth.js:25`) discloses credentials in clear. Acknowledged
  by the in-source `SEC-2` comment but unaddressed.
- **Suggested remediation:** Use `crypto.scrypt` (or argon2/bcrypt) with
  a per-user random salt; store `salt$hash`. Update `verifyPassword`
  accordingly.

### F4 — Non-constant-time password comparison (MEDIUM)

- **Location:** `src/auth.js:11–13` — `verifyPassword` uses `===`.
- **Description:** Called from `src/routes/auth.js:26` on each login.
  String `===` short-circuits on the first differing byte; in
  principle this leaks password bytes via response-time side channel.
  Practical exploitability over the network is reduced but not zero,
  and the right primitive is free.
- **Suggested remediation:** Switch to a hashed comparison once F3 is
  fixed; until then, use `crypto.timingSafeEqual` on equal-length
  buffers.

### F5 — Non-constant-time HMAC signature comparison (MEDIUM)

- **Location:** `src/auth.js:25` — `if (sig !== expected) return null;`
- **Description:** Token verification compares the supplied signature
  to the recomputed one with `!==`. This is the textbook timing-side-channel
  for HMAC forgery. Combined with F2 the practical risk is already
  CRITICAL; once F2 is fixed, this finding becomes the residual risk.
- **Suggested remediation:** Use `crypto.timingSafeEqual(
  Buffer.from(sig), Buffer.from(expected))` and gate on equal length.

### F6 — Missing input type validation on `/login` and `/register` (LOW)

- **Location:** `src/routes/auth.js:8`, `src/routes/auth.js:21`
- **Description:** `email` and `password` are destructured from
  `req.body` and forwarded to `better-sqlite3` and the password
  primitives without type checks. The SQL itself is parameterised
  (no injection), but a non-string `email` (e.g. `{ "$ne": null }`-style
  JSON object from a permissive client) is silently coerced by SQLite's
  bind layer and may produce surprising matches or runtime errors.
  Passing a non-string `password` to `verifyPassword` (F4) compares by
  identity and always fails — denial of service for that user is not
  the concern, but inconsistent error semantics is.
- **Suggested remediation:** Reject requests where `typeof email !== 'string'`
  or `typeof password !== 'string'` with `400`.

### F7 — `SELECT *` exposes password hash to application memory (INFO)

- **Location:** `src/routes/auth.js:25`
- **Description:** The query selects all columns including `password`.
  The value is only used by `verifyPassword` and not serialised in the
  response, so this is informational rather than a leak — but selecting
  only the needed columns (`id`, `email`, `password`) is a defence-in-depth
  habit, and avoids accidentally leaking future sensitive columns added
  to `users`.
- **Suggested remediation:** Replace `SELECT *` with an explicit column
  list.

### F8 — `LOWER(?)` is ASCII-only in SQLite (INFO)

- **Location:** `src/routes/auth.js:25`
- **Description:** SQLite's built-in `LOWER()` only folds ASCII A–Z.
  Emails with non-ASCII local parts (e.g. IDN, or any Unicode-cased
  characters) will not be matched case-insensitively, partially
  re-introducing BUG-2 for those users. Not a security vulnerability
  per se, but a correctness gap with security implications if combined
  with F1 (an attacker can register a near-duplicate non-ASCII variant).
- **Suggested remediation:** Normalise email in application code
  (`email.toLowerCase()`, optionally with `String.prototype.normalize('NFC')`)
  before the SQL bind, and store the normalised form on register.

## No-Issue Areas

- `src/routes/auth.js:14–17` — the `INSERT` uses parameterised binds;
  no SQL injection.
- `src/routes/auth.js:25` (the BUG-2 change itself) — the SQL is
  parameterised via `?`; the addition of `LOWER(?)` does not introduce
  any string concatenation and does not create an injection sink.
- `src/auth.js:15–19` (`signToken`) — payload is base64url-encoded and
  HMAC'd; no injection or unsafe deserialisation in the signing path
  itself (the secret-management issue is reported as F2).
- `src/auth.js:30–37` (`requireAuth`) — the `Bearer` header parsing is
  bounded and does not interpolate user input into queries.

## References

- `src/routes/auth.js:8` — `/register` body destructure (F6)
- `src/routes/auth.js:12` — case-sensitive duplicate check (F1)
- `src/routes/auth.js:14–17` — `INSERT` of unnormalised email + plaintext password (F1, F3)
- `src/routes/auth.js:16` — call to `hashPassword` (F3)
- `src/routes/auth.js:21` — `/login` body destructure (F6)
- `src/routes/auth.js:25` — changed line under review (F1, F7, F8)
- `src/routes/auth.js:26` — call to `verifyPassword` (F4)
- `src/auth.js:4` — hardcoded `SECRET` (F2)
- `src/auth.js:7–9` — `hashPassword` returning plaintext (F3)
- `src/auth.js:11–13` — `verifyPassword` using `===` (F4)
- `src/auth.js:17` — `signToken` HMAC using `SECRET` (F2)
- `src/auth.js:24` — `verifyToken` HMAC recomputation (F2)
- `src/auth.js:25` — `sig !== expected` non-constant-time compare (F5)
- `src/auth.js:30–37` — `requireAuth` Bearer parsing (referenced in F2)
