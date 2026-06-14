# SEC-2 Security Verification Report

## 1. Scope

Files scanned (post-fix state on branch `homework-4-submission`):

- `src/auth.js` (lines 1–39) — primary fix target
- `src/db.js` (lines 1–40) — seeding consumes `hashPassword`
- `src/routes/auth.js` (lines 1–33) — login/register consume `verifyPassword`, `signToken`
- `src/routes/users.js` (lines 1–38) — consumes `requireAuth` / `verifyToken`
- `src/app.js` (lines 1–11) — wiring only

The fix-summary changes in `src/auth.js` (hardcoded SECRET → env fallback,
no-op hash → scrypt+salt, plaintext compare → scrypt + `timingSafeEqual`)
were confirmed in source.

---

## 2. Findings

### F-1. Hardcoded fallback secret still shipped — HIGH

- **Location:** `src/auth.js:3`
- **Code:** `const SECRET = process.env.AUTH_SECRET || 'hw4-super-secret-key';`
- **Description:** The fix moved the secret to an environment variable but
  retains the original hardcoded string as a fallback. The string
  `'hw4-super-secret-key'` is now committed to git history (and visible in
  `context/bugs/SEC-2/fix-summary.md:19`). An attacker who deploys the app
  without setting `AUTH_SECRET` (default behaviour, e.g. local/dev/CI, or a
  forgotten production env var) silently signs HMAC tokens with a publicly
  known key. They can then forge `signToken({ id: <anyone>, email: <anyone> })`
  and bypass `requireAuth` against any such deployment.
- **Attack input:** No request — the attacker computes
  `HMAC_SHA256('hw4-super-secret-key', base64url(JSON.stringify({id:1,email:'alice@example.com'})))`
  offline and sends it as `Authorization: Bearer <body>.<sig>`.
- **Remediation:** Remove the fallback. Fail fast at startup:
  `const SECRET = process.env.AUTH_SECRET; if (!SECRET) throw new Error('AUTH_SECRET is required');`.
  Rotate the previously-committed string out of any deployment that ever ran
  with the default.

### F-2. `verifyPassword` crashes on malformed stored hash (input validation) — MEDIUM

- **Location:** `src/auth.js:11–15`
- **Code:**
  ```js
  const [salt, hash] = stored.split(':');
  const derived = crypto.scryptSync(plain, salt, 64);
  return crypto.timingSafeEqual(derived, Buffer.from(hash, 'hex'));
  ```
- **Description:** No validation that `stored` matches the `salt:hash`
  format. If the DB row is empty, lacks `:`, or has a `hash` segment whose
  hex length ≠ 128 chars (64 bytes), the function throws:
  - `stored.split(':')` returning a single element makes `hash === undefined` →
    `Buffer.from(undefined, 'hex')` throws `TypeError`.
  - A short or odd-length `hash` yields a buffer whose length ≠ 64 →
    `crypto.timingSafeEqual` throws `RangeError: Input buffers must have the same byte length`.
  The exception escapes the route handler at `src/routes/auth.js:26`,
  producing a 500 instead of a 401 and giving an attacker an oracle for
  "user exists but record is malformed" vs "user does not exist". It also
  enables a denial-of-service on any account whose record gets corrupted.
- **Attack input:** `POST /auth/login {"email":"<account with bad hash>", "password":"x"}`.
- **Remediation:** Validate the parsed parts before comparing, e.g.:
  ```js
  if (typeof stored !== 'string') return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash || hash.length !== 128) return false;
  const derived = crypto.scryptSync(plain, salt, 64);
  const hashBuf = Buffer.from(hash, 'hex');
  if (hashBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, hashBuf);
  ```

### F-3. Non-constant-time HMAC signature comparison — MEDIUM

- **Location:** `src/auth.js:27`
- **Code:** `if (sig !== expected) return null;`
- **Description:** The token signature is compared with `!==`, a
  short-circuit string equality that can leak timing information about the
  first mismatching byte of the HMAC. This is the same class of weakness
  the fix already addressed for the password comparison; it should be
  applied consistently to the token verifier.
- **Attack input:** Iterative `Authorization: Bearer <body>.<crafted-sig>`
  with timing measurement to recover `expected` byte-by-byte.
- **Remediation:** Use `crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))`
  after length-checking, or reuse `crypto.timingSafeEqual` on the raw
  buffers before base64url encoding.

### F-4. Tokens have no expiration — MEDIUM

- **Location:** `src/auth.js:17–21` (issuance), `src/auth.js:23–30` (verification),
  `src/routes/auth.js:29` (issuance call)
