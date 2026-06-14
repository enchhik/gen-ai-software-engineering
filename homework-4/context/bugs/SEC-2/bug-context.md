# SEC-2 — secret management and credential storage in the auth module

A pre-pipeline manual security audit flagged concerns about secret
management and credential storage in the authentication module. Identify
the exact weaknesses.

**Invariant the fix must preserve:** the existing test
"POST /auth/login returns a token for valid credentials" — which logs in
with the seeded credentials `alice@example.com` / `alice-pass` — must
continue to pass after the fix. The Planner must ensure that any change to
the credential format remains compatible with the seeded data.
