# SEC-2 — Codebase Research

## 1. Symptom Restated

A manual security audit flagged two weaknesses in the authentication module
(`src/auth.js`): (1) the HMAC signing secret used to issue and verify tokens
is hardcoded as a string literal in source code, making it impossible to
rotate without a code deploy and exposing it to anyone who can read the
repository; (2) the `hashPassword` function is a no-op that stores user
passwords as plaintext in the database, meaning a database dump immediately
reveals every user's credentials.

---

## 2. Reproduction

All tests currently pass — neither weakness surfaces as a test failure; they
are design-level vulnerabilities confirmed by code inspection.

```bash
# Run the full suite to confirm baseline (all 42 pass)
npm test
```

**Observed:** 42 pass, 0 fail.  
**Expected for a security-correct implementation:** the hardcoded secret
should be replaced by an environment variable, and `hashPassword` should
produce a one-way hash (e.g. via `crypto.scrypt`) rather than returning the
plaintext.

---

## 3. Likely Cause

### Weakness A — Hardcoded HMAC secret

**File:** `src/auth.js:4`

```js
// SEC-2: hardcoded secret. Intended fix: read from process.env.AUTH_SECRET.
const SECRET = 'hw4-super-secret-key';
```

The constant `SECRET` is used in both `signToken` (line 17) and `verifyToken`
(line 24) to compute the HMAC-SHA256 signature:

```js
const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
```

Because the value is a literal embedded in source, any party with read access
to the repository can forge valid tokens without ever touching the server.

---

### Weakness B — Plaintext password storage

**File:** `src/auth.js:7–9`

```js
// SEC-2: plaintext storage. Intended fix: crypto.scrypt-based hashing.
export function hashPassword(plain) {
  return plain;
}
```

`hashPassword` simply returns its argument unchanged. `verifyPassword` (lines
11–13) performs a strict equality check:

```js
export function verifyPassword(plain, stored) {
  return plain === stored;
}
```

Because `hashPassword` is called at registration time (`src/routes/auth.js:16`)
and at seed time (`src/db.js:34`), every password in the database is stored
verbatim.

---

## 4. Supporting Evidence

| Location | Relevance |
|---|---|
| `src/routes/auth.js:16` | Registration stores `hashPassword(password)` — currently the plaintext value |
| `src/routes/auth.js:26` | Login calls `verifyPassword(password, user.password)` — passes because stored == plain |
| `src/db.js:4–17` | Seed array contains plaintext passwords (`'alice-pass'`, etc.) passed through `hashPassword(plain)` |
| `src/db.js:34` | `insert.run(email, name, hashPassword(plain))` — seeds plaintext into the DB |
| `src/auth.js:17` | `signToken` uses the hardcoded `SECRET` for HMAC signing |
| `src/auth.js:24` | `verifyToken` uses the same `SECRET`; a leaked secret enables token forgery |
| `tests/auth.routes.test.js:35–41` | Invariant test — logs in with `alice@example.com` / `alice-pass`; must remain green after the fix |
| `tests/auth.helpers.test.js:5–8` | `verifyPassword` round-trip test; exercises `hashPassword` + `verifyPassword` together |

---

## 5. Open Questions

1. **Salt storage for scrypt:** The intended fix uses `crypto.scrypt`. If a
   random salt is generated per password, it must be persisted alongside the
   hash (commonly as `<salt>:<hash>`). The `password` column in the `users`
   table is `TEXT NOT NULL` — it can hold an arbitrary string, so no schema
   change is strictly required, but the Planner should confirm the chosen
   encoding.

2. **Seeded data compatibility:** After the fix, the seed (`src/db.js`)
   continues to call `hashPassword(plain)`, so seeded passwords will be
   re-hashed on the next cold start. Because tests always use an in-memory
   `:memory:` database that is seeded fresh, the invariant test
   (`alice@example.com` / `alice-pass`) will keep passing as long as
   `hashPassword` and `verifyPassword` remain consistent with each other.

3. **Environment variable availability in CI/tests:** If `SECRET` is moved to
   `process.env.AUTH_SECRET`, the test environment must either set that
   variable or the code must provide a safe fallback (e.g. throw at startup if
   the variable is absent). The Planner should decide which approach is
   appropriate.
