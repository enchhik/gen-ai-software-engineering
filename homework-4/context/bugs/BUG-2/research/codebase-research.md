# BUG-2 — Codebase Research

## 1. Symptom Restated

The test "POST /auth/login matches email case-insensitively" registers (via seed) a user
with the email `Carol@example.com` (capital C) and then attempts to log in using the
all-lowercase variant `carol@example.com`. The server returns HTTP 401 (invalid
credentials) instead of the expected HTTP 200 with a JWT token. The root problem is that
the login handler performs a byte-for-byte SQL equality comparison that distinguishes
`C` from `c`, so the seeded row is never found when the client supplies a lowercased
email.

## 2. Reproduction

```bash
# From homework-4/
npm test
```

Observed output (relevant excerpt):
```
✖ POST /auth/login matches email case-insensitively (BUG-2 — expected red)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  401 !== 200
```

Expected: HTTP 200 with `{ token: "<jwt>" }`.

To run only this test:
```bash
node --test --test-name-pattern="BUG-2" tests/auth.routes.test.js
```

## 3. Likely Cause

**File:** `src/routes/auth.js`, **line 26**

```js
const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
```

The SQL `=` operator in SQLite compares TEXT values using the default `BINARY` collation,
which is case-sensitive. When the client sends `carol@example.com` but the stored value
is `Carol@example.com`, the equality check fails and `user` is `undefined`, causing the
401 response at line 27.

The comment in the source confirms the intent:
```js
// BUG-2: case-sensitive email lookup. Intended fix: lower-case both sides.
```

## 4. Supporting Evidence

| Location | Evidence |
|---|---|
| `src/db.js:7` | Seed row is `['Carol@example.com', 'Carol', 'carol-pass']` — stored with a capital C |
| `src/routes/auth.js:26` | Login query uses plain `=`, no `LOWER()` or `COLLATE NOCASE` |
| `src/routes/auth.js:12` | Register query also uses plain `=` for duplicate detection — not part of this bug but same pattern |
| `tests/auth.routes.test.js:53-59` | Test sends `carol@example.com` (lowercase), expects 200; gets 401 |
| `tests/auth.routes.test.js:35-41` | Control test for `alice@example.com` passes — consistent casing, so the issue is invisible there |

SQLite documentation confirms that `TEXT = TEXT` uses the column's collation sequence,
defaulting to `BINARY` (i.e., case-sensitive for ASCII letters).

## 5. Open Questions

- **Should email be normalised on registration too?** The register handler at
  `src/routes/auth.js:12` stores the email exactly as supplied (e.g., `Carol@example.com`).
  A more robust fix would also lowercase the email at insert time, so the stored form is
  always canonical. The bug description only covers login, but this should be evaluated.
- **Duplicate detection on register** — `src/routes/auth.js:12` uses case-sensitive `=`
  as well; `Carol@example.com` and `carol@example.com` would both be accepted as
  separate accounts, which is likely unintended.
- **Collation vs. application-level lowercasing** — the fix could be either
  `WHERE LOWER(email) = LOWER(?)` in SQL, or normalising email to lowercase before
  storing (and querying). Both fix the symptom; the correct long-term approach is not
  specified in the bug report.
