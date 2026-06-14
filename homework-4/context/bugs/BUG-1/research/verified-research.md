# BUG-1 Verified Research

## Verification Summary

**Status:** PASS
**Quality:** EXCELLENT

Every file:line reference in `codebase-research.md` was located in the
source and confirmed verbatim. Both named root causes fully account for
the two failing tests.

## Verified Claims

- **Default-limit defect** at `src/routes/users.js:22` —
  `const limit = parseInt(req.query.limit, 10);` confirmed verbatim. With
  `req.query.limit` undefined, `parseInt` returns `NaN`.
- **`-1` sentinel** at `src/routes/users.js:27` —
  `.all(Number.isNaN(limit) ? -1 : limit, offset);` confirmed verbatim.
  SQLite treats `-1` as "no limit".
- **Off-by-one offset** at `src/routes/users.js:25` —
  `const offset = (parseInt(req.query.offset, 10) || 0) + 1;` confirmed
  verbatim. `+ 1` is applied unconditionally.
- **Self-documenting bug comments** at `src/routes/users.js:19–21` and
  `:23–24` — the BUG-1(a) and BUG-1(b) comment blocks exist verbatim and
  state the intended fixes (default to 10; use offset as-is).
- **Seed size = 12** at `src/db.js:4–17` — the `SEED` array contains 12
  entries, confirming the "unlimited rows" claim.
- **Failing test for default limit** at
  `tests/users.routes.test.js:53–59` — asserts `res.body.length === 10`
  on `GET /users` with no params. Verbatim match.
- **Failing test for offset** at `tests/users.routes.test.js:63–69` —
  sends `?offset=2&limit=3` and asserts ids `[3, 4, 5]`. Verbatim match.
- **Symptom arithmetic** — research explains observed length of `11` as
  `12 - 1` because `(NaN || 0) + 1 = 1` injects `OFFSET 1` even with no
  offset supplied. Consistent with code and seed.
- **Proposed fix** — `parseInt(req.query.limit, 10) || 10` and removing
  `+ 1` from the offset line. Both are minimal and isolated to lines 22
  and 25; no other call site of `/users` would be affected.

## Discrepancies Found

None. All quoted code matches the file exactly. The research text says
"comments… at lines 19–21" which covers only the BUG-1(a) block; the
BUG-1(b) comment block is at `:23–24`. This is a labeling nuance, not a
factual error — both comment blocks exist as described and were
inspected directly.

## Research Quality Assessment

**Label:** EXCELLENT.

Criteria met:
- Every file:line reference (`src/routes/users.js:22`, `:25`, `:27`,
  `:19–21`; `src/db.js:4–17`; `tests/users.routes.test.js:53–59`,
  `:63–69`) was verified verbatim against source.
- Every code snippet quoted in the research matches source byte-for-byte
  (whitespace included).
- The two named root causes — missing default for `limit` collapsing to
  the `-1` sentinel, and unconditional `+ 1` on `offset` — together
  fully explain both failing tests, including the observed `11`-row
  count.
- Nothing in the research is speculative; "Open Questions" is correctly
  empty.

No criteria failed. The Planner may proceed.

## References

- `src/routes/users.js:1–39`
- `src/db.js:1–40`
- `tests/users.routes.test.js:1–69`
- `context/bugs/BUG-1/bug-context.md`
- `context/bugs/BUG-1/research/codebase-research.md`
