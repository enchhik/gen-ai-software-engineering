# SEC-1 — Implementation Plan

## Goal

Replace the template-literal SQL string in `GET /users/search` with a parameterised query so that the `q` input is always treated as data, never as SQL.

## Affected Files

- `src/routes/users.js`

## Changes

### `src/routes/users.js` — lines 8–16

**before**
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

**after**
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

## Verification Command

```bash
cd homework-4 && npm test
```

All 36 existing tests must remain green. No new tests are required by this plan (the audit note only requires closing the injection weakness; adversarial-input coverage is out of scope for the fix itself).

## Invariants

- Benign searches (`q=alice`, `q=example`) must continue to return the same rows as before.
- The endpoint must still require a valid JWT (`r.use(requireAuth)` on line 6 is untouched).
- `GET /users/` and `GET /users/:id` must be unaffected.
- The two-line SEC-1 marker comment is removed as part of the fix (it documented the vulnerability, not the code).
