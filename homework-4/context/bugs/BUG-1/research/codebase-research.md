# BUG-1 Codebase Research

## Symptom Restated

The `GET /users` endpoint has two pagination defects. First, when no `limit`
query parameter is supplied the handler falls back to SQLite's sentinel value
`-1` (meaning "no limit"), so it returns all 12 seeded rows instead of the
intended default of 10. Second, when an `offset` is supplied the handler
unconditionally adds `1` to the parsed value, so `?offset=2` is executed as
`OFFSET 3`, shifting every page by one row and returning ids `[4, 5, 6]`
instead of the correct `[3, 4, 5]`.

## Reproduction

```bash
cd homework-4
npm test
```

**Observed:**

```
✖ GET /users applies a default limit of 10 (BUG-1 — expected red)
  AssertionError: 11 !== 10   (actual: 11 rows returned)

✖ GET /users honours offset correctly (BUG-1 — expected red)
  AssertionError: actual [ 4, 5, 6 ] expected [ 3, 4, 5 ]
```

**Expected:** both tests pass with 10 rows (default limit) and ids `[3, 4, 5]`
(offset=2, limit=3).

## Likely Cause

**File:** `src/routes/users.js`, lines 22–27

```js
// line 22 — no fallback → NaN when limit is absent
const limit = parseInt(req.query.limit, 10);
// line 25 — always adds 1 to the offset
const offset = (parseInt(req.query.offset, 10) || 0) + 1;
const rows = db.prepare('SELECT id, email, name FROM users ORDER BY id LIMIT ? OFFSET ?')
  // line 27 — NaN → -1 passed to SQLite ⇒ unlimited rows
  .all(Number.isNaN(limit) ? -1 : limit, offset);
```

**BUG-1(a)** — `src/routes/users.js:27`: when `req.query.limit` is undefined,
`parseInt` returns `NaN`; the ternary then substitutes `-1`, which SQLite
treats as "no limit", returning all 12 rows instead of 10.

**BUG-1(b)** — `src/routes/users.js:25`: `+ 1` is appended unconditionally.
With `?offset=2` the actual SQL becomes `OFFSET 3`, skipping one extra row and
returning ids `[4, 5, 6]` instead of `[3, 4, 5]`.

The comments in the source already name both bugs explicitly:

```
// BUG-1(a): default limit is not applied; isNaN(limit) → -1 means
// "no limit" in SQLite, so the endpoint returns every row.
// Intended fix: default to 10.

// BUG-1(b): offset is off by one (adds 1 unconditionally).
// Intended fix: use offset as-is.
```

## Supporting Evidence

- **`src/db.js:4–17`** — `SEED` array has exactly 12 entries; the seeded DB
  therefore contains 12 rows. Without a meaningful limit the endpoint returns
  all 12, yielding `length === 12`, but the test observed `11` because SQLite's
  `-1` limit behaviour on this Node version returned all rows while the count
  assertion compared against 10. (Actual observed value in the test run was
  `11`, which is `12 - 1` due to the `OFFSET 1` injected by BUG-1(b) even when
  no offset is requested—`(NaN || 0) + 1 = 1`.)
- **`tests/users.routes.test.js:53–59`** — test asserts `res.body.length === 10`
  with no query params; actual is `11` confirming both bugs interact: unlimited
  rows minus the 1-row offset skip.
- **`tests/users.routes.test.js:63–69`** — test sends `?offset=2&limit=3` and
  asserts ids `[3, 4, 5]`; actual is `[4, 5, 6]`, confirming `+1` offset shift.
- **`src/routes/users.js:19–21`** — the comment block explicitly labels both
  defects and states the intended fixes, confirming intentional bugs placed for
  the exercise.

## Open Questions

None. Both root causes are definitively identified in the source and confirmed
by the test output. The fix is straightforward:

1. Change line 22 to `const limit = parseInt(req.query.limit, 10) || 10;`
   (default to 10 when absent or non-numeric).
2. Change line 25 to `const offset = parseInt(req.query.offset, 10) || 0;`
   (remove the `+ 1`).
