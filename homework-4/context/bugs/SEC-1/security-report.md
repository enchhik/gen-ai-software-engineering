# SEC-1 — Security Report

## Scope

Files scanned in full:

- `src/routes/users.js` (lines 1–38) — the file changed by the SEC-1 fix
- `src/auth.js` (lines 1–37) — imported by `users.js` via `requireAuth`

Diff under review: `git diff HEAD -- src/routes/users.js` (replaces a
string-concatenated `LIKE` with a parameterised query using `?`
placeholders bound through `better-sqlite3`'s `.all(pattern, pattern)`).

## Findings

### 1. `src/auth.js:4` — Hardcoded HMAC secret — **HIGH** *(pre-existing, out of SEC-1 scope)*

`const SECRET = 'hw4-super-secret-key';` is baked into the source tree
and used to sign and verify auth tokens (lines 17, 24). Any attacker who
reads the repository can forge a valid bearer token and bypass
`requireAuth`, which is the only gate protecting `/users/search`
(`src/routes/users.js:6`). The committed `SEC-2` comment confirms the
intended remediation: load the secret from `process.env.AUTH_SECRET`
(fail fast if unset).

**Attack input:** any HTTP request to `/users/search` with
`Authorization: Bearer <forged-token>` where the token is signed locally
using the literal string `hw4-super-secret-key`.

**Remediation:** read the secret from an environment variable; refuse to
start if it is missing or shorter than 32 bytes.

### 2. `src/auth.js:7-13` — Plaintext password storage / comparison — **HIGH** *(pre-existing, out of SEC-1 scope)*

`hashPassword` returns the plaintext unchanged and `verifyPassword` does
a direct `===` comparison. Stored credentials are therefore plaintext,
and the comparison is additionally vulnerable to timing analysis. The
existing `SEC-2` comment names the intended fix
(`crypto.scrypt`-based hashing).

**Attack input:** any read of the user store (backup, SQL injection in a
sibling endpoint, ops access) yields usable credentials directly.

**Remediation:** hash with `crypto.scrypt` (or `argon2`) and a per-user
salt; compare with `crypto.timingSafeEqual` over the derived bytes.

### 3. `src/auth.js:25` — Non-constant-time signature comparison — **MEDIUM** *(pre-existing, out of SEC-1 scope)*

`if (sig !== expected) return null;` compares the HMAC tag with `!==`,
which short-circuits on the first differing byte. In principle this
exposes a timing oracle on the token signature. The exposure is
dominated by Finding 1 (the secret is already public), but the
construct should still use `crypto.timingSafeEqual` on equal-length
buffers.

**Remediation:** compare HMAC digests with `crypto.timingSafeEqual`
after verifying both buffers have the same length.

## No-Issue Areas

- `src/routes/users.js` after the SEC-1 fix — the `GET /users/search`
  handler (lines 8–15) now binds the user-controlled `q` exclusively as
  a `LIKE` parameter:

  ```js
  const q = String(req.query.q || '');
  const pattern = `%${q}%`;
  const rows = db.prepare(
    'SELECT id, email, name FROM users WHERE name LIKE ? OR email LIKE ?'
  ).all(pattern, pattern);
  ```

  The `String(...)` coercion neutralises non-string `req.query.q` shapes
  (arrays/objects from duplicated query keys). `better-sqlite3` binds
  `?` placeholders as parameters, so SQL metacharacters and `LIKE`
  wildcards (`%`, `_`, `\`) inside `q` are treated purely as literal
  data, not as SQL or pattern syntax — they can only widen the match
  for the requesting user, not exfiltrate other tables or alter the
  statement. No string concatenation, no `eval`, no path/command
  construction, no HTML rendering, no secret material, and no
  unbounded dependency calls remain in this handler.
- `GET /users/` (lines 17–28) and `GET /users/:id` (lines 30–35) already
  use parameterised queries and integer coercion; the SEC-1 change does
  not regress them. Pre-existing comments document unrelated
  pagination bugs (`BUG-1`) that are functional, not security, defects.

## References

- `src/routes/users.js:6` — `r.use(requireAuth);`
- `src/routes/users.js:8-15` — fixed `GET /users/search` handler
- `src/routes/users.js:17-28` — `GET /users/` (parameterised, no new issue)
- `src/routes/users.js:30-35` — `GET /users/:id` (parameterised, no new issue)
- `src/auth.js:4` — hardcoded `SECRET`
- `src/auth.js:7-13` — `hashPassword` / `verifyPassword` plaintext
- `src/auth.js:17,24` — HMAC signing/verification using the hardcoded secret
- `src/auth.js:25` — non-constant-time signature comparison
- `src/auth.js:30-37` — `requireAuth` middleware mounted on the users router
- `context/bugs/SEC-1/fix-summary.md` — fix description under review