- **Description:** `signToken({ id, email })` produces a token whose payload
  contains no `exp`/`iat`, and `verifyToken` only checks the HMAC. A stolen
  token (logs, browser history, XSS in a future UI, intercepted in transit
  during development) is valid forever, and there is no rotation path short
  of rotating `AUTH_SECRET` (which invalidates every token). This compounds
  the impact of F-1.
- **Remediation:** Add `exp` (and ideally `iat`) when signing, e.g.
  `signToken({ id, email, exp: Math.floor(Date.now()/1000) + 3600 })`, and
  reject in `verifyToken` when `payload.exp` is missing or in the past.

### F-5. `users/search` LIKE pattern injection — LOW

- **Location:** `src/routes/users.js:9–14`
- **Code:** `const pattern = `%${q}%`;` ... `WHERE name LIKE ? OR email LIKE ?`
- **Description:** SQL parameters are used (no SQL injection), but `%` and
  `_` from `req.query.q` are not escaped. A caller can pass `q=%` to
  enumerate every user via the authenticated endpoint, or pass `_` to do
  single-character probing. This is informational unless the endpoint is
  rate-limited.
- **Remediation:** Escape LIKE metacharacters before wrapping, e.g.
  `q.replace(/[\\%_]/g, c => '\\' + c)` and `... LIKE ? ESCAPE '\\'`.

### F-6. No rate limiting on `/auth/login` — LOW

- **Location:** `src/routes/auth.js:20–30`
- **Description:** The login route has no throttling or lockout. Combined
  with the synchronous `scryptSync` in `verifyPassword`, this enables
  credential stuffing and a cheap CPU-exhaustion DoS (each failed attempt
  blocks the event loop for the scrypt cost).
- **Remediation:** Add per-IP / per-account rate limiting (e.g.
  `express-rate-limit`) and consider `crypto.scrypt` (async) to avoid
  blocking the event loop.

### F-7. Plaintext seed passwords committed to the repository — LOW

- **Location:** `src/db.js:4–17`
- **Description:** The hashing fix correctly hashes seeded passwords before
  insert, but the plaintext values for the seeded accounts (including
  `alice-pass`, used by the protected test invariant) live in the source
  tree. Anyone with read access to the repo knows valid credentials for
  every running instance that uses the default seed. The pipeline invariant
  pins `alice-pass`, so removing it is out of scope, but it should be
  documented as a dev-only fixture and not used in any non-test deployment.
- **Remediation:** Gate seeding on `NODE_ENV !== 'production'`, or load seed
  credentials from environment / a dev-only fixture file excluded from
  production builds.

### F-8. `SELECT *` exposes hashed password to handler scope — INFO

- **Location:** `src/routes/auth.js:25`
- **Description:** The login query selects `*`, pulling `user.password`
  (the hash) into request scope. It is not currently returned to the
  client, but a future refactor that JSON-serialises `user` would leak the
  hash. Preferable to select only the columns needed (`id, email, password`).
- **Remediation:** Narrow the SELECT list.

---

## 3. No-Issue Areas

- `src/app.js` (lines 1–11) — pure wiring, no untrusted input handled.
- `src/db.js:19–40` — DDL and seeding use parameterised `INSERT`, no
  injection surface beyond F-7 above.
- `src/routes/users.js:30–35` — `WHERE id = ?` is parameterised; SQLite
  coerces the string param safely.
- `src/auth.js:32–39` (`requireAuth`) — header parsing and 401 path are
  sound; downstream weakness is in `verifyToken` (F-3, F-4), not here.

---

## 4. References

- `src/auth.js:3` — F-1 hardcoded fallback secret
- `src/auth.js:11–15` — F-2 missing input validation in `verifyPassword`
- `src/auth.js:17–21` — F-4 token issuance lacks `exp`
- `src/auth.js:23–30` — F-3 non-constant-time `sig !== expected`
- `src/auth.js:32–39` — `requireAuth` (no-issue, listed for completeness)
- `src/db.js:4–17` — F-7 plaintext seed credentials
- `src/db.js:19–40` — DDL / seeding (no-issue beyond F-7)
- `src/routes/auth.js:20–30` — F-6 no rate limiting on login
- `src/routes/auth.js:25` — F-8 `SELECT *` exposes password hash to scope
- `src/routes/auth.js:26` — call site that surfaces F-2 as a 500
- `src/routes/auth.js:29` — call site that surfaces F-4
- `src/routes/users.js:9–14` — F-5 LIKE pattern injection
- `src/routes/users.js:30–35` — parameterised lookup (no-issue)
- `src/app.js:1–11` — wiring (no-issue)
- `context/bugs/SEC-2/fix-summary.md:19` — published fallback secret string
- `context/bugs/SEC-2/bug-context.md:7–11` — invariant pinning `alice-pass`
