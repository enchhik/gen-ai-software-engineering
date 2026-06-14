# BUG-1 Fix Summary

## Changes Made

### `src/routes/users.js`

**Location:** Lines 18–29 (GET `/` route handler)

**Before:**
```js
  r.get('/', (req, res) => {
    // BUG-1(a): default limit is not applied; isNaN(limit) → -1 means
    // "no limit" in SQLite, so the endpoint returns every row.
    // Intended fix: default to 10.
    const limit = parseInt(req.query.limit, 10);
    // BUG-1(b): offset is off by one (adds 1 unconditionally).
    // Intended fix: use offset as-is.
    const offset = (parseInt(req.query.offset, 10) || 0) + 1;
    const rows = db.prepare('SELECT id, email, name FROM users ORDER BY id LIMIT ? OFFSET ?')
      .all(Number.isNaN(limit) ? -1 : limit, offset);
    res.json(rows);
  });
```

**After:**
```js
  r.get('/', (req, res) => {
    // BUG-1(a): default limit is not applied; isNaN(limit) → -1 means
    // "no limit" in SQLite, so the endpoint returns every row.
    // Intended fix: default to 10.
    const limit = parseInt(req.query.limit, 10) || 10;
    // BUG-1(b): offset is off by one (adds 1 unconditionally).
    // Intended fix: use offset as-is.
    const offset = parseInt(req.query.offset, 10) || 0;
    const rows = db.prepare('SELECT id, email, name FROM users ORDER BY id LIMIT ? OFFSET ?')
      .all(limit, offset);
    res.json(rows);
  });
```

**Details:**
- Line 22: Added default limit of 10 using `|| 10` fallback
- Line 25: Removed the `+ 1` offset bug, now uses offset as-is
- Line 27: Simplified the `.all()` call to pass `limit` directly instead of `Number.isNaN(limit) ? -1 : limit`

**Test result after this change:**
```
✔ tests 7
✔ pass 7
✔ fail 0
duration_ms 140.9425
```

## Overall Status

**PASS**

All tests pass, including the two previously-failing tests:
- ✔ GET /users applies a default limit of 10 (BUG-1 — expected red)
- ✔ GET /users honours offset correctly (BUG-1 — expected red)

Full test suite: 32 tests passing, 0 failing.

## Manual Verification

Run the specific test file:
```bash
npx node --test tests/users.routes.test.js
```

Expected output: all 7 tests pass.

Run the full test suite:
```bash
npm test
```

Expected output: all 32 tests pass.

## References

- Implementation plan: `context/bugs/BUG-1/implementation-plan.md`
- Bug context: `context/bugs/BUG-1/bug-context.md`
