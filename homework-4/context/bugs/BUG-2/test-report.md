# BUG-2 — Test Report

## Tests Added

### `tests/auth.routes.test.js` — Case-insensitive email matching

1. **Line 53–59: "POST /auth/login matches email case-insensitively (BUG-2 — expected red)"**
   - **F — Fast:** Uses in-memory database (`createDb(':memory:')`), runs in <100ms
   - **I — Independent:** Creates fresh app and uses seeded data, no shared state with other tests
   - **R — Repeatable:** No randomness, deterministic seed data, same input → same output every run
   - **S — Self-validating:** Asserts `res.status === 200` and `res.body.token` is truthy
   - **T — Timely:** Written to test the fixed login handler immediately after BUG-2 fix

2. **Line 61–67: "POST /auth/login matches email case-insensitively with uppercase"**
   - **F — Fast:** In-memory database, <100ms
   - **I — Independent:** Creates fresh app, isolated test
   - **R — Repeatable:** All-uppercase `CAROL@EXAMPLE.COM` consistently matches seeded `Carol@example.com`
   - **S — Self-validating:** Asserts `res.status === 200` and token present
   - **T — Timely:** Tests uppercase variation of case-insensitive fix

3. **Line 69–75: "POST /auth/login matches email case-insensitively with all-uppercase registered"**
   - **F — Fast:** In-memory database, <100ms
   - **I — Independent:** Creates fresh app, isolated test
   - **R — Repeatable:** Mixed case `Alice@Example.Com` consistently matches seeded `alice@example.com`
   - **S — Self-validating:** Asserts `res.status === 200` and token present
   - **T — Timely:** Tests another case variation of the fix

4. **Line 77–83: "POST /auth/login matches email with mixed case variations"**
   - **F — Fast:** In-memory database, <100ms
   - **I — Independent:** Creates fresh app, isolated test
   - **R — Repeatable:** Heavily mixed case `FrAnK@eXaMpLe.CoM` consistently matches seeded `frank@example.com`
   - **S — Self-validating:** Asserts `res.status === 200` and token present
   - **T — Timely:** Tests extreme case variation to pin case-insensitive behavior

## Test Run Result

```
✔ POST /auth/login matches email case-insensitively (BUG-2 — expected red) (2.128709ms)
✔ POST /auth/login matches email case-insensitively with uppercase (1.201167ms)
✔ POST /auth/login matches email case-insensitively with all-uppercase registered (1.067916ms)
✔ POST /auth/login matches email with mixed case variations (1.073625ms)

ℹ tests 36 (total, all tests)
ℹ pass 36
ℹ fail 0
ℹ duration_ms 139.272333

Exit code: 0 (all tests passing, including BUG-2 tests)
```

## Coverage Rationale

The fix changed `src/routes/auth.js` line 25 from:
```js
const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
```

To:
```js
const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
```

This change enables case-insensitive email matching in the login handler by applying `LOWER()` to both the stored email and the input email parameter.

### Test Coverage

- **Line 25 (WHERE clause change):**
  - **Test 1 (Line 53–59)** covers: Seeded user `Carol@example.com` matched by input `carol@example.com`
  - **Test 2 (Line 61–67)** covers: Seeded user `Carol@example.com` matched by input `CAROL@EXAMPLE.COM` (full uppercase)
  - **Test 3 (Line 69–75)** covers: Seeded user `alice@example.com` matched by input `Alice@Example.Com` (mixed case of lowercase user)
  - **Test 4 (Line 77–83)** covers: Seeded user `frank@example.com` matched by input `FrAnK@eXaMpLe.CoM` (extreme case variation)

Each test confirms that the `LOWER()` function allows the database lookup to succeed regardless of email casing, making the login endpoint properly case-insensitive while the database stores the original casing.

The fix is isolated to the login handler (lines 20–30). Register handler (line 12) remains unchanged, maintaining case-sensitive duplicate email detection as intended.

### Summary

All BUG-2 tests pass consistently, confirming that the case-insensitive email fix in `src/routes/auth.js:25` is working correctly across a comprehensive range of case variations.
