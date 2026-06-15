# BUG-2 — Fix Summary

## Changes Made

### `src/routes/auth.js` — login handler (lines 25–26)

**Location:** `src/routes/auth.js`, lines 25–26

**Before:**
```js
    // BUG-2: case-sensitive email lookup. Intended fix: lower-case both sides.
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
```

**After:**
```js
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
```

**Test Result After Change:**
```
✔ POST /auth/register creates a user and returns 201
✔ POST /auth/register requires email, password and name
✔ POST /auth/register rejects duplicate email with 409
✔ POST /auth/login returns a token for valid credentials
✔ POST /auth/login rejects wrong password with 401
✔ POST /auth/login matches email case-insensitively (BUG-2 — expected red)

ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ duration_ms 135.543917
```

## Overall Status

**PASS** — All 6 tests pass, including:
- The control test `"POST /auth/login returns a token for valid credentials"` (line 35–41 in test file) continues to pass
- The BUG-2 test `"POST /auth/login matches email case-insensitively"` now passes
- Register endpoint duplicate-check (line 12) behaviour unchanged, as required

## Manual Verification

Run the auth routes test suite:
```bash
npx node --test tests/auth.routes.test.js
```

Expected output: all 6 tests pass with 0 failures.

## References

- Implementation plan: `context/bugs/BUG-2/implementation-plan.md`
- Bug context: `context/bugs/BUG-2/bug-context.md`
- Verified research: `context/bugs/BUG-2/research/verified-research.md`

The fix implements case-insensitive email comparison in the login handler by applying the SQL `LOWER()` function to both sides of the WHERE clause, allowing users registered with mixed-case emails (e.g., `Carol@example.com`) to log in with any casing variation (e.g., `carol@example.com`).
