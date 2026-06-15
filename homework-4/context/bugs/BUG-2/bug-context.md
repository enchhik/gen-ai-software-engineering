# BUG-2 — login fails for users registered with mixed-case email

One unit test in `tests/auth.routes.test.js` is failing:

- "POST /auth/login matches email case-insensitively" — registers
  `Carol@example.com` (or relies on a seeded user with that casing) and
  then logs in with `carol@example.com`. Observes 401; expects 200 with a
  token.

The intended behaviour is that email comparison on login is
case-insensitive. Locate the cause and prepare a fix.
