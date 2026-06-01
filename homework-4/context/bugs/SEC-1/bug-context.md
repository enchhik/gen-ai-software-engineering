# SEC-1 — SQL injection in `GET /users/search`

**Vulnerability:** the `q` query parameter is concatenated directly into the
SQL string, allowing an attacker to inject arbitrary SQL.

**Proof:** `GET /users/search?q=%27%20OR%201=1--` returns every row.

**Location:** `src/routes/users.js`, the `/search` handler.

**Expected fix:** use parameterized `LIKE` with bound parameters
(`db.prepare('… LIKE ?').all('%' + q + '%')`).

**Detected by:** Security Verifier agent (no failing unit test on its own).
