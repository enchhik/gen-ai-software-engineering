# SEC-2 — Verified Research

## 1. Verification Summary

**Result:** PASS — **EXCELLENT**.

Every file:line reference and code snippet in
`codebase-research.md` was located in the source and matches verbatim.
The named root cause — (A) hardcoded HMAC secret and (B) plaintext
password storage via a no-op `hashPassword` — fully explains the audit
finding. The compatibility note about the invariant test
`POST /auth/login returns a token for valid credentials` is consistent
with the seed and route code.

---

## 2. Verified Claims

- **`src/auth.js:4`** — `const SECRET = 'hw4-super-secret-key';`
  preceded by the comment
  `// SEC-2: hardcoded secret. Intended fix: read from process.env.AUTH_SECRET.`
  Confirmed verbatim.
- **`src/auth.js:7–9`** — `hashPassword(plain)` returns `plain`
  unchanged, preceded by the SEC-2 plaintext comment. Confirmed verbatim.
- **`src/auth.js:11–13`** — `verifyPassword(plain, stored)` performs
  strict `plain === stored` equality. Confirmed verbatim.
- **`src/auth.js:17`** — `signToken` computes
  `crypto.createHmac('sha256', SECRET).update(body).digest('base64url')`.
  Confirmed verbatim.
- **`src/auth.js:24`** — `verifyToken` computes the same HMAC with the
  same `SECRET`. Confirmed verbatim.
- **`src/routes/auth.js:16`** — Registration stores
  `hashPassword(password)` via the INSERT statement. Confirmed
  verbatim.
- **`src/routes/auth.js:26`** — Login calls
  `verifyPassword(password, user.password)`. Confirmed verbatim.
- **`src/db.js:4–17`** — Seed array contains plaintext passwords
  (`'alice-pass'`, `'bob-pass'`, … `'oscar-pass'`). Confirmed verbatim.
- **`src/db.js:34`** — `insert.run(email, name, hashPassword(plain));`.
  Confirmed verbatim.
- **`tests/auth.routes.test.js:35–41`** — Invariant test logs in with
  `alice@example.com` / `alice-pass` and asserts `res.status === 200`
  with a non-empty token. Confirmed verbatim.
- **`tests/auth.helpers.test.js:5–8`** — Round-trip test
  `verifyPassword(hashPassword('pw123'))` returns `true`. Confirmed
  verbatim.

---

## 3. Discrepancies Found

None. All quoted snippets and line numbers match the source exactly.

---

## 4. Research Quality Assessment

**Label: EXCELLENT.**

Criteria met:
- Every file:line reference is correct (10/10 verified locations).
- Every code snippet matches source verbatim, including the SEC-2
  marker comments.
- The two named weaknesses (hardcoded HMAC secret, plaintext password
  storage) fully account for the audit finding; no speculation remains.
- The open questions (salt encoding within the existing `TEXT` column,
  env-var handling for `AUTH_SECRET`, seed re-hash on cold start) are
  scoped as planner decisions, not unverified claims.
- The invariant test path is correctly identified, and the reasoning
  that the seed re-runs `hashPassword(plain)` on the in-memory DB
  preserves the round-trip is correct.

Nothing was downgraded to GOOD or below: no whitespace drift, no
missing references, no semantic gaps.

---

## 5. References

- `src/auth.js:1–37`
- `src/routes/auth.js:1–33`
- `src/db.js:1–40`
- `tests/auth.routes.test.js:1–83`
- `tests/auth.helpers.test.js:1–26`
- `context/bugs/SEC-2/bug-context.md`
- `context/bugs/SEC-2/research/codebase-research.md`
