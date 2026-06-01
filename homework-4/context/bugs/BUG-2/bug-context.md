# BUG-2 — `POST /auth/login` case-sensitive email

**Symptom:** A user registered with `Carol@example.com` cannot log in using
`carol@example.com` — the lookup compares email case-sensitively.

**Location:** `src/routes/auth.js`, the `/login` handler.

**Failing test:**
- `tests/auth.routes.test.js` → "POST /auth/login matches email case-insensitively"

**Expected behaviour:** email is normalized (lower-cased) on both registration
and login before comparison.
