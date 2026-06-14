# SEC-1 — Codebase Research

## 1. Symptom Restated

A manual security audit identified an input-handling weakness in one of the public API's read endpoints. Specifically, the `GET /users/search` endpoint accepts a query-string parameter `q` and builds its SQL statement through direct string interpolation — a classic SQL injection vulnerability. Because the existing test suite only exercises benign inputs, all tests remain green while the vulnerability is present.

---

## 2. Reproduction

### Reproduce with npm test (all pass — weakness is invisible to tests)

```bash
cd homework-4
npm test
```

Expected: 36 tests pass. No test exercises a malicious `q` value.

### Demonstrate the injection manually (read-only — does not mutate state)

Start the dev server, register and log in to obtain a token, then probe the endpoint:

```bash
# 1. Register a test user
curl -s -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"pass","name":"Tester"}'

# 2. Log in to get a JWT
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"pass"}' | node -e "process.stdin||(s=''),process.stdin.on('data',d=>s+=d),process.stdin.on('end',()=>console.log(JSON.parse(s).token))")

# 3. Inject: list ALL users regardless of name/email match
curl -s "http://localhost:3000/users/search?q=%25'%20OR%20'1'%3D'1" \
  -H "Authorization: Bearer $TOKEN"
```

**Observed (vulnerable):** The injected value `%' OR '1'='1` causes the SQL engine to evaluate `WHERE name LIKE '%%' OR '1'='1' OR email LIKE '%%' OR '1'='1'`, returning every row in the `users` table regardless of the search term.

**Expected (safe):** Only rows whose `name` or `email` contain the literal string supplied by the user should be returned. Injection attempts must produce no special effect.

---

## 3. Likely Cause

**File:** `src/routes/users.js`  
**Lines 8–15**

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

**Root cause:** `q` is taken directly from `req.query.q` (line 9) and interpolated into the SQL template literal (lines 12–13) without any escaping or parameterisation. `better-sqlite3`'s `db.prepare()` accepts and compiles the already-interpolated string, so SQLite sees whatever SQL the attacker injects.

The fix indicated by the comment — "parameterized LIKE with bound parameters" — means the query should be rewritten as:

```js
const sql = 'SELECT id, email, name FROM users WHERE name LIKE ? OR email LIKE ?';
const rows = db.prepare(sql).all(`%${q}%`, `%${q}%`);
```

This passes the literal `%${q}%` string as a bound parameter, so SQLite treats it as data rather than SQL.

---

## 4. Supporting Evidence

| Location | Relevance |
|---|---|
| `src/routes/users.js:9` | `const q = String(req.query.q \|\| '')` — raw user input with no sanitisation |
| `src/routes/users.js:12–13` | Template-literal SQL construction — the injection site |
| `src/routes/users.js:14` | `db.prepare(sql).all()` — compiles already-tainted SQL |
| `src/routes/users.js:32–33` | `GET /users/:id` uses `?` placeholder correctly — confirms the team knows the safe pattern |
| `src/routes/auth.js:12,16,25` | All other queries use parameterized `?` placeholders — the search endpoint is the sole exception |
| `tests/users.routes.test.js:34–49` | Search tests use benign values (`alice`, `example`) only; no adversarial input tested |

The inline comment at line 11 (`// SEC-1: SQL injection via string concatenation.`) confirms this was the flagged location.

---

## 5. Open Questions

- **LIKE wildcard escaping:** Even after switching to a bound parameter, the `%` and `_` wildcards within the user-supplied value itself are not escaped. A query of `_____` would match any 5-character string. The audit note only requires closing the injection weakness; it is unclear whether LIKE-wildcard abuse is in scope for this fix.
- **Rate-limiting / auth bypass:** The endpoint already requires a valid JWT (`r.use(requireAuth)`). The vulnerability is therefore exploitable only by authenticated users, which slightly reduces blast radius — but authenticated SQL injection is still a serious issue.
- **SQLite `PRAGMA`/multi-statement capability:** `better-sqlite3`'s `prepare()` only compiles a single statement, so classic multi-statement stacked attacks (e.g., `; DROP TABLE users --`) are blocked by the driver. The primary risk is data exfiltration via tautology injections (`OR '1'='1'`), not DDL manipulation.
