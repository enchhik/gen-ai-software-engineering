# SEC-1 — Fix Summary

## Changes Made

### `src/routes/users.js` — lines 8–15

**Location:** `GET /users/search` endpoint

**Before:**
```js
  r.get('/search', (req, res) => {
    const q = String(req.query.q || '');
    // SEC-1: SQL injection via string concatenation.
    // Intended fix: parameterized LIKE with bound parameters.
    const sql = `SELECT id, email, name FROM users
                 WHERE name LIKE '%${q}%' OR email LIKE '%${q}%'`;
    const rows = db.prepare(sql).all();
    res.json(rows);
  });
```

**After:**
```js
  r.get('/search', (req, res) => {
    const q = String(req.query.q || '');
    const pattern = `%${q}%`;
    const rows = db.prepare(
      'SELECT id, email, name FROM users WHERE name LIKE ? OR email LIKE ?'
    ).all(pattern, pattern);
    res.json(rows);
  });
```

**Test Result After Change:**
```
✔ All 36 tests pass
ℹ pass 36
ℹ fail 0
```

## Overall Status

**PASS** — The fix successfully closes the SQL injection vulnerability without breaking any existing functionality.

## Manual Verification

To verify the fix:

```bash
cd homework-4
npm test
```

Expected output: All 36 tests pass with no failures.

The critical tests verifying the search endpoint still works correctly:
- ✔ GET /users/search?q=alice returns the Alice row
- ✔ GET /users/search?q=example returns multiple rows

## References

- Implementation Plan: `context/bugs/SEC-1/implementation-plan.md`
- Bug Context: `context/bugs/SEC-1/bug-context.md`

### Key Fix Details

The vulnerability was a **SQL injection** via string concatenation in the `GET /users/search` endpoint. The user-supplied query parameter `q` was directly embedded into a SQL template literal, allowing an attacker to inject arbitrary SQL code.

**The fix:**
- Replaced the template-literal SQL string with a parameterized query using `?` placeholders
- Moved the pattern construction (`%${q}%`) outside the SQL statement, ensuring it is treated as data
- Passed the pattern as a bound parameter to `.all()`, which safely escapes and treats it as a literal string value
- Removed the SEC-1 comment lines that documented the vulnerability (no longer needed after fix)

This ensures that the user input is **always treated as data**, never as SQL code, thus preventing SQL injection attacks.
