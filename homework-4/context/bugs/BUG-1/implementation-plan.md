# BUG-1 Implementation Plan

## Goal

Fix `GET /users` to apply a default limit of 10 and use the offset value as-is (no `+ 1`).

## Affected Files

- `src/routes/users.js`

## Changes

### `src/routes/users.js`

**before**
```js
    const limit = parseInt(req.query.limit, 10);
    // BUG-1(b): offset is off by one (adds 1 unconditionally).
    // Intended fix: use offset as-is.
    const offset = (parseInt(req.query.offset, 10) || 0) + 1;
    const rows = db.prepare('SELECT id, email, name FROM users ORDER BY id LIMIT ? OFFSET ?')
      .all(Number.isNaN(limit) ? -1 : limit, offset);
```

**after**
```js
    const limit = parseInt(req.query.limit, 10) || 10;
    // BUG-1(b): offset is off by one (adds 1 unconditionally).
    // Intended fix: use offset as-is.
    const offset = parseInt(req.query.offset, 10) || 0;
    const rows = db.prepare('SELECT id, email, name FROM users ORDER BY id LIMIT ? OFFSET ?')
      .all(limit, offset);
```

## Verification Command

```
npx node --test tests/users.routes.test.js
```

## Invariants

- All currently-passing tests in `tests/users.routes.test.js` must remain green.
- `GET /users/:id` behaviour is unchanged (different route handler, not touched).
- `GET /users/search` behaviour is unchanged (different route handler, not touched).
- The fix is limited to lines 22 and 25 of `src/routes/users.js`; no other files are modified.
