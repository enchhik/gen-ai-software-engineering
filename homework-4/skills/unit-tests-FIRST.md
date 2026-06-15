# FIRST Principles for Unit Tests

The Unit Test Generator must produce tests that satisfy each FIRST letter
and explain how in `test-report.md`.

## The five letters

- **F — Fast.** A single test must run in under 100 ms on a developer
  machine. Use the in-memory database (`createDb(':memory:')`); never touch
  the file-backed `data.sqlite`. Never sleep.
- **I — Independent.** Tests must not depend on each other's order or
  shared state. Each test builds its own app via
  `createApp(createDb(':memory:'))`. Do not reuse a token issued by one test
  in another.
- **R — Repeatable.** Same input → same output, every time. No reliance on
  the system clock, randomness, or the network. Use `signToken({…})` for
  test tokens, not real login flows that involve hashing time.
- **S — Self-validating.** Every test ends with an `assert.*` (or
  `assert.deepEqual`). A test that prints output and expects a human to
  judge is not self-validating.
- **T — Timely.** Tests are written immediately after (or before) the
  changed code, not weeks later. The Test Generator writes them as part of
  the same pipeline pass that produced the fix.

## Stack template

For this project the test stack is `node:test` + `supertest` against the
in-memory app:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { signToken } from '../src/auth.js';

test('describe what behaviour you are pinning', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users/1')
    .set('Authorization', `Bearer ${signToken({ id: 1, email: 'alice@example.com' })}`);
  assert.equal(res.status, 200);
});
```

## test-report.md required sections

1. **Tests Added** — file:line for each new test, with the FIRST-letter
   justification for each.
2. **Test Run Result** — `npm test` exit code and pass/fail summary.
3. **Coverage Rationale** — which changed lines in the fix are covered by
   which new test.
