# SEC-2 — hardcoded auth secret and plaintext passwords

**Vulnerabilities:**

1. The HMAC token secret is a hardcoded string literal in source
   (`src/auth.js`).
2. Passwords are stored and compared in plaintext (`hashPassword` is the
   identity function; `verifyPassword` is `===`).

**Location:** `src/auth.js`.

**Expected fix:**
- Read the secret from `process.env.AUTH_SECRET` (fail fast if missing).
- Hash passwords with `crypto.scrypt` (random salt per user) and compare with
  `crypto.timingSafeEqual`.

**Detected by:** Security Verifier agent.
