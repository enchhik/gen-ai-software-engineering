# BUG-2 — Verified Research

## 1. Verification Summary

**Result:** PASS
**Quality label:** EXCELLENT

Every file:line reference in `codebase-research.md` was located in the source
tree and matches verbatim. The named root cause (case-sensitive SQLite
`BINARY` collation on the email equality lookup in the login handler) fully
explains the observed 401 in the BUG-2 test, because the seed stores
`Carol@example.com` while the test sends `carol@example.com`.

## 2. Verified Claims

- **`src/routes/auth.js:26`** — `const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);` — confirmed verbatim.
- **`src/routes/auth.js:25`** — comment `// BUG-2: case-sensitive email lookup. Intended fix: lower-case both sides.` — confirmed verbatim (research says "the comment" without a line number; it sits one line above the query).
- **`src/routes/auth.js:27`** — 401 returned when `user` is undefined — confirmed (`if (!user || !verifyPassword(...)) return res.status(401)...`).
- **`src/routes/auth.js:12`** — `const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);` — confirmed verbatim; same case-sensitive pattern on register.
- **`src/db.js:7`** — seed row `['Carol@example.com',   'Carol',    'carol-pass'],` — confirmed verbatim (capital `C`).
- **`tests/auth.routes.test.js:53-59`** — BUG-2 test sends `{ email: 'carol@example.com', password: 'carol-pass' }` and asserts `res.status === 200` plus a token — confirmed verbatim.
- **`tests/auth.routes.test.js:35-41`** — control login test for `alice@example.com` with consistent casing — confirmed verbatim.
- **Root-cause mechanism** — SQLite TEXT `=` defaults to BINARY collation, so the seeded `Carol@...` row is not matched by `carol@...`, producing `undefined` and the 401 response. Mechanism is consistent with the code and with documented SQLite behavior.

## 3. Discrepancies Found

None. No file:line reference was wrong, no snippet differed from source, and
the chain of cause → effect (case-sensitive `=` → no row → 401) is intact.

Minor note (not a discrepancy): the research mentions "the comment in the
source" without giving a line number; the comment is at
`src/routes/auth.js:25`, immediately preceding the offending query at line 26.
This does not contradict the research.

## 4. Research Quality Assessment

**EXCELLENT.** Criteria met:

- Every cited file:line points to the exact code claimed.
- Every quoted snippet matches the source byte-for-byte.
- The named root cause (case-sensitive SQLite `BINARY` collation on
  `email = ?`) is sufficient on its own to explain the observed symptom
  (401 instead of 200 for `carol@example.com` against seeded
  `Carol@example.com`).
- The "Open Questions" section explicitly flags scope choices (normalise on
  register vs. login only, `LOWER(...)` in SQL vs. application-level
  lowercasing) rather than speculating about the cause — appropriate framing
  for the planner.

No criterion for GOOD/ACCEPTABLE/WEAK/INVALID is triggered.

## 5. References

Files consulted during verification:

- `src/routes/auth.js` — lines 1–34 (full file; cause site at 25–28, register query at 12).
- `src/db.js` — lines 1–40 (full file; seed row at 7).
- `tests/auth.routes.test.js` — lines 1–59 (full file; BUG-2 test at 53–59, control login at 35–41).
- `context/bugs/BUG-2/bug-context.md` — bug description / scope.
- `context/bugs/BUG-2/research/codebase-research.md` — the artefact under review.
