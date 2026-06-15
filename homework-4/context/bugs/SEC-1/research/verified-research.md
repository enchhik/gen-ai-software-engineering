# SEC-1 — Verified Research

## 1. Verification Summary

**Result:** PASS
**Quality label:** EXCELLENT

Every file:line reference in the research was located in source and
confirmed verbatim. The named root cause (string-interpolated SQL in
`GET /users/search`) fully explains the audit's input-handling weakness.

---

## 2. Verified Claims

- **Vulnerable endpoint is `GET /users/search`** — confirmed at
  `src/routes/users.js:8`.
- **Raw user input taken without sanitisation** —
  `const q = String(req.query.q || '');` is present verbatim at
  `src/routes/users.js:9`.
- **SQL built via template-literal interpolation** — the snippet
  `` `SELECT id, email, name FROM users WHERE name LIKE '%${q}%' OR email LIKE '%${q}%'` ``
  matches `src/routes/users.js:12–13` verbatim (line break and
  indentation preserved).
- **`db.prepare(sql).all()` executes the tainted SQL** — confirmed at
  `src/routes/users.js:14`.
- **Inline marker comment** `// SEC-1: SQL injection via string concatenation.`
  is present at `src/routes/users.js:10` (the research labels the comment
  as line 11; line 10 actually holds the marker and line 11 holds the
  intended-fix follow-up — see Discrepancies).
- **Safe parameterised pattern exists elsewhere** —
  `src/routes/users.js:32–33` uses `WHERE id = ?` with `.get(req.params.id)`,
  confirming the project's safe pattern.
- **Auth route uses placeholders consistently** —
  `src/routes/auth.js:12` (`WHERE email = ?`), `:14–16` (parameterised
  INSERT), and `:25` (`WHERE LOWER(email) = LOWER(?)`) all confirm the
  research's claim that the search endpoint is the only outlier.
- **Tests only exercise benign inputs** —
  `tests/users.routes.test.js:34–49` use `q=alice` and `q=example`,
  matching the research's claim that no adversarial input is covered.
- **Endpoint is authenticated** — `r.use(requireAuth)` at
  `src/routes/users.js:6` confirms exploitation requires a valid JWT.

---

## 3. Discrepancies Found

- **Minor — comment line number off by one.** Research says the marker
  comment `// SEC-1: SQL injection via string concatenation.` is at
  `src/routes/users.js:11`; the file shows it at line 10, with the
  follow-up `// Intended fix: parameterized LIKE with bound parameters.`
  at line 11. No semantic impact: both lines are part of the same
  two-line comment block immediately above the vulnerable SQL.

No other mismatches. The "lines 8–15" range cited for the route handler
exactly matches the source (`r.get('/search', …)` at line 8 through the
closing `});` at line 16, with the snippet itself spanning 8–15 as
quoted).

---

## 4. Research Quality Assessment

**Label:** EXCELLENT.

- All file:line references resolve correctly in source.
- Every code snippet matches the file verbatim (including whitespace
  and the two-line comment block).
- The single off-by-one on the marker-comment line is a label, not a
  reproduced snippet, and does not affect the diagnosis — this stays
  comfortably within EXCELLENT rather than dropping to GOOD, which is
  reserved for snippet discrepancies.
- The root cause (template-literal interpolation of `req.query.q` into a
  SQL string then handed to `db.prepare`) fully accounts for the audit's
  symptom: SQL injection invisible to the green test suite because no
  test passes adversarial input.
- Nothing speculative is asserted as fact; the open questions
  (LIKE-wildcard escaping, blast radius behind auth, single-statement
  `better-sqlite3` constraint) are correctly flagged as out of scope or
  scope-uncertain rather than baked into the root cause.

Planning may proceed.

---

## 5. References

- `src/routes/users.js:6` — `r.use(requireAuth)`
- `src/routes/users.js:8` — `r.get('/search', …)`
- `src/routes/users.js:9` — `const q = String(req.query.q || '');`
- `src/routes/users.js:10–11` — SEC-1 marker + intended-fix comment
- `src/routes/users.js:12–13` — template-literal SQL with `${q}`
- `src/routes/users.js:14` — `db.prepare(sql).all()`
- `src/routes/users.js:32–33` — safe `?`-bound `/users/:id` query
- `src/routes/auth.js:12` — parameterised SELECT by email
- `src/routes/auth.js:14–16` — parameterised INSERT
- `src/routes/auth.js:25` — parameterised SELECT by lowered email
- `tests/users.routes.test.js:34–49` — benign-only `q` coverage
- `context/bugs/SEC-1/bug-context.md` — audit signal
- `context/bugs/SEC-1/research/codebase-research.md` — researcher output
