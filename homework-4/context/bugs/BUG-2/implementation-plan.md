# BUG-2 — Implementation Plan

## 1. Goal

Fix the login handler so that email comparison is case-insensitive by lower-casing the incoming email on both the SQL side and the stored side.

## 2. Affected Files

- `src/routes/auth.js`

## 3. Changes

### `src/routes/auth.js` — login handler (lines 25–26)

**before**
```js
    // BUG-2: case-sensitive email lookup. Intended fix: lower-case both sides.
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
```

**after**
```js
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
```

## 4. Verification Command

```
npx node --test tests/auth.routes.test.js
```

## 5. Invariants

- The existing control login test (`"POST /auth/login returns a JWT for valid credentials"`, lines 35–41) for `alice@example.com` must continue to pass.
- The register endpoint duplicate-check (`src/routes/auth.js:12`) is out of scope for this bug; its behaviour must not change.
- No new files are created; no other test files are modified.
