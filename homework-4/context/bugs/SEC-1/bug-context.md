# SEC-1 — input-handling weakness in a read endpoint

A pre-pipeline manual security audit flagged a potential input-handling
weakness in one of the read endpoints of the public API. Identify the
exact location and the nature of the issue.

Existing unit tests are currently green — the weakness is not visible from
the test suite. Treat the audit note as the only signal; do not assume the
weakness is the same as the failing-test bugs.

The Bug Fixer should produce a code change that closes the weakness
without changing the endpoint's observable behaviour for benign inputs.
